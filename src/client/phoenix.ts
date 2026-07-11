import { BN, type IdlTypes } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  buildOnboardTraderDelegatedIxResolved,
  createPhoenixClient,
  DISCRIMINANTS,
  PHOENIX_GLOBAL_CONFIGURATION_ADDRESS,
  PHOENIX_LOG_AUTHORITY_ADDRESS,
  PHOENIX_PROGRAM_ADDRESS,
  type ActiveTraderBufferAddressArray,
  type Authority,
  type BuildRegisterIxsResponse,
  type ExchangeMarketSnapshot,
  type ExchangeSnapshotView,
  type GlobalTraderIndexAddressArray,
  type MarketAddress,
  type MintAddress,
  type RegisterIxInstruction,
  type SendRegisterIxsResponse,
  type TraderAddress,
  type TraderStateMarketLimitOrderRow,
  type TraderStateSnapshotResponse,
  type TraderStateSubaccountSnapshot,
  type TraderView,
} from "@ellipsis-labs/rise";
import {
  type AccountMeta,
  type Connection,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
  TransactionMessage,
  type TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  EMBER_PROGRAM_ID,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_LOG_AUTHORITY,
  PHOENIX_PROGRAM_ID,
} from "../constants";
import { PHOENIX_PROTOCOL } from "../protocols";
import { PhoenixPolicy } from "../deser/integrationPolicies";
import type { ExtPhoenix } from "../glamExports";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import {
  assertRiseInstructionMatches,
  phoenixHttpNotFoundToNull,
  type PhoenixRiseClient,
  toRiseAddress,
  toWeb3PublicKey,
} from "../utils/phoenixRise";
import {
  BaseClient,
  BaseTxBuilder,
  type ProtocolPolicyClient,
  type ProtocolPolicyTxBuilder,
  type TxOptions,
} from "./base";

export type PhoenixIdlTypes = IdlTypes<ExtPhoenix>;
export type PhoenixBaseLots = PhoenixIdlTypes["baseLots"];
export type PhoenixCancelUpToInstruction =
  PhoenixIdlTypes["cancelUpToInstruction"];
export type PhoenixDepositFundsInstruction =
  PhoenixIdlTypes["depositFundsInstruction"];
export type PhoenixDepositParams = PhoenixIdlTypes["depositParams"];
export type PhoenixOrderFlags = PhoenixIdlTypes["orderFlags"];
export type PhoenixOrderIds = PhoenixIdlTypes["orderIds"];
export type PhoenixOrderPacket = PhoenixIdlTypes["orderPacket"];
export type PhoenixQuoteLots = PhoenixIdlTypes["quoteLots"];
export type PhoenixRegisterTraderParams =
  PhoenixIdlTypes["registerTraderParams"];
export type PhoenixSelfTradeBehavior = PhoenixIdlTypes["selfTradeBehavior"];
export type PhoenixSide = PhoenixIdlTypes["side"];
export type PhoenixTicks = PhoenixIdlTypes["ticks"];
export type PhoenixWithdrawFundsInstruction =
  PhoenixIdlTypes["withdrawFundsInstruction"];
export type PhoenixWithdrawParams = PhoenixIdlTypes["withdrawParams"];
export type PhoenixPolicyInput = PhoenixIdlTypes["phoenixPolicy"];

export type {
  ExchangeMarketSnapshot,
  ExchangeSnapshotView,
  TraderStateMarketLimitOrderRow,
  TraderStateSnapshotResponse,
  TraderStateSubaccountSnapshot,
  TraderView,
};

export type PhoenixTraderIndexes = {
  traderPdaIndex?: number;
  subaccountIndex?: number;
};

export type PhoenixRemainingAccounts = {
  remainingAccounts: AccountMeta[];
};

export type PhoenixRegisterTraderAccounts = {
  traderAccount?: PublicKey;
  logAuthority?: PublicKey;
  globalConfig?: PublicKey;
};

export type PhoenixEmberAccounts = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputTokenAccount?: PublicKey;
  outputTokenAccount?: PublicKey;
  emberState?: PublicKey;
  emberVault?: PublicKey;
  tokenProgram?: PublicKey;
};

export const PHOENIX_DEFAULT_TRADER_PDA_INDEX = 0;
export const PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX = 0;
export const PHOENIX_MIN_MAX_POSITIONS = 32;
export const PHOENIX_MAX_POSITIONS = 128;
export const PHOENIX_DEFAULT_MAX_POSITIONS = PHOENIX_MAX_POSITIONS;
export const PHOENIX_DEFAULT_TRADER_RENT_SOL = "0.03819648";

const PHOENIX_TRADER_ACCOUNT_BASE_SIZE = 240;
const PHOENIX_TRADER_POSITION_SIZE = 40;

const DEFAULT_VERIFICATION_ATTEMPTS = 10;
const DEFAULT_VERIFICATION_DELAY_MS = 500;
const MAX_VERIFICATION_ATTEMPTS = 30;
const MAX_VERIFICATION_DELAY_MS = 10_000;
const SIGNATURE_LENGTH = 64;
export type PhoenixTraderCapabilities = TraderView["capabilities"];

export type PhoenixTraderOnboardingStatus = {
  traderPda: PublicKey;
  traderExists: boolean;
  registrationRequired: boolean;
  delegatedActivationRequired: boolean;
  delegatedCapabilitiesActive: boolean;
  traderView: TraderView | null;
  capabilities: PhoenixTraderCapabilities | null;
};

export type PhoenixOnboardTraderOptions = {
  /**
   * Sizes a newly registered trader account. Defaults to 128; Phoenix accepts
   * integers from 32 to 128. Existing trader accounts are not resized.
   */
  maxPositions?: number;
  /** Applied only to the GLAM-wrapped registration transaction. */
  txOptions?: TxOptions;
  /** Bounded polling controls for Phoenix API/indexer propagation. */
  verification?: {
    maxAttempts?: number;
    delayMs?: number;
  };
};

