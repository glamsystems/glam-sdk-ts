import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getProgramAndBitflagByProtocolName,
  getProtocolsAndPermissions,
} from "../constants";

/**
 * Formats a bitmask as a binary string.
 *
 * @param bitmask - The bitmask to format, either a number or a BN.
 * @param padding - The number of bits to pad the bitmask with.
 * @returns e.g. '0000000000001100' if bitmask is 12 and padding is 16.
 */
export function formatBits(bitmask: number | BN, padding: number = 16): string {
  return bitmask.toString(2).padStart(padding, "0");
}

/**
 * Parses a bitmask into a binary string and a list of protocol names.
 *
 * @param integrationProgram - The integration program ID.
 * @param protocolsBitmask - The bitmask to parse.
 * @returns An object containing the bitmask string and a list of protocol names.
 */
export function parseProtocolsBitmask(
  integrationProgram: PublicKey,
  protocolsBitmask: number | BN,
): {
  protocols: { bitflag: number | BN; name: string }[];
} {
  const integration =
    getProtocolsAndPermissions()[integrationProgram.toBase58()];
  if (!integration) {
    return {
      protocols: [],
    };
  }

  const protocols: { bitflag: number | BN; name: string }[] = [];

  // Check each protocol in the integration
  Object.entries(integration).forEach(([protocolBitflagStr, { name }]) => {
    if (BN.isBN(protocolsBitmask)) {
      const protocolBitflag = new BN(protocolBitflagStr, 2);
      if (protocolsBitmask.and(protocolBitflag).eq(protocolBitflag)) {
        protocols.push({ bitflag: protocolBitflag, name });
      }
    } else {
      const protocolBitflag = parseInt(protocolBitflagStr, 2);
      if (protocolsBitmask & protocolBitflag) {
        protocols.push({ bitflag: protocolBitflag, name });
      }
    }
  });

  return {
    protocols,
  };
}

/**
 * Helper function to check if a number is a power of two.
 * A number is a power of two if it has exactly one bit set.
 */
function isPowerOfTwo(n: number | BN): boolean {
  if (BN.isBN(n)) {
    return n.isPowerOfTwo();
  }
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Parses a permissions bitmask for a specific protocol to get permission names.
 *
 * @param integrationProgram - The integration program ID.
 * @param protocolBitflag - The protocol bitflag to identify which protocol.
 * @param permissionsBitmask - The permissions bitmask to parse.
 * @returns An object containing the bitmask string and a list of permission names.
 */
export function parseProtocolPermissionsBitmask(
  integrationProgram: PublicKey,
  protocolBitflag: number | BN,
  permissionsBitmask: number | BN,
): {
  protocol: string;
  permissions: { bitflag: number | BN; name: string }[];
} {
  if (!isPowerOfTwo(protocolBitflag)) {
    throw new Error("Protocol bitflag must have exactly 1 bit set");
  }

  const integration =
    getProtocolsAndPermissions()[integrationProgram.toBase58()];
  if (!integration) {
    return {
      protocol: formatBits(protocolBitflag), // Unknown protocol bitflag
      permissions: [],
    };
  }

  const protocol = integration[formatBits(protocolBitflag)];
  if (!protocol) {
    return {
      protocol: formatBits(protocolBitflag),
      permissions: [],
    };
  }

  const permissions: { bitflag: number; name: string }[] = [];

  // Check each permission in the protocol
  Object.entries(protocol.permissions).forEach(([bitflagStr, name]) => {
    if (BN.isBN(permissionsBitmask)) {
      const permissionBitflag = new BN(bitflagStr);
      if (
        permissionsBitmask
          .and(new BN(permissionBitflag))
          .eq(new BN(permissionBitflag))
      ) {
        permissions.push({ bitflag: permissionBitflag, name });
      }
    } else {
      const permissionBitflag = parseInt(bitflagStr);
      if (permissionsBitmask & permissionBitflag) {
        permissions.push({ bitflag: permissionBitflag, name });
      }
    }
  });

  return {
    protocol: protocol.name,
    permissions,
  };
}

/**
 * Given the protocol name and a list of permission names, returns the permissions bitmask.
 */
export function parsePermissionNames({
  protocolName,
  permissionNames,
}: {
  protocolName: string;
  permissionNames: string[];
}): {
  integrationProgram: PublicKey;
  protocolBitflag: number;
  permissionsBitmask: BN;
} {
  const protocolConfig = getProgramAndBitflagByProtocolName()[protocolName];
  if (!protocolConfig) {
    throw new Error(`Unknown protocol name ${protocolName}`);
  }

  const [programIdStr, bitflagStr] = protocolConfig;
  const protocolPermissions =
    getProtocolsAndPermissions()[programIdStr]?.[bitflagStr];
  if (!protocolPermissions) {
    throw new Error(
      `Protocol mapping not found for protocol name ${protocolName}`,
    );
  }

  const integrationProgram = new PublicKey(programIdStr);
  const protocolBitflag = parseInt(bitflagStr, 2);

  // Calculate permissions bitmask
  const permissionNameToBitflag: Record<string, BN> = {};
  for (const [bitflag, name] of Object.entries(
    protocolPermissions.permissions,
  )) {
    permissionNameToBitflag[name] = new BN(bitflag);
  }
  const permissionsBitmask = permissionNames.reduce((mask: BN, p) => {
    if (!permissionNameToBitflag[p]) {
      throw new Error(
        `Unknown permission name ${p} for protocol name ${protocolName}`,
      );
    }

    return mask.or(permissionNameToBitflag[p]);
  }, new BN(0));

  return {
    integrationProgram,
    protocolBitflag,
    permissionsBitmask,
  };
}
