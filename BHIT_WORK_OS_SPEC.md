# BHIT Work OS – Build Spec (MVP)

0) Objectives (non-negotiable)
Role-based, mobile-first ops platform for installations & transport.

Fast login → dashboard; no financials for installers.

Simple flows for Today, Jobs, Job Detail, Close Day, Clients.

Background-safe media uploads; daily client report (PDF) generated from Close Day.

Languages for installer UI: en, es, pt, ro.

1) Stack + Baselines
Framework: Next.js 14 (App Router off; Pages Router on for speed).

Lang: TypeScript strict.

Auth/DB/Storage: Supabase (Postgres, Auth, Realtime, Storage).

Styling: TailwindCSS + CSS vars (dark).

PDF: server route using @react-pdf/renderer (or HTML → PDF fallback).

Email: SMTP (post-MVP toggle; for now preview only).

State: SWR + minimal local state.

I18n: JSON dictionary + helper hook.

Uploads: Supabase Storage bucket job-photos, with retry queue in client.

2) Repo Layout
/ (root)
  package.json
  tsconfig.json
  next.config.mjs
  postcss.config.cjs
  tailwind.config.cjs
  .env.example
  /public
    logo.svg
  /styles
    globals.css
  /lib
    supabaseClient.ts
    i18n.ts
    roles.ts
    pdf.tsx                 # React PDF components
    storage.ts              # upload helpers, retry queue
    email.ts                # stub; SMTP later
  /hooks
    useRequireAuth.ts
    useUserRole.ts
    useI18n.ts
  /components
    NavBar.tsx
    PageShell.tsx
    Card.tsx
    Table.tsx
    StatusPill.tsx
    Uploader.tsx
    FormRow.tsx
    LangSwitch.tsx
  /pages
    _app.tsx
    index.tsx               # redirect logic (to /login or /dashboard)
    login.tsx
    dashboard.tsx
    today.tsx
    jobs/index.tsx
    job/[id].tsx
    close-day/[id].tsx
    clients/index.tsx
    clients/new.tsx
    settings/index.tsx
    api/pdf/close-day.ts    # returns application/pdf
    api/upload/sign.ts      # (optional) signed URL proxy
  /i18n
    en.json  es.json  pt.json  ro.json
  /supabase
    schema.sql
    policies.sql
    seed.sql
3) Environment (.env.example)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# optional for email (post-MVP)
EMAIL_FROM="BHIT Reports <no-reply@bhit.uk>"
EMAIL_SMTP_URL=   # e.g. smtps://user:pass@smtp.yourhost:465
4) package.json (scripts + deps)
{
  "name": "bhit-work-os",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "dev:api": "node server.js",              // if separate API appears later
    "dev:all": "concurrently -n web,api -c green,blue \"npm run dev\" \"npm run dev:api\"",
    "db:push": "supabase db reset --include-seed"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "swr": "^2.2.5",
    "@react-pdf/renderer": "^3.4.0",
    "zod": "^3.23.8",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "tailwindcss": "^3.4.9",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "eslint": "^8.57.0",
    "@types/node": "^20.14.10",
    "@types/react": "^18.3.3",
    "concurrently": "^8.2.2"
  }
}
5) Supabase: Schema (MVP)
5.1 Tables
-- accounts: BHIT org rows (single row acceptable)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- users: maps auth.users.id -> account + role + lang
create table if not exists public.users (
  id uuid primary key,                      -- auth.users.id
  account_id uuid references public.accounts(id) on delete cascade,
  role text not null check (role in ('installer','supervisor','ops','director')),
  full_name text,
  lang text default 'en'
);

-- clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now()
);

-- jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  reference text not null,
  title text not null,
  address text,
  scheduled_date date,
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','issues')),
  percent_complete numeric default 0
);

-- tasks (per job)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  title text not null,
  is_done boolean default false,
  sort_order int default 0
);

-- crews & assignments
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  role text check (role in ('installer','supervisor'))
);

-- notes & photos
create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  storage_path text not null,              -- e.g. job-photos/{jobId}/{uuid}.jpg
  caption text,
  created_at timestamptz default now()
);

