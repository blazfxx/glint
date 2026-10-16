# Glint: notes for AI agents and contributors

Read `docs/SPEC.md` (the product spec) and `docs/DECISIONS.md` before changing anything. Build strictly phase by phase
(spec §19); phases 1 and 2 are done.

## Layout

- `apps/desktop/electron/`: the main process. `main.ts` wires the tray, shortcuts, requests and captures;
  `screens.ts` grabs every display at full pixel size; `area.ts` keeps one hidden overlay window per display and
  resolves with a selection; `frames.ts` serves frozen frames (`glint-frame://`) and history images (`glint-history://`);
  `output.ts` delivers a capture (clipboard, file, history); `quick-access.ts` is the corner card; `history.ts` the
  library; `updater.ts` electron-updater; `system.ts` permissions and launch at login.
- `apps/desktop/shared/`: `ipc.ts` (every request with its Zod schema, every event; the preload only allows these) and
  `settings.ts` (schema, defaults, `mergeSettings` which keeps each valid field of a saved file).
- `apps/desktop/src/`: one React app, routed by the hash; pages in `src/pages`.
- `packages/shortcuts`, `packages/capture-core`: pure TypeScript with unit and property tests.

## Rules

- No placeholders: no TODO, no `any`, no dead buttons. A feature of a later phase gets no UI until it works.
- Every window goes through `openPage()` (sandboxed, isolated, no navigation, no new windows).
- New requests: add the channel and its schema to `requests` in `shared/ipc.ts`, its answer to `Responses`, then
  `handle()` it in `main.ts`.
- Keep `pnpm check` and `pnpm e2e` green. On this Linux VPS: `cd apps/desktop && pnpm build && xvfb-run -a -s
"-screen 0 1280x800x24" pnpm exec playwright test`.
- Tests drive the app through `globalThis.__glint` (only defined with `GLINT_TEST=1`); `GLINT_USER_DATA` and
  `GLINT_CAPTURE_DIR` give each test a fresh profile and folder.
- Icons are drawn in `apps/desktop/scripts/make-icons.mjs` (SVG) and rendered with Playwright; re-run it after changing
  them.

## Releasing

Bump `version` in `apps/desktop/package.json` and `CHANGELOG.md`, push to `main`, wait for CI on all three systems, then
tag `vX.Y.Z`. The Release workflow builds the installers on each system and publishes them, with the `latest*.yml`
files the updater reads, to the GitHub release.

## Limits of this environment

Only Linux can be run here. macOS and Windows are checked by CI (build, unit tests, Windows end-to-end); things that
need a person at the machine (the macOS permission prompt, tray menus, global shortcuts on a real keyboard, multiple
displays with different scales) are not covered by tests and need trying by hand.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
