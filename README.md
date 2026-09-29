# Claude Code Efficiency Playbook

A Claude Code plugin that sets up an evidence-based, token-efficient Claude Code configuration on Windows. It bundles the playbook ([PLAYBOOK.md](PLAYBOOK.md)) and one command, `/efficiency-playbook:setup`, which runs the playbook's Part 1: Claude inspects your setup, then installs or upgrades the pieces below, asking before each change. Part 2 of the playbook records every tool, plugin and setting that was evaluated, with its verdict and evidence (for example, why RTK is skipped).

Unofficial; not affiliated with Anthropic. Canonical repo: https://github.com/MrHashMe/claude-code-efficiency-setup. Don't install forks or copies from elsewhere.

## Requirements

- Windows 10 or 11, Claude Code v2.1.284 or later (terminal, VS Code, or the Desktop app's Code tab)
- Git for Windows (Claude Code uses `git` to download the plugin). Part 1 installs Node.js LTS if it's missing.

## Install

A plugin installed for you (user scope) in the terminal, VS Code or Desktop on one computer is available in the other two as well.

**Terminal.** In a Claude Code session, send this one line (needs v2.1.275 or later):

    /plugin install efficiency-playbook --marketplace MrHashMe/claude-code-efficiency-setup

Confirm adding the marketplace, then choose **Install for you (user scope)**. On an older version, or from PowerShell without a session, run these one at a time:

    claude plugin marketplace add MrHashMe/claude-code-efficiency-setup
    claude plugin install efficiency-playbook@efficiency-playbook

**VS Code.** Type `/plugins`, add `MrHashMe/claude-code-efficiency-setup` on the **Marketplaces** tab, then install `efficiency-playbook` from the **Plugins** tab with **Install for you**.

**Desktop app.** `/plugin` lines don't run in the Code tab, and its plugin browser (**+ → Plugins → Add plugin**) lists only marketplaces you've already added. Either run the two PowerShell lines above once (they need the Claude Code CLI: `winget install --id Anthropic.ClaudeCode -e --scope user`, then open a new PowerShell window), then fully quit and reopen Desktop, or use the no-plugin route below. We don't recommend **Customize → Plugins** for this plugin: it adds it to your whole claude.ai account, including Cowork and Chat, where setup can't run.

**Pinning.** To pin a release, add `#v7.3.0` after the repo name. A pinned install stays on that release, and `claude plugin update` reports it as up to date. To move to a newer release, run `claude plugin marketplace remove efficiency-playbook` (this uninstalls the plugin, not your setup), add it again with the new tag, install, and run `/efficiency-playbook:setup`.

**No-plugin route.** Download `PLAYBOOK.md` from the [latest release](https://github.com/MrHashMe/claude-code-efficiency-setup/releases/latest), open a new session in your project, and say: `Read <full path to PLAYBOOK.md> up to "## Part 2" and execute Part 1.` Changes then go through Claude Code's normal permission prompts only.

## First run

1. Open a new session in a project folder (Part 1 also sets up that project).
2. Type `/efficiency-playbook:setup`, approve each change, and answer the three questions at the end.
3. Paste each line Claude gives you as its own message (Ponytail, one per language server, optionally Context7). Where `/plugin` lines don't run (Desktop, the VS Code panel), install the same plugins from the plugin browser after adding each plugin's marketplace (Claude says how), or from `/plugins` instead.
4. Fully quit and reopen Desktop or VS Code (every window), or open a new terminal window, then type `/setup-check`.

## What it changes

Only what you approve:
- A working-rules file in `~/.claude/rules/` and a marked section in the project's `CLAUDE.md`
- Four user skills: `/project-setup`, `/setup-check`, `/memory-lint` and `/paired-check` (with its runner)
- One `SessionStart` hook in `~/.claude/settings.json` that offers project setup once per repo, and a `PONYTAIL_SUBAGENT_MATCHER` entry in its `env` block
- The optional settings from the three questions at the end (auto-compaction cap, default permission mode, advisor)
- User-level installs of what's missing: Git for Windows and Node.js LTS (with winget), and the language-server programs for your repo's languages. If Node's global npm folder sits inside its versioned install folder, the npm prefix moves to `%APPDATA%\npm`, which is added to your user PATH.
- Backups of every file it edits, and a `MANIFEST.json` that records each change for rollback

Plugins (Ponytail, the language-server plugins, optionally Context7, and frontend-design for a new web frontend, in that repo only) are installed by lines you paste yourself.

## Privacy

The plugin itself has no hooks, MCP servers or network calls, and its command only runs when you type it. Context7 is optional. If you install it, each lookup sends a library name and a short question Claude writes, plus your IP address and client name, to Upstash, which keeps the questions for its benchmarks, keeps API logs for 30 days, and has OpenAI, Google and Anthropic models rank the results.

## Update

In PowerShell, run `claude plugin update efficiency-playbook@efficiency-playbook` (or, in a terminal session, `/plugin` → **Installed** → **Update now**). Then in a new session type `/efficiency-playbook:setup` again, restart, and run `/setup-check`. Auto-update is off for third-party marketplaces; in a terminal session you can turn it on under `/plugin` → **Marketplaces** → efficiency-playbook → **Enable auto-update**. To hear about releases, use **Watch → Custom → Releases** on GitHub.

## Uninstall

1. Type `/efficiency-playbook:setup rollback` and approve what it removes. It removes what its manifest records, except Git, Node, the npm prefix and PATH change, and your `/paired-check` data, which stay unless you ask. The `CLAUDE.md` sections that `/project-setup` later added to other repos stay.
2. In PowerShell, run `claude plugin marketplace remove efficiency-playbook` (or, in a terminal session, `/plugin marketplace remove efficiency-playbook`). This also uninstalls the plugin. In Desktop, **+ → Plugins → Manage plugins** uninstalls the plugin but leaves the marketplace registered.
3. Fully quit and reopen Desktop.

## Not supported

macOS, Linux, WSL, cloud sessions, Cowork and Chat. Part 1 is written for native Windows; on other systems the command stops and asks first.

## License

MIT, for the author's own text and code. Third-party material quoted or summarized in Part 2 belongs to its owners.

## Maintaining

`node scripts/check.mjs` checks that the bundled runner matches the playbook, the versions agree and nothing loads into every session. Bump `version` in `.claude-plugin/plugin.json` for every release, since installed copies only update when it changes, then tag `v<version>`; CI publishes the release with `PLAYBOOK.md` attached.
