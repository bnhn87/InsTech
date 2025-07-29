-- InsTech MVP Supabase Schema
--
-- This SQL file defines the core tables, relationships and Row‑Level
-- Security (RLS) policies for the InsTech MVP.  You should run it
-- in the Supabase SQL editor **once** after creating your project.  It
-- creates the necessary database structure for storing projects,
-- users, floor plans, pins, products, snags and documents.  Adjust
-- constraints and policies according to your business needs.

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Users table
-- Although Supabase provides an `auth.users` table for authentication,
-- we create an additional `users` table to store role, phone number
-- and other profile fields.  Its primary key matches `auth.users.id`.
create table if not exists public.users (
    id uuid primary key default auth.uid(),
    full_name text,
    phone text,
    role text not null check (role in ('installer','supervisor','admin')),
    labour_token uuid not null default uuid_generate_v4(),
    language text not null default 'en',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Allow users to see only their own record
create policy "Users: self read" on public.users
    for select using (auth.uid() = id);

-- Projects
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    reference text,
    start_date date,
    start_time time,
    duration integer, -- duration in hours
    site_address text,
    loading_bay_details text,
    lift_details text,
    uplift_via_stairs boolean default false,
    labour_required integer,
    equipment_needed text[],
    project_manager_name text,
    project_manager_phone text,
    site_manager_name text,
    site_manager_phone text,
    client_contact_name text,
    client_contact_phone text,
    wo_url text, -- Work order / delivery note file
    rams_url text, -- RAMS file
    created_by uuid not null references public.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'pending' check (status in ('pending','in_progress','complete'))
    ,auto_assign boolean not null default false
    ,po_number text  -- separate SO/PO number for project
);

alter table public.projects enable row level security;

-- Link users to projects and define their role on that project
create table if not exists public.project_members (
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    role text not null check (role in ('installer','supervisor','admin')),
    primary key (project_id, user_id)
);

alter table public.project_members enable row level security;

-- Floor plans uploaded for projects
create table if not exists public.floor_plans (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects (id) on delete cascade,
    file_url text not null,
    uploaded_by uuid references public.users(id),
    created_at timestamptz not null default now()
);

alter table public.floor_plans enable row level security;

