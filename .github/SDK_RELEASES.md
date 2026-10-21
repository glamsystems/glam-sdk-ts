# SDK publication

The private `glamsystems/glam` monorepo prepares and approves SDK releases.
This repository builds the public source and publishes `@glamsystems/glam-sdk`
using npm trusted publishing. No developer npm token is needed.

## Installation and activation

Land this publishing workflow and its scripts on public `main` before enabling
the monorepo release coordinator. The ordinary source mirror preserves public
workflows and scripts; it will not install these changes for you.

Keep the npm trusted publisher configured for:

- Organization: `glamsystems`
- Repository: `glam-sdk-ts`
- Workflow: `publish.yml`
- Environment: `npm-production`
- Permission to publish directly with `npm publish`

Set the repository variable `SDK_RELEASE_PUBLISH_ENABLED=true` only when the
monorepo coordinator and credentials are configured and activation is approved.
Without that variable, both tag pushes and manual runs skip publication.
Do not rename the workflow or move publishing into a workflow called from the
private repository; npm validates the publishing workflow identity.

## Release contract

The coordinator creates `release/sdk-vX.Y.Z` from public `main`, copies the exact
approved SDK source, updates the runtime package fields and npm lockfile, and
adds `.sdk-release.json`:

```json
{
  "schemaVersion": 1,
  "package": "@glamsystems/glam-sdk",
  "version": "1.2.0",
  "source": {
    "repository": "glamsystems/glam",
    "commit": "0123456789012345678901234567890123456789"
  },
  "notes": "Approved release notes"
}
```

It tags that exact commit `vX.Y.Z`. The tag, metadata, package and both lockfile
version fields must agree. The release commit can be on its isolated release
branch; it does not have to be an ancestor of public `main`. Only stable versions
are supported. Regular source-sync commits and manual runs on `main` cannot
publish through this workflow.

The workflow checks out the tag's exact SHA, installs locked dependencies,
builds, and packs the artifact. It treats only a registry HTTP 404 as absence.
It publishes a missing version once. An existing version is accepted only when
its name, version, source repository, `gitHead` and tarball integrity match.

Publication uses the checked-out directory with `--ignore-scripts` after the
explicit build. This preserves npm's `gitHead` metadata without rebuilding during
publication. The pack manifest is retained as a workflow artifact.

Registry visibility and installation are retried with fresh caches. The workflow
checks the installed package version and entrypoint, runs `npm audit signatures`,
and requires provenance before creating the public GitHub Release. Its notes are
the approved notes followed by the identity comment:

```text
<!-- sdk-release: PRIVATE_COMMIT_SHA PUBLIC_COMMIT_SHA -->
```

Existing tags or releases with conflicting identity cause failure; they are
never moved or overwritten. New releases use GitHub's semantic-version latest
selection. Publishing an older missing npm version cannot regress `latest`;
recovery of an existing version preserves a newer `latest`. A missing or older
`latest` blocks completion until a maintainer restores the intended dist-tag.

## Recovery and local checks

Rerun the failed workflow or dispatch `publish.yml` at the same `vX.Y.Z` tag.
Do not move the tag or bump the version to retry verification. If publishing
succeeded but installation, signatures or GitHub Release creation failed, the
rerun verifies the already-published artifact and resumes completion.

The old `v1.1.2` tag predates this contract and has no release metadata. Do not
rewrite historical tags to adopt it; any historical repair is a separate task.
The private coordinator completes its own tags and release records only after
this public run and registry identity are verified.

Local release logic tests:

```bash
node --test scripts/tests/release-sdk.test.mjs
npm ci
npm run build
npm pack --ignore-scripts --dry-run --json
```

The tests inject registry, publication and GitHub operations and never publish.
The `publish` script mode is reserved for the enabled, tagged GitHub workflow.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the
OIDC and public provenance requirements.
