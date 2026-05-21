import { BN } from "@coral-xyz/anchor";
import * as borsh from "@coral-xyz/borsh";
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import {
  KAMINO_LENDING_PROGRAM,
  MEMO_PROGRAM,
  ORCA_POSITION_DISCRIMINATOR,
  ORCA_TICK_ARRAY_DISCRIMINATOR,
  ORCA_WHIRLPOOL_DISCRIMINATOR,
  ORCA_WHIRLPOOLS_PROGRAM_ID,
} from "../constants";
import { Reserve } from "../deser";
import { WhirlpoolsPolicy } from "../deser/integrationPolicies";
import {
  getGlobalConfigPda,
  getIntegrationAuthorityPda,
} from "../utils/glamPDAs";
import { fetchMintAndTokenProgram, PkMap, PkSet } from "../utils";

type Numeric = BN | bigint | number;

const PUBKEY_LEN = 32;
const ORCA_POSITION_WHIRLPOOL_OFFSET = 8;
const ORCA_POSITION_MINT_OFFSET = 40;
const ORCA_POSITION_LIQUIDITY_OFFSET = 72;
const ORCA_POSITION_TICK_LOWER_INDEX_OFFSET = 88;
const ORCA_POSITION_TICK_UPPER_INDEX_OFFSET = 92;
const ORCA_POSITION_REWARD_INFOS_OFFSET = 144;
const ORCA_POSITION_REWARD_INFO_SIZE = 24;
const ORCA_POSITION_REWARD_GROWTH_INSIDE_CHECKPOINT_OFFSET = 0;
const ORCA_POSITION_REWARD_AMOUNT_OWED_OFFSET = 16;
const ORCA_WHIRLPOOL_TICK_SPACING_OFFSET = 41;
const ORCA_WHIRLPOOL_LIQUIDITY_OFFSET = 49;
const ORCA_WHIRLPOOL_TICK_CURRENT_INDEX_OFFSET = 81;
const ORCA_WHIRLPOOL_TOKEN_MINT_A_OFFSET = 101;
const ORCA_WHIRLPOOL_REWARD_LAST_UPDATED_TIMESTAMP_OFFSET = 261;
const ORCA_WHIRLPOOL_TOKEN_MINT_B_OFFSET = 181;
const ORCA_WHIRLPOOL_REWARD_INFOS_OFFSET = 269;
const ORCA_WHIRLPOOL_REWARD_INFO_SIZE = 128;
const ORCA_WHIRLPOOL_REWARD_MINT_OFFSET = 0;
const ORCA_WHIRLPOOL_REWARD_EMISSIONS_PER_SECOND_X64_OFFSET = 96;
const ORCA_WHIRLPOOL_REWARD_GROWTH_GLOBAL_X64_OFFSET = 112;
const ORCA_NUM_REWARDS = 3;
const ORCA_TICK_ARRAY_SIZE = 88;
const ORCA_TICK_ARRAY_START_TICK_INDEX_OFFSET = 8;
const ORCA_TICK_ARRAY_TICKS_OFFSET = 12;
const ORCA_TICK_ARRAY_TICK_SIZE = 113;
const ORCA_TICK_ARRAY_WHIRLPOOL_OFFSET =
  ORCA_TICK_ARRAY_TICKS_OFFSET +
  ORCA_TICK_ARRAY_TICK_SIZE * ORCA_TICK_ARRAY_SIZE;
const ORCA_TICK_INITIALIZED_OFFSET = 0;
const ORCA_TICK_REWARD_GROWTHS_OUTSIDE_OFFSET = 65;
const ORCA_Q64 = 1n << 64n;
const ORCA_U128_MOD = 1n << 128n;

export const ORCA_POSITION_METADATA_UPDATE_AUTHORITY = new PublicKey(
  "3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr",
);

export type OrcaAccountsType =
  | { transferHookA: Record<string, never> }
  | { transferHookB: Record<string, never> }
  | { transferHookReward: Record<string, never> }
  | { transferHookInput: Record<string, never> }
  | { transferHookIntermediate: Record<string, never> }
  | { transferHookOutput: Record<string, never> }
  | { supplementalTickArrays: Record<string, never> }
  | { supplementalTickArraysOne: Record<string, never> }
  | { supplementalTickArraysTwo: Record<string, never> }
  | { transferHookDepositA: Record<string, never> }
  | { transferHookDepositB: Record<string, never> }
  | { transferHookWithdrawalA: Record<string, never> }
  | { transferHookWithdrawalB: Record<string, never> };

export type OrcaRemainingAccountsInfo = {
  slices: Array<{
    accountsType: OrcaAccountsType;
    length: number;
  }>;
};

export type OrcaPriceDeviationAccounts = {
  glamConfig?: PublicKey;
  tokenMintAOracle: PublicKey;
  tokenMintBOracle: PublicKey;
  solUsdOracle?: PublicKey;
  kaminoReserves?: PublicKey[];
};

export type OrcaPriceDeviationRemainingAccounts = {
  priceDeviationAccounts?: OrcaPriceDeviationAccounts;
};

export type OrcaV2RemainingAccounts = {
  remainingAccountsInfo?: OrcaRemainingAccountsInfo | null;
  remainingAccounts?: AccountMeta[];
};

export type OpenOrcaPositionWithTokenExtensionsParams = {
  tickLowerIndex: number;
  tickUpperIndex: number;
  withTokenMetadataExtension?: boolean;
};

export type OpenOrcaPositionWithTokenExtensionsAccounts = {
  whirlpool: PublicKey;
  positionMint: PublicKey;
  position?: PublicKey;
  positionTokenAccount?: PublicKey;
  metadataUpdateAuth?: PublicKey;
};

export type InitializeOrcaTickArrayParams = {
  startTickIndex: number;
};

export type IncreaseOrcaLiquidityV2Params = OrcaV2RemainingAccounts &
  OrcaPriceDeviationRemainingAccounts & {
    liquidityAmount: Numeric;
    tokenMaxA: Numeric;
    tokenMaxB: Numeric;
  };

