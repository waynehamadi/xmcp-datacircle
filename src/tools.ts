// The four tools on Datacircle's open API, each as an xmcp tool file gives it: its schema, its metadata and its handler.
// The API needs no key: https://api.datacircle.dev/v1 (its spec: https://api.datacircle.dev/v1/openapi.json). More at
// https://datacircle.dev

import { z } from 'zod';
import { ApiError, Client, brief, briefPlans, clamp, objects, slugify } from './client.js';
import type { Answer, DatacircleOptions } from './client.js';

const LIST_APIS_ABOUT = "Lists the GTM APIs on Datacircle's sheet (https://datacircle.dev). GTM means go-to-market. GTM APIs are the APIs sales and marketing teams use. Gives each API's slug, how many plans and providers it has and its best plan. Call it first to find an API's slug.";
const BEST_PLANS_ABOUT = "Gives the best providers for an API: its plans best first by their score out of 100 on Datacircle's benchmark (https://datacircle.dev), each with its rank, provider, plan, $ per 1,000 calls and its page. perThousand is a plan's price of 1,000 items in dollars, pay the plan's whole price in its currency.";
const SEARCH_PLANS_ABOUT = "Searches every plan on Datacircle's sheet (https://datacircle.dev), or one API's, by provider or plan name, sorted by score, provider or price. Gives how many were found and up to limit of them. perThousand is a plan's price of 1,000 items in dollars, pay the plan's whole price in its currency.";
const PROVIDER_ABOUT = "Gives where one provider ranks: each API it sells and its rank on each on Datacircle's benchmark (https://datacircle.dev), with its best plan there, its best rank first. total is how many APIs it sells, ranked on how many of them it has a rank. For an API's best providers, call datacircle_best_plans.";

// Tells a model that sent a provider's name to an API's tool where a provider's plans are.
const FOR_PROVIDER = "A provider's plans: datacircle_search_plans with its name as query, like bright data, or datacircle_provider.";

// Tells a model that sent an API's slug to the provider's tool where an API's best providers are.
const FOR_API = "An API's best providers: datacircle_best_plans with the API's slug, like email-finder.";

// Each key's schema is what the model is sent, and its check runs first on what the model sent. The check is looser than the
// schema, so that a model that strays (another provider's, on an Anthropic-compatible API) is understood where it can be: null
// is a key left out, a number sent as a string is read as one, a fraction cut to its whole part, a number below its least
// takes its default and one above its most is cut to it. A key of its own is dropped. What it refuses, the model reads why.
// Each loose key is optional outside its check too, so that every JSON Schema made of it, input or output, lists it as optional.
const absent = (value: unknown) => (value === null ? undefined : value);
const count = (low: number, high: number | null, description: string) =>
  z.preprocess((value) => {
    value = absent(value);
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) value = Number(value);
    if (typeof value !== 'number' || !Number.isFinite(value)) return value;
    const n = Math.trunc(value);
    return n < low ? undefined : high !== null && n > high ? high : n;
  }, (high === null ? z.number().int().min(low) : z.number().int().min(low).max(high)).optional()).optional().describe(description);
const text = (description: string) => z.preprocess(absent, z.string().optional()).optional().describe(description);
const needed = (description: string) => z.string().describe(description);
const choice = (values: [string, ...string[]], description: string) => z.preprocess(absent, z.enum(values).optional()).optional().describe(description);

const listApisInput = {
  query: text("Words of the API's name or slug, like email or linkedin profile: the APIs that hold the most of them come first. Left out, the sheet's order"),
  limit: count(1, 200, 'How many APIs to give, 1 to 200. 20 when left out: the sheet has about 150'),
};

const bestPlansInput = {
  slug: needed("The API's slug, like email-finder or linkedin-profile, as datacircle_list_apis gives it"),
  limit: count(1, 50, 'How many plans to give, 1 to 50. 10 when left out'),
};

