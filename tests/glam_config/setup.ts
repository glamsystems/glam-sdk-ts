import { PublicKey, Keypair } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SEED_GLOBAL_CONFIG } from "../../src/constants";
import { getGlamConfigProgram } from "../../src/glamExports";

export const airdrop = async (
  connection: Connection,
  pubkey: PublicKey,
  lamports: number = 1 * anchor.web3.LAMPORTS_PER_SOL,
) => {
  try {
    const airdropTx = await connection.requestAirdrop(pubkey, lamports);
    await connection.confirmTransaction(
      {
        ...(await connection.getLatestBlockhash()),
        signature: airdropTx,
      },
      "confirmed",
    );
    console.log(
      `Airdropped ${lamports / anchor.web3.LAMPORTS_PER_SOL} SOL to ${pubkey.toBase58()}:`,
      airdropTx,
    );
  } catch (error) {
    console.error("Airdrop failed:", error);
  }
};

export const getGlobalConfigPDA = (programId: PublicKey) => {
  const [globalConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_GLOBAL_CONFIG)],
    programId,
  );
  return globalConfigPDA;
};

export const TEST_ASSETS = {
  SOL: new PublicKey("So11111111111111111111111111111111111111112"),
  USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  WSOL: new PublicKey("So11111111111111111111111111111111111111112"),
  MSOL: new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"),
};

export const TEST_ORACLES = {
  SOL_PYTH: new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"),
  USDC_PYTH: new PublicKey("Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX"),
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
