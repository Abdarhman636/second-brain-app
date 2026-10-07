-- =============================================================================
-- Rusookh — database schema
--
-- Run once in the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.
--
-- Every table carries user_id and is protected by Row Level Security, so a
-- signed-in user can only ever read or change their own rows.
-- =============================================================================

-- ---------- Shared: keep updated_at current -----------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Shelves ----------------------------------------------------------
-- A named group of projects, e.g. "كتب" with one project per book.

create table if not exists public.shelves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shelves_user_id_idx on public.shelves (user_id);

drop trigger if exists shelves_set_updated_at on public.shelves;
create trigger shelves_set_updated_at before update on public.shelves
  for each row execute function public.set_updated_at();

-- ---------- Projects ---------------------------------------------------------

create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  type              text not null check (type in ('book', 'podcast', 'course', 'curriculum', 'topic', 'skill', 'personal', 'other')),
  custom_type_label text check (custom_type_label is null or char_length(custom_type_label) <= 30),
  color             text not null,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);

-- Added with shelves. Deleting a shelf keeps its projects, on no shelf.
alter table public.projects
  add column if not exists shelf_id uuid references public.shelves (id) on delete set null;

create index if not exists projects_shelf_id_idx on public.projects (shelf_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------- Cards ------------------------------------------------------------

create table if not exists public.cards (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id         uuid not null references public.projects (id) on delete cascade,
  type               text not null check (type in ('note', 'qa', 'quote', 'definition', 'image')),
  -- Shape depends on type, e.g. {"question": "...", "answer": "..."}.
  -- Image cards store {"title": "...", "imageUrl": "storage:<path>"}.
  content            jsonb not null,
  review_stage       smallint not null default 0 check (review_stage between 0 and 6),
  next_review_date   date not null,
  last_reviewed_at   date,
  last_review_result text check (last_review_result in ('remembered', 'forgot')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists cards_user_due_idx on public.cards (user_id, next_review_date);
create index if not exists cards_project_id_idx on public.cards (project_id);

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------- Review log --------------------------------------------------------
-- No foreign key to cards on purpose: the history (and the streak, which
-- reads due dates from it) outlives deleted cards.

create table if not exists public.review_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id     uuid not null,
  result      text not null check (result in ('remembered', 'forgot')),
  date        date not null,
  due_date    date not null,
  reviewed_at timestamptz not null default now()
);

create index if not exists review_log_user_date_idx on public.review_log (user_id, date);

-- ---------- Streak: completed days -------------------------------------------

create table if not exists public.completed_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date    date not null,
  primary key (user_id, date)
);

-- ---------- Vacations ---------------------------------------------------------

create table if not exists public.vacations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date   date,
  check (end_date is null or end_date >= start_date)
);

create index if not exists vacations_user_id_idx on public.vacations (user_id);
-- At most one vacation running at a time.
create unique index if not exists vacations_one_active_idx on public.vacations (user_id) where end_date is null;

-- ---------- Row Level Security -------------------------------------------------
-- Enabled explicitly per table (the dashboard's safety check looks for these
-- statements), then one "own rows only" policy per table below.

alter table public.shelves        enable row level security;
alter table public.projects       enable row level security;
alter table public.cards          enable row level security;
alter table public.review_log     enable row level security;
alter table public.completed_days enable row level security;
alter table public.vacations      enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['shelves', 'projects', 'cards', 'review_log', 'completed_days', 'vacations'] loop
    execute format('drop policy if exists "Own rows only" on public.%I', table_name);
    execute format(
      'create policy "Own rows only" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$$;

-- A card can only point at one of its owner's projects.
create or replace function public.check_card_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'Project does not belong to this user';
  end if;
  return new;
end;
$$;

drop trigger if exists cards_check_project_owner on public.cards;
create trigger cards_check_project_owner before insert or update of project_id, user_id on public.cards
  for each row execute function public.check_card_project_owner();

-- A project can only sit on one of its owner's shelves.
create or replace function public.check_project_shelf_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.shelf_id is not null
     and not exists (select 1 from public.shelves s where s.id = new.shelf_id and s.user_id = new.user_id) then
    raise exception 'Shelf does not belong to this user';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_check_shelf_owner on public.projects;
create trigger projects_check_shelf_owner before insert or update of shelf_id, user_id on public.projects
  for each row execute function public.check_project_shelf_owner();

-- ---------- Storage: card images ----------------------------------------------
-- Private bucket; each user reads and writes only under "<their user id>/...".
-- The app shows images through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Card images: own folder" on storage.objects;
create policy "Card images: own folder" on storage.objects for all to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
