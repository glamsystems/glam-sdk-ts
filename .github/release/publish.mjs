// Installed in each npm mirror beside publish.yml (as .github/release/publish.mjs).
// Standalone: Node built-ins only, because a mirror carries no monorepo scripts.
//   verify  — the train manifest names this repository, its id and the tagged
//             commit; each of this mirror's tarballs is present with its
//             sha512, sha256 and member manifest, and each bill of materials
//             the manifest binds is present with its digest.
//   publish — before the first write, read every member's package and
//             version without a cache, fail the train when a version is
//             present with another integrity, and decide each member's
//             credential and tag. A member whose package has no version on
//             the registry has no trusted publisher yet and stages its first
//             version with the npm-next token NPM_FIRST_VERSION_TOKEN under
//             the tag latest, and every other member stages through the
//             trusted publisher alone under the train's channel. Then per member in
//             manifest order: stage the exact tarball when absent, write
//             nothing when present with equal integrity. A staged version
//             stays invisible on the registry until the owner approves it on
//             npmjs.com with two factor authentication, so this run neither
//             waits for it nor checks it. It logs that the version awaits
//             approval and lists the same line in the step summary, under
//             a heading that asks for approval in manifest order. This script
//             cannot see a staged version, so a second run while a member
//             awaits approval stages that member again. A first version with
//             a prerelease part is refused, because this release train does
//             not point latest at a prerelease. For a member already
//             present, download the published tarball,
//             compare sha512 and check that its provenance names this
//             repository and workflow and attests the release commit at
//             refs/tags/v<version>, so a run after the approval checks what
//             was approved, whether the token is still set or not. The
//             approval of a brand new package's first version also publishes
//             a permanent untagged placeholder version 0.0.0-stage, and when
//             that version was staged under the channel, latest would land on
//             the placeholder, which is why a first version is staged under
//             latest. A train that writes nothing while the token is set ends
//             with a line that says to delete the secret.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

export const REGISTRY = "https://registry.npmjs.org";
export const SBOM_ASSETS = Object.freeze({
  index: "train-sbom-index.json",
  buildInputs: "train-build-inputs.cdx.json",
  thirdPartyNotices: "train-third-party-notices.json",
});
export const SLSA_PROVENANCE = "https://slsa.dev/provenance/v1";

export const integrityOf = (bytes) =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
export const sha256Of = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

const field = (block, start, length) =>
  block
    .subarray(start, start + length)
    .toString("utf8")
    .replace(/\0.*$/s, "");
const octal = (block, start, length) =>
  Number.parseInt(field(block, start, length).trim() || "0", 8);

/**
 * The member manifest digest of a gzip-wrapped ustar archive: sha256 over
 * the canonical JSON of its regular files as `{ path, size, sha256 }`
 * sorted by path. The same digest scripts/release/tarball.mjs records and
 * consumer-verify.mjs recomputes.
 */
export function memberManifestOf(bytes) {
  const tar = gunzipSync(bytes);
  const members = [];
  let longName = null;
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const block = tar.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) break;
    const size = octal(block, 124, 12);
    const type = field(block, 156, 1) || "0";
    const data = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") {
      longName = data.toString("utf8").replace(/\0.*$/s, "");
      continue;
    }
    if (type === "x" || type === "g") continue;
    const prefix = field(block, 345, 155);
    const name = field(block, 0, 100);
    const memberPath = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = null;
    if (type === "0")
      members.push({ path: memberPath, size, sha256: sha256Of(data) });
  }
  return sha256Of(
    Buffer.from(
      canonicalJson(members.sort((a, b) => compareText(a.path, b.path))),
    ),
  );
}

