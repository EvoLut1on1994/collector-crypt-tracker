const DEFAULT_SOLANA_RPC_URLS = [
  "https://api.mainnet.solana.com",
  "https://api.mainnet-beta.solana.com",
];
const DEFAULT_ALT_GRAPHQL_URL =
  "https://alt-platform-server.production.internal.onlyalt.com/graphql/";
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

  return items.length > 0 ? [...new Set(items)] : fallback;
};

export function getRuntimeConfig() {
  const solanaRpcUrls = splitCsv(
    process.env.SOLANA_RPC_URL?.trim() || process.env.SOLANA_RPC_URLS?.trim(),
    DEFAULT_SOLANA_RPC_URLS,
  );

  return {
    collectorCryptApiKey: process.env.COLLECTOR_CRYPT_API_KEY?.trim() ?? "",
    altGraphqlUrl: process.env.ALT_GRAPHQL_URL?.trim() || DEFAULT_ALT_GRAPHQL_URL,
    solanaRpcUrl: solanaRpcUrls[0],
    solanaRpcUrls,
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
