--
-- This SQL file defines the core tables, relationships and Row‑Level
-- Security (RLS) policies for the InsTech MVP with fixed authentication flow.

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

create policy "Users: self read" on public.users
    for select using (auth.uid() = id);

create policy "Users: self insert" on public.users
    for insert with check (auth.uid() = id);

create policy "Users: self update" on public.users
    for update using (auth.uid() = id);

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
    status text not null default 'pending' check (status in ('pending','in_progress','complete')),
    auto_assign boolean not null default false,
    po_number text  -- separate SO/PO number for project
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


-- Projects: any member of the project can see it; authenticated users can insert their first project
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
            select 1 from public.users u where u.id = auth.uid()
        )
    );

create policy "projects update" on public.projects
    for update using (
        created_by = auth.uid()
    );

create policy "project_members read" on public.project_members
    for select using (
        user_id = auth.uid()
    );

create policy "project_members insert" on public.project_members
    for insert with check (
        user_id = auth.uid() and role = 'admin' and exists (
            select 1 from public.projects p 
            where p.id = project_id and p.created_by = auth.uid()
        )
    );

create policy "project_members delete" on public.project_members
    for delete using (
        user_id = auth.uid()
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


grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.floor_plans to authenticated;
grant select, insert, update, delete on public.pins to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.pin_products to authenticated;
grant select, insert, update, delete on public.snags to authenticated;
grant select, insert, update, delete on public.documents to authenticated;

grant usage on all sequences in schema public to authenticated;

grant execute on all functions in schema public to authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_confirmed_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.users (id, role, created_at, updated_at)
    VALUES (
      NEW.id, 
      'admin', 
      NEW.created_at, 
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_confirmed_user();

-- Storage buckets used by the application:
-- * floorplans – stores uploaded floor plan images
-- * pinphotos  – stores photos attached to individual pins

SELECT 'New schema with fixed authentication flow created successfully!' as status;