export type DecreaseOrcaLiquidityV2Params = OrcaV2RemainingAccounts &
  OrcaPriceDeviationRemainingAccounts & {
    liquidityAmount: Numeric;
    tokenMinA: Numeric;
    tokenMinB: Numeric;
  };

export type IncreaseOrcaLiquidityByTokenAmountsMethod = {
  byTokenAmounts: {
    tokenMaxA: Numeric;
    tokenMaxB: Numeric;
    minSqrtPrice: Numeric;
    maxSqrtPrice: Numeric;
  };
};

export type IncreaseOrcaLiquidityByTokenAmountsV2Params =
  OrcaV2RemainingAccounts &
    OrcaPriceDeviationRemainingAccounts & {
      method: IncreaseOrcaLiquidityByTokenAmountsMethod;
    };

export type RepositionOrcaLiquidityMethod = {
  byLiquidity: {
    newLiquidityAmount: Numeric;
    existingRangeTokenMinA: Numeric;
    existingRangeTokenMinB: Numeric;
    newRangeTokenMaxA: Numeric;
    newRangeTokenMaxB: Numeric;
  };
};

export type RepositionOrcaLiquidityV2Params = OrcaV2RemainingAccounts &
  OrcaPriceDeviationRemainingAccounts & {
    newTickLowerIndex: number;
    newTickUpperIndex: number;
    method: RepositionOrcaLiquidityMethod;
  };

export type OrcaPositionAccounts = {
  whirlpool: PublicKey;
  position: PublicKey;
  positionMint: PublicKey;
  positionTokenAccount?: PublicKey;
};

export type OrcaUpdateFeesAndRewardsAccounts = {
  whirlpool: PublicKey;
  position: PublicKey;
  tickArrayLower: PublicKey;
  tickArrayUpper: PublicKey;
};

export type OrcaLiquidityV2Accounts = OrcaPositionAccounts &
  OrcaV2RemainingAccounts &
  OrcaPriceDeviationRemainingAccounts & {
    tokenMintA: PublicKey;
    tokenMintB: PublicKey;
    tokenVaultA: PublicKey;
    tokenVaultB: PublicKey;
    tickArrayLower: PublicKey;
    tickArrayUpper: PublicKey;
    tokenOwnerAccountA?: PublicKey;
    tokenOwnerAccountB?: PublicKey;
    tokenProgramA?: PublicKey;
    tokenProgramB?: PublicKey;
    memoProgram?: PublicKey;
  };

export type InitializeOrcaTickArrayAccounts = {
  whirlpool: PublicKey;
  tickArray?: PublicKey;
};

export type RepositionOrcaLiquidityV2Accounts = Omit<
  OrcaLiquidityV2Accounts,
  "tickArrayLower" | "tickArrayUpper"
> & {
  existingTickArrayLower: PublicKey;
  existingTickArrayUpper: PublicKey;
  newTickArrayLower: PublicKey;
  newTickArrayUpper: PublicKey;
};

export type CollectOrcaFeesV2Accounts = OrcaPositionAccounts &
  OrcaV2RemainingAccounts & {
    tokenMintA: PublicKey;
    tokenMintB: PublicKey;
    tokenOwnerAccountA?: PublicKey;
    tokenOwnerAccountB?: PublicKey;
    tokenVaultA: PublicKey;
    tokenVaultB: PublicKey;
    tokenProgramA?: PublicKey;
    tokenProgramB?: PublicKey;
    memoProgram?: PublicKey;
  };

export type CollectOrcaRewardV2Accounts = OrcaPositionAccounts &
  OrcaV2RemainingAccounts & {
    rewardMint: PublicKey;
    rewardVault: PublicKey;
    rewardOwnerAccount?: PublicKey;
    rewardTokenProgram?: PublicKey;
    memoProgram?: PublicKey;
  };

export type ParsedOrcaPosition = {
  whirlpool: PublicKey;
  positionMint: PublicKey;
  liquidity: bigint;
  tickLowerIndex: number;
  tickUpperIndex: number;
  rewardInfos: Array<{
    growthInsideCheckpoint: bigint;
    amountOwed: bigint;
  }>;
  rewardAmountsOwed: bigint[];
};

export type ParsedOrcaWhirlpool = {
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tickSpacing: number;
  liquidity: bigint;
  tickCurrentIndex: number;
  rewardLastUpdatedTimestamp: bigint;
  rewardInfos: Array<{
    mint: PublicKey;
    emissionsPerSecondX64: bigint;
    growthGlobalX64: bigint;
  }>;
};

export type ParsedOrcaTick = {
  rewardGrowthsOutside: bigint[];
};

export type OrcaWhirlpoolPricingAccounts = {
  numPositions: number;
  remainingAccounts: AccountMeta[];
  kaminoReserves: PublicKey[];
};

function toBn(value: Numeric | undefined, fallback = 0): BN {
  if (value === undefined) {
    return new BN(fallback);
  }
  if (BN.isBN(value)) {
    return value;
  }
  return new BN(value.toString());
}

function normalizeIncreaseMethod(
  method: IncreaseOrcaLiquidityByTokenAmountsMethod,
) {
  return {
    byTokenAmounts: {
      tokenMaxA: toBn(method.byTokenAmounts.tokenMaxA),
      tokenMaxB: toBn(method.byTokenAmounts.tokenMaxB),
      minSqrtPrice: toBn(method.byTokenAmounts.minSqrtPrice),
      maxSqrtPrice: toBn(method.byTokenAmounts.maxSqrtPrice),
    },
  };
}

function normalizeRepositionMethod(method: RepositionOrcaLiquidityMethod) {
  return {
    byLiquidity: {
      newLiquidityAmount: toBn(method.byLiquidity.newLiquidityAmount),
      existingRangeTokenMinA: toBn(method.byLiquidity.existingRangeTokenMinA),
      existingRangeTokenMinB: toBn(method.byLiquidity.existingRangeTokenMinB),
      newRangeTokenMaxA: toBn(method.byLiquidity.newRangeTokenMaxA),
      newRangeTokenMaxB: toBn(method.byLiquidity.newRangeTokenMaxB),
    },
  };
}

