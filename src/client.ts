// The calls to Datacircle's open API: https://api.datacircle.dev/v1 (its spec: https://api.datacircle.dev/v1/openapi.json).

/** The API's address. */
export const BASE_URL = 'https://api.datacircle.dev/v1';

/** This package's version, sent in each call's User-Agent where the runtime lets a call set one. */
export const VERSION = '0.1.0';

/** Where the tools call. Left out, they call BASE_URL with the runtime's fetch. */
export interface DatacircleOptions {
  /** The API's address, https://api.datacircle.dev/v1 when left out. */
  baseURL?: string;
  /** The fetch the tools use (a proxy, a timeout, a test). The runtime's fetch when left out. */
  fetch?: typeof globalThis.fetch;
}

/** An answer of 4xx: the API's own words, given back as the tool's result. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Answer = Record<string, unknown>;

export class Client {
  private readonly base: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(options: DatacircleOptions = {}) {
    this.base = (options.baseURL ?? BASE_URL).replace(/\/+$/, '');
    this.fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** Calls one path and gives its JSON. A 429 is waited for once, a minute at most. */
  async get<T = Answer>(path: string, query: Record<string, string | number | undefined> = {}, signal?: AbortSignal): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const search = params.toString();
    const url = this.base + path + (search !== '' ? '?' + search : '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    // A browser sends its own User-Agent, and one set here would make the call ask the API's CORS first.
    if ((globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node) {
      headers['User-Agent'] = `datacircle-xmcp/${VERSION}`;
    }
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetch(url, { headers, signal });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error(`datacircle: ${(error as Error).message}`, { cause: error });
      }
      if (response.status === 429 && attempt === 0) {
        let wait = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
        if (!(wait >= 1 && wait <= 60)) wait = 60;
        await sleep(wait * 1000, signal);
        continue;
      }
      const text = await response.text();
      if (response.status >= 400 && response.status < 500) {
        let message = `${response.status} ${response.statusText}`.trim();
        try {
          const body = JSON.parse(text) as { error?: unknown };
          if (typeof body.error === 'string' && body.error !== '') message = body.error;
        } catch {
          // Not JSON: the status is the message.
        }
        throw new ApiError(response.status, message);
      }
      if (!response.ok) throw new Error(`datacircle: ${response.status} ${response.statusText}`.trim());
      return JSON.parse(text) as T;
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// A plan holds about 90 keys (its terms of use, its aggregators...): these choose a plan, the rest is on its page.
const PLAN_KEYS = ['api', 'rank', 'provider', 'plan', 'score', 'perThousand', 'notFoundPerThousand', 'billing', 'pay',
  'currency', 'units', 'unit', 'strengths', 'latencyMs', 'page', 'pricingPage', 'docs'];

export function brief(item: Answer, keys: readonly string[]): Answer {
  const kept: Answer = {};
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) kept[key] = item[key];
  }
  return kept;
}

export function briefPlans(plans: unknown): Answer[] {
  return objects(plans).map((plan) => brief(plan, PLAN_KEYS));
}

export function objects(value: unknown): Answer[] {
  return Array.isArray(value) ? value.filter((item): item is Answer => typeof item === 'object' && item !== null) : [];
}

/** The API's rule for a slug: the name in lowercase letters and digits, the rest a hyphen. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clamp(n: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, Math.trunc(n)));
}
