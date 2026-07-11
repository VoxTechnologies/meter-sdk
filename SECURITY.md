# Security policy

Do not report vulnerabilities in public GitHub issues. Email `hara@hacci.net`
with the affected package and version, reproduction details, and potential
impact. An acknowledgement should arrive within three business days.

The currently supported SDK line is the latest published minor release.
Security fixes are released as new immutable npm versions with provenance.

Service API keys, onboarding keys, webhook signing secrets, and upstream MCP
credentials must remain in server-side secret storage. Rotate a credential
immediately if it appears in source control, frontend bundles, logs, or issue
attachments.