-- Pins on floor plans
create table if not exists public.pins (
    id uuid primary key default uuid_generate_v4(),
    floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,
    x_coord numeric(5,4) not null check (x_coord >= 0 and x_coord <= 1),
    y_coord numeric(5,4) not null check (y_coord >= 0 and y_coord <= 1),
    status text not null check (status in ('complete','damage','snag','missing')),
    photo_url text,
    comment text,
    label text,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.pins enable row level security;

-- Work order products parsed from the delivery note
create table if not exists public.products (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    code text,
    name text,
    quantity integer not null,
    assigned boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Join table assigning products to pins (one product line can appear on many pins)
create table if not exists public.pin_products (
    pin_id uuid not null references public.pins(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    primary key (pin_id, product_id)
);

alter table public.pin_products enable row level security;

-- Snags / unresolved items.  When a project has outstanding snags at completion, a new project should be created and the unresolved pins copied over.
create table if not exists public.snags (
    id uuid primary key default uuid_generate_v4(),
    parent_project_id uuid not null references public.projects(id) on delete cascade,
    description text,
    created_by uuid references public.users(id),
    resolved boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.snags enable row level security;

-- ---------------------------------------------------------------------------
-- Extended functionality tables
--
-- The following tables add support for task management, markup shapes,
-- document versioning, customizable forms and per‑user feature toggles.  They are
-- designed to complement the core InsTech schema without breaking existing
-- references.  You can selectively enable these tables as needed by your
-- organization.

-- Tasks associated with projects or specific pins.  Tasks can represent
-- punch‑list items, QA/QC issues or general to‑dos.  They support
-- categorisation, prioritisation and assignment to a user.  Attachments are
-- handled via the public.documents table.
create table if not exists public.tasks (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    pin_id uuid references public.pins(id) on delete set null,
    title text not null,
    description text,
    priority text not null default 'P3' check (priority in ('P1','P2','P3')),
    status text not null default 'open' check (status in ('open','in_progress','completed','verified')),
    assignee_id uuid references public.users(id),
    category text,
    tags text[],
    start_date date,
    due_date date,
    manpower_estimate numeric,
    cost_estimate numeric,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- Markup shapes drawn on floor plans.  A markup can be a rectangle, circle,
-- freehand line or polygon.  Coordinates are stored as JSON arrays of
-- normalised (0‑1) points relative to the underlying plan image.  Markups
-- support custom colours and optional labels/comments.
create table if not exists public.markups (
    id uuid primary key default uuid_generate_v4(),
    floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,
    type text not null check (type in ('rectangle','circle','line','polyline')),
    coordinates jsonb not null,
    color text not null default '#FF0000',
    label text,
    comment text,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.markups enable row level security;

-- Versioned floor plan files.  Whenever a new plan is uploaded for a project
-- version, create a new record here.  The highest version number is
-- considered the current plan.  Old versions remain accessible for audit
-- purposes.
create table if not exists public.floor_plan_versions (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    version_number integer not null,
    file_url text not null,
    uploaded_by uuid references public.users(id),
    created_at timestamptz not null default now()
);

alter table public.floor_plan_versions enable row level security;

-- Customisable form templates.  A form defines a reusable set of fields stored
-- as JSON (for example, RAMS checklists, sign‑off sheets).  Forms belong
-- either to the organisation or a specific project (project_id can be null).
create table if not exists public.forms (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade,
    name text not null,
    schema jsonb not null,
    created_by uuid references public.users(id),
    created_at timestamptz not null default now()
);

alter table public.forms enable row level security;

-- Captured form responses.  Each response stores JSON data matching the
-- associated form schema.  Responses are linked to a project and the user
-- submitting it.  Additional metadata can be stored in the data JSON.
create table if not exists public.form_responses (
    id uuid primary key default uuid_generate_v4(),
    form_id uuid not null references public.forms(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    submitted_by uuid references public.users(id),
    data jsonb not null,
    created_at timestamptz not null default now()
);

alter table public.form_responses enable row level security;

-- Per‑user feature toggles.  Use this table to enable or disable optional
-- features for specific users (e.g. AI assistance, measurement tool).  If a
-- record exists with is_enabled = false, the feature should be hidden.  If no
-- record exists, the default behaviour is enabled.
create table if not exists public.feature_toggles (
    user_id uuid not null references public.users(id) on delete cascade,
    feature_name text not null,
    is_enabled boolean not null default true,
    primary key (user_id, feature_name)
);

alter table public.feature_toggles enable row level security;

-- Row Level Security policies for extended tables

-- Tasks: any member of the project can read; members can insert tasks; only
-- supervisors and admins may update or delete tasks.  Adjust as needed.
create policy "tasks read" on public.tasks
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = tasks.project_id and pm.user_id = auth.uid()
        )
    );

create policy "tasks insert" on public.tasks
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = tasks.project_id and pm.user_id = auth.uid()
        )
    );

create policy "tasks update" on public.tasks
    for update using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

create policy "tasks delete" on public.tasks
    for delete using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = tasks.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

-- Markups: any member of the project can read, insert or update their own
-- markups.  Deletion and updates are restricted to the creator or project
-- supervisors/admins.
create policy "markups read" on public.markups
    for select using (
        exists (
            select 1 from public.floor_plans fp
            join public.project_members pm on fp.project_id = pm.project_id
            where fp.id = markups.floor_plan_id and pm.user_id = auth.uid()
        )
    );

create policy "markups insert" on public.markups
    for insert with check (
        exists (
            select 1 from public.floor_plans fp
            join public.project_members pm on fp.project_id = pm.project_id
            where fp.id = markups.floor_plan_id and pm.user_id = auth.uid()
        )
    );

create policy "markups update" on public.markups
    for update using (
        (created_by = auth.uid()) OR (
            exists (
                select 1 from public.floor_plans fp
                join public.project_members pm on fp.project_id = pm.project_id
                where fp.id = markups.floor_plan_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
            )
        )
    );

create policy "markups delete" on public.markups
    for delete using (
        (created_by = auth.uid()) OR (
            exists (
                select 1 from public.floor_plans fp
                join public.project_members pm on fp.project_id = pm.project_id
                where fp.id = markups.floor_plan_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
            )
        )
    );

-- Floor plan versions: any member can read versions; supervisors and admins
-- insert new versions.
create policy "floor_plan_versions read" on public.floor_plan_versions
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = floor_plan_versions.project_id and pm.user_id = auth.uid()
        )
    );

create policy "floor_plan_versions insert" on public.floor_plan_versions
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = floor_plan_versions.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

-- Forms: any member can read project‑specific forms; admins can create forms; update and delete restricted to admins.
create policy "forms read" on public.forms
    for select using (
        (project_id is null) OR (
            exists (
                select 1 from public.project_members pm
                where pm.project_id = forms.project_id and pm.user_id = auth.uid()
            )
        )
    );

create policy "forms insert" on public.forms
    for insert with check (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "forms update" on public.forms
    for update using (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "forms delete" on public.forms
    for delete using (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

-- Form responses: any project member can read responses for their project; any project member can submit responses; updates and deletions only by the submitter or admins.
create policy "form_responses read" on public.form_responses
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = form_responses.project_id and pm.user_id = auth.uid()
        )
    );

create policy "form_responses insert" on public.form_responses
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = form_responses.project_id and pm.user_id = auth.uid()
        )
    );

