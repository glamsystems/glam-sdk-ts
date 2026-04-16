import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";

import { GlamClient, RouteManagementMode, USDC, nameToChars } from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  loadWalletFromDisk,
  mintToken,
} from "../glam_protocol/setup";
import { expectPublicKeyArrayEqual } from "../test-utils";

const txOptions = { simulate: true };
const destinationChain = 30168;
const sourceAmount = new BN(10_000_000);
const quotedOutAmount = new BN(9_900_000);
const sourceMint = USDC;
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
  const transferId = Keypair.generate().publicKey;

  await createGlamStateForTest(glamClient, {
    ...defaultInitStateParams,
    name: nameToChars(`Bridge OFT ${Date.now()}`),
    baseAssetMint: sourceMint,
    assets: [sourceMint],
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
      sourceMint,
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
    sourceMint,
    mintAuthority,
    25,
    6,
  );

  const custodyOwner = Keypair.generate();
  const custodyTokenAccount = await getOrCreateAssociatedTokenAccount(
    glamClient.connection,
    glamClient.wallet.payer,
    sourceMint,
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
    await glamClient.bridge.deriveOftAuxiliaryTokenAccount(
      transferId,
      sourceMint,
    );

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
      mint: sourceMint,
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
      sourceMint,
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
  it("bridges mock USDC through the OFT flow", async () => {
    const {
      glamClient,
      mockLayerzeroOftProgram,
      transferId,
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

    expect(
      await glamClient.bridge.fetchTransferRecordNullable(transferId),
    ).toBe(null);

    expect((await glamClient.getVaultTokenBalance(sourceMint)).uiAmount).toBe(
      15,
    );
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
  }, 180_000);

  it("validates, prices, and settles a managed OFT transfer", async () => {
    const { glamClient, transferId } = await createCommittedOftTransfer({
      managed: true,
    });

    let transferRecord =
      await glamClient.bridge.fetchTransferRecordNullable(transferId);
    expect(transferRecord).not.toBeNull();
    expect(transferRecord?.managed).toBe(true);
    expect("committed" in transferRecord?.status!).toBe(true);
    expect(transferRecord?.committedSlot.toString()).not.toBe("0");

    let registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    let stateAccount = await glamClient.fetchStateAccount();
    expectPublicKeyArrayEqual(stateAccount.externalPositions, [
      glamClient.bridge.getRegistryPda(),
    ]);

    await glamClient.bridge.validateManagedTransfer(transferId, txOptions);

    transferRecord =
      await glamClient.bridge.fetchTransferRecordNullable(transferId);
    expect(transferRecord).not.toBeNull();
    expect("validated" in transferRecord!.status).toBe(true);

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    await glamClient.bridge.priceManagedTransfers(txOptions);

    stateAccount = await glamClient.fetchStateAccount();
    const pricedProtocol = stateAccount.pricedProtocols.find(
      (protocol) =>
        protocol.integrationProgram.equals(
          glamClient.extBridgeProgram.programId,
        ) && protocol.protocolBitflag === 0,
    );
    expect(pricedProtocol).toBeDefined();
    expect(pricedProtocol?.amount.gt(new BN(0))).toBe(true);
    expect(pricedProtocol?.decimals).toBe(stateAccount.baseAssetDecimals);
    expectPublicKeyArrayEqual(pricedProtocol?.positions || [], [
      glamClient.bridge.getRegistryPda(),
    ]);

    await glamClient.bridge.settleManagedTransfer(transferId, txOptions);

    expect(
      await glamClient.bridge.fetchTransferRecordNullable(transferId),
    ).toBe(null);

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("0");
    stateAccount = await glamClient.fetchStateAccount();
    expect(stateAccount.externalPositions).toEqual([]);
  }, 60_000);

  it("settles a managed OFT transfer directly from committed state", async () => {
    const { glamClient, transferId } = await createCommittedOftTransfer({
      managed: true,
    });

    const transferRecord =
      await glamClient.bridge.fetchTransferRecordNullable(transferId);
    expect(transferRecord).not.toBeNull();
    if (!transferRecord) {
      throw new Error(`Expected transfer record for ${transferId.toBase58()}`);
    }
    expect(transferRecord.managed).toBe(true);
    expect("committed" in transferRecord.status).toBe(true);

    let registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("1");

    await glamClient.bridge.settleManagedTransfer(transferId, txOptions);
    expect(
      await glamClient.bridge.fetchTransferRecordNullable(transferId),
    ).toBe(null);

    registry = await glamClient.bridge.fetchRegistry();
    expect(registry?.managedTransferCount.toString()).toBe("0");
  }, 60_000);
});
