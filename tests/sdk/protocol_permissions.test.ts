import {
  getExtBridgeProgramId,
  getExtJupiterProgramId,
  getExtKaminoProgramId,
  getExtPhoenixProgramId,
  getExtOrcaProgramId,
  getGlamMintProgramId,
  getGlamProtocolProgramId,
} from "../../src/glamExports";
import { getProtocolsAndPermissions } from "../../src/constants";
import {
  GLAM_MINT_PROTOCOL,
  JUPITER_BORROW_PROTOCOL,
  JUPITER_EARN_PROTOCOL,
  JUPITER_SWAP_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  LAYERZERO_OFT_PROTOCOL,
  ORCA_WHIRLPOOLS_PROTOCOL,
  PHOENIX_PROTOCOL,
  SYSTEM_PROTOCOL,
} from "../../src/protocols";

const protocolBitflagKey = (bitflag: number) =>
  bitflag.toString(2).padStart(16, "0");

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
        getPermissionNames(
          staging,
          glamProtocolProgramId,
          protocolBitflagKey(SYSTEM_PROTOCOL),
        ),
      ).toEqual(["WSOL", "Transfer"]);
      expect(
        getPermissionNames(
          staging,
          glamProtocolProgramId,
          protocolBitflagKey(JUPITER_SWAP_PROTOCOL),
        ),
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
          protocolBitflagKey(GLAM_MINT_PROTOCOL),
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
          protocolBitflagKey(KAMINO_LENDING_PROTOCOL),
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
          getExtPhoenixProgramId(staging).toBase58(),
          protocolBitflagKey(PHOENIX_PROTOCOL),
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
          protocolBitflagKey(JUPITER_EARN_PROTOCOL),
        ),
      ).toEqual(["Deposit", "Withdraw"]);

      expect(
        getPermissionNames(
          staging,
          getExtJupiterProgramId(staging).toBase58(),
          protocolBitflagKey(JUPITER_BORROW_PROTOCOL),
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
          protocolBitflagKey(ORCA_WHIRLPOOLS_PROTOCOL),
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
          protocolBitflagKey(LAYERZERO_OFT_PROTOCOL),
        ),
      ).toEqual(["Send", "Validate", "Settle"]);
    },
  );
});
