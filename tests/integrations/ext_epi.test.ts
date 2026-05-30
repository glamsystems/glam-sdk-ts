import { BN, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { EPI_PROTOCOL, GlamClient, USDC, WSOL, nameToChars } from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  str2seed,
} from "../glam_protocol/setup";
import { expectPublicKeyArrayEqual } from "../test-utils";

const txOptions = { simulate: true };
const delegate = Keypair.fromSeed(str2seed("ext_epi_delegate"));
const valuedPosition = Keypair.generate().publicKey;
const usdPosition = Keypair.generate().publicKey;
const tokenizedPosition = Keypair.generate().publicKey;
const valuedBaseAmount = new BN(2_000_000_000);
const usdObservationAmount = new BN(125_000_000);
const tokenizedObservationAmount = new BN(50_000_000);
const tokenizedExternalShares = new BN(42);

const baseAssetDenomination = {
  denom: { mint: {} },
  mint: WSOL,
} as const;
const usdDenomination = {
  denom: { usd: {} },
  mint: PublicKey.default,
} as const;
const usdcDenomination = {
  denom: { mint: {} },
  mint: USDC,
} as const;

const positionIdToPubkey = (positionId: number[]) =>
  new PublicKey(Uint8Array.from(positionId));

const storedI128ToString = (value: { bytes: number[] }) => {
  const bitWidth = BigInt(value.bytes.length * 8);
  const signBit = 1n << (bitWidth - 1n);
  const modulus = 1n << bitWidth;

  let unsigned = 0n;
  value.bytes.forEach((byte, index) => {
    unsigned |= BigInt(byte) << (BigInt(index) * 8n);
  });

  return (
    (unsigned & signBit) === 0n ? unsigned : unsigned - modulus
  ).toString();
};

const findPositionObservation = (
  observationState: Awaited<
    ReturnType<GlamClient["epi"]["fetchObservationState"]>
  >,
  position: PublicKey,
) => {
  if (!observationState) {
    throw new Error("Observation state was not initialized");
  }

  const match = observationState.positions
    .slice(0, observationState.positionsLen)
    .find((candidate) =>
      positionIdToPubkey(candidate.positionId).equals(position),
    );

  if (!match) {
    throw new Error(`Missing observation entry for ${position.toBase58()}`);
  }

  return match;
};

const buildValuedConfig = () => ({
  positionId: valuedPosition.toBytes(),
  positionType: { valued: {} },
  sourceType: { trusted: {} },
  denomination: baseAssetDenomination,
  submitAllowlist: [delegate.publicKey],
  validateAllowlist: [],
  configureAllowlist: [],
});

const buildUsdConfig = () => ({
  positionId: usdPosition.toBytes(),
  positionType: { valued: {} },
  sourceType: { trusted: {} },
  denomination: usdDenomination,
  submitAllowlist: [],
  validateAllowlist: [],
  configureAllowlist: [],
});

const buildTokenizedConfig = (enabled = true) => ({
  positionId: tokenizedPosition.toBytes(),
  positionType: { tokenized: {} },
  sourceType: { trusted: {} },
  denomination: usdcDenomination,
  enabled,
  submitAllowlist: [],
  validateAllowlist: [],
  configureAllowlist: [],
});

