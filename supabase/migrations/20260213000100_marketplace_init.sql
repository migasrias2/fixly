create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('user', 'contractor', 'admin')),
  stripe_account_id text,
  created_at timestamptz not null default now()
);

create or replace function public.get_my_role()
returns text
language sql
stable
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create table if not exists public.damage_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  location text not null,
  damage_type text not null,
  status text not null default 'open' check (status in ('open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled')),
  ai_summary text,
  ai_estimate_low numeric(12, 2),
  ai_estimate_high numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.damage_posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.damage_posts(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (post_id, contractor_id)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.damage_posts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'usd',
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  timeline_days integer,
  scope_notes text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'quote', 'system')),
  body text not null,
  attachment_url text,
  quote_id uuid references public.quotes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.damage_posts(id) on delete cascade,
  quote_id uuid unique not null references public.quotes(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'funded', 'in_progress', 'completed', 'released', 'disputed')),
  payment_status text not null default 'pending',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  payout_released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  commission_rate numeric(5, 4) not null,
  commission_amount numeric(12, 2) not null,
  payout_amount numeric(12, 2) not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'held', 'released', 'failed', 'disputed')),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  stripe_application_fee_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.contractor_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique not null references public.jobs(id) on delete cascade,
  post_id uuid not null references public.damage_posts(id) on delete cascade,
  homeowner_id uuid not null references public.profiles(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.damage_posts enable row level security;
alter table public.post_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.contractor_reviews enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "posts_select_authenticated" on public.damage_posts;
create policy "posts_select_authenticated"
on public.damage_posts for select
to authenticated
using (true);

drop policy if exists "posts_insert_user_only" on public.damage_posts;
create policy "posts_insert_user_only"
on public.damage_posts for insert
to authenticated
with check (owner_id = auth.uid() and coalesce(public.get_my_role(), '') in ('user', 'admin'));

drop policy if exists "posts_update_owner_only" on public.damage_posts;
create policy "posts_update_owner_only"
on public.damage_posts for update
to authenticated
using (owner_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin')
with check (owner_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "post_photos_select_authenticated" on public.post_photos;
create policy "post_photos_select_authenticated"
on public.post_photos for select
to authenticated
using (true);

drop policy if exists "post_photos_insert_owner" on public.post_photos;
create policy "post_photos_insert_owner"
on public.post_photos for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
on public.conversations for select
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "conversations_insert_participants" on public.conversations;
create policy "conversations_insert_participants"
on public.conversations for insert
to authenticated
with check (homeowner_id <> contractor_id and (homeowner_id = auth.uid() or contractor_id = auth.uid()));

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.homeowner_id = auth.uid() or c.contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin')
  )
);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.homeowner_id = auth.uid() or c.contractor_id = auth.uid())
  )
);

drop policy if exists "quotes_select_participants" on public.quotes;
create policy "quotes_select_participants"
on public.quotes for select
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "quotes_insert_contractor" on public.quotes;
create policy "quotes_insert_contractor"
on public.quotes for insert
to authenticated
with check (contractor_id = auth.uid() and coalesce(public.get_my_role(), '') in ('contractor', 'admin'));

drop policy if exists "quotes_update_participants" on public.quotes;
create policy "quotes_update_participants"
on public.quotes for update
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin')
with check (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "jobs_select_participants" on public.jobs;
create policy "jobs_select_participants"
on public.jobs for select
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "jobs_insert_participants" on public.jobs;
create policy "jobs_insert_participants"
on public.jobs for insert
to authenticated
with check (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "jobs_update_participants" on public.jobs;
create policy "jobs_update_participants"
on public.jobs for update
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin')
with check (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "payments_select_participants" on public.payments;
create policy "payments_select_participants"
on public.payments for select
to authenticated
using (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "payments_insert_participants" on public.payments;
create policy "payments_insert_participants"
on public.payments for insert
to authenticated
with check (homeowner_id = auth.uid() or contractor_id = auth.uid() or coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin"
on public.payments for update
to authenticated
using (coalesce(public.get_my_role(), '') = 'admin')
with check (coalesce(public.get_my_role(), '') = 'admin');

drop policy if exists "reviews_select_authenticated" on public.contractor_reviews;
create policy "reviews_select_authenticated"
on public.contractor_reviews for select
to authenticated
using (true);

drop policy if exists "reviews_insert_homeowner" on public.contractor_reviews;
create policy "reviews_insert_homeowner"
on public.contractor_reviews for insert
to authenticated
with check (homeowner_id = auth.uid());

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_insert_own_or_admin" on public.notifications;
create policy "notifications_insert_authenticated"
on public.notifications for insert
to authenticated
with check (true);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
