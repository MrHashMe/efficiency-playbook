# Codex (Windows): Quality + Efficiency Playbook (v1.0)

Prepared 2026-09-29 for Codex CLI 0.158.0 or later and Codex in the ChatGPT desktop app, on native Windows. It is the Codex companion to the Claude Code playbook in this repo (`PLAYBOOK.md`, v7.3), whose Part 2 records the evidence for tools evaluated on Claude Code. This file records what differs on Codex.

**How to use this file.** With the efficiency-playbook plugin installed, type `$efficiency-playbook:setup` in the Codex CLI, or pick the plugin's setup skill with `@` in the ChatGPT desktop app; add the word `rollback` to remove what the setup's manifest records. Without the plugin, save this file and say "Read <full path> up to '## Part 2' and execute Part 1." Part 1 is the setup Codex carries out, and it upgrades an earlier version of this setup in place. Part 2 is the decision record. Part 3 is daily habits for me. When executing, act only on Part 1, and don't install anything Part 1 doesn't list.

---

## Part 1: Setup (execute this)

Set up a high-quality, low-waste Codex configuration on this Windows machine. After setup, everything must work without per-session activation, with one owner per role and nothing that conflicts or lowers quality. Keep the final report short.

### Ground rules

- Before each change, or each group of related changes, show me what you'll change and wait for my yes, whatever the approval mode.
- Don't change my model, reasoning effort, approval policy, sandbox mode or Windows sandbox setup, login, Memories, existing hooks or existing MCP servers, except where step 6 asks me first. Report current values instead.
- Configure only Codex on this machine: the Codex home (`CODEX_HOME` if set, else `%USERPROFILE%\.codex`, written `<codex home>` below), `%USERPROFILE%\.agents\skills`, and this project. Don't touch Claude Code (`~/.claude`, `CLAUDE.md`), other AI clients, WSL (which has its own `~/.codex`), or cloud tasks.
- Writes outside this workspace, such as `<codex home>` and `~/.agents`, need approval under the default Auto preset. Request it per command. Never ask me to switch to Full Access or to bypass approvals.
- Respect managed configuration and requirements set by my organization. If one blocks a step, report it and move on.
- Never read `auth.json`, sessions, history, logs or `*.sqlite` files in `<codex home>`. Never print secrets: for keys, tokens and MCP `env` or header values, report only whether they're set.
- Before editing any existing file, copy it to `<codex home>\efficiency-backups\setup-<timestamp>\`. In the same folder, keep `MANIFEST.json`: the playbook version (`codex-v1.0`) and every file, marked block, `config.toml` key (with its previous value, or `absent`) and skill this setup adds or changes, with a hash before and after each change.
- If an earlier setup's `MANIFEST.json` exists under `<codex home>\efficiency-backups\`, read the newest one first. Everything it lists is owned by this setup, except items marked `"removed"` by a rollback. Update owned content in place: if it still matches its recorded hash, replace it with this version's content; if I've edited it since, show me a diff and ask. Carry the earlier ownership records into the new manifest.
- `config.toml` is also written by Codex itself (model, Fast, trust, plugins, MCP servers, hook trust). So re-read it just before each edit and change only the keys this setup owns, keeping every other line, comment and table as it is; never rewrite the whole file. Top-level keys go above the first `[table]` header, because a key below a header belongs to that table, where Codex either ignores it without an error or fails to load the file. Record ownership in `MANIFEST.json`, never in TOML comments (`/import` rewrites the file and drops comments). After each edit, if `codex` is on PATH, run `codex features list`: it exits with an error naming the line when the file doesn't parse. Edit JSON with a parser and validate it. Keep each existing file's encoding, and write new files as UTF-8 without a BOM (`apply_patch` does; in Windows PowerShell 5.1, `Set-Content -Encoding UTF8` and `Out-File` add a BOM and `>` writes UTF-16), because Codex skips a `SKILL.md` whose first line isn't exactly `---`. Make re-runs idempotent.
- Don't commit or push. Leave repository changes for me to review.
- Install nothing beyond what Part 1 lists, and nothing Part 2 marks Skip. Install at user level only; no admin rights, and no piping remote scripts into a shell. Don't enable anything that sends my code, prompts or transcripts to a third party, except Context7's lookups if I choose them in step 6.
- You can't run slash commands or restart the app. When a step needs me, give me the exact text and continue with everything else.

### Roles (one owner each)

| Role | Owner on Codex | How it activates |
| --- | --- | --- |
| Context size | Native auto-compaction (at 90% of the model's context window by default) | Automatically |
| Type errors, definitions, references | The repo's own typecheck, lint and test commands, from the command map in its `AGENTS.md`; `rg` for search. Codex has no built-in LSP | After edits |
| Over-engineering and code volume | No owner by default: Ponytail is a conditional experiment on Codex (Part 2) | n/a |
| Current library and API docs | Context7 MCP server, if I choose it (step 6) | When libraries come up |
| UI design (new frontends only) | No owner installed; `build-web-apps` is conditional (Part 2) | n/a |
| Learning my corrections | Codex Memories, only if I've turned them on | Background, after idle threads |
| Why code is the way it is | Git history lookups (working rule) | Before changing code whose intent is unclear |
| Setting up new repos | `$project-setup` skill | When I invoke it in a repo |
| Checking this setup | `$setup-check` skill | When I invoke it |
| Approval prompts | The Auto preset on Codex's Windows sandbox; optional auto-review (step 6) | Always |
| Final checks before merge | Codex's `/review` | When I run it |

### 1. Inspect (read-only), then summarize in a few lines

- First confirm you read all of Part 1: it ends with the comment `<!-- end of Part 1, codex playbook v1.0 -->`.
- The Codex version (`codex --version` if `codex` is on PATH), and whether this session runs in the CLI or the ChatGPT desktop app. If it's older than 0.158.0, tell me to update, then continue.
- Whether an earlier version of this setup is installed (a `MANIFEST.json` under `<codex home>\efficiency-backups\`, the `efficiency-playbook:start` block in the global `AGENTS.md`, the `project-setup` and `setup-check` skills), and which version.
- From `<codex home>\config.toml`: `model`, `model_reasoning_effort`, `service_tier`, `[features]` `fast_mode` and `memories`, `approval_policy`, `approvals_reviewer`, `sandbox_mode`, `[windows]` `sandbox`, `model_context_window`, `model_auto_compact_token_limit`, `[shell_environment_policy]`, `web_search`, and `[goals]` `max_goal_token_budget`. Report absent keys as "default". Also note any `<name>.config.toml` profile files by name.
- Plugins (`[plugins."<plugin>@<marketplace>"]` and whether each is enabled), marketplaces, MCP servers (names and whether each is enabled), hooks (`<codex home>\hooks.json`, `[hooks]` in `config.toml`, and this repo's `.codex\hooks.json`: event and program name only), and skills in `%USERPROFILE%\.agents\skills`, the legacy `<codex home>\skills` (skip `.system`), and this repo's `.agents\skills`. Flag:
  - skill names that appear in more than one place: Codex lists both, and a plain `$name` then no longer resolves;
  - anything Part 2 marks Skip, and anything that injects text into every prompt or rewrites tool output;
  - Claude Code items that Codex's `/import` copied over and that don't work in Codex: the `paired-check` and `memory-lint` skills, Claude-flavored `project-setup` or `setup-check` skills this setup didn't write, and a `SessionStart` hook that runs `project-setup-nudge.js`.
  The efficiency-playbook plugin is this setup's installer; report it but don't flag it.
- The global instructions: whether `<codex home>\AGENTS.override.md` exists (Codex then reads it instead of `AGENTS.md`), and each file's size. The global file has no size cap and loads into every thread.
- This project: whether it's a git repository, whether Codex trusts it (the `[projects.'<path>']` entry for this folder or its git root, matched case-insensitively: `trust_level = "trusted"`, `"untrusted"`, or no entry; only an explicit `"untrusted"` stops Codex from loading project `AGENTS.md`), and the `AGENTS.md` and `AGENTS.override.md` files from the repo root down to this folder, with their combined size against Codex's 32 KiB project budget (content past it is cut off with no warning in the UI).
- Languages used in this repo (from tracked file extensions), whether it has a web frontend and an established design system, and its build, typecheck, lint and test commands (from manifests and CI config). Don't run repo scripts to discover them.
- Whether Git for Windows is installed, and whether PowerShell 7 (`pwsh`) is; without it, Codex runs commands in Windows PowerShell 5.1.
- Whether a Claude Code setup from this repo's other playbook is present (`~/.claude/rules/token-efficiency.md`). Report only.

### 2. Global working rules

Add this block to `<codex home>\AGENTS.md` (create the file if it doesn't exist), at the end, keeping everything else. If `AGENTS.override.md` exists there, ask me which file gets the block. If the markers already exist, update the block under the ground rules for owned content. Codex doesn't strip HTML comments, so keep the block exactly this short.

```markdown
<!-- efficiency-playbook:start -->
<!-- codex playbook v1.0 -->
# Working rules (quality first)
- In large files, read the relevant line ranges rather than the whole file. Search with `rg`.
- Check narrowly while iterating (one test or file, quiet output), then run the full acceptance checks from the project's command map on the final state. Report failures with the failing test names and key error lines.
- When code depends on a library or framework API that may have changed recently, look up that API with Context7 for the version this project uses before writing it. Send only library names and generic questions, never private code.
- When a command's output may be long, filter it to what you need, but never filter out errors, warnings, skipped or expected-failure tests, or log severity. If the filtered view doesn't explain a failure, read the full output.
- Before changing code whose intent isn't clear from the code, tests or instructions, check the history of those lines (`git log -L` or `git blame`) for the decision behind them.
- When a change needs tests, write them in the project's existing test framework and style, with its fixtures. Always report verification results, failures, caveats, and risks.
- Keep prose concise without dropping results, caveats, or risks.
- If I switch to an unrelated task in a long thread, suggest a new thread (`/new`) first.
<!-- efficiency-playbook:end -->
```

Leave out the Context7 line unless `config.toml` already has a `context7` MCP server or I choose Context7 in step 6.

### 3. This project's section

Don't run `/init`: in two independent studies, generated context files didn't help Codex and one raised its cost (Part 2). Instead, add a short section to `AGENTS.md` at the repo root between `<!-- efficiency-codex:start -->` and `<!-- efficiency-codex:end -->`, creating the file if needed and keeping everything else. If the markers exist, update the section under the ground rules for owned content. The section contains:

- A command map in two groups. Quick checks for iterating: a single test, a single file, typecheck, lint. Full acceptance: the complete test suite with no fail-fast flag, plus build. Use only flags the tool documents, taken from the project's own config where it sets them. Write each command so it runs unchanged in Windows PowerShell 5.1 and PowerShell 7: no `&&` chains, `/dev/null` redirects or `VAR=value` prefixes. Skip any command the existing instructions already state correctly.
- Only non-obvious gotchas Codex can't learn from the code, such as required environment variables or services the tests need. No directory layouts, dependency lists or architecture overviews, and don't remove anything already there.
- If the repo has an established design system or component library: "Use the existing components and design tokens; don't introduce a new visual style unless I ask."
- If the repo talks to hosted services (a database, payments, hosting, email or storage, judged from its SDK dependencies, deploy configs and MCP config), one line naming them: "For <services>, work with test keys, development databases or branches, and read-only access. Deploys, migrations and changes to live data or settings happen only when I ask."

Claude Code also reads `AGENTS.md` when a repo has no `CLAUDE.md`, so the section serves both. If the project is marked `untrusted`, tell me that Codex won't load the section until I trust the folder; with no trust entry, Codex still loads it. Don't write the trust setting yourself.

Propose, but don't apply, trims for any `AGENTS.md` that brings the project files near the 32 KiB budget.

### 4. Skills

Write each skill in full; it must work without this file. Put each in `%USERPROFILE%\.agents\skills\<name>\SKILL.md` with `name` and `description` frontmatter (Codex reads only those), and beside it `agents\openai.yaml` with exactly this content, so the skill runs only when I invoke it and its description stays out of every thread:

```yaml
policy:
  allow_implicit_invocation: false
