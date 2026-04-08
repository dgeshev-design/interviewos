-- ================================================================
-- Add form_fields + published_forms tables
-- Run this in Supabase → SQL Editor (safe to run on existing DB)
-- ================================================================

create extension if not exists "uuid-ossp";

-- Intake form fields (drag-and-drop builder)
create table if not exists form_fields (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  label         text not null default '',
  field_type    text not null default 'text',
  required      boolean not null default false,
  options       text[] default '{}',
  position      integer not null default 0,
  created_at    timestamptz default now()
);

-- Published intake form (shareable link + style config)
create table if not exists published_forms (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  style_config  jsonb not null default '{}',
  created_at    timestamptz default now(),
  unique(workspace_id)
);

-- Enable RLS
alter table form_fields     enable row level security;
alter table published_forms enable row level security;

-- Policies (drop first to avoid duplicate errors)
drop policy if exists "own_form_fields"       on form_fields;
drop policy if exists "own_pub_forms"         on published_forms;
drop policy if exists "public_read_pub_forms" on published_forms;

create policy "own_form_fields"
  on form_fields for all
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_pub_forms"
  on published_forms for all
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- Public form page needs to read published_forms by id (no auth)
create policy "public_read_pub_forms"
  on published_forms for select
  using (true);
