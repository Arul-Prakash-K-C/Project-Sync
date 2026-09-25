# TeamForge

Team finder and collaboration platform for university capstone projects. Students form teams on an explainable compatibility score and run their project in one workspace. Faculty mentor and approve proposals, set milestones, take meeting attendance and review weekly progress. Administrators manage accounts and departments.

Built with SvelteKit 2 (Svelte 5 runes), Tailwind CSS v4, three.js and Supabase.

## Quick start

```sh
npm install
npm run dev
```

Open http://localhost:5173. With no configuration the app runs in **local mode**: all data lives in your browser, seeded with demo content. Sign in with any demo profile (all use the password `demo1234`):

| Role    | Email                  |
| ------- | ---------------------- |
| Student | `alex@teamforge.edu`   |
| Faculty | `evelyn@teamforge.edu` |
| Faculty | `julian@teamforge.edu` |
| Admin   | `admin@teamforge.edu`  |

## Scripts

| Command                    | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Dev server with hot reload                                     |
| `npm run check`            | Type-check (`svelte-check`)                                    |
| `npm test`                 | Unit tests, plus the database security tests (on PGlite)       |
| `npm run build`            | Static production build into `build/`                          |
| `npm run preview`          | Serve the production build locally                             |
| `npm run supabase:link`    | Link this folder to your Supabase project                      |
| `npm run db:push`          | Apply `supabase/migrations` to the linked project              |
| `npm run functions:deploy` | Deploy the notification-email Edge Function                    |

## Local mode vs cloud mode

|                     | Local mode (default)                  | Cloud mode (Supabase)                                   |
| ------------------- | ------------------------------------- | ------------------------------------------------------- |
| Data                | `localStorage` in one browser         | Postgres, realtime across users and devices             |
| Sign-in             | PBKDF2 password hashes in the browser | Supabase Auth                                           |
| Files               | IndexedDB                             | Supabase Storage (`project-files` bucket)               |
| Access control      | Client-side route guards              | Row Level Security, guard triggers, validated functions |
| Brute-force defence | Client lockout (5 attempts, 60 s)     | The same, plus Supabase Auth rate limits                |
| Email notifications | None                                  | Edge Function + Resend (optional)                       |

Both modes use the same code. Pages call a synchronous `db` service; in cloud mode `src/lib/services/cloudSync.ts` loads each table into that service's cache, keeps it current through Realtime, and writes every save back as row inserts, updates and deletes.

### Database design

Each collection is a table with its record in a `data jsonb` column. The fields the security policies need (project, owner, role, member ids and so on) are generated columns that Postgres derives from `data`, so a client can't send forged values for them. The schema, policies and functions are all in [`supabase/migrations`](supabase/migrations). [`supabase/tests/rls.test.ts`](supabase/tests/rls.test.ts) runs that migration on PGlite (in-process Postgres) and checks the rules by acting as different users. It runs as part of `npm test`.

### Switching to cloud mode

1. Create a project at [supabase.com](https://supabase.com).
2. Link it and apply the schema:

   ```sh
   npx supabase login
   npm run supabase:link      # pick your project
   npm run db:push
   ```

3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. In **Authentication → URL Configuration**, set the Site URL to your app's URL and add `<your-url>/auth` as a redirect URL.
5. Decide who may self-register as staff. Run this in the SQL editor:

   ```sql
   update app_config set value = '{
     "adminEmails": ["you@university.edu"],
     "facultyEmails": [],
     "allowFacultySignup": false,
     "allowDemoSeed": false
   }' where key = 'bootstrap';
   ```

   Only emails in `adminEmails` can register as admin. Faculty can self-register only if they're listed in `facultyEmails` or `allowFacultySignup` is true. Students can always register.
6. Deploy. The app is a static single-page app, so the host must send every route to `index.html`.
   - **Vercel:** the repository root has a `vercel.json` that installs and builds inside `TeamForge/` and handles that routing. Leave the Vercel project's **Root Directory** at the repository root. Under Settings → Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; they're read at build time, so redeploy after adding them. Then add the Vercel URL to Supabase (Authentication → URL Configuration): set it as the Site URL, and add `<vercel-url>/auth` as a redirect URL.
   - **Other hosts:** run `npm run build` and serve the `build/` folder with a fallback to `index.html`.

The first person to sign in seeds the department list, which happens only once.

**Demo deployment** (sample projects plus working demo logins): set `VITE_SUPABASE_SEED_DEMO=true`, set `allowDemoSeed: true` in `bootstrap`, and turn off **Confirm email** under Authentication → Providers → Email.

**Email confirmation:** with **Confirm email** on (the Supabase default), a new account shows "check your inbox". The profile is created on the first sign-in after the link is clicked, and the role is validated on the server at that point.

**Email notifications:** deploy the function (`npm run functions:deploy`), set its secrets (`npx supabase secrets set RESEND_API_KEY=… MAIL_FROM="TeamForge <noreply@…>" APP_URL=https://… WEBHOOK_SECRET=…`), then create a Database Webhook on `public.notifications` for `INSERT` events that calls the `notification-email` function and sends the header `x-webhook-secret`. Full instructions are at the top of [`supabase/functions/notification-email/index.ts`](supabase/functions/notification-email/index.ts).

## Project layout

```
src/
  lib/
    actions/motion.ts          scroll reveal and pointer tilt
    components/three/          ForgeScene, the interactive 3D constellation
    components/ui/             design-system primitives (incl. SkillInput)
    supabase/                  config (env) and lazy SDK client
    services/db.ts             data models and the synchronous data service
    services/cloudSync.ts      Supabase mirror (cloud mode only)
    services/syncDiff.ts       pure diff and row-shaping helpers
    services/fileStorage.ts    file bytes: IndexedDB or Supabase Storage
    stores/auth.svelte.ts      sessions, local and Supabase sign-in
    stores/sync.svelte.ts      connection status for the UI
    utils/                     password hashing, rate limiter, CSV/PDF export
  routes/
    +page.svelte               landing page
    auth/                      sign in / register
    (dashboard)/dashboard/     student, faculty and admin areas
supabase/
  config.toml                  local CLI / auth settings
  migrations/                  schema, RLS policies, triggers, functions, storage
  functions/notification-email Edge Function that emails notifications
  tests/rls.test.ts            security tests on PGlite
```

See [PIPELINE.md](PIPELINE.md) for the architecture notes and change history.