-- close day reports
create table if not exists public.day_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  supervisor_id uuid references public.users(id) on delete set null,
  completion numeric default 0,
  time_on_site_minutes int default 0,
  materials_used text,
  issues text,
  created_at timestamptz default now()
);
5.2 Storage
Bucket: job-photos (public read off; signed URLs used).

5.3 RLS (outline)
Enable RLS on all tables; policies:

users: a user can select his row; ops/director can select all.

jobs/tasks/notes/photos/day_reports:

installers/supervisors: select rows where they're assigned via assignments or job is scheduled for their crew.

ops/director: select/insert/update/delete all within account.

clients: view for ops/director; supervisors read; installers none.

(Full policy SQL can be added later; keep schema executable first.)

5.4 Seed (demo)
insert into public.accounts (id, name) values
  ('00000000-0000-0000-0000-000000000001','BHIT') on conflict do nothing;

-- Map existing auth user by email to users table (run manually replacing the email)
-- insert into public.users (id, account_id, role, full_name, lang)
-- select u.id, '00000000-0000-0000-0000-000000000001', 'director','Ben','en'
-- from auth.users u where u.email = 'ben.hone1987@gmail.com'
-- on conflict (id) do nothing;

insert into public.clients (account_id, name, contact_name, contact_email)
values ('00000000-0000-0000-0000-000000000001','Demo Client','Ops','ops@demo.local');

with c as (select id from public.clients where name='Demo Client' limit 1)
insert into public.jobs (account_id, client_id, reference, title, address, scheduled_date, status)
select '00000000-0000-0000-0000-000000000001', c.id, 'JOB-0001', 'Demo Install — 10 desks',
       'Unit 2, Park Lane, London', current_date, 'planned' from c;

with j as (select id from public.jobs where reference='JOB-0001')
insert into public.tasks (job_id, title, sort_order)
select j.id, t.title, t.idx from j,
  (values ('Unload & stage',1),('Assemble frames',2),('Fit tops',3),('Cable tidy',4),('Photos & signoff',5)) as t(title,idx);
6) UI/Routes (MVP exact)
6.1 /login
Email+password form.

On success → /dashboard.

Shows inline error.

Language switch (installer-facing strings switch).

6.2 Nav (hidden on /login)
Links:

/dashboard

/today

/jobs

/clients

/settings

Logout button

Visibility:

installer: Dashboard, Today, Jobs (read-only), Close Day for assigned jobs (via job detail link). No Clients/Settings. No £.

supervisor: plus Close Day, limited Clients view (read).

ops/director: all.

6.3 /dashboard
KPIs: Active jobs, Today, Overdue tasks, % complete avg.

Table: next 7 days jobs with status pill and link to detail.

6.4 /today
List jobs scheduled today.

Filter by crew, status.

Mark start / complete (supervisor or higher).

Quick link to Close Day for each job.

6.5 /jobs (index)
Search (reference/title/client).

Filters: status, date range.

Table: ref, title, client, date, status, progress.

6.6 /job/[id]
Header: ref, title, client, date, status, %.

Tabs: Tasks, Photos, Notes, Close Day.

Tasks: check/uncheck (role-based).

Photos: Uploader with retry; show grid.

Notes: add comment (realtime list).

Close Day tab → link to /close-day/[id].

6.7 /close-day/[id]
Form: completion %, time on site, materials, issues, photos (drag-drop).

Submit → insert day_reports, update job status/percent.

Preview PDF (Open in new tab via /api/pdf/close-day?id=...).

Email send (disabled until SMTP configured; show banner if no SMTP).

6.8 /clients
Table: client name, contact, jobs count.

New / Edit forms (ops/director).

6.9 /settings
Change password (link to Supabase reset flow).

Language selection for user.

Role/crew management (ops/director only).

7) Components (contracts)
NavBar.tsx
Props: none.
Behaviors:

Fetch current user email & role via Supabase.

Conditional links based on role.

Logout → supabase.auth.signOut() → /login.

PageShell.tsx
Standard page padding, max width, background.

