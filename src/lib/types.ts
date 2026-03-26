export type PricingSource =
  | "collector-crypt-api"
  | "collector-crypt-public"
  | "collector-crypt-hybrid";

export type SourceStatus = {
  chain: "ok";
  pricing: "ok";
  rpcUrl: string;
  priceCodes: string[];
  pricingSource: PricingSource;
  pricingLabel: string;
};

export type PortfolioItem = {
  mint: string;
  name: string;
  image: string | null;
  collectionLabel: string;
  gradingCompany: string | null;
  gradeLabel: string | null;
  gradeScore: string | null;
  certificateNumber: string | null;
  officialUsdValue: number | null;
  priced: boolean;
};

export type PortfolioSummary = {
  totalOfficialUsd: number;
  pricedCount: number;
  unpricedCount: number;
  totalCollectorCryptCount: number;
};

export type PortfolioResponse = {
  address: string;
  items: PortfolioItem[];
  summary: PortfolioSummary;
  sourceStatus: SourceStatus;
};

export type OwnedNft = {
  mint: string;
  name: string;
  image: string | null;
  collectionLabel: string | null;
  searchableText: string;
};

export type CollectorCryptPriceItem = {
  mint: string;
  name: string | null;
  officialUsdValue: number;
  image: string | null;
  gradingCompany: string | null;
  gradeLabel: string | null;
  gradeScore: string | null;
  certificateNumber: string | null;
  code: string;
  source: PricingSource;
};

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}