/** The tarball name pnpm and npm write: @scope/name → scope-name-version.tgz. */
export const tarballName = ({ name, version }) =>
  `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;

export const membersOf = (manifest, repository) =>
  manifest.packages.filter((item) => item.mirror === repository);

/** `publish`, `skip` or `fail` for one member, from what the registry holds. */
export function decide(observed, integrity) {
  if (observed === null) return "publish";
  return observed.integrity === integrity ? "skip" : "fail";
}

export function verifyTrain({
  manifest,
  tarballs,
  sbom = tarballs,
  repository,
  repositoryId,
  sha,
}) {
  const findings = [];
  const entry = manifest.mirrors?.find((mirror) => mirror.slug === repository);
  if (!entry) return [`${repository} has no entry in the train manifest`];
  if (entry.repositoryId !== Number(repositoryId))
    findings.push(
      `repository id ${repositoryId} is not the manifest's ${entry.repositoryId}`,
    );
  if (entry.commit !== sha)
    findings.push(
      `the tagged commit ${sha} is not the manifest's ${entry.commit}`,
    );
  if (manifest.channel !== "next")
    findings.push(`channel ${manifest.channel} is not published from npm-next`);
  const members = membersOf(manifest, repository);
  if (!members.length)
    findings.push(`the manifest names no package for ${repository}`);
  const expected = new Set(members.map(tarballName));
  for (const file of fs
    .readdirSync(tarballs)
    .filter((name) => name.endsWith(".tgz")))
    if (!expected.has(file))
      findings.push(`${file} is not in the train manifest`);
  for (const member of members) {
    const file = path.join(tarballs, tarballName(member));
    if (!fs.existsSync(file)) {
      findings.push(`${tarballName(member)} is absent`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    if (integrityOf(bytes) !== member.sha512 || bytes.length !== member.size)
      findings.push(
        `${tarballName(member)} differs from the manifest's sha512 or size`,
      );
    else if (sha256Of(bytes) !== member.sha256)
      findings.push(
        `${tarballName(member)} differs from the manifest's sha256`,
      );
    else {
      let digest = null;
      try {
        digest = memberManifestOf(bytes);
      } catch {
        digest = null;
      }
      if (digest !== member.memberManifestSha256)
        findings.push(
          `${tarballName(member)} differs from the manifest's member manifest`,
        );
    }
  }
  // The bills of materials the seal binds travel beside the tarballs: this
  // mirror's two documents per member and the train's index, build inputs
  // and notices, each with the sealed digest.
  const asset = (name) => {
    const flat = path.join(sbom, name);
    if (fs.existsSync(flat)) return flat;
    const nested = path.join(sbom, repository.split("/")[1], name);
    return fs.existsSync(nested) ? nested : null;
  };
  const bound = (name, digest, label) => {
    const file = asset(name);
    if (!file) findings.push(`${name} is absent`);
    else if (sha256Of(fs.readFileSync(file)) !== digest)
      findings.push(`${name} is not the sealed ${label}`);
  };
  for (const member of members) {
    const base = tarballName(member).replace(/\.tgz$/, "");
    bound(
      `${base}.runtime.json`,
      member.sbom?.runtimeSha256,
      "runtime manifest",
    );
    bound(
      `${base}.cdx.json`,
      member.sbom?.cyclonedxSha256,
      "CycloneDX document",
    );
  }
  const bindings = manifest.bindings?.sbom ?? {};
  bound(SBOM_ASSETS.index, bindings.indexSha256, "sbom index");
  bound(
    SBOM_ASSETS.buildInputs,
    bindings.buildInputsSha256,
    "build-input sbom",
  );
  bound(
    SBOM_ASSETS.thirdPartyNotices,
    bindings.thirdPartyNoticesSha256,
    "third-party notices",
  );
  return findings;
}

/** The bill-of-materials asset names a mirror's release carries beside its tarballs. */
export function sbomAssetNames(manifest, repository) {
  return [
    ...membersOf(manifest, repository).flatMap((member) => {
      const base = tarballName(member).replace(/\.tgz$/, "");
      return [`${base}.runtime.json`, `${base}.cdx.json`];
    }),
    ...Object.values(SBOM_ASSETS),
  ].sort(compareText);
}

/** The registry's view of one version, read without a cache; null when absent. */
export async function observe(
  { name, version },
  { fetch = globalThis.fetch } = {},
) {
  const response = await fetch(
    `${REGISTRY}/${name.replace("/", "%2f")}/${version}`,
    {
      cache: "no-store",
      headers: { accept: "application/json", "cache-control": "no-cache" },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(
      `${name}@${version}: the registry answered ${response.status}`,
    );
  const body = await response.json();
  return {
    integrity: body.dist?.integrity ?? null,
    tarball: body.dist?.tarball ?? null,
    attestations: body.dist?.attestations?.url ?? null,
  };
}

/**
 * The version npm publishes, untagged and permanent, when the owner approves
 * the first staged version of a new package. Its packument entry carries
 * `stub: true`.
 */
export const STAGE_PLACEHOLDER = "0.0.0-stage";

/**
 * Whether the registry has any version of a package, read without a cache.
 * A packument whose every version is a placeholder holds no release, so no
 * trusted publisher was created for it and the package counts as absent.
 */
export async function observePackage(name, { fetch = globalThis.fetch } = {}) {
  const response = await fetch(`${REGISTRY}/${name.replace("/", "%2f")}`, {
    cache: "no-store",
    headers: { accept: "application/json", "cache-control": "no-cache" },
  });
  if (response.status === 404) return "absent";
  if (response.status !== 200)
    throw new Error(`${name}: the registry answered ${response.status}`);
  const versions = Object.entries((await response.json())?.versions ?? {});
  return versions.length &&
    versions.every(
      ([key, entry]) => key === STAGE_PLACEHOLDER || entry?.stub === true,
    )
    ? "absent"
    : "present";
}

export const FIRST_VERSION_TOKEN = "NPM_FIRST_VERSION_TOKEN";
export const MODES = Object.freeze({
  firstVersion: "first version, npm-next token",
  trustedPublisher: "trusted publisher",
});

/**
 * The credential each member stages with, by name. npm attaches a trusted
 * publisher only to a package that exists, so a member whose package is
 * absent stages its first version with the npm-next token, and a member
 * whose package is present stages through the trusted publisher, with or without
 * the token. `pending` is the members that still need a publication, every
 * member when omitted. Refuses the train when a first version has no token,
 * and when the token is set, no member is a first version and a member is
 * pending; with none pending, the train writes nothing and the token reaches
 * no publish.
 */
export function publishModes(members, presence, token, pending = members) {
  const modes = new Map(
    members.map((member) => [
      member.name,
      presence[member.name] === "absent"
        ? MODES.firstVersion
        : MODES.trustedPublisher,
    ]),
  );
  const first = members
    .filter((member) => modes.get(member.name) === MODES.firstVersion)
    .map((member) => member.name);
  for (const member of members)
    if (
      modes.get(member.name) === MODES.firstVersion &&
      String(member.version).includes("-")
    )
      throw new Error(
        `${member.name}@${member.version} is a first version with a prerelease part. A first version is approved under latest, and this release train does not point latest at a prerelease. Ship the first version of ${member.name} in a train with a stable version.`,
      );
  if (first.length && !token)
    throw new Error(
      `${first.join(", ")} ${first.length === 1 ? "has" : "have"} no version on the registry, so no trusted publisher can exist; set ${FIRST_VERSION_TOKEN} in the npm-next environment for this first publish`,
    );
  if (token && !first.length && pending.length)
    throw new Error(
      `${FIRST_VERSION_TOKEN} is set but ${members.map((member) => member.name).join(", ")} already exist on the registry; delete the secret and publish through the trusted publisher`,
    );
  return modes;
}

/** The run the tag v<version> starts: its ref and the commit it attests. */
export const publishSource = (manifest, repository) => ({
  commit: manifest.mirrors?.find((mirror) => mirror.slug === repository)
    ?.commit,
  ref: `refs/tags/v${manifest.version}`,
});

/**
 * Findings for an SLSA provenance statement against this mirror's publish
 * run. With `commit` and `ref`, the statement must also attest that source:
 * the workflow ref, and the one resolved dependency of this repository.
 */
export function provenanceFindings(
  statement,
  { repository, workflowPath, commit, ref },
) {
  const definition = statement?.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const findings = [];
  if (statement?.predicateType !== SLSA_PROVENANCE)
    findings.push(`provenance predicate is ${statement?.predicateType}`);
  if (workflow?.repository !== `https://github.com/${repository}`)
    findings.push(`provenance names repository ${workflow?.repository}`);
  if (workflow?.path !== workflowPath)
    findings.push(`provenance names workflow ${workflow?.path}`);
  if (ref !== undefined && workflow?.ref !== ref)
    findings.push(`provenance names ref ${workflow?.ref}, not ${ref}`);
  if (commit !== undefined) {
    const source = `git+https://github.com/${repository}@`;
    const attested = (
      Array.isArray(definition?.resolvedDependencies)
        ? definition.resolvedDependencies
        : []
    )
      .filter((item) => String(item?.uri).startsWith(source))
      .map((item) => item?.digest?.gitCommit);
    if (attested.length !== 1 || attested[0] !== commit)
      findings.push(
        `provenance names source commit ${attested.join(", ") || "none"}, not ${commit}`,
      );
  }
  return findings;
}

/** Refuses published bytes or provenance that are not the train's. */
export async function verifyPublished({
  member,
  published,
  repository,
  workflowPath,
  source = {},
  download,
  provenance,
}) {
  const bytes = await download(published.tarball);
  if (integrityOf(bytes) !== member.sha512)
    throw new Error(
      `${member.name}@${member.version}: the downloaded tarball differs from the train's`,
    );
  const findings = provenanceFindings(
    await provenance(published.attestations),
    { repository, workflowPath, ...source },
  );
  if (findings.length)
    throw new Error(`${member.name}@${member.version}: ${findings.join("; ")}`);
}

export async function publishTrain({
  manifest,
  tarballs,
  repository,
  workflowPath,
  read,
  readPackage,
  publish,
  download,
  provenance,
  env = process.env,
  log = () => {},
  summarize = (line) => {
    if (env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${escapeLine(line)}\n`);
  },
}) {
  const outcomes = [];
  const source = publishSource(manifest, repository);
  if (source.commit === undefined)
    throw new Error(`${repository} has no entry in the train manifest`);
  const members = membersOf(manifest, repository);
  // Every member's package and version are read, and its decision and
  // credential decided, before the first write.
  const presence = {};
  for (const member of members)
    presence[member.name] = await readPackage(member.name);
  const observed = new Map();
  for (const member of members) observed.set(member.name, await read(member));
  const decisions = new Map(
    members.map((member) => [
      member.name,
      decide(observed.get(member.name), member.sha512),
    ]),
  );
  for (const member of members)
    if (decisions.get(member.name) === "fail")
      throw new Error(
        `${member.name}@${member.version} is published with ${observed.get(member.name).integrity}, not the train's ${member.sha512}`,
      );
  const pending = members.filter(
    (member) => decisions.get(member.name) === "publish",
  );
  const token = (env[FIRST_VERSION_TOKEN] ?? "").trim();
  const modes = publishModes(members, presence, token, pending);
  const unused =
    Boolean(token) &&
    !pending.length &&
    members.every(
      (member) => modes.get(member.name) === MODES.trustedPublisher,
    );
  // The step summary lists the staged versions under one heading, in
  // manifest order, which is the order the owner approves them in.
  let headed = false;
  const summarizeStaged = (line) => {
    if (!headed) summarize("Staged versions, approve in this order:");
    headed = true;
    summarize(`- ${line}`);
  };
  for (const member of members) {
    const mode = modes.get(member.name);
    if (decisions.get(member.name) === "publish") {
      // A staged version is invisible until the owner approves it, so the
      // run neither waits for it nor checks it.
      const tag = mode === MODES.firstVersion ? "latest" : manifest.channel;
      publish(path.join(tarballs, tarballName(member)), {
        tag,
        token: mode === MODES.firstVersion ? token : null,
      });
      const line = `${member.name}@${member.version}: staged under ${tag}, awaiting approval on npmjs.com, ${mode}`;
      log(line);
      summarizeStaged(line);
      outcomes.push({ name: member.name, decision: "staged", mode });
      continue;
    }
    const decision = decisions.get(member.name);
    await verifyPublished({
      member,
      published: observed.get(member.name),
      repository,
      workflowPath,
      source,
      download,
      provenance,
    });
    log(`${member.name}@${member.version}: ${decision}, ${mode}`);
    outcomes.push({ name: member.name, decision, mode });
  }
  if (unused)
    log(
      `${FIRST_VERSION_TOKEN} is set and no member needed it; delete the secret`,
    );
  return outcomes;
}

/**
 * Runs `npm stage publish` on one tarball under `tag`. For a first version
 * NODE_AUTH_TOKEN is the npm-next token, which reaches npm's environment
 * under that name alone: never under its own name, never as an argument,
 * never in a log line. Without a token the environment stays as setup-node
 * made it, so the OIDC exchange of the trusted publisher authenticates the
 * staging. The secret's own name is removed from npm's environment in both.
 */
export function npmStage(file, { tag, token = null, spawn = spawnSync } = {}) {
  if (typeof tag !== "string" || !tag)
    throw new Error(`npm stage publish ${path.basename(file)} names no tag`);
  const env = { ...process.env };
  if (token) env.NODE_AUTH_TOKEN = token;
  delete env[FIRST_VERSION_TOKEN];
  const result = spawn(
    "npm",
    [
      "stage",
      "publish",
      file,
      "--tag",
      tag,
      "--access",
      "public",
      "--provenance",
    ],
    { stdio: "inherit", env },
  );
  if (result.status !== 0)
    throw new Error(
      `npm stage publish ${path.basename(file)} exited ${result.status}`,
    );
}

async function fetchBytes(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchProvenance(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const { attestations = [] } = await response.json();
  const entry = attestations.find(
    (item) => item.predicateType === SLSA_PROVENANCE,
  );
  const payload = entry?.bundle?.dsseEnvelope?.payload;
  return payload
    ? JSON.parse(Buffer.from(payload, "base64").toString("utf8"))
    : null;
}

// The release output point, `printLine` in ../common.mjs, restated because
// a mirror carries no monorepo scripts: each C0 control character, DEL and
// the two separators print as their JSON `\uXXXX` escape, and the `[` of
// `##[`, the Actions runner's legacy command marker, as `\u005b`, so no line
// this command prints begins with text a manifest, a tarball or the registry
// supplies, or carries a workflow command from one.
const escapeLine = (text) =>
  String(text)
    .replace(
      /[\u0000-\u001f\u007f\u2028\u2029]/gu,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    )
    .replace(/##\[/g, "##\\u005b");
const printLine = (stream, text) => stream.write(`${escapeLine(text)}\n`);

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      options: {
        manifest: { type: "string" },
        tarballs: { type: "string" },
        repository: { type: "string" },
        "repository-id": { type: "string" },
        sha: { type: "string" },
        sbom: { type: "string" },
        workflow: { type: "string" },
      },
    });
    const manifest = JSON.parse(fs.readFileSync(values.manifest, "utf8"));
    if (positionals[0] === "verify") {
      const findings = verifyTrain({
        manifest,
        tarballs: values.tarballs,
        sbom: values.sbom ?? values.tarballs,
        repository: values.repository,
        repositoryId: values["repository-id"],
        sha: values.sha,
      });
      if (findings.length) throw new Error(findings.join("\n"));
      printLine(process.stdout, "verify: ok");
    } else if (positionals[0] === "publish") {
      await publishTrain({
        manifest,
        tarballs: values.tarballs,
        repository: values.repository,
        workflowPath: values.workflow,
        read: (member) => observe(member),
        readPackage: (name) => observePackage(name),
        publish: (file, options) => npmStage(file, options),
        download: fetchBytes,
        provenance: fetchProvenance,
        log: (line) => printLine(process.stdout, line),
      });
    } else
      throw new Error(
        "Usage: publish.mjs verify|publish --manifest <file> --tarballs <dir> ...",
      );
  } catch (error) {
    printLine(process.stderr, error.message);
    process.exitCode = 1;
  }
}
