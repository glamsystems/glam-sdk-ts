import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";

import { PriceClient } from "../../src/client/price";
import {
  LOOPSCALE_BORROW_PROTOCOL,
  LOOPSCALE_LENDING_PROTOCOL,
  LOOPSCALE_VAULT_PROTOCOL,
} from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap } from "../../src/utils";

const LOOPSCALE_PROTOCOLS =
  LOOPSCALE_BORROW_PROTOCOL |
  LOOPSCALE_LENDING_PROTOCOL |
  LOOPSCALE_VAULT_PROTOCOL;

function pk(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[31] = seed;
  return new PublicKey(bytes);
}

function ix(programId: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ keys: [], programId });
}

function tokenAccountData(mint: PublicKey, amount: bigint): Buffer {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint,
      owner: pk(1),
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return data;
}

function createPriceClient(params: {
  externalPositions?: PublicKey[];
  loopscaleProtocolsBitmask?: number;
  jupiterApi?: any;
}) {
  const extLoopscaleProgramId = pk(41);
  const base = {
    fetchStateModel: jest.fn().mockResolvedValue({
      accountType: StateAccountType.VAULT,
      externalPositions: params.externalPositions ?? [pk(51)],
      integrationAcls: [
        {
          integrationProgram: extLoopscaleProgramId,
          protocolsBitmask: params.loopscaleProtocolsBitmask ?? 0,
        },
      ],
    }),
    fetchAssetMetas: jest.fn().mockResolvedValue(new Map()),
    extKaminoProgram: { programId: pk(42) },
    extLoopscaleProgram: { programId: extLoopscaleProgramId },
    extRpiProgram: { programId: pk(43) },
    protocolProgram: { programId: pk(44) },
    extBridgeProgram: { programId: pk(45) },
    extPhoenixProgram: { programId: pk(46) },
    extOrcaProgram: { programId: pk(47) },
    extNeutralProgram: { programId: pk(48) },
  } as any;

  const loopscaleBorrow = {
    getPriceLoansAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const loopscaleLend = {
    getPriceStrategiesAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const loopscaleVault = {
    getPriceVaultsAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const bridge = {
    txBuilder: {
      priceManagedTransfersIxs: jest.fn().mockResolvedValue(null),
    },
  } as any;

  const client = new PriceClient(
    base,
    {} as any,
    {} as any,
    bridge,
    {} as any,
    loopscaleBorrow,
    loopscaleLend,
    loopscaleVault,
    () => params.jupiterApi ?? ({} as any),
  );

  return {
    client,
    base,
    loopscaleBorrow,
    loopscaleLend,
    loopscaleVault,
    bridge,
  };
}

describe("PriceClient", () => {
  it("appends loopscale loan, strategy, and vault pricing when the loopscale ACL is enabled", async () => {
    const priceVaultIx = ix(pk(61));
    const priceLoansIx = ix(pk(62));
    const priceStrategiesIx = ix(pk(63));
    const priceLoopscaleVaultPositionsInstruction = ix(pk(64));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_PROTOCOLS,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIx")
      .mockResolvedValue(priceLoansIx);
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIx")
      .mockResolvedValue(priceStrategiesIx);
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIx")
      .mockResolvedValue(priceLoopscaleVaultPositionsInstruction);

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([
      priceVaultIx,
      priceLoansIx,
      priceStrategiesIx,
      priceLoopscaleVaultPositionsInstruction,
    ]);
  });

  it("appends loopscale vault pricing when only the loopscale vault ACL is enabled", async () => {
    const priceVaultIx = ix(pk(65));
    const priceLoopscaleVaultPositionsInstruction = ix(pk(66));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_VAULT_PROTOCOL,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIx")
      .mockResolvedValue(ix(pk(67)));
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIx")
      .mockResolvedValue(ix(pk(68)));
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIx")
      .mockResolvedValue(priceLoopscaleVaultPositionsInstruction);

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).not.toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).not.toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([
      priceVaultIx,
      priceLoopscaleVaultPositionsInstruction,
    ]);
  });

  it("skips loopscale loan pricing when the loopscale ACL is disabled", async () => {
    const priceVaultIx = ix(pk(71));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: 0,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIx")
      .mockResolvedValue(ix(pk(72)));
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIx")
      .mockResolvedValue(ix(pk(73)));
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIx")
      .mockResolvedValue(ix(pk(74)));

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).not.toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).not.toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).not.toHaveBeenCalled();
    expect(ixs).toEqual([priceVaultIx]);
  });

  it("keeps only vault pricing when loopscale pricing returns no instructions", async () => {
    const priceVaultIx = ix(pk(81));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_PROTOCOLS,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIx")
      .mockResolvedValue(null);
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIx")
      .mockResolvedValue(null);
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIx")
      .mockResolvedValue(null);

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([priceVaultIx]);
  });

  it("priceLoopscaleLoansIx builds via the mint program with ordered loan and oracle accounts", async () => {
    const statePda = pk(91);
    const solUsdOracle = pk(92);
    const baseAssetOracle = pk(93);
    const loanA = pk(94);
    const loanB = pk(95);
    const oracleA = pk(96);
    const oracleB = pk(97);
    const builtIx = ix(pk(98));

    const instructionBuilder = {
      accounts: jest.fn().mockReturnThis(),
      remainingAccounts: jest.fn().mockReturnThis(),
      instruction: jest.fn().mockResolvedValue(builtIx),
    };
    const priceLoopscaleLoans = jest.fn().mockReturnValue(instructionBuilder);

    const base = {
      statePda,
      mintProgram: { methods: { priceLoopscaleLoans } },
      getSolOracle: jest.fn().mockResolvedValue(solUsdOracle),
    } as any;
    const loopscaleBorrow = {
      getPriceLoansAccounts: jest.fn().mockResolvedValue({
        loanAccounts: [loanA, loanB],
        oracleAccounts: [oracleA, oracleB],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleBorrow,
      {} as any,
      {} as any,
      () => ({}) as any,
    );
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(baseAssetOracle);

    const result = await client.priceLoopscaleLoansIx();

    expect(result).toBe(builtIx);
    expect(loopscaleBorrow.getPriceLoansAccounts).toHaveBeenCalled();
    expect(base.getSolOracle).toHaveBeenCalled();
    expect(instructionBuilder.accounts).toHaveBeenCalledWith({
      glamState: statePda,
      solUsdOracle,
      baseAssetOracle,
    });
    expect(instructionBuilder.remainingAccounts).toHaveBeenCalledWith([
      { pubkey: loanA, isSigner: false, isWritable: false },
      { pubkey: loanB, isSigner: false, isWritable: false },
      { pubkey: oracleA, isSigner: false, isWritable: false },
      { pubkey: oracleB, isSigner: false, isWritable: false },
    ]);
  });

  it("priceLoopscaleLoansIx returns null when there are no loopscale loans", async () => {
    const priceLoopscaleLoans = jest.fn();
    const base = {
      statePda: pk(91),
      mintProgram: { methods: { priceLoopscaleLoans } },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleBorrow = {
      getPriceLoansAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleBorrow,
      {} as any,
      {} as any,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleLoansIx()).toBeNull();
    expect(priceLoopscaleLoans).not.toHaveBeenCalled();
  });

  it("priceLoopscaleStrategiesIx builds via the mint program with ordered strategy and oracle accounts", async () => {
    const statePda = pk(101);
    const solUsdOracle = pk(102);
    const baseAssetOracle = pk(103);
    const strategyA = pk(104);
    const strategyB = pk(105);
    const oracleA = pk(106);
    const oracleB = pk(107);
    const builtIx = ix(pk(108));

    const instructionBuilder = {
      accounts: jest.fn().mockReturnThis(),
      remainingAccounts: jest.fn().mockReturnThis(),
      instruction: jest.fn().mockResolvedValue(builtIx),
    };
    const priceLoopscaleStrategies = jest
      .fn()
      .mockReturnValue(instructionBuilder);

    const base = {
      statePda,
      mintProgram: { methods: { priceLoopscaleStrategies } },
      getSolOracle: jest.fn().mockResolvedValue(solUsdOracle),
    } as any;
    const loopscaleLend = {
      getPriceStrategiesAccounts: jest.fn().mockResolvedValue({
        strategyAccounts: [strategyA, strategyB],
        oracleAccounts: [oracleA, oracleB],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleLend,
      {} as any,
      () => ({}) as any,
    );
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(baseAssetOracle);

    const result = await client.priceLoopscaleStrategiesIx();

    expect(result).toBe(builtIx);
    expect(loopscaleLend.getPriceStrategiesAccounts).toHaveBeenCalled();
    expect(base.getSolOracle).toHaveBeenCalled();
    expect(instructionBuilder.accounts).toHaveBeenCalledWith({
      glamState: statePda,
      solUsdOracle,
      baseAssetOracle,
    });
    expect(instructionBuilder.remainingAccounts).toHaveBeenCalledWith([
      { pubkey: strategyA, isSigner: false, isWritable: false },
      { pubkey: strategyB, isSigner: false, isWritable: false },
      { pubkey: oracleA, isSigner: false, isWritable: false },
      { pubkey: oracleB, isSigner: false, isWritable: false },
    ]);
  });

  it("priceLoopscaleStrategiesIx returns null when there are no loopscale strategies", async () => {
    const priceLoopscaleStrategies = jest.fn();
    const base = {
      statePda: pk(111),
      mintProgram: { methods: { priceLoopscaleStrategies } },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleLend = {
      getPriceStrategiesAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleLend,
      {} as any,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleStrategiesIx()).toBeNull();
    expect(priceLoopscaleStrategies).not.toHaveBeenCalled();
  });

  it("priceLoopscaleVaultPositionsIx builds via the mint program with ordered vault, stake, and oracle accounts", async () => {
    const statePda = pk(121);
    const solUsdOracle = pk(122);
    const baseAssetOracle = pk(123);
    const vaultA = pk(124);
    const vaultB = pk(125);
    const strategyA = pk(126);
    const strategyB = pk(127);
    const userLpA = pk(128);
    const userLpB = pk(129);
    const stakeA = pk(130);
    const oracleA = pk(131);
    const builtIx = ix(pk(132));

    const instructionBuilder = {
      accounts: jest.fn().mockReturnThis(),
      remainingAccounts: jest.fn().mockReturnThis(),
      instruction: jest.fn().mockResolvedValue(builtIx),
    };
    const priceLoopscaleVaultPositions = jest
      .fn()
      .mockReturnValue(instructionBuilder);

    const base = {
      statePda,
      mintProgram: { methods: { priceLoopscaleVaultPositions } },
      getSolOracle: jest.fn().mockResolvedValue(solUsdOracle),
    } as any;
    const loopscaleVault = {
      getPriceVaultsAccounts: jest.fn().mockResolvedValue({
        numVaults: 2,
        vaultAccounts: [vaultA, vaultB],
        strategyAccounts: [strategyA, strategyB],
        userLpTokenAccounts: [userLpA, userLpB],
        vaultStakeAccounts: [stakeA],
        oracleAccounts: [oracleA],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleVault,
      () => ({}) as any,
    );
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(baseAssetOracle);

    const result = await client.priceLoopscaleVaultPositionsIx();

    expect(result).toBe(builtIx);
    expect(loopscaleVault.getPriceVaultsAccounts).toHaveBeenCalled();
    expect(priceLoopscaleVaultPositions).toHaveBeenCalledWith(2);
    expect(instructionBuilder.accounts).toHaveBeenCalledWith({
      glamState: statePda,
      solUsdOracle,
      baseAssetOracle,
    });
    expect(instructionBuilder.remainingAccounts).toHaveBeenCalledWith([
      { pubkey: vaultA, isSigner: false, isWritable: false },
      { pubkey: strategyA, isSigner: false, isWritable: false },
      { pubkey: userLpA, isSigner: false, isWritable: false },
      { pubkey: vaultB, isSigner: false, isWritable: false },
      { pubkey: strategyB, isSigner: false, isWritable: false },
      { pubkey: userLpB, isSigner: false, isWritable: false },
      { pubkey: stakeA, isSigner: false, isWritable: false },
      { pubkey: oracleA, isSigner: false, isWritable: false },
    ]);
  });

  it("priceLoopscaleVaultPositionsIx returns null when there are no loopscale vault LP tokens", async () => {
    const priceLoopscaleVaultPositions = jest.fn();
    const base = {
      statePda: pk(133),
      mintProgram: { methods: { priceLoopscaleVaultPositions } },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleVault = {
      getPriceVaultsAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleVault,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleVaultPositionsIx()).toBeNull();
    expect(priceLoopscaleVaultPositions).not.toHaveBeenCalled();
  });

  it("uses mint account decimals when token price fallback is unavailable", async () => {
    const mint = pk(131);
    const tokenAccount = pk(132);
    const { client } = createPriceClient({
      jupiterApi: {
        fetchTokenPrices: jest
          .fn()
          .mockRejectedValue(new Error("network down")),
      },
    });

    const accountsDataMap = new PkMap<Buffer>([
      [tokenAccount, tokenAccountData(mint, 123_456_789n)],
    ]);
    const tokenPricesMap = new PkMap<any>();
    const tokenMintDecimalsMap = new PkMap<number>([[mint, 6]]);

    const holdings = await client.getTokenHoldings(
      [tokenAccount],
      accountsDataMap,
      tokenPricesMap,
      tokenMintDecimalsMap,
      "Jupiter",
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0].mintAddress.equals(mint)).toBe(true);
    expect(holdings[0].decimals).toBe(6);
    expect(holdings[0].uiAmount).toBe(123.456789);
    expect(holdings[0].price).toBe(0);
  });
});
