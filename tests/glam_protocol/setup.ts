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
  stringToChars,
  StateAccountType,
} from "../../src";
import { BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
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

export { str2seed, sleep, airdrop, mintUSDC } from "../test-utils";

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

export const defaultInitStateParams = {
  accountType: StateAccountType.VAULT,
  name: stringToChars("Glam Vault Test"),
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