export type PhoenixOnboardTraderResult = {
  traderPda: PublicKey;
  registrationPerformed: boolean;
  registrationSignature?: TransactionSignature;
  delegatedActivationPerformed: boolean;
  activationSignature?: TransactionSignature;
  finalStatus: PhoenixTraderOnboardingStatus;
};

export type PhoenixOnboardingPhase =
  | "registration"
  | "activation"
  | "verification";

export class PhoenixOnboardingError extends Error {
  readonly phase: PhoenixOnboardingPhase;
  readonly traderPda: PublicKey;
  readonly registrationSignature?: TransactionSignature;
  /**
   * The locally signed activation transaction signature. When an error occurs
   * after submission starts, this transaction may still land; callers should
   * check its chain status before attempting manual recovery.
   */
  readonly activationSignature?: TransactionSignature;
  readonly cause?: unknown;

  constructor(
    message: string,
    context: {
      phase: PhoenixOnboardingPhase;
      traderPda: PublicKey;
      registrationSignature?: TransactionSignature;
      activationSignature?: TransactionSignature;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "PhoenixOnboardingError";
    this.phase = context.phase;
    this.traderPda = context.traderPda;
    this.registrationSignature = context.registrationSignature;
    this.activationSignature = context.activationSignature;
    this.cause = context.cause;
  }
}

export function validatePhoenixMaxPositions(maxPositions: number): number {
  if (
    !Number.isInteger(maxPositions) ||
    maxPositions < PHOENIX_MIN_MAX_POSITIONS ||
    maxPositions > PHOENIX_MAX_POSITIONS
  ) {
    throw new Error(
      `Phoenix maxPositions must be an integer between ${PHOENIX_MIN_MAX_POSITIONS} and ${PHOENIX_MAX_POSITIONS}, inclusive`,
    );
  }
  return maxPositions;
}

/** Byte size of a Phoenix trader account registered with `maxPositions`. */
export function getPhoenixTraderAccountSize(maxPositions: number): number {
  return (
    PHOENIX_TRADER_ACCOUNT_BASE_SIZE +
    PHOENIX_TRADER_POSITION_SIZE * validatePhoenixMaxPositions(maxPositions)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PhoenixTraderStatusInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoenixTraderStatusInvariantError";
  }
}

class PhoenixTraderStatePropagationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoenixTraderStatePropagationError";
  }
}

function traderStatusInvariant(message: string): never {
  throw new PhoenixTraderStatusInvariantError(message);
}

function parseTraderStatusPublicKey(value: string, label: string): PublicKey {
  try {
    return parsePhoenixPublicKey(value, label);
  } catch (error) {
    return traderStatusInvariant(errorMessage(error));
  }
}

function validateBoundedInteger(
  value: number,
  label: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function hasDiscriminator(
  instruction: RegisterIxInstruction,
  discriminator: Uint8Array,
): boolean {
  return Buffer.from(instruction.data)
    .subarray(0, discriminator.length)
    .equals(Buffer.from(discriminator));
}

function parsePhoenixPublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(
      `Phoenix returned an invalid ${label}: ${errorMessage(error)}`,
    );
  }
}

function validateBuildResponseEchoes(
  response: BuildRegisterIxsResponse,
  traderPda: PublicKey,
  txFeePayer: PublicKey,
  maxPositions: number,
): PublicKey {
  if (response.includeRegisterTrader !== false) {
    throw new Error(
      "Phoenix proposed a raw register_trader instruction. Register the trader through GLAM and retry after the account is visible to Phoenix; the raw Phoenix registration path will not be signed.",
    );
  }
  if (response.traderPda !== traderPda.toBase58()) {
    throw new Error(
      `Phoenix returned trader PDA ${response.traderPda}, expected ${traderPda.toBase58()}`,
    );
  }
  if (response.txFeePayer !== txFeePayer.toBase58()) {
    throw new Error(
      `Phoenix returned fee payer ${response.txFeePayer}, expected ${txFeePayer.toBase58()}`,
    );
  }
  if (response.maxPositions !== maxPositions) {
    throw new Error(
      `Phoenix returned maxPositions ${response.maxPositions}, expected ${maxPositions}`,
    );
  }

  const traderOnboarder = parsePhoenixPublicKey(
    response.traderOnboarder,
    "trader onboarder",
  );
  if (traderOnboarder.equals(txFeePayer)) {
    throw new Error(
      "Phoenix trader onboarder must not be the transaction fee payer",
    );
  }
  return traderOnboarder;
}

