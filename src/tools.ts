import type { Row, ServiceM8Client } from "./client.js";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const str = (v: unknown) => (v == null ? "" : String(v));
const isActive = (r: Row) => num(r.active) === 1;
const day = (v: unknown) => str(v).slice(0, 10);
const daysSince = (v: unknown, now = new Date()) => {
  const t = Date.parse(str(v).replace(" ", "T"));
  return Number.isNaN(t) ? 0 : Math.floor((now.getTime() - t) / 86_400_000);
};
const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

export const JOB_STATUSES = ["Quote", "Work Order", "Completed", "Unsuccessful"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

async function clientNames(c: ServiceM8Client): Promise<Map<string, string>> {
  const companies = await c.list("company", "active eq 1");
  return new Map(companies.map((r) => [str(r.uuid), str(r.name)]));
}

function jobSummary(j: Row, names: Map<string, string>) {
  return {
    uuid: str(j.uuid),
    job_number: str(j.generated_job_id),
    status: str(j.status),
    client: names.get(str(j.company_uuid)) ?? "Unknown client",
    description: str(j.job_description),
    address: str(j.job_address),
    value: num(j.total_invoice_amount),
    date: day(j.date),
  };
}

export async function listJobs(c: ServiceM8Client, opts: { status?: JobStatus; search?: string; limit?: number }) {
  const filter = opts.status ? `status eq '${opts.status}' and active eq 1` : "active eq 1";
  const [jobs, names] = await Promise.all([c.list("job", filter), clientNames(c)]);
  const q = opts.search?.toLowerCase();
  return jobs
    .filter(isActive)
    .filter((j) => !opts.status || j.status === opts.status)
    .map((j) => jobSummary(j, names))
    .filter((j) => !q || `${j.client} ${j.description} ${j.address} ${j.job_number}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, opts.limit ?? 25);
}

export async function getJob(c: ServiceM8Client, uuid: string) {
  const job = await c.get("job", uuid);
  if (!job) return null;
  const [names, notes, activities] = await Promise.all([
    clientNames(c),
    c.list("note", `related_object_uuid eq '${uuid}'`),
    c.list("jobactivity", `job_uuid eq '${uuid}'`),
  ]);
  return {
    ...jobSummary(job, names),
    notes: notes.filter((n) => n.related_object_uuid === uuid).map((n) => ({ date: day(n.create_date), note: str(n.note) })),
    visits: activities
      .filter((a) => a.job_uuid === uuid && isActive(a) && num(a.activity_was_scheduled) === 1)
      .map((a) => ({ start: str(a.start_date), end: str(a.end_date) })),
  };
}

export async function findClients(c: ServiceM8Client, search: string) {
  const q = search.toLowerCase();
  const companies = await c.list("company", "active eq 1");
  return companies
    .filter(isActive)
    .filter((r) => `${str(r.name)} ${str(r.address)}`.toLowerCase().includes(q))
    .map((r) => ({ uuid: str(r.uuid), name: str(r.name), address: str(r.address) }))
    .slice(0, 20);
}

/** Quotes sent but not won or lost, oldest first. The money a trade business forgets to chase. */
export async function coldQuotes(c: ServiceM8Client, olderThanDays = 7, now = new Date()) {
  const [jobs, names] = await Promise.all([c.list("job", "status eq 'Quote' and active eq 1"), clientNames(c)]);
  const cold = jobs
    .filter((j) => isActive(j) && j.status === "Quote")
    .map((j) => ({ ...jobSummary(j, names), days_waiting: daysSince(j.quote_date || j.date, now) }))
    .filter((j) => j.days_waiting >= olderThanDays)
    .sort((a, b) => b.days_waiting - a.days_waiting);
  const total = cold.reduce((s, j) => s + j.value, 0);
  return {
    count: cold.length,
    total_value: total,
    headline: cold.length
      ? `${cold.length} quotes worth ${money(total)} have waited ${olderThanDays}+ days with no answer.`
      : `No quotes older than ${olderThanDays} days. Nice.`,
    quotes: cold,
  };
}

export async function pipelineSummary(c: ServiceM8Client) {
  const jobs = (await c.list("job", "active eq 1")).filter(isActive);
  const by = Object.fromEntries(
    JOB_STATUSES.map((s) => {
      const rows = jobs.filter((j) => j.status === s);
      return [s, { count: rows.length, value: rows.reduce((t, j) => t + num(j.total_invoice_amount), 0) }];
    }),
  ) as Record<JobStatus, { count: number; value: number }>;
  const decided = by.Completed.count + by["Work Order"].count + by.Unsuccessful.count;
  const winRate = decided ? Math.round(((by.Completed.count + by["Work Order"].count) / decided) * 100) : 0;
  return {
    open_quotes: by.Quote,
    booked_work: by["Work Order"],
    completed: by.Completed,
    lost: by.Unsuccessful,
    win_rate_percent: winRate,
    headline: `${money(by.Quote.value)} sitting in open quotes, ${money(by["Work Order"].value)} booked, ${winRate}% of decided quotes won.`,
  };
}

export async function schedule(c: ServiceM8Client, date: string) {
  const [acts, staff, names] = await Promise.all([
    c.list("jobactivity", `start_date gt '${date} 00:00:00' and start_date lt '${date} 23:59:59' and activity_was_scheduled eq 1`),
    c.list("staff"),
    clientNames(c),
  ]);
  const staffName = new Map(staff.map((s) => [str(s.uuid), `${str(s.first)} ${str(s.last)}`.trim()]));
  const visits = acts.filter((a) => isActive(a) && num(a.activity_was_scheduled) === 1 && day(a.start_date) === date);
  const jobs = await Promise.all(visits.map((a) => c.get("job", str(a.job_uuid))));
  return visits
    .map((a, i) => ({
      start: str(a.start_date).slice(11, 16),
      end: str(a.end_date).slice(11, 16),
      staff: staffName.get(str(a.staff_uuid)) ?? "Unassigned",
      client: jobs[i] ? names.get(str(jobs[i]!.company_uuid)) ?? "Unknown client" : "Unknown",
      job: jobs[i] ? str(jobs[i]!.job_description) : "",
      address: jobs[i] ? str(jobs[i]!.job_address) : "",
    }))
    .sort((x, y) => x.start.localeCompare(y.start));
}

export async function createJob(
  c: ServiceM8Client,
  input: { status: "Quote" | "Work Order"; job_address: string; job_description: string; company_uuid?: string },
) {
  const uuid = await c.create("job", { ...input });
  return { uuid, status: input.status, message: `Created a ${input.status} job.` };
}

export async function addJobNote(c: ServiceM8Client, jobUuid: string, note: string) {
  const uuid = await c.create("note", { related_object: "job", related_object_uuid: jobUuid, note });
  return { uuid, message: "Note added to the job diary." };
}
