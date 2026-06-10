-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Users (mirror of Clerk users; clerk_user_id is the source of truth)
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_clerk_id on public.users(clerk_user_id);

-- Recipes
create table public.recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  cook_time_minutes integer,
  prep_time_minutes integer,
  servings integer,
  tags text[] not null default '{}',
  image_url text,
  storage_path text,
  source_type text not null check (source_type in ('url','youtube','manual')),
  source_url text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_recipes_user_id on public.recipes(user_id);
create index idx_recipes_tags on public.recipes using gin(tags);
create index idx_recipes_title_trgm on public.recipes using gin(title gin_trgm_ops);

-- Collections (folders of recipes)
create table public.collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_collections_user_id on public.collections(user_id);

-- Many-to-many: recipes <-> collections
create table public.collection_recipes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

-- Shopping list items
create table public.shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  ingredient text not null,
  quantity text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_shopping_user_id on public.shopping_list_items(user_id);

-- Subscriptions (Razorpay)
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references public.users(id) on delete cascade,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  plan_id text not null default 'free' check (plan_id in ('free','premium_monthly','premium_yearly')),
  status text not null default 'active' check (status in ('active','cancelled','paused','past_due','expired')),
  current_period_end timestamptz,
  recipe_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger trg_recipes_updated_at before update on public.recipes for each row execute function public.set_updated_at();
create trigger trg_collections_updated_at before update on public.collections for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

-- Auto-create a free subscription row when a user is inserted
create or replace function public.create_default_subscription()
returns trigger language plpgsql as $$
begin
  insert into public.subscriptions (user_id, plan_id, status) values (new.id, 'free', 'active');
  return new;
end; $$;
create trigger trg_users_default_sub after insert on public.users for each row execute function public.create_default_subscription();
