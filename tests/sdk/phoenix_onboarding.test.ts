import type { Wallet } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  buildOnboardTraderDelegatedIxResolved,
  BuildRegisterIxsResponseSchema,
  DISCRIMINANTS,
  ExchangeSnapshotViewSchema,
  PhoenixHttpError,
  PHOENIX_GLOBAL_CONFIGURATION_ADDRESS,
  PHOENIX_LOG_AUTHORITY_ADDRESS,
  PHOENIX_PROGRAM_ADDRESS,
  RegisterIxInstructionSchema,
  SendRegisterIxsResponseSchema,
  TraderViewSchema,
  type ActiveTraderBufferAddressArray,
  type Authority,
  type GlobalTraderIndexAddressArray,
  type SendRegisterIxsRequest,
  type TraderAddress,
  type TraderView,
} from "@ellipsis-labs/rise";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_LOG_AUTHORITY,
  PHOENIX_PROGRAM_ID,
} from "../../src/constants";
import { BaseClient } from "../../src/client/base";
import {
  PHOENIX_DEFAULT_MAX_POSITIONS,
  PhoenixClient,
  PhoenixOnboardingError,
} from "../../src/client/phoenix";
import {
  normalizeRiseInstruction,
  toRiseAddress,
  type PhoenixRiseClient,
} from "../../src/utils/phoenixRise";

const ZERO_SIGNATURE = Buffer.alloc(64);

function randomPublicKey(): PublicKey {
  return Keypair.generate().publicKey;
}

function amount(ui = "0") {
  return { value: Number(ui), decimals: 6, ui };
}

function capabilityAccess(active: boolean) {
  return { immediate: false, viaColdActivation: active };
}

function capabilities(active: boolean) {
  return {
    placeLimitOrder: capabilityAccess(active),
    placeMarketOrder: capabilityAccess(active),
    riskIncreasingTrade: capabilityAccess(active),
    riskReducingTrade: capabilityAccess(active),
    depositCollateral: capabilityAccess(active),
    withdrawCollateral: capabilityAccess(active),
  };
}

function traderView(
  traderPda: PublicKey,
  authority: PublicKey,
  active: boolean,
  maxPositions = PHOENIX_DEFAULT_MAX_POSITIONS,
): TraderView {
  const zero = amount();
  return TraderViewSchema.parse({
    flags: 0,
    state: active ? "active" : "cold",
    capabilities: capabilities(active),
    slot: 1,
    slotIndex: 0,
    traderKey: traderPda.toBase58(),
    traderPdaIndex: 0,
    traderSubaccountIndex: 0,
    authority: authority.toBase58(),
    collateralBalance: zero,
    effectiveCollateral: zero,
    effectiveCollateralForWithdrawals: zero,
    unrealizedPnl: zero,
    discountedUnrealizedPnl: zero,
    unsettledFundingOwed: zero,
    accumulatedFunding: zero,
    portfolioValue: zero,
    maintenanceMargin: zero,
    cancelMargin: zero,
    initialMargin: zero,
    initialMarginForWithdrawals: zero,
    riskState: "zeroCollateralNoPositions",
    riskTier: "safe",
    positions: [],
    limitOrders: {},
    maxPositions,
    lastDepositSlot: 0,
    isInActiveTraders: false,
    makerFeeOverrideMultiplier: 1,
    takerFeeOverrideMultiplier: 1,
  });
}

