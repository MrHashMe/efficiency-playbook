// paired-check runner, playbook v7. Node 18+, no dependencies.
// Commands: where | validate <tasks.json> [task id] | run <batch.json> | report <data folder> [baseline arm] | selftest
// Only `run` starts `claude`, and it refuses to inside a Claude Code session. The runner itself makes no network calls.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const WIN = process.platform === 'win32';
const CONFIG = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const FLAGS = ['--print', '--output-format', '--max-turns', '--max-budget-usd', '--permission-mode', '--allowedTools', '--no-session-persistence', '--model'];
const CONFIG_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.mcp.json', '.claude/CLAUDE.md', '.claude/settings.json',
  '.claude/settings.local.json', '.claude/rules', '.claude/skills', '.claude/agents', '.claude/commands', '.claude/hooks'];

class Fatal extends Error {}
const sha = (d) => createHash('sha256').update(d).digest('hex');
const tail = (s, n = 600) => String(s || '').trim().slice(-n);
const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (dflt !== undefined) return dflt; throw new Fatal(`can't read ${p}: ${e.message}`); } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
function git(cwd, ...args) {
  const r = sh('git', ['-c', 'core.quotepath=off', ...args], { cwd });
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${tail(r.err, 300)}`);
  return r.out.trim();
}
const gitOk = (cwd, ...args) => sh('git', args, { cwd }).code === 0;
const lines = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

function killTree(pid) {
  try { if (WIN) spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }); else process.kill(-pid, 'SIGKILL'); } catch {}
}
function runProc(cmd, args, { cwd, input = '', env = process.env, shell = false, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell, windowsHide: true, detached: !WIN });
    const out = [], err = [];
    let killed = false;
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    const timer = timeoutMs ? setTimeout(() => { killed = true; killTree(child.pid); }, timeoutMs) : null;
    const done = (code, extra = '') => { if (timer) clearTimeout(timer);
      resolve({ code, killed, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8') + extra }); };
    child.on('error', (e) => done(-1, String(e)));
    child.on('close', (code) => { if (!WIN) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } done(code); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Commands from the project's command map are written for Claude Code's Bash tool, so on Windows run them with Git Bash.
function gitBash() {
  if (!WIN) return null;
  const env = process.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (env && fs.existsSync(env)) return env;
  for (const p of lines(sh('where.exe', ['git']).out))
    for (const up of ['..', path.join('..', '..')]) { const c = path.resolve(path.dirname(p), up, 'bin', 'bash.exe'); if (fs.existsSync(c)) return c; }
  return null;
}
const shellCmd = (ctx, command, cwd, timeoutMs) => ctx.bash
  ? runProc(ctx.bash, ['-c', command], { cwd, timeoutMs })
  : runProc(command, [], { cwd, timeoutMs, shell: true });

function claudeCommand() {
  const stub = process.env.PAIRED_CHECK_STUB; // selftest only: a .mjs file that imitates claude
  if (stub) return { cmd: process.execPath, pre: [stub], stub: true };
  if (!WIN) return { cmd: 'claude', pre: [] };
  const found = lines(sh('where.exe', ['claude']).out);
  const exe = found.find((p) => /\.exe$/i.test(p));
  if (exe) return { cmd: exe, pre: [] };
  const shim = found.find((p) => /\.(cmd|bat)$/i.test(p));
  if (shim) return { cmd: shim, pre: [], viaCmd: true };
  throw new Fatal('claude is not on PATH in this terminal. Install the Claude Code CLI, open a new terminal, and run the same line again.');
}
function launchClaude(cl, args, opts) {
  if (!cl.viaCmd) return runProc(cl.cmd, [...cl.pre, ...args], opts);
  // A .cmd shim can only start through cmd.exe, so the prompt goes on stdin and the fixed arguments are quoted here.
  for (const a of args) if (/["%\r\n]/.test(a)) throw new Error(`can't pass this argument through cmd.exe safely: ${a}`);
  return runProc([cl.cmd, ...args].map((a) => `"${a}"`).join(' '), [], { ...opts, shell: true });
}
const claudeArgs = (b, turns, budget, allowed) => ['-p', '--output-format', 'json', '--no-session-persistence', '--model', b.model,
  '--max-turns', String(turns), '--max-budget-usd', String(budget), '--permission-mode', 'acceptEdits', '--allowedTools', ...allowed];
