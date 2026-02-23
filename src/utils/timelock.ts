import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { IntegrationAcl, DelegateAcl } from "../models";
import {
  parseProtocolsBitmask,
  parseProtocolPermissionsBitmask,
} from "./bitmask";
import { PkMap } from "./pkmap";
import { PkSet } from "./pkset";

/**
 * Get protocol names from a bitmask for a given integration program
 * Uses the SDK's parseProtocolsBitmask function
 */
export function getProtocolNamesFromBitmask(
  integrationProgram: PublicKey,
  bitmask: number,
  staging: boolean,
): string[] {
  const { protocols } = parseProtocolsBitmask(integrationProgram, bitmask, staging);
  return protocols.map((p) => p.name);
}

/**
 * Get permission names from a permissions bitmask for a protocol
 * Uses the SDK's parseProtocolPermissionsBitmask function
 */
export function getPermissionNamesFromBitmask(
  integrationProgram: PublicKey,
  protocolBitflag: number,
  permissionsBitmask: BN,
  staging: boolean,
): string[] {
  const { permissions } = parseProtocolPermissionsBitmask(
    integrationProgram,
    protocolBitflag,
    permissionsBitmask,
    staging,
  );
  return permissions.map((p) => p.name);
}

/**
 * Compare current and staged PublicKey arrays and return added/removed keys
 */
export function comparePublicKeyArrays(
  current: PublicKey[] | null,
  staged: PublicKey[],
): { added: PublicKey[]; removed: PublicKey[] } {
  const currentSet = new PkSet(current || []);
  const stagedSet = new PkSet(staged);
  return {
    added: [...stagedSet].filter((pk) => !currentSet.has(pk)),
    removed: [...currentSet].filter((pk) => !stagedSet.has(pk)),
  };
}

/**
 * Compare current and staged integrationAcls and return the differences
 */
export function compareIntegrationAcls(
  current: IntegrationAcl[] | null,
  staged: IntegrationAcl[] | null,
  staging: boolean,
): {
  added: IntegrationAcl[];
  removed: IntegrationAcl[];
  modified: Array<{
    integrationProgram: PublicKey;
    currentBitmask: number;
    stagedBitmask: number;
    enabledProtocols: string[];
    disabledProtocols: string[];
  }>;
} {
  const added: IntegrationAcl[] = [];
  const removed: IntegrationAcl[] = [];
  const modified: Array<{
    integrationProgram: PublicKey;
    currentBitmask: number;
    stagedBitmask: number;
    enabledProtocols: string[];
    disabledProtocols: string[];
  }> = [];

  const currentMap = new PkMap<IntegrationAcl>();
  (current || []).forEach((acl) => {
    currentMap.set(acl.integrationProgram, acl);
  });

  const stagedMap = new PkMap<IntegrationAcl>();
  (staged || []).forEach((acl) => {
    stagedMap.set(acl.integrationProgram, acl);
  });

  // Find added integrations
  stagedMap.forEach((stagedAcl, integrationProgram) => {
    if (!currentMap.has(integrationProgram)) {
      added.push(stagedAcl);
    }
  });

  // Find removed integrations
  currentMap.forEach((currentAcl, integrationProgram) => {
    if (!stagedMap.has(integrationProgram)) {
      removed.push(currentAcl);
    }
  });

  // Find modified integrations (changed bitmask)
  currentMap.forEach((currentAcl, integrationProgram) => {
    const stagedAcl = stagedMap.get(integrationProgram);
    if (
      stagedAcl &&
      currentAcl.protocolsBitmask !== stagedAcl.protocolsBitmask
    ) {
      const currentProtocols = getProtocolNamesFromBitmask(
        currentAcl.integrationProgram,
        currentAcl.protocolsBitmask,
        staging,
      );
      const stagedProtocols = getProtocolNamesFromBitmask(
        stagedAcl.integrationProgram,
        stagedAcl.protocolsBitmask,
        staging,
      );

      const enabledProtocols = stagedProtocols.filter(
        (p) => !currentProtocols.includes(p),
      );
      const disabledProtocols = currentProtocols.filter(
        (p) => !stagedProtocols.includes(p),
      );

      modified.push({
        integrationProgram: currentAcl.integrationProgram,
        currentBitmask: currentAcl.protocolsBitmask,
        stagedBitmask: stagedAcl.protocolsBitmask,
        enabledProtocols,
        disabledProtocols,
      });
    }
  });

  return { added, removed, modified };
}

/**
 * Compare current and staged delegateAcls and return the differences
 */
