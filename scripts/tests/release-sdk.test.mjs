import assert from "node:assert/strict";
import test from "node:test";
import {
  PACKAGE,
  REPOSITORY,
  HttpError,
  assertPackageIdentity,
  compareVersions,
  ensureGitHubRelease,
  publishAndVerify,
  registryVersion,
  releaseBody,
  validateRelease,
} from "../release-sdk.mjs";

const commit = "a".repeat(40);
const integrity = "sha512-test-package-integrity";
const release = {
  schemaVersion: 1,
  package: PACKAGE,
  version: "1.2.0",
  source: { repository: "glamsystems/glam", commit: "b".repeat(40) },
  notes: "## SDK 1.2.0\n\nApproved changes.",
  commit,
  tag: "v1.2.0",
};
const metadata = {
  name: PACKAGE,
  version: release.version,
  gitHead: commit,
  repository: { url: `git+https://github.com/${REPOSITORY}.git` },
  dist: {
    integrity,
    signatures: [{ keyid: "test-registry-key" }],
    attestations: {
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
    },
  },
};

function validationInput() {
  const pkg = {
    name: PACKAGE,
    version: release.version,
    repository: { url: `https://github.com/${REPOSITORY}.git` },
  };
  return {
    marker: structuredClone(release),
    pkg,
    lock: { ...pkg, packages: { "": { ...pkg } } },
    ref: `refs/tags/${release.tag}`,
    commit,
    repository: REPOSITORY,
  };
}

test("valid release records bind private source, public tag, package and lock", () => {
  assert.equal(validateRelease(validationInput()).commit, commit);
});

for (const [description, change] of [
  [
    "branch dispatch",
    (input) => {
      input.ref = "refs/heads/main";
    },
  ],
  [
    "wrong tag",
    (input) => {
      input.ref = "refs/tags/v1.2.1";
    },
  ],
  [
    "another repository",
    (input) => {
      input.repository = "fork/glam-sdk-ts";
    },
  ],
  [
    "unknown metadata schema",
    (input) => {
      input.marker.schemaVersion = 2;
    },
  ],
  [
    "wrong source repository",
    (input) => {
      input.marker.source.repository = "fork/glam";
    },
  ],
  [
    "short source SHA",
    (input) => {
      input.marker.source.commit = "abc1234";
    },
  ],
  [
    "package version mismatch",
    (input) => {
      input.pkg.version = "1.2.1";
    },
  ],
  [
    "lock version mismatch",
    (input) => {
      input.lock.version = "1.2.1";
    },
  ],
  [
    "lock root mismatch",
    (input) => {
      input.lock.packages[""].version = "1.2.1";
    },
  ],
  [
    "missing notes",
    (input) => {
      input.marker.notes = " ";
    },
  ],
  [
    "prerelease",
    (input) => {
      input.marker.version = "1.2.0-test";
    },
  ],
]) {
  test(`release validation rejects ${description}`, () => {
    const input = validationInput();
    change(input);
    assert.throws(() => validateRelease(input));
  });
}

test("only registry 404 means absent; server and auth errors stay errors", async () => {
  assert.equal(
    await registryVersion(
      "1.2.0",
      async () => new Response("", { status: 404 }),
    ),
    null,
  );
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(
      registryVersion("1.2.0", async () => new Response("", { status })),
      (error) => error.status === status,
    );
  }
  await assert.rejects(
    registryVersion("1.2.0", async () => {
      throw new TypeError("network offline");
    }),
  );
  assert.deepEqual(
    await registryVersion("1.2.0", async () => Response.json(metadata)),
    metadata,
  );
});

test("immutable version identity requires exact commit and bytes", () => {
  assertPackageIdentity(metadata, release, integrity);
  for (const change of [
    { name: "another-package" },
    { version: "1.1.2" },
    { gitHead: "c".repeat(40) },
    { dist: { integrity: "sha512-other" } },
    { repository: { url: "https://github.com/fork/glam-sdk-ts" } },
  ])
    assert.throws(() =>
      assertPackageIdentity({ ...metadata, ...change }, release, integrity),
    );
});

function scenario(overrides = {}) {
  const calls = [];
  let published = false;
  let latest = { version: "1.1.2" };
  const options = {
    release,
    integrity,
    lookup: async () => (published ? metadata : null),
    latest: async () => latest,
    publish: async () => {
      calls.push("publish");
      published = true;
      latest = metadata;
    },
    verify: async () => {
      calls.push("verify");
    },
    finalize: async () => {
      calls.push("finalize");
    },
    delay: async () => {
      calls.push("delay");
    },
    attempts: 3,
    ...overrides,
  };
  return { calls, options };
}

test("absent version publishes once, verifies, then finalizes", async () => {
  const { calls, options } = scenario();
  await publishAndVerify(options);
  assert.deepEqual(calls, ["publish", "verify", "finalize"]);
});

