import { PublicKey } from "@solana/web3.js";
import { DriftPerpMarket, DriftSpotMarket } from "../../deser/driftLayouts";

export const DRIFT_SIGNER = new PublicKey(
  "JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw",
);
export const DRIFT_MARGIN_PRECISION = 10_000;

export interface OrderConstants {
  perpBaseScale: number;
  quoteScale: number;
}

export interface DriftMarketConfigs {
  orderConstants: OrderConstants;
  perpMarkets: DriftPerpMarket[];
  spotMarkets: DriftSpotMarket[];
}
