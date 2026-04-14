import { GlamClientConfig } from "./clientConfig";
import { BaseClient } from "./client/base";
import { JupiterSwapClient } from "./client/jupiter";
import { MarinadeClient } from "./client/marinade";
import { VaultClient } from "./client/vault";
import { StateClient } from "./client/state";
import {
  KaminoLendingClient,
  KaminoFarmClient,
  KaminoVaultsClient,
} from "./client/kamino";
import { InvestClient } from "./client/invest";
import { PriceClient } from "./client/price";
import { FeesClient } from "./client/fees";
import { MintClient } from "./client/mint";
import { AccessClient } from "./client/access";
import { TimelockClient } from "./client/timelock";
import { StakeClient } from "./client/stake";
import { StakePoolClient } from "./client/stake-pool";
import { CctpClient } from "./client/cctp";
import { BridgeClient } from "./client/bridge";

/**
 * Main entrypoint for the GLAM SDK
 *
 * Lazy loads each client/module at first use
 */
export class GlamClient extends BaseClient {
  private _invest?: InvestClient;
  private _jupiterSwap?: JupiterSwapClient;
  private _marinade?: MarinadeClient;
  private _vault?: VaultClient;
  private _price?: PriceClient;
  private _stake?: StakeClient;
  private _stakePool?: StakePoolClient;
  private _state?: StateClient;
  private _mint?: MintClient;
  private _access?: AccessClient;
  private _kaminoLending?: KaminoLendingClient;
  private _kaminoFarm?: KaminoFarmClient;
  private _kaminoVaults?: KaminoVaultsClient;
  private _fees?: FeesClient;
  private _timelock?: TimelockClient;
  private _cctp?: CctpClient;
  private _bridge?: BridgeClient;

  public constructor(config?: GlamClientConfig) {
    super(config);
  }

  get invest(): InvestClient {
    if (!this._invest) {
      this._invest = new InvestClient(this);
    }
    return this._invest;
  }

  get fees(): FeesClient {
    if (!this._fees) {
      this._fees = new FeesClient(this, this.price);
    }
    return this._fees;
  }

  get jupiterSwap(): JupiterSwapClient {
    if (!this._jupiterSwap) {
      this._jupiterSwap = new JupiterSwapClient(this, this.vault);
    }
    return this._jupiterSwap;
  }

  get marinade(): MarinadeClient {
    if (!this._marinade) {
      this._marinade = new MarinadeClient(this, this.stake);
    }
    return this._marinade;
  }

  get vault(): VaultClient {
    if (!this._vault) {
      this._vault = new VaultClient(this);
    }
    return this._vault;
  }

  get stake(): StakeClient {
    if (!this._stake) {
      this._stake = new StakeClient(this);
    }
    return this._stake;
  }

  get stakePool(): StakePoolClient {
    if (!this._stakePool) {
      this._stakePool = new StakePoolClient(this, this.stake, this.marinade);
    }
    return this._stakePool;
  }

  get price(): PriceClient {
    if (!this._price) {
      this._price = new PriceClient(
        this,
        this.kaminoLending,
        this.kaminoVaults,
        () => this.jupiterSwap.jupApi,
      );
    }
    return this._price;
  }

  get state(): StateClient {
    if (!this._state) {
      this._state = new StateClient(this);
    }
    return this._state;
  }

  get access(): AccessClient {
    if (!this._access) {
      this._access = new AccessClient(this);
    }
    return this._access;
  }

  get mint(): MintClient {
    if (!this._mint) {
      this._mint = new MintClient(this, () => this.price);
    }
    return this._mint;
  }

  get kaminoLending(): KaminoLendingClient {
    if (!this._kaminoLending) {
      this._kaminoLending = new KaminoLendingClient(this, this.vault);
    }
    return this._kaminoLending;
  }

  get kaminoFarm(): KaminoFarmClient {
    if (!this._kaminoFarm) {
      this._kaminoFarm = new KaminoFarmClient(this, this.kaminoLending);
    }
    return this._kaminoFarm;
  }

  get kaminoVaults(): KaminoVaultsClient {
    if (!this._kaminoVaults) {
      this._kaminoVaults = new KaminoVaultsClient(this, this.kaminoLending);
    }
    return this._kaminoVaults;
  }

  get timelock(): TimelockClient {
    if (!this._timelock) {
      this._timelock = new TimelockClient(this, this.state);
    }
    return this._timelock;
  }

  get cctp(): CctpClient {
    if (!this._cctp) {
      this._cctp = new CctpClient(this);
    }
    return this._cctp;
  }

  get bridge(): BridgeClient {
    if (!this._bridge) {
      this._bridge = new BridgeClient(this);
    }
    return this._bridge;
  }
}
