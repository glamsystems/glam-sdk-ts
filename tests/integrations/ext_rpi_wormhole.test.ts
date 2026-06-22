import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  RPI_PROTOCOL,
  GlamClient,
  HYPEREVM_NAV_ADAPTER_V2,
  USDC,
  WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
  evmAddressToBytes20,
  evmAddressToWormholeEmitterAddress,
  stringToChars,
} from "../../src";
import {
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";

const txOptions = { simulate: true };
const HYPEREVM_WORMHOLE_CHAIN_ID = 47;
const HYPERLIQUID_ACCOUNT = "0x3D23f18C8CD3624b5AD42F1E4B551b9582BB756f";
const ACCOUNT_MARGIN_SUMMARY_PRECOMPILE =
  "0x000000000000000000000000000000000000080F";
const SPOT_BALANCE_PRECOMPILE = "0x0000000000000000000000000000000000000801";
const PAYLOAD_VERSION = 2;
const PAYLOAD_TYPE_HYPERLIQUID_ACCOUNT_NAV = 2;
const MOCK_GUARDIAN_SET_INDEX = 0;

const usdDenomination = {
  denom: { usd: {} },
  mint: PublicKey.default,
} as const;

type HyperliquidNavPayloadFields = {
  positionId: Buffer;
  accountMarginSummaryPrecompile: number[];
  spotBalancePrecompile: number[];
  hyperliquidAccount: number[];
  perpDexIndex: number;
  usdcSpotToken: bigint;
  totalValueUsd8: bigint;
  perpAccountValueUsd6: bigint;
  marginUsed: bigint;
  ntlPos: bigint;
  rawUsd: bigint;
  spotUsdcTotalRaw8: bigint;
  spotUsdcHoldRaw8: bigint;
  spotUsdcEntryNtlRaw8: bigint;
  sourceBlock: bigint;
  observedAt: bigint;
};

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

const positionIdToPubkey = (positionId: number[]) =>
  new PublicKey(Uint8Array.from(positionId));

const findPositionObservation = (
  observationState: Awaited<
    ReturnType<GlamClient["rpi"]["fetchObservationState"]>
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

const writeBytes = (
  target: Buffer,
  offset: number,
  bytes: number[] | Buffer,
) => {
  Buffer.from(bytes).copy(target, offset);
  return offset + bytes.length;
};

const buildHyperliquidNavPayload = (fields: HyperliquidNavPayloadFields) => {
  const payload = Buffer.alloc(190);
  let offset = 0;

  offset = writeBytes(payload, offset, Buffer.from("GLAM", "ascii"));
  payload.writeUInt8(PAYLOAD_VERSION, offset);
  offset += 1;
  payload.writeUInt8(PAYLOAD_TYPE_HYPERLIQUID_ACCOUNT_NAV, offset);
  offset += 1;
  offset = writeBytes(payload, offset, fields.positionId);
  offset = writeBytes(payload, offset, fields.accountMarginSummaryPrecompile);
  offset = writeBytes(payload, offset, fields.spotBalancePrecompile);
  offset = writeBytes(payload, offset, fields.hyperliquidAccount);
  payload.writeUInt32BE(fields.perpDexIndex, offset);
  offset += 4;
  payload.writeBigUInt64BE(fields.usdcSpotToken, offset);
  offset += 8;
  payload.writeBigInt64BE(fields.totalValueUsd8, offset);
  offset += 8;
  payload.writeBigInt64BE(fields.perpAccountValueUsd6, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.marginUsed, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.ntlPos, offset);
  offset += 8;
  payload.writeBigInt64BE(fields.rawUsd, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.spotUsdcTotalRaw8, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.spotUsdcHoldRaw8, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.spotUsdcEntryNtlRaw8, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.sourceBlock, offset);
  offset += 8;
  payload.writeBigUInt64BE(fields.observedAt, offset);
  offset += 8;

  expect(offset).toBe(190);
  return payload;
};

const buildVaaBody = (args: {
  emitterAddress: number[];
  sequence: bigint;
  observedAt: bigint;
  payload: Buffer;
}) => {
  const body = Buffer.alloc(51 + args.payload.length);
  let offset = 0;

  body.writeUInt32BE(Number(args.observedAt), offset);
  offset += 4;
  body.writeUInt32BE(0, offset);
  offset += 4;
  body.writeUInt16BE(HYPEREVM_WORMHOLE_CHAIN_ID, offset);
  offset += 2;
  offset = writeBytes(body, offset, args.emitterAddress);
  body.writeBigUInt64BE(args.sequence, offset);
  offset += 8;
  body.writeUInt8(0, offset);
  offset += 1;
  offset = writeBytes(body, offset, args.payload);

  expect(offset).toBe(51 + args.payload.length);
  return body;
};

const buildMockSignedVaa = (vaaBody: Buffer) => {
  const header = Buffer.alloc(6);
  header.writeUInt8(1, 0);
  header.writeUInt32BE(MOCK_GUARDIAN_SET_INDEX, 1);
  header.writeUInt8(1, 5);

  return Buffer.concat([header, Buffer.alloc(66, 1), vaaBody]);
};

describe("ext_rpi wormhole", () => {
  const glamClient = new GlamClient();
  const wormholePosition = Keypair.generate().publicKey;
  const emitterAddress = evmAddressToWormholeEmitterAddress(
    HYPEREVM_NAV_ADAPTER_V2,
  );
  const hyperliquidAccount = evmAddressToBytes20(HYPERLIQUID_ACCOUNT);
  const accountMarginSummaryPrecompile = evmAddressToBytes20(
    ACCOUNT_MARGIN_SUMMARY_PRECOMPILE,
  );
  const spotBalancePrecompile = evmAddressToBytes20(SPOT_BALANCE_PRECOMPILE);

  beforeAll(async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.extRpiProgram.programId,
        protocolsBitmask: RPI_PROTOCOL,
        protocolPolicies: [],
      },
    ];

    const { statePda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: stringToChars("Ext RPI Wormhole"),
      assets: [USDC],
      integrationAcls,
    });

    glamClient.statePda = statePda;
  }, 30_000);

  it("submits a Wormhole observation through the Verification Shim interface", async () => {
    await glamClient.rpi.upsertRegisteredPosition(
      {
        positionId: wormholePosition.toBytes(),
        positionType: { valued: {} },
        sourceType: { wormhole: {} },
        denomination: usdDenomination,
        enabled: true,
        submitAllowlist: [],
        validateAllowlist: [],
        configureAllowlist: [],
      },
      txOptions,
    );
    await glamClient.rpi.upsertRegisteredPositionWormholeConfig(
      {
        positionId: wormholePosition.toBytes(),
        emitterChain: HYPEREVM_WORMHOLE_CHAIN_ID,
        emitterAddress,
        payloadVersion: PAYLOAD_VERSION,
        payloadType: PAYLOAD_TYPE_HYPERLIQUID_ACCOUNT_NAV,
        maxAgeSeconds: 90,
      },
      txOptions,
    );
    await glamClient.rpi.upsertRegisteredPositionWormholeHyperliquidConfig(
      {
        positionId: wormholePosition.toBytes(),
        hyperliquidAccount,
        accountMarginSummaryPrecompile,
        spotBalancePrecompile,
        perpDexIndex: 0,
        usdcSpotToken: new BN(0),
      },
      txOptions,
    );

    const observedAt = BigInt(Math.floor(Date.now() / 1000) - 5);
    const perpAccountValueUsd6 = 2_144_119n;
    const spotUsdcTotalRaw8 = 289_413_800n;
    const totalValueUsd8 = perpAccountValueUsd6 * 100n + spotUsdcTotalRaw8;
    const expectedPendingUsd6 = totalValueUsd8 / 100n;
    const vaaBody = buildVaaBody({
      emitterAddress,
      sequence: 0n,
      observedAt,
      payload: buildHyperliquidNavPayload({
        positionId: Buffer.from(wormholePosition.toBytes()),
        accountMarginSummaryPrecompile,
        spotBalancePrecompile,
        hyperliquidAccount,
        perpDexIndex: 0,
        usdcSpotToken: 0n,
        totalValueUsd8,
        perpAccountValueUsd6,
        marginUsed: 100_000n,
        ntlPos: 7_500_000n,
        rawUsd: perpAccountValueUsd6,
        spotUsdcTotalRaw8,
        spotUsdcHoldRaw8: 50_000_000n,
        spotUsdcEntryNtlRaw8: 0n,
        sourceBlock: 123_456_789n,
        observedAt,
      }),
    });
    const signedVaa = buildMockSignedVaa(vaaBody);

    const submitTx = await glamClient.rpi.txBuilder.submitObservationWormholeTx(
      {
        positionId: wormholePosition.toBytes(),
        signedVaa,
        guardianSet: SystemProgram.programId,
        wormholeVerifyVaaShimProgram: WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
      },
      SystemProgram.programId,
      txOptions,
      false,
    );
    await glamClient.sendAndConfirm(submitTx);

    const wormholeConfig = await glamClient.rpi.fetchWormholeObservationConfig(
      wormholePosition.toBytes(),
    );
    expect(wormholeConfig?.hasLastSequence).toBe(true);
    expect(wormholeConfig?.lastSequence.toString()).toBe("0");
    const hyperliquidConfig =
      await glamClient.rpi.fetchWormholeHyperliquidObservationConfig(
        wormholePosition.toBytes(),
      );
    expect(hyperliquidConfig?.perpDexIndex).toBe(0);
    expect(hyperliquidConfig?.usdcSpotToken.toString()).toBe("0");

    const observationState = await glamClient.rpi.fetchObservationState();
    const observation = findPositionObservation(
      observationState,
      wormholePosition,
    );
    expect(observation.hasPending).toBe(true);
    expect(storedI128ToString(observation.pendingObservation.amount)).toBe(
      expectedPendingUsd6.toString(),
    );
    expect(observation.pendingObservation.observationTimestamp.toString()).toBe(
      observedAt.toString(),
    );
    expect(
      observation.pendingObservation.submittedBy.equals(glamClient.signer),
    ).toBe(true);
  }, 30_000);
});
