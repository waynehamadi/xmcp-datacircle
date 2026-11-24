// Tools on Datacircle's open API for an xmcp app (xmcp on npm): find the best GTM APIs. The API needs no key:
// https://api.datacircle.dev/v1 (its spec: https://api.datacircle.dev/v1/openapi.json). More at https://datacircle.dev
//
// Each tool is a module of its own, as xmcp reads a tool file: '@datacircle/xmcp/list-apis', '/best-plans', '/search-plans'
// and '/provider'. datacircleTool makes one with options of the app's.

export { ApiError, BASE_URL, VERSION } from './client.js';
export type { Answer, DatacircleOptions } from './client.js';
export { TOOL_NAMES, bestPlans, datacircleTool, listApis, providerRanks, searchPlans } from './tools.js';
export type {
  BestPlansInput,
  DatacircleHandler,
  DatacircleMetadata,
  DatacircleResult,
  DatacircleSchema,
  DatacircleTool,
  ListApisInput,
  ProviderInput,
  SearchPlansInput,
  ToolName,
} from './tools.js';
