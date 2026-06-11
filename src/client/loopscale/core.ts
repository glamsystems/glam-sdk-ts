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
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { mapToGlamIx } from "@glamsystems/ix-mapper";

import {
  BaseClient,
  BaseTxBuilder,
  TxOptions,
  type ProtocolPolicyTxBuilder,
} from "../base";
import { getIntegrationAuthorityPda } from "../../utils/glamPDAs";
import {
  LOOPSCALE_PROGRAM_ID,
  LOOPSCALE_PROTOCOL_ADMIN_STATE,
  WSOL,
} from "../../constants";
import {
  LOOPSCALE_BORROW_PROTOCOL,
  LOOPSCALE_LENDING_PROTOCOL,
  LOOPSCALE_VAULT_PROTOCOL,
} from "../../protocols";
import { U64_MAX_BN } from "../../utils/common";
import { PkMap } from "../../utils/pkmap";
import { PkSet } from "../../utils/pkset";
import {
  LOOPSCALE_LOAN_DISCRIMINATOR,
  LOOPSCALE_STRATEGY_ACCOUNT_DISCRIMINATOR,
  LOOPSCALE_VAULT_DISCRIMINATOR,
  LoopscaleLoan,
  LoopscaleMarketInformation,
  LoopscaleStrategy,
  hasLoopscaleLoanDiscriminator,
  hasLoopscaleStrategyDiscriminator,
  hasLoopscaleVaultDiscriminator,
  hasLoopscaleVaultStakeDiscriminator,
} from "../../deser";
import {
  LoopscaleBorrowPolicy,
  LoopscaleLendingPolicy,
  LoopscaleVaultPolicy,
} from "../../deser/integrationPolicies";

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
export const LOOPSCALE_CREATE_LOAN_DISCRIMINATOR = Buffer.from([
  166, 131, 118, 219, 138, 218, 206, 140,
]);
export const LOOPSCALE_CREATE_STRATEGY_DISCRIMINATOR = Buffer.from([
  152, 160, 107, 148, 245, 190, 127, 224,
]);
const LOOPSCALE_LOCK_LOAN_DISCRIMINATOR = Buffer.from([
  28, 101, 52, 240, 146, 230, 95, 22,
]);
const LOOPSCALE_UNLOCK_LOAN_DISCRIMINATOR = Buffer.from([
  121, 226, 178, 98, 215, 209, 240, 38,
]);
export const LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR = Buffer.from([
  156, 131, 142, 116, 146, 247, 162, 120,
]);
const LOOPSCALE_UPDATE_WEIGHT_MATRIX_DISCRIMINATOR = Buffer.from([
  252, 166, 37, 207, 154, 83, 187, 128,
]);
export const LOOPSCALE_BORROW_PRINCIPAL_DISCRIMINATOR = Buffer.from([
  106, 10, 38, 204, 139, 188, 124, 50,
]);
export const LOOPSCALE_REPAY_PRINCIPAL_DISCRIMINATOR = Buffer.from([
  229, 67, 83, 65, 77, 84, 80, 141,
]);
export const LOOPSCALE_WITHDRAW_COLLATERAL_DISCRIMINATOR = Buffer.from([
  115, 135, 168, 106, 139, 214, 138, 150,
]);
export const LOOPSCALE_SELL_LEDGER_DISCRIMINATOR = Buffer.from([
  55, 17, 153, 148, 120, 242, 80, 5,
]);
export const LOOPSCALE_DEPOSIT_STRATEGY_DISCRIMINATOR = Buffer.from([
  246, 82, 57, 226, 131, 222, 253, 249,
]);
export const LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR = Buffer.from([
  16, 76, 138, 179, 171, 112, 196, 21,
]);
export const LOOPSCALE_WITHDRAW_STRATEGY_DISCRIMINATOR = Buffer.from([
  31, 45, 162, 5, 193, 217, 134, 188,
]);
export const LOOPSCALE_CLOSE_STRATEGY_DISCRIMINATOR = Buffer.from([
  56, 247, 170, 246, 89, 221, 134, 200,
]);
export const LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT = 12;
const GLAM_DEPOSIT_COLLATERAL_ACCOUNT_COUNT = 17;
const GLAM_UPDATE_WEIGHT_MATRIX_ACCOUNT_COUNT = 10;
const GLAM_UPDATE_STRATEGY_ACCOUNT_COUNT = 15;
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

export type LoopscaleApiTransaction = {
  message?: string;
  signatures?: unknown[];
};

export type LoopscaleApiTransactionResponse = LoopscaleApiTransaction & {
  transaction?: LoopscaleApiTransaction;
  transactions?: LoopscaleApiTransaction[];
  loanAddress?: string;
};

export type LoopscaleApiTransactionPayload =
  | LoopscaleApiTransactionResponse
  | LoopscaleApiTransactionResponse[];

/**
 * Account inputs for a Loopscale borrow that are derived from on-chain market
 * and strategy state (see {@link LoopscaleCoreClient.resolveBorrowMarketAccounts}).
 */
export type BorrowMarketAccounts = {
  marketInformation: PublicKey;
  principalMint: PublicKey;
  durationIndex: number;
  assetIndexGuidance: Buffer;
};

export type LoopscaleAssetIndexGuidance = {
  collateralAssetIndex: number;
  principalAssetIndex: number;
  ltvAssetIndex: number;
};

export function encodeLoopscaleAssetIndexGuidance(
  guidance: LoopscaleAssetIndexGuidance,
): Buffer {
  return Buffer.from([
    guidance.collateralAssetIndex,
    guidance.principalAssetIndex,
    guidance.ltvAssetIndex,
  ]);
}

export type LoopscaleSellLedgerAssetIndexGuidance = {
  principalAssetIndex: number;
  collateralAssetIndex: number;
};

