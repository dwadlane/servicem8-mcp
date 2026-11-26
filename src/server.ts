import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServiceM8Client } from "./client.js";
import * as t from "./tools.js";

const text = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] });
const safe = <A,>(fn: (a: A) => Promise<unknown>) => async (a: A) => {
  try {
    return text(await fn(a));
  } catch (e) {
    return fail(e);
  }
};
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function buildServer(client: ServiceM8Client, opts: { allowWrites: boolean }) {
  const server = new McpServer({ name: "servicem8-mcp", version: "0.2.0" });
  const read = { readOnlyHint: true, openWorldHint: true };

  server.registerTool("cold_quotes", {
    title: "Quotes going cold",
    description: "Quotes sent but not yet won or lost, oldest first, with the total dollar value waiting. Use for 'who should I chase?'",
    inputSchema: { older_than_days: z.number().int().min(0).max(365).default(7).describe("Only quotes at least this many days old") },
    annotations: read,
  }, safe(({ older_than_days }) => t.coldQuotes(client, older_than_days)));

  server.registerTool("pipeline_summary", {
    title: "Pipeline summary",
    description: "Counts and dollar totals for open quotes, booked work, completed and lost jobs, plus win rate.",
    inputSchema: {},
    annotations: read,
  }, safe(() => t.pipelineSummary(client)));

  server.registerTool("schedule", {
    title: "Schedule for a day",
    description: "Booked visits for a date: time, staff member, client, job and address.",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, defaults to today") },
    annotations: read,
  }, safe(({ date }) => t.schedule(client, date ?? today())));

  server.registerTool("list_jobs", {
    title: "List jobs",
    description: "Active jobs, newest first. Filter by status and search client, description, address or job number.",
    inputSchema: {
      status: z.enum(t.JOB_STATUSES).optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(25),
    },
    annotations: read,
  }, safe((a) => t.listJobs(client, a)));

  server.registerTool("get_job", {
    title: "Job details",
    description: "One job with its client, value, diary notes and booked visits.",
    inputSchema: { uuid: z.string().min(1) },
    annotations: read,
  }, safe(async ({ uuid }) => (await t.getJob(client, uuid)) ?? { error: `No job found with uuid ${uuid}` }));

  server.registerTool("find_clients", {
    title: "Find clients",
    description: "Search clients by name or address.",
    inputSchema: { search: z.string().min(1) },
    annotations: read,
  }, safe(({ search }) => t.findClients(client, search)));

  if (opts.allowWrites) {
    server.registerTool("create_job", {
      title: "Create job",
      description: "Create a new Quote or Work Order job in ServiceM8, for example from a phone inquiry.",
      inputSchema: {
        status: z.enum(["Quote", "Work Order"]).default("Quote"),
        job_address: z.string().min(5),
        job_description: z.string().min(5).describe("Customer name, phone, and what they need done"),
        company_uuid: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, safe((a) => t.createJob(client, a)));

    server.registerTool("add_job_note", {
      title: "Add job note",
      description: "Add a note to a job's diary, such as a call summary or follow-up.",
      inputSchema: { job_uuid: z.string().min(1), note: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, safe(({ job_uuid, note }) => t.addJobNote(client, job_uuid, note)));
  }

  return server;
}
