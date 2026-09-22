# Impeccable — installation and security assessment

**Status: not installed.** Assessed 2026-09-17 from the author's repository and npm package (read-only;
nothing was executed). Installing it is the project owner's decision.

## Source

| | |
|---|---|
| Project | Impeccable — "design guidance for AI coding agents": 1 skill, 24 commands (`audit`, `critique`, `polish`, `distill`, …), a deterministic design detector |
| Official repository | https://github.com/pbakaus/impeccable (Paul Bakaus; Apache-2.0; ~68.5k stars; active — pushed 2026-09-16) |
| Plugin manifest | `.claude-plugin/plugin.json` version 4.3.1, marketplace `.claude-plugin/marketplace.json` |
| npm installer | `impeccable` (maintainer `paulbakaus`, repository link matches), latest **4.1.0** — lags the plugin version |
| Docs | https://impeccable.style |

## Installation mechanisms (from the README)

1. **CLI installer (recommended by the author):** `npx impeccable install` from the project root — detects
   harness folders (`~/.claude`, `.cursor`, …), asks for project or global scope
   (`--providers=claude --scope=project` skips the questions). Runs Node code from the npm package.
2. **Git submodule:** `git submodule add https://github.com/pbakaus/impeccable .impeccable` then
   `npx impeccable link --source=.impeccable --providers=claude` — vendored, updated through Git.
3. **Claude Code plugin marketplace:** the repository publishes a marketplace manifest
   (`/plugin marketplace add pbakaus/impeccable`).

Update: `npx impeccable update`.

## What it installs

- **Skill:** `.claude/skills/impeccable/` (or `~/.claude/skills/` globally): `SKILL.md`, 40+ reference
  markdown files, `scripts/impeccable` (sh launcher), `scripts/impeccable.cmd`, browser scripts
  (`live-browser*.js`, `modern-screenshot.umd.js`), font index data.
- **Subagents:** `.claude/agents/impeccable-{asset-producer,documenter,finish-reviewer,manual-edit-applier}.md`.
- **Hooks (Claude Code):** written to `.claude/settings.local.json` (gitignored, machine-local) by the
  installer:
  - `PostToolUse` on `Edit|Write` → runs `.claude/skills/impeccable/scripts/impeccable hook` (5s timeout)
    after **every file edit** by the agent; scans design-relevant files (`.tsx .jsx .html .css .ts .js …`)
    and pushes findings into the agent's context.
  - `Stop` → the same command with a 30s timeout: a "deep pass" over every UI file touched in the session.
- **Project config:** `.impeccable/config.json` (shared) and `.impeccable/config.local.json` (gitignored:
  hook consent, overrides); a dedup cache.
- **Documents written by commands:** `/impeccable init` writes `PRODUCT.md` and `DESIGN.md` at the
  project root.
- **Live mode (optional, `impeccable live`):** writes `.impeccable/live/config.json` and **injects a script
  tag into the files the browser loads** — for Next.js App Router, `app/layout.tsx` — and includes a
  CSP-checking step so its injected script can run.

## The native binary

- The launcher `scripts/impeccable` looks for an engine in order: `$IMPECCABLE_BIN`, a binary next to
  the launcher, `~/.impeccable/bin/impeccable`, a version-pinned cache, then `impeccable` on `PATH`.
- If none is found it **downloads** a platform binary with `curl`/`wget` from
  `https://github.com/pbakaus/impeccable/releases/download/<version>/…` (overridable with
  `IMPECCABLE_DOWNLOAD_BASE`) into `~/.impeccable/bin/<version>/`, marks it executable, and runs it.
- Integrity: it **refuses to run** a freshly downloaded binary unless it matches a `.sha256` sidecar
  fetched from the same release. This protects against corruption and truncated downloads; it does
  **not** protect against a compromised release, because binary and checksum come from the same place.
  A binary already in the cache or on `PATH` is trusted without re-verification.
