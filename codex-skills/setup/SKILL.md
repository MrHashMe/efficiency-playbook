---
description: Install, upgrade or roll back the Codex efficiency setup by running Part 1 of the bundled Codex playbook, asking before each change. Use only when the user invokes $efficiency-playbook:setup, optionally followed by "rollback".
---

Bundled files. The plugin root is two folders above this SKILL.md (this file is `codex-skills/setup/SKILL.md` inside it). Codex deletes the plugin's old folder as soon as an update installs, so read these files, but never write their paths into any file outside this plugin:
- The playbook: `PLAYBOOK-CODEX.md` in the plugin root
- This plugin's version: the `version` field in `.codex-plugin/plugin.json` in the plugin root

If the message that invoked this skill contains the word `rollback`, follow "Rollback" below; otherwise follow "Install or upgrade".

## Install or upgrade

1. Part 1 is written for native Windows. If this machine isn't Windows, or this is WSL, say so and stop unless the user asks you to continue.
2. Search the playbook for `## Part 1` and `## Part 2` and read that range in pieces. Part 1 ends with an `<!-- end of Part 1, codex playbook v… -->` comment line; until you've seen it, you haven't read all of Part 1. Don't read Parts 2 and 3 whole: for step 1's flags and the `setup-check` skill, search Part 2 for rows whose verdict is Skip.
3. Part 1 also sets up the current folder's project. If this folder isn't a git repository, or the user says it's the wrong one, ask whether to skip Part 1's project steps.
4. Execute Part 1 exactly as written, as if the user had said "Execute Part 1 of the attached playbook." Its ground rules, backups, `MANIFEST.json`, owned-content rules, markers and step 6 questions apply unchanged. Before each change or group of related changes, show what you'll change and wait for the user's yes, whatever the approval mode. Writes to the Codex home and `~/.agents` are outside the workspace, so request approval for each such command; never ask the user to switch to Full Access. Manifest items marked `removed` by a rollback are no longer installed or owned.
5. Also record `"installedBy": "efficiency-playbook <version>"` in `MANIFEST.json`. In the report, give the plugin version and add: "Codex updates this plugin by itself at startup when its repo has a new commit, unless you added it at a tag. After an update, invoke $efficiency-playbook:setup again to apply it."

## Rollback

1. Read the ground rules and "How rollback works" in Part 1 step 5, and find the newest `MANIFEST.json` under the Codex home's `efficiency-backups` folder (`CODEX_HOME` if set, else `%USERPROFILE%\.codex`). If there is none, say no setup is recorded and stop.
2. Show a table of everything you'd remove or restore under those rules. Change nothing until the user says yes, then apply only what was approved.
3. Finish with the lines to paste last, in a terminal: `codex plugin remove efficiency-playbook@efficiency-playbook`, then `codex plugin marketplace remove efficiency-playbook`. In the ChatGPT desktop app, the plugin can also be uninstalled from its Plugins page. Then start a new thread.
