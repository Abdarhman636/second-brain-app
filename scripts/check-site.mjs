/*
 * Checks the live site after a deploy: the page loads, and every file it
 * asks for (scripts, styles, icons) is really there with the right type.
 * A missing stylesheet otherwise shows up only as an unstyled site.
 *
 *   npm run check-site                      (https://rsookh.com)
 *   npm run check-site -- https://other.example
 *
 * Exits with 1 when something is wrong, so it can gate a deploy.
 */
const site = (process.argv[2] ?? 'https://rsookh.com').replace(/\/+$/, '');

const EXPECTED_TYPES = {
  '.js': /javascript/,
  '.css': /text\/css/,
  '.svg': /image\/svg/,
  '.png': /image\/png/,
  '.webmanifest': /manifest|json/,
};

const problems = [];

async function check(path, expected) {
  const url = new URL(path, `${site}/`).href;
  const response = await fetch(url, { cache: 'no-store' });
  const type = response.headers.get('content-type') ?? '';
  const ok = response.ok && (!expected || expected.test(type));
  console.log(`${ok ? '✓' : '✗'} ${response.status} ${type.padEnd(28)} ${path}`);
  if (!ok) problems.push(`${path}: ${response.status} ${type}`);
  return response;
}

const page = await check('/', /text\/html/);
const html = await page.text();
const files = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1]);
if (!files.some((file) => file.endsWith('.css'))) problems.push('the page links no stylesheet');
if (!files.some((file) => file.endsWith('.js'))) problems.push('the page links no script');

for (const file of new Set(files)) {
  const extension = Object.keys(EXPECTED_TYPES).find((ext) => file.split('?')[0].endsWith(ext));
  await check(file, extension ? EXPECTED_TYPES[extension] : undefined);
}

// An app page opened directly (not a file) must still load the app.
await check('/projects', /text\/html/);

if (problems.length) {
  console.error(`\n${site} has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\n${site} looks good.`);
