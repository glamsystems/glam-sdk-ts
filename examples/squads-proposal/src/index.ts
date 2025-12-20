import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import {
  getProgramAndBitflagByProtocolName,
  GlamClient,
} from "@glamsystems/glam-sdk";
import * as dotenv from "dotenv";
import * as multisig from "@sqds/multisig";

// Load environment variables from .env file
// Make sure a `.env` file exists with required variables (see `.env.example`)
dotenv.config();

const txOptions = {
  maxFeeLamports: 10_000,
  useMaxFee: true,
  simulate: true,
};

const glamClient = new GlamClient({
  statePda: new PublicKey(process.env.GLAM_STATE!),
});
const multisigPda = new PublicKey(process.env.SQUADS_MULTISIG!);

async function main() {
  const [squadsVaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });
  console.log("Squads vault:", squadsVaultPda.toBase58());

  // Prepare glam ix and wrap it into a transaction message
  const permissionsMap = getProgramAndBitflagByProtocolName();
  const [integrationProgram, protocolBitflag] = permissionsMap["JupiterSwap"];
  const ix = await glamClient.access.txBuilder.enableDisableProtocolsIx(
    new PublicKey(integrationProgram),
    parseInt(protocolBitflag, 2),
    true,
    squadsVaultPda, // signer is squads vault
  );
  const blockhash = (await glamClient.blockhashWithCache.get()).blockhash;
  const txMessage = new TransactionMessage({
    payerKey: squadsVaultPda,
    recentBlockhash: blockhash,
    instructions: [ix],
  });

  // Get the current multisig transaction index
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    glamClient.connection,
    multisigPda,
  );
  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const newTransactionIndex = BigInt(currentTransactionIndex + 1);

  // Build squads ix #1 for creating a new transaction
  const ixCreateSquadsTx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: newTransactionIndex,
    creator: glamClient.signer,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: txMessage,
  });

  // Build squads ix #2 for creating a proposal
  const ixCreateSquadsProposal = multisig.instructions.proposalCreate({
    multisigPda,
    creator: glamClient.signer,
    transactionIndex: newTransactionIndex,
  });

  // Pack the two ix into a transaction and send it
  const tx = new Transaction().add(ixCreateSquadsTx, ixCreateSquadsProposal);
  const vTx = await glamClient.intoVersionedTransaction(tx, txOptions);
  const txSig = await glamClient.sendAndConfirm(vTx);
  console.log("New squads proposal created:", txSig);

  const [transactionPda] = multisig.getTransactionPda({
    multisigPda,
    index: newTransactionIndex,
  });
  console.log(
    "View proposal on squads:",
    `https://app.squads.so/squads/${squadsVaultPda}/transactions/${transactionPda}`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
