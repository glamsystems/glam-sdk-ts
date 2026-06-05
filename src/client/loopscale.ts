import { BN } from "@coral-xyz/anchor";
import {
  AccountInfo as Web3AccountInfo,
  Commitment,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction,
  AccountMeta,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { mapToGlamIx } from "@glamsystems/ix-mapper";

import {
  BaseClient,
  BaseTxBuilder,
  TxOptions,
  type ProtocolPolicyClient,
  type ProtocolPolicyTxBuilder,
} from "./base";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import {
  LOOPSCALE_PROGRAM_ID,
  LOOPSCALE_PROTOCOL_ADMIN_STATE,
} from "../constants";
import { LOOPSCALE_PROTOCOL } from "../protocols";
import { U64_MAX_BN, bnToSafeNumber, toBn } from "../utils/common";
import { PkMap } from "../utils/pkmap";
import { PkSet } from "../utils/pkset";
import {
  LOOPSCALE_LOAN_DISCRIMINATOR,
  LOOPSCALE_STRATEGY_ACCOUNT_DISCRIMINATOR,
  LoopscaleLoan,
  LoopscaleMarketInformation,
  LoopscaleStrategy,
  hasLoopscaleLoanDiscriminator,
  hasLoopscaleStrategyDiscriminator,
} from "../deser";
import { LoopscalePolicy } from "../deser/integrationPolicies";

export const LOOPSCALE_BS_AUTH = new PublicKey(
  "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs",
);

const GLAM_SIGNER = new PublicKey(
  "GLJLYvowLHgssoKNNr9pEcBHgACCiby73Q8aF1W9ksTG",
);
const LOOPSCALE_API_URL = "https://tars.loopscale.com/v1";
const LOOPSCALE_MPC_TRANSACTION_TYPE = 1; // Versioned transaction
export const LOOPSCALE_STRATEGY_DISCRIMINATOR =
  LOOPSCALE_STRATEGY_ACCOUNT_DISCRIMINATOR;
const LOOPSCALE_CREATE_LOAN_DISCRIMINATOR = Buffer.from([
  166, 131, 118, 219, 138, 218, 206, 140,
]);
const LOOPSCALE_LOCK_LOAN_DISCRIMINATOR = Buffer.from([
  28, 101, 52, 240, 146, 230, 95, 22,
]);
const LOOPSCALE_UNLOCK_LOAN_DISCRIMINATOR = Buffer.from([
  121, 226, 178, 98, 215, 209, 240, 38,
]);
const LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR = Buffer.from([
  156, 131, 142, 116, 146, 247, 162, 120,
]);
const LOOPSCALE_BORROW_PRINCIPAL_DISCRIMINATOR = Buffer.from([
  106, 10, 38, 204, 139, 188, 124, 50,
]);
const LOOPSCALE_REPAY_PRINCIPAL_DISCRIMINATOR = Buffer.from([
  229, 67, 83, 65, 77, 84, 80, 141,
]);
const LOOPSCALE_WITHDRAW_COLLATERAL_DISCRIMINATOR = Buffer.from([
  115, 135, 168, 106, 139, 214, 138, 150,
]);
const LOOPSCALE_DEPOSIT_STRATEGY_DISCRIMINATOR = Buffer.from([
  246, 82, 57, 226, 131, 222, 253, 249,
]);
const LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR = Buffer.from([
  16, 76, 138, 179, 171, 112, 196, 21,
]);
const LOOPSCALE_WITHDRAW_STRATEGY_DISCRIMINATOR = Buffer.from([
  31, 45, 162, 5, 193, 217, 134, 188,
]);
const LOOPSCALE_CLOSE_STRATEGY_DISCRIMINATOR = Buffer.from([
  56, 247, 170, 246, 89, 221, 134, 200,
]);
const LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT = 12;
const MARKET_INFORMATION_DISCRIMINATOR = Buffer.from([
  194, 154, 190, 99, 64, 111, 37, 205,
]);
const LOOPSCALE_STRATEGY_DURATION_BY_INDEX = [
  { durationType: 0, duration: 1 }, // 0: 1 day
  { durationType: 1, duration: 1 }, // 1: 1 week
  { durationType: 2, duration: 1 }, // 2: 1 month
  { durationType: 2, duration: 3 }, // 3: 3 months
  { durationType: 4, duration: 1 }, // 4: 1 year
];

type Tuple5 = [number, number, number, number, number];

export type LoopscaleQuote = {
  apy: number;
  strategy: string;
  collateralIdentifier: string;
  ltv: number; // Maximum initial loan to value in 1/100th of a basis point
  lqt: number; // Liquidation loan to value in 1/100th of a basis point
  amount: number; // Max amount that can be borrowed
};

export type LoopscaleMaxQuoteParams = {
  principalMint: PublicKey;
  collateralMint: PublicKey;
  collateralAmount: BN;
  durationType: number;
  duration: number;
  borrowAmount?: BN;
  externalYieldSource?: number;
};

export type LoopscaleMappedTransaction = {
  ixs: TransactionInstruction[];
  additionalSigners: Keypair[];
};

export type LoopscaleApiCollateralTermUpdate = {
  addCollateral?: Record<string, { durationsAndApys: Record<string, string> }>;
  updateCollateral?: Record<string, { apyUpdate: Record<string, string> }>;
};

export type LoopscaleApiUpdateStrategyParams = {
  originationsEnabled?: boolean;
  liquidityBuffer?: number;
  interestFee?: number;
  originationFee?: number;
  principalFee?: number;
  originationCap?: number;
  externalYieldSource?: {
    newExternalYieldSource: number;
  };
};

type LoopscaleApiTransaction = {
  message?: string;
  signatures?: unknown[];
};

type LoopscaleApiTransactionResponse = LoopscaleApiTransaction & {
  transaction?: LoopscaleApiTransaction;
  transactions?: LoopscaleApiTransaction[];
  loanAddress?: string;
};

type LoopscaleApiTransactionPayload =
  | LoopscaleApiTransactionResponse
  | LoopscaleApiTransactionResponse[];

/**
 * Account inputs for a Loopscale borrow that are derived from on-chain market
 * and strategy state (see {@link LoopscaleClient.resolveBorrowMarketAccounts}).
 */
export type BorrowMarketAccounts = {
  marketInformation: PublicKey;
  principalMint: PublicKey;
  durationIndex: number;
  assetIndexGuidance: Buffer;
};

export type LoopscaleBorrowPrincipalTerms = {
  strategy: PublicKey;
  expectedLoanValues: LoopscaleExpectedLoanValues;
  assetIndexGuidance: Buffer;
  durationIndex: number;
};

export type LoopscaleBorrowQuoteTerms = LoopscaleBorrowPrincipalTerms & {
  quote: LoopscaleQuote;
};

export type LoopscaleStrategyWithMarket = {
  strategy: LoopscaleStrategy;
  marketInfo: LoopscaleMarketInformation;
};

type LoopscaleMpcSendTransaction = {
  transaction?: string; // Base64-encoded, MPC co-signed transaction
  signature?: string;
  identifier?: string;
  error?: unknown;
  logs?: unknown;
  signers?: string[];
};

type LoopscaleMpcSendResponse = {
  batches?: { transactions?: LoopscaleMpcSendTransaction[] }[];
};

function isSkippableLoopscaleLoanLockIx(data: Buffer): boolean {
  const discriminator = data.subarray(
    0,
    LOOPSCALE_LOCK_LOAN_DISCRIMINATOR.length,
  );
  return (
    discriminator.equals(LOOPSCALE_LOCK_LOAN_DISCRIMINATOR) ||
    discriminator.equals(LOOPSCALE_UNLOCK_LOAN_DISCRIMINATOR)
  );
}

function getLoopscaleApiMessages(
  response: LoopscaleApiTransactionPayload,
): string[] {
  if (Array.isArray(response)) {
    return response.flatMap((transaction) =>
      getLoopscaleApiMessages(transaction),
    );
  }

  const messages: string[] = [];
  if (response.message) {
    messages.push(response.message);
  }
  if (response.transaction?.message) {
    messages.push(response.transaction.message);
  }
  for (const transaction of response.transactions ?? []) {
    if (transaction.message) {
      messages.push(transaction.message);
    }
  }
  return messages;
}

/**
 * Replaces signer-only setup accounts that Loopscale's API may include after
 * the standard accounts.
 *
 * Those API-provided signer pubkeys are not available to the GLAM caller. The
 * remapped ext_loopscale instruction only needs them to satisfy account signer
 * constraints for the generated setup path, so the SDK substitutes fresh local
 * keypairs and returns them for the caller to sign the transaction with.
 *
 * FIXME: When do we need to do this? Need a way to determine this dynamically.
 */
function replaceLoopscaleApiExtraSigners(
  ix: TransactionInstruction,
  standardAccountCount: number,
): LoopscaleMappedTransaction {
  const signerPubkeys = [
    ...new Map(
      ix.keys
        .slice(standardAccountCount)
        .filter((account) => account.isSigner)
        .map((account) => [account.pubkey.toBase58(), account.pubkey]),
    ).values(),
  ];
  const replacementSigners = signerPubkeys.map((pubkey) => ({
    original: pubkey,
    signer: Keypair.generate(),
  }));
  const replacementByOriginal = new PkMap<PublicKey>(
    replacementSigners.map(({ original, signer }) => [
      original,
      signer.publicKey,
    ]),
  );

  return {
    ixs: [
      new TransactionInstruction({
        programId: ix.programId,
        data: ix.data,
        keys: ix.keys.map((account) => ({
          pubkey: replacementByOriginal.get(account.pubkey) ?? account.pubkey,
          isSigner: account.isSigner,
          isWritable: account.isWritable,
        })),
      }),
    ],
    additionalSigners: replacementSigners.map(({ signer }) => signer),
  };
}

function loopscaleStrategyDurationKey(durationIndex: number): string {
  const duration = LOOPSCALE_STRATEGY_DURATION_BY_INDEX[durationIndex];
  if (!duration) {
    throw new Error(
      `No Loopscale API duration mapping for strategy duration index ${durationIndex}`,
    );
  }
  return JSON.stringify(duration);
}

export function buildLoopscaleApiCollateralTermUpdates(
  strategy: LoopscaleStrategy,
  marketInfo: LoopscaleMarketInformation,
  collateralTerms: LoopscaleMultiCollateralTermsUpdateParams[],
): LoopscaleApiCollateralTermUpdate | undefined {
  if (collateralTerms.length === 0) {
    return undefined;
  }

  const update: LoopscaleApiCollateralTermUpdate = {};
  for (const term of collateralTerms) {
    const apy = term.apy.toString();
    for (const { collateralIndex, durationIndex } of term.indices) {
      const assetInfo = marketInfo.assetData[collateralIndex];
      if (!assetInfo) {
        throw new Error(
          `Invalid Loopscale market collateral index ${collateralIndex}`,
        );
      }
      const assetIdentifier = assetInfo.assetIdentifier.toBase58();
      const durationKey = loopscaleStrategyDurationKey(durationIndex);
      const existingTerms = strategy.collateralMap[collateralIndex] ?? [];
      const hasExistingTerm = existingTerms.some((existingApy) =>
        existingApy.lt(U64_MAX_BN),
      );

      if (hasExistingTerm) {
        const collateralUpdate = (update.updateCollateral ??= {})[
          assetIdentifier
        ] ?? {
          apyUpdate: {},
        };
        collateralUpdate.apyUpdate[durationKey] = apy;
        update.updateCollateral[assetIdentifier] = collateralUpdate;
      } else {
        const collateralAdd = (update.addCollateral ??= {})[
          assetIdentifier
        ] ?? {
          durationsAndApys: {},
        };
        collateralAdd.durationsAndApys[durationKey] = apy;
        update.addCollateral[assetIdentifier] = collateralAdd;
      }
    }
  }

  return update;
}

export type LoopscaleExpectedLoanValues = {
  expectedApy: BN;
  expectedLqt: [number, number, number, number, number];
};

export type LoopscaleExternalYieldSourceArgs = {
  newExternalYieldSource: number;
  externalYieldVault: PublicKey;
};

export type CreateLoanParams = {
  nonce: BN;
};

export type CreateStrategyParams = {
  lender: PublicKey;
  originationCap: BN;
  liquidityBuffer: BN;
  interestFee: BN;
  originationFee: BN;
  principalFee: BN;
  originationsEnabled: boolean;
  externalYieldSourceArgs: LoopscaleExternalYieldSourceArgs | null;
};

export type LoopscaleCollateralTermsIndices = {
  collateralIndex: number;
  durationIndex: number;
};

export type LoopscaleMultiCollateralTermsUpdateParams = {
  apy: BN;
  indices: LoopscaleCollateralTermsIndices[];
};

export type UpdateStrategyParams = {
  originationsEnabled?: boolean | null;
  liquidityBuffer?: BN | null;
  interestFee?: BN | null;
  originationFee?: BN | null;
  principalFee?: BN | null;
  originationCap?: BN | null;
  marketInformation?: PublicKey | null;
  externalYieldSourceArgs?: LoopscaleExternalYieldSourceArgs | null;
};

export type DepositCollateralParams = {
  amount: BN;
  assetType: number;
  assetIdentifier: PublicKey;
  assetIndexGuidance: Buffer;
};

export type UpdateWeightMatrixParams = {
  collateralIndex: number;
  weightMatrix: [number, number, number, number, number];
  expectedLoanValues: LoopscaleExpectedLoanValues;
  assetIndexGuidance: Buffer;
};

export type BorrowPrincipalParams = {
  amount: BN;
  assetIndexGuidance: Buffer;
  duration: number;
  expectedLoanValues: LoopscaleExpectedLoanValues;
  skipSolUnwrap: boolean;
};

export type CreateLoanAccounts = {
  loan: PublicKey;
};

export type CloseLoanAccounts = {
  loan: PublicKey;
};

export type CreateStrategyAccounts = {
  nonce: PublicKey;
  strategy: PublicKey;
  marketInformation: PublicKey;
  principalMint: PublicKey;
};

export type DepositStrategyAccounts = {
  strategy: PublicKey;
  principalMint: PublicKey;
  marketInformation: PublicKey;
  lenderTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type UpdateStrategyAccounts = {
  strategy: PublicKey;
  principalMint: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type WithdrawStrategyAccounts = {
  strategy: PublicKey;
  principalMint: PublicKey;
  marketInformation: PublicKey;
  lenderTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type CloseStrategyAccounts = {
  strategy: PublicKey;
  principalMint: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type DepositCollateralAccounts = {
  loan: PublicKey;
  depositMint: PublicKey;
  borrowerCollateralTa?: PublicKey;
  loanCollateralTa?: PublicKey;
  assetIdentifier?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type UpdateWeightMatrixAccounts = {
  loan: PublicKey;
};

export type BorrowPrincipalAccounts = {
  loan: PublicKey;
  strategy: PublicKey;
  marketInformation: PublicKey;
  principalMint: PublicKey;
  borrowerTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type WithdrawCollateralParams = {
  amount: BN;
  collateralIndex: number;
  assetIndexGuidance: Buffer;
  expectedLoanValues: LoopscaleExpectedLoanValues;
  closeIfEligible: boolean;
  withdrawAll: boolean;
};

export type WithdrawCollateralAccounts = {
  loan: PublicKey;
  assetMint: PublicKey;
  borrowerTa?: PublicKey;
  loanTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type RepayPrincipalParams = {
  amount: BN;
  ledgerIndex: number;
  repayAll: boolean;
};

export type RepayPrincipalAccounts = {
  loan: PublicKey;
  strategy: PublicKey;
  marketInformation: PublicKey;
  principalMint: PublicKey;
  borrowerTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export function getLoopscaleEventAuthorityPda(
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  )[0];
}

export function getLoopscaleLoanPda(
  borrower: PublicKey,
  nonce: BN | bigint | number,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [borrower.toBuffer(), toBn(nonce).toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function getLoopscaleStrategyPda(
  nonce: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("strategy"), nonce.toBuffer()],
    programId,
  )[0];
}

export type PriceLoansAccounts = {
  loanAccounts: PublicKey[];
  oracleAccounts: PublicKey[];
  solUsdOracle?: PublicKey;
  baseAssetOracle?: PublicKey;
  glamConfig?: PublicKey;
};

export type PriceStrategiesAccounts = {
  strategyAccounts: PublicKey[];
  oracleAccounts: PublicKey[];
  solUsdOracle?: PublicKey;
  baseAssetOracle?: PublicKey;
  glamConfig?: PublicKey;
};

const LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET = 42;
const LOOPSCALE_STRATEGY_MIN_DATA_LEN = 220;
const LOOPSCALE_LOAN_LEDGER_SECTION_OFFSET = 1 + 1 + 1 + 32 + 8 + 8;
const LOOPSCALE_LOAN_LEDGER_COUNT = 5;
const LOOPSCALE_LOAN_LEDGER_SIZE = 182;
const LOOPSCALE_LOAN_LEDGER_PRINCIPAL_MINT_OFFSET = 1 + 32;
const LOOPSCALE_LOAN_COLLATERAL_COUNT = 5;
const LOOPSCALE_LOAN_COLLATERAL_SIZE = 73;
const LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET =
  1 +
  1 +
  1 +
  32 +
  8 +
  8 +
  LOOPSCALE_LOAN_LEDGER_COUNT * LOOPSCALE_LOAN_LEDGER_SIZE;
const LOOPSCALE_LOAN_COLLATERAL_AMOUNT_OFFSET = 32;
const LOOPSCALE_LOAN_MIN_DATA_LEN =
  LOOPSCALE_LOAN_DISCRIMINATOR.length +
  LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET +
  LOOPSCALE_LOAN_COLLATERAL_COUNT * LOOPSCALE_LOAN_COLLATERAL_SIZE;

function isLoopscaleLoanAccountInfo(
  info: Web3AccountInfo<Buffer> | null,
): info is Web3AccountInfo<Buffer> {
  return !!(
    info &&
    typeof info.owner?.equals === "function" &&
    info.owner.equals(LOOPSCALE_PROGRAM_ID) &&
    info.data.length >= LOOPSCALE_LOAN_MIN_DATA_LEN &&
    hasLoopscaleLoanDiscriminator(info.data)
  );
}

export function isLoopscaleStrategyAccountInfo(
  info: Web3AccountInfo<Buffer> | null,
): info is Web3AccountInfo<Buffer> {
  return !!(
    info &&
    typeof info.owner?.equals === "function" &&
    info.owner.equals(LOOPSCALE_PROGRAM_ID) &&
    info.data.length >= LOOPSCALE_STRATEGY_MIN_DATA_LEN &&
    hasLoopscaleStrategyDiscriminator(info.data)
  );
}

export function readLoopscaleStrategyPrincipalMint(data: Buffer): PublicKey {
  return new PublicKey(
    data.subarray(
      LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET,
      LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET + 32,
    ),
  );
}

function readLoopscaleOracleMints(data: Buffer): PublicKey[] {
  const body = data.subarray(LOOPSCALE_LOAN_DISCRIMINATOR.length);
  const mints = new PkSet();

  for (let i = 0; i < LOOPSCALE_LOAN_LEDGER_COUNT; i++) {
    const offset =
      LOOPSCALE_LOAN_LEDGER_SECTION_OFFSET + i * LOOPSCALE_LOAN_LEDGER_SIZE;
    const principalMint = new PublicKey(
      body.subarray(
        LOOPSCALE_LOAN_LEDGER_PRINCIPAL_MINT_OFFSET + offset,
        LOOPSCALE_LOAN_LEDGER_PRINCIPAL_MINT_OFFSET + offset + 32,
      ),
    );
    if (!principalMint.equals(PublicKey.default)) {
      mints.add(principalMint);
    }
  }

  for (let i = 0; i < LOOPSCALE_LOAN_COLLATERAL_COUNT; i++) {
    const offset =
      LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET +
      i * LOOPSCALE_LOAN_COLLATERAL_SIZE;
    const amount = body.readBigUInt64LE(
      offset + LOOPSCALE_LOAN_COLLATERAL_AMOUNT_OFFSET,
    );
    if (amount === 0n) {
      continue;
    }

    const collateralMint = new PublicKey(body.subarray(offset, offset + 32));
    if (!collateralMint.equals(PublicKey.default)) {
      mints.add(collateralMint);
    }
  }

  return Array.from(mints);
}

class TxBuilder
  extends BaseTxBuilder<LoopscaleClient>
  implements ProtocolPolicyTxBuilder<LoopscalePolicy>
{
  async setPolicyIx(
    policy: LoopscalePolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .setLoopscalePolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: LoopscalePolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.programId,
      LOOPSCALE_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.programId,
      LOOPSCALE_PROTOCOL,
      txOptions,
    );
  }

  async createLoanIx(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .createLoan({ nonce: params.nonce })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async createLoanTx(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.createLoanIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async closeLoanIx(
    accounts: CloseLoanAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .closeLoan()
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async closeLoanTx(
    accounts: CloseLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closeLoanIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async createStrategyIx(
    params: CreateStrategyParams,
    accounts: CreateStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .createStrategy({
        lender: params.lender,
        originationCap: params.originationCap,
        liquidityBuffer: params.liquidityBuffer,
        interestFee: params.interestFee,
        originationFee: params.originationFee,
        principalFee: params.principalFee,
        originationsEnabled: params.originationsEnabled,
        externalYieldSourceArgs: params.externalYieldSourceArgs,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        nonce: accounts.nonce,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        principalMint: accounts.principalMint,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async depositStrategyIx(
    amount: BN,
    accounts: DepositStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    return await this.client.base.extLoopscaleProgram.methods
      .depositStrategy(amount)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        strategy: accounts.strategy,
        principalMint: accounts.principalMint,
        marketInformation: accounts.marketInformation,
        lenderTa:
          accounts.lenderTa ||
          this.client.base.getVaultAta(accounts.principalMint, tokenProgram),
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
            tokenProgram,
          ),
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async depositStrategyTx(
    amount: BN,
    accounts: DepositStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.depositStrategyIx(amount, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async updateStrategyIx(
    collateralTerms: LoopscaleMultiCollateralTermsUpdateParams[],
    params: UpdateStrategyParams | null,
    accounts: UpdateStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const normalizedParams = params
      ? {
          originationsEnabled: params.originationsEnabled ?? null,
          liquidityBuffer: params.liquidityBuffer ?? null,
          interestFee: params.interestFee ?? null,
          originationFee: params.originationFee ?? null,
          principalFee: params.principalFee ?? null,
          originationCap: params.originationCap ?? null,
          marketInformation: params.marketInformation ?? null,
          externalYieldSourceArgs: params.externalYieldSourceArgs ?? null,
        }
      : null;

    const instruction = this.client.base.extLoopscaleProgram.methods
      .updateStrategy(collateralTerms, normalizedParams)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        strategy: accounts.strategy,
        principalMint: accounts.principalMint,
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
            tokenProgram,
          ),
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async updateStrategyTx(
    collateralTerms: LoopscaleMultiCollateralTermsUpdateParams[],
    params: UpdateStrategyParams | null,
    accounts: UpdateStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateStrategyIx(
      collateralTerms,
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async withdrawStrategyIx(
    amount: BN,
    withdrawAll: boolean,
    accounts: WithdrawStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    return await this.client.base.extLoopscaleProgram.methods
      .withdrawStrategy(amount, withdrawAll)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        strategy: accounts.strategy,
        principalMint: accounts.principalMint,
        marketInformation: accounts.marketInformation,
        lenderTa:
          accounts.lenderTa ||
          this.client.base.getVaultAta(accounts.principalMint, tokenProgram),
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
            tokenProgram,
          ),
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async withdrawStrategyTx(
    amount: BN,
    withdrawAll: boolean,
    accounts: WithdrawStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.withdrawStrategyIx(
      amount,
      withdrawAll,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async closeStrategyIx(
    accounts: CloseStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    return await this.client.base.extLoopscaleProgram.methods
      .closeStrategy()
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        strategy: accounts.strategy,
        principalMint: accounts.principalMint,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async closeStrategyTx(
    accounts: CloseStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closeStrategyIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async depositCollateralIx(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;

    return await this.client.base.extLoopscaleProgram.methods
      .depositCollateral({
        amount: params.amount,
        assetType: params.assetType,
        assetIdentifier: params.assetIdentifier,
        assetIndexGuidance: params.assetIndexGuidance,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        borrowerCollateralTa:
          accounts.borrowerCollateralTa ||
          this.client.base.getVaultAta(accounts.depositMint, tokenProgram),
        loanCollateralTa:
          accounts.loanCollateralTa ||
          this.client.getLoanTokenAta(accounts.loan, accounts.depositMint),
        depositMint: accounts.depositMint,
        assetIdentifier: accounts.assetIdentifier || accounts.depositMint,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async depositCollateralTx(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.depositCollateralIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async updateWeightMatrixIx(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .updateWeightMatrix({
        collateralIndex: params.collateralIndex,
        weightMatrix: params.weightMatrix,
        expectedLoanValues: params.expectedLoanValues,
        assetIndexGuidance: params.assetIndexGuidance,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
      })
      .instruction();
  }

  async updateWeightMatrixTx(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateWeightMatrixIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async borrowPrincipalIx(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const instruction = this.client.base.extLoopscaleProgram.methods
      .borrowPrincipal({
        amount: params.amount,
        assetIndexGuidance: params.assetIndexGuidance,
        duration: params.duration,
        expectedLoanValues: params.expectedLoanValues,
        skipSolUnwrap: params.skipSolUnwrap,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        principalMint: accounts.principalMint,
        borrowerTa:
          accounts.borrowerTa ||
          this.client.base.getVaultAta(accounts.principalMint, tokenProgram),
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
          ),
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async borrowPrincipalTx(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.borrowPrincipalIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async withdrawCollateralIx(
    params: WithdrawCollateralParams,
    accounts: WithdrawCollateralAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const instruction = this.client.base.extLoopscaleProgram.methods
      .withdrawCollateral({
        amount: params.amount,
        collateralIndex: params.collateralIndex,
        assetIndexGuidance: params.assetIndexGuidance,
        expectedLoanValues: params.expectedLoanValues,
        closeIfEligible: params.closeIfEligible,
        withdrawAll: params.withdrawAll,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        borrowerTa:
          accounts.borrowerTa ||
          this.client.base.getVaultAta(accounts.assetMint, tokenProgram),
        loanTa:
          accounts.loanTa ||
          this.client.getLoanTokenAta(accounts.loan, accounts.assetMint),
        assetMint: accounts.assetMint,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async withdrawCollateralTx(
    params: WithdrawCollateralParams,
    accounts: WithdrawCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.withdrawCollateralIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async repayPrincipalIx(
    params: RepayPrincipalParams,
    accounts: RepayPrincipalAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const instruction = this.client.base.extLoopscaleProgram.methods
      .repayPrincipal({
        amount: params.amount,
        ledgerIndex: params.ledgerIndex,
        repayAll: params.repayAll,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        principalMint: accounts.principalMint,
        borrowerTa:
          accounts.borrowerTa ||
          this.client.base.getVaultAta(accounts.principalMint, tokenProgram),
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
          ),
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async repayPrincipalTx(
    params: RepayPrincipalParams,
    accounts: RepayPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.repayPrincipalIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class LoopscaleClient implements ProtocolPolicyClient<LoopscalePolicy> {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  get programId(): PublicKey {
    return this.base.extLoopscaleProgram.programId;
  }

  get integrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.programId);
  }

  async fetchPolicy(): Promise<LoopscalePolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      LOOPSCALE_PROTOCOL,
      LoopscalePolicy,
    );
  }

  async setPolicy(
    policy: LoopscalePolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  getEventAuthorityPda(): PublicKey {
    return getLoopscaleEventAuthorityPda();
  }

  getLoanPda(
    nonce: BN | bigint | number,
    borrower: PublicKey = this.base.vaultPda,
  ) {
    return getLoopscaleLoanPda(borrower, nonce);
  }

  getStrategyPda(nonce: PublicKey) {
    return getLoopscaleStrategyPda(nonce);
  }

  getLoanTokenAta(
    loan: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(mint, loan, true, tokenProgram);
  }

  getStrategyTokenAta(
    strategy: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(mint, strategy, true, tokenProgram);
  }

  async fetchLoan(loan: PublicKey): Promise<LoopscaleLoan> {
    const account = await this.base.connection.getAccountInfo(loan);
    if (!account) {
      throw new Error(`Loopscale loan account not found: ${loan}`);
    }
    if (!account.owner.equals(LOOPSCALE_PROGRAM_ID)) {
      throw new Error(
        `Loopscale loan ${loan} is owned by ${account.owner}, expected ${LOOPSCALE_PROGRAM_ID}`,
      );
    }
    if (!hasLoopscaleLoanDiscriminator(account.data)) {
      throw new Error(`Account is not a Loopscale Loan: ${loan}`);
    }

    return LoopscaleLoan.decode(loan, account.data);
  }

  async fetchOwnedLoan(
    loan: PublicKey,
    borrower: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleLoan> {
    const loanAccount = await this.fetchLoan(loan);
    if (!loanAccount.borrower.equals(borrower)) {
      throw new Error(
        `Loopscale loan ${loan} borrower ${loanAccount.borrower} does not match expected borrower ${borrower}`,
      );
    }

    return loanAccount;
  }

  async fetchRegisteredLoans(
    commitment?: Commitment,
  ): Promise<LoopscaleLoan[]> {
    return this.fetchRegisteredExternalPositions(
      hasLoopscaleLoanDiscriminator,
      (address, data) => LoopscaleLoan.decode(address, data),
      commitment,
    );
  }

  async fetchRegisteredStrategies(
    commitment?: Commitment,
  ): Promise<LoopscaleStrategy[]> {
    return this.fetchRegisteredExternalPositions(
      hasLoopscaleStrategyDiscriminator,
      (address, data) => LoopscaleStrategy.decode(address, data),
      commitment,
    );
  }

  private async fetchRegisteredExternalPositions<T>(
    hasExpectedDiscriminator: (data: Buffer) => boolean,
    decode: (address: PublicKey, data: Buffer) => T,
    commitment?: Commitment,
  ): Promise<T[]> {
    const { externalPositions } = await this.base.fetchStateAccount();
    const registeredPositions = externalPositions ?? [];
    const positions: T[] = [];
    const chunkSize = 100;

    for (let i = 0; i < registeredPositions.length; i += chunkSize) {
      const chunk = registeredPositions.slice(i, i + chunkSize);
      const accounts = await this.base.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accounts.forEach((account, index) => {
        if (
          !account ||
          !account.owner.equals(LOOPSCALE_PROGRAM_ID) ||
          !hasExpectedDiscriminator(account.data)
        ) {
          return;
        }
        positions.push(decode(chunk[index], account.data));
      });
    }

    return positions;
  }

  async fetchStrategy(strategy: PublicKey): Promise<LoopscaleStrategy> {
    const account = await this.base.connection.getAccountInfo(strategy);
    if (!account) {
      throw new Error(`Loopscale strategy account not found: ${strategy}`);
    }
    if (!account.owner.equals(LOOPSCALE_PROGRAM_ID)) {
      throw new Error(
        `Loopscale strategy ${strategy} is owned by ${account.owner}, expected ${LOOPSCALE_PROGRAM_ID}`,
      );
    }
    if (!hasLoopscaleStrategyDiscriminator(account.data)) {
      throw new Error(`Account is not a Loopscale Strategy: ${strategy}`);
    }
    const strategyInfo = LoopscaleStrategy.decode(strategy, account.data);

    return strategyInfo;
  }

  async fetchOwnedStrategy(
    strategy: PublicKey,
    lender: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleStrategy> {
    const strategyInfo = await this.fetchStrategy(strategy);
    if (!strategyInfo.lender.equals(lender)) {
      throw new Error(
        `Loopscale strategy ${strategy} lender ${strategyInfo.lender} does not match expected lender ${lender}`,
      );
    }

    return strategyInfo;
  }

  async fetchStrategyMarket(
    strategy: PublicKey | LoopscaleStrategy,
  ): Promise<LoopscaleMarketInformation> {
    const strategyInfo =
      strategy instanceof PublicKey
        ? await this.fetchStrategy(strategy)
        : strategy;
    const marketInfo = await this.fetchMarketInformation(
      strategyInfo.marketInformation,
    );
    if (!marketInfo.principalMint.equals(strategyInfo.principalMint)) {
      throw new Error(
        `Market principal mint ${marketInfo.principalMint} does not match strategy principal mint ${strategyInfo.principalMint}`,
      );
    }

    return marketInfo;
  }

  async fetchOwnedStrategyWithMarket(
    strategy: PublicKey,
    lender: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleStrategyWithMarket> {
    const strategyInfo = await this.fetchOwnedStrategy(strategy, lender);
    return {
      strategy: strategyInfo,
      marketInfo: await this.fetchStrategyMarket(strategyInfo),
    };
  }

  assertStrategyClosable(strategy: LoopscaleStrategy): void {
    const address = strategy.getAddress();
    if (!strategy.tokenBalance.isZero()) {
      throw new Error(
        `Strategy ${address} still has token balance ${strategy.tokenBalance}; withdraw principal before closing.`,
      );
    }
    if (!strategy.currentDeployedAmount.isZero()) {
      throw new Error(
        `Strategy ${address} still has deployed principal ${strategy.currentDeployedAmount}; wait for borrowers to repay or sell ledgers before closing.`,
      );
    }
    if (!strategy.externalYieldAmount.isZero()) {
      throw new Error(
        `Strategy ${address} still has external yield amount ${strategy.externalYieldAmount}; withdraw external yield before closing.`,
      );
    }
    if (!strategy.outstandingInterestAmount.isZero()) {
      throw new Error(
        `Strategy ${address} still has outstanding interest ${strategy.outstandingInterestAmount}; cannot close.`,
      );
    }
    if (!strategy.feeClaimable.isZero()) {
      throw new Error(
        `Strategy ${address} still has claimable fees ${strategy.feeClaimable}; cannot close.`,
      );
    }
    if (!strategy.activeLoanCount.isZero()) {
      throw new Error(
        `Strategy ${address} still has ${strategy.activeLoanCount} active loan(s); cannot close.`,
      );
    }
  }

  /** Fetches, validates, and decodes a Loopscale MarketInformation account. */
  async fetchMarketInformation(
    marketInformation: PublicKey,
  ): Promise<LoopscaleMarketInformation> {
    const account =
      await this.base.connection.getAccountInfo(marketInformation);
    if (!account) {
      throw new Error(
        `Loopscale market information account not found: ${marketInformation}`,
      );
    }
    if (!account.owner.equals(LOOPSCALE_PROGRAM_ID)) {
      throw new Error(
        `Loopscale market information ${marketInformation} is owned by ${account.owner}, expected ${LOOPSCALE_PROGRAM_ID}`,
      );
    }
    if (!account.data.subarray(0, 8).equals(MARKET_INFORMATION_DISCRIMINATOR)) {
      throw new Error(
        `Account is not Loopscale MarketInformation: ${marketInformation}`,
      );
    }
    return LoopscaleMarketInformation.decode(marketInformation, account.data);
  }

  /**
   * Resolves the market-derived account inputs for a borrow: the asset index
   * guidance and the strategy duration index that matches the quoted APY.
   */
  async resolveBorrowMarketAccounts(params: {
    strategy: PublicKey | LoopscaleStrategy;
    collateralMint: PublicKey;
    expectedApy: BN;
  }): Promise<BorrowMarketAccounts> {
    const strategyInfo =
      params.strategy instanceof PublicKey
        ? await this.fetchStrategy(params.strategy)
        : params.strategy;
    const marketInfo = await this.fetchMarketInformation(
      strategyInfo.marketInformation,
    );
    if (!marketInfo.principalMint.equals(strategyInfo.principalMint)) {
      throw new Error(
        `Market principal mint ${marketInfo.principalMint} does not match strategy principal mint ${strategyInfo.principalMint}`,
      );
    }

    const collateralAssetIndex = this.requireAssetIndex(
      marketInfo,
      params.collateralMint,
      "collateral asset identifier",
    );
    const principalAssetIndex = this.requireAssetIndex(
      marketInfo,
      strategyInfo.principalMint,
      "principal mint",
    );
    const durationIndex = this.requireDurationIndex(
      strategyInfo,
      collateralAssetIndex,
      params.expectedApy,
    );

    return {
      marketInformation: strategyInfo.marketInformation,
      principalMint: strategyInfo.principalMint,
      durationIndex,
      assetIndexGuidance: Buffer.from([
        collateralAssetIndex,
        principalAssetIndex,
        collateralAssetIndex,
      ]),
    };
  }

  /**
   * Resolves borrow terms for a known strategy and expected loan values, without
   * consulting the quote API.
   */
  async resolveBorrowTermsFromStrategy(params: {
    strategy: PublicKey | LoopscaleStrategy;
    principalMint: PublicKey;
    assetIdentifier: PublicKey;
    expectedApy: BN;
    expectedLqt: [number, number, number, number, number];
  }): Promise<LoopscaleBorrowPrincipalTerms> {
    const strategyInfo =
      params.strategy instanceof PublicKey
        ? await this.fetchStrategy(params.strategy)
        : params.strategy;
    const strategy =
      params.strategy instanceof PublicKey
        ? params.strategy
        : strategyInfo.getAddress();

    if (!strategyInfo.principalMint.equals(params.principalMint)) {
      throw new Error(
        `Selected strategy principal mint ${strategyInfo.principalMint} does not match requested principal mint ${params.principalMint}`,
      );
    }

    const { assetIndexGuidance, durationIndex } =
      await this.resolveBorrowMarketAccounts({
        strategy: strategyInfo,
        collateralMint: params.assetIdentifier,
        expectedApy: params.expectedApy,
      });

    return {
      strategy,
      expectedLoanValues: {
        expectedApy: params.expectedApy,
        expectedLqt: params.expectedLqt,
      },
      assetIndexGuidance,
      durationIndex,
    };
  }

  /**
   * Resolves borrow terms for a caller-selected strategy by reading its
   * collateral map directly. If multiple populated duration slots exist for the
   * collateral, the caller must provide `requestedDurationIndex`.
   */
  async resolveBorrowTermsFromTargetStrategy(params: {
    strategy: PublicKey | LoopscaleStrategy;
    principalMint: PublicKey;
    assetIdentifier: PublicKey;
    requestedDurationIndex?: number;
  }): Promise<LoopscaleBorrowPrincipalTerms> {
    const strategyInfo =
      params.strategy instanceof PublicKey
        ? await this.fetchStrategy(params.strategy)
        : params.strategy;
    const strategy =
      params.strategy instanceof PublicKey
        ? params.strategy
        : strategyInfo.getAddress();

    if (!strategyInfo.principalMint.equals(params.principalMint)) {
      throw new Error(
        `Selected strategy principal mint ${strategyInfo.principalMint} does not match requested principal mint ${params.principalMint}`,
      );
    }

    const marketInfo = await this.fetchMarketInformation(
      strategyInfo.marketInformation,
    );
    if (!marketInfo.principalMint.equals(strategyInfo.principalMint)) {
      throw new Error(
        `Market principal mint ${marketInfo.principalMint} does not match strategy principal mint ${strategyInfo.principalMint}`,
      );
    }

    const collateralAssetIndex = marketInfo.findAssetIndex(
      params.assetIdentifier,
    );
    if (collateralAssetIndex === null) {
      throw new Error(
        `Collateral asset ${params.assetIdentifier} is not present in market ${marketInfo.getAddress()}`,
      );
    }

    const populatedDurationIndexes =
      strategyInfo.populatedDurationIndexes(collateralAssetIndex);
    if (populatedDurationIndexes.length === 0) {
      throw new Error(
        `Strategy ${strategy} has no collateral term for market asset index ${collateralAssetIndex}`,
      );
    }

    const durationIndex =
      params.requestedDurationIndex ??
      (populatedDurationIndexes.length === 1
        ? populatedDurationIndexes[0]
        : undefined);
    if (durationIndex === undefined) {
      throw new Error(
        `Strategy ${strategy} has multiple populated duration slots for market asset index ${collateralAssetIndex} (${populatedDurationIndexes.join(", ")}); specify a strategy duration index`,
      );
    }
    if (!populatedDurationIndexes.includes(durationIndex)) {
      throw new Error(
        `Strategy ${strategy} has no populated duration slot ${durationIndex} for market asset index ${collateralAssetIndex} (populated slots: ${populatedDurationIndexes.join(", ")})`,
      );
    }

    const expectedApy =
      strategyInfo.collateralMap[collateralAssetIndex][durationIndex];
    const assetInfo = marketInfo.assetData[collateralAssetIndex];
    const expectedLqt = [
      Number(assetInfo.liquidationThreshold.toString()),
      0,
      0,
      0,
      0,
    ] as [number, number, number, number, number];

    const terms = await this.resolveBorrowTermsFromStrategy({
      strategy: strategyInfo,
      principalMint: params.principalMint,
      assetIdentifier: params.assetIdentifier,
      expectedApy,
      expectedLqt,
    });
    if (terms.durationIndex !== durationIndex) {
      throw new Error(
        `Strategy ${strategy} resolved duration index ${terms.durationIndex}, expected ${durationIndex}; duplicate APY terms cannot be disambiguated`,
      );
    }

    return terms;
  }

  /**
   * Fetches and selects a Loopscale quote, then resolves the borrow terms needed
   * for borrow_principal.
   */
  async resolveBorrowTermsFromQuote(params: {
    principalMint: PublicKey;
    collateralMint: PublicKey;
    assetIdentifier: PublicKey;
    collateralAmount: BN;
    borrowAmount: BN;
    durationType: number;
    duration: number;
    externalYieldSource?: number;
  }): Promise<LoopscaleBorrowQuoteTerms> {
    const quotes = await this.fetchMaxQuotes({
      principalMint: params.principalMint,
      collateralMint: params.collateralMint,
      collateralAmount: params.collateralAmount,
      durationType: params.durationType,
      duration: params.duration,
    });
    const quote = await this.selectBestQuote(
      quotes,
      params.externalYieldSource,
      params.borrowAmount,
    );

    const strategy = new PublicKey(quote.strategy);
    if (quote.collateralIdentifier) {
      const quotedCollateralIdentifier = new PublicKey(
        quote.collateralIdentifier,
      );
      if (!quotedCollateralIdentifier.equals(params.assetIdentifier)) {
        throw new Error(
          `Quote collateral identifier ${quotedCollateralIdentifier} does not match asset identifier ${params.assetIdentifier}`,
        );
      }
    }

    const quoteAmount = new BN(String(quote.amount));
    if (quoteAmount.lt(params.borrowAmount)) {
      throw new Error(
        `Selected quote only supports ${quoteAmount.toString()} base units, below requested borrow amount ${params.borrowAmount.toString()}`,
      );
    }

    const terms = await this.resolveBorrowTermsFromStrategy({
      strategy,
      principalMint: params.principalMint,
      assetIdentifier: params.assetIdentifier,
      expectedApy: new BN(String(quote.apy)),
      expectedLqt: [Number(quote.lqt), 0, 0, 0, 0],
    });

    return { ...terms, quote };
  }

  private requireAssetIndex(
    marketInfo: LoopscaleMarketInformation,
    assetIdentifier: PublicKey,
    label: string,
  ): number {
    const index = marketInfo.findAssetIndex(assetIdentifier);
    if (index === null) {
      throw new Error(
        `${label} ${assetIdentifier} is not listed in Loopscale market information`,
      );
    }
    return index;
  }

  // The collateral map stores the lending APY per (asset, duration); the borrow
  // instruction expects the duration *index*, which we recover by matching the
  // quoted APY against the strategy's populated slots for the collateral.
  private requireDurationIndex(
    strategyInfo: LoopscaleStrategy,
    collateralAssetIndex: number,
    expectedApy: BN,
  ): number {
    const index = strategyInfo.durationIndexForApy(
      collateralAssetIndex,
      expectedApy,
    );
    if (index !== null) {
      return index;
    }
    const populated =
      strategyInfo.populatedDurationIndexes(collateralAssetIndex);
    if (populated.length === 0) {
      throw new Error(
        `Strategy ${strategyInfo.getAddress()} has no collateral term for market asset index ${collateralAssetIndex}`,
      );
    }
    throw new Error(
      `Strategy ${strategyInfo.getAddress()} has no duration slot matching quote APY ${expectedApy.toString()} for market asset index ${collateralAssetIndex} (populated slots: ${populated.join(", ")})`,
    );
  }

  async fetchMaxQuotes(
    params: LoopscaleMaxQuoteParams,
  ): Promise<LoopscaleQuote[]> {
    const {
      principalMint,
      collateralMint,
      collateralAmount,
      durationType,
      duration,
    } = params;
    const response = await fetch(`${LOOPSCALE_API_URL}/markets/quote/max`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        durationType,
        duration,
        principalMint: principalMint.toBase58(),
        collateralFilter: [
          {
            amount: collateralAmount.toNumber(),
            assetData: { Spl: { mint: collateralMint.toBase58() } },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Loopscale quote API failed (${response.status}): ${await response.text()}`,
      );
    }

    const quotes = (await response.json()) as unknown;
    if (!Array.isArray(quotes)) {
      throw new Error("Loopscale quote API returned an invalid response");
    }
    return quotes as LoopscaleQuote[];
  }

  /**
   * Selects the first quote with a usable strategy, optionally requiring it to
   * support at least `borrowAmount` base units.
   */
  async selectBestQuote(
    quotes: LoopscaleQuote[],
    externalYieldSource?: number,
    borrowAmount?: BN,
  ): Promise<LoopscaleQuote> {
    const strategyExtYieldSourceMap: Map<string, number> = new Map();

    // Fetch external yield source for each strategy if externalYieldSource filter is provided
    if (externalYieldSource !== undefined) {
      const strategyPubkeys = quotes.map(
        ({ strategy }) => new PublicKey(strategy),
      );
      const accountsInfo =
        await this.base.connection.getMultipleAccountsInfo(strategyPubkeys);

      for (const [i, account] of accountsInfo.entries()) {
        if (!account) continue;
        const strategyInfo = LoopscaleStrategy.decode(
          strategyPubkeys[i],
          account.data,
        );
        strategyExtYieldSourceMap.set(
          quotes[i].strategy,
          strategyInfo.externalYieldSource,
        );
      }
    }

    const quote = quotes.find(({ strategy, amount }) => {
      if (externalYieldSource !== undefined) {
        if (strategyExtYieldSourceMap.get(strategy) !== externalYieldSource) {
          return false;
        }
      }
      return (
        !borrowAmount || (amount && new BN(String(amount)).gte(borrowAmount))
      );
    });

    if (!quote) {
      throw new Error(
        borrowAmount
          ? "Loopscale quote API returned no strategy with enough liquidity"
          : "Loopscale quote API returned no usable strategy",
      );
    }
    return quote;
  }

  /**
   * Fetches quotes from Loopscale and selects the best one.
   */
  async fetchBestQuote(
    params: LoopscaleMaxQuoteParams,
  ): Promise<LoopscaleQuote> {
    const quotes = await this.fetchMaxQuotes(params);
    return await this.selectBestQuote(
      quotes,
      params.externalYieldSource,
      params.borrowAmount,
    );
  }

  private async decompileApiMessage(
    message: string,
  ): Promise<TransactionInstruction[]> {
    const versionedMessage = VersionedMessage.deserialize(
      Buffer.from(message, "base64"),
    );
    const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

    if ("addressTableLookups" in versionedMessage) {
      for (const lookup of versionedMessage.addressTableLookups) {
        const result = await this.base.connection.getAddressLookupTable(
          lookup.accountKey,
        );
        if (!result.value) {
          throw new Error(
            `Loopscale API message references missing address lookup table ${lookup.accountKey.toBase58()}`,
          );
        }
        addressLookupTableAccounts.push(result.value);
      }
    }

    return TransactionMessage.decompile(versionedMessage, {
      addressLookupTableAccounts,
    }).instructions;
  }

  private mapApiIx(ix: TransactionInstruction): TransactionInstruction {
    const mappedIx = mapToGlamIx(
      ix,
      this.base.statePda,
      this.base.signer,
      this.base.staging,
    );
    if (!mappedIx) {
      throw new Error(
        `No GLAM remapping config for Loopscale instruction discriminator ${Buffer.from(ix.data.subarray(0, 8)).toString("hex")}`,
      );
    }
    return mappedIx;
  }

  private async mapApiMessagesToGlamIxs(
    messages: string[],
    expectedDiscriminator: Buffer,
  ): Promise<TransactionInstruction[]> {
    const mappedIxs: TransactionInstruction[] = [];
    let sawExpectedInstruction = false;

    for (const message of messages) {
      const apiIxs = await this.decompileApiMessage(message);
      for (const ix of apiIxs) {
        if (ix.programId.equals(ComputeBudgetProgram.programId)) {
          continue;
        }
        if (!ix.programId.equals(LOOPSCALE_PROGRAM_ID)) {
          throw new Error(
            `Loopscale API returned unsupported setup instruction for program ${ix.programId.toBase58()}`,
          );
        }
        if (
          ix.data
            .subarray(0, expectedDiscriminator.length)
            .equals(expectedDiscriminator)
        ) {
          sawExpectedInstruction = true;
        }
        if (isSkippableLoopscaleLoanLockIx(ix.data)) {
          continue;
        }
        mappedIxs.push(this.mapApiIx(ix));
      }
    }

    if (!sawExpectedInstruction) {
      throw new Error(
        "Loopscale API response did not include the expected instruction",
      );
    }
    if (mappedIxs.length === 0) {
      throw new Error(
        "Loopscale API response did not include any mappable instructions",
      );
    }
    return mappedIxs;
  }

  private async fetchApiTransaction(
    path: string,
    init: RequestInit,
    label: string,
  ): Promise<LoopscaleApiTransactionPayload> {
    const response = await fetch(`${LOOPSCALE_API_URL}${path}`, init);
    if (!response.ok) {
      throw new Error(
        `Loopscale ${label} API failed (${response.status}): ${await response.text()}`,
      );
    }
    const payload = (await response.json()) as LoopscaleApiTransactionPayload;
    if (getLoopscaleApiMessages(payload).length === 0) {
      throw new Error(`Loopscale ${label} API returned no transaction message`);
    }
    return payload;
  }

  async buildApiCreateLoanIxs(params: {
    nonce: BN;
  }): Promise<{ loan: PublicKey; ixs: TransactionInstruction[] }> {
    const expectedLoan = this.getLoanPda(params.nonce);
    const payload = (await this.fetchApiTransaction(
      "/markets/creditbook/create",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          borrower: this.base.vaultPda.toBase58(),
          depositCollateral: [],
          principalRequested: [],
          assetIndexGuidance: [],
          loanNonce: params.nonce.toString(),
        }),
      },
      "create loan",
    )) as LoopscaleApiTransactionResponse;
    const loan = payload.loanAddress
      ? new PublicKey(payload.loanAddress)
      : expectedLoan;
    if (!loan.equals(expectedLoan)) {
      throw new Error(
        `Loopscale create loan API returned loan ${loan}, expected ${expectedLoan}`,
      );
    }
    const ixs = await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_CREATE_LOAN_DISCRIMINATOR,
    );
    return { loan, ixs };
  }

  async buildApiDepositCollateralIxs(params: {
    loan: PublicKey;
    depositMint: PublicKey;
    amount: BN;
    assetType: number;
    assetIdentifier: PublicKey;
    assetIndexGuidance: number[];
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/creditbook/collateral/deposit",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          depositMint: params.depositMint.toBase58(),
          amount: bnToSafeNumber(params.amount, "deposit amount"),
          assetType: params.assetType,
          assetIdentifier: params.assetIdentifier.toBase58(),
          assetIndexGuidance: params.assetIndexGuidance,
        }),
      },
      "deposit",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR,
    );
  }

  async buildApiBorrowPrincipalIxs(params: {
    loan: PublicKey;
    strategy: PublicKey;
    amount: BN;
    assetIndexGuidance: number[];
    duration: number;
    expectedLoanValues: { expectedApy: BN; expectedLqt: Tuple5 };
    skipSolUnwrap: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/creditbook/borrow",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          strategy: params.strategy.toBase58(),
          borrowParams: {
            amount: bnToSafeNumber(params.amount, "borrow amount"),
            assetIndexGuidance: params.assetIndexGuidance,
            duration: params.duration,
            expectedLoanValues: {
              expectedApy: bnToSafeNumber(
                params.expectedLoanValues.expectedApy,
                "expected APY",
              ),
              expectedLqt: params.expectedLoanValues.expectedLqt,
            },
            skipSolUnwrap: params.skipSolUnwrap,
          },
        }),
      },
      "borrow",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_BORROW_PRINCIPAL_DISCRIMINATOR,
    );
  }

  async buildApiWithdrawCollateralIxs(params: {
    loan: PublicKey;
    collateralMint: PublicKey;
    amount: BN;
    collateralIndex: number;
    assetIndexGuidance: number[];
    expectedLoanValues: { expectedApy: BN; expectedLqt: Tuple5 };
    closeIfEligible?: boolean;
    withdrawAll?: boolean;
  }): Promise<TransactionInstruction[]> {
    const body: {
      loan: string;
      collateralMint: string;
      amount: number;
      collateralIndex: number;
      expectedLoanValues: { expectedApy: number; expectedLqt: Tuple5 };
      assetIndexGuidance?: number[];
      closeIfEligible?: boolean;
      withdrawAll?: boolean;
    } = {
      loan: params.loan.toBase58(),
      collateralMint: params.collateralMint.toBase58(),
      amount: bnToSafeNumber(params.amount, "withdraw amount"),
      collateralIndex: params.collateralIndex,
      expectedLoanValues: {
        expectedApy: bnToSafeNumber(
          params.expectedLoanValues.expectedApy,
          "expected APY",
        ),
        expectedLqt: params.expectedLoanValues.expectedLqt,
      },
    };
    if (params.assetIndexGuidance.length > 0) {
      body.assetIndexGuidance = params.assetIndexGuidance;
    }
    if (params.closeIfEligible !== undefined) {
      body.closeIfEligible = params.closeIfEligible;
    }
    if (params.withdrawAll !== undefined) {
      body.withdrawAll = params.withdrawAll;
    }

    const payload = await this.fetchApiTransaction(
      "/markets/creditbook/collateral/withdraw",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify(body),
      },
      "withdraw",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_WITHDRAW_COLLATERAL_DISCRIMINATOR,
    );
  }

  async buildApiRepayPrincipalIxs(params: {
    loan: PublicKey;
    strategy: PublicKey;
    amount: BN;
    ledgerIndex: number;
    repayAll: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/creditbook/repay_simple",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          strategy: params.strategy.toBase58(),
          repayParams: {
            amount: bnToSafeNumber(params.amount, "repay amount"),
            ledgerIndex: params.ledgerIndex,
            repayAll: params.repayAll,
          },
        }),
      },
      "repay",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_REPAY_PRINCIPAL_DISCRIMINATOR,
    );
  }

  async buildApiDepositStrategyIxs(params: {
    strategy: PublicKey;
    amount: BN;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/strategy/deposit",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          amount: bnToSafeNumber(params.amount, "deposit amount"),
        }),
      },
      "deposit strategy",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_DEPOSIT_STRATEGY_DISCRIMINATOR,
    );
  }

  async buildApiWithdrawStrategyIxs(params: {
    strategy: PublicKey;
    amount: BN;
    withdrawAll: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/strategy/withdraw",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          amount: bnToSafeNumber(params.amount, "withdraw amount"),
          withdrawAll: params.withdrawAll,
        }),
      },
      "withdraw strategy",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_WITHDRAW_STRATEGY_DISCRIMINATOR,
    );
  }

  async buildApiCloseStrategyIxs(params: {
    strategy: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.fetchApiTransaction(
      `/markets/strategy/close/${params.strategy.toBase58()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
      },
      "close strategy",
    );
    return await this.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_CLOSE_STRATEGY_DISCRIMINATOR,
    );
  }

  async buildApiUpdateStrategyTxs(params: {
    strategy: PublicKey;
    collateralTerms?: LoopscaleApiCollateralTermUpdate;
    updateParams?: LoopscaleApiUpdateStrategyParams;
  }): Promise<LoopscaleMappedTransaction[]> {
    const payload = await this.fetchApiTransaction(
      "/markets/strategy/update",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          collateralTerms: params.collateralTerms,
          updateParams: params.updateParams,
        }),
      },
      "update strategy",
    );

    let sawExpectedInstruction = false;
    const txs: LoopscaleMappedTransaction[] = [];
    for (const message of getLoopscaleApiMessages(payload)) {
      const ixs: TransactionInstruction[] = [];
      const additionalSigners: Keypair[] = [];

      for (const ix of await this.decompileApiMessage(message)) {
        if (ix.programId.equals(ComputeBudgetProgram.programId)) {
          continue;
        }
        if (!ix.programId.equals(LOOPSCALE_PROGRAM_ID)) {
          throw new Error(
            `Loopscale update strategy API returned unsupported setup instruction for program ${ix.programId.toBase58()}`,
          );
        }
        const isUpdateStrategy = ix.data
          .subarray(0, LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR.length)
          .equals(LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR);
        if (!isUpdateStrategy) {
          throw new Error(
            `Loopscale update strategy API returned unsupported Loopscale instruction discriminator ${Buffer.from(ix.data.subarray(0, 8)).toString("hex")}`,
          );
        }
        sawExpectedInstruction = true;
        if (ix.keys.length < LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT) {
          throw new Error(
            "Loopscale update_strategy template has too few accounts",
          );
        }

        const replaced = replaceLoopscaleApiExtraSigners(
          ix,
          LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT,
        );
        additionalSigners.push(...replaced.additionalSigners);
        ixs.push(this.mapApiIx(replaced.ixs[0]));
      }
      if (ixs.length > 0) {
        txs.push({ ixs, additionalSigners });
      }
    }

    if (!sawExpectedInstruction) {
      throw new Error(
        "Loopscale update strategy API response did not include update_strategy",
      );
    }
    if (txs.length === 0) {
      throw new Error(
        "Loopscale update strategy API response had no mappable instructions",
      );
    }
    return txs;
  }

  /**
   * Signs a built transaction with the client wallet, has it co-signed by the
   * Loopscale MPC, and returns the co-signed transaction.
   */
  async cosignTransaction(params: {
    tx: VersionedTransaction;
    identifier: string;
  }): Promise<VersionedTransaction> {
    if (!this.base.signer.equals(GLAM_SIGNER)) {
      throw new Error(
        `Wallet must be the approved GLAM signer: ${GLAM_SIGNER}`,
      );
    }

    const { tx, identifier } = params;

    // Sign with wallet first, then send to Loopscale for MPC co-signing
    const walletSignedTx = await this.base.wallet.signTransaction(tx);
    const transaction = Buffer.from(walletSignedTx.serialize()).toString(
      "base64",
    );

    const response = await fetch(`${LOOPSCALE_API_URL}/mpc/txns/gen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batches: [
          {
            transactions: [
              {
                identifier,
                transaction,
                transactionType: LOOPSCALE_MPC_TRANSACTION_TYPE,
                signers: [
                  this.base.signer.toBase58(),
                  "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs",
                ],
                jitoTip: null,
                priorityFee: null,
                signature: "",
                transactionActions: [],
              },
            ],
            commitmentLevel: "confirmed",
            bundle: 0,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Loopscale MPC send failed (${response.status}): ${await response.text()}`,
      );
    }

    // Response shape:
    // { batches: [{ transactions: [{ identifier, transaction, signature, signers, ... }] }] }
    const results: LoopscaleMpcSendResponse = await response.json();
    const transactions =
      results?.batches?.flatMap((batch) => batch?.transactions ?? []) ?? [];
    if (transactions.length === 0) {
      throw new Error("Loopscale MPC send returned an invalid response");
    }

    const result =
      transactions.find((txn) => txn?.identifier === params.identifier) ??
      transactions[0];

    if (
      !result.transaction ||
      !result.signers?.includes(LOOPSCALE_BS_AUTH.toBase58())
    ) {
      throw new Error("Loopscale MPC did not co-sign the transaction");
    }

    return VersionedTransaction.deserialize(
      Buffer.from(result.transaction, "base64"),
    );
  }

  private async sendCosignedIxs(
    ixs: TransactionInstruction[],
    txOptions: TxOptions = {},
    additionalSigners: Keypair[] = [],
    identifierSuffix = "",
  ): Promise<TransactionSignature> {
    const versionedTx = await this.base.intoVersionedTransaction(
      new Transaction().add(...ixs),
      txOptions,
    );
    if (additionalSigners.length > 0) {
      versionedTx.sign(additionalSigners);
    }
    const cosignedTx = await this.cosignTransaction({
      tx: versionedTx,
      identifier: `glam-loopscale-${new Date().getTime()}${identifierSuffix}`,
    });
    return await this.base.sendAndConfirm(cosignedTx);
  }

  private async sendCosignedIxBatches(
    txs: LoopscaleMappedTransaction[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature[]> {
    const txSigs: TransactionSignature[] = [];
    for (let i = 0; i < txs.length; i++) {
      const { ixs, additionalSigners } = txs[i];
      txSigs.push(
        await this.sendCosignedIxs(ixs, txOptions, additionalSigners, `-${i}`),
      );
    }
    return txSigs;
  }

  async createLoan(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { loan, ixs } = await this.buildApiCreateLoanIxs(params);
    if (!loan.equals(accounts.loan)) {
      throw new Error(
        `Loopscale create loan API returned loan ${loan}, expected ${accounts.loan}`,
      );
    }
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async closeLoan(
    accounts: CloseLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.closeLoanIx(accounts, txOptions.signer);
    return await this.sendCosignedIxs([ix], txOptions);
  }

  async depositStrategy(
    amount: BN,
    accounts: DepositStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiDepositStrategyIxs({
      strategy: accounts.strategy,
      amount,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async updateStrategy(
    params: {
      strategy: PublicKey;
      collateralTerms?: LoopscaleApiCollateralTermUpdate;
      updateParams?: LoopscaleApiUpdateStrategyParams;
    },
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature[]> {
    const txs = await this.buildApiUpdateStrategyTxs(params);
    return await this.sendCosignedIxBatches(txs, txOptions);
  }

  async withdrawStrategy(
    amount: BN,
    withdrawAll: boolean,
    accounts: WithdrawStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiWithdrawStrategyIxs({
      strategy: accounts.strategy,
      amount,
      withdrawAll,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async closeStrategy(
    accounts: CloseStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiCloseStrategyIxs({
      strategy: accounts.strategy,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async depositCollateral(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiDepositCollateralIxs({
      loan: accounts.loan,
      depositMint: accounts.depositMint,
      amount: params.amount,
      assetType: params.assetType,
      assetIdentifier: params.assetIdentifier,
      assetIndexGuidance: [...params.assetIndexGuidance],
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async updateWeightMatrix(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.updateWeightMatrixIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.sendCosignedIxs([ix], txOptions);
  }

  async borrowPrincipal(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiBorrowPrincipalIxs({
      loan: accounts.loan,
      strategy: accounts.strategy,
      amount: params.amount,
      assetIndexGuidance: [...params.assetIndexGuidance],
      duration: params.duration,
      expectedLoanValues: {
        expectedApy: params.expectedLoanValues.expectedApy,
        expectedLqt: params.expectedLoanValues.expectedLqt as Tuple5,
      },
      skipSolUnwrap: params.skipSolUnwrap,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async withdrawCollateral(
    params: WithdrawCollateralParams,
    accounts: WithdrawCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiWithdrawCollateralIxs({
      loan: accounts.loan,
      collateralMint: accounts.assetMint,
      amount: params.amount,
      collateralIndex: params.collateralIndex,
      assetIndexGuidance: [...params.assetIndexGuidance],
      expectedLoanValues: {
        expectedApy: params.expectedLoanValues.expectedApy,
        expectedLqt: params.expectedLoanValues.expectedLqt as Tuple5,
      },
      closeIfEligible: params.closeIfEligible || undefined,
      withdrawAll: params.withdrawAll || undefined,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  async repayPrincipal(
    params: RepayPrincipalParams,
    accounts: RepayPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiRepayPrincipalIxs({
      loan: accounts.loan,
      strategy: accounts.strategy,
      amount: params.amount,
      ledgerIndex: params.ledgerIndex,
      repayAll: params.repayAll,
    });
    return await this.sendCosignedIxs(ixs, txOptions);
  }

  /**
   * Resolves the strategy-derived account inputs a {@link repayPrincipal} needs
   * from a known strategy, without consulting the quote API or market oracles.
   * Repay does not carry expected loan values, so no oracle remaining accounts
   * are required (confirmed against mainnet).
   */
  async resolveLedgerStrategyAccounts(strategy: PublicKey): Promise<{
    strategy: PublicKey;
    marketInformation: PublicKey;
    principalMint: PublicKey;
  }> {
    const strategyInfo = await this.fetchStrategy(strategy);
    return {
      strategy,
      marketInformation: strategyInfo.marketInformation,
      principalMint: strategyInfo.principalMint,
    };
  }

  async getBaseAssetOracle(): Promise<PublicKey> {
    const { baseAssetMint } = await this.base.fetchStateModel();
    return (await this.base.getAssetMeta(baseAssetMint)).oracle;
  }

  async getPriceLoansAccounts(
    commitment?: Commitment,
  ): Promise<PriceLoansAccounts | null> {
    const { externalPositions } = await this.base.fetchStateAccount();
    if ((externalPositions || []).length === 0) {
      return null;
    }

    const accountsInfo: (Web3AccountInfo<Buffer> | null)[] = [];
    const chunkSize = 100;
    for (let i = 0; i < externalPositions.length; i += chunkSize) {
      const chunk = externalPositions.slice(i, i + chunkSize);
      const chunkInfos = await this.base.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accountsInfo.push(...chunkInfos);
    }

    const loanAccounts: PublicKey[] = [];
    const oracleMints = new PkSet();
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (!isLoopscaleLoanAccountInfo(info)) {
        continue;
      }

      loanAccounts.push(externalPositions[i]);
      readLoopscaleOracleMints(info.data).forEach((mint) =>
        oracleMints.add(mint),
      );
    }

    if (loanAccounts.length === 0) {
      return null;
    }

    const assetMetas = await this.base.fetchAssetMetas();
    const oracleAccounts: PublicKey[] = [];
    const seenOracles = new PkSet();

    for (const mint of oracleMints) {
      const assetMeta = assetMetas.get(mint);
      if (!assetMeta?.oracle) {
        throw new Error(`Oracle unavailable for asset ${mint.toBase58()}`);
      }
      if (!seenOracles.has(assetMeta.oracle)) {
        seenOracles.add(assetMeta.oracle);
        oracleAccounts.push(assetMeta.oracle);
      }
    }

    return {
      loanAccounts,
      oracleAccounts,
    };
  }

  async getPriceStrategiesAccounts(
    commitment?: Commitment,
  ): Promise<PriceStrategiesAccounts | null> {
    const { externalPositions } = await this.base.fetchStateAccount();
    if ((externalPositions || []).length === 0) {
      return null;
    }

    const accountsInfo: (Web3AccountInfo<Buffer> | null)[] = [];
    const chunkSize = 100;
    for (let i = 0; i < externalPositions.length; i += chunkSize) {
      const chunk = externalPositions.slice(i, i + chunkSize);
      const chunkInfos = await this.base.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accountsInfo.push(...chunkInfos);
    }

    const strategyAccounts: PublicKey[] = [];
    const oracleMints = new PkSet();
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (!isLoopscaleStrategyAccountInfo(info)) {
        continue;
      }

      strategyAccounts.push(externalPositions[i]);
      const principalMint = readLoopscaleStrategyPrincipalMint(info.data);
      if (!principalMint.equals(PublicKey.default)) {
        oracleMints.add(principalMint);
      }
    }

    if (strategyAccounts.length === 0) {
      return null;
    }

    const assetMetas = await this.base.fetchAssetMetas();
    const oracleAccounts: PublicKey[] = [];
    const seenOracles = new PkSet();

    for (const mint of oracleMints) {
      const assetMeta = assetMetas.get(mint);
      if (!assetMeta?.oracle) {
        throw new Error(`Oracle unavailable for asset ${mint.toBase58()}`);
      }
      if (!seenOracles.has(assetMeta.oracle)) {
        seenOracles.add(assetMeta.oracle);
        oracleAccounts.push(assetMeta.oracle);
      }
    }

    return {
      strategyAccounts,
      oracleAccounts,
    };
  }
}
