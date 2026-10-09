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

-- ---------- Admins ---------------------------------------------------------------
-- An admin reviews payment requests. Admins are marked in app metadata, which
-- only the server can change. To make an account an admin (then sign in again):
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
--   where email = 'you@example.com';

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------- Subscriptions ---------------------------------------------------------
-- A paid plan and when it ends. No row (or an expired one) means the free plan.
-- Users can read their own; only admins (through set_payment_request_status, or
-- by hand) write them.
--
-- To give an account a plan by hand (e.g. for testing):
--   insert into public.subscriptions (user_id, plan, expires_at)
--   select id, 'plus', now() + interval '12 months' from auth.users where email = 'someone@example.com'
--   on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at;

create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('plus', 'pro')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Read own subscription" on public.subscriptions;
create policy "Read own subscription" on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Admins manage subscriptions" on public.subscriptions;
create policy "Admins manage subscriptions" on public.subscriptions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------- Payment requests --------------------------------------------------------
-- A student's transfer, waiting for an admin to check it against the bank and
-- approve it. Status: pending → reviewing (being checked) → approved / rejected. Prices are set here, not by the app (keep them in
-- sync with src/domain/plans.ts).

-- Students on a university email pay the student price. "University" means an
-- academic domain (…edu, …edu.sa, …ac.uk); keep in sync with src/domain/students.ts.
create or replace function public.is_academic_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(split_part(email, '@', 2)) ~ '(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$', false);
$$;

-- ---------- Founders ----------------------------------------------------------------
-- The first 30 subscribers pay the launch prices and keep them on every
-- renewal. A seat is taken when an admin approves a founder-priced request.

create table if not exists public.founders (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.founders enable row level security;

drop policy if exists "Read own founder seat" on public.founders;
create policy "Read own founder seat" on public.founders for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- Public: seats left, and whether the caller holds one.
create or replace function public.founder_status()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'seats', 30,
    'taken', (select count(*) from public.founders),
    'is_founder', exists (select 1 from public.founders f where f.user_id = auth.uid())
  );
$$;

-- Public: how many people use Rusookh (confirmed accounts), for the mobile app page.
create or replace function public.public_user_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from auth.users where email_confirmed_at is not null;
$$;

revoke execute on function public.founder_status() from public;
revoke execute on function public.public_user_count() from public;
grant execute on function public.founder_status() to anon, authenticated;
grant execute on function public.public_user_count() to anon, authenticated;

-- ---------- Prices ---------------------------------------------------------------------
-- Keep in sync with src/domain/plans.ts.

drop function if exists public.plan_price(text, text);
drop function if exists public.plan_price(text, text, boolean);
create or replace function public.plan_price(plan text, period text, student boolean, founder boolean)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when plan = 'plus' and period = 'half' then
      case when founder and student then 19 when founder or student then 29 else 49 end
    when plan = 'plus' and period = 'year' then
      case when founder and student then 35 when founder or student then 49 else 79 end
    when plan = 'pro' and period = 'half' then
      case when founder and student then 39 when founder or student then 59 else 99 end
    when plan = 'pro' and period = 'year' then
      case when founder and student then 69 when founder or student then 99 else 149 end
  end;
$$;

create table if not exists public.payment_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_email   text not null default (auth.jwt() ->> 'email'),
  plan         text not null check (plan in ('plus', 'pro')),
  period       text not null check (period in ('half', 'year')),
  amount       numeric(8, 2) not null default 0,
  method       text not null check (method in ('bank')),
  reference    text not null check (char_length(reference) <= 20),
  payer_name   text check (payer_name is null or char_length(payer_name) <= 80),
  receipt_path text, -- older requests only: requests no longer carry a receipt
  status       text not null default 'pending',
  review_note  text check (review_note is null or char_length(review_note) <= 300),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- Added later: changes for databases created before them.
