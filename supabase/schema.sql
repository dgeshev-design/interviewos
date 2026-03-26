-- ================================================================
-- InterviewOS — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ================================================================

create extension if not exists "uuid-ossp";

-- ── Workspaces (one per user, fully isolated) ─────────────
create table workspaces (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'My Workspace',
  created_at timestamptz default now(),
  unique(user_id)
);

-- ── Participants ──────────────────────────────────────────
create table participants (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  age_group    text,
  location     text,
  status       text not null default 'booked'
                 check (status in ('booked','completed','no-show')),
  booked_at    timestamptz,
  meet_link    text,
  notes        text default '',
  form_data    jsonb default '{}',
  created_at   timestamptz default now()
);

-- ── Intake form fields ────────────────────────────────────
create table form_fields (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label        text not null,
  field_type   text not null default 'text'
                 check (field_type in ('text','email','tel','number','textarea','select')),
  required     boolean default false,
  options      text[] default '{}',
  position     integer not null default 0,
  created_at   timestamptz default now()
);

-- ── Interview questions ───────────────────────────────────
create table questions (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  level        text not null check (level in ('L1','L2','L3')),
  body         text not null,
  position     integer not null default 0,
  created_at   timestamptz default now()
);

-- ── Interview sessions ────────────────────────────────────
create table sessions (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  started_at     timestamptz default now(),
  ended_at       timestamptz,
  summary        text default '',
  notes          jsonb default '{}',
  done_questions uuid[] default '{}'
);

-- ── Comms templates ───────────────────────────────────────
create table templates (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  name           text not null,
  channel        text not null check (channel in ('email','sms','whatsapp')),
  subject        text default '',
  body           text not null default '',
  trigger_offset integer default 0,
  created_at     timestamptz default now()
);

-- ── Send log ──────────────────────────────────────────────
create table send_log (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  template_id    uuid references templates(id) on delete set null,
  participant_id uuid references participants(id) on delete set null,
  channel        text not null,
  status         text not null default 'sent' check (status in ('sent','failed')),
  error          text,
  sent_at        timestamptz default now()
);

-- ── Research briefs (uploaded docs) ──────────────────────
create table briefs (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  filename       text not null,
  raw_text       text not null,
  generated_qs   jsonb default '[]',
  applied        boolean default false,
  created_at     timestamptz default now()
);

-- ================================================================
-- Row Level Security — users only see their own workspace data
-- ================================================================

alter table workspaces   enable row level security;
alter table participants enable row level security;
alter table form_fields  enable row level security;
alter table questions    enable row level security;
alter table sessions     enable row level security;
alter table templates    enable row level security;
alter table send_log     enable row level security;
alter table briefs       enable row level security;

create policy "own_workspace"   on workspaces   for all using (auth.uid() = user_id);

create policy "own_participants" on participants for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_form_fields" on form_fields for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_questions"   on questions   for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_sessions"    on sessions    for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_templates"   on templates   for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_send_log"    on send_log    for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "own_briefs"      on briefs      for all using (
  workspace_id in (select id from workspaces where user_id = auth.uid()));

-- ================================================================
-- Storage bucket for uploaded brief files
-- ================================================================
insert into storage.buckets (id, name, public)
  values ('briefs', 'briefs', false)
  on conflict do nothing;

create policy "briefs_storage_owner" on storage.objects
  for all using (
    bucket_id = 'briefs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
