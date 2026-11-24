// The tool datacircle_search_plans for an xmcp app, GET /plans: every plan, by API, provider or plan name, sorted by score, provider or price.
// A file of the app's tools folder puts it in: export { default, schema, metadata } from '@datacircle/xmcp/search-plans';

import { datacircleTool } from './tools.js';

const tool = datacircleTool('datacircle_search_plans');

export const schema = tool.schema;
export const metadata = tool.metadata;
export default tool.default;
