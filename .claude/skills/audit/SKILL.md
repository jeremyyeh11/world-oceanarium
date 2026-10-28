---
name: audit
description: Audit a range of releases, versions, PRs or commits for lapses from the project's own rules (process, data, assets, content completeness, code hygiene, docs). Run only when the user explicitly asks for an audit, as the first task of a fresh session.
argument-hint: "<range, e.g. v1.2 to v1.4, last 5 PRs, since 2026-01-01>"
disable-model-invocation: true
---

# Audit

Audit the range in `$ARGUMENTS` against the rules this repository sets for itself, report what was missed, and fix only what the user picks.

Any agent can follow this file. It is written for Claude Code's skill format, but nothing in it depends on Claude.

## Before you start

1. **Explicit request only.** Run this only when the user asked for an audit by name or invoked it. Never start it on your own initiative, and never fold it into other work.
2. **Fresh session only.** If this conversation already holds other work (edits, a feature, an earlier task), stop and tell the user to start a new session and ask for the audit there. Earlier context biases what you look for and lets your own recent work escape scrutiny.
3. **Pin the range.** If `$ARGUMENTS` is empty or ambiguous, ask one question to pin it (versions, tags, PR numbers, commits or dates). Resolve it to concrete commits and PRs before reading anything else.
4. **Read-only until the user picks fixes.** During the audit, change no files, write to no database, merge nothing and delete no branches.

## 1. Load the rulebook

The project's own rules decide what counts as a lapse. Don't import rules from elsewhere.

- Read the shared agent instruction file (`AGENTS.md`, or whatever the repo uses) in full, plus any agent-specific files (`CLAUDE.md`, etc.).
- Read every doc they link as authoritative: checklists, SOPs, design docs, roadmap, changelog conventions.
- Make a short list of the checkable rules: versioning, changelogs, branch naming, merge flow, data writes, asset intake, credits, required per-item content, test and lint gates, what must never be committed.

## 2. Map the range

- List the merged PRs and commits in the range (`git log`, `gh pr list --state merged`, release tags), with each one's diff summary.
- List the PRs still open and the branches left behind that touch the range.
- Note which data stores, environments or deployments the range changed (for example a dev and a production database, or a hosting deploy).

## 3. Check each area

Go through every area that applies. Skip areas the project has no rules or assets for, and say you skipped them.

- **Process and SOPs:**
  - versions bumped and promoted as the rules require;
  - every changelog updated and consistent with the others;
  - roadmap or status docs moved on;
  - branch names follow the convention;
  - work landed through the required PR flow;
  - nothing left half-promoted (for example a dev version on the main branch).
- **Release state:**
  - the live deployment serves what the main branch says was released (check the served bundle or endpoint, not the dashboard);
  - stale open PRs and merged branches not yet deleted.
- **Data:**
  - writes made in the range are recorded where the rules say;
  - environments that should match do match (for example dev and prod rows for the same item);
  - backups exist where required.
- **Assets:**
  - every third-party image, texture, model, sound or font is credited where the project credits things;
  - binaries contain nothing foreign: open the files and list every embedded image or resource, then look at each one for logos, watermarks and stray textures;
  - sizes and formats follow the intake rules.
- **Content completeness:** every new item has every field, page, image or entry the project's checklist requires (for example encyclopedia data, thumbnails, descriptions).
- **Code hygiene:**
  - comments and docs match behaviour;
  - no dead code or leftover debug probes;
  - ordering and naming conventions followed;
  - tests and lint pass on the current main branch.
- **Docs drift:** claims in docs, changelogs and release notes that the code or data does not back up.
- **Things that must not be committed:** secrets, keys, personal or machine paths, private notes and other material outside the codebase. Check commit messages and PR bodies too, not only files.

## 4. Verify before reporting

Every finding needs evidence: a `file:line`, a commit, a PR, a query result or a screenshot.

- **Re-check every finding before it goes in the report.**
  - Before calling code dead, search for every reader of it, including indirect ones (config read by a generic helper, sound, scaling).
  - Before calling data wrong, query it.
  - Before calling a doc stale, read the code it describes.
- Mark anything you could not verify as **unverified**, with what would settle it. Don't present a guess as a finding.
- Some findings need a decision only the owner can make (a design intent, a data value, an exception to a rule). Keep these apart from the plain fixes.

## 5. Report

Report in chat first. Offer a page or doc only if the user wants one.

- Group by area, most serious first. For each finding give:
  - what is wrong;
  - the evidence;
  - which rule it breaks;
  - the fix you recommend;
  - a size estimate in minutes or hours.
- End with three short lists:
  - fixes you recommend;
  - decisions the owner must make;
  - rule gaps: lapses that happened because no written rule covered them.
- Ask which items to fix. Don't start fixing in the same turn.

## 6. Fix what the user picks

- Follow the repo's normal workflow for every change: branch naming, versioning, changelogs, PR flow and checks.
- Writes to production data, merges to the main branch and branch deletions each need the user's explicit yes, even after they have approved the fix list.
- **Prevent recurrence.** For each lapse that came from a missing or unclear rule, add or sharpen the rule in the shared instruction file or the doc it belongs to, in the same PR. Keep the rules generic, never only in an agent's private memory.
- Correct your own report if a fix shows that a finding was wrong. Say so in the PR and the changelog where the finding was recorded.
- When done, restate what was fixed, what is still open, and where each open item is now recorded (roadmap, issue, PR).
