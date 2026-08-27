# Upcheck admin — farmer feedback inbox

Internal staff tool for the reports farmers send from the app
(**Settings → Report a problem**, and the same row inside Help & Support).
List, filter by status, read the report and its photos, set a status, and
write or edit the reply the farmer sees in the app.

Next.js App Router, TypeScript, no UI framework, no client-side JavaScript
worth speaking of. It is a support inbox, not a product.

## How it talks to the API

Every call goes through `src/lib/feedback.ts`, which starts with
`import 'server-only'` — importing it from a Client Component is a **build
error**. That is the guarantee that `ADMIN_API_KEY` never reaches a browser
bundle. The backend endpoints (`/api/admin/feedback*`) are guarded by
`AdminKeyGuard`, which checks the `x-admin-key` header in constant time and
denies everything when the key is unset.

Do not add `NEXT_PUBLIC_` to either variable.

## Environment variables

| Variable | Where | Value |
| --- | --- | --- |
| `UPCHECK_API_URL` | Vercel (this project) | `https://api.upcheck.in/api` — the API root **including** `/api`, no trailing slash |
| `ADMIN_API_KEY` | Vercel (this project) **and** Render (the backend) | The same long random string in both places |

Generate the key once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Then set it in **both**:

- Render → `upcheck-backend` → Environment → `ADMIN_API_KEY`
  (the backend denies every admin request until this exists — that is
  deliberate, a forgotten variable must not open the inbox)
- Vercel → this project → Settings → Environment Variables →
  `ADMIN_API_KEY` and `UPCHECK_API_URL`, for Production and Preview

Rotating the key means changing it in both places; there is a brief window
where the dashboard 401s, which is fine for an internal tool.

## Local development

```bash
cd admin
npm install
cat > .env.local <<'EOF'
UPCHECK_API_URL=http://localhost:8080/api
ADMIN_API_KEY=whatever-you-set-in-the-backend-env
EOF
npm run dev          # http://localhost:3000
```

`.env.local` is gitignored. Never commit a real key.

## Deploying to Vercel

```bash
cd admin
vercel link          # create/link a NEW project, do not reuse the app's
vercel env add ADMIN_API_KEY production
vercel env add UPCHECK_API_URL production
vercel --prod
```

Or from the Vercel dashboard: **Add New → Project → import
`Upcheck-India/Upcheckapp` → set Root Directory to `admin`**, add the two
environment variables, deploy. Framework preset is detected as Next.js;
build command and output directory are the defaults.

**Put it behind access control.** There is no login screen here — anyone with
the URL sees every farmer's report. Use Vercel Authentication (Project →
Settings → Deployment Protection → Vercel Authentication: *Standard
Protection*) so only your Vercel team members can open it. The shared key
protects the API; deployment protection protects the page.

CORS on the backend does not need changing: every request is made server-side
by Vercel, so no browser Origin is involved.

## Backend prerequisites

1. **Run the migration.** `migrationsRun` is `false`, so it does not apply
   itself:
   ```bash
   cd backend
   DATABASE_URL="<direct/session URL, port 5432>" npm run migration:run
   ```
   Until it runs, the inbox correctly shows an empty list rather than a 500
   (`AddFeedbackReports1780400000000`).

2. **Create the Storage bucket.** Private, images only, 5 MB cap. In the
   Supabase SQL editor:
   ```sql
   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('feedback-attachments', 'feedback-attachments', false, 5242880,
           array['image/jpeg','image/png','image/webp','image/heic'])
   on conflict (id) do nothing;
   ```
   No RLS policy is needed — the backend reaches it with the service-role key
   and signs short-lived URLs on read. A public bucket would make every
   farmer's photo a permanent public link.

## Status vocabulary

`new → seen → in_review → done`, plus `closed` for "deliberately not acting on
this". Defined once in `backend/src/feedback/feedback-status.ts`; this app and
the mobile app each carry a copy of the union, so change all three together.