export function getOrcaPositionPda(
  positionMint: PublicKey,
  programId: PublicKey = ORCA_WHIRLPOOLS_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), positionMint.toBuffer()],
    programId,
  );
}

export function getOrcaTickArrayPda(
  whirlpool: PublicKey,
  startTickIndex: number,
  programId: PublicKey = ORCA_WHIRLPOOLS_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      whirlpool.toBuffer(),
      Buffer.from(startTickIndex.toString()),
    ],
    programId,
  );
}

function hasDiscriminator(data: Buffer, discriminator: readonly number[]) {
  return discriminator.every((byte, offset) => data[offset] === byte);
}

function readPubkey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBKEY_LEN));
}

function readU128LE(data: Buffer, offset: number): bigint {
  return (
    data.readBigUInt64LE(offset) + (data.readBigUInt64LE(offset + 8) << 64n)
  );
}

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

export function parseOrcaPosition(data: Buffer): ParsedOrcaPosition {
  if (!hasDiscriminator(data, ORCA_POSITION_DISCRIMINATOR)) {
    throw new Error("Invalid Orca position account discriminator");
  }

  const rewardInfos: ParsedOrcaPosition["rewardInfos"] = [];
  for (let i = 0; i < ORCA_NUM_REWARDS; i++) {
    const offset =
      ORCA_POSITION_REWARD_INFOS_OFFSET + i * ORCA_POSITION_REWARD_INFO_SIZE;
    rewardInfos.push({
      growthInsideCheckpoint: readU128LE(
        data,
        offset + ORCA_POSITION_REWARD_GROWTH_INSIDE_CHECKPOINT_OFFSET,
      ),
      amountOwed: readU64LE(
        data,
        offset + ORCA_POSITION_REWARD_AMOUNT_OWED_OFFSET,
      ),
    });
  }

  return {
    whirlpool: readPubkey(data, ORCA_POSITION_WHIRLPOOL_OFFSET),
    positionMint: readPubkey(data, ORCA_POSITION_MINT_OFFSET),
    liquidity: readU128LE(data, ORCA_POSITION_LIQUIDITY_OFFSET),
    tickLowerIndex: data.readInt32LE(ORCA_POSITION_TICK_LOWER_INDEX_OFFSET),
    tickUpperIndex: data.readInt32LE(ORCA_POSITION_TICK_UPPER_INDEX_OFFSET),
    rewardInfos,
    rewardAmountsOwed: rewardInfos.map(({ amountOwed }) => amountOwed),
  };
}

export function parseOrcaWhirlpool(data: Buffer): ParsedOrcaWhirlpool {
  if (!hasDiscriminator(data, ORCA_WHIRLPOOL_DISCRIMINATOR)) {
    throw new Error("Invalid Orca Whirlpool account discriminator");
  }

  const rewardInfos: ParsedOrcaWhirlpool["rewardInfos"] = [];
  for (let i = 0; i < ORCA_NUM_REWARDS; i++) {
    const offset =
      ORCA_WHIRLPOOL_REWARD_INFOS_OFFSET + i * ORCA_WHIRLPOOL_REWARD_INFO_SIZE;
    rewardInfos.push({
      mint: readPubkey(data, offset + ORCA_WHIRLPOOL_REWARD_MINT_OFFSET),
      emissionsPerSecondX64: readU128LE(
        data,
        offset + ORCA_WHIRLPOOL_REWARD_EMISSIONS_PER_SECOND_X64_OFFSET,
      ),
      growthGlobalX64: readU128LE(
        data,
        offset + ORCA_WHIRLPOOL_REWARD_GROWTH_GLOBAL_X64_OFFSET,
      ),
    });
  }

  return {
    tokenMintA: readPubkey(data, ORCA_WHIRLPOOL_TOKEN_MINT_A_OFFSET),
    tokenMintB: readPubkey(data, ORCA_WHIRLPOOL_TOKEN_MINT_B_OFFSET),
    tickSpacing: data.readUInt16LE(ORCA_WHIRLPOOL_TICK_SPACING_OFFSET),
    liquidity: readU128LE(data, ORCA_WHIRLPOOL_LIQUIDITY_OFFSET),
    tickCurrentIndex: data.readInt32LE(
      ORCA_WHIRLPOOL_TICK_CURRENT_INDEX_OFFSET,
    ),
    rewardLastUpdatedTimestamp: readU64LE(
      data,
      ORCA_WHIRLPOOL_REWARD_LAST_UPDATED_TIMESTAMP_OFFSET,
    ),
    rewardInfos,
  };
}

function tickOffset(
  tickIndex: number,
  startTickIndex: number,
  tickSpacing: number,
): number {
  if (tickSpacing <= 0) {
    throw new Error(`Invalid Orca tick spacing: ${tickSpacing}`);
  }
  const delta = tickIndex - startTickIndex;
  if (delta < 0 || delta % tickSpacing !== 0) {
    throw new Error("Invalid Orca tick array for position tick");
  }
  const offset = delta / tickSpacing;
  if (offset < 0 || offset >= ORCA_TICK_ARRAY_SIZE) {
    throw new Error("Invalid Orca tick array for position tick");
  }
  return offset;
}

export function parseOrcaTickArrayTick(
  data: Buffer,
  expectedWhirlpool: PublicKey,
  expectedStartTickIndex: number,
  tickIndex: number,
  tickSpacing: number,
): ParsedOrcaTick {
  if (!hasDiscriminator(data, ORCA_TICK_ARRAY_DISCRIMINATOR)) {
    throw new Error("Invalid Orca tick array account discriminator");
  }

  const startTickIndex = data.readInt32LE(
    ORCA_TICK_ARRAY_START_TICK_INDEX_OFFSET,
  );
  if (startTickIndex !== expectedStartTickIndex) {
    throw new Error("Invalid Orca tick array start index");
  }
  const whirlpool = readPubkey(data, ORCA_TICK_ARRAY_WHIRLPOOL_OFFSET);
  if (!whirlpool.equals(expectedWhirlpool)) {
    throw new Error("Invalid Orca tick array Whirlpool");
  }

  const offset =
    ORCA_TICK_ARRAY_TICKS_OFFSET +
    ORCA_TICK_ARRAY_TICK_SIZE *
      tickOffset(tickIndex, startTickIndex, tickSpacing);
  if (data[offset + ORCA_TICK_INITIALIZED_OFFSET] === 0) {
    throw new Error("Orca position tick is not initialized");
  }

  const rewardGrowthsOutside = [];
  for (let i = 0; i < ORCA_NUM_REWARDS; i++) {
    rewardGrowthsOutside.push(
      readU128LE(
        data,
        offset + ORCA_TICK_REWARD_GROWTHS_OUTSIDE_OFFSET + i * 16,
      ),
    );
  }
  return { rewardGrowthsOutside };
}

