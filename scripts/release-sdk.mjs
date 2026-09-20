import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGE = "@glamsystems/glam-sdk";
export const REPOSITORY = "glamsystems/glam-sdk-ts";
const REGISTRY = "https://registry.npmjs.org";
const SHA = /^[a-f0-9]{40}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function validateRelease({
  marker,
  pkg,
  lock,
  ref,
  commit,
  repository,
}) {
  assert.equal(repository, REPOSITORY, "Unexpected publishing repository");
  assert.match(commit, SHA, "Release commit must be a full Git SHA");
  assert.equal(marker.schemaVersion, 1, "Unknown release metadata schema");
  assert.equal(marker.package, PACKAGE, "Unexpected release package");
  assert.match(
    marker.version,
    VERSION,
    "Only stable SDK versions are supported",
  );
  assert.equal(marker.source?.repository, "glamsystems/glam");
  assert.match(marker.source?.commit, SHA, "Missing monorepo release commit");
  assert.equal(typeof marker.notes, "string", "Release notes must be text");
  assert.ok(marker.notes.trim(), "Release notes must not be empty");
  assert.equal(ref, `refs/tags/v${marker.version}`, "Run on the release tag");
  assert.equal(pkg.name, PACKAGE);
  assert.equal(
    pkg.version,
    marker.version,
    "Package and release versions differ",
  );
  assert.equal(lock.name, PACKAGE);
  assert.equal(lock.version, marker.version, "Lockfile version differs");
  assert.equal(lock.packages?.[""]?.name, PACKAGE);
  assert.equal(lock.packages?.[""]?.version, marker.version);
  assert.equal(
    pkg.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, ""),
    `https://github.com/${REPOSITORY}`,
    "Package repository must match trusted publishing",
  );
  return { ...marker, commit, tag: `v${marker.version}` };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function registryVersion(version, fetcher = fetch) {
  const response = await fetcher(
    `${REGISTRY}/${encodeURIComponent(PACKAGE)}/${encodeURIComponent(version)}`,
    {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Registry lookup failed: HTTP ${response.status}`,
    );
  }
  return response.json();
}

export function assertPackageIdentity(metadata, release, integrity) {
  assert.equal(metadata.name, PACKAGE, "Registry package name differs");
  assert.equal(metadata.version, release.version, "Registry version differs");
  assert.equal(
    metadata.gitHead,
    release.commit,
    "Registry source commit differs",
  );
  assert.equal(metadata.dist?.integrity, integrity, "Registry tarball differs");
  assert.equal(
    metadata.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, ""),
    `https://github.com/${REPOSITORY}`,
    "Registry source repository differs",
  );
}

export function compareVersions(left, right) {
  assert.match(left, VERSION, "npm latest must be a stable version");
  assert.match(right, VERSION);
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

export async function waitForPackage({
  release,
  integrity,
  lookup,
  delay = sleep,
  attempts = 20,
}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let metadata;
    try {
      metadata = await lookup(release.version);
    } catch (error) {
      // Authentication and other client errors require intervention, not retries.
      if (error.status && error.status < 500 && error.status !== 429)
        throw error;
      lastError = error;
    }
    if (metadata) {
      // A conflicting immutable version must never be accepted or overwritten.
      assertPackageIdentity(metadata, release, integrity);
      return metadata;
    }
    if (attempt < attempts) await delay(15_000);
  }
  throw new Error("Published SDK did not become visible on npm", {
    cause: lastError,
  });
}

export async function publishAndVerify({
  release,
  integrity,
  lookup = registryVersion,
  latest = () => registryVersion("latest"),
  publish,
  verify,
  finalize,
  delay = sleep,
  attempts = 20,
}) {
  // Only a real registry 404 permits publication. A failed lookup does not.
  const existing = await lookup(release.version);
  if (existing) {
    assertPackageIdentity(existing, release, integrity);
    console.log(`${PACKAGE}@${release.version} already matches; verifying it`);
  } else {
    const currentLatest = await latest();
    assert.ok(
      !currentLatest ||
        compareVersions(currentLatest.version, release.version) < 0,
      "Refusing to publish an older version over npm latest",
    );
    try {
      await publish();
    } catch (error) {
      // A lost publish response can follow a successful registry write. Resolve
      // that uncertainty by verifying identity, never by publishing a second time.
      console.warn(
        `Publish command failed; checking registry: ${error.message}`,
      );
    }
  }
  const metadata = await waitForPackage({
    release,
    integrity,
    lookup,
    delay,
    attempts,
  });
  assert.ok(metadata.dist?.signatures?.length, "Registry signature is missing");
  assert.equal(
    metadata.dist?.attestations?.provenance?.predicateType,
    "https://slsa.dev/provenance/v1",
    "SDK provenance is missing",
  );
  await verify(metadata);
  const currentLatest = await latest();
  assert.ok(
    currentLatest &&
      compareVersions(currentLatest.version, release.version) >= 0,
    "npm latest is missing or behind this release; finish dist-tag recovery before retrying",
  );
  console.log(`Verified npm latest: ${currentLatest.version}`);
  await finalize(metadata);
}

export function releaseBody(release) {
  return `${release.notes.trim()}\n\n<!-- sdk-release: ${release.source.commit} ${release.commit} -->\n`;
}

export async function ensureGitHubRelease(release, request) {
  const prefix = `/repos/${REPOSITORY}`;
  let object = (await request(`${prefix}/git/ref/tags/${release.tag}`)).object;
  for (let count = 0; object.type === "tag" && count < 5; count++) {
    object = (await request(`${prefix}/git/tags/${object.sha}`)).object;
  }
  assert.equal(object.type, "commit", "Release tag must resolve to a commit");
  assert.equal(
    object.sha,
    release.commit,
    "Public tag moved to another commit",
  );
  const body = releaseBody(release);
  const existing = await request(`${prefix}/releases/tags/${release.tag}`, {
    allow404: true,
  });
  if (existing) {
    assert.equal(existing.tag_name, release.tag);
    assert.equal(existing.target_commitish, release.commit);
    assert.equal(
      existing.body?.trim(),
      body.trim(),
      "Existing release differs",
    );
    assert.equal(existing.prerelease, false);
    assert.equal(existing.draft, false, "Existing release is still a draft");
    console.log(`GitHub release already complete: ${existing.html_url}`);
    return existing;
  }
  return request(`${prefix}/releases`, {
    method: "POST",
    body: {
      tag_name: release.tag,
      target_commitish: release.commit,
      name: release.tag,
      body,
      draft: false,
      prerelease: false,
      // Backfilling an older release must not move GitHub's latest pointer back.
      make_latest: "legacy",
    },
  });
}

function command(program, args, options = {}) {
  return execFileSync(program, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  })?.trim();
}