test("matching existing version completes without publication and preserves newer latest", async () => {
  const { calls, options } = scenario({
    lookup: async () => metadata,
    latest: async () => ({ version: "1.3.0" }),
  });
  await publishAndVerify(options);
  assert.deepEqual(calls, ["verify", "finalize"]);
});

test("a conflicting existing version never publishes or finalizes", async () => {
  const { calls, options } = scenario({
    lookup: async () => ({ ...metadata, gitHead: "c".repeat(40) }),
  });
  await assert.rejects(publishAndVerify(options), /source commit differs/);
  assert.deepEqual(calls, []);
});

test("failed initial lookup does not authorize publication", async () => {
  const { calls, options } = scenario({
    lookup: async () => {
      throw new HttpError(503, "Unavailable");
    },
  });
  await assert.rejects(publishAndVerify(options), /Unavailable/);
  assert.deepEqual(calls, []);
});

test("a new older version cannot regress npm latest", async () => {
  const { calls, options } = scenario({
    latest: async () => ({ version: "1.3.0" }),
  });
  await assert.rejects(publishAndVerify(options), /older version/);
  assert.deepEqual(calls, []);
});

test("fresh lookups retry visibility and transient errors after publication", async () => {
  let count = 0;
  const { calls, options } = scenario({
    lookup: async () => {
      count++;
      if (count <= 2) return null;
      if (count === 3) throw new HttpError(503, "Unavailable");
      return metadata;
    },
  });
  await publishAndVerify(options);
  assert.deepEqual(calls, ["publish", "delay", "delay", "verify", "finalize"]);
});

test("a lost publish response can complete by verifying the exact registry version", async () => {
  let published = false;
  const { calls, options } = scenario({
    lookup: async () => (published ? metadata : null),
    latest: async () => (published ? metadata : { version: "1.1.2" }),
    publish: async () => {
      published = true;
      throw new Error("Response lost");
    },
  });
  await publishAndVerify(options);
  assert.deepEqual(calls, ["verify", "finalize"]);
});

test("failed post-publish verification reruns without publishing again", async () => {
  let verifications = 0;
  const { calls, options } = scenario({
    verify: async () => {
      verifications++;
      if (verifications === 1)
        throw new Error("Registry signature service unavailable");
    },
  });
  await assert.rejects(publishAndVerify(options), /signature service/);
  assert.deepEqual(calls, ["publish"]);
  await publishAndVerify(options);
  assert.deepEqual(calls, ["publish", "finalize"]);
});

test("exhausted publication visibility does not finalize", async () => {
  const { calls, options } = scenario({ lookup: async () => null });
  await assert.rejects(publishAndVerify(options), /did not become visible/);
  assert.deepEqual(calls, ["publish", "delay", "delay"]);
});

test("missing provenance cannot complete a release", async () => {
  const { calls, options } = scenario({
    lookup: async () => ({
      ...metadata,
      dist: { integrity, signatures: [{}] },
    }),
  });
  await assert.rejects(publishAndVerify(options), /provenance is missing/);
  assert.deepEqual(calls, []);
});

test("version comparison is numeric and rejects invalid latest tags", () => {
  assert.equal(compareVersions("1.10.0", "1.2.0"), 1);
  assert.equal(compareVersions("1.2.0", "2.0.0"), -1);
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.throws(() => compareVersions("1.2.0-test", "1.2.0"));
});

function githubScenario({ existing = null, taggedCommit = commit } = {}) {
  const writes = [];
  const request = async (path, options = {}) => {
    if (path.includes("/git/ref/"))
      return { object: { type: "commit", sha: taggedCommit } };
    if (path.includes("/releases/tags/")) return existing;
    assert.equal(options.method, "POST");
    writes.push(options.body);
    return options.body;
  };
  return { request, writes };
}

test("release creation binds exact tag, source and approved notes", async () => {
  const { request, writes } = githubScenario();
  await ensureGitHubRelease(release, request);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].target_commitish, commit);
  assert.equal(writes[0].tag_name, release.tag);
  assert.equal(writes[0].body, releaseBody(release));
  assert.equal(writes[0].draft, false);
  assert.equal(writes[0].prerelease, false);
  assert.equal(writes[0].make_latest, "legacy");
});

test("matching completed release is idempotent", async () => {
  const { request, writes } = githubScenario({
    existing: {
      tag_name: release.tag,
      target_commitish: commit,
      body: releaseBody(release),
      draft: false,
      prerelease: false,
    },
  });
  await ensureGitHubRelease(release, request);
  assert.deepEqual(writes, []);
});

test("moved tags and conflicting releases are never overwritten", async () => {
  for (const input of [
    { taggedCommit: "c".repeat(40) },
    { existing: { tag_name: release.tag, target_commitish: "main" } },
    {
      existing: {
        tag_name: release.tag,
        target_commitish: commit,
        body: "Unrelated release",
      },
    },
  ]) {
    const { request, writes } = githubScenario(input);
    await assert.rejects(ensureGitHubRelease(release, request));
    assert.deepEqual(writes, []);
  }
});
