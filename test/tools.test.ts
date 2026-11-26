import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/client.js";
import { DemoClient } from "../src/demo.js";
import * as t from "../src/tools.js";

describe("tools on demo data", () => {
  const c = new DemoClient();

  it("finds cold quotes oldest first with a dollar total", async () => {
    const r = await t.coldQuotes(c, 7);
    expect(r.count).toBe(3);
    expect(r.quotes.map((q) => q.job_number)).toEqual(["1009", "1001", "1002"]);
    expect(r.total_value).toBe(9600 + 2850 + 6400);
    expect(r.headline).toContain("$18,850");
  });

  it("summarizes the pipeline and win rate", async () => {
    const r = await t.pipelineSummary(c);
    expect(r.open_quotes).toEqual({ count: 4, value: 2850 + 6400 + 18900 + 9600 });
    expect(r.lost.count).toBe(1);
    expect(r.win_rate_percent).toBe(80);
  });

  it("lists today's schedule in time order with staff and client", async () => {
    const today = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const d = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    const r = await t.schedule(c, d);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ start: "08:00", staff: "Matt Rossi", client: "Dana Whitfield" });
  });

  it("filters and searches jobs", async () => {
    expect(await t.listJobs(c, { status: "Work Order" })).toHaveLength(2);
    const hits = await t.listJobs(c, { search: "switchboard" });
    expect(hits.map((j) => j.job_number).sort()).toEqual(["1001", "1008"]);
  });

  it("creates a job, adds a note and reads it back", async () => {
    const { uuid } = await t.createJob(c, { status: "Quote", job_address: "1 Test St, Coburg", job_description: "Sam, 0400 000 000, new power points" });
    await t.addJobNote(c, uuid, "Called back, wants Tuesday");
    const job = await t.getJob(c, uuid);
    expect(job?.status).toBe("Quote");
    expect(job?.notes[0].note).toBe("Called back, wants Tuesday");
  });

  it("returns null for an unknown job", async () => {
    expect(await t.getJob(c, "nope")).toBeNull();
  });
});

describe("HttpClient", () => {
  it("sends the API key header and encodes the filter", async () => {
    const f = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await new HttpClient("k123", f as unknown as typeof fetch).list("job", "status eq 'Quote'");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.servicem8.com/api_1.0/job.json?%24filter=status%20eq%20'Quote'");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("k123");
  });

  it("reads the new record uuid from the response header", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"errorCode":0}', { status: 200, headers: { "x-record-uuid": "abc" } }));
    expect(await new HttpClient("k", f as unknown as typeof fetch).create("job", {})).toBe("abc");
  });

  it("gives a plain message on a bad key", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    await expect(new HttpClient("bad", f as unknown as typeof fetch).list("job")).rejects.toThrow(/API key/);
  });

  it("refuses to start without a key", () => {
    expect(() => new HttpClient("")).toThrow(/SERVICEM8_API_KEY/);
  });
});
