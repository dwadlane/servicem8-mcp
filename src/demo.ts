import { randomUUID } from "node:crypto";
import type { Row, ServiceM8Client } from "./client.js";

/** Fictional data for Bright Spark Electrical, Melbourne. Dates are relative to today so every tool has something to show. */
function stamp(daysFromToday: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00:00`;
}

export function demoData(): Record<string, Row[]> {
  const staff = [
    { uuid: "s-1", first: "Matt", last: "Rossi", active: 1 },
    { uuid: "s-2", first: "Priya", last: "Nair", active: 1 },
  ];
  const companies = [
    { uuid: "c-1", name: "Harper Family", address: "12 Elm St, Essendon VIC 3040", active: 1 },
    { uuid: "c-2", name: "Northside Cafe", address: "88 Sydney Rd, Coburg VIC 3058", active: 1 },
    { uuid: "c-3", name: "Keilor Builders", address: "4 Industrial Dr, Keilor VIC 3036", active: 1 },
    { uuid: "c-4", name: "Dana Whitfield", address: "7 Lake Ave, Niddrie VIC 3042", active: 1 },
    { uuid: "c-5", name: "Greenvale Dental", address: "220 Mickleham Rd, Greenvale VIC 3059", active: 1 },
  ];
  const job = (id: number, company: string, status: string, quoteDays: number, amount: number, desc: string, address: string) => ({
    uuid: `j-${id}`, generated_job_id: String(1000 + id), active: 1, status, company_uuid: company,
    date: stamp(quoteDays), quote_date: stamp(quoteDays), edit_date: stamp(quoteDays),
    job_address: address, job_description: desc, total_invoice_amount: amount,
  });
  const jobs = [
    job(1, "c-1", "Quote", -16, 2850, "Switchboard upgrade, old ceramic fuses", companies[0].address),
    job(2, "c-2", "Quote", -9, 6400, "Kitchen fit out: 3 phase power for new ovens", companies[1].address),
    job(3, "c-3", "Quote", -3, 18900, "New townhouse development, 4 units, rough in", companies[2].address),
    job(4, "c-4", "Work Order", -5, 1250, "Install 2 split system circuits", companies[3].address),
    job(5, "c-5", "Work Order", -2, 3900, "Surgery lighting upgrade to LED", companies[4].address),
    job(6, "c-1", "Completed", -30, 480, "Safety switch tripping, fault found", companies[0].address),
    job(7, "c-2", "Completed", -21, 1720, "Emergency call out, power loss", companies[1].address),
    job(8, "c-4", "Unsuccessful", -40, 3300, "Solar ready switchboard", companies[3].address),
    job(9, "c-3", "Quote", -24, 9600, "Warehouse high bay lighting", companies[2].address),
  ];
  const act = (id: number, jobUuid: string, staffUuid: string, day: number, hour: number) => ({
    uuid: `a-${id}`, job_uuid: jobUuid, staff_uuid: staffUuid, active: 1, activity_was_scheduled: 1,
    start_date: stamp(day, hour), end_date: stamp(day, hour + 2),
  });
  const activities = [act(1, "j-4", "s-1", 0, 8), act(2, "j-5", "s-2", 0, 10), act(3, "j-5", "s-2", 1, 8), act(4, "j-4", "s-1", 2, 13)];
  return { staff, company: companies, job: jobs, jobactivity: activities, note: [] };
}

export class DemoClient implements ServiceM8Client {
  private readonly data = demoData();

  async list(resource: string): Promise<Row[]> {
    return [...(this.data[resource] ?? [])];
  }

  async get(resource: string, uuid: string): Promise<Row | null> {
    return (this.data[resource] ?? []).find((r) => r.uuid === uuid) ?? null;
  }

  async create(resource: string, body: Row): Promise<string> {
    const uuid = randomUUID();
    (this.data[resource] ??= []).push({ ...body, uuid, active: 1, date: stamp(0), edit_date: stamp(0) });
    return uuid;
  }
}
