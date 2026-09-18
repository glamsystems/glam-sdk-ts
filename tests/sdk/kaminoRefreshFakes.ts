/**
 * Fakes shared by the Kamino reserve refresh suites: the klend reserve
 * fixtures, the asset-meta shapes the SDK reads an oracle's source from, and
 * the offline Anchor programs that let a suite drive the SDK's real
 * instruction builders. Nothing here touches the network.
 */
import fs from "fs";
import path from "path";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { AccountInfo, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { MINT_SIZE, MintLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import {
  getExtBridgeProgram,
  getExtOrcaProgram,
  getExtRpiProgram,
  getGlamMintProgram,
  getGlamProtocolProgram,
} from "../../src/glamExports";

const KAMINO_FIXTURE_DIR = path.resolve(
  __dirname,
  "../../../fixtures/accounts/kamino",
);

export type ReserveFixture = {
  pubkey: PublicKey;
  accountInfo: AccountInfo<Buffer>;
};

/** A real klend reserve account: real lending market, real Scope feed. */
export function loadReserveFixture(fixtureName: string): ReserveFixture {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(KAMINO_FIXTURE_DIR, `${fixtureName}.json`),
      "utf8",
    ),
  );
  const [base64] = raw.account.data;
  return {
    pubkey: new PublicKey(raw.pubkey),
    accountInfo: {
      data: Buffer.from(base64, "base64"),
      executable: false,
      lamports: 1,
      owner: new PublicKey(raw.account.owner),
      rentEpoch: 0,
    },
  };
}

export type OracleSpec = { oracle: PublicKey; oracleSource: string };

export const KAMINO_ORACLE = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});

export function assetMetaOf(mint: PublicKey, spec: OracleSpec) {
  return {
    asset: mint,
    decimals: 6,
    oracle: spec.oracle,
    oracleSource: spec.oracleSource,
    programId: TOKEN_PROGRAM_ID,
  };
}

export function accountInfo(
  owner: PublicKey,
  data: Buffer = Buffer.alloc(0),
): AccountInfo<Buffer> {
  return { data, executable: false, lamports: 0, owner, rentEpoch: 0 };
}

export function mintAccountInfo(): AccountInfo<Buffer> {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: 0n,
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  );
  return accountInfo(TOKEN_PROGRAM_ID, data);
}

/**
 * A provider whose connection is never read: Anchor encodes an instruction's
 * data and resolves its PDAs locally, and the signer comes from this wallet.
 */
export function offlineAnchorProvider(): AnchorProvider {
  return new AnchorProvider(
    new Connection("http://127.0.0.1:8899", "confirmed"),
    new Wallet(Keypair.generate()),
    {},
  );
}

/**
 * The real Anchor programs, so an instruction a suite measures carries the
 * discriminator, the argument encoding and the account list the SDK sends.
 * The staging flavour is used because the mainnet glam_mint does not yet carry
 * the Loopscale, Phoenix, stake, bridge and Neutral pricing instructions; the
 * accounts and arguments are the same either way, and the program id a
 * transaction names is one key whichever flavour it comes from.
 */
export function realPrograms(
  provider: AnchorProvider = offlineAnchorProvider(),
  staging = true,
) {
  return {
    provider,
    signer: provider.publicKey,
    mintProgram: getGlamMintProgram(provider, staging),
    protocolProgram: getGlamProtocolProgram(provider, staging),
    extRpiProgram: getExtRpiProgram(provider, staging),
    extOrcaProgram: getExtOrcaProgram(provider, staging),
    extBridgeProgram: getExtBridgeProgram(provider, staging),
  };
}