alter table public.payment_requests add column if not exists student_price boolean not null default false;
alter table public.payment_requests add column if not exists founder_price boolean not null default false;
alter table public.payment_requests drop constraint if exists payment_requests_method_check;
-- NOT VALID: old requests (e.g. by STC Pay, since removed) stay as they are; new ones must be bank transfers.
alter table public.payment_requests add constraint payment_requests_method_check check (method in ('bank')) not valid;
alter table public.payment_requests alter column receipt_path drop not null;
alter table public.payment_requests drop constraint if exists payment_requests_status_check;
alter table public.payment_requests add constraint payment_requests_status_check
  check (status in ('pending', 'reviewing', 'approved', 'rejected'));
-- When the status last changed (the customer's page shows it), and when the
-- admin was emailed about the new request (so it's sent once).
alter table public.payment_requests add column if not exists status_changed_at timestamptz;
alter table public.payment_requests add column if not exists admin_notified_at timestamptz;

create index if not exists payment_requests_user_id_idx on public.payment_requests (user_id);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at);
-- One open request (pending or being reviewed) at a time per student.
drop index if exists public.payment_requests_one_pending_idx;
create unique index if not exists payment_requests_one_open_idx on public.payment_requests (user_id)
  where status in ('pending', 'reviewing');

-- The email comes from the session, the price from the price list (the
-- student price only for a confirmed university email and the student answer),
-- and new requests always start pending.
create or replace function public.prepare_payment_request()
returns trigger
language plpgsql
-- Definer: it counts every founder seat, which the student's own access (RLS) can't see.
security definer
set search_path = ''
as $$
begin
  new.user_email := coalesce(auth.jwt() ->> 'email', new.user_email);
  new.student_price := public.is_academic_email(new.user_email)
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'is_student')::boolean, false);
  -- Founder price for founders, and for anyone while seats are left.
  new.founder_price := exists (select 1 from public.founders f where f.user_id = new.user_id)
    or (select count(*) from public.founders) < 30;
  new.amount := public.plan_price(new.plan, new.period, new.student_price, new.founder_price);
  new.status := 'pending';
  new.review_note := null;
  new.reviewed_at := null;
  new.created_at := now();
  new.status_changed_at := now();
  new.admin_notified_at := null;
  return new;
end;
$$;

drop trigger if exists payment_requests_prepare on public.payment_requests;
create trigger payment_requests_prepare before insert on public.payment_requests
  for each row execute function public.prepare_payment_request();

alter table public.payment_requests enable row level security;

drop policy if exists "Read own requests" on public.payment_requests;
create policy "Read own requests" on public.payment_requests for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Create own requests" on public.payment_requests;
create policy "Create own requests" on public.payment_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Requests can't be withdrawn: the admin rejects one that never got paid.
drop policy if exists "Cancel own pending requests" on public.payment_requests;

-- Replaced by set_payment_request_status.
drop function if exists public.approve_payment_request(uuid);
drop function if exists public.reject_payment_request(uuid, text);