const childEnv = (b) => ({ ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', ...(b.effort ? { CLAUDE_CODE_EFFORT_LEVEL: b.effort } : {}) });
function parseResult(out) {
  const pick = (j) => (Array.isArray(j) ? [...j].reverse().find((m) => m && m.type === 'result') || null : j && typeof j === 'object' ? j : null);
  const t = out.trim();
  if (!t) return null;
  try { return pick(JSON.parse(t)); } catch {}
  for (const l of t.split(/\r?\n/).reverse()) { try { const j = pick(JSON.parse(l)); if (j) return j; } catch {} }
  return null;
}

function hashInto(h, p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) { for (const n of fs.readdirSync(p).sort()) { h.update(n); hashInto(h, path.join(p, n)); } }
  else h.update(fs.readFileSync(p));
}
const hashPath = (p) => { if (!fs.existsSync(p)) return null; const h = createHash('sha256'); hashInto(h, p); return h.digest('hex').slice(0, 12); };

function context(tasksPath) {
  tasksPath = path.resolve(tasksPath);
  const set = readJson(tasksPath);
  const src = set.source;
  if (!src || !fs.existsSync(src)) throw new Fatal(`the task set's source folder is missing: ${src}`);
  if (!Array.isArray(set.tasks) || !set.tasks.length) throw new Fatal('the task set has no tasks');
  const tasks = set.tasks.map((t) => {
    if (!/^[A-Za-z0-9-]{1,24}$/.test(t.id || '')) throw new Fatal(`bad task id: ${t.id}`);
    for (const k of ['prompt', 'base', 'reference', 'acceptance', 'maxTurns', 'budgetUsd']) if (!t[k]) throw new Fatal(`task ${t.id} has no ${k}`);
    if (!Array.isArray(t.acceptanceFiles) || !t.acceptanceFiles.length) throw new Fatal(`task ${t.id} has no acceptanceFiles`);
    return { ...t, base: git(src, 'rev-parse', `${t.base}^{commit}`), reference: git(src, 'rev-parse', `${t.reference}^{commit}`) };
  });
  const work = path.join(os.tmpdir(), 'pc', sha(tasksPath).slice(0, 8));
  const noHooks = path.join(work, 'no-hooks');
  fs.mkdirSync(noHooks, { recursive: true });
  return { set, tasks, src, cd: path.resolve(src, git(src, 'rev-parse', '--git-common-dir')), work, noHooks,
    dataDir: path.dirname(tasksPath), bash: gitBash(),
    prepMs: (set.prepareTimeoutMin || 20) * 60000, acceptMs: (set.acceptanceTimeoutMin || 15) * 60000 };
}

// A clone is history-free when HEAD is the base, nothing else is reachable, and the reference commit doesn't exist in it.
function historyFree(dir, t, refs) {
  return git(dir, 'rev-parse', 'HEAD') === t.base && !git(dir, 'remote')
    && !gitOk(dir, 'cat-file', '-e', `${t.reference}^{commit}`)
    && git(dir, 'rev-list', '--all', '--count') === git(dir, 'rev-list', 'HEAD', '--count')
    && lines(git(dir, 'for-each-ref', '--format=%(refname)')).join() === refs.join();
}
function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); return null; } catch { return dir; }
}
function baseRepo(ctx, t) {
  const dir = path.join(ctx.work, `b-${t.id}`);
  if (fs.existsSync(dir)) { try { if (historyFree(dir, t, ['refs/heads/pc-base'])) return dir; } catch {} rmDir(dir); }
  git(ctx.work, 'clone', '--quiet', '--no-checkout', '--no-local', '--no-tags', ctx.cd, dir);
  git(dir, 'remote', 'remove', 'origin');
  git(dir, 'update-ref', 'refs/heads/pc-base', t.base);
  git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/pc-base');
  for (const r of lines(git(dir, 'for-each-ref', '--format=%(refname)'))) if (r !== 'refs/heads/pc-base') git(dir, 'update-ref', '-d', r);
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  git(dir, 'gc', '--quiet', '--prune=now');
  if (!historyFree(dir, t, ['refs/heads/pc-base'])) throw new Error(`couldn't build a history-free base for ${t.id}`);
  return dir;
}
function runClone(ctx, t, name) {
  const dir = path.join(ctx.work, name);
  rmDir(dir);
  git(ctx.work, 'clone', '--quiet', '--no-tags', baseRepo(ctx, t), dir);
  git(dir, 'checkout', '--quiet', '--detach');
  git(dir, 'branch', '--quiet', '-D', 'pc-base');
  git(dir, 'remote', 'remove', 'origin');
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  if (!historyFree(dir, t, [])) throw new Error(`the clone for ${t.id} isn't history-free`);
  return dir;
}
// Copy today's instructions and project settings into the clone, run prepare, and commit, so the run starts from a clean tree.
async function prepareClone(ctx, dir) {
  const nested = lines(sh('git', ['-c', 'core.quotepath=off', 'ls-files', '-co', '--exclude-standard'], { cwd: ctx.src }).out)
    .filter((f) => /(^|\/)(CLAUDE|AGENTS)\.md$/.test(f) && !f.startsWith('.claude/worktrees/'));
  const h = createHash('sha256');
  for (const rel of [...new Set([...CONFIG_FILES, ...nested])]) {
    const from = path.join(ctx.src, rel), to = path.join(dir, rel);
    rmDir(to);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    h.update(rel); hashInto(h, from);
  }
  if (ctx.set.prepare) {
    const p = await shellCmd(ctx, ctx.set.prepare, dir, ctx.prepMs);
    if (p.code !== 0) throw new Error(`prepare failed: ${tail(p.out + p.err)}`);
  }
  git(dir, 'add', '-A');
  if (sh('git', ['diff', '--cached', '--quiet'], { cwd: dir }).code !== 0)
    git(dir, '-c', `core.hooksPath=${ctx.noHooks}`, '-c', 'user.name=paired-check', '-c', 'user.email=paired-check@localhost',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--no-verify', '-m', 'Local Claude Code configuration');
  git(dir, 'reflog', 'expire', '--expire=now', '--all');
  return { projectConfig: h.digest('hex').slice(0, 12), start: git(dir, 'rev-parse', 'HEAD') };
}
function writeBlob(ctx, rev, rel, dir) {
  const r = spawnSync('git', ['cat-file', '--filters', `${rev}:${rel}`], { cwd: ctx.src, maxBuffer: 1 << 28, windowsHide: true });
  if (r.status !== 0) throw new Error(`can't read ${rel} at ${rev.slice(0, 10)}`);
  const to = path.join(dir, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, r.stdout);
}
const writeAcceptance = (ctx, t, dir) => t.acceptanceFiles.forEach((rel) => writeBlob(ctx, t.reference, rel, dir));
function changes(dir, start) {
  git(dir, 'add', '-A');
  const tree = git(dir, 'write-tree');
  let added = 0, removed = 0;
  const files = [];
  for (const l of lines(git(dir, 'diff', '--numstat', '--no-renames', start, tree))) {
    const [a, r, f] = l.split('\t');
    if (a !== '-') { added += Number(a); removed += Number(r); }
    files.push(f);
  }
  return { added, removed, files };
}

async function validate(tasksPath, only) {
  const ctx = context(tasksPath);
  const chosen = only ? ctx.tasks.filter((t) => t.id === only) : ctx.tasks;
  if (!chosen.length) throw new Fatal(`no task with id ${only}`);
  const results = [];
  for (const t of chosen) {
    const res = { task: t.id, historyFree: false, failsAtBase: false, passesAtReference: false, note: '' };
    let dir;
    try {
      dir = runClone(ctx, t, `v-${t.id}`);
      res.historyFree = true;
      await prepareClone(ctx, dir);
      writeAcceptance(ctx, t, dir);
      res.failsAtBase = (await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs)).code !== 0;
      const z = sh('git', ['-c', 'core.quotepath=off', 'diff', '--name-status', '--no-renames', '-z', t.base, t.reference], { cwd: ctx.src }).out.split('\0').filter(Boolean);
      for (let i = 0; i + 1 < z.length; i += 2) {
        if (z[i] === 'D') fs.rmSync(path.join(dir, z[i + 1]), { force: true });
        else writeBlob(ctx, t.reference, z[i + 1], dir);
      }
      if (ctx.set.prepare) await shellCmd(ctx, ctx.set.prepare, dir, ctx.prepMs);
      const a = await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs);
      res.passesAtReference = a.code === 0;
      if (!res.failsAtBase) res.note = 'the acceptance command already passes at the base, so it can\'t tell a solved task from an unsolved one';
      else if (!res.passesAtReference) res.note = `fails at the reference: ${tail(a.out + a.err, 300)}`;
    } catch (e) { res.note = String(e.message || e); }
    if (dir) rmDir(dir);
    res.ok = res.historyFree && res.failsAtBase && res.passesAtReference;
    results.push(res);
    console.log(`${res.ok ? 'OK  ' : 'DROP'} ${t.id}${res.note ? ` - ${res.note}` : ''}`);
  }
  for (const t of chosen) rmDir(path.join(ctx.work, `b-${t.id}`));
  const file = path.join(ctx.dataDir, 'validation.json'), prev = readJson(file, null);
  const merged = new Map((prev && prev.set === ctx.set.id ? prev.results : []).map((r) => [r.task, r]));
  for (const r of results) merged.set(r.task, r);
  writeJson(file, { set: ctx.set.id, at: new Date().toISOString(), results: [...merged.values()] });
  return results;
}

