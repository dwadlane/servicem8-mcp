# Security Policy

## Reporting a Problem

If you find a security issue, please email dwad@gaps2gains.com with the details and steps to reproduce. Please don't post it in a public issue first. We reply within a few business days and will credit you if you want.

## How ServiceM8 MCP Server Handles Your Data

- **Read-only by default.** The two write tools only appear when `SERVICEM8_ALLOW_WRITES=1` is set.
- **Your key stays on your machine.** `SERVICEM8_API_KEY` is read from an environment variable and sent only to the ServiceM8 API (`api.servicem8.com`). We never log it, and it never goes to us.
- Demo mode makes no network calls to ServiceM8.

## Supported Versions

The latest release gets fixes.