-- The admin moves a request between statuses. Approving gives (or extends)
-- the plan, from today or from the current end date if the plan is still
-- running; rejecting keeps a note the customer sees. An approved request is
-- final (to take a plan back, change it from the users list).
create or replace function public.set_payment_request_status(request_id uuid, new_status text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.payment_requests;
  current_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review payments';
  end if;
  if new_status not in ('pending', 'reviewing', 'approved', 'rejected') then
    raise exception 'bad_request: unknown status';
  end if;

  select * into request from public.payment_requests where id = request_id for update;
  if request.id is null then
    raise exception 'not_found';
  end if;
  if request.status = 'approved' then
    raise exception 'already_approved';
  end if;
  if request.status = new_status and new_status <> 'rejected' then
    return;
  end if;

  if new_status = 'approved' then
    select expires_at into current_end from public.subscriptions where user_id = request.user_id;
    insert into public.subscriptions (user_id, plan, expires_at, updated_at)
    values (
      request.user_id,
      request.plan,
      greatest(coalesce(current_end, now()), now())
        + make_interval(months => case request.period when 'half' then 6 else 12 end),
      now()
    )
    on conflict (user_id) do update
      set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();

    -- A founder-priced payment takes a seat (kept even if seats ran out while it waited: it was paid at that price).
    if request.founder_price then
      insert into public.founders (user_id) values (request.user_id) on conflict (user_id) do nothing;
    end if;
  end if;

  -- Reopening a request fails on payment_requests_one_open_idx if the customer has sent another one since.
  update public.payment_requests
    set status = new_status,
        review_note = case when new_status = 'rejected' then nullif(left(btrim(coalesce(note, '')), 300), '') end,
        reviewed_at = case when new_status in ('approved', 'rejected') then now() end,
        status_changed_at = now()
    where id = request_id;
end;
$$;

revoke execute on function public.set_payment_request_status(uuid, text, text) from public, anon;
grant execute on function public.set_payment_request_status(uuid, text, text) to authenticated;

-- ---------- Plans: limits --------------------------------------------------------
-- An account is on the free plan unless it has a subscription that hasn't
-- expired. بذرة (free) and جذور (plus) have limits; راسخ (pro) has none.
-- Keep the numbers in sync with src/domain/plans.ts.

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_plan text;
  max_rows integer;
  current_rows integer;
  already_exists boolean;
begin
  select sub.plan into user_plan from public.subscriptions sub where sub.user_id = new.user_id and sub.expires_at > now();
  if user_plan = 'pro' then
    return new;
  end if;

  -- The app saves with upsert, which fires insert triggers for updates too: only new rows count.
  execute format('select exists (select 1 from public.%I where id = $1)', tg_table_name) into already_exists using new.id;
  if already_exists then
    return new;
  end if;

  if user_plan = 'plus' then
    max_rows := case tg_table_name when 'shelves' then 7 when 'projects' then 30 when 'cards' then 600 end;
  else
    max_rows := case tg_table_name when 'shelves' then 1 when 'projects' then 2 when 'cards' then 20 end;
  end if;
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into current_rows using new.user_id;
  if current_rows >= max_rows then
    raise exception 'plan_limit:%', tg_table_name using hint = 'Upgrade the plan to add more.';
  end if;
  return new;
end;
$$;

-- Only triggers may call it.
revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['shelves', 'projects', 'cards'] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_enforce_plan_limits', table_name);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.enforce_plan_limits()',
      table_name || '_enforce_plan_limits',
      table_name
    );
  end loop;
end;
$$;

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

-- ---------- AI cards: usage limits -------------------------------------------------
-- Making cards with AI (the راسخ plan) is limited twice, per calendar month:
--   * per user  (ai_monthly_cards_per_user; keep in sync with aiCardsPerMonth in src/domain/plans.ts)
--   * app-wide  (ai_monthly_cards_total). Keep its cost BELOW the monthly spend
--     limit set in the Anthropic Console, so the app stops politely before
--     Anthropic stops answering. With Claude Haiku 5.5, 5,000 cards cost about $1.
-- Change a limit with SQL, e.g.:
--   update public.app_settings set value = 3000 where key = 'ai_monthly_cards_total';

create table if not exists public.app_settings (
  key   text primary key,
  value integer not null
);

-- No policies: only the functions below read it.
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values
  ('ai_monthly_cards_total', 5000),
  ('ai_monthly_cards_per_user', 300),
  ('ai_cards_per_request', 15)
on conflict (key) do nothing;

create table if not exists public.ai_usage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  cards        integer not null check (cards > 0),
  mode         text not null check (mode in ('text', 'image')),
  -- Known only to the server function that reserved it, so a user can't refund a used reservation.
  refund_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

