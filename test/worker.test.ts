import { describe, expect, it } from "vitest";
import { handle } from "../src/worker.js";

const rpc = (body: unknown) =>
  handle(new Request("https://x.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  }));

describe("worker", () => {
  it("serves a landing page", async () => {
    const res = await handle(new Request("https://x.test/"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("https://x.test/mcp");
  });

  it("lists read tools only", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("cold_quotes");
    expect(names).not.toContain("create_job");
    expect(names).not.toContain("add_job_note");
  });
});