export function compareDelegateAcls(
  current: DelegateAcl[] | null,
  staged: DelegateAcl[] | null,
  staging: boolean,
): {
  added: DelegateAcl[];
  removed: DelegateAcl[];
  modified: Array<{
    pubkey: PublicKey;
    currentExpiresAt: BN;
    stagedExpiresAt: BN;
    permissionChanges: Array<{
      integrationProgram: PublicKey;
      protocolName: string;
      addedPermissions: string[];
      removedPermissions: string[];
    }>;
  }>;
} {
  const added: DelegateAcl[] = [];
  const removed: DelegateAcl[] = [];
  const modified: Array<{
    pubkey: PublicKey;
    currentExpiresAt: BN;
    stagedExpiresAt: BN;
    permissionChanges: Array<{
      integrationProgram: PublicKey;
      protocolName: string;
      addedPermissions: string[];
      removedPermissions: string[];
    }>;
  }> = [];

  const currentMap = new PkMap<DelegateAcl>();
  (current || []).forEach((acl) => {
    currentMap.set(acl.pubkey, acl);
  });

  const stagedMap = new PkMap<DelegateAcl>();
  (staged || []).forEach((acl) => {
    stagedMap.set(acl.pubkey, acl);
  });

  // Find added delegates
  stagedMap.forEach((stagedAcl, pubkey) => {
    if (!currentMap.has(pubkey)) {
      added.push(stagedAcl);
    }
  });

  // Find removed delegates
  currentMap.forEach((currentAcl, pubkey) => {
    if (!stagedMap.has(pubkey)) {
      removed.push(currentAcl);
    }
  });

  // Find modified delegates
  currentMap.forEach((currentAcl, pubkey) => {
    const stagedAcl = stagedMap.get(pubkey);
    if (!stagedAcl) return;

    const permissionChanges: Array<{
      integrationProgram: PublicKey;
      protocolName: string;
      addedPermissions: string[];
      removedPermissions: string[];
    }> = [];

    // Create maps for easier comparison
    const currentPermissionsMap = new PkMap<Map<number, BN>>();
    currentAcl.integrationPermissions.forEach((intPerm) => {
      const protocolMap = new Map<number, BN>();
      intPerm.protocolPermissions.forEach((protPerm) => {
        protocolMap.set(protPerm.protocolBitflag, protPerm.permissionsBitmask);
      });
      currentPermissionsMap.set(intPerm.integrationProgram, protocolMap);
    });

    const stagedPermissionsMap = new PkMap<Map<number, BN>>();
    stagedAcl.integrationPermissions.forEach((intPerm) => {
      const protocolMap = new Map<number, BN>();
      intPerm.protocolPermissions.forEach((protPerm) => {
        protocolMap.set(protPerm.protocolBitflag, protPerm.permissionsBitmask);
      });
      stagedPermissionsMap.set(intPerm.integrationProgram, protocolMap);
    });

    // Check all integration programs and protocols
    const allProgramIds = new PkSet([
      ...currentPermissionsMap.pkKeys(),
      ...stagedPermissionsMap.pkKeys(),
    ]);

    allProgramIds.forEach((integrationProgram) => {
      const currentProtocols =
        currentPermissionsMap.get(integrationProgram) || new Map();
      const stagedProtocols =
        stagedPermissionsMap.get(integrationProgram) || new Map();

      const allProtocolBitflags = new Set([
        ...currentProtocols.keys(),
        ...stagedProtocols.keys(),
      ]);

      allProtocolBitflags.forEach((protocolBitflag) => {
        const current = currentProtocols.get(protocolBitflag);
        const staged = stagedProtocols.get(protocolBitflag);

        if (!current && staged) {
          // Protocol permissions added
          const protocolNames = getProtocolNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            staging,
          );
          const addedPermissions = getPermissionNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            staged,
            staging,
          );

          if (addedPermissions.length > 0) {
            permissionChanges.push({
              integrationProgram,
              protocolName: protocolNames[0] || "Unknown",
              addedPermissions,
              removedPermissions: [],
            });
          }
        } else if (current && !staged) {
          // Protocol permissions removed
          const protocolNames = getProtocolNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            staging,
          );
          const removedPermissions = getPermissionNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            current,
            staging,
          );

          if (removedPermissions.length > 0) {
            permissionChanges.push({
              integrationProgram,
              protocolName: protocolNames[0] || "Unknown",
              addedPermissions: [],
              removedPermissions,
            });
          }
        } else if (current && staged && !current.eq(staged)) {
          // Protocol permissions modified
          const protocolNames = getProtocolNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            staging,
          );
          const currentPermissions = getPermissionNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            current,
            staging,
          );
          const stagedPermissions = getPermissionNamesFromBitmask(
            integrationProgram,
            protocolBitflag,
            staged,
            staging,
          );

          const addedPermissions = stagedPermissions.filter(
            (p) => !currentPermissions.includes(p),
          );
          const removedPermissions = currentPermissions.filter(
            (p) => !stagedPermissions.includes(p),
          );

          if (addedPermissions.length > 0 || removedPermissions.length > 0) {
            permissionChanges.push({
              integrationProgram,
              protocolName: protocolNames[0] || "Unknown",
              addedPermissions,
              removedPermissions,
            });
          }
        }
      });
    });

    // Check if there are any changes (expiration or permissions)
    if (
      !currentAcl.expiresAt.eq(stagedAcl.expiresAt) ||
      permissionChanges.length > 0
    ) {
      modified.push({
        pubkey: currentAcl.pubkey,
        currentExpiresAt: currentAcl.expiresAt,
        stagedExpiresAt: stagedAcl.expiresAt,
        permissionChanges,
      });
    }
  });

  return { added, removed, modified };
}
