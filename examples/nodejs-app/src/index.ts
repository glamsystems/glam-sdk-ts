import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  GlamClient,
  nameToChars,
  StateAccountType,
  WSOL,
} from "@glamsystems/glam-sdk";
import * as dotenv from "dotenv";
import { Command } from "commander";
import { createGlamClient } from "./utils";

// Load environment variables from .env file
// Make sure a `.env` file exists with required variables (see `.env.example`)
dotenv.config();

const txOptions = {
  maxFeeLamports: 10_000,
  useMaxFee: true,
  simulate: true,
};

const program = new Command();
program.name("glam-example").version("1.0.0");

program
  .command("create <name>")
  .description("Create a new GLAM vault (non-tokenized)")
  .option("-b, --base-asset <baseAsset>", "Base asset mint", WSOL.toBase58())
  .option(
    "-e, --enabled",
    "Initialize the vault in enabled state",
    Boolean,
    true,
  )
  .action(async (name, { baseAsset, enabled }) => {
    try {
      console.log("Creating GLAM vault:", name);

      // By default GlamClient will use the wallet and RPC from the env variables
      const glamClient = new GlamClient();

      // Initialize the vault, convert name from string to char array
      const txSig = await glamClient.state.create(
        {
          name: nameToChars(name),
          enabled,
          accountType: StateAccountType.VAULT,
        },
        new PublicKey(baseAsset),
        txOptions,
      );

      console.log("✅ Vault created successfully:", txSig);
      console.log("Vault address:", glamClient.vaultPda.toBase58());
      console.log("Vault state:", glamClient.statePda.toBase58());
    } catch (error) {
      console.error("❌ Error creating vault:", error);
      process.exit(1);
    }
  });

program
  .command("deposit-sol")
  .argument("<vault>", "Vault address", (v) => new PublicKey(v))
  .argument("<amount>", "Amount to deposit", parseFloat)
  .description("Deposit SOL into a GLAM vault")
  .action(async (vault: PublicKey, amount: number) => {
    const glamClient = await createGlamClient(vault);

    const amountBN = new BN(amount * LAMPORTS_PER_SOL);
    const txSig = await glamClient.vault.depositSol(amountBN, true, txOptions);
    console.log("✅ Deposit SOL successful:", txSig);
  });

program
  .command("deposit-token")
  .argument("<vault>", "Vault address", (v) => new PublicKey(v))
  .argument("<token_mint>", "Token mint", (v) => new PublicKey(v))
  .argument("<amount>", "Amount to deposit", parseFloat)
  .description("Deposit token into a GLAM vault")
  .action(async (vault: PublicKey, tokenMint: PublicKey, amount: number) => {
    const glamClient = await createGlamClient(vault);

    const { mint } = await glamClient.fetchMintAndTokenProgram(tokenMint);
    const amountBN = new BN(amount * 10 ** mint.decimals);

    const txSig = await glamClient.vault.deposit(
      tokenMint,
      amountBN,
      txOptions,
    );
    console.log("✅ Deposit token successful:", txSig);
  });

program
  .command("transfer-token")
  .argument("<vault>", "Vault address", (v) => new PublicKey(v))
  .argument("<dest_wallet>", "Destination wallet", (v) => new PublicKey(v))
  .argument("<token_mint>", "Token mint", (v) => new PublicKey(v))
  .argument("<amount>", "Amount to deposit", parseFloat)
  .description("Transfer token from a GLAM vault to another wallet")
  .action(
    async (
      vault: PublicKey,
      destWallet: PublicKey,
      tokenMint: PublicKey,
      amount: number,
    ) => {
      const glamClient = await createGlamClient(vault);

      const { mint } = await glamClient.fetchMintAndTokenProgram(tokenMint);
      const amountBN = new BN(amount * 10 ** mint.decimals);

      const txSig = await glamClient.vault.tokenTransfer(
        tokenMint,
        amountBN,
        destWallet,
        txOptions,
      );
      console.log("✅ Transfer token successful:", txSig);
    },
  );

program
  .command("enable-integration")
  .argument("<vault>", "Vault address", (v) => new PublicKey(v))
  .argument(
    "<integrationProgram>",
    "Integration program",
    (v) => new PublicKey(v),
  )
  .argument("<protocols...>", "Protocols to enable")
  .action(
    async (
      vault: PublicKey,
      integrationProgram: PublicKey,
      protocols: string[],
    ) => {
      const protocolNumbers = protocols.map((p) => parseInt(p));
      const protocolBitmask = protocolNumbers.reduce((a, b) => a | b, 0);

      const glamClient = await createGlamClient(vault);

      const txSig = await glamClient.access.enableProtocols(
        integrationProgram,
        protocolBitmask,
        txOptions,
      );
      console.log("✅ Enable integration successful:", txSig);
    },
  );

program.parse(process.argv);
