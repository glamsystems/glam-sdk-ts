import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { BaseClient } from "../../src/client/base";
import {
  JupiterBorrowClient,
  JupiterEarnClient,
} from "../../src/client/jupiter-lend";
import { VaultClient } from "../../src/client/vault";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  JUPITER_LENDING_PROGRAM_ID,
  JUPITER_LIQUIDITY_PROGRAM_ID,
  JUPITER_VAULTS_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
} from "../../src/constants";

function makeBaseClient(): BaseClient {
  const signer = Keypair.generate().publicKey;
  return new BaseClient({
    cluster: ClusterNetwork.Localnet,
    provider: {
      connection: {
        rpcEndpoint: "http://localhost:8899",
        commitment: "confirmed",
      },
      publicKey: signer,
    } as any,
    statePda: Keypair.generate().publicKey,
    useStaging: false,
  });
}

function makeEarnClient(): JupiterEarnClient {
  return new JupiterEarnClient(makeBaseClient());
}

function makeBorrowClient(): JupiterBorrowClient {
  const base = makeBaseClient();
  return new JupiterBorrowClient(base, new VaultClient(base));
}

function pubkey(): PublicKey {
  return Keypair.generate().publicKey;
}

describe("Jupiter lend instruction builders", () => {
  it("places GLAM vault ATAs and Jupiter Earn program IDs for deposit", async () => {
    const client = makeEarnClient();
    const mint = pubkey();
    const fTokenMint = pubkey();

    const ix = await client.txBuilder.depositIx(10, 9, {
      mint,
      lendingAdmin: pubkey(),
      lending: pubkey(),
      fTokenMint,
      supplyTokenReservesLiquidity: pubkey(),
      lendingSupplyPositionOnLiquidity: pubkey(),
      rateModel: pubkey(),
      vault: pubkey(),
      liquidity: pubkey(),
      rewardsRateModel: pubkey(),
    });

    expect(ix.programId.equals(client.base.extJupiterProgram.programId)).toBe(
      true,
    );
    expect(ix.keys[1].pubkey.equals(client.base.vaultPda)).toBe(true);
    expect(ix.keys[2].pubkey.equals(client.base.signer)).toBe(true);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[4].pubkey.equals(JUPITER_LENDING_PROGRAM_ID)).toBe(true);
    expect(ix.keys[7].pubkey.equals(client.base.getVaultAta(mint))).toBe(true);
    expect(ix.keys[8].pubkey.equals(client.base.getVaultAta(fTokenMint))).toBe(
      true,
    );
    expect(ix.keys[18].pubkey.equals(JUPITER_LIQUIDITY_PROGRAM_ID)).toBe(true);
    expect(ix.keys[20].pubkey.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[21].pubkey.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
  });

  it("places Jupiter Borrow program IDs for initPosition", async () => {
    const client = makeBorrowClient();
    const positionMint = pubkey();
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        positionMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const ix = await client.txBuilder.initPositionIx(7, 42, {
      vaultAdmin: pubkey(),
      vaultState: pubkey(),
      position: pubkey(),
      positionMint,
      positionTokenAccount: pubkey(),
    });

    expect(ix.programId.equals(client.base.extJupiterProgram.programId)).toBe(
      true,
    );
    expect(ix.keys[1].pubkey.equals(client.base.vaultPda)).toBe(true);
    expect(ix.keys[2].pubkey.equals(client.base.signer)).toBe(true);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[4].pubkey.equals(JUPITER_VAULTS_PROGRAM_ID)).toBe(true);
    expect(ix.keys[12].pubkey.equals(metadataAccount)).toBe(true);
    expect(ix.keys[13].pubkey.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[14].pubkey.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
  });

  it("passes tick debt remaining accounts into the final tick probe", async () => {
    const client = makeBorrowClient();
    const oracleSource = pubkey();
    const tickHasDebt = pubkey();
    const captured: { indices?: Buffer; remaining?: string[] } = {};

    (client.txBuilder as any).operateIx = async (
      _newCol: BN,
      _newDebt: BN,
      _transferType: unknown,
      remainingAccountsIndices: Buffer,
      accounts: { remainingAccounts?: { pubkey: PublicKey }[] },
    ) => {
      captured.indices = Buffer.from(remainingAccountsIndices);
      captured.remaining = accounts.remainingAccounts?.map((a) =>
        a.pubkey.toBase58(),
      );
      return new TransactionInstruction({
        programId: pubkey(),
        keys: [],
        data: Buffer.alloc(0),
      });
    };
    (client.base.connection as any).simulateTransaction = async () => ({
      value: {
        logs: ["Program log: Tick mismatch: expected 2198 but got 2277"],
      },
    });

    const result = await (client as any).simulateExpectedFinalTick(
      new BN(0),
      new BN(-100_000),
      { direct: {} },
      {
        indices: Buffer.from([1, 0, 1]),
        accounts: [
          { pubkey: oracleSource, isSigner: false, isWritable: false },
          { pubkey: tickHasDebt, isSigner: false, isWritable: true },
        ],
      },
      {},
    );

    expect(result).toBe(2198);
    expect(captured.indices?.equals(Buffer.from([1, 0, 1]))).toBe(true);
    expect(captured.remaining).toEqual([
      oracleSource.toBase58(),
      tickHasDebt.toBase58(),
    ]);
  });
});
