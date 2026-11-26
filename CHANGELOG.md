# Changelog

All notable changes to ServiceM8 MCP Server are listed here.

## 0.2.0 (2026-11-27)

- Live public demo on Cloudflare Workers: a streamable HTTP MCP server at `/mcp`, read-only, fictional data.
- `scripts/check-remote.ts` to verify the live demo.

## 0.1.0 (2026-11-27)

First release. A Model Context Protocol server that connects Claude to ServiceM8 jobs, quotes, clients and schedules.

- Read tools for jobs, quotes, the schedule and the pipeline.
- Two write tools, off unless `SERVICEM8_ALLOW_WRITES=1` is set.
- Demo mode with no API key, using a fictional Melbourne electrician.
- Tests and CI on every push.