```

If a folder with that name exists and the manifest doesn't record it as this setup's, don't overwrite it: report it (it may be a Claude Code copy made by `/import`) and ask. Don't also write copies to `<codex home>\skills`.

- `project-setup`. Description: "Set up or refresh this repository's AGENTS.md section for Codex. Use only when the user invokes $project-setup." Body: do the repo parts of step 1 and all of step 3 for that repo only, never looking outside its root, with the same backup and manifest rules (its own entry in the newest `MANIFEST.json`, marked `"by": "project-setup"`).
- `setup-check`. Description: "Verify the Codex efficiency setup and report what works and the exact fix for what doesn't. Use only when the user invokes $setup-check." Body, reporting each check as pass or fail with the fix:
  - The newest `MANIFEST.json` records version `codex-v1.0`, and each `config.toml` key it owns still holds the recorded value, at the right level (top-level keys above the first table header).
  - The global `AGENTS.md` (or override) has the `efficiency-playbook:start` block with the `codex playbook v1.0` line; read the file itself.
  - In this repo: the project isn't marked untrusted, the `efficiency-codex:start` section exists, the project `AGENTS.md` files are under the 32 KiB budget, and one quick check from the command map runs in this shell.
  - If Context7 is configured: a lookup for the public library "react" works (send nothing else). If it fails, report whether `CONTEXT7_API_KEY` is set as my user environment variable (set or unset only) by running `-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable('CONTEXT7_API_KEY','User'))` outside the sandbox with my approval, not by reading `$env:CONTEXT7_API_KEY`, which misses a key saved after Codex started or hidden by the secrets setting. If it's set, the fix is restarting Codex: fully quit the app, or for the CLI close its windows and run `codex app-server daemon restart` in a new terminal.
  - The answers from step 6 are in effect: `service_tier`, `approvals_reviewer` and `[shell_environment_policy]`.
  - No skill name appears in more than one skills folder; nothing Part 2 marks Skip is enabled; Claude-only items copied by `/import` are listed with how to remove them (don't remove them yourself).
  - Memories: on or off, and if on, that they rewrite `<codex home>\memories` in the background without asking.
  - End by reminding me that `/status` shows this session's token usage, `/usage` my plan limits, and `/debug-config` the config layers in precedence order and any requirements my organization sets.

### 5. Report

Report in a short table, and save the same report as `REPORT.md` next to `MANIFEST.json`. Cover each change, its file and backup path; what changed from an earlier version of this setup; anything I'd edited that you left alone; the text I need to paste; and anything skipped, with why. Then:

- If a Claude Code setup is present, tell me: when Codex offers to import from Claude Code (`/import` or its first-run prompt), deselect Skills, Hooks, Plugins and Config, because the Claude Code skills and startup hook don't work in Codex, the Claude plugins (such as Ponytail) aren't part of this setup on Codex, and Config would copy Claude Code's `env` settings into `[shell_environment_policy]` with `inherit = "core"`, which hides every other environment variable from the commands Codex runs. The global `AGENTS.md` this setup wrote already stops the import from copying my Claude instructions there.
- If `[windows] sandbox` isn't set, tell me that `/setup-default-sandbox` sets up Codex's recommended elevated sandbox, which asks for administrator approval once. Don't run it.
- How rollback works:
  - Remove only what `MANIFEST.json` says this setup added and that still matches its recorded hash. Leave entries marked `"by": "project-setup"` (other repos' `AGENTS.md` sections) in place, and list them. If I've edited a file since, remove only this setup's marked block or keys and leave the rest. Never copy a backup over a file I've changed.
  - For each owned `config.toml` key: if it still holds the value this setup wrote, restore the recorded previous value, or delete the key if it was absent; otherwise leave it and tell me.
  - Put the rollback's backups and report in `rollback-<timestamp>` beside the manifest's folder, with no file named `MANIFEST.json` in it (save the manifest's pre-rollback copy as `MANIFEST.pre-rollback.json`), and mark each removed item in the manifest with `"removed": "<timestamp>"`.

### 6. Ask me four questions

1. **Fast mode.** In the Codex CLI, GPT-6 Sol and Luna run in Fast mode unless I choose otherwise: about 1.5x faster, for 2.5x the plan credits when I sign in with ChatGPT (API-key billing has no Fast multiplier). `codex exec` runs Standard unless configured. Use Standard by default? On yes, set the top-level key `service_tier = "default"` (Codex's explicit Standard setting) unless I've set a value, and tell me that `/fast` turns Fast on when I want speed, but in the CLI it also saves Fast as my default in `config.toml`, so I should run `/fast` again to go back to Standard, and that if the desktop app later shows Fast anyway (open issues #35136 and #41859), I should turn it off there.
2. **Auto-review.** Let a reviewer agent decide Codex's requests to act outside the sandbox, instead of asking me each time? It works only when Codex would otherwise ask me (`approval_policy` `on-request`, the default); if it's `never`, tell me auto-review would have no effect and don't set it. It swaps the reviewer rather than granting new permissions: it can still deny, and after 3 denials in a row, or 10 among the last 50 reviews in one turn, it stops the turn with a warning instead of asking me. It adds usage, and OpenAI doesn't document how much. On yes, set the top-level key `approvals_reviewer = "auto_review"`, and tell me that `/approve` retries a denied request.
3. **Secrets in commands.** By default Codex passes every environment variable to the commands it runs, including ones whose names contain KEY, SECRET or TOKEN. Strip those? Commands that need such a variable, such as `gh` with `GH_TOKEN` or a tool reading an API key, then stop seeing it, and I can add them back with `[shell_environment_policy.set]` or by setting them per command. On yes, set `ignore_default_excludes = false` under `[shell_environment_policy]`.
4. **Context7.** Add Context7 for current library docs? Each lookup sends a library name and a short question Codex writes, plus my IP address and client name, to Upstash, which keeps the questions for its benchmarks, keeps API logs for 30 days, and has OpenAI, Google and Anthropic models rank the results. It needs a free Context7 API key, which I create on Context7's site and save myself as my user environment variable `CONTEXT7_API_KEY` (check only whether it's set, never print its value: run `-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable('CONTEXT7_API_KEY','User'))` outside the sandbox with my approval, because the commands you run don't see a key I saved after Codex started or, if I strip secrets, any name containing KEY, and a sandboxed command may run as a separate Windows user). On yes, once that check shows the key is set, add this to `config.toml` if no `context7` server exists, add the Context7 line to the working rules, and tell me that Codex reads the key only when it starts:

   ```toml
   [mcp_servers.context7]
   url = "https://mcp.context7.com/mcp"
   bearer_token_env_var = "CONTEXT7_API_KEY"
   ```

   Don't use `npx ctx7 setup --codex`; it also writes `AGENTS.md`.

Finish by telling me to start a new thread (in the CLI, a new `codex` window; in the app, fully quit and reopen it if `config.toml` changed), trust this folder if Codex asks, and then invoke `$setup-check`. If I saved `CONTEXT7_API_KEY` during this setup, Codex must restart first to see it: fully quit the app; for the CLI, close its windows and run `codex app-server daemon restart` in a new terminal, because new CLI windows attach to a shared background server that keeps the environment it started with. In each other repo, `$project-setup` adds its section.

<!-- end of Part 1, codex playbook v1.0 -->

---

## Part 2: Decision record (reference only; don't act on it)

Evidence tiers: **I** independent paired test; **V** a vendor's or author's own test; **D** docs or source code only; **A** anecdote or self-assessment. Codex facts below were checked against the openai/codex source at tag `rust-v0.158.0` (2026-09-28) and the Codex docs at learn.chatgpt.com (developers.openai.com/codex now redirects there) on 2026-09-29. **Every OpenAI-model test below predates GPT-6.**

### How the roles map from Claude Code

| Role | Claude Code owner (PLAYBOOK.md) | Codex verdict | Why | Tier |
| --- | --- | --- | --- | --- |
| Context size | Auto-compaction, optional 300k cap, compact instructions | Native compaction; no cap question | Compaction runs at 90% of the context window (272,000 tokens by default for GPT-6 models, so about 245,000); `model_auto_compact_token_limit` can only lower it. `compact_prompt` is ignored for OpenAI and Azure models, so compact instructions have no Codex lever; constraints go in `AGENTS.md` | D |
| Type errors and navigation | One LSP plugin per language | The repo's own typecheck and tests via the command map | Codex has no built-in LSP (issue #8745, open). No paired test of Serena or codex-lsp on Codex; Serena's Codex report is the agent grading itself | D / A |
| Over-engineering | Ponytail | Conditional experiment, not installed | Ponytail's own single-shot cost check (2026-06-17): gpt-5.5 cost 38.7% more and gpt-5.4-mini 26.2% more, at 100% correctness. Its open Codex issues include SessionStart after compaction making Codex greet like a new session (#821) and its SessionStart message showing as a yellow `warning:` line (#605) | V (against) |
| Library docs | Context7 plugin | Opt-in MCP entry with a key from an environment variable | No Codex test. `npx ctx7 setup --codex` also writes `AGENTS.md`, a second owner of instructions. Keyless use from Codex is unverified | D |
| UI design | frontend-design, repo scope | `build-web-apps@openai-curated`: conditional, new frontends only | No paired test; its builder skill starts with an image concept and loops until "10/10" | D |
| Learning corrections | Native auto memory | Keep my Memories choice | Off by default. When on, a background agent rewrites `<codex home>\memories` without approval and uses plan usage; the injected summary is capped at 2,500 tokens | D |
| Keeping memory accurate | `/memory-lint` | Deferred | Codex consolidates memories itself; a lint skill is worth porting only if Memories prove useful | n/a |
| Setting up repos | `project-setup` + startup hook | `$project-setup`, no hook | Hooks work on Codex but each needs a manual trust step in `/hooks` and runs through cmd.exe on Windows; an explicit skill avoids both | D |
| Onboarding files | Minimal project section | Minimal section; skip `/init` | ETH (arXiv 2602.11988): Codex GPT-5.2 with LLM-generated context files, 56.6% to 54.4% success and $0.32 to $0.43 per task. Khatri (arXiv 2607.27250): Codex gpt-5.5, `AGENTS.md` made no measurable difference | I |
| Measuring a change | `/paired-check` + runner | Deferred | The runner drives `claude`. A Codex port would use `codex exec --json`, whose `turn.completed` usage is cumulative, has no cost field and leaves out subagent tokens | D |
| Hard decisions | Advisor (opt-in) | No owner; `/review` before merge | Codex has no advisor | D |
| Approvals | Auto mode (opt-in) | Auto preset on the Windows sandbox; auto-review opt-in | Unlike Claude Code on native Windows, Codex runs commands in a sandbox. The elevated sandbox needs administrator approval once | D |

### Add-ons and settings

| Candidate | Verdict | Evidence | Tier |
| --- | --- | --- | --- |
| RTK | Skip | No paired test with Codex. RTK 0.50.0 added a native Codex rewrite hook (#3552) that `rtk init --codex` installs on every OS, but it's unconfirmed on native Windows Codex (rtk #1864 still open; #4229 reports `rtk` commands failing under Codex on Windows) | D |
| Superpowers | Skip | Independent Codex test (v5.0.5, GPT-5.4, 500 tasks): 239 vs 228 solved, not significant, about 40% more tokens and 20% longer runs | I |
| benjamin-plus v6 | Conditional experiment | JetBrains-reported, 675 paired Codex runs on gpt-5.6-luna with the pre-v6 rules (v6's polling rule came from this eval, so v6 itself is untested on Codex): 4.4% lower cost (p = 0.003) when hook-injected, solve rate unchanged; as a skill folder, no significant change. Appending to `AGENTS.md`, the repo's suggested Codex install, wasn't the tested delivery. Whether the eval was independent is unverified | V |
| Caveman | Skip | No Codex test found | n/a |
| `model_verbosity = "low"` | Skip | Every current model already defaults to low | D |
| Serena, codex-lsp | Conditional experiment | No paired test on Codex | A |
| Context Mode, jcodemunch, claude-context, Graphify | Skip | No independent paired test on Codex; claude-context sends code to cloud embeddings by default | n/a |
| jevgrep | Skip on Windows | macOS and Linux only | D |
| Fast mode | Ask (step 6) | On by default in the CLI for GPT-6 Sol and Luna; 2.5x credits | D |
| `shell_environment_policy` | Ask (step 6) | Defaults to passing all variables, including KEY, SECRET and TOKEN names | D |
| Auto-review | Ask (step 6) | Reviewer agent; adds undocumented usage | D |
| Memories | Keep my choice | Background rewrites without approval | D |

### Conflicts checked

- `/import` from Claude Code copies `~/.claude/skills` into `~/.agents/skills` (skipping existing folders), `~/.claude/CLAUDE.md` into `<codex home>\AGENTS.md` only if that file is missing or empty, and Claude hooks into `<codex home>\hooks.json` unless that file exists. The Claude Code setup's `paired-check` skill and startup hook don't work in Codex.
- At startup, Codex checks each Git marketplace and, when its default branch has a new commit, reinstalls its plugins whether or not their version changed, deleting the old folder at once. A marketplace added at a tag (`@v<version>`) stays on that tag. Nothing outside the plugin may point into its folder.
- The IDE extension doesn't load plugins, but it shares `<codex home>` and `~/.agents/skills` with the CLI and the app, so a setup run from either covers it. Copying the setup skill into `~/.agents/skills` would list it twice.
- Codex lists skills with the same name from different folders separately; a plain `$name` then doesn't resolve.

### Sources (accessed 2026-09-29)

- openai/codex at `rust-v0.158.0` (paths under `codex-rs/`): `core/src/agents_md.rs`, `codex-home/src/instructions/mod.rs`, `protocol/src/openai_models.rs`, `protocol/src/config_types.rs`, `protocol/src/shell_environment.rs`, `config/src/shell_environment_policy.rs`, `tui/src/service_tier_resolution.rs`, `core/src/tasks/compact.rs`, `model-provider/src/provider.rs`, `models-manager/models.json`, `core-plugins/src/manager.rs`, `core-plugins/src/store.rs`, `external-agent-migration/src/service.rs`, `ext/skills/src/provider/host.rs`
- Docs at https://learn.chatgpt.com/docs/: `agent-configuration/agents-md`, `agent-configuration/speed`, `agent-approvals-security`, `sandboxing/auto-review`, `windows/windows-sandbox`, `customization/memories`, `hooks`, `build-skills`, `plugins`, `extend/mcp`, `pricing`, `models`
- Issues: openai/codex #8745, #35136, #41859; DietrichGebert/ponytail #605, #821; rtk-ai/rtk #1864, #3552, #4229
- Studies and tests: arXiv 2602.11988 (ETH), arXiv 2607.27250 (Khatri); Ponytail `benchmarks/results/2026-06-17-cost-verification.md`; JetBrains/benjamin-plus-skill; the Superpowers Codex benchmark by Norbert Laszlo (Medium, June 2026)

---

## Part 3: Daily habits (for me)

- Model choice dominates cost. Per token, GPT-6 Sol costs 20x Luna and Astra 5x Sol in plan credits. Use the smallest model that handles the task, and step up when it struggles.
- Pick the model and reasoning effort at the start of a task; changing them mid-task breaks prompt-cache reuse.
- Start a new thread (`/new`) for unrelated work; every turn re-sends the whole thread.
- Before a long `/goal`, remember it has no token budget unless `[goals] max_goal_token_budget` is set.
- Run `/review` before merging, and `/status` or `/usage` when a session feels expensive.
