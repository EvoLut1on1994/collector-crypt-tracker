import { getRuntimeConfig } from "@/lib/env";
import { formatGradeNumber } from "@/lib/format";
import type {
  AltPopulationEntry,
  AltResearchCard,
  AltResearchResponse,
  AltTransaction,
  AltTransactionSource,
  AppError,
} from "@/lib/types";
import { AppError as AppErrorClass } from "@/lib/types";

const ALT_REQUEST_TIMEOUT_MS = 20000;
const ALT_MAX_TRANSACTIONS = 12;
const COMPANY_ORDER = ["PSA", "BGS", "CGC"];

type AltGraphqlError = {
  message?: string;
};

type AltGraphqlResponse<TData> = {
  data?: TData;
  errors?: AltGraphqlError[];
};

type AltCertLookup = {
  certNumber: string;
  gradingCompany: string;
  gradeNumber: string;
  asset: {
    id: string;
    name: string;
  } | null;
};

type RawAltPopulation = {
  gradingCompany: string | null;
  gradeNumber: string | null;
  count: number | null;
};

type RawAltTransaction = {
  id: string | null;
  date: string | null;
  price: number | string | null;
};

type RawAltAsset = {
  id: string;
  name: string;
  altValueInfo: {
    currentAltValue: number | null;
  } | null;
  cardPops: RawAltPopulation[];
  marketTransactions: RawAltTransaction[];
  externalTransactions: RawAltTransaction[];
};

const parseAltPrice = (value: number | string | null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const sortCompany = (left: string, right: string) => {
  const leftIndex = COMPANY_ORDER.indexOf(left);
  const rightIndex = COMPANY_ORDER.indexOf(right);
  const safeLeftIndex = leftIndex === -1 ? COMPANY_ORDER.length : leftIndex;
  const safeRightIndex = rightIndex === -1 ? COMPANY_ORDER.length : rightIndex;

  if (safeLeftIndex !== safeRightIndex) {
    return safeLeftIndex - safeRightIndex;
  }

  return left.localeCompare(right, "en-US");
};

const sortGrade = (left: string, right: string) => {
  const leftValue = Number.parseFloat(left);
  const rightValue = Number.parseFloat(right);

  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
    return rightValue - leftValue;
  }

  return right.localeCompare(left, "en-US");
};

const normalizePopulations = (populations: RawAltPopulation[]): AltPopulationEntry[] =>
  populations
    .map((entry) => ({
      gradingCompany: entry.gradingCompany?.trim().toUpperCase() ?? "",
      gradeNumber: formatGradeNumber(entry.gradeNumber),
      count:
        typeof entry.count === "number" && Number.isFinite(entry.count)
          ? entry.count
          : 0,
    }))
    .filter((entry) => entry.gradingCompany && entry.gradeNumber)
    .sort((left, right) => {
      const companyOrder = sortCompany(left.gradingCompany, right.gradingCompany);
      if (companyOrder !== 0) {
        return companyOrder;
      }

      return sortGrade(left.gradeNumber, right.gradeNumber);
    });

export function buildRecentTransactions(
  marketTransactions: RawAltTransaction[],
  externalTransactions: RawAltTransaction[],
) {
  const normalizeTransactions = (
    entries: RawAltTransaction[],
    source: AltTransactionSource,
  ): AltTransaction[] =>
    entries
      .map((entry) => ({
        id: entry.id ?? "",
        date: entry.date ?? "",
        price: parseAltPrice(entry.price),
        source,
      }))
      .filter(
        (entry): entry is AltTransaction =>
          Boolean(entry.id) && Boolean(entry.date) && entry.price !== null,
      );

  return [
    ...normalizeTransactions(marketTransactions, "market"),
    ...normalizeTransactions(externalTransactions, "external"),
  ]
    .sort((left, right) => {
      const dateOrder =
        new Date(right.date).getTime() - new Date(left.date).getTime();
      if (dateOrder !== 0) {
        return dateOrder;
      }

      return right.price - left.price;
    })
    .slice(0, ALT_MAX_TRANSACTIONS);
}

const buildCurrentGradePopulation = (
  populations: AltPopulationEntry[],
  gradingCompany: string,
  gradeNumber: string,
) =>
  populations.find(
    (entry) =>
      entry.gradingCompany === gradingCompany &&
      entry.gradeNumber === formatGradeNumber(gradeNumber),
  )?.count ?? null;

