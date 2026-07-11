import ExtPhoenixIdl from "../../target/idl/ext_phoenix.json";
import ExtPhoenixStagingIdl from "../../target/idl/ext_phoenix-staging.json";

const REGISTER_TRADER_ACCOUNT_ORDER = [
  "glam_state",
  "glam_vault",
  "glam_signer",
  "integration_authority",
  "cpi_program",
  "glam_protocol_program",
  "log_authority",
  "global_config",
  "trader_account",
  "system_program",
];

describe.each([
  ["mainnet", ExtPhoenixIdl],
  ["staging", ExtPhoenixStagingIdl],
])("ext_phoenix %s IDL", (_variant, idl) => {
  it("preserves the deployed register_trader account order", () => {
    const registerTrader = idl.instructions.find(
      (instruction) => instruction.name === "register_trader",
    );

    expect(registerTrader).toBeDefined();
    expect(registerTrader?.accounts.map((account) => account.name)).toEqual(
      REGISTER_TRADER_ACCOUNT_ORDER,
    );
  });
});
