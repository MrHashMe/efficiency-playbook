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

// 2. Each playbook uses one version throughout; both plugin manifests share one release version.
const v = /\(v(\d+\.\d+)\)/.exec(lines[0])?.[1];
check(v, 'no (vX.Y) in the PLAYBOOK.md title');
for (const s of [`the playbook version (\`v${v}\`)`, `records version \`v${v}\``])
  check(book.includes(s), `PLAYBOOK.md lacks: ${s}`);
for (const s of [`<!-- playbook v${v} -->`, `<!-- end of Part 1, playbook v${v} -->`])
  check(lines.includes(s), `PLAYBOOK.md lacks the line: ${s}`);
const cbook = read('PLAYBOOK-CODEX.md');
const clines = cbook.split('\n');
const cv = /\(v(\d+\.\d+)\)/.exec(clines[0])?.[1];
check(cv, 'no (vX.Y) in the PLAYBOOK-CODEX.md title');
for (const s of [`the playbook version (\`codex-v${cv}\`)`, `records version \`codex-v${cv}\``, `the \`codex playbook v${cv}\` line`])
  check(cbook.includes(s), `PLAYBOOK-CODEX.md lacks: ${s}`);
for (const s of [`<!-- codex playbook v${cv} -->`, `<!-- end of Part 1, codex playbook v${cv} -->`])
  check(clines.includes(s), `PLAYBOOK-CODEX.md lacks the line: ${s}`);
const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
const cplugin = JSON.parse(read('.codex-plugin/plugin.json'));
check(/^\d+\.\d+\.\d+$/.test(plugin.version), `plugin.json version ${plugin.version} isn't X.Y.Z`);
check(cplugin.version === plugin.version && cplugin.name === plugin.name, 'the Claude and Codex plugin.json files must share name and version');
if (process.env.GITHUB_REF_TYPE === 'tag') check(process.env.GITHUB_REF_NAME === `v${plugin.version}`, `tag ${process.env.GITHUB_REF_NAME} isn't v${plugin.version}`);

// 3. Marketplace invariants. Codex reads .agents/plugins/marketplace.json first; its name must never change, or upgrades fail.
const market = JSON.parse(read('.claude-plugin/marketplace.json'));
const entry = market.plugins?.[0];
check(market.plugins?.length === 1, 'marketplace.json must list exactly one plugin');
check(entry?.name === plugin.name && market.name === plugin.name, 'marketplace name, entry name and plugin name must match');
check(entry?.source === './' && !('version' in (entry ?? {})), 'marketplace entry needs source "./" and no version');
check(market.description, 'marketplace.json needs a top-level description');
const cmarket = JSON.parse(read('.agents/plugins/marketplace.json'));
const centry = cmarket.plugins?.[0];
check(cmarket.plugins?.length === 1 && cmarket.name === plugin.name && centry?.name === plugin.name, 'Codex marketplace must list only this plugin, under the same name');
check(centry?.source?.source === 'local' && centry?.source?.path === './', 'Codex marketplace entry needs source {source: "local", path: "./"}');

// 4. Nothing that would load into every session.
for (const p of ['CLAUDE.md', 'AGENTS.md', 'SKILL.md', 'bin', 'hooks', '.mcp.json', '.app.json', 'commands', 'agents'])
  check(!fs.existsSync(path.join(root, p)), `${p} must not exist`);
check(cplugin.skills === './codex-skills/' && !('hooks' in cplugin) && !('mcpServers' in cplugin) && !('apps' in cplugin),
  'Codex plugin.json must point skills at ./codex-skills/ and declare no hooks, MCP servers or apps');
check(/^policy:\n\s+allow_implicit_invocation: false\n?$/.test(read('codex-skills/setup/agents/openai.yaml')), 'the Codex setup skill must be explicit-only');
const ui = cplugin.interface ?? {};
for (const k of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'defaultPrompt'])
  check(ui[k]?.length, `Codex plugin.json interface lacks ${k}`);
check(ui.defaultPrompt?.length <= 3 && ui.defaultPrompt.every((s) => s.length <= 128), 'defaultPrompt: at most 3 entries of at most 128 characters');
for (const p of ['skills/setup/SKILL.md', 'codex-skills/setup/SKILL.md']) {
  const d = /^---\n[\s\S]*?^description: (.+)$/m.exec(read(p))?.[1];
  check(d && d.length <= 1024, `${p} needs a description of at most 1024 characters`);
}

// 5 and 6. No placeholders, personal paths or emails.
const manifests = ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.agents/plugins/marketplace.json'];
for (const p of [...manifests, 'README.md', 'LICENSE'])
  check(!/<owner>|<display name>/.test(read(p)), `${p} has a placeholder`);
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
  e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const p of walk('.')) check(!/[A-Z]:[\\/]+Users[\\/]|(^|[^\w])\/[a-z]\/Users\//im.test(read(p)), `${p} has a personal Windows path`);
for (const p of manifests)
  check(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(read(p)), `${p} has an email address`);

for (const f of fails) console.log(`FAIL: ${f}`);
console.log(fails.length ? `${fails.length} check(s) failed` : 'all checks passed');
process.exit(fails.length ? 1 : 0);
