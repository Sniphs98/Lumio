# Lumio

Self-hosted Discord alternative: text chat, voice, video and screen sharing. See README.md for the stack and setup.

## Project rules

- Everything in the repository (code, comments, commit messages, docs) is written in English.
- Browser first: every feature must work in desktop and mobile browsers without installation. Electron (`apps/desktop`) is a thin shell that only adds desktop extras (global push-to-talk, screen share picker, tray).
- Keep the UI concept: servers are browser-like tabs, the fixed Home tab holds friends and group chats as separate lists, calls are started from the top right of a chat and a call bar stays visible across tabs.
- Every layout must work at phone width (about 390 px): sidebars become full-width pages below the `md` breakpoint.

## Code conventions (apps/web)

- SvelteKit 3 with Svelte 5 runes. Import project code via the `#lib` alias with explicit extensions, e.g. `#lib/utils.ts`, `#lib/components/ui/button/index.ts`.
- shadcn-svelte first: UI components come from shadcn-svelte and live in `src/lib/components/ui`. Before writing markup, check https://shadcn-svelte.com/docs/components and use the matching component instead of native elements or hand-styled divs: `Button`/`buttonVariants` (also for links that look like buttons), `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Switch`, `Slider`, `Card` for settings sections, `Item` for list rows, `Badge`, `Avatar`, `Alert` for form errors, `Dialog`, `AlertDialog` for destructive confirmations, `DropdownMenu`, `Tabs`, `Tooltip` instead of `title`, `Progress`, `Separator`. Missing ones are added with `npx shadcn-svelte@latest add <name>`; then change `#lib/utils.js` imports to `#lib/utils.ts` and `/index.js` imports to `/index.ts`, and do not overwrite existing components. Only fall back to native elements when no shadcn component fits (e.g. hidden form inputs, `<video>`).
- Database: Drizzle schema in `src/lib/server/db/schema.ts`. After changing it, run `pnpm db:generate` and commit the migration in `apps/web/drizzle/`. Never edit generated migrations or `auth.schema.ts` by hand.
- One instance is one community (single row in `instance`); the first user to sign up becomes its owner. Clients will connect to several instances, each shown as a tab.
- Real-time updates use Server-Sent Events (`/api/channels/[id]/events`, `/api/conversations/[id]/events`, `/api/me/events`, `/api/voice/events`, all built with `src/lib/server/sse.ts`) fed by `src/lib/server/realtime.ts`; sending goes through form actions. Keep publish/subscribe behind that module so it can move to Valkey later.
- Permissions are a bigint bit mask (`src/lib/permissions.ts`); never reorder existing bits.
- Voice and video go through LiveKit; the app only issues tokens (`/api/livekit/token`). Media never passes through the SvelteKit server.

## Tests

- Unit tests: `*.spec.ts` / `*.test.ts` next to the code, run with `pnpm test:unit`.
- Component tests: `*.svelte.spec.ts`, run in a real browser through Vitest browser mode.
- End-to-end tests: `apps/web/e2e/*.e2e.ts` with Playwright, run with `pnpm test:e2e`. They need Postgres from `docker-compose.dev.yml`.
- New features come with tests. Run `pnpm lint`, `pnpm check` and `pnpm test` before committing.

## Svelte tooling

@AGENTS.md
