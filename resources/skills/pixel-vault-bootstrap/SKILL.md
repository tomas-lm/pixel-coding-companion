---
name: pixel-vault-bootstrap
description: Create and maintain an Obsidian-compatible project vault for a local software project, using Pixel's vault-backed workflow to reduce repeated agent context loading.
---

# Pixel Vault Bootstrap

Use this skill when the user asks to create a Pixel or Obsidian vault for a
project, set up a vault like Tomas uses, create planning docs/tasks for a repo,
or turn a project into a vault-backed AI workflow.

The goal is to externalize durable project context into compact Markdown files
so future Claude/Codex sessions do not need to rediscover the same architecture,
decisions, tasks, and workflow notes.

## Core Rules

- Keep the vault Obsidian-compatible: plain folders and Markdown files.
- Do not require Pixel to own the files.
- Do not hard-code Tomas's absolute paths for other users.
- Ask for the vault root when it cannot be inferred safely.
- Prefer an existing Pixel/Obsidian vault when it clearly matches the project.
- Keep generated docs compact and useful for future agents.
- Create one implementation task note per meaningful work chunk.
- Do not copy secrets, `.env` values, tokens, private keys, or credentials into
  the vault.

## Default Structure

Create or recommend this minimum structure:

```text
<vault>/<area>/<project>/
  <project>.md
  todos.md
  decisions.md
  architecture.md
  tasks/
    001_initial_context.md
  research/
  references/
```

For a personal project, Tomas-style paths usually look like:

```text
Tomas/Projects/Personal/<project-slug>/
```

For client work, Tomas-style paths usually look like:

```text
Tomas/Clients/<client>/projects/<project>/
```

Use those as examples only. For other users, infer or ask for their own vault
root and recreate the pattern underneath it.

## Workflow

1. Identify the target repo path and the user's vault root.
2. Inspect the repo lightly:
   - README/package files;
   - app entry points;
   - test/build commands;
   - existing planning docs.
3. Create the folder structure.
4. Write compact first-pass docs.
5. Add the vault folder to Pixel if the user has Pixel vaults configured, or
   tell the user where the folder was created.
6. Leave a short follow-up task for improving the docs after the first real
   implementation session.

## Project Overview

Create `<project>.md` with:

- goal and user/audience;
- repo path(s);
- active phase or current focus;
- important commands;
- important links;
- where to find tasks and decisions.

Keep it short enough to load at the start of a coding session.

## Architecture

Create `architecture.md` with:

- stack and runtime;
- important folders;
- entry points;
- data flow;
- persistence/config;
- external services;
- testing approach;
- known risks or constraints.

Use concise bullets. Avoid exhaustive file listings.

## Decisions

Create `decisions.md` with dated ADR-style entries:

```text
## YYYY-MM-DD - Decision Title

Decision:
Rationale:
Tradeoffs:
Status:
```

Only record decisions that are real and useful. Do not invent history.

## Todos

Create `todos.md` with Markdown task links:

```text
# <Project> Todos

- [ ] [[tasks/001_initial_context]]
```

For each meaningful implementation chunk, create one task file in `tasks/`.

## Initial Task

Create `tasks/001_initial_context.md` with:

- goal;
- target repository;
- scope;
- out of scope;
- acceptance criteria;
- verification commands;
- code-it invocation if the user's workflow uses Code-It.

The task should be executable by an agent without loading the entire repo into
context.

## Pixel Integration

If Pixel is available:

- prefer creating docs inside an existing configured vault when it matches the
  repo/project;
- suggest adding the new folder as a Pixel vault when it is not configured;
- keep links and filenames friendly to both Pixel and Obsidian.

## Quality Bar

The finished vault should let a future coding agent answer:

- what project this is;
- where the code lives;
- what architecture matters;
- what decisions are already made;
- what task to work on next;
- how to verify work.

If those questions are not answerable from the generated docs, improve the docs
before finishing.