async function loadRelease() {
  const [marker, pkg, lock] = await Promise.all(
    [".sdk-release.json", "package.json", "package-lock.json"].map(
      async (file) => JSON.parse(await readFile(file, "utf8")),
    ),
  );
  const release = validateRelease({
    marker,
    pkg,
    lock,
    ref: process.env.GITHUB_REF,
    commit: process.env.GITHUB_SHA,
    repository: process.env.GITHUB_REPOSITORY,
  });
  assert.equal(command("git", ["rev-parse", "HEAD"]), release.commit);
  assert.equal(
    command("git", ["rev-parse", `refs/tags/${release.tag}^{commit}`]),
    release.commit,
  );
  console.log(`Validated ${release.tag} at ${release.commit}`);
  return release;
}

async function githubRequest(path, { method = "GET", body, allow404 } = {}) {
  assert.ok(process.env.GH_TOKEN, "GH_TOKEN is required to finish the release");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    ...(body && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok)
    throw new HttpError(
      response.status,
      `GitHub request failed: ${response.status}`,
    );
  return response.json();
}

export async function verifyInstallation(release, metadata) {
  const directory = await mkdtemp(join(tmpdir(), "glam-sdk-verify-"));
  await writeFile(join(directory, "package.json"), '{"private":true}\n');
  let cache;
  for (let attempt = 1; attempt <= 20; attempt++) {
    cache = join(directory, `cache-${attempt}`);
    // Fresh cache prevents a stale packument from repeating ETARGET after publish.
    try {
      command(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--prefer-online",
          `--registry=${REGISTRY}`,
          `--cache=${cache}`,
          `${PACKAGE}@${release.version}`,
        ],
        { cwd: directory, stdio: "inherit" },
      );
      break;
    } catch (error) {
      if (attempt === 20) throw error;
      await sleep(15_000);
    }
  }
  const installedLock = JSON.parse(
    await readFile(join(directory, "package-lock.json"), "utf8"),
  );
  assert.equal(
    installedLock.packages?.[`node_modules/${PACKAGE}`]?.integrity,
    metadata.dist.integrity,
    "Installed tarball does not match the verified registry artifact",
  );
  command(
    process.execPath,
    [
      "-e",
      `
    const assert = require('node:assert/strict');
    assert.equal(require('${PACKAGE}/package.json').version, process.argv[1]);
    assert.equal(typeof require('${PACKAGE}').getGlamProtocolProgramId, 'function');
  `,
      release.version,
    ],
    { cwd: directory, stdio: "inherit" },
  );
  command(
    "npm",
    [
      "audit",
      "signatures",
      "--prefer-online",
      `--cache=${cache}`,
      `--registry=${REGISTRY}`,
    ],
    {
      cwd: directory,
      stdio: "inherit",
    },
  );
}

async function main() {
  const mode = process.argv[2];
  assert.ok(["validate", "publish"].includes(mode), "Use validate or publish");
  const release = await loadRelease();
  if (mode === "validate") return;
  const pack = JSON.parse(
    command("npm", ["pack", "--ignore-scripts", "--json"]),
  )[0];
  const files = new Set(pack.files.map((file) => file.path));
  for (const file of [
    "index.cjs.js",
    "index.esm.js",
    "index.cjs.d.ts",
    "index.esm.d.ts",
    "target/idl/glam_protocol.json",
    "target/types/glam_protocol.ts",
  ])
    assert.ok(files.has(file), `Missing expected package file: ${file}`);
  assert.equal(pack.name, PACKAGE);
  assert.equal(pack.version, release.version);
  const integrity = `sha512-${createHash("sha512")
    .update(await readFile(pack.filename))
    .digest("base64")}`;
  assert.equal(pack.integrity, integrity);
  await writeFile(
    ".build/release-pack.json",
    `${JSON.stringify(pack, null, 2)}\n`,
  );
  await publishAndVerify({
    release,
    integrity,
    publish: () =>
      command(
        "npm",
        [
          "publish",
          "--ignore-scripts",
          "--access",
          "public",
          "--provenance",
          "--tag",
          "latest",
          `--registry=${REGISTRY}`,
        ],
        { stdio: "inherit" },
      ),
    verify: (metadata) => verifyInstallation(release, metadata),
    finalize: () => ensureGitHubRelease(release, githubRequest),
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
