import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { DemoClient } from "./demo.js";
import { buildServer } from "./server.js";

const REPO = "https://github.com/dwadlane/servicem8-mcp";

const page = (origin: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ServiceM8 MCP Live Demo</title>
<style>
body{font:18px/1.6 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#17181c;background:#faf8f5}
h1{font-size:30px;line-height:1.2;margin:0 0 8px}
code{background:#fff;border:1px solid #e3ded6;padding:12px 14px;display:block;overflow-x:auto;font-size:16px;margin:12px 0}
a{color:#0b6bcb}small{color:#555}
</style></head><body>
<h1>Ask Claude About Your Trade Business</h1>
<p>This is a live ServiceM8 MCP server running on fictional data for Bright Spark Electrical. Read-only. Nothing to install.</p>
<p><b>Paste this URL into Claude.ai</b> (Settings, Connectors, Add custom connector):</p>
<code>${origin}/mcp</code>
<p><b>Or in Claude Code:</b></p>
<code>claude mcp add --transport http servicem8-demo ${origin}/mcp</code>
<p>Then ask: "Which quotes are going cold?" or "How is the pipeline looking?"</p>
<p><a href="${REPO}">Source on GitHub</a></p>
<p><small>Built by <a href="https://gaps2gains.com">Gaps2Gains</a></small></p>
</body></html>`;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};

/** Stateless streamable HTTP MCP handler: demo client only, read tools only. */
export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/mcp") {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method === "POST") {
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > 16_384) return new Response("Request too large", { status: 413, headers: cors });
    }
    const server = buildServer(new DemoClient(), { allowWrites: false });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const res = await transport.handleRequest(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  }
  if (url.pathname === "/" && req.method === "GET") {
    return new Response(page(url.origin), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return new Response("Not found", { status: 404 });
}

export default { fetch: handle };
