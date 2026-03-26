import {
  getCollectorCryptCatalog,
  getCollectorCryptPublicPricesForMints,
} from "@/lib/collector-crypt";
import { getRuntimeConfig } from "@/lib/env";
import { getOwnedNfts } from "@/lib/solana-nfts";
import type {
  CollectorCryptPriceItem,
  OwnedNft,
  PortfolioItem,
  PortfolioResponse,
  PortfolioSummary,
  PricingSource,
  SourceStatus,
} from "@/lib/types";

const DEFAULT_COLLECTION_LABEL = "Collector Crypt";

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const includesHint = (nft: OwnedNft, hints: string[]) => {
  const haystack = nft.searchableText;
  return hints.some((hint) => haystack.includes(hint.toLowerCase()));
};

const buildPricingLabel = (
  pricingSource: PricingSource,
  priceCodes: string[],
) => {
  switch (pricingSource) {
    case "collector-crypt-api":
      return `Collector Crypt 官方 API（${priceCodes.join(", ")}）`;
    case "collector-crypt-hybrid":
      return "Collector Crypt 官方 API + 公开站点补充信息";
    default:
      return "Collector Crypt 公开站点接口";
  }
};

export function sortPortfolioItems(items: PortfolioItem[]) {
  return [...items].sort((left, right) => {
    if (left.priced !== right.priced) {
      return left.priced ? -1 : 1;
    }

    if (left.officialUsdValue !== right.officialUsdValue) {
      return (right.officialUsdValue ?? 0) - (left.officialUsdValue ?? 0);
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

export function buildPortfolioSummary(items: PortfolioItem[]): PortfolioSummary {
  const pricedCount = items.filter((item) => item.priced).length;
  const totalOfficialUsd = roundCurrency(
    items.reduce((sum, item) => sum + (item.officialUsdValue ?? 0), 0),
  );

  return {
    totalOfficialUsd,
    pricedCount,
    unpricedCount: items.length - pricedCount,
    totalCollectorCryptCount: items.length,
  };
}

function mergePriceItem(
  primary: CollectorCryptPriceItem,
  secondary: CollectorCryptPriceItem,
): CollectorCryptPriceItem {
  return {
    ...primary,
    name: primary.name ?? secondary.name,
    image: primary.image ?? secondary.image,
    gradingCompany: primary.gradingCompany ?? secondary.gradingCompany,
    gradeLabel: primary.gradeLabel ?? secondary.gradeLabel,
    gradeScore: primary.gradeScore ?? secondary.gradeScore,
    certificateNumber: primary.certificateNumber ?? secondary.certificateNumber,
    source:
      primary.source === "collector-crypt-api" &&
      secondary.source === "collector-crypt-public"
        ? "collector-crypt-hybrid"
        : primary.source,
  };
}

function mergePrices(
  primaryPrices: CollectorCryptPriceItem[],
  secondaryPrices: CollectorCryptPriceItem[],
) {
  const merged = new Map(primaryPrices.map((price) => [price.mint, price]));

  for (const price of secondaryPrices) {
    const existing = merged.get(price.mint);

    if (!existing) {
      merged.set(price.mint, price);
      continue;
    }

    merged.set(price.mint, mergePriceItem(existing, price));
  }

  return [...merged.values()];
}

function toPortfolioItems(
  ownedNfts: OwnedNft[],
  prices: CollectorCryptPriceItem[],
  hints: string[],
) {
  const priceMap = new Map(prices.map((price) => [price.mint, price]));

  return ownedNfts
    .filter((nft) => priceMap.has(nft.mint) || includesHint(nft, hints))
    .map((nft) => {
      const matchedPrice = priceMap.get(nft.mint);

      return {
        mint: nft.mint,
        name: matchedPrice?.name ?? nft.name,
        image: matchedPrice?.image ?? nft.image,
        collectionLabel: nft.collectionLabel ?? DEFAULT_COLLECTION_LABEL,
        gradingCompany: matchedPrice?.gradingCompany ?? null,
        gradeLabel: matchedPrice?.gradeLabel ?? null,
        gradeScore: matchedPrice?.gradeScore ?? null,
        certificateNumber: matchedPrice?.certificateNumber ?? null,
        officialUsdValue: matchedPrice?.officialUsdValue ?? null,
        priced: Boolean(matchedPrice),
      } satisfies PortfolioItem;
    });
}

async function resolveCollectorCryptItems(
  ownedNfts: OwnedNft[],
  hints: string[],
  priceCodes: string[],
  hasApiKey: boolean,
) {
  let catalogPrices: CollectorCryptPriceItem[] = [];
  let pricingSource: PricingSource = "collector-crypt-public";

  if (hasApiKey) {
    try {
      catalogPrices = await getCollectorCryptCatalog();
      pricingSource = "collector-crypt-api";
    } catch {
      pricingSource = "collector-crypt-public";
    }
  }

  const canUseCatalogFilter = catalogPrices.length > 0;
  const catalogPriceMap = new Map(catalogPrices.map((price) => [price.mint, price]));
  const candidateNfts = canUseCatalogFilter
    ? ownedNfts.filter(
        (nft) => catalogPriceMap.has(nft.mint) || includesHint(nft, hints),
      )
    : ownedNfts;

  const publicLookupMints = candidateNfts.map((nft) => nft.mint);
  const publicPrices = await getCollectorCryptPublicPricesForMints(publicLookupMints);
  const mergedPrices = mergePrices(catalogPrices, publicPrices);
  const items = sortPortfolioItems(
    toPortfolioItems(candidateNfts, mergedPrices, hints),
  );

  if (pricingSource === "collector-crypt-api" && publicPrices.length > 0) {
    pricingSource = "collector-crypt-hybrid";
  }

  const sourceStatus: SourceStatus = {
    chain: "ok",
    pricing: "ok",
    rpcUrl: getRuntimeConfig().solanaRpcUrl,
    priceCodes: pricingSource === "collector-crypt-public" ? [] : priceCodes,
    pricingSource,
    pricingLabel: buildPricingLabel(pricingSource, priceCodes),
  };

  return {
    items,
    sourceStatus,
  };
}

export async function getPortfolio(address: string): Promise<PortfolioResponse> {
  const config = getRuntimeConfig();
  const ownedNfts = await getOwnedNfts(address);
  const hints = config.collectorCryptCollectionHints.map((hint) => hint.toLowerCase());
  const { items, sourceStatus } = await resolveCollectorCryptItems(
    ownedNfts,
    hints,
    config.collectorCryptCodes,
    Boolean(config.collectorCryptApiKey),
  );

  return {
    address,
    items,
    summary: buildPortfolioSummary(items),
    sourceStatus,
  };
}