describe("ext_epi", () => {
  const glamClient = new GlamClient();
  const glamClientDelegate = new GlamClient({ wallet: new Wallet(delegate) });

  beforeAll(async () => {
    await airdrop(
      glamClient.provider.connection,
      delegate.publicKey,
      10_000_000_000,
    );
  });

  it("Creates a vault with EPI access and a submit delegate", async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.extEpiProgram.programId,
        protocolsBitmask: EPI_PROTOCOL,
        protocolPolicies: [],
      },
    ];

    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Ext EPI Tests"),
      assets: [WSOL, USDC],
      integrationAcls,
    });

    glamClientDelegate.statePda = statePda;

    await glamClient.access.grantDelegatePermissions(
      delegate.publicKey,
      glamClient.extEpiProgram.programId,
      EPI_PROTOCOL,
      new BN(0b00000110),
      txOptions,
    );

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([WSOL, USDC]);
    expect(stateModel.integrationAcls).toEqual(integrationAcls);
    expect(stateModel.externalPositions).toEqual([]);
  }, 30_000);

  it("Upserts tracked positions and initializes the observation PDA", async () => {
    await glamClient.epi.upsertExternalPosition(buildValuedConfig(), txOptions);
    await glamClient.epi.upsertExternalPosition(buildUsdConfig(), txOptions);
    await glamClient.epi.upsertExternalPosition(
      buildTokenizedConfig(),
      txOptions,
    );

    const stateModel = await glamClient.fetchStateModel();
    expectPublicKeyArrayEqual(stateModel.externalPositions, [
      valuedPosition,
      usdPosition,
      tokenizedPosition,
    ]);

    const observationState = await glamClient.epi.fetchObservationState();
    expect(observationState).not.toBeNull();
    expect(observationState?.glamState.equals(glamClient.statePda)).toBe(true);
    expect(observationState?.positionsLen).toBe(3);

    const valuedObservation = findPositionObservation(
      observationState,
      valuedPosition,
    );
    expect(valuedObservation.hasPending).toBe(false);
    expect(valuedObservation.hasValidated).toBe(false);

    const tokenizedObservation = findPositionObservation(
      observationState,
      tokenizedPosition,
    );
    expect(tokenizedObservation.hasPending).toBe(false);
    expect(tokenizedObservation.hasValidated).toBe(false);

    const usdObservation = findPositionObservation(
      observationState,
      usdPosition,
    );
    expect(usdObservation.hasPending).toBe(false);
    expect(usdObservation.hasValidated).toBe(false);
  });

  it("Restricts submission using the configured position allowlist", async () => {
    await glamClientDelegate.epi.submitExternalObservation(
      {
        positionId: valuedPosition.toBytes(),
        amount: valuedBaseAmount,
        denomination: baseAssetDenomination,
        observationTimestamp: new BN(Math.floor(Date.now() / 1000) - 5),
      },
      txOptions,
    );

    try {
      const txSig = await glamClient.epi.submitExternalObservation(
        {
          positionId: valuedPosition.toBytes(),
          amount: valuedBaseAmount.addn(1),
          denomination: baseAssetDenomination,
          observationTimestamp: new BN(Math.floor(Date.now() / 1000) - 5),
        },
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (error: any) {
      expect(error.message).toBe("Signer is not authorized");
    }

    const observationState = await glamClient.epi.fetchObservationState();
    const valuedObservation = findPositionObservation(
      observationState,
      valuedPosition,
    );

    expect(valuedObservation.hasPending).toBe(true);
    expect(
      valuedObservation.pendingObservation.submittedBy.equals(
        delegate.publicKey,
      ),
    ).toBe(true);
    expect(
      valuedObservation.pendingObservation.submittedAtSlot.toString(),
    ).not.toBe("0");
  });

  it("Validates observations and publishes the EPI priced protocol", async () => {
    await glamClientDelegate.epi.validateExternalObservation(
      valuedPosition.toBytes(),
      txOptions,
    );

    await glamClient.epi.submitExternalObservation(
      {
        positionId: usdPosition.toBytes(),
        amount: usdObservationAmount,
        denomination: usdDenomination,
        observationTimestamp: new BN(Math.floor(Date.now() / 1000) - 5),
      },
      txOptions,
    );

    await glamClient.epi.validateExternalObservation(
      usdPosition.toBytes(),
      txOptions,
    );

    await glamClient.epi.submitExternalObservation(
      {
        positionId: tokenizedPosition.toBytes(),
        amount: tokenizedObservationAmount,
        denomination: usdcDenomination,
        observationTimestamp: new BN(Math.floor(Date.now() / 1000) - 5),
        externalShares: tokenizedExternalShares,
      },
      txOptions,
    );

    try {
      const txSig = await glamClient.epi.validateExternalObservation(
        {
          positionId: tokenizedPosition.toBytes(),
          observedMintOracle: await glamClient.base.getSolOracle(),
        },
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (error: any) {
      expect(error.message).toContain("Invalid pricing oracle");
    }

    await glamClient.epi.validateExternalObservation(
      tokenizedPosition.toBytes(),
      txOptions,
    );

    const observationState = await glamClient.epi.fetchObservationState();
    const valuedObservation = findPositionObservation(
      observationState,
      valuedPosition,
    );
    expect(valuedObservation.hasPending).toBe(false);
    expect(valuedObservation.hasValidated).toBe(true);
    expect(valuedObservation.validatedBy.equals(delegate.publicKey)).toBe(true);
    expect(storedI128ToString(valuedObservation.validatedBaseAssetAmount)).toBe(
      valuedBaseAmount.toString(),
    );

    const usdObservation = findPositionObservation(
      observationState,
      usdPosition,
    );
    expect(usdObservation.hasPending).toBe(false);
    expect(usdObservation.hasValidated).toBe(true);
    const usdBaseAssetAmount = storedI128ToString(
      usdObservation.validatedBaseAssetAmount,
    );
    expect(new BN(usdBaseAssetAmount).gt(new BN(0))).toBe(true);
    expect(usdBaseAssetAmount).not.toBe(usdObservationAmount.toString());

    const tokenizedObservation = findPositionObservation(
      observationState,
      tokenizedPosition,
    );
    expect(tokenizedObservation.hasPending).toBe(false);
    expect(tokenizedObservation.hasValidated).toBe(true);
    expect(
      tokenizedObservation.lastValidatedObservation.externalShares.toString(),
    ).toBe(tokenizedExternalShares.toString());
    const tokenizedBaseAssetAmount = storedI128ToString(
      tokenizedObservation.validatedBaseAssetAmount,
    );
    expect(new BN(tokenizedBaseAssetAmount).gt(new BN(0))).toBe(true);
    expect(tokenizedBaseAssetAmount).not.toBe(
      tokenizedObservationAmount.toString(),
    );

    const stateAccount = await glamClient.fetchStateAccount();
    const pricedProtocol = stateAccount.pricedProtocols.find(
      (protocol) =>
        protocol.integrationProgram.equals(
          glamClient.extEpiProgram.programId,
        ) && protocol.protocolBitflag === EPI_PROTOCOL,
    );

    expect(pricedProtocol).toBeDefined();
    expect(pricedProtocol?.amount.toString()).toBe(
      new BN(valuedBaseAmount)
        .add(new BN(usdBaseAssetAmount))
        .add(new BN(tokenizedBaseAssetAmount))
        .toString(),
    );
    expectPublicKeyArrayEqual(pricedProtocol?.positions || [], [
      valuedPosition,
      usdPosition,
      tokenizedPosition,
    ]);
  });

  it("Clears disabled positions and refreshes the aggregate", async () => {
    await glamClient.epi.upsertExternalPosition(
      buildTokenizedConfig(false),
      txOptions,
    );

    const stateModel = await glamClient.fetchStateModel();
    expectPublicKeyArrayEqual(stateModel.externalPositions, [
      valuedPosition,
      usdPosition,
    ]);

    let observationState = await glamClient.epi.fetchObservationState();
    const tokenizedObservation = findPositionObservation(
      observationState,
      tokenizedPosition,
    );
    expect(tokenizedObservation.hasPending).toBe(false);
    expect(tokenizedObservation.hasValidated).toBe(false);
    expect(
      storedI128ToString(tokenizedObservation.validatedBaseAssetAmount),
    ).toBe("0");

    await glamClientDelegate.epi.refreshPricedProtocol(txOptions);

    observationState = await glamClient.epi.fetchObservationState();
    const valuedObservation = findPositionObservation(
      observationState,
      valuedPosition,
    );
    expect(valuedObservation.hasValidated).toBe(true);
    const usdObservation = findPositionObservation(
      observationState,
      usdPosition,
    );
    expect(usdObservation.hasValidated).toBe(true);

    const stateAccount = await glamClient.fetchStateAccount();
    const pricedProtocol = stateAccount.pricedProtocols.find(
      (protocol) =>
        protocol.integrationProgram.equals(
          glamClient.extEpiProgram.programId,
        ) && protocol.protocolBitflag === EPI_PROTOCOL,
    );

    expect(pricedProtocol).toBeDefined();
    expect(pricedProtocol?.amount.toString()).toBe(
      new BN(valuedBaseAmount)
        .add(new BN(storedI128ToString(usdObservation.validatedBaseAssetAmount)))
        .toString(),
    );
    expectPublicKeyArrayEqual(pricedProtocol?.positions || [], [
      valuedPosition,
      usdPosition,
    ]);
  });
});