const searchPlansInput = {
  api: text("Only this API's plans: its name or slug, like email-finder. A provider's name goes in query, never here. Left out, every API"),
  query: text("Words that must all appear in the provider's or plan's name, like bright data. Left out, every plan"),
  sort: choice(['score', 'provider', 'price'], 'score (best first, the default), provider (A to Z) or price ($ per 1,000, lowest first)'),
  limit: count(1, 50, 'How many plans to give, 1 to 50. 10 when left out'),
  offset: count(0, null, 'How many found plans to skip first. 0 when left out'),
};

const providerInput = {
  slug: needed("The provider's slug, like bright-data, or its name, like Bright Data: the name is made a slug"),
};

/** datacircle_list_apis' input. */
export type ListApisInput = { query?: string | null; limit?: number | null };
/** datacircle_best_plans' input. */
export type BestPlansInput = { slug: string; limit?: number | null };
/** datacircle_search_plans' input. */
export type SearchPlansInput = { api?: string | null; query?: string | null; sort?: 'score' | 'provider' | 'price' | null; limit?: number | null; offset?: number | null };
/** datacircle_provider's input. */
export type ProviderInput = { slug: string };

/** A limit the model sent, within the API's bounds, or undefined for the API's default. */
const bounded = (n: number | null | undefined, high: number) => (n === undefined || n === null || !(n >= 1) ? undefined : clamp(n, 1, high));

/** An answer of 4xx (an unknown slug, a wrong argument) is the call's answer as {error}, the API's words. */
function asResult(error: unknown): Answer {
  if (error instanceof ApiError) return { error: error.message };
  throw error;
}

async function listApisRun(client: Client, { query, limit }: ListApisInput, signal?: AbortSignal): Promise<Answer> {
  let apis: Answer[];
  try {
    apis = objects(await client.get<unknown>('/apis', {}, signal));
  } catch (error) {
    return asResult(error);
  }
  const words = (query ?? '').toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const found = apis
    .map((api, order) => {
      const name = `${String(api.api ?? '')} ${String(api.slug ?? '').replace(/-/g, ' ')}`.toLowerCase();
      return { order, matched: words.filter((word) => name.includes(word)).length, api };
    })
    .filter(({ matched }) => matched > 0 || words.length === 0)
    // The most words matched first, the sheet's order within each.
    .sort((a, b) => b.matched - a.matched || a.order - b.order);
  const answer: Answer = {
    total: found.length,
    apis: found.slice(0, bounded(limit, 200) ?? 20)
      .map(({ api }) => brief(api, ['api', 'slug', 'plans', 'providers', 'best', 'bestPage', 'sheetPage'])),
  };
  if (words.length > 0 && (found.length === 0 || found[0].matched < words.length)) {
    // A provider's name sent as an API's, like Bright Data, whose data matches many APIs: where its plans are.
    answer.note = `No API's name holds every word of ${JSON.stringify(query)}. A provider's plans: datacircle_search_plans with its name as query, or datacircle_provider.`;
  }
  return answer;
}

async function bestPlansRun(client: Client, { slug, limit }: BestPlansInput, signal?: AbortSignal): Promise<Answer> {
  const api = slugify(slug ?? '');
  if (api === '') return { error: `Give an API's slug, like email-finder: datacircle_list_apis gives every slug. ${FOR_PROVIDER}` };
  try {
    const answer = await client.get(`/apis/${api}/best`, { limit: bounded(limit, 50) }, signal);
    return { ...answer, plans: briefPlans(answer.plans) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // A provider's name sent as the API's slug: the API's words, and where a provider's plans are.
      return { error: `${error.message}. datacircle_list_apis gives every API's slug. ${FOR_PROVIDER}` };
    }
    return asResult(error);
  }
}

