# Security Policy

## Supported Versions

Security fixes are prioritized for the current `main` branch.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately instead of opening a public issue.

Email the maintainer with:

- A concise description of the issue
- Steps to reproduce or a proof of concept
- Any affected URLs, files, or workflows
- Your contact information for follow-up

The maintainer will acknowledge reports as soon as practical, investigate the impact, and coordinate a fix before public disclosure.

## Secret Handling

Never commit real `.env` files, API keys, OAuth secrets, service tokens, or AI provider keys. Future AI/API integrations must keep private keys in server-side environments only.
