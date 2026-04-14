import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";

import {
  GlamClient,
  RouteManagementMode,
  USDT,
  WSOL,
  nameToChars,
} from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  loadWalletFromDisk,
  mintToken,
} from "../glam_protocol/setup";

const txOptions = { simulate: true };
const destinationChain = 30168;
const sourceAmount = new BN(10_000_000);
const quotedOutAmount = new BN(9_900_000);
const mintAuthority = loadWalletFromDisk("./tests/test-keypair.json").payer;

const createCommittedOftTransfer = async (
  params: {
    managed?: boolean;
    routeManagementMode?: RouteManagementMode;
  } = {},
) => {
  const managed = params.managed ?? false;
  const routeManagementMode =
    params.routeManagementMode ??
    (managed ? RouteManagementMode.ManagedOnly : RouteManagementMode.Either);
  const glamClient = new GlamClient();
  const mockLayerzeroEndpointProgram = anchor.workspace
    .MockLayerzeroEndpoint as anchor.Program<any>;
  const mockLayerzeroOftProgram = anchor.workspace.MockLayerzeroOft as any;
  const destinationRecipient = Keypair.generate().publicKey;
  const oftStore = Keypair.generate().publicKey;
  const transferId = Keypair.generate().publicKey.toBuffer();

  await createGlamStateForTest(glamClient, {
    ...defaultInitStateParams,
    name: nameToChars(`Bridge OFT ${Date.now()}`),
    assets: [WSOL, USDT],
    integrationAcls: [
      {
        integrationProgram: glamClient.extBridgeProgram.programId,
        protocolsBitmask: 1 << 2,
        protocolPolicies: [],
      },
    ],
  });

  await glamClient.bridge.addLayerzeroOftRoute(
    {
      sourceMint: USDT,
      destinationChain,
      destinationRecipient,
      providerProgram: mockLayerzeroOftProgram.programId,
      managementMode: routeManagementMode,
      minAmount: new BN(1_000_000),
      maxAmount: new BN(50_000_000),
    },
    txOptions,
  );

  await airdrop(glamClient.connection, mintAuthority.publicKey, 1_000_000_000);
  await mintToken(
    glamClient.connection,
    glamClient.vaultPda,
    USDT,
    mintAuthority,
    25,
    6,
  );

  const custodyOwner = Keypair.generate();
  const custodyTokenAccount = await getOrCreateAssociatedTokenAccount(
    glamClient.connection,
    glamClient.wallet.payer,
    USDT,
    custodyOwner.publicKey,
    false,
  );

  const nonce = glamClient.bridge.getLayerzeroNoncePda(
    mockLayerzeroEndpointProgram.programId,
    oftStore,
    destinationChain,
    destinationRecipient,
  );
  const { address: auxiliaryTokenAccount } =
    await glamClient.bridge.deriveOftAuxiliaryTokenAccount(transferId, USDT);

  const providerIx = await mockLayerzeroOftProgram.methods
    .send({
      dstEid: destinationChain,
      to: Array.from(destinationRecipient.toBytes()),
      amountLd: sourceAmount,
      minAmountLd: quotedOutAmount,
      options: Buffer.alloc(0),
      composeMsg: null,
      nativeFee: new BN(0),
      lzTokenFee: new BN(0),
    })
    .accounts({
      payer: glamClient.signer,
      placeholder0: SystemProgram.programId,
      oftStore,
      placeholder1: SystemProgram.programId,
      from: auxiliaryTokenAccount,
      custody: custodyTokenAccount.address,
      mint: USDT,
      tokenProgram: TOKEN_PROGRAM_ID,
      placeholder2: SystemProgram.programId,
      placeholder3: SystemProgram.programId,
      mockLayerzeroEndpointProgram: mockLayerzeroEndpointProgram.programId,
      oftStoreDuplicate: oftStore,
      placeholder4: SystemProgram.programId,
      placeholder5: SystemProgram.programId,
      placeholder6: SystemProgram.programId,
      placeholder7: SystemProgram.programId,
      placeholder8: SystemProgram.programId,
      nonce,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  await glamClient.bridge.sendOft(
    {
      transferId,
      sourceMint: USDT,
      sourceAmount,
      providerInstructions: [providerIx],
      providerReceipt: nonce,
      managed,
    },
    txOptions,
  );

  return {
    glamClient,
    mockLayerzeroOftProgram,
    transferId,
    destinationRecipient,
    oftStore,
    nonce,
    auxiliaryTokenAccount,
    custodyTokenAccount,
  };
};

describe("bridge_oft", () => {
  it("bridges mock USDT through the OFT flow", async () => {
    const {
      glamClient,
      mockLayerzeroOftProgram,
      transferId,
      destinationRecipient,
      oftStore,
      nonce,
      auxiliaryTokenAccount,
      custodyTokenAccount,
    } = await createCommittedOftTransfer();

    const policy = await glamClient.bridge.fetchLayerzeroOftPolicy();
    expect(policy?.routes).toHaveLength(1);
    expect(
      policy?.routes[0].providerProgram.equals(
        mockLayerzeroOftProgram.programId,
      ),
    ).toBe(true);

    const transferRecord =
      await glamClient.bridge.fetchTransferRecord(transferId);
    expect(transferRecord.glamState.equals(glamClient.statePda)).toBe(true);
    expect(transferRecord.sourceMint.equals(USDT)).toBe(true);
    expect(
      transferRecord.providerProgram.equals(mockLayerzeroOftProgram.programId),
    ).toBe(true);
    expect(transferRecord.receiptVerified).toBe(true);
    expect(transferRecord.sourceAmount.toString()).toBe(
      sourceAmount.toString(),
    );
    expect(transferRecord.quotedOutAmount.toString()).toBe(
      quotedOutAmount.toString(),
    );
    expect(transferRecord.destinationChain).toBe(destinationChain);
    expect(
      transferRecord.destinationRecipient.equals(destinationRecipient),
    ).toBe(true);
    expect(transferRecord.providerEmitter.equals(oftStore)).toBe(true);
    expect(transferRecord.providerSequence.toString()).toBe("1");
    expect("committed" in transferRecord.status).toBe(true);

    expect((await glamClient.getVaultTokenBalance(USDT)).uiAmount).toBe(15);
    expect(
      Number(
        (await getAccount(glamClient.connection, custodyTokenAccount.address))
          .amount,
      ),
    ).toBe(10_000_000);
    expect(
      await glamClient.connection.getAccountInfo(auxiliaryTokenAccount),
    ).toBeNull();
    expect(await glamClient.connection.getAccountInfo(nonce)).not.toBeNull();

    const registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("0");
  }, 60_000);

  it("settles and reconciles a managed OFT transfer", async () => {
    const { glamClient, transferId } = await createCommittedOftTransfer({
      managed: true,
    });

    let transferRecord =
      await glamClient.bridge.fetchTransferRecord(transferId);
    expect(transferRecord.managed).toBe(true);
    expect("committed" in transferRecord.status).toBe(true);
    expect(transferRecord.settledSlot.toString()).toBe("0");
    expect(transferRecord.reconciledSlot.toString()).toBe("0");

    let registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    await glamClient.bridge.settleManagedTransfer(transferId, txOptions);

    transferRecord = await glamClient.bridge.fetchTransferRecord(transferId);
    expect("settled" in transferRecord.status).toBe(true);
    expect(transferRecord.settledSlot.toString()).not.toBe("0");
    expect(transferRecord.reconciledSlot.toString()).toBe("0");

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    await glamClient.bridge.reconcileManagedTransfer(transferId, txOptions);

    transferRecord = await glamClient.bridge.fetchTransferRecord(transferId);
    expect("reconciled" in transferRecord.status).toBe(true);
    expect(transferRecord.reconciledSlot.toString()).not.toBe("0");
    expect(transferRecord.failureReason).toBe(0);

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("0");

    await glamClient.bridge.cleanupTransferRecord(transferId, txOptions);
    expect(
      await glamClient.connection.getAccountInfo(
        glamClient.bridge.getTransferRecordPda(transferId),
      ),
    ).toBeNull();
  }, 60_000);

  it("settles and cancels a managed OFT transfer", async () => {
    const failureReason = 7;
    const { glamClient, transferId } = await createCommittedOftTransfer({
      managed: true,
    });

    let transferRecord =
      await glamClient.bridge.fetchTransferRecord(transferId);
    expect(transferRecord.managed).toBe(true);
    expect("committed" in transferRecord.status).toBe(true);

    let registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    await glamClient.bridge.settleManagedTransfer(transferId, txOptions);
    await glamClient.bridge.failManagedTransfer(
      transferId,
      failureReason,
      txOptions,
    );

    transferRecord = await glamClient.bridge.fetchTransferRecord(transferId);
    expect("failed" in transferRecord.status).toBe(true);
    expect(transferRecord.settledSlot.toString()).not.toBe("0");
    expect(transferRecord.reconciledSlot.toString()).not.toBe("0");
    expect(transferRecord.failureReason).toBe(failureReason);

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("0");

    await glamClient.bridge.cleanupTransferRecord(transferId, txOptions);
    expect(
      await glamClient.connection.getAccountInfo(
        glamClient.bridge.getTransferRecordPda(transferId),
      ),
    ).toBeNull();
  }, 60_000);
});