create policy "form_responses update" on public.form_responses
    for update using (
        (submitted_by = auth.uid()) OR (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

create policy "form_responses delete" on public.form_responses
    for delete using (
        (submitted_by = auth.uid()) OR (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

-- Feature toggles: users can see only their own toggles; admins can insert or update toggles for any user.  Users may update their own toggles.
create policy "feature_toggles read" on public.feature_toggles
    for select using (user_id = auth.uid() OR (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    ));

create policy "feature_toggles insert" on public.feature_toggles
    for insert with check (
        (user_id = auth.uid()) OR (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

create policy "feature_toggles update" on public.feature_toggles
    for update using (
        (user_id = auth.uid()) OR (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

create policy "feature_toggles delete" on public.feature_toggles
    for delete using (
        (user_id = auth.uid()) OR (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

-- Documents uploaded (WO/Delivery note, RAMS).  Files should be stored in a Supabase Storage bucket, and the URL recorded here.
create table if not exists public.documents (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    file_type text not null check (file_type in ('wo','rams')),
    file_url text not null,
    uploaded_by uuid references public.users(id),
    uploaded_at timestamptz not null default now()
);

alter table public.documents enable row level security;

-- Row Level Security Policies
-- These example policies show a simple pattern: allow read access to
-- any rows where the current user is a member of the project.  In a
-- production system you should refine these to fit your needs (e.g.
-- distinguishing between installer/supervisor/admin for update
-- permissions).

-- Projects: any member of the project can see it; only admins can insert/update/delete.
create policy "projects read" on public.projects
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
        )
    );

create policy "projects insert" on public.projects
    for insert with check (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "projects update" on public.projects
    for update using (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

-- Project members: only admins can assign members; any member can read their membership.
create policy "project_members read" on public.project_members
    for select using (
        user_id = auth.uid() or (
            exists (
                select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
            )
        )
    );

create policy "project_members insert" on public.project_members
    for insert with check (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "project_members delete" on public.project_members
    for delete using (
        exists (
            select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
        )
    );

-- Floor plans: any project member can read/write
create policy "floor_plans read" on public.floor_plans
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = floor_plans.project_id
              and pm.user_id = auth.uid()
        )
    );

create policy "floor_plans insert" on public.floor_plans
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = floor_plans.project_id
              and pm.user_id = auth.uid()
        )
    );

create policy "floor_plans update" on public.floor_plans
    for update using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = floor_plans.project_id
              and pm.user_id = auth.uid()
        )
    );

-- Pins: any member can read/write pins associated with their projects
create policy "pins read" on public.pins
    for select using (
        exists (
            select 1 from public.floor_plans fp
            join public.project_members pm on fp.project_id = pm.project_id
            where fp.id = pins.floor_plan_id and pm.user_id = auth.uid()
        )
    );

create policy "pins insert" on public.pins
    for insert with check (
        exists (
            select 1 from public.floor_plans fp
            join public.project_members pm on fp.project_id = pm.project_id
            where fp.id = pins.floor_plan_id and pm.user_id = auth.uid()
        )
    );

create policy "pins update" on public.pins
    for update using (
        exists (
            select 1 from public.floor_plans fp
            join public.project_members pm on fp.project_id = pm.project_id
            where fp.id = pins.floor_plan_id and pm.user_id = auth.uid()
        )
    );

-- Products: any member can read; only admins and supervisors can insert/update
create policy "products read" on public.products
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = products.project_id and pm.user_id = auth.uid()
        )
    );

create policy "products insert" on public.products
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = products.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

create policy "products update" on public.products
    for update using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = products.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

-- Pin products: same as pins (any member can assign)
create policy "pin_products read" on public.pin_products
    for select using (
        exists (
            select 1
            from public.pins p
            join public.floor_plans fp on p.floor_plan_id = fp.id
            join public.project_members pm on fp.project_id = pm.project_id
            where p.id = pin_products.pin_id and pm.user_id = auth.uid()
        )
    );

create policy "pin_products insert" on public.pin_products
    for insert with check (
        exists (
            select 1
            from public.pins p
            join public.floor_plans fp on p.floor_plan_id = fp.id
            join public.project_members pm on fp.project_id = pm.project_id
            where p.id = pin_products.pin_id and pm.user_id = auth.uid()
        )
    );

-- Snags: any project member can view/insert; only supervisors/admins can update
create policy "snags read" on public.snags
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = snags.parent_project_id and pm.user_id = auth.uid()
        )
    );

create policy "snags insert" on public.snags
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = snags.parent_project_id and pm.user_id = auth.uid()
        )
    );

create policy "snags update" on public.snags
    for update using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = snags.parent_project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

-- Documents: any member can read; only supervisors/admins can insert
create policy "documents read" on public.documents
    for select using (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = documents.project_id and pm.user_id = auth.uid()
        )
    );

create policy "documents insert" on public.documents
    for insert with check (
        exists (
            select 1 from public.project_members pm
            where pm.project_id = documents.project_id and pm.user_id = auth.uid() and pm.role in ('supervisor','admin')
        )
    );

-- Finally, revoke all default privileges to ensure RLS is enforced
revoke all on all tables in schema public from anon, authenticated;

-- Storage buckets used by the application:
-- * floorplans – stores uploaded floor plan images
-- * pinphotos  – stores photos attached to individual pins