async function validateDelegatedOnboardingBundle(
  rise: PhoenixRiseClient,
  response: BuildRegisterIxsResponse,
  snapshot: ExchangeSnapshotView,
  traderAuthority: PublicKey,
  traderPda: PublicKey,
  txFeePayer: PublicKey,
  maxPositions: number,
): Promise<{
  instructions: TransactionInstruction[];
  traderOnboarder: PublicKey;
}> {
  const expectedTraderPda = toWeb3PublicKey(
    await rise.pda.getTraderAddress({
      authority: toRiseAddress<Authority>(traderAuthority),
      traderPdaIndex: PHOENIX_DEFAULT_TRADER_PDA_INDEX,
      subaccountIndex: PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX,
      phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
    }),
  );
  if (!traderPda.equals(expectedTraderPda)) {
    throw new Error(
      `Phoenix trader PDA ${traderPda.toBase58()} does not match the default 0/0 account for ${traderAuthority.toBase58()}`,
    );
  }
  const traderOnboarder = validateBuildResponseEchoes(
    response,
    traderPda,
    txFeePayer,
    maxPositions,
  );

  if (
    response.instructions.some((instruction) =>
      hasDiscriminator(instruction, DISCRIMINANTS.REGISTER_TRADER),
    )
  ) {
    throw new Error(
      "Phoenix returned a raw register_trader instruction. GLAM onboarding only permits registration through the ext_phoenix wrapper.",
    );
  }
  if (response.instructions.length !== 1) {
    throw new Error(
      `Phoenix returned ${response.instructions.length} delegated-onboarding instructions; expected exactly one`,
    );
  }

  const snapshotProgram = parsePhoenixPublicKey(
    snapshot.exchange.programId,
    "snapshot program id",
  );
  if (!snapshotProgram.equals(PHOENIX_PROGRAM_ID)) {
    throw new Error(
      `Phoenix snapshot program ${snapshotProgram.toBase58()} does not match ${PHOENIX_PROGRAM_ID.toBase58()}`,
    );
  }
  const snapshotGlobalConfig = parsePhoenixPublicKey(
    snapshot.exchange.globalConfig,
    "snapshot global config",
  );
  if (!snapshotGlobalConfig.equals(PHOENIX_GLOBAL_CONFIG)) {
    throw new Error(
      `Phoenix snapshot global config ${snapshotGlobalConfig.toBase58()} does not match ${PHOENIX_GLOBAL_CONFIG.toBase58()}`,
    );
  }

  const riskAuthority = parsePhoenixPublicKey(
    snapshot.exchange.currentAuthorities.riskAuthority,
    "risk authority",
  );
  const fixedAccountKeys = [
    PHOENIX_PROGRAM_ID,
    PHOENIX_LOG_AUTHORITY,
    PHOENIX_GLOBAL_CONFIG,
    traderAuthority,
    traderPda,
    txFeePayer,
  ];
  const fixedAccounts = new Set(fixedAccountKeys.map((key) => key.toBase58()));
  if (fixedAccounts.has(traderOnboarder.toBase58())) {
    throw new Error(
      `Phoenix trader onboarder ${traderOnboarder.toBase58()} collides with a fixed onboarding account`,
    );
  }
  const permissionAddress = await rise.pda.getPermissionAddress({
    permissionAuthority: toRiseAddress(riskAuthority),
    delegatedKey: toRiseAddress(traderOnboarder),
    phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
  });
  const permissionPda = toWeb3PublicKey(permissionAddress);
  if (
    fixedAccounts.has(permissionPda.toBase58()) ||
    permissionPda.equals(traderOnboarder)
  ) {
    throw new Error(
      `Phoenix permission account ${permissionPda.toBase58()} collides with another fixed onboarding account`,
    );
  }

  const globalTraderIndexValues = snapshot.exchange.globalTraderIndex;
  const activeTraderBufferValues = snapshot.exchange.activeTraderBuffer;
  if (
    globalTraderIndexValues.length === 0 ||
    activeTraderBufferValues.length === 0
  ) {
    throw new Error(
      "Phoenix snapshot must contain non-empty global trader index and active trader buffer account lists",
    );
  }

  const reservedAccounts = new Set(fixedAccounts);
  reservedAccounts.add(traderOnboarder.toBase58());
  reservedAccounts.add(permissionPda.toBase58());
  const dynamicAccounts = new Set<string>();
  const parseSnapshotAccounts = (
    values: string[],
    label: string,
  ): PublicKey[] =>
    values.map((value, index) => {
      const key = parsePhoenixPublicKey(value, `${label} account ${index}`);
      const keyString = key.toBase58();
      if (reservedAccounts.has(keyString) || dynamicAccounts.has(keyString)) {
        throw new Error(
          `Phoenix snapshot ${label} account ${keyString} collides with another onboarding account`,
        );
      }
      dynamicAccounts.add(keyString);
      return key;
    });
  const globalTraderIndex = parseSnapshotAccounts(
    globalTraderIndexValues,
    "global trader index",
  );
  const activeTraderBuffer = parseSnapshotAccounts(
    activeTraderBufferValues,
    "active trader buffer",
  );

  const expectedInstruction = buildOnboardTraderDelegatedIxResolved({
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
      authority: toRiseAddress<Authority>(traderOnboarder),
      permissionAccount: permissionAddress,
      traderAccount: toRiseAddress<TraderAddress>(traderPda),
    },
  });
  const instruction = assertRiseInstructionMatches(
    response.instructions[0],
    expectedInstruction,
  );

  return {
    traderOnboarder,
    instructions: [instruction],
  };
}

function validateSendResponse(
  response: SendRegisterIxsResponse,
  buildResponse: BuildRegisterIxsResponse,
  traderPda: PublicKey,
  txFeePayer: PublicKey,
  maxPositions: number,
  expectedSignature: TransactionSignature,
): void {
  if (response.signature !== expectedSignature) {
    throw new Error(
      "Phoenix activation response signature does not match the locally signed transaction",
    );
  }
  if (response.includeRegisterTrader !== false) {
    throw new Error(
      "Phoenix reported unexpected raw trader registration during delegated activation",
    );
  }
  if (
    response.traderPda !== traderPda.toBase58() ||
    response.traderOnboarder !== buildResponse.traderOnboarder ||
    response.txFeePayer !== txFeePayer.toBase58() ||
    response.maxPositions !== maxPositions
  ) {
    throw new Error(
      "Phoenix activation response does not match the signed request",
    );
  }
}

function isZeroSignature(signature: Uint8Array): boolean {
  return (
    signature.length === SIGNATURE_LENGTH &&
    signature.every((byte) => byte === 0)
  );
}

