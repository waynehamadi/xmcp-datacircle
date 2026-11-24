// The tool datacircle_provider for an xmcp app, GET /providers/{slug}: the APIs a provider sells and its rank on each.
// A file of the app's tools folder puts it in: export { default, schema, metadata } from '@datacircle/xmcp/provider';

import { datacircleTool } from './tools.js';

const tool = datacircleTool('datacircle_provider');

export const schema = tool.schema;
export const metadata = tool.metadata;
export default tool.default;
