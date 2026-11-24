// The tool datacircle_list_apis for an xmcp app, GET /apis: every API on Datacircle's sheet, with its slug and its best plan.
// A file of the app's tools folder puts it in: export { default, schema, metadata } from '@datacircle/xmcp/list-apis';

import { datacircleTool } from './tools.js';

const tool = datacircleTool('datacircle_list_apis');

export const schema = tool.schema;
export const metadata = tool.metadata;
export default tool.default;