async function confirmPhoenixActivation(
  connection: Connection,
  signature: TransactionSignature,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  let confirmation: Awaited<ReturnType<Connection["confirmTransaction"]>>;
  try {
    confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
  } catch (confirmationError) {
    let status: Awaited<
      ReturnType<Connection["getSignatureStatuses"]>
    >["value"][number];
    try {
      const statuses = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      status = statuses.value[0];
    } catch {
      throw confirmationError;
    }

    if (!status) {
      throw confirmationError;
    }
    if (status.err) {
      throw new Error(
        `Phoenix activation transaction failed: ${JSON.stringify(status.err)}`,
      );
    }
    const confirmed =
      status.confirmationStatus === "confirmed" ||
      status.confirmationStatus === "finalized" ||
      (status.confirmationStatus == null && status.confirmations === null);
    if (!confirmed) {
      throw confirmationError;
    }
    return;
  }

  if (confirmation.value.err) {
    throw new Error(
      `Phoenix activation transaction failed: ${JSON.stringify(
        confirmation.value.err,
      )}`,
    );
  }
}

function meta(pubkey: PublicKey | string, isWritable: boolean): AccountMeta {
  return { pubkey: new PublicKey(pubkey), isSigner: false, isWritable };
}

class TxBuilder
  extends BaseTxBuilder<PhoenixClient>
  implements ProtocolPolicyTxBuilder<PhoenixPolicy>
{
  async getEmberCpiAccounts(
    accounts: PhoenixEmberAccounts,
    signer?: PublicKey,
  ) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: EMBER_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
      emberState: accounts.emberState || (await this.client.getEmberStatePda()),
      inputMint: accounts.inputMint,
      outputMint: accounts.outputMint,
      inputTokenAccount:
        accounts.inputTokenAccount ||
        this.client.base.getVaultAta(accounts.inputMint),
      outputTokenAccount:
        accounts.outputTokenAccount ||
        this.client.base.getVaultAta(
          accounts.outputMint,
          accounts.tokenProgram,
        ),
      emberVault: accounts.emberVault || (await this.client.getEmberVaultPda()),
      tokenProgram: accounts.tokenProgram || TOKEN_PROGRAM_ID,
    };
  }

  /**
   * Account map shared by every ext_phoenix Phoenix-CPI instruction
   * (`glam_state`, `glam_vault`, `glam_signer`, integration authority,
   * `cpi_program=Phoenix`, the GLAM protocol program).
   *
   * `register_trader` intentionally appends `system_program` after Phoenix's
   * log, global config, and trader accounts to mirror the deployed ABI order.
   */
  getPhoenixCpiAccounts(signer?: PublicKey) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: PHOENIX_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
    };
  }

  getPhoenixCpiAccountsWithSystem(signer?: PublicKey) {
    return {
      ...this.getPhoenixCpiAccounts(signer),
      systemProgram: SystemProgram.programId,
    };
  }

  async getRegisterTraderAccounts(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    signer?: PublicKey,
  ) {
    return {
      ...this.getPhoenixCpiAccounts(signer),
      logAuthority: accounts.logAuthority || PHOENIX_LOG_AUTHORITY,
      globalConfig: accounts.globalConfig || PHOENIX_GLOBAL_CONFIG,
      traderAccount:
        accounts.traderAccount ||
        (await this.client.getTraderPda(
          params.traderPdaIndex,
          params.traderSubaccountIndex,
        )),
      systemProgram: SystemProgram.programId,
    };
  }

  async registerTraderIx(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .registerTrader(params)
      .accountsPartial(
        await this.getRegisterTraderAccounts(params, accounts, signer),
      )
      .instruction();
  }

  async updateTraderStateIx(
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .updateTraderState()
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async emberDepositIx(
    params: PhoenixDepositParams,
    accounts: PhoenixEmberAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .deposit(params)
      .accounts(await this.getEmberCpiAccounts(accounts, signer))
      .instruction();
  }

  async depositFundsIx(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .depositFunds(params)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async emberWithdrawIx(
    params: PhoenixWithdrawParams,
    accounts: PhoenixEmberAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .withdraw(params)
      .accounts(await this.getEmberCpiAccounts(accounts, signer))
      .instruction();
  }

  async withdrawFundsIx(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .withdrawFunds(params)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async placeLimitOrderIx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .placeLimitOrder(packet)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async placeMarketOrderIx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .placeMarketOrder(packet)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelAllIx(
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelAll()
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelOrdersByIdIx(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelOrdersById(orderIds)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelUpToIx(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelUpTo(args)
      .accounts(this.getPhoenixCpiAccountsWithSystem(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async setPolicyIx(
    policy: PhoenixPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const policyInput: PhoenixPolicyInput = {
      marketsAllowlist: policy.marketsAllowlist,
      allowedOrderTypes: Buffer.from(policy.allowedOrderTypes),
      maxPriceDeviationBps: policy.maxPriceDeviationBps,
      requireReduceOnlyOrders: policy.requireReduceOnlyOrders,
      maxReferencePriceAgeSecs: policy.maxReferencePriceAgeSecs,
    };

    return await this.client.base.extPhoenixProgram.methods
      .setPhoenixPolicy(policyInput)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: PhoenixPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.programId,
      PHOENIX_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.programId,
      PHOENIX_PROTOCOL,
      txOptions,
    );
  }

  async delegatedOnboardingTx(
    response: BuildRegisterIxsResponse,
    snapshot: ExchangeSnapshotView,
    maxPositions: number,
  ): Promise<{
    transaction: VersionedTransaction;
    traderOnboarder: PublicKey;
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    const traderAuthority = this.client.base.vaultPda;
    const traderPda = await this.client.getTraderPda();
    const txFeePayer = this.client.base.signer;
    const { instructions, traderOnboarder } =
      await validateDelegatedOnboardingBundle(
        this.client.rise,
        response,
        snapshot,
        traderAuthority,
        traderPda,
        txFeePayer,
        maxPositions,
      );
    const { blockhash, lastValidBlockHeight } =
      await this.client.base.connection.getLatestBlockhash("confirmed");
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: txFeePayer,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(),
    );
    const signerKeys = transaction.message.staticAccountKeys.slice(
      0,
      transaction.message.header.numRequiredSignatures,
    );
    if (
      signerKeys.length !== 2 ||
      !signerKeys[0].equals(txFeePayer) ||
      !signerKeys[1].equals(traderOnboarder)
    ) {
      throw new Error(
        "Phoenix delegated onboarding must require exactly the configured fee payer and Phoenix onboarder signatures",
      );
    }
    if (!transaction.signatures.every(isZeroSignature)) {
      throw new Error(
        "Phoenix delegated onboarding transaction unexpectedly contains a signature before wallet signing",
      );
    }
    return {
      transaction,
      traderOnboarder,
      blockhash,
      lastValidBlockHeight,
    };
  }

  async registerTraderTx(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.registerTraderIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async updateTraderStateTx(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateTraderStateIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  /**
   * Remaining-accounts list for `deposit_funds` — the vault token account
   * holding the canonical collateral, the trader PDA, Phoenix's global vault
   * for that mint, the SPL token program, and the trader-index/active-buffer
   * chunks from the snapshot.
   */
  async getDepositRemainingAccounts(
    snapshot: ExchangeSnapshotView,
    indexes: PhoenixTraderIndexes = {},
  ): Promise<AccountMeta[]> {
    const mint = new PublicKey(snapshot.exchange.canonicalMint);
    const vaultAta = this.client.base.getVaultAta(mint);
    const [traderPda, globalVaultPda] = await Promise.all([
      this.client.getTraderPda(indexes.traderPdaIndex, indexes.subaccountIndex),
      this.client.getGlobalVaultPda(mint),
    ]);

    return [
      ...this.client.getPhoenixRemainingPrefix(true),
      meta(this.client.base.vaultPda, true),
      meta(vaultAta, true),
      meta(traderPda, true),
      meta(globalVaultPda, true),
      meta(TOKEN_PROGRAM_ID, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
    ];
  }

  /**
   * Remaining-accounts list for `withdraw_funds`. Same shape as the deposit
   * variant plus the perp asset map and the global withdraw queue, which the
   * withdraw path mutates.
   */
  async getWithdrawRemainingAccounts(
    snapshot: ExchangeSnapshotView,
    indexes: PhoenixTraderIndexes = {},
  ): Promise<AccountMeta[]> {
    const mint = new PublicKey(snapshot.exchange.canonicalMint);
    const vaultAta = this.client.base.getVaultAta(mint);
    const [traderPda, globalVaultPda] = await Promise.all([
      this.client.getTraderPda(indexes.traderPdaIndex, indexes.subaccountIndex),
      this.client.getGlobalVaultPda(mint),
    ]);

    return [
      ...this.client.getPhoenixRemainingPrefix(true),
      meta(this.client.base.vaultPda, true),
      meta(traderPda, true),
      meta(snapshot.exchange.perpAssetMap, true),
      meta(globalVaultPda, true),
      meta(vaultAta, true),
      meta(TOKEN_PROGRAM_ID, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
      meta(snapshot.exchange.withdrawQueue, true),
    ];
  }

  async deposit(amount: BN, txOptions: TxOptions = {}) {
    const snapshot = await this.client.rise.api.exchange().getSnapshot();

    const usdcMint = new PublicKey(snapshot.exchange.usdcMint);
    const canonicalMint = new PublicKey(snapshot.exchange.canonicalMint);
    const remainingAccounts = await this.getDepositRemainingAccounts(snapshot);

    const ixs = [
      // create canonical token ata
      createAssociatedTokenAccountIdempotentInstruction(
        txOptions.signer || this.client.base.signer,
        this.client.base.getVaultAta(canonicalMint),
        this.client.base.vaultPda,
        canonicalMint,
      ),
      await this.emberDepositIx(
        { amount },
        { inputMint: usdcMint, outputMint: canonicalMint },
        txOptions.signer,
      ),
      await this.depositFundsIx(
        { amount },
        { remainingAccounts },
        txOptions.signer,
      ),
    ];
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async withdraw(amount: BN, txOptions: TxOptions = {}) {
    const snapshot = await this.client.rise.api.exchange().getSnapshot();

    const usdcMint = new PublicKey(snapshot.exchange.usdcMint);
    const canonicalMint = new PublicKey(snapshot.exchange.canonicalMint);
    const remainingAccounts = await this.getWithdrawRemainingAccounts(snapshot);

    const ixs = [
      // create USDC ata
      createAssociatedTokenAccountIdempotentInstruction(
        txOptions.signer || this.client.base.signer,
        this.client.base.getVaultAta(usdcMint),
        this.client.base.vaultPda,
        usdcMint,
      ),
      await this.withdrawFundsIx(
        { amount },
        { remainingAccounts },
        txOptions.signer,
      ),
      await this.emberWithdrawIx(
        { amount },
        { inputMint: usdcMint, outputMint: canonicalMint },
        txOptions.signer,
      ),
    ];
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async depositFundsTx(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.depositFundsIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async withdrawFundsTx(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.withdrawFundsIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async placeLimitOrderTx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.placeLimitOrderIx(packet, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async placeMarketOrderTx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.placeMarketOrderIx(
      packet,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelAllTx(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelAllIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelOrdersByIdTx(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelOrdersByIdIx(
      orderIds,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelUpToTx(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelUpToIx(args, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class PhoenixClient implements ProtocolPolicyClient<PhoenixPolicy> {
  readonly txBuilder: TxBuilder;
  readonly rise: PhoenixRiseClient;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
    this.rise =
      base.phoenixRiseClient ||
      createPhoenixClient({
        rpcUrl: base.connection.rpcEndpoint,
        phoenixEnv: "prod",
        programAddress: PHOENIX_PROGRAM_ADDRESS,
        ws: false,
        exchangeMetadata: { stream: false },
      });
  }

  /** The ext_phoenix program id this client talks to. */
  get programId(): PublicKey {
    return this.base.extPhoenixProgram.programId;
  }

  /** Bit flag identifying Phoenix inside the GLAM integration ACL bitmask. */
  get protocolBitflag(): number {
    return PHOENIX_PROTOCOL;
  }

  /** PDA the ext_phoenix program signs CPIs with into Phoenix and Ember. */
  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extPhoenixProgram.programId);
  }

  /**
   * PDA of a Phoenix trader account owned by the GLAM vault (defaults to the
   * vault PDA as authority). `traderPdaIndex` selects the parent trader and
   * `subaccountIndex` selects a child subaccount under that parent.
   */
  async getTraderPda(
    traderPdaIndex = 0,
    subaccountIndex = 0,
    authority: PublicKey = this.base.vaultPda,
  ): Promise<PublicKey> {
    return toWeb3PublicKey(
      await this.rise.pda.getTraderAddress({
        authority: toRiseAddress<Authority>(authority),
        traderPdaIndex,
        subaccountIndex,
        phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      }),
    );
  }

  /** PDA of the spline-collection account associated with a Phoenix market. */
  async getSplineCollectionPda(market: PublicKey): Promise<PublicKey> {
    return toWeb3PublicKey(
      await this.rise.pda.getSplineCollectionAddress({
        marketAccountAddress: toRiseAddress<MarketAddress>(market),
        phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      }),
    );
  }

  /** PDA of Phoenix's global-vault token account for a given mint. */
  async getGlobalVaultPda(mint: PublicKey): Promise<PublicKey> {
    return toWeb3PublicKey(
      await this.rise.pda.getGlobalVaultAddress({
        mint: toRiseAddress<MintAddress>(mint),
        phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      }),
    );
  }

  /** PDA of the Ember exchange-state account that backs Phoenix conversions. */
  async getEmberStatePda(): Promise<PublicKey> {
    return toWeb3PublicKey(
      await this.rise.pda.getEmberStateAddress({
        phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      }),
    );
  }

  /** PDA of Ember's USDC vault that mints/burns canonical collateral. */
  async getEmberVaultPda(): Promise<PublicKey> {
    return toWeb3PublicKey(
      await this.rise.pda.getEmberVaultAddress({
        phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      }),
    );
  }

  /**
   * The three accounts every Phoenix CPI begins with (program, log authority,
   * global config). `globalConfigWritable` toggles the writable flag on the
   * global config — set true for instructions that mutate exchange state.
   */
  getPhoenixRemainingPrefix(globalConfigWritable: boolean): AccountMeta[] {
    return [
      meta(PHOENIX_PROGRAM_ID, false),
      meta(PHOENIX_LOG_AUTHORITY, false),
      meta(PHOENIX_GLOBAL_CONFIG, globalConfigWritable),
    ];
  }

  /**
   * Remaining-accounts list for place/cancel/order-book CPIs against a single
   * Phoenix market. Includes the trader PDA, perp asset map, trader indices,
   * the market itself, and its spline collection.
   */
  async getMarketRemainingAccounts(
    snapshot: ExchangeSnapshotView,
    market: PublicKey | string,
    indexes: PhoenixTraderIndexes = {},
  ): Promise<AccountMeta[]> {
    const marketPubkey = new PublicKey(market);
    const [traderPda, splineCollectionPda] = await Promise.all([
      this.getTraderPda(indexes.traderPdaIndex, indexes.subaccountIndex),
      this.getSplineCollectionPda(marketPubkey),
    ]);
    return [
      ...this.getPhoenixRemainingPrefix(true),
      meta(this.base.vaultPda, true),
      meta(traderPda, true),
      meta(snapshot.exchange.perpAssetMap, true),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
      meta(marketPubkey, true),
      meta(splineCollectionPda, true),
    ];
  }

  /**
   * Remaining-accounts list for `update_trader_state` — settles funding for
   * the trader and may evict it from the active-trader buffer once it no
   * longer holds resting orders.
   */
  async getUpdateTraderStateRemainingAccounts(
    snapshot: ExchangeSnapshotView,
    indexes: PhoenixTraderIndexes = {},
  ): Promise<AccountMeta[]> {
    const traderPda = await this.getTraderPda(
      indexes.traderPdaIndex,
      indexes.subaccountIndex,
    );
    return [
      ...this.getPhoenixRemainingPrefix(false),
      meta(traderPda, true),
      meta(snapshot.exchange.perpAssetMap, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
    ];
  }

  /** Fetches the on-chain PhoenixPolicy stored under this vault, if any. */
  async fetchPolicy(): Promise<PhoenixPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      PHOENIX_PROTOCOL,
      PhoenixPolicy,
    );
  }

  /** Writes the PhoenixPolicy (market allowlist, order types, etc.). */
  async setPolicy(
    policy: PhoenixPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /** Deletes the stored PhoenixPolicy. Future Phoenix policy checks fail closed. */
  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Reads the default `0/0` trader account. Account existence and Phoenix
   * ownership are verified over RPC; all six capability states are reported by
   * Phoenix's trader-view API/indexer. A capability is active when Phoenix
   * reports either immediate access or access via cold activation.
   */
  async getTraderOnboardingStatus(): Promise<PhoenixTraderOnboardingStatus> {
    const traderPda = await this.getTraderPda(
      PHOENIX_DEFAULT_TRADER_PDA_INDEX,
      PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX,
    );
    const [accountInfo, traderView] = await Promise.all([
      this.base.connection.getAccountInfo(traderPda),
      phoenixHttpNotFoundToNull(() =>
        this.rise.api.traders().getTrader(traderPda.toBase58()),
      ),
    ]);
    if (traderView) {
      const viewTrader = parseTraderStatusPublicKey(
        traderView.traderKey,
        "trader view key",
      );
      if (!viewTrader.equals(traderPda)) {
        traderStatusInvariant(
          `Phoenix trader view returned ${viewTrader.toBase58()}, expected ${traderPda.toBase58()}`,
        );
      }
      const viewAuthority = parseTraderStatusPublicKey(
        traderView.authority,
        "trader view authority",
      );
      if (!viewAuthority.equals(this.base.vaultPda)) {
        traderStatusInvariant(
          `Phoenix trader view authority ${viewAuthority.toBase58()} does not match GLAM vault ${this.base.vaultPda.toBase58()}`,
        );
      }
      if (traderView.traderPdaIndex !== PHOENIX_DEFAULT_TRADER_PDA_INDEX) {
        traderStatusInvariant(
          "Phoenix trader view returned a non-default PDA index",
        );
      }
      if (
        traderView.traderSubaccountIndex !==
        PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX
      ) {
        traderStatusInvariant(
          "Phoenix trader view returned a non-default subaccount index",
        );
      }
    }

    if (accountInfo && !accountInfo.owner.equals(PHOENIX_PROGRAM_ID)) {
      traderStatusInvariant(
        `Phoenix trader PDA ${traderPda.toBase58()} is owned by ${accountInfo.owner.toBase58()}, expected ${PHOENIX_PROGRAM_ID.toBase58()}`,
      );
    }
    if (!accountInfo && traderView) {
      throw new PhoenixTraderStatePropagationError(
        `Phoenix API reports trader ${traderPda.toBase58()}, but the configured RPC does not; retry after RPC state catches up`,
      );
    }

    const traderExists = accountInfo !== null;
    const capabilities = traderView?.capabilities ?? null;
    const delegatedCapabilitiesActive =
      traderExists && traderView !== null && traderView.verifyCapabilities();
    return {
      traderPda,
      traderExists,
      registrationRequired: !traderExists,
      delegatedActivationRequired: !delegatedCapabilitiesActive,
      delegatedCapabilitiesActive,
      traderView,
      capabilities,
    };
  }

  /**
   * Creates a Phoenix trader account for the vault (parent or child subaccount)
   * sized to hold `maxPositions`. Registration alone does not enable deposits,
   * withdrawals, or trading; use `onboardTrader` for the complete default-account
   * flow.
   */
  async registerTrader(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.registerTraderTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Registers and delegated-onboards the GLAM vault's default Phoenix trader.
   *
   * Registration always goes through GLAM's existing ext_phoenix wrapper. The
   * GLAM vault PDA is the Phoenix trader authority, while the configured wallet
   * pays transaction fees and trader-account rent when registration is
   * required (`0.03819648 SOL` at the default 128 positions; smaller accounts
   * cost less). Phoenix expects that rent to return to the original funder once
   * account closing is supported; closing is not available yet. The delegated
   * phase uses Rise's typed builder/submission methods, validates the complete
   * returned instruction before signing, and verifies all capabilities through
   * Phoenix's trader-view API after confirmation. It does not use the retired
   * sponsored activation endpoints. Reruns safely skip phases already reflected
   * in state; `maxPositions` never resizes an existing trader account.
   */
  async onboardTrader(
    options: PhoenixOnboardTraderOptions = {},
  ): Promise<PhoenixOnboardTraderResult> {
    const maxPositions = validatePhoenixMaxPositions(
      options.maxPositions ?? PHOENIX_DEFAULT_MAX_POSITIONS,
    );
    const maxAttempts = validateBoundedInteger(
      options.verification?.maxAttempts ?? DEFAULT_VERIFICATION_ATTEMPTS,
      "Phoenix verification maxAttempts",
      1,
      MAX_VERIFICATION_ATTEMPTS,
    );
    const delayMs = validateBoundedInteger(
      options.verification?.delayMs ?? DEFAULT_VERIFICATION_DELAY_MS,
      "Phoenix verification delayMs",
      0,
      MAX_VERIFICATION_DELAY_MS,
    );
    const txOptions = options.txOptions || {};
    if (txOptions.signer && !txOptions.signer.equals(this.base.signer)) {
      throw new Error(
        "Phoenix onboarding must use the configured GLAM wallet as transaction signer and fee payer",
      );
    }

    const initialStatus = await this.getTraderOnboardingStatus();
    const traderPda = initialStatus.traderPda;
    if (initialStatus.delegatedCapabilitiesActive) {
      return {
        traderPda,
        registrationPerformed: false,
        delegatedActivationPerformed: false,
        finalStatus: initialStatus,
      };
    }

    let registrationSignature: TransactionSignature | undefined;
    if (initialStatus.registrationRequired) {
      try {
        registrationSignature = await this.registerTrader(
          {
            maxPositions: new BN(maxPositions),
            traderPdaIndex: PHOENIX_DEFAULT_TRADER_PDA_INDEX,
            traderSubaccountIndex: PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX,
          },
          { traderAccount: traderPda },
          txOptions,
        );
      } catch (error) {
        throw new PhoenixOnboardingError(
          `Phoenix trader registration failed: ${errorMessage(error)}`,
          {
            phase: "registration",
            traderPda,
            cause: error,
          },
        );
      }
    }

    let activationSignature: TransactionSignature | undefined;
    let phase: PhoenixOnboardingPhase = "activation";
    try {
      const traderAuthority = this.base.vaultPda.toBase58();
      const txFeePayer = this.base.signer.toBase58();
      const [firstBuildResponse, snapshot] = await Promise.all([
        this.rise.api.exchange().buildRegisterIxs({
          traderAuthority,
          txFeePayer,
          maxPositions,
        }),
        this.rise.api.exchange().getSnapshot(),
      ]);
      let buildResponse = firstBuildResponse;
      for (
        let attempt = 1;
        registrationSignature !== undefined &&
        buildResponse.includeRegisterTrader === true &&
        attempt < maxAttempts;
        attempt += 1
      ) {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        buildResponse = await this.rise.api.exchange().buildRegisterIxs({
          traderAuthority,
          txFeePayer,
          maxPositions,
        });
      }
      const { transaction, traderOnboarder, blockhash, lastValidBlockHeight } =
        await this.txBuilder.delegatedOnboardingTx(
          buildResponse,
          snapshot,
          maxPositions,
        );
      const messageBytes = Buffer.from(transaction.message.serialize());
      const signedTransaction =
        await this.base.wallet.signTransaction(transaction);
      if (
        !Buffer.from(signedTransaction.message.serialize()).equals(messageBytes)
      ) {
        throw new Error(
          "Wallet changed the Phoenix delegated-onboarding transaction message",
        );
      }
      if (
        signedTransaction.signatures.length !== 2 ||
        isZeroSignature(signedTransaction.signatures[0]) ||
        !isZeroSignature(signedTransaction.signatures[1])
      ) {
        throw new Error(
          "Wallet must sign only the fee-payer slot and preserve the Phoenix onboarder signature slot",
        );
      }
      activationSignature = bs58.encode(signedTransaction.signatures[0]);

      const sendResponse = await this.rise.api.exchange().sendRegisterIxs({
        transaction: Buffer.from(signedTransaction.serialize()).toString(
          "base64",
        ),
        traderAuthority,
        txFeePayer,
        maxPositions,
        traderPdaIndex: PHOENIX_DEFAULT_TRADER_PDA_INDEX,
        traderSubaccountIndex: PHOENIX_DEFAULT_TRADER_SUBACCOUNT_INDEX,
      });
      validateSendResponse(
        sendResponse,
        buildResponse,
        traderPda,
        this.base.signer,
        maxPositions,
        activationSignature,
      );
      if (sendResponse.traderOnboarder !== traderOnboarder.toBase58()) {
        throw new Error(
          "Phoenix activation response changed the validated trader onboarder",
        );
      }
      await confirmPhoenixActivation(
        this.base.connection,
        activationSignature,
        blockhash,
        lastValidBlockHeight,
      );

      phase = "verification";
      let lastStatus: PhoenixTraderOnboardingStatus | undefined;
      let lastVerificationError: unknown;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          lastStatus = await this.getTraderOnboardingStatus();
          lastVerificationError = undefined;
          if (lastStatus.delegatedCapabilitiesActive) {
            return {
              traderPda,
              registrationPerformed: registrationSignature !== undefined,
              registrationSignature,
              delegatedActivationPerformed: true,
              activationSignature,
              finalStatus: lastStatus,
            };
          }
        } catch (error) {
          if (error instanceof PhoenixTraderStatusInvariantError) {
            throw error;
          }
          lastVerificationError = error;
        }

        if (attempt + 1 < maxAttempts && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      const detail = lastVerificationError
        ? ` Last read failed: ${errorMessage(lastVerificationError)}`
        : lastStatus
          ? " Required deposit, withdrawal, and trading capabilities are still inactive."
          : " Phoenix did not return trader capability state.";
      throw new Error(
        `Phoenix delegated capabilities could not be verified after ${maxAttempts} attempts.${detail}`,
      );
    } catch (error) {
      if (error instanceof PhoenixOnboardingError) {
        throw error;
      }
      throw new PhoenixOnboardingError(
        `Phoenix ${phase} failed: ${errorMessage(error)}`,
        {
          phase,
          traderPda,
          registrationSignature,
          activationSignature,
          cause: error,
        },
      );
    }
  }

  /**
   * Settles funding for the vault's trader and may evict it from the active
   * buffer when no resting orders remain. Idempotent housekeeping call.
   */
  async updateTraderState(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.updateTraderStateTx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Full deposit flow in one transaction: converts USDC to canonical
   * collateral via Ember, then deposits the canonical amount into the vault's
   * Phoenix trader account.
   */
  async deposit(amount: BN | number, txOptions: TxOptions = {}) {
    const tx = await this.txBuilder.deposit(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Full withdraw flow in one transaction: withdraws canonical collateral
   * from Phoenix and converts it back to USDC via Ember.
   */
  async withdraw(amount: BN | number, txOptions: TxOptions = {}) {
    const tx = await this.txBuilder.withdraw(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Phoenix-only `deposit_funds` (no Ember leg) — moves an already-canonical
   * token balance from the vault's token account into Phoenix.
   */
  async depositFunds(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositFundsTx(params, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Phoenix-only `withdraw_funds` (no Ember leg) — pulls canonical collateral
   * out of Phoenix back to the vault's token account.
   */
  async withdrawFunds(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawFundsTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Places a Phoenix limit order against the market in `accounts`. */
  async placeLimitOrder(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.placeLimitOrderTx(
      packet,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Places an immediate-or-cancel market order against the market. */
  async placeMarketOrder(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.placeMarketOrderTx(
      packet,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Cancels all resting orders the vault has on the given market. */
  async cancelAll(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelAllTx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /** Cancels the specific resting orders identified by `orderIds`. */
  async cancelOrdersById(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelOrdersByIdTx(
      orderIds,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Cancels up to `num_orders_to_cancel` resting orders on a side, optionally
   * bounded by a price tick limit.
   */
  async cancelUpTo(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelUpToTx(args, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
