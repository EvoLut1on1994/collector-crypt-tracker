import { isNonFungible, Metaplex } from "@metaplex-foundation/js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

import { getRuntimeConfig } from "@/lib/env";
import { solanaRpcFetch } from "@/lib/solana-rpc-fetch";
import { AppError, type OwnedNft } from "@/lib/types";

type ParsedTokenAccount = {
  account: {
    data: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
          };
        };
      };
    };
  };
};

const collectSearchableText = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();

async function getOwnerNftMints(connection: Connection, owner: PublicKey) {
  const responses = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  const mints = new Set<string>();

  for (const response of responses) {
    for (const account of response.value as ParsedTokenAccount[]) {
      const mint = account.account.data.parsed?.info?.mint;
      const amount = account.account.data.parsed?.info?.tokenAmount?.amount;
      const decimals = account.account.data.parsed?.info?.tokenAmount?.decimals;

      if (mint && amount === "1" && decimals === 0) {
        mints.add(mint);
      }
    }
  }

  return [...mints].map((mint) => new PublicKey(mint));
}

export async function getOwnedNfts(ownerAddress: string): Promise<OwnedNft[]> {
  const { solanaRpcUrl } = getRuntimeConfig();
  let owner: PublicKey;

  try {
    owner = new PublicKey(ownerAddress);
  } catch {
    throw new AppError("请输入有效的 Solana 地址。", 400, "INVALID_SOLANA_ADDRESS");
  }

  const connection = new Connection(solanaRpcUrl, {
    commitment: "confirmed",
    fetch: solanaRpcFetch,
  });
  const metaplex = Metaplex.make(connection);

  try {
    const mints = await getOwnerNftMints(connection, owner);

    if (mints.length === 0) {
      return [];
    }

    const metadataList = await metaplex.nfts().findAllByMintList({ mints });
    const nftCandidates = metadataList.filter(
      (asset): asset is Exclude<(typeof metadataList)[number], null> =>
        asset !== null && isNonFungible(asset),
    );
    
    return nftCandidates.map((asset) => {
      return {
        mint:
          "mintAddress" in asset
            ? asset.mintAddress.toBase58()
            : asset.address.toBase58(),
        name: asset.name.trim(),
        image: null,
        collectionLabel: (asset.symbol ?? asset.name ?? "").trim() || null,
        searchableText: collectSearchableText(
          asset.name,
          asset.symbol,
          "uri" in asset ? asset.uri : null,
        ),
      } satisfies OwnedNft;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "Solana 链上持仓查询失败，请稍后重试。",
      502,
      "SOLANA_RPC_FAILED",
    );
  }
}
