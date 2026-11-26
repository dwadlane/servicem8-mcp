export type Row = Record<string, unknown>;

/** The minimal surface every tool needs. Swap in the demo client to run without an account. */
export interface ServiceM8Client {
  list(resource: string, filter?: string): Promise<Row[]>;
  get(resource: string, uuid: string): Promise<Row | null>;
  create(resource: string, body: Row): Promise<string>;
}

export class ServiceM8Error extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const BASE = "https://api.servicem8.com/api_1.0";

export class HttpClient implements ServiceM8Client {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly base = BASE,
  ) {
    if (!apiKey) throw new ServiceM8Error("SERVICEM8_API_KEY is not set.");
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 401) throw new ServiceM8Error("ServiceM8 rejected the API key (401). Create one under Settings, API Keys.", 401);
    if (res.status === 429) throw new ServiceM8Error("ServiceM8 rate limit reached (429). Try again in a minute.", 429);
    if (!res.ok) throw new ServiceM8Error(`ServiceM8 returned ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
    return res;
  }

  async list(resource: string, filter?: string): Promise<Row[]> {
    const q = filter ? `?%24filter=${encodeURIComponent(filter)}` : "";
    const res = await this.request(`/${resource}.json${q}`);
    const data = await res.json();
    return Array.isArray(data) ? (data as Row[]) : [];
  }

  async get(resource: string, uuid: string): Promise<Row | null> {
    try {
      const res = await this.request(`/${resource}/${encodeURIComponent(uuid)}.json`);
      return (await res.json()) as Row;
    } catch (e) {
      if (e instanceof ServiceM8Error && e.status === 404) return null;
      throw e;
    }
  }

  async create(resource: string, body: Row): Promise<string> {
    const res = await this.request(`/${resource}.json`, { method: "POST", body: JSON.stringify(body) });
    return res.headers.get("x-record-uuid") ?? "";
  }
}
