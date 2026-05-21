import {
  getExtBridgeProgramId,
  getExtJupiterProgramId,
  getExtKaminoProgramId,
  getExtLoopscaleProgramId,
  getExtPhoenixProgramId,
  getExtOrcaProgramId,
  getGlamMintProgramId,
  getGlamProtocolProgramId,
} from "../../src/glamExports";
import { getProtocolsAndPermissions } from "../../src/constants";

const getPermissionNames = (
  staging: boolean,
  programId: string,
  protocolBitflag: string,
) =>
  Object.values(
    getProtocolsAndPermissions(staging)[programId][protocolBitflag].permissions,
  );

describe("getProtocolsAndPermissions", () => {
  it.each([false, true])(
    "matches Rust ACL constants for staging=%s",
    (staging) => {
      const glamProtocolProgramId =
        getGlamProtocolProgramId(staging).toBase58();
      expect(
        getPermissionNames(staging, glamProtocolProgramId, "0000000000000001"),
      ).toEqual(["WSOL", "Transfer"]);
      expect(
        getPermissionNames(staging, glamProtocolProgramId, "0000000000000100"),
      ).toEqual([
        "SwapToAny",
        "SwapLST",
        "SwapAllowlisted",
        "SwapFromAny",
        "SkipQuotePriceCheckLimited",
        "SkipQuotePriceCheck",
      ]);

      expect(
        getPermissionNames(
          staging,
          getGlamMintProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual([
        "MintTokens",
        "BurnTokens",
        "ForceTransfer",
        "SetTokenAccountState",
        "ClaimFees",
        "Fulfill",
        "EmergencyUpdate",
        "CancelRequest",
        "ClaimRequest",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtKaminoProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual([
        "Init",
        "Deposit",
        "Withdraw",
        "Borrow",
        "Repay",
        "Liquidate",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtLoopscaleProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual([
        "ManageLoan",
        "DepositCollateral",
        "WithdrawCollateral",
        "BorrowPrincipal",
        "RepayPrincipal",
        "RefinanceLedger",
        "DepositUserVault",
        "WithdrawUserVault",
        "StakeUserVaultLp",
        "UnstakeUserVaultLp",
        "ClaimVaultRewards",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtPhoenixProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual([
        "InitTrader",
        "Deposit",
        "Withdraw",
        "CreateModifyOrders",
        "CancelOrders",
        "TransferCollateral",
        "UpdateTraderState",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtJupiterProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual(["Deposit", "Withdraw"]);

      expect(
        getPermissionNames(
          staging,
          getExtJupiterProgramId(staging).toBase58(),
          "0000000000000010",
        ),
      ).toEqual([
        "InitPosition",
        "DepositCollateral",
        "WithdrawCollateral",
        "Borrow",
        "Repay",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtOrcaProgramId(staging).toBase58(),
          "0000000000000001",
        ),
      ).toEqual([
        "OpenPosition",
        "IncreaseLiquidity",
        "DecreaseLiquidity",
        "UpdateFeesAndRewards",
        "CollectFees",
        "CollectReward",
        "ClosePosition",
        "IncreaseLiquidityByTokenAmounts",
        "RepositionLiquidity",
        "InitializeTickArray",
      ]);

      expect(
        getPermissionNames(
          staging,
          getExtBridgeProgramId(staging).toBase58(),
          "0000000000000100",
        ),
      ).toEqual(["Send", "Validate", "Settle"]);
    },
  );
});
