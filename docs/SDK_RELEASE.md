# SDK release runbook

Meter publishes `@meter-mcp/sdk`, `@meter-mcp/mcp`, `@meter-mcp/adapters`, and
`@meter-mcp/cli` together from the public `VoxTechnologies/meter-sdk` repository.
Meter's service implementation remains in a separate private repository.

That repository slug is not cosmetic: `scripts/verify-sdk-release.mjs`
asserts that every manifest's `repository.url` is
`git+https://github.com/VoxTechnologies/meter-sdk.git`, and npm binds trusted
publishing to that same slug. Renaming or forking the repository breaks
publishing even though CI stays green.

## One-time npm setup

1. Confirm `gitleaks git .` and the GitHub secret-history job complete with zero findings.
2. Sign in to npm with an account that can publish the `@meter-mcp` scope.
3. Confirm `npm whoami` and `npm access ls-packages` succeed.
4. Bootstrap each package at `0.1.0` using `npm publish --access public` from its package directory.
5. Configure a trusted GitHub publisher for each package:
   - repository: `VoxTechnologies/meter-sdk`
   - workflow: `sdk-publish.yml`
   - environment: `npm`
   - allowed action: `npm publish`
6. Require approval for the GitHub `npm` environment and disallow token-based publishing on npm.
7. Keep the repository public. The publish workflow's preflight job fails on a
   private repository, because npm provenance requires public source.

Bootstrap commands, after creating or joining the `@meter-mcp` npm organization:

```bash
npm login
npm whoami
npm run verify
npm publish --workspace @meter-mcp/sdk --access public
npm publish --workspace @meter-mcp/mcp --access public
npm publish --workspace @meter-mcp/adapters --access public
npm publish --workspace @meter-mcp/cli --access public
```

Then install npm 11.11.0 or newer, matching the version the publish workflow
pins, and register the workflow as the trusted publisher for each package:

```bash
npm install --global npm@latest
npm trust github @meter-mcp/sdk --file sdk-publish.yml --repo VoxTechnologies/meter-sdk --env npm --allow-publish --yes
npm trust github @meter-mcp/mcp --file sdk-publish.yml --repo VoxTechnologies/meter-sdk --env npm --allow-publish --yes
npm trust github @meter-mcp/adapters --file sdk-publish.yml --repo VoxTechnologies/meter-sdk --env npm --allow-publish --yes
npm trust github @meter-mcp/cli --file sdk-publish.yml --repo VoxTechnologies/meter-sdk --env npm --allow-publish --yes
```

The bootstrap publish is the only step that needs interactive npm credentials.
Subsequent releases use GitHub OIDC and do not use a long-lived npm token.

## Prepare a release

1. Add a changeset with `npm run changeset` for every user-visible SDK change.
2. Merge the generated version changes from `npm run version:packages`.
3. Run `npm run verify` from a clean checkout.
4. Create and push the matching tag, for example `sdk-v0.2.0`.
5. Approve the protected `npm` environment deployment.
6. Confirm all four packages have the expected version, provenance, README, license, and repository link on npm.

Before anything is published, the workflow runs `scripts/verify-sdk-release.mjs`,
which rejects package versions that have diverged from each other, a tag that is
not exactly `sdk-v<version>`, and any manifest missing the `publishConfig` or
`repository.url` that trusted publishing is bound to. It then runs the full
`npm run verify` gate: build, tests, typecheck, package-metadata lint, OpenAPI
check, packed-consumer install, and `npm audit`. Packages publish in dependency
order: SDK, MCP, adapters, CLI.

## Recovery

Never overwrite a published version. Fix the issue, add a changeset, and
publish a new patch version. Use npm deprecation messages for a defective
version instead of unpublishing it unless npm security policy requires removal.

Re-running the workflow after a partial failure is safe: each publish step
queries the registry first and skips any version already there, so only the
packages that did not make it are published.
