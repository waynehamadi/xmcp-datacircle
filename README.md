# Datacircle tools for xmcp

Find the best GTM APIs. We benchmark all the GTM APIs and we put the results on our website. GTM means go-to-market. GTM APIs are the APIs sales and marketing teams use.

Our website: https://datacircle.dev

This package gives four tools for an [xmcp](https://github.com/basementstudio/xmcp) app. The tools call Datacircle's open API, https://api.datacircle.dev/v1. You need no key and no account.

| Tool | What the tool gives | Call |
| --- | --- | --- |
| `datacircle_list_apis` | Every GTM API on Datacircle, with the API's slug, number of plans, number of providers and best plan | `GET /apis` |
| `datacircle_best_plans` | One API's plans, best score out of 100 first. Each plan comes with a rank and a price per 1,000 calls | `GET /apis/{slug}/best` |
| `datacircle_search_plans` | Plans that match a provider or plan name, on all APIs or on one API. You can sort them by score, provider or price | `GET /plans` |
| `datacircle_provider` | The APIs a provider sells, and the provider's rank on each API | `GET /providers/{slug}` |

## Add the tools to your app

```bash
npm install @datacircle/xmcp
```

xmcp makes one tool of each file in your tools folder. Add one file for each of our tools, with one line in each file:

```ts
// src/tools/datacircle_list_apis.ts
export { default, schema, metadata } from "@datacircle/xmcp/list-apis";
```

```ts
// src/tools/datacircle_best_plans.ts
export { default, schema, metadata } from "@datacircle/xmcp/best-plans";
```

```ts
// src/tools/datacircle_search_plans.ts
export { default, schema, metadata } from "@datacircle/xmcp/search-plans";
```

```ts
// src/tools/datacircle_provider.ts
export { default, schema, metadata } from "@datacircle/xmcp/provider";
```

Then run `xmcp build` or `xmcp dev` as usual. Your app serves our tools along with your own, over stdio and over HTTP. The tools work on xmcp 0.2.1 and later. Your app can use zod 3.25 or zod 4.

## Set your own fetch and base URL

`datacircleTool(name, options)` makes one tool with your own `fetch` and `baseURL`. Pass your own `fetch` to call through a proxy or in tests. Export the tool's `schema`, `metadata` and `default` from a file in your tools folder:

```ts
// src/tools/datacircle_best_plans.ts
import { datacircleTool } from "@datacircle/xmcp";

const tool = datacircleTool("datacircle_best_plans", { fetch: myFetch });

export const schema = tool.schema;
export const metadata = tool.metadata;
export default tool.default;
```

## Make each call yourself

You can make each call without xmcp. Each call returns the answer as an object:

```ts
import { bestPlans } from "@datacircle/xmcp";

const answer = await bestPlans({ slug: "email-finder", limit: 3 });
console.log(answer.plans);
```

The other calls are `listApis()`, `searchPlans()` and `providerRanks()`.

## What the model reads

Each tool gives the model a JSON object as text. Each plan comes with a rank, provider, plan, score, price per 1,000 (`perThousand`, in dollars) and a page on datacircle.dev. The page on datacircle.dev lists every field.

For an unknown slug, the tool returns an error result (`isError`) with the API's message and the tool to call instead. If an input does not fit the tool's schema, xmcp returns an error that names each wrong argument. If the network fails, the model gets an error result with the network error's message. After an error, the model can call the tool again and keep working. Over stdio, the tool stops the request when the client cancels the call.

## Network

Each tool call makes one HTTPS GET request to https://api.datacircle.dev/v1 and nothing else. The request holds only the tool's own arguments: no key and nothing from your chats. The API takes up to 60 calls a minute from one IP address. After a 429 answer (too many calls), the tool waits up to a minute and tries once more. The package stores nothing. The tools use your app's zod. They need no other package.

## Links

- Datacircle: https://datacircle.dev
- The API: https://datacircle.dev/api
- The API's spec: https://api.datacircle.dev/v1/openapi.json
- What each key means: https://datacircle.dev/fields

MIT license.
