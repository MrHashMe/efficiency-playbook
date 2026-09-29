// Release checks for this repo. Node 18+, no dependencies. Prints one FAIL line per problem and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const book = read('PLAYBOOK.md');
const lines = book.split('\n');

// 1. The bundled runner is byte-identical to the playbook's js block.
const at = lines.findIndex((l) => l.startsWith('The runner, `~/.claude/skills/paired-check/run.mjs`, with exactly this content:'));
const open = lines.indexOf('```js', at);
const close = lines.indexOf('```', open + 1);
check(at >= 0 && open > at && close > open, 'runner block not found in PLAYBOOK.md');
if (close > open) check(lines.slice(open + 1, close).join('\n') + '\n' === read('skills/setup/run.mjs'), 'skills/setup/run.mjs differs from the runner block in PLAYBOOK.md');

// 2. One version everywhere.
const v = /\(v(\d+\.\d+)\)/.exec(lines[0])?.[1];
check(v, 'no (vX.Y) in the PLAYBOOK.md title');
for (const s of [`the playbook version (\`v${v}\`)`, `records version \`v${v}\``])
  check(book.includes(s), `PLAYBOOK.md lacks: ${s}`);
for (const s of [`<!-- playbook v${v} -->`, `<!-- end of Part 1, playbook v${v} -->`])
  check(lines.includes(s), `PLAYBOOK.md lacks the line: ${s}`);
const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
check(new RegExp(`^${v?.replace('.', '\\.')}\\.\\d+$`).test(plugin.version), `plugin.json version ${plugin.version} doesn't match playbook v${v}`);
if (process.env.GITHUB_REF_TYPE === 'tag') check(process.env.GITHUB_REF_NAME === `v${plugin.version}`, `tag ${process.env.GITHUB_REF_NAME} isn't v${plugin.version}`);

// 3. Marketplace invariants.
const market = JSON.parse(read('.claude-plugin/marketplace.json'));
const entry = market.plugins?.[0];
check(market.plugins?.length === 1, 'marketplace.json must list exactly one plugin');
check(entry?.name === plugin.name && market.name === plugin.name, 'marketplace name, entry name and plugin name must match');
check(entry?.source === './' && !('version' in (entry ?? {})), 'marketplace entry needs source "./" and no version');
check(market.description, 'marketplace.json needs a top-level description');

// 4. Nothing that would load into every session.
for (const p of ['CLAUDE.md', 'SKILL.md', 'bin', 'hooks', '.mcp.json', 'commands', 'agents'])
  check(!fs.existsSync(path.join(root, p)), `${p} must not exist`);

// 5 and 6. No placeholders, personal paths or emails.
for (const p of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'README.md', 'LICENSE'])
  check(!/<owner>|<display name>/.test(read(p)), `${p} has a placeholder`);
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
  e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const p of walk('.')) check(!/[A-Z]:[\\/]+Users[\\/]|(^|[^\w])\/[a-z]\/Users\//im.test(read(p)), `${p} has a personal Windows path`);
for (const p of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json'])
  check(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(read(p)), `${p} has an email address`);

for (const f of fails) console.log(`FAIL: ${f}`);
console.log(fails.length ? `${fails.length} check(s) failed` : 'all checks passed');
process.exit(fails.length ? 1 : 0);