function wrappingAddU128(a: bigint, b: bigint): bigint {
  return (a + b) % ORCA_U128_MOD;
}

function wrappingSubU128(a: bigint, b: bigint): bigint {
  return (a - b + ORCA_U128_MOD) % ORCA_U128_MOD;
}

function rewardGrowthInside(
  growthGlobal: bigint,
  currentTickIndex: number,
  tickLowerIndex: number,
  tickUpperIndex: number,
  lowerGrowthOutside: bigint,
  upperGrowthOutside: bigint,
): bigint {
  let growthBelow = lowerGrowthOutside;
  let growthAbove = upperGrowthOutside;

  if (currentTickIndex < tickLowerIndex) {
    growthBelow = wrappingSubU128(growthGlobal, growthBelow);
  }
  if (currentTickIndex >= tickUpperIndex) {
    growthAbove = wrappingSubU128(growthGlobal, growthAbove);
  }
  return wrappingSubU128(
    wrappingSubU128(growthGlobal, growthBelow),
    growthAbove,
  );
}

function rewardOwedAmounts(
  whirlpool: ParsedOrcaWhirlpool,
  position: ParsedOrcaPosition,
  tickLower: ParsedOrcaTick,
  tickUpper: ParsedOrcaTick,
  currentTimestamp: bigint,
): bigint[] {
  const timestampDelta =
    currentTimestamp > whirlpool.rewardLastUpdatedTimestamp
      ? currentTimestamp - whirlpool.rewardLastUpdatedTimestamp
      : 0n;
  return whirlpool.rewardInfos.map((rewardInfo, i) => {
    let rewardGrowthGlobal = rewardInfo.growthGlobalX64;
    if (whirlpool.liquidity !== 0n) {
      rewardGrowthGlobal = wrappingAddU128(
        rewardGrowthGlobal,
        (rewardInfo.emissionsPerSecondX64 * timestampDelta) /
          whirlpool.liquidity,
      );
    }

    const growthInside = rewardGrowthInside(
      rewardGrowthGlobal,
      whirlpool.tickCurrentIndex,
      position.tickLowerIndex,
      position.tickUpperIndex,
      tickLower.rewardGrowthsOutside[i],
      tickUpper.rewardGrowthsOutside[i],
    );
    const growthDelta = wrappingSubU128(
      growthInside,
      position.rewardInfos[i].growthInsideCheckpoint,
    );
    const rewardDelta =
      growthDelta === 0n || position.liquidity === 0n
        ? 0n
        : (position.liquidity * growthDelta) / ORCA_Q64;
    return position.rewardInfos[i].amountOwed + rewardDelta;
  });
}

export function getOrcaTickArrayStartIndex(
  tickIndex: number,
  tickSpacing: number,
): number {
  if (tickSpacing <= 0) {
    throw new Error(`Invalid Orca tick spacing: ${tickSpacing}`);
  }
  const ticksPerArray = tickSpacing * ORCA_TICK_ARRAY_SIZE;
  return Math.floor(tickIndex / ticksPerArray) * ticksPerArray;
}

export function deriveTickArrayForPosition(
  whirlpool: PublicKey,
  tickIndex: number,
  tickSpacing: number,
): PublicKey {
  return getOrcaTickArrayPda(
    whirlpool,
    getOrcaTickArrayStartIndex(tickIndex, tickSpacing),
  )[0];
}

class TxBuilder extends BaseTxBuilder<OrcaClient> {
  async setWhirlpoolsPolicyIx(
    policy: WhirlpoolsPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extOrcaProgram.methods
      .setWhirlpoolsPolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setWhirlpoolsPolicyTx(
    policy: WhirlpoolsPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setWhirlpoolsPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async openPositionWithTokenExtensionsIx(
    params: OpenOrcaPositionWithTokenExtensionsParams,
    accounts: OpenOrcaPositionWithTokenExtensionsAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const [derivedPosition] = getOrcaPositionPda(accounts.positionMint);
    const position = accounts.position || derivedPosition;

    return await this.client.base.extOrcaProgram.methods
      .openPositionWithTokenExtensions(
        params.tickLowerIndex,
        params.tickUpperIndex,
        params.withTokenMetadataExtension ?? true,
      )
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        position,
        positionMint: accounts.positionMint,
        positionTokenAccount:
          accounts.positionTokenAccount ||
          this.client.getPositionTokenAta(accounts.positionMint),
        whirlpool: accounts.whirlpool,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataUpdateAuth:
          accounts.metadataUpdateAuth ||
          ORCA_POSITION_METADATA_UPDATE_AUTHORITY,
      })
      .instruction();
  }