export function buildAltResearchCard(
  lookup: AltCertLookup,
  asset: RawAltAsset,
): AltResearchCard {
  const populations = normalizePopulations(asset.cardPops);
  const gradingCompany = lookup.gradingCompany.trim().toUpperCase();
  const gradeNumber = formatGradeNumber(lookup.gradeNumber);

  return {
    certificateNumber: lookup.certNumber,
    assetId: asset.id,
    assetName: asset.name,
    gradingCompany,
    gradeNumber,
    currentAltValue: asset.altValueInfo?.currentAltValue ?? null,
    currentGradePopulation: buildCurrentGradePopulation(
      populations,
      gradingCompany,
      gradeNumber,
    ),
    populations,
    recentTransactions: buildRecentTransactions(
      asset.marketTransactions,
      asset.externalTransactions,
    ),
  };
}

async function fetchAltGraphql<TData>(
  query: string,
  variables: Record<string, string>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getRuntimeConfig().altGraphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppErrorClass("Alt 数据接口请求失败，请稍后重试。", 502, "ALT_UPSTREAM_ERROR");
    }

    const payload = (await response.json()) as AltGraphqlResponse<TData>;

    if (payload.errors?.length) {
      throw new AppErrorClass(
        payload.errors[0]?.message || "Alt 数据接口返回异常。",
        502,
        "ALT_GRAPHQL_ERROR",
      );
    }

    if (!payload.data) {
      throw new AppErrorClass("Alt 数据接口没有返回有效数据。", 502, "ALT_EMPTY_DATA");
    }

    return payload.data;
  } catch (error) {
    if (error instanceof AppErrorClass) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AppErrorClass("Alt 数据查询超时，请稍后重试。", 504, "ALT_TIMEOUT");
    }

    throw new AppErrorClass("Alt 数据查询失败，请稍后重试。", 502, "ALT_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

async function getAltCertLookup(certificateNumber: string) {
  const data = await fetchAltGraphql<{ cert: AltCertLookup | null }>(
    `
      query AltCertLookup($certNumber: String!) {
        cert(certNumber: $certNumber) {
          certNumber
          gradingCompany
          gradeNumber
          asset {
            id
            name
          }
        }
      }
    `,
    { certNumber: certificateNumber },
  );

  return data.cert;
}

async function getAltAssetDetails(
  assetId: string,
  gradingCompany: string,
  gradeNumber: string,
) {
  const data = await fetchAltGraphql<{ asset: RawAltAsset | null }>(
    `
      query AltAssetDetails(
        $id: ID!
        $gradingCompany: String!
        $gradeNumber: String!
      ) {
        asset(id: $id) {
          id
          name
          altValueInfo {
            currentAltValue
          }
          cardPops {
            gradingCompany
            gradeNumber
            count
          }
          marketTransactions(
            marketTransactionFilter: {
              gradingCompany: $gradingCompany
              gradeNumber: $gradeNumber
            }
          ) {
            id
            date
            price
          }
          externalTransactions(
            transactionsFilter: {
              gradingCompany: $gradingCompany
              gradeNumber: $gradeNumber
            }
          ) {
            id
            date
            price
          }
        }
      }
    `,
    {
      id: assetId,
      gradingCompany,
      gradeNumber,
    },
  );

  return data.asset;
}

export async function getAltResearchByCertificate(
  certificateNumber: string,
): Promise<AltResearchResponse> {
  const normalizedCertificate = certificateNumber.trim();

  if (!normalizedCertificate) {
    throw new AppErrorClass("请先提供证书编号。", 400, "ALT_CERT_REQUIRED");
  }

  const lookup = await getAltCertLookup(normalizedCertificate);

  if (!lookup?.asset?.id) {
    return {
      found: false,
      certificateNumber: normalizedCertificate,
      message: "Alt 暂未收录这张卡的研究数据。",
    };
  }

  const asset = await getAltAssetDetails(
    lookup.asset.id,
    lookup.gradingCompany,
    lookup.gradeNumber,
  );

  if (!asset) {
    return {
      found: false,
      certificateNumber: normalizedCertificate,
      message: "Alt 暂时没有返回这张卡的详情数据。",
    };
  }

  return {
    found: true,
    card: buildAltResearchCard(lookup, asset),
  };
}

export { AppErrorClass as AltAppError };
