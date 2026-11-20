# CONQUER GameSite — P0 implementation branch

**Branch:** `gamesite` · **Reference SRS:** [WEBSITE-SRS v0.3](../docs/WEBSITE-SRS.md) · **PR:** [#292 (draft)](https://github.com/erykwest/CONQUER/pull/292)

This is a **development implementation** of the P0 website and optional Guest singleplayer Builder entry. It is **not a production launch**.

## Entry points

- `/gamesite/` — English public website, responsive medieval-modern visual system.
- `/gamesite/game.html` — game pillars with honest development-state messaging.
- `/gamesite/media.html` — original CONQUER asset samples and on-demand real Builder preview, **not yet a promotional screenshot gallery**.
- `/gamesite/devlog/` — editorial index and permalink pages generated from `gamesite/content/devlog/*.md`. `status: draft` is never emitted.
- `/gamesite/follow.html` — double-opt-in subscriber form.
- `/gamesite/account.html` — email magic-link sign-in using the same existing Supabase Auth project as the game.
- `/gamesite/play.html` — WebGL2 check, link to `/index.html?launch=1`.
- `/index.html?launch=1` — **new** runtime entry with Guest (singleplayer) or optional account, seed/biome configuration, local save-slot resume.

The original `/index.html` development launch remains unchanged when `?launch=1` is omitted. Asset Lab and Camp modes must not show the public launcher.

## Setup — P0 dependencies

For a same-origin staging environment, serve the repository **from its root**, not only the `gamesite/` folder. GameSite pages and the Builder share a browser origin during this initial implementation; localStorage and the Supabase SDK session can thus share the same user identity without unsafe URL token handoffs.

Only `main` is configured for automatic production deployment via `vercel.json`. The branch does not publish itself. Create a deliberate staging deployment after passing the checks. If marketing and game are deployed on **separate origins**, replace the same-origin session assumption with an reviewed shared-session/SSO contract before claiming unified login.

The Follow form is inactive until the following are configured on the server (never commit secrets):

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | HTTPS production origin, used to validate request origin and generate confirmation links and sitemap |
| `SUPABASE_URL` | Supabase service API origin (currently follows the game project unless overridden) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access for subscribers and metrics. **Never put this in browser code** |
| `RESEND_API_KEY` | Transactional email API |
| `FOLLOW_FROM` | Verified mail sender |
| `FOLLOW_SIGNING_SECRET` | Long random secret for unsubscribe HMAC links |

Apply `supabase/gamesite-follow-schema.sql` to the correct **staging** database after security review. Do not silently modify production data during branch development. Confirm the provider's verified sender and Supabase allowed redirect URLs for both `/gamesite/account.html` and the runtime `/index.html?launch=1`.

**Privacy publication blockers:** provide the real data controller name, a contact address, data retention and processor details. `gamesite/privacy.html` is explicitly a **draft**, not a compliant final policy; do not activate email collection publicly before it is completed.

## Scope and release gates

| Area | Implemented in branch | Remaining gate |
|---|---|---|
| Public pages + responsive visuals | Yes | Real-device and WCAG review |
| Devlog and media | Static post and authentic assets | Markdown draft workflow, approved game screenshots/trailer |
| Guest Builder | Launcher, random/manual seed, biome and isolated local slots | Browser E2E, quota behavior and migration QA |
| Shared identity | Same Supabase Auth provider and publishable key on both clients | Validate magic-link redirect and cross-origin SSO if separated |
| Follow | API for confirm/unsubscribe, private SQL schema, form | Mail credentials, migration, GDPR details, end-to-end delivery |
| Analytics and SEO | Cookie-free aggregate endpoint and dynamic sitemap | Environment, canonical production domain and measurement verification |
| Independent distribution | Distinct source folders and launch paths | Versioned independent game/marketing deployments and rollback |

## Verification

`node --test qa/gamesite-regression.mjs` and syntax checks under `.github/workflows/gamesite.yml` run on the branch and draft PR. The repository's broader CI is still required before a release. Browser screenshot/performance and email delivery tests have **not** been performed in this task.

Never merge this branch to `main` or switch Vercel production routing merely to preview the website. Review the draft PR and deploy staging intentionally.