Card.tsx, Table.tsx, StatusPill.tsx, FormRow.tsx
Pure presentation.

Uploader.tsx
Props: { jobId: string }.

Accepts camera/gallery (mobile).

Queue; retries with exponential backoff.

Store under job-photos/{jobId}/{uuid}.jpg.

Persist record to job_photos.

LangSwitch.tsx
Dropdown; writes to local storage + public.users.lang.

8) Hooks
useRequireAuth()
On mount: getSession; if none → /login.

useUserRole()
Load from public.users for current user; fallback installer.

useI18n()
Reads JSON dictionary by current lang; returns t(key, params?).

9) lib helpers
supabaseClient.ts
Standard createClient(url, anon).

roles.ts
export type Role = 'installer'|'supervisor'|'ops'|'director';
export const canSeeMoney = (r:Role) => r==='ops'||r==='director';
export const canEditTasks = (r:Role) => r!=='installer' ? true : false;
export const canSubmitCloseDay = (r:Role) => r==='supervisor'||r==='ops'||r==='director';

storage.ts
uploadJobPhoto(file, jobId): Promise<{path:string}> with retry & progress.

getSignedUrl(path, expires=3600).

pdf.tsx
React PDF document for Close Day: header (client/job/date), sections (completion, issues, materials, thumbnails).

email.ts
sendReportEmail({to, subject, html, pdfBuffer}) → no-op if EMAIL_SMTP_URL missing; return stub.

10) API Routes
GET /api/pdf/close-day?id=UUID
Validate user's access to job.

Query last day_reports for job + photos.

Render PDF; set Content-Type: application/pdf.

(optional) POST /api/upload/sign
If using signed URL flow instead of direct SDK.

11) I18n Keys (subset)
/i18n/en.json
{
  "login.title": "Sign in",
  "login.email": "Email",
  "login.password": "Password",
  "nav.dashboard": "Dashboard",
  "nav.today": "Today",
  "nav.jobs": "Jobs",
  "nav.clients": "Clients",
  "nav.settings": "Settings",
  "closeDay.title": "Close Day Report",
  "closeDay.completion": "Completion %",
  "closeDay.timeOnSite": "Time on site (min)",
  "closeDay.materials": "Materials used",
  "closeDay.issues": "Issues / Snags",
  "actions.save": "Save",
  "actions.submit": "Submit",
  "actions.logout": "Logout"
}
Duplicate for es.json, pt.json, ro.json (initially mirrors en).

12) Styling
Tailwind base + custom CSS vars:

--bg:#0b0f14, --panel:#121923, --border:#1d2733, --text:#e8eef6, --muted:#9fb2c8, --accent:#22d3ee.

13) Implementation Order (agent queue)
Bootstrap Next + Tailwind + deps; create env; supabase client.

Auth pages (/login) + redirect /.

Nav + role visibility.

Pages shells: Dashboard, Today, Jobs, Job, Close Day, Clients, Settings.

DB schema + seed; connect SWR queries.

Job Detail (tasks/notes/photos).

Close Day form → day_reports; PDF preview API.

Today view + filters.

Clients CRUD (ops/director).

I18n minimal set; LangSwitch.

Background upload queue; signed URLs.

Realtime: subscribe to tasks/notes/photos for current job.

14) Acceptance Criteria (MVP)
✅ Login with valid user redirects to /dashboard.

✅ Nav links present/hidden by role; Logout works.

✅ /jobs lists jobs with filters; clicking opens /job/[id].

✅ Task toggle persists; notes/photos create records; photos viewable.

✅ /close-day/[id] submits report; PDF preview downloads; job status/percent updated.

✅ Today page shows today's scheduled jobs; filter by crew.

✅ Installers never see £ or admin pages.

✅ Installer UI available in en/es/pt/ro (switchable).

✅ Background photo upload survives tab switches/loss of network.

15) Risk Controls / Guardrails
No Service Role in client; only ANON used.

RLS policies minimum viable; tighten post-MVP.

Email sending behind env flag; show banner if off.

PDF route rejects unauthorized users.

Storage paths scoped by job_id; signed URL lifespan short.