function createHarness() {
  const feePayer = Keypair.generate();
  const onboarder = randomPublicKey();
  const vaultPda = randomPublicKey();
  const traderPda = randomPublicKey();
  const permissionPda = randomPublicKey();
  const riskAuthority = randomPublicKey();
  const globalTraderIndex = [randomPublicKey(), randomPublicKey()];
  const activeTraderBuffer = [randomPublicKey(), randomPublicKey()];
  const blockhash = randomPublicKey().toBase58();

  const exchange = {
    getSnapshot: jest.fn(),
    buildRegisterIxs: jest.fn(),
    sendRegisterIxs: jest.fn(),
  };
  const traders = {
    getTrader: jest.fn(),
    getTraderStateSnapshot: jest.fn(),
  };
  const pda = {
    getProgramAddress: jest.fn(() => PHOENIX_PROGRAM_ADDRESS),
    getLogAuthorityAddress: jest.fn(async () =>
      Promise.resolve(PHOENIX_LOG_AUTHORITY_ADDRESS),
    ),
    getGlobalConfigurationAddress: jest.fn(async () =>
      Promise.resolve(PHOENIX_GLOBAL_CONFIGURATION_ADDRESS),
    ),
    getTraderAddress: jest.fn(async () => toRiseAddress(traderPda)),
    getSplineCollectionAddress: jest.fn(async () =>
      toRiseAddress(randomPublicKey()),
    ),
    getGlobalVaultAddress: jest.fn(async () =>
      toRiseAddress(randomPublicKey()),
    ),
    getEmberStateAddress: jest.fn(async () => toRiseAddress(randomPublicKey())),
    getEmberVaultAddress: jest.fn(async () => toRiseAddress(randomPublicKey())),
    getPermissionAddress: jest.fn(async () => toRiseAddress(permissionPda)),
  };
  const rise = {
    api: {
      exchange: () => exchange,
      traders: () => traders,
    },
    pda,
    dispose: jest.fn(),
  } as unknown as PhoenixRiseClient;
  const connection = {
    rpcEndpoint: "http://localhost:8899",
    getAccountInfo: jest.fn(),
    getLatestBlockhash: jest.fn(async () => ({
      blockhash,
      lastValidBlockHeight: 123,
    })),
    confirmTransaction: jest.fn(async () => ({
      value: { err: null as unknown },
    })),
    getSignatureStatuses: jest.fn(async () => ({
      value: [null] as Array<{
        slot: number;
        confirmations: number | null;
        err: unknown;
        confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
      } | null>,
    })),
  };
  const wallet = {
    publicKey: feePayer.publicKey,
    signTransaction: jest.fn(async (transaction: VersionedTransaction) => {
      transaction.sign([feePayer]);
      return transaction;
    }),
    signAllTransactions: jest.fn(),
  } as unknown as Wallet;
  const base = {
    vaultPda,
    signer: feePayer.publicKey,
    wallet,
    connection,
    phoenixRiseClient: rise,
    protocolProgram: { programId: randomPublicKey() },
    extPhoenixProgram: { programId: randomPublicKey() },
  } as unknown as BaseClient;
  const client = new PhoenixClient(base);

  const authoritySet = {
    rootAuthority: randomPublicKey().toBase58(),
    riskAuthority: riskAuthority.toBase58(),
    marketAuthority: randomPublicKey().toBase58(),
    oracleAuthority: randomPublicKey().toBase58(),
    adlAuthority: randomPublicKey().toBase58(),
    cancelAuthority: randomPublicKey().toBase58(),
    backstopAuthority: randomPublicKey().toBase58(),
  };
  const snapshot = ExchangeSnapshotViewSchema.parse({
    version: 1,
    slot: 1,
    slotIndex: 0,
    exchange: {
      programId: PHOENIX_PROGRAM_ID.toBase58(),
      globalConfig: PHOENIX_GLOBAL_CONFIG.toBase58(),
      currentAuthorities: authoritySet,
      canonicalMint: randomPublicKey().toBase58(),
      usdcMint: randomPublicKey().toBase58(),
      globalVault: randomPublicKey().toBase58(),
      perpAssetMap: randomPublicKey().toBase58(),
      globalTraderIndex: globalTraderIndex.map((key) => key.toBase58()),
      activeTraderBuffer: activeTraderBuffer.map((key) => key.toBase58()),
      withdrawQueue: randomPublicKey().toBase58(),
      exchangeStatusBits: 0,
      exchangeStatusFeatures: [],
      active: true,
      gated: true,
      withdrawalsAvailable: true,
    },
    markets: [],
  });
  const canonicalInstruction = buildOnboardTraderDelegatedIxResolved({
    exchange: {
      phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      logAuthorityAddress: PHOENIX_LOG_AUTHORITY_ADDRESS,
      globalConfigurationAddress: PHOENIX_GLOBAL_CONFIGURATION_ADDRESS,
      globalTraderIndex: globalTraderIndex.map((key) =>
        toRiseAddress(key),
      ) as unknown as GlobalTraderIndexAddressArray,
      activeTraderBuffer: activeTraderBuffer.map((key) =>
        toRiseAddress(key),
      ) as unknown as ActiveTraderBufferAddressArray,
    },
    trader: {
      authority: toRiseAddress<Authority>(onboarder),
      permissionAccount: toRiseAddress(permissionPda),
      traderAccount: toRiseAddress<TraderAddress>(traderPda),
    },
  });
  const normalizedInstruction = normalizeRiseInstruction(canonicalInstruction);
  const delegatedInstruction = RegisterIxInstructionSchema.parse({
    programId: normalizedInstruction.programId,
    data: normalizedInstruction.data,
    keys: normalizedInstruction.accounts.map((account) => ({
      pubkey: account.address,
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
  });
  const buildResponse = BuildRegisterIxsResponseSchema.parse({
    instructions: [delegatedInstruction],
    traderPda: traderPda.toBase58(),
    traderOnboarder: onboarder.toBase58(),
    txFeePayer: feePayer.publicKey.toBase58(),
    maxPositions: PHOENIX_DEFAULT_MAX_POSITIONS,
    includeRegisterTrader: false,
  });
  let activationSignature: string | undefined;

  connection.getAccountInfo.mockResolvedValue({
    data: Buffer.alloc(0),
    owner: PHOENIX_PROGRAM_ID,
  });
  traders.getTrader
    .mockResolvedValueOnce(traderView(traderPda, vaultPda, false))
    .mockResolvedValue(traderView(traderPda, vaultPda, true));
  exchange.getSnapshot.mockResolvedValue(snapshot);
  exchange.buildRegisterIxs.mockResolvedValue(buildResponse);
  exchange.sendRegisterIxs.mockImplementation(
    async (request: SendRegisterIxsRequest) => {
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(request.transaction, "base64"),
      );
      activationSignature = bs58.encode(transaction.signatures[0]);
      return SendRegisterIxsResponseSchema.parse({
        signature: activationSignature,
        traderPda: traderPda.toBase58(),
        traderOnboarder: onboarder.toBase58(),
        txFeePayer: feePayer.publicKey.toBase58(),
        maxPositions: PHOENIX_DEFAULT_MAX_POSITIONS,
        includeRegisterTrader: false,
      });
    },
  );

  return {
    activeTraderBuffer,
    base,
    buildResponse,
    client,
    connection,
    delegatedInstruction,
    exchange,
    feePayer,
    getActivationSignature: () => activationSignature,
    globalTraderIndex,
    onboarder,
    pda,
    permissionPda,
    rise,
    snapshot,
    traderPda,
    traders,
    vaultPda,
    wallet,
  };
}

describe("PhoenixClient.onboardTrader", () => {
  it("keeps registerTrader account map in deployed ABI order", async () => {
    const harness = createHarness();
    const accounts = await harness.client.txBuilder.getRegisterTraderAccounts({
      traderPdaIndex: 0,
      traderSubaccountIndex: 0,
      maxPositions: PHOENIX_DEFAULT_MAX_POSITIONS,
    });

    expect(Object.keys(accounts)).toEqual([
      "glamState",
      "glamVault",
      "glamSigner",
      "integrationAuthority",
      "cpiProgram",
      "glamProtocolProgram",
      "logAuthority",
      "globalConfig",
      "traderAccount",
      "systemProgram",
    ]);
    expect(accounts.logAuthority).toEqual(PHOENIX_LOG_AUTHORITY);
    expect(accounts.globalConfig).toEqual(PHOENIX_GLOBAL_CONFIG);
    expect(accounts.traderAccount).toEqual(harness.traderPda);
    expect(accounts.systemProgram).toEqual(SystemProgram.programId);
  });

  it("registers a missing trader through GLAM before delegated activation", async () => {
    const harness = createHarness();
    const order: string[] = [];
    harness.connection.getAccountInfo
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ data: Buffer.alloc(0), owner: PHOENIX_PROGRAM_ID });
    harness.traders.getTrader
      .mockReset()
      .mockRejectedValueOnce(new PhoenixHttpError(404, "not found"))
      .mockResolvedValue(traderView(harness.traderPda, harness.vaultPda, true));
    const registerSpy = jest
      .spyOn(harness.client, "registerTrader")
      .mockImplementation(async (params) => {
        order.push("register");
        expect(params.maxPositions.toNumber()).toBe(128);
        return "registration-signature";
      });
    harness.exchange.buildRegisterIxs.mockImplementation(async () => {
      order.push("build");
      return harness.buildResponse;
    });

    const result = await harness.client.onboardTrader({
      verification: { maxAttempts: 1, delayMs: 0 },
    });

    expect(order).toEqual(["register", "build"]);
    expect(registerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ traderPdaIndex: 0, traderSubaccountIndex: 0 }),
      { traderAccount: harness.traderPda },
      {},
    );
    expect(result).toMatchObject({
      registrationPerformed: true,
      registrationSignature: "registration-signature",
      delegatedActivationPerformed: true,
      activationSignature: harness.getActivationSignature(),
    });
  });

  it("skips registration for an existing trader", async () => {
    const harness = createHarness();
    const registerSpy = jest.spyOn(harness.client, "registerTrader");

    const result = await harness.client.onboardTrader({
      verification: { maxAttempts: 1, delayMs: 0 },
    });

    expect(registerSpy).not.toHaveBeenCalled();
    expect(result.registrationPerformed).toBe(false);
    expect(result.delegatedActivationPerformed).toBe(true);
  });

  it("returns a complete no-op when Rise verifies all capabilities", async () => {
    const harness = createHarness();
    const view = traderView(harness.traderPda, harness.vaultPda, true);
    const verifySpy = jest.spyOn(view, "verifyCapabilities");
    harness.traders.getTrader.mockReset().mockResolvedValue(view);

    const result = await harness.client.onboardTrader();

    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(result.registrationPerformed).toBe(false);
    expect(result.delegatedActivationPerformed).toBe(false);
    expect(result.finalStatus.delegatedCapabilitiesActive).toBe(true);
    expect(harness.exchange.buildRegisterIxs).not.toHaveBeenCalled();
  });

  it("uses maxPositions 128 and default 0/0 indexes", async () => {
    const harness = createHarness();

    await harness.client.onboardTrader({
      verification: { maxAttempts: 1, delayMs: 0 },
    });

    expect(harness.pda.getTraderAddress).toHaveBeenCalledWith({
      authority: harness.vaultPda.toBase58(),
      traderPdaIndex: 0,
      subaccountIndex: 0,
      phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
    });
    expect(harness.exchange.buildRegisterIxs).toHaveBeenCalledWith({
      traderAuthority: harness.vaultPda.toBase58(),
      txFeePayer: harness.feePayer.publicKey.toBase58(),
      maxPositions: 128,
    });
    expect(harness.exchange.sendRegisterIxs).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPositions: 128,
        traderPdaIndex: 0,
        traderSubaccountIndex: 0,
      }),
    );
  });

  it.each([31, 129, 32.5, Number.NaN])(
    "rejects invalid maxPositions %s before deriving or reading state",
    async (maxPositions) => {
      const harness = createHarness();

      await expect(
        harness.client.onboardTrader({ maxPositions }),
      ).rejects.toThrow("integer between 32 and 128");
      expect(harness.pda.getTraderAddress).not.toHaveBeenCalled();
      expect(harness.connection.getAccountInfo).not.toHaveBeenCalled();
    },
  );

  it("rejects a builder response that includes raw registration", async () => {
    const harness = createHarness();
    harness.exchange.buildRegisterIxs.mockResolvedValue(
      BuildRegisterIxsResponseSchema.parse({
        ...harness.buildResponse,
        includeRegisterTrader: true,
      }),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toThrow("proposed a raw register_trader instruction");
    expect(harness.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("rejects a raw registration instruction before wallet signing", async () => {
    const harness = createHarness();
    harness.exchange.buildRegisterIxs.mockResolvedValue(
      BuildRegisterIxsResponseSchema.parse({
        ...harness.buildResponse,
        instructions: [
          RegisterIxInstructionSchema.parse({
            ...harness.delegatedInstruction,
            data: [...DISCRIMINANTS.REGISTER_TRADER],
          }),
        ],
      }),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toThrow("raw register_trader instruction");
    expect(harness.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("validates every canonical account role before wallet signing", async () => {
    const harness = createHarness();
    const keys = harness.delegatedInstruction.keys.map((key) => ({ ...key }));
    keys[5].isSigner = true;
    harness.exchange.buildRegisterIxs.mockResolvedValue(
      BuildRegisterIxsResponseSchema.parse({
        ...harness.buildResponse,
        instructions: [{ ...harness.delegatedInstruction, keys }],
      }),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toThrow("account 5 does not match");
    expect(harness.wallet.signTransaction).not.toHaveBeenCalled();
    expect(harness.exchange.sendRegisterIxs).not.toHaveBeenCalled();
  });

  it("rejects snapshot accounts that collide with signer privileges", async () => {
    const harness = createHarness();
    harness.exchange.getSnapshot.mockResolvedValue(
      ExchangeSnapshotViewSchema.parse({
        ...harness.snapshot,
        exchange: {
          ...harness.snapshot.exchange,
          globalTraderIndex: [harness.feePayer.publicKey.toBase58()],
        },
      }),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toThrow("collides with another onboarding account");
    expect(harness.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("signs only the local fee-payer slot and preserves the onboarder slot", async () => {
    const harness = createHarness();
    harness.exchange.sendRegisterIxs.mockImplementation(
      async (request: SendRegisterIxsRequest) => {
        const transaction = VersionedTransaction.deserialize(
          Buffer.from(request.transaction, "base64"),
        );
        const signerKeys = transaction.message.staticAccountKeys.slice(
          0,
          transaction.message.header.numRequiredSignatures,
        );
        expect(signerKeys).toHaveLength(2);
        expect(signerKeys[0].equals(harness.feePayer.publicKey)).toBe(true);
        expect(signerKeys[1].equals(harness.onboarder)).toBe(true);
        expect(
          Buffer.from(transaction.signatures[0]).equals(ZERO_SIGNATURE),
        ).toBe(false);
        expect(
          Buffer.from(transaction.signatures[1]).equals(ZERO_SIGNATURE),
        ).toBe(true);
        return SendRegisterIxsResponseSchema.parse({
          signature: bs58.encode(transaction.signatures[0]),
          traderPda: harness.traderPda.toBase58(),
          traderOnboarder: harness.onboarder.toBase58(),
          txFeePayer: harness.feePayer.publicKey.toBase58(),
          maxPositions: 128,
          includeRegisterTrader: false,
        });
      },
    );

    await harness.client.onboardTrader({
      verification: { maxAttempts: 1, delayMs: 0 },
    });

    expect(harness.exchange.sendRegisterIxs).toHaveBeenCalledTimes(1);
  });

  it("propagates Rise submission failures with activation context", async () => {
    const harness = createHarness();
    harness.exchange.sendRegisterIxs.mockRejectedValue(
      new Error("send failed"),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toMatchObject({
      phase: "activation",
      activationSignature: expect.any(String),
      message: expect.stringContaining("send failed"),
    });
  });

  it("preserves a successful registration signature when activation fails", async () => {
    const harness = createHarness();
    harness.connection.getAccountInfo.mockResolvedValueOnce(null);
    harness.traders.getTrader
      .mockReset()
      .mockRejectedValueOnce(new PhoenixHttpError(404, "not found"));
    jest
      .spyOn(harness.client, "registerTrader")
      .mockResolvedValue("registration-signature");
    harness.exchange.sendRegisterIxs.mockRejectedValue(
      new Error("send failed"),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toMatchObject({
      registrationSignature: "registration-signature",
      phase: "activation",
    });
  });

  it("propagates confirmation failures with the activation signature", async () => {
    const harness = createHarness();
    harness.connection.confirmTransaction.mockRejectedValue(
      new Error("confirmation failed"),
    );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 1, delayMs: 0 },
      }),
    ).rejects.toMatchObject({
      phase: "activation",
      activationSignature: expect.any(String),
      message: expect.stringContaining("confirmation failed"),
    });
  });

  it("polls through stale capability state and succeeds within the bound", async () => {
    const harness = createHarness();
    harness.traders.getTrader
      .mockReset()
      .mockResolvedValueOnce(
        traderView(harness.traderPda, harness.vaultPda, false),
      )
      .mockResolvedValueOnce(
        traderView(harness.traderPda, harness.vaultPda, false),
      )
      .mockResolvedValueOnce(
        traderView(harness.traderPda, harness.vaultPda, true),
      );

    const result = await harness.client.onboardTrader({
      verification: { maxAttempts: 2, delayMs: 0 },
    });

    expect(result.finalStatus.delegatedCapabilitiesActive).toBe(true);
    expect(harness.traders.getTrader).toHaveBeenCalledTimes(3);
  });

  it("fails after bounded polling when required capabilities stay inactive", async () => {
    const harness = createHarness();
    harness.traders.getTrader
      .mockReset()
      .mockResolvedValue(
        traderView(harness.traderPda, harness.vaultPda, false),
      );

    await expect(
      harness.client.onboardTrader({
        verification: { maxAttempts: 2, delayMs: 0 },
      }),
    ).rejects.toMatchObject({
      phase: "verification",
      activationSignature: expect.any(String),
      message: expect.stringContaining(
        "could not be verified after 2 attempts",
      ),
    });
    expect(harness.traders.getTrader).toHaveBeenCalledTimes(3);
  });

  it("fails closed on a trader identity mismatch", async () => {
    const harness = createHarness();
    harness.traders.getTrader
      .mockReset()
      .mockResolvedValue(
        traderView(harness.traderPda, randomPublicKey(), true),
      );

    await expect(harness.client.onboardTrader()).rejects.toThrow(
      "does not match GLAM vault",
    );
    expect(harness.exchange.buildRegisterIxs).not.toHaveBeenCalled();
  });

  it("keeps registration context on typed onboarding errors", async () => {
    const error = new PhoenixOnboardingError("failed", {
      phase: "activation",
      traderPda: randomPublicKey(),
      registrationSignature: "registration-signature",
    });
    expect(error.registrationSignature).toBe("registration-signature");
  });
});
