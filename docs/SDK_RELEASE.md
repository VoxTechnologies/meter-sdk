# SDK release runbook

Meter publishes `@meter/sdk`, `@meter/mcp`, and `@meter/adapters` together from
the public `masterleopold/meter-sdk` repository. Meter's service implementation
remains in a separate private repository.

## One-time npm setup

1. Confirm `gitleaks git .` and the GitHub secret-history job complete with zero findings.
2. Sign in to npm with an account that can publish the `@meter` scope.
3. Confirm `npm whoami` and `npm access ls-packages` succeed.
4. Bootstrap each package at `0.1.0` using `npm publish --access public` from its package directory.
5. Configure a trusted GitHub publisher for each package:
   - repository: `masterleopold/meter-sdk`
   - workflow: `sdk-publish.yml`
   - environment: `npm`
   - allowed action: `npm publish`
6. Require approval for the GitHub `npm` environment and disallow token-based publishing on npm.

Bootstrap commands, after creating or joining the `@meter` npm organization:

```bash
npm login
npm whoami
npm run verify
npm publish --workspace @meter/sdk --access public
npm publish --workspace @meter/mcp --access public
npm publish --workspace @meter/adapters --access public
```

Then install npm 11.5.1 or newer and register the workflow as the trusted
publisher for each package:

```bash
npm install --global npm@latest
npm trust github @meter/sdk --file sdk-publish.yml --repo masterleopold/meter-sdk --env npm --allow-publish --yes
npm trust github @meter/mcp --file sdk-publish.yml --repo masterleopold/meter-sdk --env npm --allow-publish --yes
npm trust github @meter/adapters --file sdk-publish.yml --repo masterleopold/meter-sdk --env npm --allow-publish --yes
```

The bootstrap publish is the only step that needs interactive npm credentials.
Subsequent releases use GitHub OIDC and do not use a long-lived npm token.

## Prepare a release

1. Add a changeset with `npm run changeset` for every user-visible SDK change.
2. Merge the generated version changes from `npm run version:packages`.
3. Run `npm run verify` from a clean checkout.
4. Create and push the matching tag, for example `sdk-v0.2.0`.
5. Approve the protected `npm` environment deployment.
6. Confirm all three packages have the expected version, provenance, README, license, and repository link on npm.

The publish workflow rejects mismatched package versions, dirty generated
output, failed tests, malformed tarballs, and tags that do not match the SDK
version. Packages publish in dependency order: SDK, MCP, adapters.

## Recovery

Never overwrite a published version. Fix the issue, add a changeset, and
publish a new patch version. Use npm deprecation messages for a defective
version instead of unpublishing it unless npm security policy requires removal.
