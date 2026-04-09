import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createMint } from "@solana/spl-token";
import { SEED_GLOBAL_CONFIG } from "../../src/constants";
import { getGlamConfigProgram } from "../../src/glamExports";
import { airdrop } from "../test-utils";

export const createTestMint = async (
  connection: Connection,
  payer: Keypair,
  decimals: number = 9,
): Promise<PublicKey> => {
  return await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority
    decimals,
  );
};

export const getGlobalConfigPDA = (programId: PublicKey) => {
  const [globalConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_GLOBAL_CONFIG)],
    programId,
  );
  return globalConfigPDA;
};

export const initGlamConfigForTest = async (
  provider: anchor.AnchorProvider,
) => {
  const program = getGlamConfigProgram(provider);
  const globalConfigPDA = getGlobalConfigPDA(program.programId);

  // Generate admin and fee authority keypairs
  const admin = Keypair.generate();
  const feeAuthority = Keypair.generate();
  const referrer = Keypair.generate();

  // Airdrop SOL to admin for transaction fees
  await airdrop(provider.connection, admin.publicKey);

  try {
    // Initialize the global config
    const txSig = await program.methods
      .initialize(
        admin.publicKey,
        feeAuthority.publicKey,
        referrer.publicKey,
        1, // base_fee_bps (0.01%)
        2000, // flow_fee_bps (20%)
      )
      .rpc();

    console.log(`Global config initialized at ${globalConfigPDA}: ${txSig}`);
  } catch (error) {
    console.error("Failed to initialize global config:", error);
    throw error; // Rethrow to make test failures more obvious
  }

  return {
    program,
    globalConfigPDA,
    admin,
    feeAuthority,
    referrer,
  };
};
