// Usage: npx tsx scripts/check-remote.ts [https://host/mcp]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] ?? "https://servicem8-mcp-demo.dwad-lane.workers.dev/mcp";
const client = new Client({ name: "check-remote", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
console.log("tools:", names.join(", "));
if (names.includes("create_job") || names.includes("add_job_note")) throw new Error("write tools must not be exposed");

const text = (r: any) => JSON.parse(r.content[0].text);
const cold = text(await client.callTool({ name: "cold_quotes", arguments: { older_than_days: 7 } }));
console.log("cold_quotes:", cold.headline);
const pipe = text(await client.callTool({ name: "pipeline_summary", arguments: {} }));
console.log("pipeline_summary:", pipe.headline);
if (cold.count !== 3) throw new Error("unexpected cold quote count");
await client.close();
console.log("OK");