async function searchPlansRun(client: Client, input: SearchPlansInput, signal?: AbortSignal): Promise<Answer> {
  const search = (api: string, query: string) =>
    client.get('/plans', {
      api: api.trim(),
      query: query.trim(),
      sort: input.sort ?? undefined,
      limit: bounded(input.limit, 50),
      offset: input.offset === undefined || input.offset === null || !(input.offset > 0) ? undefined : Math.trunc(input.offset),
    }, signal);
  let api = input.api ?? '';
  let query = input.query ?? '';
  const notes: string[] = [];
  try {
    let answer: Answer;
    try {
      answer = await search(api, query);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 400 && error.message.includes('api must be') && query.trim() === '')) throw error;
      // A provider's name sent as the API: the plans whose provider or plan name holds it.
      [api, query] = ['', api];
      answer = await search(api, query);
      notes.push(`No API is named ${JSON.stringify(input.api)}: these are the plans whose provider or plan name holds it.`);
    }
    if (answer.total === 0 && query.includes('-')) {
      // A slug sent as a name, like bright-data, which no name holds: its words, like bright data. A name with a
      // hyphen, like A-Leads, is found as it is first.
      const words = query.replace(/-/g, ' ').split(/\s+/).filter(Boolean).join(' ');
      try {
        answer = await search(api, words);
        notes.push(`No provider's or plan's name holds ${JSON.stringify(query)}: these are the plans whose name holds ${JSON.stringify(words)}.`);
      } catch {
        // The first answer stands.
      }
    }
    return { ...answer, plans: briefPlans(answer.plans), ...(notes.length > 0 ? { note: notes.join(' ') } : {}) };
  } catch (error) {
    return asResult(error);
  }
}

async function providerRun(client: Client, { slug }: ProviderInput, signal?: AbortSignal): Promise<Answer> {
  const provider = slugify(slug ?? '');
  if (provider === '') return { error: "Give a provider's slug or name, like bright-data or Bright Data" };
  let answer: Answer;
  try {
    answer = await client.get(`/providers/${provider}`, {}, signal);
  } catch (error) {
    // An API's slug sent as a provider's, like email-finder: the API's words, and where an API's best providers are.
    if (error instanceof ApiError && error.status === 404) return { error: `${error.message}. ${FOR_API}` };
    return asResult(error);
  }
  const apis = objects(answer.apis).map((entry) => {
    const plans = objects(entry.plans);
    const kept: Answer = { ...brief(entry, ['api', 'slug', 'rank', 'bestPage']), plans: plans.length };
    const best = bestPlan(plans);
    if (best) kept.best = brief(best, ['plan', 'score', 'perThousand', 'page']);
    return kept;
  });
  // Its best rank first, the APIs where it has none last, in the API's order.
  const rank = (api: Answer) => (typeof api.rank === 'number' ? api.rank : Infinity);
  apis.sort((a, b) => rank(a) - rank(b));
  return { ...answer, apis, total: apis.length, ranked: apis.filter((api) => typeof api.rank === 'number').length };
}

/** A provider's best plan on an API: its lowest rank, the first when none has a rank. */
function bestPlan(plans: Answer[]): Answer | undefined {
  const ranked = plans.filter((plan) => typeof plan.rank === 'number');
  if (ranked.length === 0) return plans[0];
  return ranked.reduce((best, plan) => ((plan.rank as number) < (best.rank as number) ? plan : best));
}
/** The four tools' names, in their order. */
export type ToolName = 'datacircle_list_apis' | 'datacircle_best_plans' | 'datacircle_search_plans' | 'datacircle_provider';

/** The four tools' names, in their order. */
export const TOOL_NAMES: readonly ToolName[] = ['datacircle_list_apis', 'datacircle_best_plans', 'datacircle_search_plans', 'datacircle_provider'];

/** A tool's schema as xmcp reads a tool file's: one zod schema for each key, made by the app's own zod (3.25 or 4). */
export type DatacircleSchema = Record<string, z.ZodType>;

/** A tool's metadata as xmcp reads a tool file's: its name, its description and its annotations. */
export interface DatacircleMetadata {
  name: ToolName;
  description: string;
  annotations: { title: string; readOnlyHint: true; destructiveHint: false; idempotentHint: true; openWorldHint: true };
}

