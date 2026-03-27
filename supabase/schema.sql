-- ================================================================
-- InterviewOS v2 — Fresh Schema
-- Run this in Supabase → SQL Editor
-- WARNING: Drops all existing InterviewOS tables
-- ================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── Drop old tables (safe — cascades) ────────────────────────────
drop table if exists send_log           cascade;
drop table if exists briefs             cascade;
drop table if exists sessions           cascade;
drop table if exists slots              cascade;
drop table if exists availability_windows cascade;
drop table if exists published_forms    cascade;
drop table if exists form_fields        cascade;
drop table if exists templates          cascade;
drop table if exists questions          cascade;
drop table if exists google_tokens      cascade;
drop table if exists participants       cascade;
drop table if exists studies            cascade;
drop table if exists workspaces         cascade;

-- ── Workspaces ────────────────────────────────────────────────────
create table workspaces (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'My Workspace',
  allowed_domains text[] default '{"betty.com","uk.betty.com","playbetty.co.uk"}',
  settings     jsonb default '{}',
  created_at   timestamptz default now(),
  unique(user_id)
);

-- ── Google tokens (for Calendar API) ─────────────────────────────
create table google_tokens (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  expiry        timestamptz,
  email         text,
  updated_at    timestamptz default now(),
  unique(workspace_id)
);

-- ── Studies ───────────────────────────────────────────────────────
create table studies (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text default '',
  slug          text not null,                        -- used in public URL /s/:slug
  status        text not null default 'active'
                  check (status in ('draft','active','closed')),
  target_count  integer default 10,
  custom_fields jsonb default '[]',                   -- [{id, label, type, options}]
  created_at    timestamptz default now(),
  unique(workspace_id, slug)
);

-- ── Promo code pools (per study) ─────────────────────────────────
create table promo_codes (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  study_id      uuid references studies(id) on delete cascade,
  code          text not null,
  assigned_to   uuid,                                 -- participant_id once assigned
  assigned_at   timestamptz,
  created_at    timestamptz default now()
);

-- ── Participants ──────────────────────────────────────────────────
create table participants (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  study_id      uuid references studies(id) on delete set null,
  name          text not null,
  email         text,
  phone         text,
  age_group     text,
  location      text,
  status        text not null default 'booked'
                  check (status in ('booked','completed','no-show','disqualified','prize-granted')),
  tags          text[] default '{}',
  rating        integer check (rating between 1 and 5),
  summary       text default '',
  notes         text default '',                      -- rich text (HTML string)
  quotes        jsonb default '[]',                   -- [{id, text, tag, color}]
  custom_fields jsonb default '{}',                   -- {field_id: value}
  form_data     jsonb default '{}',
  promo_code    text default '',
  booked_at     timestamptz,
  meet_link     text default '',
  gcal_event_id text default '',
  created_at    timestamptz default now()
);

-- ── Participant files ─────────────────────────────────────────────
create table participant_files (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  file_type      text not null check (file_type in ('video','image','document','transcript')),
  filename       text not null,
  storage_path   text not null,                       -- Supabase storage path
  size_bytes     bigint,
  mime_type      text,
  created_at     timestamptz default now()
);

-- ── Forms (multiple per study) ────────────────────────────────────
create table forms (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  study_id      uuid not null references studies(id) on delete cascade,
  name          text not null default 'Intake Form',
  is_active     boolean default false,                -- only one active per study
  fields        jsonb default '[]',                   -- full field definitions with logic
  created_at    timestamptz default now()
);

-- ── Booking slots ─────────────────────────────────────────────────
create table slots (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  study_id         uuid references studies(id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  duration_minutes integer not null default 60,
  meet_link        text default '',
  gcal_event_id    text default '',
  available        boolean not null default true,
  is_gcal_block    boolean not null default false,    -- true = imported from GCal, not bookable
  participant_id   uuid references participants(id) on delete set null,
  created_at       timestamptz default now()
);

-- ── Availability windows ──────────────────────────────────────────
create table availability_windows (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  study_id         uuid references studies(id) on delete cascade,
  date_from        date not null,
  date_to          date not null,
  time_from        time not null,
  time_to          time not null,
  duration_minutes integer not null default 60,
  buffer_minutes   integer not null default 0,
  days_of_week     integer[] default '{1,2,3,4,5}',
  created_at       timestamptz default now()
);

-- ── Comms templates ───────────────────────────────────────────────
create table templates (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  name           text not null,
  trigger_type   text not null
                   check (trigger_type in (
                     'booking_confirmed','reminder_24h','reminder_3h',
                     'reminder_1h','reminder_5min','no_show','prize','custom'
                   )),
  channel        text not null check (channel in ('email','whatsapp','sms')),
  subject        text default '',
  body           text not null default '',
  is_html        boolean default false,
  trigger_offset integer default 0,                   -- minutes from session (negative = before)
  is_active      boolean default true,
  created_at     timestamptz default now()
);

-- ── Comms send log ────────────────────────────────────────────────
create table send_log (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  template_id    uuid references templates(id) on delete set null,
  channel        text not null,
  subject        text,
  body_preview   text,
  status         text not null default 'sent' check (status in ('sent','failed','pending')),
  error          text,
  sent_at        timestamptz default now()
);

-- ================================================================
-- Row Level Security
-- ================================================================

alter table workspaces         enable row level security;
alter table google_tokens      enable row level security;
alter table studies            enable row level security;
alter table promo_codes        enable row level security;
alter table participants       enable row level security;
alter table participant_files  enable row level security;
alter table forms              enable row level security;
alter table slots              enable row level security;
alter table availability_windows enable row level security;
alter table templates          enable row level security;
alter table send_log           enable row level security;

-- Owner policies (all tables scoped to workspace owner)
create policy "own_workspace"    on workspaces    for all using (auth.uid() = user_id);
create policy "own_gtokens"      on google_tokens for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_studies"      on studies       for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_promos"       on promo_codes   for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_participants" on participants  for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_files"        on participant_files for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_forms"        on forms         for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_slots"        on slots         for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_avail"        on availability_windows for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_templates"    on templates     for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "own_send_log"     on send_log      for all using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- Public read for booking pages (no auth)
create policy "public_read_studies" on studies
  for select using (status = 'active');

create policy "public_read_slots" on slots
  for select using (available = true and is_gcal_block = false);

create policy "public_read_forms" on forms
  for select using (is_active = true);

-- ================================================================
-- Supabase Storage buckets
-- ================================================================

insert into storage.buckets (id, name, public)
  values ('participant-files', 'participant-files', false)
  on conflict do nothing;

create policy "files_owner" on storage.objects
  for all using (
    bucket_id = 'participant-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