- The engine is **open source** in the same repository (Rust workspace, ~258 `.rs` files under `crates/`,
  Apache-2.0) and release binaries are built by a GitHub Actions workflow (`release-engine.yml`). Its
  `browser` crate drives a browser over the Chrome DevTools Protocol (snapshots, screenshot contrast).
  The source was not audited line by line here; building it from source and pointing `IMPECCABLE_BIN` at
  the result is possible for a team that wants to avoid downloaded binaries.

## When it runs and what it can access

| Trigger | Runs | Access |
|---|---|---|
| Every agent `Edit`/`Write` (hook) | engine `hook` (≤5s) | the project directory with the developer's user permissions; any file the developer can read; network (as the user) |
| Agent session `Stop` (hook) | engine deep pass (≤30s) | same |
| `/impeccable <command>` | skill instructions + engine CLI | same; commands edit project files |
| `npx impeccable install/update` | Node code from npm | same, plus harness folders in the home directory |
| `impeccable live` | injects a script into the running app's layout; browser scripts read the page DOM and take screenshots | the running application's pages, including any data rendered in development |

There is no sandbox: hooks and the engine run with the same rights as the developer's shell.

## Removal

1. `/impeccable hooks reset` — deletes the project config and dedup cache and removes the hook entries
   from every provider manifest the installer wrote (it does not touch a hand-edited shared `settings.json`).
2. Delete `.claude/skills/impeccable/` (or `~/.claude/skills/impeccable/`) and `.claude/agents/impeccable-*.md`.
3. Delete `.impeccable/` in the project and `~/.impeccable/` (downloaded engine binaries).
4. If live mode was used: remove the injected script tag from `app/layout.tsx` and revert any CSP change;
   run `npm run e2e` (the CSP and headers are tested).
5. Remove or reconcile `PRODUCT.md` / `DESIGN.md` if `init` created them.
6. `git status` should show no Impeccable files; check `.claude/settings.local.json` for leftover hooks.

## Additional value beyond what this foundation already has

| Impeccable offers | Already covered here by | Net new value |
|---|---|---|
| Anti-slop rules and critique prompts (`critique`, `audit`) | Hallmark (installed, markdown, audit verb), DESIGN_REVIEW.md, pattern library §20, screen playbook | Low — overlapping rule sets |
| Deterministic detector: gradient text, glow shadows, contrast, overflow, design-system drift | Tailwind default palette removed (only semantic tokens exist), ESLint rule rejecting raw colour classes (print exempt), axe WCAG contrast in E2E, sweep fails on sideways scrolling | Low–medium — the detector would catch drift in *domain* code faster than review, but most of its rules cannot occur with the token system |
| Per-edit hook feedback to the agent | Lint + typecheck before commit, E2E, sweep | Medium for speed of feedback; costs a binary run on every edit |
| Live browser iteration with injected script | `npm run qa:screenshots` (desktop + iPhone WebKit) | Low — and the injection touches the CSP and layout, which are security controls here |
| `PRODUCT.md` / `DESIGN.md` context files | BUSINESS_BRIEF.md, BUSINESS_RULES.md, brand/theme.css header, DESIGN_REVIEW.md | Negative if unmanaged (a second source of truth) |
| 24 focused commands (`quieter`, `bolder`, `typeset`, `adapt`) | Hallmark `redesign`, pattern library | Some convenience for iterative polish |

## Recommendation: **NOT NECESSARY YET**

**Why.** Its unique contributions over the current setup are the deterministic detector and per-edit
hook feedback. In this foundation most of the detector's findings are prevented structurally (no raw
palette, semantic tokens, axe contrast checks, sideways-scroll checks), and design critique is already
covered by Hallmark (markdown, no execution), the pattern library, the playbook and the WebKit screenshot
sweep. The cost is an engine binary (open source, but downloaded prebuilt by default) executed after every agent
edit with full user permissions, plus a live mode that injects scripts and touches the CSP.

**Revisit when** several businesses are being built by agents and reviews keep finding the same visual
drift in domain code that the token system does not prevent. Then prefer the lowest-footprint option:
run the detector **on demand** in a disposable environment (a CI job or container: `npx impeccable detect`
against a checkout) with hooks and live mode off, rather than installing hooks on developer machines.
