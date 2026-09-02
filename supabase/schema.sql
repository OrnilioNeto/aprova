-- ============================================================
-- SUPABASE: tabela de estados por usuário + Row Level Security
-- Rodar no Supabase Dashboard > SQL Editor (após criar o projeto)
-- ============================================================

create table if not exists public.states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.states enable row level security;

drop policy if exists "states_select_own" on public.states;
create policy "states_select_own" on public.states
  for select using (auth.uid() = user_id);

drop policy if exists "states_insert_own" on public.states;
create policy "states_insert_own" on public.states
  for insert with check (auth.uid() = user_id);

drop policy if exists "states_update_own" on public.states;
create policy "states_update_own" on public.states
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "states_delete_own" on public.states;
create policy "states_delete_own" on public.states
  for delete using (auth.uid() = user_id);