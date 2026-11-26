#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpClient } from "./client.js";
import { DemoClient } from "./demo.js";
import { buildServer } from "./server.js";

const demo = process.env.SERVICEM8_DEMO === "1" || !process.env.SERVICEM8_API_KEY;
const client = demo ? new DemoClient() : new HttpClient(process.env.SERVICEM8_API_KEY!);
const allowWrites = demo || process.env.SERVICEM8_ALLOW_WRITES === "1";

if (demo) console.error("servicem8-mcp: no SERVICEM8_API_KEY, running on demo data (Bright Spark Electrical).");
await buildServer(client, { allowWrites }).connect(new StdioServerTransport());
