---
description: Install, upgrade or roll back the Claude Code efficiency setup by running Part 1 of the bundled playbook, asking before each change. Run only when the user types /efficiency-playbook:setup.
argument-hint: "[rollback]"
disable-model-invocation: true
---

Arguments: $ARGUMENTS

Bundled files. Their paths change with every plugin update and old copies are deleted 14 days later, so read or copy them, but never write these paths into any file outside this plugin:
- The playbook: `${CLAUDE_PLUGIN_ROOT}/PLAYBOOK.md`
- The paired-check runner: `${CLAUDE_SKILL_DIR}/run.mjs`, byte-identical to the `js` block after "The runner, `~/.claude/skills/paired-check/run.mjs`, with exactly this content:" in Part 1 step 6
- This plugin's version: the `version` field in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`

## No arguments: install or upgrade

1. Part 1 is written for Windows. If this machine isn't Windows, say so and stop unless the user asks you to continue.
2. Grep the playbook for `## Part 1` and `## Part 2` and read that range in pieces, skipping the runner's `js` block. Part 1 ends with an `<!-- end of Part 1, playbook v… -->` comment line; until you've seen it, you haven't read all of Part 1. Don't read Parts 2 to 4 whole: where Part 1 depends on them, Grep for the component's name and read those rows. For step 1's flags and the `/setup-check` skill's Skip check, Grep Part 2 for rows whose verdict is Skip.
3. Part 1 also sets up the current folder's project. If this folder isn't a git repository, or the user says it's the wrong one, ask whether to skip Part 1's project steps.
4. Execute Part 1 exactly as written, as if the user had attached the playbook and said "Execute Part 1 of the attached playbook." Its ground rules, backups, MANIFEST.json, owned-content rules, markers and step 7 questions apply unchanged. In addition, whatever the permission mode, before each change or group of related changes, show what you'll change and wait for the user's yes. Manifest items marked `removed` by a rollback are no longer installed or owned.
5. Where Part 1 says to create `~/.claude/skills/paired-check/run.mjs`, copy the bundled runner with a file copy command (`Copy-Item -LiteralPath` in PowerShell, `cp` in Bash); never retype it. Check that the copy's SHA-256 equals the bundled file's, and record it in MANIFEST.json.
6. Also record `"installedBy": "efficiency-playbook <version>"` in MANIFEST.json. In the report, give the plugin version and add: "After each update of the efficiency-playbook plugin, run /efficiency-playbook:setup again to apply it."

## Argument `rollback`: remove the setup

1. Read the ground rules and "How rollback works" in Part 1 step 7, and find the newest MANIFEST.json in either backup location. If there is none, say no setup is recorded and stop.
2. Show a table of everything you'd remove or restore under those rules. Keep step 2's npm prefix and `%APPDATA%\npm` PATH entry, like Git and Node, unless the user asks to revert them. Change nothing until the user says yes. Apply only what was approved, and give the lines to paste for plugins this setup installed. Put this run's backups and a rollback report in a `rollback-<timestamp>` folder beside the manifest's folder, with no file named MANIFEST.json in it (save the manifest's pre-rollback copy as `MANIFEST.pre-rollback.json`), and mark each item you removed in the manifest with `"removed": "<timestamp>"`.
3. Finish with the lines to paste last: `claude plugin marketplace remove efficiency-playbook` in PowerShell, or `/plugin marketplace remove efficiency-playbook` in a terminal session; either also uninstalls this plugin. In Desktop, **+ → Plugins → Manage plugins** uninstalls the plugin but leaves its marketplace registered. Then fully quit and reopen Desktop.