export function encodeLoopscaleSellLedgerAssetIndexGuidance(
  guidance: LoopscaleSellLedgerAssetIndexGuidance,
): Buffer {
  return Buffer.from([
    guidance.principalAssetIndex,
    guidance.collateralAssetIndex,
  ]);
}

export type LoopscaleBorrowPrincipalTerms = {
  strategy: PublicKey;
  expectedLoanValues: LoopscaleExpectedLoanValues;
  assetIndexGuidance: Buffer;
  durationIndex: number;
};

export type LoopscaleBorrowQuoteTerms = LoopscaleBorrowPrincipalTerms & {
  quote: LoopscaleQuote;
};

export type LoopscaleSellLedgerTerms = {
  ledgerIndex: number;
  oldStrategy: PublicKey;
  newStrategy: PublicKey;
  oldStrategyMarketInformation: PublicKey;
  newStrategyMarketInformation: PublicKey;
  principalMint: PublicKey;
  assetIndexGuidance: Buffer;
  guidance: LoopscaleSellLedgerAssetIndexGuidance;
  remainingAccounts: AccountMeta[];
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

export function getLoopscaleApiMessages(
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
export function replaceLoopscaleApiExtraSigners(
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

export function createVaultWsolAtaSetupIxs(params: {
  mint: PublicKey;
  payer: PublicKey;
  owner: PublicKey;
  ata: PublicKey;
}): TransactionInstruction[] {
  if (!params.mint.equals(WSOL)) {
    return [];
  }

  return [
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer,
      params.ata,
      params.owner,
      WSOL,
      TOKEN_PROGRAM_ID,
    ),
  ];
}

export function createVaultTokenAtaSetupIx(params: {
  mint: PublicKey;
  payer: PublicKey;
  owner: PublicKey;
  ata: PublicKey;
  tokenProgram: PublicKey;
}): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(
    params.payer,
    params.ata,
    params.owner,
    params.mint,
    params.tokenProgram,
  );
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
  createExternalYieldAccount: boolean;
};

export type LoopscaleOnchainExternalYieldSourceArgs = {
  newExternalYieldSource: number;
  externalYieldVault: PublicKey;
};

export type CreateLoanParams = {
  nonce: BN;
};

export type LoopscaleLpParams =
  | {
      exactIn: {
        amountIn: BN;
        minAmountOut: BN;
      };
    }
  | {
      exactOut: {
        amountOut: BN;
        maxAmountIn: BN;
      };
    };

function normalizeLoopscaleLpParams(params: LoopscaleLpParams): any {
  if ("exactIn" in params) {
    return {
      exactIn: Array.isArray(params.exactIn)
        ? params.exactIn
        : [params.exactIn],
    };
  }

  return {
    exactOut: Array.isArray(params.exactOut)
      ? params.exactOut
      : [params.exactOut],
  };
}

export type LoopscaleVaultStakeParams = {
  amount: BN;
  principalAmount: BN;
  stakeAll: boolean | null;
  duration: number;
  durationType: number;
  actionType: number;
};

export type LoopscaleVaultUnstakeParams = {
  actionType: number;
  principalAmount: BN;
};

export type CreateStrategyParams = {
  originationCap: BN;
  liquidityBuffer: BN;
  interestFee: BN;
  originationFee: BN;
  principalFee: BN;
  originationsEnabled: boolean;
  externalYieldSourceArgs: LoopscaleOnchainExternalYieldSourceArgs | null;
};

export type LoopscaleCollateralTermsIndices = {
  collateralIndex: number;
  durationIndex: number;
};

export type LoopscaleMultiCollateralTermsUpdateParams = {
  apy: number;
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
  externalYieldSourceArgs?: LoopscaleOnchainExternalYieldSourceArgs | null;
};

export type DepositCollateralParams = {
  amount: BN;
  assetType: number;
  assetIdentifier: PublicKey;
  assetIndexGuidance: number[];
};

export type UpdateWeightMatrixParams = {
  collateralIndex: number;
  weightMatrix: [number, number, number, number, number];
  expectedLoanValues: LoopscaleExpectedLoanValues;
  assetIndexGuidance: Buffer;
};

export type BorrowPrincipalParams = {
  amount: BN;
  assetIndexGuidance: number[];
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
  marketInformation: PublicKey;
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
};

export type CloseStrategyAccounts = {
  strategy: PublicKey;
  principalMint: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type DepositWithdrawUserVaultAccounts = {
  vault: PublicKey;
  strategy: PublicKey;
  marketInformation: PublicKey;
  lpMint: PublicKey;
  principalMint: PublicKey;
  lpTokenProgram: PublicKey;
  principalTokenProgram: PublicKey;
};

export type StakeUserVaultLpAccounts = {
  nonce: PublicKey;
  vault: PublicKey;
  vaultStake: PublicKey;
  lpMint: PublicKey;
};

export type UnstakeUserVaultLpAccounts = {
  vault: PublicKey;
  lpMint: PublicKey;
  vaultStake: PublicKey;
};

export type ClaimVaultRewardsAccounts = {
  vault: PublicKey;
  vaultStake: PublicKey;
  vaultRewardsInfo?: PublicKey;
  userRewardsInfo?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type DepositCollateralAccounts = {
  loan: PublicKey;
  depositMint: PublicKey;
  assetIdentifier?: PublicKey;
  borrowerCollateralTa?: PublicKey;
  loanCollateralTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type UpdateWeightMatrixAccounts = {
  loan: PublicKey;
};

export type BorrowPrincipalAccounts = {
  loan: PublicKey;
  strategy: PublicKey;
};

export type WithdrawCollateralParams = {
  amount: BN;
  collateralIndex: number;
  assetIndexGuidance: number[];
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

export type SellLedgerParams = {
  ledgerIndex: number;
  expectedSalePrice: BN;
  assetIndexGuidance: Buffer;
};

export type RepayPrincipalAccounts = {
  loan: PublicKey;
  strategy: PublicKey;
  marketInformation?: PublicKey;
  principalMint?: PublicKey;
  borrowerTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type SellLedgerAccounts = {
  loan: PublicKey;
  oldStrategy: PublicKey;
  newStrategy: PublicKey;
  oldStrategyMarketInformation: PublicKey;
  newStrategyMarketInformation: PublicKey;
  principalMint: PublicKey;
  newStrategyTa?: PublicKey;
  lenderAuthTa?: PublicKey;
  userVault?: PublicKey;
  oldStrategyTa?: PublicKey;
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
  nonce: BN,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [borrower.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
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

export function getLoopscaleVaultPda(
  vaultNonce: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), vaultNonce.toBuffer()],
    programId,
  )[0];
}

export function getLoopscaleVaultStrategyPda(
  vault: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("strategy"), vault.toBuffer()],
    programId,
  )[0];
}

export function getLoopscaleVaultRewardsInfoPda(
  vault: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_rewards_info"), vault.toBuffer()],
    programId,
  )[0];
}

export function getLoopscaleVaultStakePda(
  stakeNonce: PublicKey,
  vault: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_stake"), stakeNonce.toBuffer(), vault.toBuffer()],
    programId,
  )[0];
}

export function getLoopscaleUserRewardsInfoPda(
  vaultStake: PublicKey,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_rewards_info"), vaultStake.toBuffer()],
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

export type PriceVaultsAccounts = {
  numVaults: number;
  vaultAccounts: PublicKey[];
  strategyAccounts: PublicKey[];
  userLpTokenAccounts: PublicKey[];
  vaultStakeAccounts: PublicKey[];
  oracleAccounts: PublicKey[];
  solUsdOracle?: PublicKey;
  baseAssetOracle?: PublicKey;
  glamConfig?: PublicKey;
};

const LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET = 42;
const LOOPSCALE_STRATEGY_MIN_DATA_LEN = 220;
const LOOPSCALE_VAULT_LP_MINT_OFFSET = 81;
const LOOPSCALE_VAULT_PRINCIPAL_MINT_OFFSET = 113;
const LOOPSCALE_VAULT_MIN_DATA_LEN =
  LOOPSCALE_VAULT_DISCRIMINATOR.length + 32 + 32 + 1 + 8 + 32 + 32;
const LOOPSCALE_VAULT_STAKE_VAULT_OFFSET = 8;
const LOOPSCALE_VAULT_STAKE_AMOUNT_OFFSET = 105;
const LOOPSCALE_VAULT_STAKE_MIN_DATA_LEN =
  LOOPSCALE_VAULT_STAKE_AMOUNT_OFFSET + 8;
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

export function isLoopscaleLoanAccountInfo(
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

export function isLoopscaleVaultAccountInfo(
  info: Web3AccountInfo<Buffer> | null,
): info is Web3AccountInfo<Buffer> {
  return !!(
    info &&
    typeof info.owner?.equals === "function" &&
    info.owner.equals(LOOPSCALE_PROGRAM_ID) &&
    info.data.length >= LOOPSCALE_VAULT_MIN_DATA_LEN &&
    hasLoopscaleVaultDiscriminator(info.data)
  );
}

export function isLoopscaleVaultStakeAccountInfo(
  info: Web3AccountInfo<Buffer> | null,
): info is Web3AccountInfo<Buffer> {
  return !!(
    info &&
    typeof info.owner?.equals === "function" &&
    info.owner.equals(LOOPSCALE_PROGRAM_ID) &&
    info.data.length >= LOOPSCALE_VAULT_STAKE_MIN_DATA_LEN &&
    hasLoopscaleVaultStakeDiscriminator(info.data)
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

export function readLoopscaleVaultLpMint(data: Buffer): PublicKey {
  return new PublicKey(
    data.subarray(
      LOOPSCALE_VAULT_LP_MINT_OFFSET,
      LOOPSCALE_VAULT_LP_MINT_OFFSET + 32,
    ),
  );
}

export function readLoopscaleVaultPrincipalMint(data: Buffer): PublicKey {
  return new PublicKey(
    data.subarray(
      LOOPSCALE_VAULT_PRINCIPAL_MINT_OFFSET,
      LOOPSCALE_VAULT_PRINCIPAL_MINT_OFFSET + 32,
    ),
  );
}

export function readLoopscaleVaultStakeVault(data: Buffer): PublicKey {
  return new PublicKey(
    data.subarray(
      LOOPSCALE_VAULT_STAKE_VAULT_OFFSET,
      LOOPSCALE_VAULT_STAKE_VAULT_OFFSET + 32,
    ),
  );
}

export function readLoopscaleVaultStakeAmount(data: Buffer): BN {
  return new BN(
    Array.from(
      data.subarray(
        LOOPSCALE_VAULT_STAKE_AMOUNT_OFFSET,
        LOOPSCALE_VAULT_STAKE_AMOUNT_OFFSET + 8,
      ),
    ),
    "le",
  );
}

export function readTokenAccountAmount(data: Buffer): bigint {
  if (data.length < AccountLayout.span) {
    return 0n;
  }
  return AccountLayout.decode(data).amount;
}

export function readLoopscaleOracleMints(data: Buffer): PublicKey[] {
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

export class LoopscaleBorrowTxBuilder
  extends BaseTxBuilder<LoopscaleCoreClient>
  implements ProtocolPolicyTxBuilder<LoopscaleBorrowPolicy>
{
  async setPolicyIx(
    policy: LoopscaleBorrowPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.setBorrowPolicyIx(policy, signer);
  }

  async setBorrowPolicyIx(
    policy: LoopscaleBorrowPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    // `duration_indexes_allowlist` is `Vec<u8>`, which Anchor's IDL coder
    // encodes as `bytes` and requires a Buffer (not a number[]).
    const encodablePolicy = {
      collateralAllowlist: policy.collateralAllowlist,
      principalAllowlist: policy.principalAllowlist,
      marketPolicies: policy.marketPolicies.map((p) => ({
        market: p.market,
        maxBorrowAmount: p.maxBorrowAmount,
        maxTotalBorrowAmount: p.maxTotalBorrowAmount,
        maxLtvBps: p.maxLtvBps,
        durationIndexesAllowlist: Buffer.from(p.durationIndexesAllowlist),
      })),
    };
    return await this.client.base.extLoopscaleProgram.methods
      .setBorrowPolicy(encodablePolicy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        integrationProgram: this.client.programId,
        integrationAuthority: this.client.integrationAuthorityPda,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: LoopscaleBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setBorrowPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async setBorrowPolicyTx(
    policy: LoopscaleBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setBorrowPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.programId,
      LOOPSCALE_BORROW_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.programId,
      LOOPSCALE_BORROW_PROTOCOL,
      txOptions,
    );
  }

  async closeLoanIx(
    loan: PublicKey,
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
        loan,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async closeLoanTx(
    loan: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closeLoanIx(loan, txOptions.signer);
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
        assetIndexGuidance: Buffer.from(params.assetIndexGuidance),
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

  /** @deprecated */
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

  /** @deprecated */
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
}

export class LoopscaleLendTxBuilder extends BaseTxBuilder<LoopscaleCoreClient> {
  async setPolicyIx(
    policy: LoopscaleLendingPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.setLendingPolicyIx(policy, signer);
  }

  async setLendingPolicyIx(
    policy: LoopscaleLendingPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    // `duration_indexes_allowlist` is `Vec<u8>`, which Anchor's IDL coder
    // encodes as `bytes` and requires a Buffer (not a number[]).
    const encodablePolicy = {
      principalAllowlist: policy.principalAllowlist,
      collateralAllowlist: policy.collateralAllowlist,
      marketPolicies: policy.marketPolicies.map((p) => ({
        market: p.market,
        maxDepositAmount: p.maxDepositAmount,
        maxTotalDepositAmount: p.maxTotalDepositAmount,
        minLoanApyCbps: p.minLoanApyCbps,
        maxLtvBps: p.maxLtvBps,
        durationIndexesAllowlist: Buffer.from(p.durationIndexesAllowlist),
        collateralAssetAllowlist: p.collateralAssetAllowlist,
      })),
      sellLedgerPolicy: policy.sellLedgerPolicy,
    };
    return await this.client.base.extLoopscaleProgram.methods
      .setLendingPolicy(encodablePolicy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        integrationProgram: this.client.programId,
        integrationAuthority: this.client.integrationAuthorityPda,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: LoopscaleLendingPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setLendingPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async setLendingPolicyTx(
    policy: LoopscaleLendingPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setLendingPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearLendingPolicyIx(signer);
  }

  async clearLendingPolicyIx(
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.programId,
      LOOPSCALE_LENDING_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearLendingPolicyTx(txOptions);
  }

  async clearLendingPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.programId,
      LOOPSCALE_LENDING_PROTOCOL,
      txOptions,
    );
  }

  async createStrategyIx(
    params: CreateStrategyParams,
    accounts: CreateStrategyAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .createStrategy({
        lender: this.client.base.vaultPda,
        ...params,
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
}

export class LoopscaleVaultTxBuilder
  extends BaseTxBuilder<LoopscaleCoreClient>
  implements ProtocolPolicyTxBuilder<LoopscaleVaultPolicy>
{
  async setPolicyIx(
    policy: LoopscaleVaultPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.setVaultPolicyIx(policy, signer);
  }

  async setVaultPolicyIx(
    policy: LoopscaleVaultPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .setVaultPolicy({
        vaultAllowlist: policy.vaultAllowlist,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        integrationProgram: this.client.programId,
        integrationAuthority: this.client.integrationAuthorityPda,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: LoopscaleVaultPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setVaultPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async setVaultPolicyTx(
    policy: LoopscaleVaultPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setVaultPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearVaultPolicyIx(signer);
  }

  async clearVaultPolicyIx(
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.programId,
      LOOPSCALE_VAULT_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearVaultPolicyTx(txOptions);
  }

  async clearVaultPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.programId,
      LOOPSCALE_VAULT_PROTOCOL,
      txOptions,
    );
  }

  async depositUserVaultIx(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const { lpTokenProgram, principalTokenProgram } = accounts;
    return await this.client.base.extLoopscaleProgram.methods
      .depositUserVault(normalizeLoopscaleLpParams(params))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        vault: accounts.vault,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        lpMint: accounts.lpMint,
        userLpTa: this.client.base.getVaultAta(accounts.lpMint, lpTokenProgram),
        userPrincipalTa: this.client.base.getVaultAta(
          accounts.principalMint,
          principalTokenProgram,
        ),
        strategyPrincipalTa: this.client.getStrategyTokenAta(
          accounts.strategy,
          accounts.principalMint,
          principalTokenProgram,
        ),
        principalMint: accounts.principalMint,
        principalTokenProgram,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  depositUserVaultSetupIxs(
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): TransactionInstruction[] {
    return this.depositWithdrawUserVaultSetupIxs(accounts, signer);
  }

  async depositUserVaultIxs(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      ...this.depositUserVaultSetupIxs(accounts, signer),
      await this.depositUserVaultIx(params, accounts, signer),
    ];
  }

  async depositUserVaultTx(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ixs = await this.depositUserVaultIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async withdrawUserVaultIx(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const { lpTokenProgram, principalTokenProgram } = accounts;

    return await this.client.base.extLoopscaleProgram.methods
      .withdrawUserVault(normalizeLoopscaleLpParams(params))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        vault: accounts.vault,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        lpMint: accounts.lpMint,
        userLpTa: this.client.base.getVaultAta(accounts.lpMint, lpTokenProgram),
        userPrincipalTa: this.client.base.getVaultAta(
          accounts.principalMint,
          principalTokenProgram,
        ),
        strategyPrincipalTa: this.client.getStrategyTokenAta(
          accounts.strategy,
          accounts.principalMint,
          principalTokenProgram,
        ),
        principalMint: accounts.principalMint,
        principalTokenProgram,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async withdrawUserVaultIxs(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      ...this.depositWithdrawUserVaultSetupIxs(accounts, signer),
      await this.withdrawUserVaultIx(params, accounts, signer),
    ];
  }

  async withdrawUserVaultTx(
    params: LoopscaleLpParams,
    accounts: DepositWithdrawUserVaultAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ixs = await this.withdrawUserVaultIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async stakeUserVaultLpIx(
    params: LoopscaleVaultStakeParams,
    accounts: StakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = TOKEN_2022_PROGRAM_ID;
    const vaultStakeLpTa = this.client.getVaultStakeLpTokenAta(
      accounts.vaultStake,
      accounts.lpMint,
      tokenProgram,
    );
    return await this.client.base.extLoopscaleProgram.methods
      .stakeUserVaultLp(params)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        ...accounts,
        userLpTa: this.client.base.getVaultAta(accounts.lpMint, tokenProgram),
        vaultStakeLpTa,
        vaultRewardsInfo: this.client.getVaultRewardsInfoPda(accounts.vault),
        userRewardsInfo: this.client.getUserRewardsInfoPda(accounts.vaultStake),
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  stakeUserVaultLpSetupIxs(
    accounts: StakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): TransactionInstruction[] {
    const tokenProgram = TOKEN_2022_PROGRAM_ID;
    const payer = signer || this.client.base.signer;
    const ixs: TransactionInstruction[] = [];

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: accounts.lpMint,
        payer,
        owner: this.client.base.vaultPda,
        ata: this.client.base.getVaultAta(accounts.lpMint, tokenProgram),
        tokenProgram,
      }),
    );

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: accounts.lpMint,
        payer,
        owner: accounts.vaultStake,
        ata: this.client.getVaultStakeLpTokenAta(
          accounts.vaultStake,
          accounts.lpMint,
          tokenProgram,
        ),
        tokenProgram,
      }),
    );

    return ixs;
  }

  async stakeUserVaultLpIxs(
    params: LoopscaleVaultStakeParams,
    accounts: StakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      ...this.stakeUserVaultLpSetupIxs(accounts, signer),
      await this.stakeUserVaultLpIx(params, accounts, signer),
    ];
  }

  async stakeUserVaultLpTx(
    params: LoopscaleVaultStakeParams,
    accounts: StakeUserVaultLpAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ixs = await this.stakeUserVaultLpIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async unstakeUserVaultLpIx(
    params: LoopscaleVaultUnstakeParams,
    accounts: UnstakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = TOKEN_2022_PROGRAM_ID;
    return await this.client.base.extLoopscaleProgram.methods
      .unstakeUserVaultLp(params)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        ...accounts,
        userLpTa: this.client.base.getVaultAta(accounts.lpMint, tokenProgram),
        vaultStakeLpTa: this.client.getVaultStakeLpTokenAta(
          accounts.vaultStake,
          accounts.lpMint,
          tokenProgram,
        ),
        vaultRewardsInfo: this.client.getVaultRewardsInfoPda(accounts.vault),
        userRewardsInfo: this.client.getUserRewardsInfoPda(accounts.vaultStake),
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        protocolAdminState: LOOPSCALE_PROTOCOL_ADMIN_STATE,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  unstakeUserVaultLpSetupIxs(
    accounts: UnstakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): TransactionInstruction[] {
    const tokenProgram = TOKEN_2022_PROGRAM_ID;
    const payer = signer || this.client.base.signer;
    const ixs: TransactionInstruction[] = [];

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: accounts.lpMint,
        payer,
        owner: this.client.base.vaultPda,
        ata: this.client.base.getVaultAta(accounts.lpMint, tokenProgram),
        tokenProgram,
      }),
    );
    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: accounts.lpMint,
        payer,
        owner: accounts.vaultStake,
        ata: this.client.getVaultStakeLpTokenAta(
          accounts.vaultStake,
          accounts.lpMint,
          tokenProgram,
        ),
        tokenProgram,
      }),
    );

    return ixs;
  }

  async unstakeUserVaultLpIxs(
    params: LoopscaleVaultUnstakeParams,
    accounts: UnstakeUserVaultLpAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return [
      ...this.unstakeUserVaultLpSetupIxs(accounts, signer),
      await this.unstakeUserVaultLpIx(params, accounts, signer),
    ];
  }

  async unstakeUserVaultLpTx(
    params: LoopscaleVaultUnstakeParams,
    accounts: UnstakeUserVaultLpAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ixs = await this.unstakeUserVaultLpIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async claimVaultRewardsIx(
    mints: PublicKey[],
    accounts: ClaimVaultRewardsAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const instruction = this.client.base.extLoopscaleProgram.methods
      .claimVaultRewards(mints)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.integrationAuthorityPda,
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        vault: accounts.vault,
        vaultRewardsInfo:
          accounts.vaultRewardsInfo ||
          this.client.getVaultRewardsInfoPda(accounts.vault),
        userRewardsInfo:
          accounts.userRewardsInfo ||
          this.client.getUserRewardsInfoPda(accounts.vaultStake),
        stakeAccount: accounts.vaultStake,
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

  async claimVaultRewardsTx(
    mints: PublicKey[],
    accounts: ClaimVaultRewardsAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.claimVaultRewardsIx(
      mints,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  private depositWithdrawUserVaultSetupIxs(
    accounts: DepositWithdrawUserVaultAccounts,
    signer?: PublicKey,
  ): TransactionInstruction[] {
    const {
      strategy,
      lpMint,
      principalMint,
      lpTokenProgram,
      principalTokenProgram,
    } = accounts;
    const payer = signer || this.client.base.signer;
    const ixs: TransactionInstruction[] = [];

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: lpMint,
        payer,
        owner: this.client.base.vaultPda,
        ata: this.client.base.getVaultAta(lpMint, lpTokenProgram),
        tokenProgram: lpTokenProgram,
      }),
    );

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: principalMint,
        payer,
        owner: this.client.base.vaultPda,
        ata: this.client.base.getVaultAta(principalMint, principalTokenProgram),
        tokenProgram: principalTokenProgram,
      }),
    );

    ixs.push(
      createVaultTokenAtaSetupIx({
        mint: principalMint,
        payer,
        owner: strategy,
        ata: this.client.getStrategyTokenAta(
          strategy,
          principalMint,
          principalTokenProgram,
        ),
        tokenProgram: principalTokenProgram,
      }),
    );

    return ixs;
  }
}

export class LoopscaleCoreClient {
  readonly borrowTxBuilder: LoopscaleBorrowTxBuilder;
  readonly lendTxBuilder: LoopscaleLendTxBuilder;
  readonly vaultTxBuilder: LoopscaleVaultTxBuilder;

  public constructor(readonly base: BaseClient) {
    this.borrowTxBuilder = new LoopscaleBorrowTxBuilder(this);
    this.lendTxBuilder = new LoopscaleLendTxBuilder(this);
    this.vaultTxBuilder = new LoopscaleVaultTxBuilder(this);
  }

  get programId(): PublicKey {
    return this.base.extLoopscaleProgram.programId;
  }

  get integrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.programId);
  }

  getEventAuthorityPda(): PublicKey {
    return getLoopscaleEventAuthorityPda();
  }

  getLoanPda(nonce: BN, borrower: PublicKey = this.base.vaultPda) {
    return getLoopscaleLoanPda(borrower, nonce);
  }

  getStrategyPda(nonce: PublicKey) {
    return getLoopscaleStrategyPda(nonce);
  }

  getVaultPda(vaultNonce: PublicKey) {
    return getLoopscaleVaultPda(vaultNonce);
  }

  getVaultStrategyPda(vault: PublicKey) {
    return getLoopscaleVaultStrategyPda(vault);
  }

  getVaultRewardsInfoPda(vault: PublicKey) {
    return getLoopscaleVaultRewardsInfoPda(vault);
  }

  getVaultStakePda(stakeNonce: PublicKey, vault: PublicKey) {
    return getLoopscaleVaultStakePda(stakeNonce, vault);
  }

  getUserRewardsInfoPda(vaultStake: PublicKey) {
    return getLoopscaleUserRewardsInfoPda(vaultStake);
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

  getVaultLpTokenAta(
    lpMint: PublicKey,
    owner: PublicKey = this.base.vaultPda,
    tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(lpMint, owner, true, tokenProgram);
  }

  getVaultStakeLpTokenAta(
    vaultStake: PublicKey,
    lpMint: PublicKey,
    tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      lpMint,
      vaultStake,
      true,
      tokenProgram,
    );
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

  async fetchRegisteredVaultStakeAccountInfos(
    commitment?: Commitment,
  ): Promise<{ address: PublicKey; info: Web3AccountInfo<Buffer> }[]> {
    const { externalPositions } = await this.base.fetchStateAccount();
    const registeredPositions = externalPositions ?? [];
    const positions: { address: PublicKey; info: Web3AccountInfo<Buffer> }[] =
      [];
    const chunkSize = 100;

    for (let i = 0; i < registeredPositions.length; i += chunkSize) {
      const chunk = registeredPositions.slice(i, i + chunkSize);
      const accounts = await this.base.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accounts.forEach((account, index) => {
        if (isLoopscaleVaultStakeAccountInfo(account)) {
          positions.push({ address: chunk[index], info: account });
        }
      });
    }

    return positions;
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

  assertStrategyPrincipalWithdrawable(
    strategy: LoopscaleStrategy,
    amount: BN,
    withdrawAll: boolean,
  ): void {
    const address = strategy.getAddress();
    if (withdrawAll && strategy.tokenBalance.isZero()) {
      const externalYieldMessage = strategy.externalYieldAmount.isZero()
        ? ""
        : ` Strategy external yield amount is ${strategy.externalYieldAmount}; specify an explicit amount to withdraw it.`;
      throw new Error(
        `Strategy ${address} has no undeployed principal for --all; token balance is 0.${externalYieldMessage}`,
      );
    }

    const explicitWithdrawableAmount = strategy.tokenBalance.add(
      strategy.externalYieldAmount,
    );
    if (!withdrawAll && amount.gt(explicitWithdrawableAmount)) {
      throw new Error(
        `Strategy ${address} has only ${explicitWithdrawableAmount} withdrawable amount; requested ${amount}.`,
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
   * Resolves the market-derived inputs for sell_ledger. Loopscale's sell API
   * emits principal/collateral asset-index hints plus the matching price oracle
   * remaining accounts.
   */
  async resolveSellLedgerMarketAccounts(params: {
    loan: PublicKey | LoopscaleLoan;
    ledgerIndex: number;
    newStrategy: PublicKey | LoopscaleStrategy;
  }): Promise<LoopscaleSellLedgerTerms> {
    const loanInfo =
      params.loan instanceof PublicKey
        ? await this.fetchLoan(params.loan)
        : params.loan;
    const ledger = loanInfo.ledgers[params.ledgerIndex];
    if (!ledger || ledger.status === 0) {
      throw new Error(
        `Loan ${loanInfo.getAddress()} has no active ledger at index ${params.ledgerIndex}`,
      );
    }

    const newStrategyInfo =
      params.newStrategy instanceof PublicKey
        ? await this.fetchStrategy(params.newStrategy)
        : params.newStrategy;
    const newStrategy =
      params.newStrategy instanceof PublicKey
        ? params.newStrategy
        : newStrategyInfo.getAddress();

    if (!newStrategyInfo.principalMint.equals(ledger.principalMint)) {
      throw new Error(
        `New strategy principal mint ${newStrategyInfo.principalMint} does not match ledger principal mint ${ledger.principalMint}`,
      );
    }
    if (!newStrategyInfo.marketInformation.equals(ledger.marketInformation)) {
      throw new Error(
        `New strategy market ${newStrategyInfo.marketInformation} does not match ledger market ${ledger.marketInformation}`,
      );
    }

    const marketInfo = await this.fetchMarketInformation(
      ledger.marketInformation,
    );
    if (!marketInfo.principalMint.equals(ledger.principalMint)) {
      throw new Error(
        `Market principal mint ${marketInfo.principalMint} does not match ledger principal mint ${ledger.principalMint}`,
      );
    }

    const collateralSlot = loanInfo.weightMatrix.findIndex(
      (row) => row[params.ledgerIndex] > 0,
    );
    if (collateralSlot === -1) {
      throw new Error(
        `Loan ${loanInfo.getAddress()} has no collateral weight for ledger index ${params.ledgerIndex}`,
      );
    }
    const collateral = loanInfo.collateral[collateralSlot];
    if (
      !collateral ||
      collateral.amount.isZero() ||
      collateral.assetIdentifier.equals(PublicKey.default)
    ) {
      throw new Error(
        `Loan ${loanInfo.getAddress()} collateral slot ${collateralSlot} is empty`,
      );
    }

    const collateralAssetIndex = this.requireAssetIndex(
      marketInfo,
      collateral.assetIdentifier,
      "collateral asset identifier",
    );
    const principalAssetIndex = this.requireAssetIndex(
      marketInfo,
      ledger.principalMint,
      "principal mint",
    );
    const guidance = {
      principalAssetIndex,
      collateralAssetIndex,
    };
    const remainingAccounts = [
      this.requireMarketAssetInfo(marketInfo, principalAssetIndex, "principal")
        .oracleAccount,
      this.requireMarketAssetInfo(
        marketInfo,
        collateralAssetIndex,
        "collateral",
      ).oracleAccount,
    ].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    return {
      ledgerIndex: params.ledgerIndex,
      oldStrategy: ledger.strategy,
      newStrategy,
      oldStrategyMarketInformation: ledger.marketInformation,
      newStrategyMarketInformation: newStrategyInfo.marketInformation,
      principalMint: ledger.principalMint,
      assetIndexGuidance: encodeLoopscaleSellLedgerAssetIndexGuidance(guidance),
      guidance,
      remainingAccounts,
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

  private requireMarketAssetInfo(
    marketInfo: LoopscaleMarketInformation,
    assetIndex: number,
    label: string,
  ) {
    const assetInfo = marketInfo.assetData[assetIndex];
    if (!assetInfo) {
      throw new Error(
        `Loopscale market is missing ${label} asset data at index ${assetIndex}`,
      );
    }
    return assetInfo;
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

  async decompileApiMessage(
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
            `Loopscale API message references missing address lookup table ${lookup.accountKey}`,
          );
        }
        addressLookupTableAccounts.push(result.value);
      }
    }

    return TransactionMessage.decompile(versionedMessage, {
      addressLookupTableAccounts,
    }).instructions;
  }

  mapApiIx(ix: TransactionInstruction): TransactionInstruction {
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

  addUpdateStrategyValidationMarket(
    ix: TransactionInstruction,
    marketInformation: PublicKey,
  ): TransactionInstruction {
    const keys = [...ix.keys];
    keys.splice(GLAM_UPDATE_STRATEGY_ACCOUNT_COUNT, 0, {
      pubkey: marketInformation,
      isSigner: false,
      isWritable: false,
    });
    return new TransactionInstruction({
      programId: ix.programId,
      keys,
      data: ix.data,
    });
  }

  addDepositCollateralLedgerAccounts(
    ixs: TransactionInstruction[],
  ): TransactionInstruction[] {
    return ixs.map((ix, index) => {
      if (
        !ix.data
          .subarray(0, LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR.length)
          .equals(LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR) ||
        ix.keys.length > GLAM_DEPOSIT_COLLATERAL_ACCOUNT_COUNT
      ) {
        return ix;
      }

      const loan = ix.keys[8]?.pubkey;
      if (!loan) {
        return ix;
      }
      const assetIndexGuidanceOffset = 8 + 8 + 1 + 32;
      if (ix.data.length < assetIndexGuidanceOffset + 4) {
        return ix;
      }
      const assetIndexGuidanceLen = ix.data.readUInt32LE(
        assetIndexGuidanceOffset,
      );
      if (assetIndexGuidanceLen === 0) {
        return ix;
      }
      const weightIx = ixs.slice(index + 1).find((candidate) => {
        return (
          candidate.data
            .subarray(0, LOOPSCALE_UPDATE_WEIGHT_MATRIX_DISCRIMINATOR.length)
            .equals(LOOPSCALE_UPDATE_WEIGHT_MATRIX_DISCRIMINATOR) &&
          candidate.keys[8]?.pubkey.equals(loan) &&
          candidate.keys.length >
            GLAM_UPDATE_WEIGHT_MATRIX_ACCOUNT_COUNT + assetIndexGuidanceLen
        );
      });
      if (!weightIx) {
        return ix;
      }
      const healthAccounts = weightIx.keys.slice(
        GLAM_UPDATE_WEIGHT_MATRIX_ACCOUNT_COUNT,
      );

      return new TransactionInstruction({
        programId: ix.programId,
        keys: [...ix.keys, ...healthAccounts],
        data: ix.data,
      });
    });
  }

  setDepositCollateralAssetIndexGuidance(
    ixs: TransactionInstruction[],
    assetIndexGuidance: number[],
  ): TransactionInstruction[] {
    if (assetIndexGuidance.length === 0) {
      return ixs;
    }

    return ixs.map((ix) => {
      if (
        !ix.data
          .subarray(0, LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR.length)
          .equals(LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR)
      ) {
        return ix;
      }

      const assetIndexGuidanceOffset = 8 + 8 + 1 + 32;
      const fixedData = ix.data.subarray(0, assetIndexGuidanceOffset);
      const guidance = Buffer.from(assetIndexGuidance);
      const guidanceLength = Buffer.alloc(4);
      guidanceLength.writeUInt32LE(guidance.length, 0);

      return new TransactionInstruction({
        programId: ix.programId,
        keys: ix.keys,
        data: Buffer.concat([fixedData, guidanceLength, guidance]),
      });
    });
  }

  getApiUpdateWeightMatrixAssetIndexGuidance(
    ixs: TransactionInstruction[],
    loan: PublicKey,
  ): number[] {
    const updateWeightIx = ixs.find((ix) => {
      return (
        ix.data
          .subarray(0, LOOPSCALE_UPDATE_WEIGHT_MATRIX_DISCRIMINATOR.length)
          .equals(LOOPSCALE_UPDATE_WEIGHT_MATRIX_DISCRIMINATOR) &&
        ix.keys[8]?.pubkey.equals(loan) &&
        ix.keys.length > GLAM_UPDATE_WEIGHT_MATRIX_ACCOUNT_COUNT
      );
    });
    if (!updateWeightIx) {
      return [];
    }

    const guidanceOffset = 8 + 1 + 5 * 4 + 8 + 5 * 4;
    if (updateWeightIx.data.length < guidanceOffset + 4) {
      return [];
    }
    const guidanceLen = updateWeightIx.data.readUInt32LE(guidanceOffset);
    const guidanceStart = guidanceOffset + 4;
    if (updateWeightIx.data.length < guidanceStart + guidanceLen) {
      return [];
    }
    return Array.from(
      updateWeightIx.data.subarray(guidanceStart, guidanceStart + guidanceLen),
    );
  }

  /**
   * Decompiles instructions from transaction messages and maps eligible ones to GLAM instructions
   *
   * @param messages Serialized transaction messages.
   * @param expectedDiscriminator Discriminator to look for in the instructions.
   * @returns
   */
  async mapApiMessagesToGlamIxs(
    messages: string[],
    expectedDiscriminator: Buffer,
  ): Promise<TransactionInstruction[]> {
    const mappedIxs: TransactionInstruction[] = [];
    let sawExpectedInstruction = false;

    for (const message of messages) {
      const apiIxs = await this.decompileApiMessage(message);
      for (const ix of apiIxs) {
        // Skip mapping Compute Budget program instructions
        if (ix.programId.equals(ComputeBudgetProgram.programId)) {
          continue;
        }

        // Skip mapping Loopscale loan lock/unlock instructions
        if (isSkippableLoopscaleLoanLockIx(ix.data)) {
          continue;
        }

        if (!ix.programId.equals(LOOPSCALE_PROGRAM_ID)) {
          throw new Error(
            `Loopscale API returned unsupported setup instruction for program ${ix.programId}`,
          );
        }

        if (
          ix.data
            .subarray(0, expectedDiscriminator.length)
            .equals(expectedDiscriminator)
        ) {
          sawExpectedInstruction = true;
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

  /**
   * Fetches a transaction from the Loopscale API
   *
   * @param path API endpoint path.
   * @param init Request initialization options.
   * @returns
   */
  async fetchApiTransaction(
    path: string,
    init: RequestInit,
  ): Promise<LoopscaleApiTransactionPayload> {
    const response = await fetch(`${LOOPSCALE_API_URL}${path}`, {
      ...init,
      method: "POST",
    });
    const endpoint = `POST ${path}`;
    if (!response.ok) {
      throw new Error(
        `Loopscale API ${endpoint} failed (${response.status}): ${await response.text()}`,
      );
    }
    const payload = (await response.json()) as LoopscaleApiTransactionPayload;
    if (getLoopscaleApiMessages(payload).length === 0) {
      throw new Error(
        `Loopscale API ${endpoint} returned no transaction message`,
      );
    }
    return payload;
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

  async coSignAndSend(
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
      identifier: `glam-loopscale-${Date.now()}-${identifierSuffix}`,
    });
    return await this.base.sendAndConfirm(cosignedTx);
  }

  async sendCosignedIxBatches(
    txs: LoopscaleMappedTransaction[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature[]> {
    const txSigs: TransactionSignature[] = [];
    for (let i = 0; i < txs.length; i++) {
      const { ixs, additionalSigners } = txs[i];
      txSigs.push(
        await this.coSignAndSend(ixs, txOptions, additionalSigners, `-${i}`),
      );
    }
    return txSigs;
  }

  async getBaseAssetOracle(): Promise<PublicKey> {
    const { baseAssetMint } = await this.base.fetchStateModel();
    return (await this.base.getAssetMeta(baseAssetMint)).oracle;
  }
}