  async openPositionWithTokenExtensionsTx(
    params: OpenOrcaPositionWithTokenExtensionsParams,
    accounts: OpenOrcaPositionWithTokenExtensionsAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.openPositionWithTokenExtensionsIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async initializeTickArrayIx(
    params: InitializeOrcaTickArrayParams,
    accounts: InitializeOrcaTickArrayAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const [derivedTickArray] = getOrcaTickArrayPda(
      accounts.whirlpool,
      params.startTickIndex,
    );

    return await this.client.base.extOrcaProgram.methods
      .initializeTickArray(params.startTickIndex)
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        tickArray: accounts.tickArray || derivedTickArray,
      })
      .instruction();
  }

  async initializeTickArrayTx(
    params: InitializeOrcaTickArrayParams,
    accounts: InitializeOrcaTickArrayAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.initializeTickArrayIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async increaseLiquidityV2Ix(
    params: IncreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const liquidityAccounts = await this.liquidityV2Accounts(accounts, signer);
    const builder = this.client.base.extOrcaProgram.methods
      .increaseLiquidityV2(
        toBn(params.liquidityAmount),
        toBn(params.tokenMaxA),
        toBn(params.tokenMaxB),
        (params.remainingAccountsInfo ??
          accounts.remainingAccountsInfo ??
          null) as never,
      )
      .accountsPartial(liquidityAccounts);

    return await this.withRemainingAccounts(
      builder,
      { includePriceDeviationAccounts: true },
      params,
      accounts,
    );
  }

  async increaseLiquidityV2Tx(
    params: IncreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.increaseLiquidityV2Ix(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(
      [ix],
      await this.withKaminoReserveRefreshTxOptions(txOptions, params, accounts),
    );
  }

  async increaseLiquidityByTokenAmountsV2Ix(
    params: IncreaseOrcaLiquidityByTokenAmountsV2Params,
    accounts: OrcaLiquidityV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const liquidityAccounts = await this.liquidityV2Accounts(accounts, signer);
    const builder = this.client.base.extOrcaProgram.methods
      .increaseLiquidityByTokenAmountsV2(
        normalizeIncreaseMethod(params.method) as never,
        (params.remainingAccountsInfo ??
          accounts.remainingAccountsInfo ??
          null) as never,
      )
      .accountsPartial(liquidityAccounts);

    return await this.withRemainingAccounts(
      builder,
      { includePriceDeviationAccounts: true },
      params,
      accounts,
    );
  }

  async increaseLiquidityByTokenAmountsV2Tx(
    params: IncreaseOrcaLiquidityByTokenAmountsV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.increaseLiquidityByTokenAmountsV2Ix(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(
      [ix],
      await this.withKaminoReserveRefreshTxOptions(txOptions, params, accounts),
    );
  }

  async decreaseLiquidityV2Ix(
    params: DecreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const liquidityAccounts = await this.liquidityV2Accounts(accounts, signer);
    const builder = this.client.base.extOrcaProgram.methods
      .decreaseLiquidityV2(
        toBn(params.liquidityAmount),
        toBn(params.tokenMinA),
        toBn(params.tokenMinB),
        (params.remainingAccountsInfo ??
          accounts.remainingAccountsInfo ??
          null) as never,
      )
      .accountsPartial(liquidityAccounts);

    return await this.withRemainingAccounts(
      builder,
      { includePriceDeviationAccounts: true },
      params,
      accounts,
    );
  }

  async decreaseLiquidityV2Tx(
    params: DecreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.decreaseLiquidityV2Ix(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(
      [ix],
      await this.withKaminoReserveRefreshTxOptions(txOptions, params, accounts),
    );
  }

  async repositionLiquidityV2Ix(
    params: RepositionOrcaLiquidityV2Params,
    accounts: RepositionOrcaLiquidityV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const { tokenProgramA, tokenProgramB } = await this.tokenPrograms(accounts);
    const builder = this.client.base.extOrcaProgram.methods
      .repositionLiquidityV2(
        params.newTickLowerIndex,
        params.newTickUpperIndex,
        normalizeRepositionMethod(params.method) as never,
        (params.remainingAccountsInfo ??
          accounts.remainingAccountsInfo ??
          null) as never,
      )
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        tokenProgramA,
        tokenProgramB,
        memoProgram: accounts.memoProgram || MEMO_PROGRAM,
        position: accounts.position,
        positionTokenAccount:
          accounts.positionTokenAccount ||
          this.client.getPositionTokenAta(accounts.positionMint),
        tokenMintA: accounts.tokenMintA,
        tokenMintB: accounts.tokenMintB,
        tokenOwnerAccountA:
          accounts.tokenOwnerAccountA ||
          this.client.base.getVaultAta(accounts.tokenMintA, tokenProgramA),
        tokenOwnerAccountB:
          accounts.tokenOwnerAccountB ||
          this.client.base.getVaultAta(accounts.tokenMintB, tokenProgramB),
        tokenVaultA: accounts.tokenVaultA,
        tokenVaultB: accounts.tokenVaultB,
        existingTickArrayLower: accounts.existingTickArrayLower,
        existingTickArrayUpper: accounts.existingTickArrayUpper,
        newTickArrayLower: accounts.newTickArrayLower,
        newTickArrayUpper: accounts.newTickArrayUpper,
      });

    return await this.withRemainingAccounts(
      builder,
      { includePriceDeviationAccounts: true },
      params,
      accounts,
    );
  }

  async repositionLiquidityV2Tx(
    params: RepositionOrcaLiquidityV2Params,
    accounts: RepositionOrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.repositionLiquidityV2Ix(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(
      [ix],
      await this.withKaminoReserveRefreshTxOptions(txOptions, params, accounts),
    );
  }

  async updateFeesAndRewardsIx(
    accounts: OrcaUpdateFeesAndRewardsAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extOrcaProgram.methods
      .updateFeesAndRewards()
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        position: accounts.position,
        tickArrayLower: accounts.tickArrayLower,
        tickArrayUpper: accounts.tickArrayUpper,
      })
      .instruction();
  }

  async updateFeesAndRewardsTx(
    accounts: OrcaUpdateFeesAndRewardsAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateFeesAndRewardsIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async collectFeesV2Ix(
    accounts: CollectOrcaFeesV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const { tokenProgramA, tokenProgramB } = await this.tokenPrograms(accounts);
    const builder = this.client.base.extOrcaProgram.methods
      .collectFeesV2((accounts.remainingAccountsInfo ?? null) as never)
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        position: accounts.position,
        positionTokenAccount:
          accounts.positionTokenAccount ||
          this.client.getPositionTokenAta(accounts.positionMint),
        tokenMintA: accounts.tokenMintA,
        tokenMintB: accounts.tokenMintB,
        tokenOwnerAccountA:
          accounts.tokenOwnerAccountA ||
          this.client.base.getVaultAta(accounts.tokenMintA, tokenProgramA),
        tokenVaultA: accounts.tokenVaultA,
        tokenOwnerAccountB:
          accounts.tokenOwnerAccountB ||
          this.client.base.getVaultAta(accounts.tokenMintB, tokenProgramB),
        tokenVaultB: accounts.tokenVaultB,
        tokenProgramA,
        tokenProgramB,
        memoProgram: accounts.memoProgram || MEMO_PROGRAM,
      });

    return await this.withRemainingAccounts(builder, {}, accounts);
  }

  async collectFeesV2Tx(
    accounts: CollectOrcaFeesV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.collectFeesV2Ix(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async collectRewardV2Ix(
    rewardIndex: number,
    accounts: CollectOrcaRewardV2Accounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const rewardTokenProgram = await this.tokenProgramForMint(
      accounts.rewardMint,
      accounts.rewardTokenProgram,
    );
    const builder = this.client.base.extOrcaProgram.methods
      .collectRewardV2(
        rewardIndex,
        (accounts.remainingAccountsInfo ?? null) as never,
      )
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        position: accounts.position,
        positionTokenAccount:
          accounts.positionTokenAccount ||
          this.client.getPositionTokenAta(accounts.positionMint),
        rewardOwnerAccount:
          accounts.rewardOwnerAccount ||
          this.client.base.getVaultAta(accounts.rewardMint, rewardTokenProgram),
        rewardMint: accounts.rewardMint,
        rewardVault: accounts.rewardVault,
        rewardTokenProgram,
        memoProgram: accounts.memoProgram || MEMO_PROGRAM,
      });

    return await this.withRemainingAccounts(builder, {}, accounts);
  }

  async collectRewardV2Tx(
    rewardIndex: number,
    accounts: CollectOrcaRewardV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const rewardTokenProgram = await this.tokenProgramForMint(
      accounts.rewardMint,
      accounts.rewardTokenProgram,
    );
    const rewardOwnerAccount = this.client.base.getVaultAta(
      accounts.rewardMint,
      rewardTokenProgram,
    );
    const ix = await this.collectRewardV2Ix(
      rewardIndex,
      { ...accounts, rewardTokenProgram },
      signer,
    );
    const shouldCreateRewardOwnerAccount =
      !accounts.rewardOwnerAccount ||
      accounts.rewardOwnerAccount.equals(rewardOwnerAccount);
    const preInstructions = shouldCreateRewardOwnerAccount
      ? [
          createAssociatedTokenAccountIdempotentInstruction(
            signer,
            rewardOwnerAccount,
            this.client.base.vaultPda,
            accounts.rewardMint,
            rewardTokenProgram,
          ),
          ...(txOptions.preInstructions || []),
        ]
      : txOptions.preInstructions;

    return await this.buildVersionedTx([ix], {
      ...txOptions,
      preInstructions,
    });
  }

  async closePositionWithTokenExtensionsIx(
    accounts: OrcaPositionAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extOrcaProgram.methods
      .closePositionWithTokenExtensions()
      .accountsPartial({
        ...this.sharedBaseAccounts(signer),
        whirlpool: accounts.whirlpool,
        position: accounts.position,
        positionMint: accounts.positionMint,
        positionTokenAccount:
          accounts.positionTokenAccount ||
          this.client.getPositionTokenAta(accounts.positionMint),
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  }

  async closePositionWithTokenExtensionsTx(
    accounts: OrcaPositionAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closePositionWithTokenExtensionsIx(
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  private sharedBaseAccounts(signer?: PublicKey) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: ORCA_WHIRLPOOLS_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
    };
  }

  private async liquidityV2Accounts(
    accounts: OrcaLiquidityV2Accounts,
    signer?: PublicKey,
  ) {
    const { tokenProgramA, tokenProgramB } = await this.tokenPrograms(accounts);
    return {
      ...this.sharedBaseAccounts(signer),
      whirlpool: accounts.whirlpool,
      tokenProgramA,
      tokenProgramB,
      memoProgram: accounts.memoProgram || MEMO_PROGRAM,
      position: accounts.position,
      positionTokenAccount:
        accounts.positionTokenAccount ||
        this.client.getPositionTokenAta(accounts.positionMint),
      tokenMintA: accounts.tokenMintA,
      tokenMintB: accounts.tokenMintB,
      tokenOwnerAccountA:
        accounts.tokenOwnerAccountA ||
        this.client.base.getVaultAta(accounts.tokenMintA, tokenProgramA),
      tokenOwnerAccountB:
        accounts.tokenOwnerAccountB ||
        this.client.base.getVaultAta(accounts.tokenMintB, tokenProgramB),
      tokenVaultA: accounts.tokenVaultA,
      tokenVaultB: accounts.tokenVaultB,
      tickArrayLower: accounts.tickArrayLower,
      tickArrayUpper: accounts.tickArrayUpper,
    };
  }

  private async tokenPrograms(accounts: {
    tokenMintA: PublicKey;
    tokenMintB: PublicKey;
    tokenProgramA?: PublicKey;
    tokenProgramB?: PublicKey;
  }): Promise<{ tokenProgramA: PublicKey; tokenProgramB: PublicKey }> {
    const [tokenProgramA, tokenProgramB] = await Promise.all([
      this.tokenProgramForMint(accounts.tokenMintA, accounts.tokenProgramA),
      this.tokenProgramForMint(accounts.tokenMintB, accounts.tokenProgramB),
    ]);
    return {
      tokenProgramA,
      tokenProgramB,
    };
  }

  private async tokenProgramForMint(
    mint: PublicKey,
    tokenProgram?: PublicKey,
  ): Promise<PublicKey> {
    if (tokenProgram) {
      return tokenProgram;
    }
    return (await fetchMintAndTokenProgram(this.client.base.connection, mint))
      .tokenProgram;
  }

  private async withRemainingAccounts(
    builder: {
      remainingAccounts: (accounts: AccountMeta[]) => unknown;
      instruction: () => Promise<TransactionInstruction>;
    },
    options: { includePriceDeviationAccounts?: boolean },
    ...sources: Array<
      OrcaV2RemainingAccounts & Partial<OrcaPriceDeviationRemainingAccounts>
    >
  ): Promise<TransactionInstruction> {
    const priceDeviationAccounts = options.includePriceDeviationAccounts
      ? sources.find((source) => source.priceDeviationAccounts !== undefined)
          ?.priceDeviationAccounts
      : undefined;
    const remainingAccounts = sources.find(
      (source) => source.remainingAccounts !== undefined,
    )?.remainingAccounts;
    const allRemainingAccounts = [
      ...this.priceDeviationAccountMetas(priceDeviationAccounts),
      ...(remainingAccounts || []),
    ];
    if (allRemainingAccounts.length) {
      builder.remainingAccounts(allRemainingAccounts);
    }
    return await builder.instruction();
  }

  private priceDeviationAccountMetas(
    accounts?: OrcaPriceDeviationAccounts,
  ): AccountMeta[] {
    if (!accounts) {
      return [];
    }
    return [
      accounts.glamConfig || getGlobalConfigPda(),
      accounts.tokenMintAOracle,
      accounts.tokenMintBOracle,
      accounts.solUsdOracle,
    ]
      .filter((pubkey): pubkey is PublicKey => !!pubkey)
      .map((pubkey) => ({ pubkey, isSigner: false, isWritable: false }));
  }

  private async withKaminoReserveRefreshTxOptions(
    txOptions: TxOptions,
    ...sources: Array<Partial<OrcaPriceDeviationRemainingAccounts>>
  ): Promise<TxOptions> {
    const reserveKeys = new PkSet();
    sources.forEach((source) => {
      source.priceDeviationAccounts?.kaminoReserves?.forEach((reserve) => {
        reserveKeys.add(reserve);
      });
    });

    if (reserveKeys.size === 0) {
      return txOptions;
    }

    const reserves = await this.fetchAndParseKaminoReserves(
      Array.from(reserveKeys),
    );
    return {
      ...txOptions,
      preInstructions: [
        ...(txOptions.preInstructions || []),
        this.refreshKaminoReservesBatchIx(reserves, false),
      ],
    };
  }

  private async fetchAndParseKaminoReserves(
    reserveKeys: PublicKey[],
  ): Promise<Reserve[]> {
    const reserveAccounts =
      await this.client.base.connection.getMultipleAccountsInfo(reserveKeys);
    if (reserveAccounts.some((account) => !account)) {
      throw new Error("Not all Kamino reserves can be found");
    }
    return reserveAccounts.map((account, i) =>
      Reserve.decode(reserveKeys[i], account!.data),
    );
  }

  private refreshKaminoReservesBatchIx(
    reserves: Reserve[],
    skipPriceUpdates: boolean,
  ): TransactionInstruction {
    const keys: AccountMeta[] = [];
    for (const reserve of reserves) {
      keys.push({
        pubkey: reserve.getAddress(),
        isSigner: false,
        isWritable: true,
      });
      keys.push({
        pubkey: reserve.lendingMarket,
        isSigner: false,
        isWritable: true,
      });
      if (!skipPriceUpdates) {
        [
          KAMINO_LENDING_PROGRAM,
          KAMINO_LENDING_PROGRAM,
          KAMINO_LENDING_PROGRAM,
          reserve.scopePriceFeed,
        ].forEach((pubkey) => {
          keys.push({ pubkey, isSigner: false, isWritable: false });
        });
      }
    }

    const identifier = Buffer.from([144, 110, 26, 103, 162, 204, 252, 147]);
    const buffer = Buffer.alloc(1000);
    const layout = borsh.struct([borsh.bool("skipPriceUpdates")]);
    const len = layout.encode({ skipPriceUpdates }, buffer);
    const data = Buffer.concat([identifier, buffer]).subarray(0, 8 + len);

    return new TransactionInstruction({
      keys,
      programId: KAMINO_LENDING_PROGRAM,
      data,
    });
  }
}

export class OrcaClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extOrcaProgram.programId);
  }

  getPositionPda(positionMint: PublicKey): [PublicKey, number] {
    return getOrcaPositionPda(positionMint);
  }

  getTickArrayPda(
    whirlpool: PublicKey,
    startTickIndex: number,
  ): [PublicKey, number] {
    return getOrcaTickArrayPda(whirlpool, startTickIndex);
  }

  getPositionTokenAta(positionMint: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      positionMint,
      this.base.vaultPda,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
  }

  async remainingAccountsForPricingWhirlpoolPositions(
    orcaPositions: PublicKey[],
  ): Promise<OrcaWhirlpoolPricingAccounts | null> {
    if (orcaPositions.length === 0) {
      return null;
    }

    const uniquePositions = new PkSet(orcaPositions);
    if (uniquePositions.size !== orcaPositions.length) {
      throw new Error("Duplicate Orca positions cannot be priced together");
    }

    const [positionAccountsInfo, assetMetas] = await Promise.all([
      this.base.connection.getMultipleAccountsInfo(orcaPositions),
      this.base.fetchAssetMetas(),
    ]);

    const parsedPositions = orcaPositions.map((position, i) => {
      const accountInfo = positionAccountsInfo[i];
      if (!accountInfo) {
        throw new Error(`Orca position account not found: ${position}`);
      }
      if (!accountInfo.owner.equals(ORCA_WHIRLPOOLS_PROGRAM_ID)) {
        throw new Error(`Orca position has unexpected owner: ${position}`);
      }
      return parseOrcaPosition(accountInfo.data);
    });

    const whirlpoolKeys = Array.from(
      new PkSet(parsedPositions.map((position) => position.whirlpool)),
    );
    const whirlpoolAccountsInfo =
      await this.base.connection.getMultipleAccountsInfo(whirlpoolKeys);
    const whirlpools = new PkMap<ParsedOrcaWhirlpool>();
    whirlpoolKeys.forEach((whirlpool, i) => {
      const accountInfo = whirlpoolAccountsInfo[i];
      if (!accountInfo) {
        throw new Error(`Orca Whirlpool account not found: ${whirlpool}`);
      }
      if (!accountInfo.owner.equals(ORCA_WHIRLPOOLS_PROGRAM_ID)) {
        throw new Error(`Orca Whirlpool has unexpected owner: ${whirlpool}`);
      }
      whirlpools.set(whirlpool, parseOrcaWhirlpool(accountInfo.data));
    });

    const pricingPositions = parsedPositions.map((position) => {
      const whirlpool = whirlpools.get(position.whirlpool);
      if (!whirlpool) {
        throw new Error(`Missing parsed Whirlpool for ${position.whirlpool}`);
      }
      return {
        position,
        whirlpool,
        tickArrayLower: deriveTickArrayForPosition(
          position.whirlpool,
          position.tickLowerIndex,
          whirlpool.tickSpacing,
        ),
        tickArrayUpper: deriveTickArrayForPosition(
          position.whirlpool,
          position.tickUpperIndex,
          whirlpool.tickSpacing,
        ),
      };
    });
    const tickArrayKeys = Array.from(
      new PkSet(
        pricingPositions.flatMap(({ tickArrayLower, tickArrayUpper }) => [
          tickArrayLower,
          tickArrayUpper,
        ]),
      ),
    );
    const tickArrayAccountsInfo =
      await this.base.connection.getMultipleAccountsInfo(tickArrayKeys);
    const tickArrays = new PkMap<Buffer>();
    tickArrayKeys.forEach((tickArray, i) => {
      const accountInfo = tickArrayAccountsInfo[i];
      if (!accountInfo) {
        throw new Error(`Orca tick array account not found: ${tickArray}`);
      }
      if (!accountInfo.owner.equals(ORCA_WHIRLPOOLS_PROGRAM_ID)) {
        throw new Error(`Orca tick array has unexpected owner: ${tickArray}`);
      }
      tickArrays.set(tickArray, accountInfo.data);
    });
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

    const kaminoReserves = new PkSet();
    const assetMetaFor = (mint: PublicKey) => {
      const assetMeta = assetMetas.get(mint);
      if (!assetMeta || !assetMeta.oracle) {
        throw new Error(`Oracle unavailable for Orca asset ${mint}`);
      }
      if (assetMeta.oracleSource === "KaminoReserve") {
        kaminoReserves.add(assetMeta.oracle);
      }
      return assetMeta;
    };

    const remainingAccounts: AccountMeta[] = [];
    const pushReadonly = (pubkey: PublicKey) => {
      remainingAccounts.push({ pubkey, isSigner: false, isWritable: false });
    };

    pricingPositions.forEach(
      ({ position, whirlpool, tickArrayLower, tickArrayUpper }, i) => {
        const positionKey = orcaPositions[i];

        const tokenMetaA = assetMetaFor(whirlpool.tokenMintA);
        const tokenMetaB = assetMetaFor(whirlpool.tokenMintB);
        const tickLower = parseOrcaTickArrayTick(
          tickArrays.get(tickArrayLower)!,
          position.whirlpool,
          getOrcaTickArrayStartIndex(
            position.tickLowerIndex,
            whirlpool.tickSpacing,
          ),
          position.tickLowerIndex,
          whirlpool.tickSpacing,
        );
        const tickUpper = parseOrcaTickArrayTick(
          tickArrays.get(tickArrayUpper)!,
          position.whirlpool,
          getOrcaTickArrayStartIndex(
            position.tickUpperIndex,
            whirlpool.tickSpacing,
          ),
          position.tickUpperIndex,
          whirlpool.tickSpacing,
        );
        const rewardAmounts = rewardOwedAmounts(
          whirlpool,
          position,
          tickLower,
          tickUpper,
          currentTimestamp,
        );

        [
          positionKey,
          this.getPositionTokenAta(position.positionMint),
          position.whirlpool,
          tickArrayLower,
          tickArrayUpper,
          whirlpool.tokenMintA,
          tokenMetaA.oracle,
          whirlpool.tokenMintB,
          tokenMetaB.oracle,
        ].forEach(pushReadonly);

        whirlpool.rewardInfos.forEach((rewardInfo, rewardIndex) => {
          const { mint } = rewardInfo;
          if (mint.equals(PublicKey.default)) {
            return;
          }
          const rewardHasValue =
            rewardAmounts[rewardIndex] !== 0n ||
            (position.liquidity !== 0n &&
              whirlpool.liquidity !== 0n &&
              rewardInfo.emissionsPerSecondX64 !== 0n);
          if (!rewardHasValue) {
            return;
          }
          const rewardMeta = assetMetaFor(mint);
          pushReadonly(mint);
          pushReadonly(rewardMeta.oracle);
        });
      },
    );

    return {
      numPositions: parsedPositions.length,
      remainingAccounts,
      kaminoReserves: Array.from(kaminoReserves),
    };
  }

  async setWhirlpoolsPolicy(
    policy: WhirlpoolsPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setWhirlpoolsPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async openPositionWithTokenExtensions(
    params: OpenOrcaPositionWithTokenExtensionsParams,
    accounts: OpenOrcaPositionWithTokenExtensionsAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.openPositionWithTokenExtensionsTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async initializeTickArray(
    params: InitializeOrcaTickArrayParams,
    accounts: InitializeOrcaTickArrayAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.initializeTickArrayTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async increaseLiquidityV2(
    params: IncreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.increaseLiquidityV2Tx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async increaseLiquidityByTokenAmountsV2(
    params: IncreaseOrcaLiquidityByTokenAmountsV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.increaseLiquidityByTokenAmountsV2Tx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async decreaseLiquidityV2(
    params: DecreaseOrcaLiquidityV2Params,
    accounts: OrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.decreaseLiquidityV2Tx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async repositionLiquidityV2(
    params: RepositionOrcaLiquidityV2Params,
    accounts: RepositionOrcaLiquidityV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.repositionLiquidityV2Tx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async updateFeesAndRewards(
    accounts: OrcaUpdateFeesAndRewardsAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.updateFeesAndRewardsTx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async collectFeesV2(
    accounts: CollectOrcaFeesV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.collectFeesV2Tx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async collectRewardV2(
    rewardIndex: number,
    accounts: CollectOrcaRewardV2Accounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.collectRewardV2Tx(
      rewardIndex,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async closePositionWithTokenExtensions(
    accounts: OrcaPositionAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.closePositionWithTokenExtensionsTx(
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }
}
