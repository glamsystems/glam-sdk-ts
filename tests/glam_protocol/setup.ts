import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  GlamClient,
  WSOL,
  MSOL,
  USDC,
  nameToChars,
  StateAccountType,
} from "../../src";
import { Connection } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { airdrop } from "../test-utils";
import { InitStateParams } from "../../src/client/state";

export const JITO_STAKE_POOL = new PublicKey(
  "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb",
);
export const JUPSOL_STAKE_POOL = new PublicKey(
  "8VpRhuxa7sUUepdY3kQiTmX9rS5vx4WgaXiAnXq4KCtr",
);
export const BONK_STAKE_POOL = new PublicKey(
  "ArAQfbzsdotoKB5jJcZa3ajQrrPcWr2YQoDAEAiFxJAC",
);
export const PHASE_LABS_STAKE_POOL = new PublicKey(
  "phasejkG1akKgqkLvfWzWY17evnH6mSWznnUspmpyeG",
);

export { str2seed, sleep, airdrop } from "../test-utils";

export const isInRange = (
  value: BN | number,
  lowerBound: BN | number,
  upperBound: BN | number,
) => {
  const v = new BN(value);
  return v.gte(new BN(lowerBound)) && v.lte(new BN(upperBound));
};

export const buildAndSendTx = async (
  glamClient: GlamClient,
  ixs: TransactionInstruction[],
) => {
  const tx = new Transaction();
  tx.add(...ixs);
  const vTx = await glamClient.intoVersionedTransaction(tx, {
    simulate: true,
  });
  return await glamClient.sendAndConfirm(vTx);
};

export const loadWalletFromDisk = (path: string) => {
  let payer = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(require("fs").readFileSync(path, { encoding: "utf-8" })),
    ),
  );
  return new NodeWallet(payer);
};

export const mintUSDC = async (
  connection: Connection,
  recipient: PublicKey,
  amount: number,
) => {
  // USDC mint used in localnet test has been modified to have the test keypair as mint authority
  const mintAuthority = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        require("fs").readFileSync("./tests/test-keypair.json", {
          encoding: "utf-8",
        }),
      ),
    ),
  );

  // airdrop 1 SOL to mint authority to cover minting fee
  await airdrop(connection, mintAuthority.publicKey, 1_000_000_000);

  const recipientATA = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    USDC,
    recipient,
    true,
  );

  const txSig = await mintTo(
    connection,
    mintAuthority,
    USDC,
    recipientATA.address,
    mintAuthority,
    amount * 10 ** 6,
  );

  console.log(
    `Minted ${amount} USDC to ${recipient} (ata ${recipientATA.address}: ${txSig}`,
  );
};

export const mintToken = async (
  connection: Connection,
  recipient: PublicKey,
  mint: PublicKey,
  mintAuthority: Keypair,
  amount: number,
  decimals: number,
) => {
  const recipientATA = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    mint,
    recipient,
    true,
  );

  const txSig = await mintTo(
    connection,
    mintAuthority,
    mint,
    recipientATA.address,
    mintAuthority,
    amount * 10 ** decimals,
  );

  console.log(
    `Minted ${amount} ${mint} to ${recipient} (ata ${recipientATA.address}: ${txSig}`,
  );
};

export const defaultInitStateParams = {
  accountType: StateAccountType.VAULT,
  name: nameToChars("Glam Vault Test"),
  baseAssetMint: WSOL,
  enabled: true,
  assets: [WSOL, MSOL],
};

export const createGlamStateForTest = async (
  glamClient: GlamClient = new GlamClient(),
  params: InitStateParams = defaultInitStateParams,
) => {
  const txSig = await glamClient.state.initialize(params);
  return {
    txSig,
    statePda: glamClient.statePda,
    vaultPda: glamClient.vaultPda,
    mintPda: glamClient.mintPda,
  };
};
