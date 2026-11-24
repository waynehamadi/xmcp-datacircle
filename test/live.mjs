// The package on the live API without xmcp: each subpath module as xmcp reads a tool file (from import and from require), each
// handler called with the input its schema lets through, the calls of the main entry, a cancel and the API down. Run from the
// package's folder after npm run build: node test/live.mjs
import { createRequire } from 'node:module';
import { z } from 'zod';
import { TOOL_NAMES, bestPlans, datacircleTool, listApis, providerRanks, searchPlans } from '@datacircle/xmcp';

const require = createRequire(import.meta.url);
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + String(detail).slice(0, 160) : ''}`);
  if (!ok) failed++;
};
const answer = (result) => JSON.parse(result.content[0].text);

const modules = { 'list-apis': 'datacircle_list_apis', 'best-plans': 'datacircle_best_plans', 'search-plans': 'datacircle_search_plans', provider: 'datacircle_provider' };
for (const [path, name] of Object.entries(modules)) {
  const esm = await import(`@datacircle/xmcp/${path}`);
  const cjs = require(`@datacircle/xmcp/${path}`);
  for (const [kind, mod] of [['import', esm], ['require', cjs]]) {
    check(`${path} (${kind}): schema, metadata and default as xmcp reads them`, typeof mod.default === 'function' && mod.metadata.name === name
      && Object.values(mod.schema).every((field) => typeof field.parse === 'function' && typeof field['~standard']?.validate === 'function'), Object.keys(mod.schema).join(','));
  }
}
check('TOOL_NAMES', JSON.stringify(TOOL_NAMES) === JSON.stringify(Object.values(modules)));

// Each handler with what its schema let through, as xmcp calls it.
const run = async (path, input) => {
  const mod = await import(`@datacircle/xmcp/${path}`);
  return mod.default(z.object(mod.schema).parse(input), { signal: new AbortController().signal });
};
let r = await run('list-apis', { query: 'email', limit: '3' });
check('list-apis email, limit "3"', !r.isError && answer(r).apis.length === 3, r.content[0].text);
r = await run('best-plans', { slug: 'email-finder', limit: null });
check('best-plans email-finder, limit null', !r.isError && answer(r).plans.length === 10 && answer(r).plans[0].rank === 1);
r = await run('search-plans', { query: 'bright data', sort: 'price', limit: 3 });
check('search-plans bright data by price', !r.isError && answer(r).plans.length === 3);
r = await run('provider', { slug: 'Bright Data' });
check('provider Bright Data', !r.isError && answer(r).total > 0);
r = await run('best-plans', { slug: 'bright-data' });
check('best-plans bright-data: an error result', r.isError === true && r.content[0].text.includes('datacircle_search_plans'), r.content[0].text);
check('search-plans sort cheapest: refused by its schema', z.object((await import('@datacircle/xmcp/search-plans')).schema).safeParse({ sort: 'cheapest' }).success === false);

// The main entry's calls.
check('listApis()', (await listApis()).total > 100);
check('bestPlans()', (await bestPlans({ slug: 'serp', limit: 2 })).plans.length === 2);
check('searchPlans()', (await searchPlans({ api: 'email-finder', limit: 2 })).plans.length === 2);
check('providerRanks()', (await providerRanks({ slug: 'bright-data' })).ranked > 0);

// A cancel stops the call's GET, and the API down is an error result.
const controller = new AbortController();
let aborted = false;
const slow = datacircleTool('datacircle_list_apis', {
  fetch: (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(init.signal.reason); })),
});
const pending = slow.default({}, { signal: controller.signal });
setTimeout(() => controller.abort(new Error('cancelled')), 100);
check('a cancel stops the GET and throws', await pending.then(() => false, (error) => error.message === 'cancelled') && aborted);
r = await datacircleTool('datacircle_provider', { baseURL: 'http://127.0.0.1:9' }).default({ slug: 'bright-data' });
check('the API down: an error result', r.isError === true && r.content[0].text.startsWith('datacircle:'), r.content[0].text);
let threw = false;
try { datacircleTool('nope'); } catch { threw = true; }
check('an unknown tool name throws', threw);

console.log(failed === 0 ? 'ALL OK' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