drop policy if exists "Read own AI usage" on public.ai_usage;
create policy "Read own AI usage" on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create or replace function public.app_setting(setting text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_settings where key = setting;
$$;

-- AI cards are for راسخ subscribers (and admins, to test).
create or replace function public.can_use_ai(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (select 1 from public.subscriptions s where s.user_id = uid and s.plan = 'pro' and s.expires_at > now());
$$;

-- What the signed-in user has left this month.
create or replace function public.ai_usage_status()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  per_user integer := public.app_setting('ai_monthly_cards_per_user');
  used integer;
begin
  select coalesce(sum(cards), 0) into used
    from public.ai_usage where user_id = uid and created_at >= date_trunc('month', now());
  return json_build_object(
    'allowed', uid is not null and public.can_use_ai(uid),
    'used', used,
    'limit', per_user,
    'remaining', greatest(per_user - used, 0),
    'per_request', public.app_setting('ai_cards_per_request')
  );
end;
$$;

-- Called by the generate-cards function before asking the AI: checks both
-- limits and reserves the cards. Raises ai_not_allowed / ai_bad_request /
-- ai_user_limit / ai_global_limit.
create or replace function public.reserve_ai_cards(requested integer, request_mode text)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  per_user integer := public.app_setting('ai_monthly_cards_per_user');
  total integer := public.app_setting('ai_monthly_cards_total');
  user_used integer;
  all_used integer;
  usage public.ai_usage;
begin
  if uid is null or not public.can_use_ai(uid) then
    raise exception 'ai_not_allowed';
  end if;
  if requested is null or requested < 1 or requested > public.app_setting('ai_cards_per_request') then
    raise exception 'ai_bad_request';
  end if;

  -- One reservation at a time, so two requests can't both squeeze under a limit.
  perform pg_advisory_xact_lock(hashtext('ai_usage'));

  select coalesce(sum(cards), 0) into user_used
    from public.ai_usage where user_id = uid and created_at >= date_trunc('month', now());
  if user_used + requested > per_user then
    raise exception 'ai_user_limit';
  end if;

  select coalesce(sum(cards), 0) into all_used
    from public.ai_usage where created_at >= date_trunc('month', now());
  if all_used + requested > total then
    raise exception 'ai_global_limit';
  end if;

  insert into public.ai_usage (user_id, cards, mode) values (uid, requested, request_mode) returning * into usage;
  return json_build_object('id', usage.id, 'refund_token', usage.refund_token, 'remaining', per_user - user_used - requested);
end;
$$;

-- After the AI answered: charge only the cards it actually made (0 = refund,
-- e.g. when the request failed). Can only lower a reservation, never raise it.
create or replace function public.settle_ai_cards(usage_id uuid, token uuid, actual integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(actual, 0) <= 0 then
    delete from public.ai_usage
      where id = usage_id and refund_token = token and user_id = auth.uid() and created_at > now() - interval '15 minutes';
  else
    update public.ai_usage set cards = least(cards, actual)
      where id = usage_id and refund_token = token and user_id = auth.uid() and created_at > now() - interval '15 minutes';
  end if;
end;
$$;

revoke execute on function public.app_setting(text) from public, anon, authenticated;
revoke execute on function public.can_use_ai(uuid) from public, anon, authenticated;
revoke execute on function public.ai_usage_status() from public, anon;
revoke execute on function public.reserve_ai_cards(integer, text) from public, anon;
revoke execute on function public.settle_ai_cards(uuid, uuid, integer) from public, anon;
grant execute on function public.ai_usage_status() to authenticated;
grant execute on function public.reserve_ai_cards(integer, text) to authenticated;
grant execute on function public.settle_ai_cards(uuid, uuid, integer) to authenticated;

-- ---------- Storage: payment receipts -------------------------------------------
-- No longer used: requests don't carry a receipt any more. The private bucket
-- stays for receipts sent earlier (admins can still read them, or delete them
-- in Supabase → Storage), and nobody can upload to it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Payment receipts: own folder" on storage.objects;

drop policy if exists "Payment receipts: admins read" on storage.objects;
create policy "Payment receipts: admins read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and (select public.is_admin()));

-- ---------- Admin dashboard ------------------------------------------------------
-- Statistics, the user list, and changing a user's plan. Every function
-- refuses anyone who isn't an admin (see public.is_admin), so the data
-- never reaches a regular account even if it calls them directly.

create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  select json_build_object(
    'users_total',       (select count(*) from auth.users where email_confirmed_at is not null),
    'users_unconfirmed', (select count(*) from auth.users where email_confirmed_at is null),
    'users_new_7d',      (select count(*) from auth.users where email_confirmed_at is not null and created_at >= now() - interval '7 days'),
    'users_new_30d',     (select count(*) from auth.users where email_confirmed_at is not null and created_at >= now() - interval '30 days'),
    'active_today',      (select count(distinct user_id) from public.review_log where date >= current_date),
    'active_7d',         (select count(distinct user_id) from public.review_log where date >= current_date - 6),
    'active_30d',        (select count(distinct user_id) from public.review_log where date >= current_date - 29),
    'students',          (select count(*) from auth.users where raw_user_meta_data ->> 'is_student' = 'true'),
    'academic_emails',   (select count(*) from auth.users where public.is_academic_email(email)),
    'plan_plus',         (select count(*) from public.subscriptions where plan = 'plus' and expires_at > now()),
    'plan_pro',          (select count(*) from public.subscriptions where plan = 'pro' and expires_at > now()),
    'expiring_14d',      (select count(*) from public.subscriptions where expires_at > now() and expires_at <= now() + interval '14 days'),
    'founders_taken',    (select count(*) from public.founders),
    'founder_seats',     30,
    'revenue_total',     coalesce((select sum(amount) from public.payment_requests where status = 'approved'), 0),
    'revenue_month',     coalesce((select sum(amount) from public.payment_requests where status = 'approved' and reviewed_at >= date_trunc('month', now())), 0),
    'payments_pending',  (select count(*) from public.payment_requests where status in ('pending', 'reviewing')),
    'shelves',           (select count(*) from public.shelves),
    'projects',          (select count(*) from public.projects),
    'cards',             (select count(*) from public.cards),
    'reviews_total',     (select count(*) from public.review_log),
    'reviews_7d',        (select count(*) from public.review_log where date >= current_date - 6),
    'ai_cards_month',    coalesce((select sum(cards) from public.ai_usage where created_at >= date_trunc('month', now())), 0),
    'ai_cards_cap',      public.app_setting('ai_monthly_cards_total'),
    'signups_by_day', (
      select coalesce(json_agg(json_build_object('day', day::date, 'count', total) order by day), '[]'::json)
      from (
        select day, (select count(*) from auth.users u where u.created_at::date = day::date) as total
        from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') as day
      ) days
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_users()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) into result
  from (
    select
      u.id,
      u.email,
      u.raw_user_meta_data ->> 'name' as name,
      u.raw_user_meta_data ->> 'is_student' = 'true' as is_student,
      public.is_academic_email(u.email) as academic_email,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at is not null as confirmed,
      coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false) as is_admin,
      s.plan,
      s.expires_at,
      exists (select 1 from public.founders f where f.user_id = u.id) as founder,
      (select count(*) from public.shelves x where x.user_id = u.id) as shelves,
      (select count(*) from public.projects p where p.user_id = u.id) as projects,
      (select count(*) from public.cards c where c.user_id = u.id) as cards,
      (select count(*) from public.review_log r where r.user_id = u.id and r.date >= current_date - 29) as reviews_30d,
      (select max(r.date) from public.review_log r where r.user_id = u.id) as last_review,
      (select coalesce(sum(a.cards), 0) from public.ai_usage a where a.user_id = u.id and a.created_at >= date_trunc('month', now())) as ai_cards_month,
      (select coalesce(sum(pr.amount), 0) from public.payment_requests pr where pr.user_id = u.id and pr.status = 'approved') as paid_total
    from auth.users u
    left join public.subscriptions s on s.user_id = u.id
  ) t;
  return result;
end;
$$;

-- Give a user a plan until a date, or move them back to the free plan.
create or replace function public.admin_set_plan(target uuid, new_plan text, new_expires_at timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if new_plan = 'free' then
    delete from public.subscriptions where user_id = target;
    return;
  end if;
  if new_plan not in ('plus', 'pro') or new_expires_at is null or new_expires_at <= now() then
    raise exception 'bad_request';
  end if;
  insert into public.subscriptions (user_id, plan, expires_at, updated_at)
  values (target, new_plan, new_expires_at, now())
  on conflict (user_id) do update
    set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();
end;
$$;

revoke execute on function public.admin_dashboard_stats() from public, anon;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_plan(uuid, text, timestamptz) to authenticated;

-- ---------- Sharing --------------------------------------------------------------
-- A project or shelf shared by link (/s/<id>). The link shows a snapshot taken
-- when it was shared (the owner can refresh it), never the live rows, and
-- never review progress. Anyone with the link can view it (get_share);
-- signed-in users copy it into their own account, within their plan's limits.

create table if not exists public.shares (
  -- Random and unguessable (12 letters and digits, made by the app).
  id         text primary key check (id ~ '^[A-Za-z0-9]{12}$'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('project', 'shelf')),
  -- The shared project or shelf. One link per item.
  source_id  uuid not null,
  snapshot   jsonb not null check (octet_length(snapshot::text) <= 2000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shares_source_idx on public.shares (user_id, source_id);

drop trigger if exists shares_set_updated_at on public.shares;
create trigger shares_set_updated_at before update on public.shares
  for each row execute function public.set_updated_at();

alter table public.shares enable row level security;

drop policy if exists "Own shares" on public.shares;
create policy "Own shares" on public.shares for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Admins can take down a share.
drop policy if exists "Admins remove shares" on public.shares;
create policy "Admins remove shares" on public.shares for delete to authenticated
  using ((select public.is_admin()));

-- Who copied a share (once per person), for the count the owner sees.
create table if not exists public.share_copies (
  share_id  text not null references public.shares (id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  copied_at timestamptz not null default now(),
  primary key (share_id, user_id)
);

-- No policies: only the functions below read or write it.
alter table public.share_copies enable row level security;

-- A shared item for its page, open to everyone with the link. Shows the
-- owner's name, never their email.
create or replace function public.get_share(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'kind', s.kind,
    'snapshot', s.snapshot,
    'updated_at', s.updated_at,
    'owner_name', nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    'copies', (select count(*) from public.share_copies c where c.share_id = s.id),
    'is_owner', s.user_id = auth.uid(),
    'copied_by_me', exists (select 1 from public.share_copies c where c.share_id = s.id and c.user_id = auth.uid())
  )
  from public.shares s
  join auth.users u on u.id = s.user_id
  where s.id = get_share.share_id;
$$;

create or replace function public.record_share_copy(share_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.share_copies (share_id, user_id)
  select s.id, auth.uid() from public.shares s where s.id = record_share_copy.share_id and auth.uid() is not null
  on conflict do nothing;
$$;

revoke execute on function public.get_share(text) from public;
revoke execute on function public.record_share_copy(text) from public, anon;
grant execute on function public.get_share(text) to anon, authenticated;
grant execute on function public.record_share_copy(text) to authenticated;

-- ---------- Daily reminder -----------------------------------------------------------
-- An email at the hour the user picks, in their time zone, when cards are
-- waiting: "عندك 12 بطاقة تراجعها اليوم". On by default (at 8 pm) once the app
-- has saved the user's time zone; turned off from Settings or the email's link.
--
-- The daily-reminders Edge Function runs every hour (Supabase → Integrations →
-- Cron) and sends what claim_due_reminders returns.

create table if not exists public.reminder_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled           boolean not null default true,
  hour              smallint not null default 20 check (hour between 0 and 23),
  time_zone         text not null default 'Asia/Riyadh' check (char_length(time_zone) <= 64),
  -- The user's local day of the last reminder, so there's one a day at most.
  last_sent_on      date,
  -- For the email's one-click "stop" link.
  unsubscribe_token uuid not null default gen_random_uuid(),
  updated_at        timestamptz not null default now()
);

-- An unknown time zone would break the hourly run for everyone: fall back to Riyadh.
create or replace function public.prepare_reminder_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    new.time_zone := 'Asia/Riyadh';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reminder_settings_prepare on public.reminder_settings;
create trigger reminder_settings_prepare before insert or update on public.reminder_settings
  for each row execute function public.prepare_reminder_settings();

alter table public.reminder_settings enable row level security;

drop policy if exists "Own reminder settings" on public.reminder_settings;
create policy "Own reminder settings" on public.reminder_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The email's "stop" link works without signing in.
create or replace function public.unsubscribe_reminders(token uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with changed as (
    update public.reminder_settings set enabled = false where unsubscribe_token = token returning 1
  )
  select exists (select 1 from changed);
$$;

revoke execute on function public.unsubscribe_reminders(uuid) from public;
grant execute on function public.unsubscribe_reminders(uuid) to anon, authenticated;

-- Everyone whose reminder hour has come (or passed within 2 hours, if a run
-- was missed) and who hasn't been reminded today: mark them, and return those
-- with cards waiting. "Waiting" matches the app's اليوم page: due cards in
-- active projects, up to what's left of the daily limit. No reminder during
-- a vacation or before the email is confirmed.
create or replace function public.claim_due_reminders()
returns table (user_id uuid, email text, name text, due integer, unsubscribe_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
-- The output columns share names with table columns: a bare name means the column.
#variable_conflict use_column
begin
  return query
  with ready as (
    select r.user_id, (now() at time zone r.time_zone)::date as local_day
    from public.reminder_settings r
    where r.enabled
      and extract(hour from now() at time zone r.time_zone)::int between r.hour and r.hour + 2
      and (r.last_sent_on is null or r.last_sent_on < (now() at time zone r.time_zone)::date)
  ),
  claimed as (
    update public.reminder_settings r
      set last_sent_on = ready.local_day
      from ready
      where r.user_id = ready.user_id
      returning r.user_id, ready.local_day, r.unsubscribe_token
  ),
  counted as (
    select
      c.user_id,
      c.unsubscribe_token,
      u.email::text as email,
      nullif(btrim(u.raw_user_meta_data ->> 'name'), '') as name,
      (select count(*) from public.cards card
         join public.projects p on p.id = card.project_id
         where card.user_id = c.user_id and not p.archived and card.next_review_date <= c.local_day)::int as due_total,
      (select count(distinct log.card_id) from public.review_log log
         where log.user_id = c.user_id and log.date = c.local_day)::int as reviewed_today,
      -- Missing: the default 30. JSON null: no limit.
      case
        when not (u.raw_user_meta_data ? 'daily_review_limit') then 30
        when jsonb_typeof(u.raw_user_meta_data -> 'daily_review_limit') = 'number' then (u.raw_user_meta_data ->> 'daily_review_limit')::int
        else null
      end as daily_limit
    from claimed c
    join auth.users u on u.id = c.user_id
    where u.email_confirmed_at is not null
      and not exists (
        select 1 from public.vacations v
        where v.user_id = c.user_id and v.start_date <= c.local_day and (v.end_date is null or v.end_date >= c.local_day)
      )
  )
  select counted.user_id, counted.email, counted.name,
    case when counted.daily_limit is null then counted.due_total
      else least(counted.due_total, greatest(counted.daily_limit - counted.reviewed_today, 0)) end as due,
    counted.unsubscribe_token
  from counted
  where counted.due_total > 0
    and (counted.daily_limit is null or counted.daily_limit > counted.reviewed_today);
end;
$$;

-- Only the Edge Function (service role) may run it.
revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
