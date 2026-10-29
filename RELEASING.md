# Release lifecycle

Matches pi-bro's version-in-PR, main-triggered release lifecycle. pi-comms additionally builds its generated bundles before packing.

## Changes and CI

1. Change source and tests. Run `npm ci --ignore-scripts && npm run verify`.
2. For a subsequent runtime release, run `npm version patch|minor|major --no-git-tag-version` and add a matching `## [X.Y.Z]` section in `CHANGELOG.md`.
3. Open a PR. CI verifies Linux Node 24, the Node 22.19.0 floor, macOS Node 24, native Pi 1.4.0 behavior and the installed package. Release metadata checks versions, lockfile, changelog and shipped source/build changes against npm. `release:none` explicitly permits a no-release change; it cannot accompany a version bump.
4. Merge after checks pass. Main triggers `publish.yml`: verify, tag the version, check out that tag, build/pack, publish with npm OIDC provenance, then create a GitHub release with the tarball.

Re-running the release workflow skips already-published versions and existing releases. Existing tags are reused, never moved; a new version must use a new tag. No paid-model calls are part of verification. PiG support is not claimed or copied from pi-bro's separate product-specific checks.

## First npm publication

The first publish creates `pi-comms`; no separate registry create command is needed. It requires an npm account authorized to claim the name and any required interactive 2FA. Never put npm credentials in tracked files or chat.

After the reviewed release commit is tagged and its package verified:

```sh
npm login
npm publish pi-comms-0.1.0.tgz --access public --ignore-scripts
```

Then configure the package's npm trusted publisher:

- GitHub owner: `tranhoangnguyen03`
- Repository: `pi-comms`
- Workflow: `publish.yml`

Re-run the GitHub release workflow to finish any interrupted GitHub release creation. Future versions use trusted publishing without a long-lived npm token. An initial interactive local publish does not claim GitHub provenance.

The workflow does not change anyone's normal Pi installation. Memory-only state cannot be migrated during upgrades; follow README update/rollback instructions.
