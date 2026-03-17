import {
  parseProtocolPermissionsBitmask,
  parseProtocolsBitmask,
  resolveStateAclsStaging,
} from "../../src/utils/bitmask";
import { getGlamMintProgramId, getGlamProtocolProgramId } from "../../src/glamExports";

describe("bitmask environment resolution", () => {
  it("parses production GLAM mint protocols while running in staging mode", () => {
    const { protocols } = parseProtocolsBitmask(
      getGlamMintProgramId(false),
      1,
      true,
    );

    expect(protocols).toEqual([{ bitflag: 1, name: "GlamMint" }]);
  });

  it("parses production GLAM mint permissions while running in staging mode", () => {
    const { protocol, permissions } = parseProtocolPermissionsBitmask(
      getGlamMintProgramId(false),
      1,
      1 << 4,
      true,
    );

    expect(protocol).toBe("GlamMint");
    expect(permissions.map((permission) => permission.name)).toEqual([
      "ClaimFees",
    ]);
  });

  it("resolves the viewed vault environment from GLAM ACL program ids", () => {
    expect(
      resolveStateAclsStaging(
        [{ integrationProgram: getGlamProtocolProgramId(false) }],
        true,
      ),
    ).toBe(false);

    expect(
      resolveStateAclsStaging(
        [{ integrationProgram: getGlamProtocolProgramId(true) }],
        false,
      ),
    ).toBe(true);
  });
});
