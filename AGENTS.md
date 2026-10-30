# PR and release requirements

Before opening or updating a PR, read `RELEASING.md`.

- PRs that change shipped behavior must bump `package.json` and `package-lock.json` together using `npm version patch --no-git-tag-version` (choose minor or major when appropriate), and add a matching `## [X.Y.Z]` entry in `CHANGELOG.md` describing the user-visible changes.
- Check the current version on `main` and npm before choosing the next version. Do not reuse a published version or an existing release tag.
- Documentation/test-only PRs that do not need publication may use `release:none`; do not use it to bypass the version bump for runtime fixes, or combine it with a version bump.
- Run `npm run verify` before handing off the PR. Include the intended release version and verification results in the PR description.

Merging to `main` triggers publication; the workflow does not bump versions. If the version already exists, it checks out the old tag and skips publishing, even when the run is green. Never move an existing release tag to ship new code.
