import { getRuntimeConfig } from "@/lib/env";
import {
  AppError,
  type CollectorCryptPriceItem,
  type PricingSource,
} from "@/lib/types";

const COLLECTOR_CRYPT_GACHA_API = "https://gacha.collectorcrypt.com/api/getNfts";
const COLLECTOR_CRYPT_PUBLIC_API = "https://api.collectorcrypt.com";
const REQUEST_SOURCE = "https://collectorcrypt.com/marketplace/cards";
const PRICE_SCALE = 1_000_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_LOOKUP_CONCURRENCY = 8;

type RawPriceRecord = Record<string, unknown>;
type PublicCardRecord = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

const firstString = (...values: Array<string | null>) =>
  values.find((value) => Boolean(value)) ?? null;

let catalogCache:
  | {
      key: string;
      expiresAt: number;
      items: CollectorCryptPriceItem[];
    }
  | null = null;

const publicCardCache = new Map<
  string,
  {
    expiresAt: number;
    item: CollectorCryptPriceItem | null;
  }
>();

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const formatScore = (value: unknown) => {
  const raw = toNumber(value);

  if (raw !== null) {
    return Number.isInteger(raw) ? `${raw}` : `${raw}`;
  }

  return asString(value);
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await mapper(items[current], current);
      }
    }),
  );

  return results;
}

const extractRecords = (payload: unknown): RawPriceRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (entry): entry is RawPriceRecord =>
        typeof entry === "object" && entry !== null,
    );
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const candidates = [
    (payload as { nfts?: unknown }).nfts,
    (payload as { data?: unknown }).data,
    (payload as { result?: unknown }).result,
    (payload as { items?: unknown }).items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (entry): entry is RawPriceRecord =>
          typeof entry === "object" && entry !== null,
      );
    }
  }

  return [];
};

const createPriceItem = (
  mint: string,
  name: string | null,
  officialUsdValue: number,
  image: string | null,
  gradingCompany: string | null,
  gradeLabel: string | null,
  gradeScore: string | null,
  certificateNumber: string | null,
  code: string,
  source: PricingSource,
): CollectorCryptPriceItem => ({
  mint,
  name,
  officialUsdValue,
  image,
  gradingCompany,
  gradeLabel,
  gradeScore,
  certificateNumber,
  code,
  source,
});

export function normalizeInsuredValue(value: unknown) {
  const raw = toNumber(value);

  if (raw === null) {
    return null;
  }

  return raw / PRICE_SCALE;
}

export function normalizePublicInsuredValue(value: unknown) {
  const raw = toNumber(value);
  return raw === null ? null : raw;
}

async function safeParseJson<T>(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractCollectorCryptImage(record: RawPriceRecord) {
  const images = asRecord(record.images);
  const metadata = asRecord(record.metadata);

  return firstString(
    asString(images?.frontS),
    asString(images?.frontM),
    asString(images?.front),
    asString(record.frontImage),
    asString(record.front_image),
    asString(record.image),
    asString(record.image_url),
    asString(metadata?.image),
  );
}

function extractCollectorCryptName(record: RawPriceRecord) {
  const metadata = asRecord(record.metadata);

  return firstString(
    asString(record.itemName),
    asString(record.name),
    asString(metadata?.name),
  );
}

function extractCollectorCryptGradingCompany(record: RawPriceRecord) {
  return firstString(
    asString(record.gradingCompany),
    asString(record.grading_company),
  );
}

function extractCollectorCryptGradeLabel(record: RawPriceRecord) {
  return firstString(
    asString(record.grade),
    asString(record.gradeLabel),
    asString(record.grade_label),
  );
}

function extractCollectorCryptGradeScore(record: RawPriceRecord) {
  return firstString(
    formatScore(record.gradeNum),
    formatScore(record.grade_num),
    formatScore(record.score),
  );
}

function extractCollectorCryptCertificateNumber(record: RawPriceRecord) {
  return firstString(
    asString(record.gradingID),
    asString(record.gradingId),
    asString(record.certificateNumber),
    asString(record.certNumber),
    asString(record.certificationNumber),
  );
}

async function fetchCatalogByCode(
  code: string,
  apiKey: string,
): Promise<CollectorCryptPriceItem[]> {
  const url = `${COLLECTOR_CRYPT_GACHA_API}?code=${encodeURIComponent(code)}`;
  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      "Collector Crypt API Key 无效或没有访问权限。",
      502,
      "COLLECTOR_CRYPT_AUTH_FAILED",
    );
  }

  if (!response.ok) {
    throw new AppError(
      `Collector Crypt 官方价格接口请求失败（${response.status}）。`,
      502,
      "COLLECTOR_CRYPT_FETCH_FAILED",
    );
  }

  const payload = await safeParseJson<unknown>(response);

  if (payload === null) {
    throw new AppError(
      "Collector Crypt 官方价格接口返回了无效数据。",
      502,
      "COLLECTOR_CRYPT_FETCH_INVALID_JSON",
    );
  }

  const records = extractRecords(payload);

  return records
    .map((record) => {
      const mint =
        typeof record.nft_address === "string"
          ? record.nft_address
          : typeof record.mint === "string"
            ? record.mint
            : typeof record.address === "string"
              ? record.address
              : null;
      const officialUsdValue = normalizeInsuredValue(
        record.insured_value ?? record.insuredValue ?? record.usd_value,
      );

      if (!mint || officialUsdValue === null) {
        return null;
      }

      return createPriceItem(
        mint,
        extractCollectorCryptName(record),
        officialUsdValue,
        extractCollectorCryptImage(record),
        extractCollectorCryptGradingCompany(record),
        extractCollectorCryptGradeLabel(record),
        extractCollectorCryptGradeScore(record),
        extractCollectorCryptCertificateNumber(record),
        code,
        "collector-crypt-api",
      );
    })
    .filter((item): item is CollectorCryptPriceItem => item !== null);
}

