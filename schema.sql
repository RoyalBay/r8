-- ============================================================
-- r8 — Contextual Reputation System
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES
-- Auto-created on signup via trigger
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text default '',
  avatar_url text default '',
  trust_score float default 50.0,
  is_moderator boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- 2. ENTITIES
-- Anything being rated: person, restaurant, trail, server, etc.
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  description text default '',
  image_url text default '',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table entities enable row level security;

create policy "Entities are viewable by everyone"
  on entities for select using (true);

create policy "Authenticated users can create entities"
  on entities for insert with check (auth.uid() is not null);

create policy "Entity creators can update their entities"
  on entities for update using (auth.uid() = created_by);

-- 3. ENTITY TAGS
create table if not exists entity_tags (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  tag text not null
);

alter table entity_tags enable row level security;

create policy "Entity tags are viewable by everyone"
  on entity_tags for select using (true);

create policy "Authenticated users can add entity tags"
  on entity_tags for insert with check (auth.uid() is not null);

-- 4. REVIEWS
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  reviewer_id uuid references profiles(id),
  score int check (score >= 1 and score <= 10),
  content text not null,
  interaction_type text not null default 'general',
  status text default 'active' check (status in ('active', 'hidden', 'removed')),
  created_at timestamptz default now()
);

alter table reviews enable row level security;

create policy "Active reviews are viewable by everyone"
  on reviews for select using (status = 'active' or auth.uid() = reviewer_id);

create policy "Authenticated users can create reviews"
  on reviews for insert with check (auth.uid() is not null);

create policy "Reviewers can update their own reviews"
  on reviews for update using (auth.uid() = reviewer_id);

-- 5. REVIEW TAGS
create table if not exists review_tags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  tag text not null
);

alter table review_tags enable row level security;

create policy "Review tags are viewable by everyone"
  on review_tags for select using (true);

create policy "Authenticated users can add review tags"
  on review_tags for insert with check (auth.uid() is not null);

-- 6. APPEALS
create table if not exists appeals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  submitted_by uuid references profiles(id),
  reason text not null,
  evidence_url text default '',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderator_note text default '',
  resolved_by uuid references profiles(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

alter table appeals enable row level security;

create policy "Appeals are viewable by everyone"
  on appeals for select using (true);

create policy "Authenticated users can submit appeals"
  on appeals for insert with check (auth.uid() is not null);

create policy "Moderators can update appeals"
  on appeals for update using (
    exists (select 1 from profiles where id = auth.uid() and is_moderator = true)
  );

-- 7. MODERATION ACTIONS (Public Audit Log)
create table if not exists mod_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references profiles(id),
  action_type text not null check (action_type in ('review_removed', 'review_hidden', 'reviewer_suspended', 'appeal_approved', 'appeal_rejected', 'entity_edited')),
  target_type text not null check (target_type in ('review', 'entity', 'profile', 'appeal')),
  target_id uuid not null,
  reason text not null,
  created_at timestamptz default now()
);

alter table mod_actions enable row level security;

create policy "Mod actions are viewable by everyone (transparency)"
  on mod_actions for select using (true);

create policy "Moderators can create mod actions"
  on mod_actions for insert with check (
    exists (select 1 from profiles where id = auth.uid() and is_moderator = true)
  );

-- 8. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if present, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. HELPER VIEW: Entity with aggregate score
create or replace view entity_stats as
select
  e.id,
  e.title,
  e.category,
  e.description,
  e.image_url,
  e.created_by,
  e.created_at,
  coalesce(round(avg(r.score)::numeric, 1), 0) as avg_score,
  count(r.id) as review_count
from entities e
left join reviews r on r.entity_id = e.id and r.status = 'active'
group by e.id, e.title, e.category, e.description, e.image_url, e.created_by, e.created_at;
