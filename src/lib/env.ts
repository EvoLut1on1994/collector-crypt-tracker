const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const DEFAULT_CODES = ["pokemon_50", "pokemon_250"];
const DEFAULT_COLLECTION_HINTS = [
  "Collector Crypt",
  "Collector Crypt: Pokemon",
];

const splitCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) {
    return fallback;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
};

export function getRuntimeConfig() {
  return {
    collectorCryptApiKey: process.env.COLLECTOR_CRYPT_API_KEY?.trim() ?? "",
    solanaRpcUrl: process.env.SOLANA_RPC_URL?.trim() || DEFAULT_SOLANA_RPC_URL,
    collectorCryptCodes: splitCsv(
      process.env.COLLECTOR_CRYPT_CODES,
      DEFAULT_CODES,
    ),
    collectorCryptCollectionHints: splitCsv(
      process.env.COLLECTOR_CRYPT_COLLECTION_HINTS,
      DEFAULT_COLLECTION_HINTS,
    ),
  };
}