async function fetchPublicCardByMint(
  mint: string,
): Promise<CollectorCryptPriceItem | null> {
  const now = Date.now();
  const cached = publicCardCache.get(mint);

  if (cached && cached.expiresAt > now) {
    return cached.item;
  }

  let response: Response;

  try {
    response = await fetch(
      `${COLLECTOR_CRYPT_PUBLIC_API}/cards/publicNft/${encodeURIComponent(mint)}`,
      {
        headers: {
          Accept: "application/json",
          "x-request-source": REQUEST_SOURCE,
        },
        cache: "no-store",
      },
    );
  } catch {
    throw new AppError(
      "Collector Crypt 公开站点价格接口请求失败，请稍后重试。",
      502,
      "COLLECTOR_CRYPT_PUBLIC_FETCH_FAILED",
    );
  }

  if (response.status === 400 || response.status === 404) {
    publicCardCache.set(mint, {
      expiresAt: now + CACHE_TTL_MS,
      item: null,
    });
    return null;
  }

  if (!response.ok) {
    throw new AppError(
      `Collector Crypt 公开站点价格接口请求失败（${response.status}）。`,
      502,
      "COLLECTOR_CRYPT_PUBLIC_FETCH_FAILED",
    );
  }

  const payload = await safeParseJson<PublicCardRecord>(response);

  if (payload === null) {
    publicCardCache.set(mint, {
      expiresAt: now + 30_000,
      item: null,
    });
    return null;
  }

  const officialUsdValue = normalizePublicInsuredValue(
    payload.insuredValue ?? payload.insured_value,
  );
  const resolvedMint =
    typeof payload.nftAddress === "string" && payload.nftAddress.trim()
      ? payload.nftAddress
      : mint;

  if (officialUsdValue === null) {
    publicCardCache.set(mint, {
      expiresAt: now + CACHE_TTL_MS,
      item: null,
    });
    return null;
  }

  const item = createPriceItem(
    resolvedMint,
    extractCollectorCryptName(payload),
    officialUsdValue,
    extractCollectorCryptImage(payload),
    extractCollectorCryptGradingCompany(payload),
    extractCollectorCryptGradeLabel(payload),
    extractCollectorCryptGradeScore(payload),
    extractCollectorCryptCertificateNumber(payload),
    "publicNft",
    "collector-crypt-public",
  );

  publicCardCache.set(mint, {
    expiresAt: now + CACHE_TTL_MS,
    item,
  });

  return item;
}

export async function getCollectorCryptCatalog() {
  const config = getRuntimeConfig();
  const apiKey = config.collectorCryptApiKey;

  if (!apiKey) {
    throw new AppError(
      "缺少 COLLECTOR_CRYPT_API_KEY，无法读取 Collector Crypt 官方价格。",
      503,
      "COLLECTOR_CRYPT_API_KEY_MISSING",
    );
  }

  const cacheKey = `${apiKey}:${config.collectorCryptCodes.join(",")}`;
  const now = Date.now();

  if (catalogCache && catalogCache.key === cacheKey && catalogCache.expiresAt > now) {
    return catalogCache.items;
  }

  const results = await Promise.all(
    config.collectorCryptCodes.map((code) => fetchCatalogByCode(code, apiKey)),
  );

  const deduped = new Map<string, CollectorCryptPriceItem>();

  for (const item of results.flat()) {
    deduped.set(item.mint, item);
  }

  const items = [...deduped.values()];
  catalogCache = {
    key: cacheKey,
    expiresAt: now + CACHE_TTL_MS,
    items,
  };

  return items;
}

export async function getCollectorCryptPublicPricesForMints(mints: string[]) {
  const uniqueMints = [...new Set(mints.filter(Boolean))];

  if (uniqueMints.length === 0) {
    return [];
  }

  const results = await mapWithConcurrency(
    uniqueMints,
    PUBLIC_LOOKUP_CONCURRENCY,
    async (mint) => fetchPublicCardByMint(mint),
  );

  return results.filter(
    (item): item is CollectorCryptPriceItem => item !== null,
  );
}