function fingerprint(b, version) {
  const s = readJson(path.join(CONFIG, 'settings.json'), {});
  return { claude: version, model: b.model, effort: b.effort || null, runner: hashPath(SELF),
    git: sh('git', ['--version']).out.trim(), node: process.version, os: `${process.platform} ${os.release()}`,
    userSettings: hashPath(path.join(CONFIG, 'settings.json')), userClaudeMd: hashPath(path.join(CONFIG, 'CLAUDE.md')),
    userRules: hashPath(path.join(CONFIG, 'rules')), userSkills: hashPath(path.join(CONFIG, 'skills')), userAgents: hashPath(path.join(CONFIG, 'agents')), userOutputStyles: hashPath(path.join(CONFIG, 'output-styles')), userCommands: hashPath(path.join(CONFIG, 'commands')), installedPlugins: hashPath(path.join(CONFIG, 'plugins', 'installed_plugins.json')),
    enabledPlugins: Object.entries(s.enabledPlugins || {}).filter(([, v]) => v).map(([k]) => k).sort(),
    autoCompactWindow: s.autoCompactWindow ?? null, advisorModel: s.advisorModel ?? null };
}
const readResults = (dir) => { const p = path.join(dir, 'results.jsonl');
  return fs.existsSync(p) ? lines(fs.readFileSync(p, 'utf8')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []; };

async function run(batchPath) {
  const b = readJson(path.resolve(batchPath));
  for (const k of ['id', 'tasks', 'arm', 'repeats', 'model']) if (!b[k]) throw new Fatal(`the batch file has no ${k}`);
  const cl = claudeCommand();
  if (!cl.stub && process.env.CLAUDECODE)
    throw new Fatal('this terminal was started by Claude Code or an IDE (CLAUDECODE is set), so the runs would inherit its variables and differ from a normal session. Open PowerShell from the Start menu and paste the same line there. Don\'t unset the variable.');
  for (const [k, ok] of [['ANTHROPIC_API_KEY', b.allowApiKey], ['ANTHROPIC_AUTH_TOKEN', b.allowApiKey], ['ANTHROPIC_BASE_URL', b.allowBaseUrl]])
    if (process.env[k] && !ok) throw new Fatal(`${k} is set in this terminal, so the runs would use it instead of your plan. Unset it in this window, or tell /paired-check that you want it used.`);
  const ctx = context(b.tasks);
  let version = 'stub';
  if (!cl.stub) {
    const v = await launchClaude(cl, ['--version'], { cwd: ctx.work, timeoutMs: 60000 });
    if (v.code !== 0) throw new Fatal(`claude --version failed: ${tail(v.err || v.out)}`);
    version = v.out.trim();
    const smoke = await launchClaude(cl, claudeArgs(b, 1, 1, ctx.set.allowedTools || ['Read']),
      { cwd: ctx.work, input: 'Reply with the single word OK.', env: childEnv(b), timeoutMs: 180000 });
    const j = parseResult(smoke.out);
    if (!j || j.is_error) {
      const help = await launchClaude(cl, ['--help'], { cwd: ctx.work, timeoutMs: 60000 });
      const missing = FLAGS.filter((f) => !help.out.includes(f));
      throw new Fatal(`the one-turn test run failed, so nothing was started: ${tail(smoke.err || smoke.out)}`
        + (missing.length ? `\n--help doesn't mention ${missing.join(', ')}, so this claude may be too old.` : ''));
    }
  }
  const fp = fingerprint(b, version);
  const done = new Set(readResults(ctx.dataDir).filter((r) => r.batch === b.id && r.status !== 'setup-failure').map((r) => `${r.task}#${r.repeat}`));
  let setupFails = 0;
  for (let rep = 1; rep <= b.repeats; rep++) for (const t of ctx.tasks) { // round-robin, so a stopped batch stays balanced
    if (done.has(`${t.id}#${rep}`)) continue;
    const rec = { batch: b.id, set: ctx.set.id, arm: b.arm, task: t.id, repeat: rep, at: new Date().toISOString() };
    let dir;
    try {
      dir = runClone(ctx, t, `r-${t.id}-${rep}`);
      const { projectConfig, start } = await prepareClone(ctx, dir);
      rec.fingerprint = { ...fp, projectConfig };
      console.log(`[${b.arm}] ${t.id} #${rep}: running`);
      const t0 = Date.now();
      const r = await launchClaude(cl, claudeArgs(b, t.maxTurns, t.budgetUsd, t.allowedTools || ctx.set.allowedTools || ['Read']),
        { cwd: dir, input: t.prompt, env: childEnv(b), timeoutMs: (t.timeoutMin || 30) * 60000 });
      rec.wallMs = Date.now() - t0;
      const j = parseResult(r.out);
      if (!j && !r.killed) throw new Error(`claude returned no result: ${tail(r.err || r.out)}`);
      const limitHit = !!j && /^error_max/.test(String(j.subtype || ''));
      if (j && j.is_error && !limitHit && /limit|overloaded|log ?in|authenticat|unauthori[sz]ed|credit|api key|billing/i.test(String(j.result || '')))
        throw new Error(`claude stopped: ${tail(j.result, 300)}`);
      Object.assign(rec, { killed: r.killed, limitHit }, j ? { subtype: j.subtype, isError: !!j.is_error, turns: j.num_turns, durationMs: j.duration_ms,
        costUsd: j.total_cost_usd, usage: j.usage, models: Object.keys(j.modelUsage || {}), permissionDenials: (j.permission_denials || []).length } : {});
      // `usage` counts only the main loop; `modelUsage` also counts subagents and compaction, so tokens come from it when it has them.
      const mu = Object.values((j && j.modelUsage) || {}).filter((m) => m && m.inputTokens != null), add = (k) => mu.reduce((s, m) => s + (m[k] || 0), 0);
      if (mu.length) rec.usage = { input_tokens: add('inputTokens'), output_tokens: add('outputTokens'),
        cache_creation_input_tokens: add('cacheCreationInputTokens'), cache_read_input_tokens: add('cacheReadInputTokens') };
      const ch = changes(dir, start);
      Object.assign(rec, { added: ch.added, removed: ch.removed, filesChanged: ch.files.length, acceptanceEdited: t.acceptanceFiles.filter((f) => ch.files.includes(f)) });
      writeAcceptance(ctx, t, dir); // grading uses the reference tests, whatever the run did to them
      rec.status = (await shellCmd(ctx, t.acceptance, dir, ctx.acceptMs)).code === 0 ? 'pass' : 'fail';
      setupFails = 0;
    } catch (e) { rec.status = 'setup-failure'; rec.reason = tail(e.message || e, 500); setupFails++; }
    if (dir && !b.keep) { const left = rmDir(dir); if (left) { rec.leftover = left; console.log(`  couldn't remove ${left} (a locked file?); delete it later`); } }
    fs.appendFileSync(path.join(ctx.dataDir, 'results.jsonl'), JSON.stringify(rec) + '\n');
    console.log(`  ${rec.status}${rec.reason ? `: ${rec.reason}` : ''}${rec.usage ? ` (${fmt(tokens(rec.usage))} tokens, $${fmt(rec.costUsd, 2)})` : ''}`);
    if (setupFails >= 2) { for (const x of ctx.tasks) rmDir(path.join(ctx.work, `b-${x.id}`));
      throw new Fatal('two setup failures in a row, so the batch stopped. Fix the cause, then paste the same line to resume.'); }
  }
  for (const t of ctx.tasks) rmDir(path.join(ctx.work, `b-${t.id}`));
  console.log('Batch complete. Go back to Claude Code and type /paired-check to see the report.');
}

const tokens = (u) => (u ? (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : null);
const fmt = (x, d = 0) => (x == null ? 'n/a' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (a, b) => { if (a == null || b == null || b === 0) return 'n/a'; const v = Math.round(((a - b) / b) * 100) || 0; return `${v > 0 ? '+' : ''}${v}%`; };
function report(dataDir, baselineArm) {
  const all = readResults(dataDir);
  const graded = all.filter((r) => r.status === 'pass' || r.status === 'fail');
  const arms = new Map();
  for (const r of graded) { const k = `${r.set}\u0000${r.arm}`; if (!arms.has(k)) arms.set(k, []); arms.get(k).push(r); }
  const stats = [...arms.values()].map((rs) => {
    const known = rs.filter((r) => r.usage), pass = rs.filter((r) => r.status === 'pass').length;
    const T = known.reduce((s, r) => s + tokens(r.usage), 0), C = known.reduce((s, r) => s + (r.costUsd || 0), 0);
    const notes = [];
    const unknown = rs.length - known.length; if (unknown) notes.push(`${unknown} run(s) hit the time limit, so their tokens are missing and the totals are low`);
    const limits = rs.filter((r) => r.limitHit).length; if (limits) notes.push(`${limits} run(s) stopped at the turn or budget limit`);
    const edited = rs.filter((r) => (r.acceptanceEdited || []).length).length; if (edited) notes.push(`${edited} run(s) edited the hidden tests' files (restored before grading)`);
    const denials = rs.reduce((s, r) => s + (r.permissionDenials || 0), 0); if (denials) notes.push(`${denials} permission denial(s)`);
    const fps = new Set(rs.map((r) => JSON.stringify(r.fingerprint))); if (fps.size > 1) notes.push('the configuration changed during this arm');
    return { set: rs[0].set, arm: rs[0].arm, first: rs.map((r) => r.at).sort()[0], runs: rs.length, pass, fp: rs[0].fingerprint || {},
      tpa: pass ? T / pass : null, cpa: pass ? C / pass : null, medTok: median(known.map((r) => tokens(r.usage))),
      medLines: median(rs.map((r) => (r.added || 0) + (r.removed || 0))), notes };
  }).sort((a, b) => a.first.localeCompare(b.first));
  const out = [`# Paired check report, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, ''];
  for (const set of [...new Set(stats.map((s) => s.set))]) {
    const ss = stats.filter((s) => s.set === set);
    const base = ss.find((s) => s.arm === baselineArm) || ss[0];
    out.push(`## Task set ${set} (baseline: ${base.arm})`, '',
      '| Arm | Passed | Tokens per accepted task | Cost per accepted task (API-price estimate) | Median tokens per run | Median lines changed | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |');
    for (const s of ss) out.push(`| ${s.arm} | ${s.pass}/${s.runs} | ${fmt(s.tpa)} | ${s.cpa == null ? 'n/a' : `$${fmt(s.cpa, 2)}`} | ${fmt(s.medTok)} | ${fmt(s.medLines)} | ${s.notes.join('; ') || ''} |`);
    for (const s of ss.filter((x) => x !== base)) {
      out.push('', `### ${s.arm} compared with ${base.arm}`, '');
      if (s.fp.model !== base.fp.model || s.fp.effort !== base.fp.effort) { out.push('Not comparable: the model or effort differs.'); continue; }
      out.push(`- Pass rate: ${s.pass}/${s.runs} against ${base.pass}/${base.runs}${s.pass / s.runs < base.pass / base.runs ? ' (lower, which is a reason not to keep the change)' : ''}`,
        `- Tokens per accepted task: ${pct(s.tpa, base.tpa)}; cost per accepted task: ${pct(s.cpa, base.cpa)}`);
      const diff = Object.keys({ ...base.fp, ...s.fp }).filter((k) => JSON.stringify(base.fp[k]) !== JSON.stringify(s.fp[k]));
      out.push(`- Configuration differences: ${diff.length ? diff.map((k) => `${k} (${JSON.stringify(base.fp[k])} → ${JSON.stringify(s.fp[k])})`).join('; ') : 'none found, so this compares two runs of the same setup'}`);
    }
    out.push('');
  }
  const setup = all.filter((r) => r.status === 'setup-failure').length;
  out.push(setup ? `${setup} setup failure(s) aren't counted above; results.jsonl has the reasons.` : 'No setup failures.', '',
    'A few runs show only large effects: read differences as signals, not proof. Each run used a fresh clone with auto memory off and fixed permissions, so memory tools and permission settings aren\'t measured, and short tasks can\'t exercise compaction settings. Costs are API-price estimates; on a subscription they\'re a relative measure, not a bill.');
  if (!graded.length) out.splice(2, 0, 'No graded runs yet.', '');
  const text = out.join('\n') + '\n';
  fs.writeFileSync(path.join(dataDir, 'REPORT.md'), text);
  return text;
}

function where() {
  const top = sh('git', ['rev-parse', '--show-toplevel']);
  if (top.code !== 0) throw new Fatal('not inside a git repository');
  const cd = path.resolve(top.out.trim(), git(top.out.trim(), 'rev-parse', '--git-common-dir'));
  const dir = path.join(CONFIG, 'paired-check', sha(WIN ? cd.toLowerCase() : cd).slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const STUB = `import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
let prompt = ''; process.stdin.on('data', (d) => { prompt += d; }); process.stdin.on('end', () => {
  const problems = [];
  const log = execFileSync('git', ['log', '--all', '--format=%s'], { encoding: 'utf8' });
  if (/SECRET-FIX|later work/.test(log)) problems.push('future history is visible');
  if (!fs.readFileSync('CLAUDE.md', 'utf8').includes('current')) problems.push('instructions were not copied');
  if (process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY !== '1') problems.push('auto memory is on');
  if (process.env.CLAUDE_CODE_EFFORT_LEVEL !== 'medium') problems.push('effort not pinned');
  if (!prompt.includes('add.js')) problems.push('prompt missing');
  if (problems.length) { console.error(problems.join('; ')); process.exit(3); }
  if (process.env.STUB_MODE === 'good') {
    fs.writeFileSync('add.js', 'module.exports = (a, b) => a + b;\\n');
    fs.mkdirSync('test', { recursive: true }); fs.writeFileSync('test/add.test.js', 'process.exit(0);\\n');
  }
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 3, duration_ms: 900, total_cost_usd: 0.02,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 20, cache_read_input_tokens: process.env.STUB_MODE === 'good' ? 800 : 1200 },
    modelUsage: { stub: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 20, cacheReadInputTokens: process.env.STUB_MODE === 'good' ? 800 : 1200 },
      'stub-subagent': { inputTokens: 1000, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } }, permission_denials: [] }));
});
`;
async function selftest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcst-'));
  const saved = { ...process.env };
  const tasks = path.join(root, 'data', 'tasks.json');
  try {
    const repo = path.join(root, 'repo'), data = path.join(root, 'data');
    fs.mkdirSync(repo); fs.mkdirSync(data);
    const g = (...a) => git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${root}`, ...a);
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); };
    git(repo, 'init', '--quiet');
    put('add.js', 'module.exports = (a, b) => a - b;\n'); put('CLAUDE.md', '# old instructions\n');
    g('add', '-A'); g('commit', '--quiet', '-m', 'base');
    const base = git(repo, 'rev-parse', 'HEAD');
    put('add.js', 'module.exports = (a, b) => a + b;\n'); put('test/add.test.js', "process.exit(require('../add.js')(2, 3) === 5 ? 0 : 1);\n");
    g('add', '-A'); g('commit', '--quiet', '-m', 'SECRET-FIX make add add');
    const reference = git(repo, 'rev-parse', 'HEAD');
    put('later.txt', 'later\n'); g('add', '-A'); g('commit', '--quiet', '-m', 'later work');
    put('CLAUDE.md', '# current instructions\n'); // uncommitted on purpose: runs must see today's instructions
    writeJson(tasks, { id: 'selftest', source: repo, allowedTools: ['Read', 'Edit', 'Bash(node test/add.test.js)'],
      tasks: [{ id: 't1', prompt: 'Make add.js return the sum of its two arguments.', base, reference, acceptanceFiles: ['test/add.test.js'],
        acceptance: 'node test/add.test.js', maxTurns: 5, budgetUsd: 1, timeoutMin: 2 }] });
    const v = await validate(tasks);
    if (!v[0].ok) throw new Error(`validate: ${JSON.stringify(v[0])}`);
    fs.writeFileSync(path.join(root, 'stub.mjs'), STUB);
    process.env.PAIRED_CHECK_STUB = path.join(root, 'stub.mjs');
    for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']) delete process.env[k];
    for (const arm of ['bad', 'good']) {
      process.env.STUB_MODE = arm;
      const bp = path.join(data, `batch-${arm}.json`);
      writeJson(bp, { id: `b-${arm}`, tasks, arm, repeats: 2, model: 'stub', effort: 'medium' });
      await run(bp);
    }
    const res = readResults(data);
    const want = (arm, status) => res.filter((r) => r.arm === arm && r.status === status).length === 2;
    if (!want('bad', 'fail') || !want('good', 'pass')) throw new Error(`run: ${JSON.stringify(res.map((r) => [r.arm, r.status, r.reason]))}`);
    if (!res.filter((r) => r.arm === 'good').every((r) => r.acceptanceEdited.includes('test/add.test.js'))) throw new Error('test edits were not detected');
    const text = report(data, 'bad');
    if (!/\| good \| 2\/2 \| 1,970 \|/.test(text) || !/Tokens per accepted task: n\/a/.test(text)) throw new Error(`report:\n${text}`);
    if (fs.readdirSync(path.join(os.tmpdir(), 'pc', sha(path.resolve(tasks)).slice(0, 8))).some((n) => /^[bvr]-/.test(n))) throw new Error('clones were left behind');
    return 'selftest passed';
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmDir(path.join(os.tmpdir(), 'pc', sha(path.resolve(tasks)).slice(0, 8)));
    rmDir(root);
  }
}

const [cmd, a1, a2] = process.argv.slice(2);
const commands = { where, validate: () => validate(a1, a2), run: () => run(a1), report: () => report(a1, a2), selftest };
if (!commands[cmd] || (['validate', 'run', 'report'].includes(cmd) && !a1)) {
  console.error('usage: node run.mjs where | validate <tasks.json> [task id] | run <batch.json> | report <data folder> [baseline arm] | selftest');
  process.exit(2);
}
Promise.resolve().then(commands[cmd]).then((r) => { if (typeof r === 'string') console.log(r.trimEnd()); })
  .catch((e) => { console.error(`paired-check: ${e instanceof Fatal ? e.message : e.stack || e}`); process.exit(1); });
