// The tool datacircle_best_plans for an xmcp app, GET /apis/{slug}/best: an API's plans, best score first.
// A file of the app's tools folder puts it in: export { default, schema, metadata } from '@datacircle/xmcp/best-plans';

import { datacircleTool } from './tools.js';

const tool = datacircleTool('datacircle_best_plans');

export const schema = tool.schema;
export const metadata = tool.metadata;
export default tool.default;