/** What a tool's handler gives xmcp: the JSON the model reads as text, with isError when the call failed. */
export interface DatacircleResult {
  content: { type: 'text'; text: string }[];
  isError?: true;
}

/** A tool's handler as xmcp calls a tool file's default export: the input its schema let through, and xmcp's extra (its signal). */
export type DatacircleHandler = (args: Record<string, unknown>, extra?: unknown) => Promise<DatacircleResult>;

/** One tool as a tool file of xmcp exports it: schema, metadata and default (the handler). */
export interface DatacircleTool {
  schema: DatacircleSchema;
  metadata: DatacircleMetadata;
  default: DatacircleHandler;
}

interface Spec {
  title: string;
  description: string;
  shape: DatacircleSchema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (client: Client, input: any, signal?: AbortSignal) => Promise<Answer>;
}

const SPECS: Record<ToolName, Spec> = {
  datacircle_list_apis: { title: 'List the APIs', description: LIST_APIS_ABOUT, shape: listApisInput, run: listApisRun },
  datacircle_best_plans: { title: 'Who is best for an API', description: BEST_PLANS_ABOUT, shape: bestPlansInput, run: bestPlansRun },
  datacircle_search_plans: { title: 'Search the plans', description: SEARCH_PLANS_ABOUT, shape: searchPlansInput, run: searchPlansRun },
  datacircle_provider: { title: 'One provider on every API', description: PROVIDER_ABOUT, shape: providerInput, run: providerRun },
};

const failed = (text: string): DatacircleResult => ({ content: [{ type: 'text', text }], isError: true });

/**
 * One tool, as a tool file of xmcp exports it: datacircle_list_apis (GET /apis), datacircle_best_plans (GET /apis/{slug}/best),
 * datacircle_search_plans (GET /plans) or datacircle_provider (GET /providers/{slug}). Its handler gives the API's answer as
 * JSON text, or an error result (isError) with what to send instead: an answer of 4xx (the API's words) or a failed network.
 * An input its schema refuses, xmcp answers with why. options sets where it calls (baseURL) and the fetch it calls with.
 */
export function datacircleTool(name: ToolName, options: DatacircleOptions = {}): DatacircleTool {
  const spec = SPECS[name];
  if (spec === undefined) throw new Error(`datacircle: no tool is named ${JSON.stringify(name)}: ${TOOL_NAMES.join(', ')}`);
  const client = new Client(options);
  const handler: DatacircleHandler = async (args, extra) => {
    // xmcp's extra holds the call's signal: it aborts when the client cancels the call.
    const signal = (extra as { signal?: AbortSignal } | undefined)?.signal;
    let answer: Answer;
    try {
      answer = await spec.run(client, args ?? {}, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return failed((error as Error).message);
    }
    if (typeof answer.error === 'string') return failed(answer.error);
    return { content: [{ type: 'text', text: JSON.stringify(answer) }] };
  };
  return {
    schema: { ...spec.shape },
    metadata: {
      name,
      description: spec.description,
      annotations: { title: spec.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    default: handler,
  };
}

// The same calls without a model: each gives the answer the model would read, as an object, an answer of 4xx as {error}.

/** GET /apis: the APIs, as datacircle_list_apis gives them. */
export const listApis = (input: ListApisInput = {}, options?: DatacircleOptions) => listApisRun(new Client(options), input);

/** GET /apis/{slug}/best: an API's plans best first, as datacircle_best_plans gives them. */
export const bestPlans = (input: BestPlansInput, options?: DatacircleOptions) => bestPlansRun(new Client(options), input);

/** GET /plans: the plans found, as datacircle_search_plans gives them. */
export const searchPlans = (input: SearchPlansInput = {}, options?: DatacircleOptions) => searchPlansRun(new Client(options), input);

/** GET /providers/{slug}: where a provider ranks, as datacircle_provider gives it. */
export const providerRanks = (input: ProviderInput, options?: DatacircleOptions) => providerRun(new Client(options), input);
