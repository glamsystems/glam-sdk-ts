import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { OrcaClient } from "../../src/client/orca";

const GLAM_STATE = PublicKey.unique();
const GLAM_VAULT = PublicKey.unique();
const SIGNER = PublicKey.unique();
const PROTOCOL = PublicKey.unique();
const EXT_ORCA = PublicKey.unique();

function pubkey(): PublicKey {
  return PublicKey.unique();
}

function mintAccountInfo(owner: PublicKey) {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: 0n,
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  );
  return {
    data,
    executable: false,
    lamports: 0,
    owner,
    rentEpoch: 0,
  };
}

function methodBuilder(programId: PublicKey = EXT_ORCA) {
  const builder = {
    accountsPartial: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(
      async () =>
        new TransactionInstruction({
          programId,
          keys: [],
          data: Buffer.alloc(0),
        }),
    ),
  };
  return builder;
}

function makeOrcaClient(mintOwners: Map<string, PublicKey>) {
  const builders = {
    increaseLiquidityV2: methodBuilder(),
    collectRewardV2: methodBuilder(),
  };
  const getAccountInfo = jest.fn(async (mint: PublicKey) => {
    const owner = mintOwners.get(mint.toBase58());
    return owner ? mintAccountInfo(owner) : null;
  });
  const base = {
    statePda: GLAM_STATE,
    vaultPda: GLAM_VAULT,
    signer: SIGNER,
    protocolProgram: { programId: PROTOCOL },
    extOrcaProgram: {
      programId: EXT_ORCA,
      methods: {
        increaseLiquidityV2: jest.fn(() => builders.increaseLiquidityV2),
        collectRewardV2: jest.fn(() => builders.collectRewardV2),
      },
    },
    connection: { getAccountInfo },
    getVaultAta: (mint: PublicKey, tokenProgram?: PublicKey) =>
      getAssociatedTokenAddressSync(mint, GLAM_VAULT, true, tokenProgram),
  };

  return { client: new OrcaClient(base as any), builders, getAccountInfo };
}

describe("Orca SDK instruction builders", () => {
  it("resolves liquidity token program defaults from token mint owners", async () => {
    const tokenMintA = pubkey();
    const tokenMintB = pubkey();
    const { client, builders, getAccountInfo } = makeOrcaClient(
      new Map([
        [tokenMintA.toBase58(), TOKEN_2022_PROGRAM_ID],
        [tokenMintB.toBase58(), TOKEN_PROGRAM_ID],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Ix(
      {
        liquidityAmount: 1,
        tokenMaxA: 2,
        tokenMaxB: 3,
      },
      {
        whirlpool: pubkey(),
        position: pubkey(),
        positionMint: pubkey(),
        tokenMintA,
        tokenMintB,
        tokenVaultA: pubkey(),
        tokenVaultB: pubkey(),
        tickArrayLower: pubkey(),
        tickArrayUpper: pubkey(),
      },
    );

    const accounts =
      builders.increaseLiquidityV2.accountsPartial.mock.calls[0][0];
    expect(accounts.tokenProgramA.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(accounts.tokenProgramB.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(
      accounts.tokenOwnerAccountA.equals(
        getAssociatedTokenAddressSync(
          tokenMintA,
          GLAM_VAULT,
          true,
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
    expect(
      accounts.tokenOwnerAccountB.equals(
        getAssociatedTokenAddressSync(
          tokenMintB,
          GLAM_VAULT,
          true,
          TOKEN_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
    expect(getAccountInfo).toHaveBeenCalledWith(tokenMintA, "confirmed");
    expect(getAccountInfo).toHaveBeenCalledWith(tokenMintB, "confirmed");
  });

  it("resolves reward token program defaults from reward mint owner", async () => {
    const rewardMint = pubkey();
    const { client, builders } = makeOrcaClient(
      new Map([[rewardMint.toBase58(), TOKEN_2022_PROGRAM_ID]]),
    );

    await client.txBuilder.collectRewardV2Ix(0, {
      whirlpool: pubkey(),
      position: pubkey(),
      positionMint: pubkey(),
      rewardMint,
      rewardVault: pubkey(),
    });

    const accounts = builders.collectRewardV2.accountsPartial.mock.calls[0][0];
    expect(accounts.rewardTokenProgram.equals(TOKEN_2022_PROGRAM_ID)).toBe(
      true,
    );
    expect(
      accounts.rewardOwnerAccount.equals(
        getAssociatedTokenAddressSync(
          rewardMint,
          GLAM_VAULT,
          true,
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
    ).toBe(true);
  });
});
