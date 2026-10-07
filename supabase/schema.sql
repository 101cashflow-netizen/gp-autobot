-- ===========================================================================
-- Facebook AutoBot (Grupos & Páginas) — Supabase Schema
-- ===========================================================================
-- Execute este script no SQL Editor do seu projeto Supabase:
-- (Dashboard > SQL Editor > New query > Run)
--
-- É 100% idempotente: pode ser executado em um banco novo ou existente.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Configurações da Aplicação (app_settings) - Linha Única (id = 1)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id smallint primary key default 1,
  
  -- Meta (Facebook) App Credentials & Tokens
  facebook_app_id text,
  facebook_app_secret text,
  facebook_config_id text,
  facebook_user_token text,            -- Token de longa duração (~60 dias)
  facebook_token_expires_at timestamptz,
  facebook_user_name text,
  
  -- Destino Padrão (Grupos e/ou Páginas)
  default_target_type text default 'group', -- 'group' | 'page' | 'both'
  default_group_id text,
  default_group_name text,
  default_page_id text,
  default_page_name text,
  default_page_token text,
  
  -- Regras Anti-Spam e Intervalos entre Grupos (segundos)
  min_delay_between_posts_seconds integer not null default 120,
  max_delay_between_posts_seconds integer not null default 300,
  max_group_posts_per_day integer not null default 20,

  -- Provedores de IA de Texto
  gemini_api_key text,
  groq_api_key text,
  pollinations_api_key text,
  text_provider_pref text default 'auto',    -- 'auto' | 'gemini' | 'groq' | 'pollinations'
  gemini_enabled boolean not null default true,
  groq_enabled boolean not null default true,
  pollinations_enabled boolean not null default true,

  -- Avatar IA & Personalidade
  avatar_enabled boolean not null default true,
  avatar_name text default 'Nasha',
  avatar_prompt text,

  -- Provedores de Mídia / Imagem / Vídeo
  image_source text not null default 'ai',   -- 'ai' | 'stock' | 'mixed'
  pexels_api_key text,
  pixabay_api_key text,
  cloudflare_account_id text,
  cloudflare_api_token text,

  -- Configurações de Copywriting
  copy_language text default 'auto',         -- 'auto' | 'pt' | 'en' | 'es'
  copy_length text default 'medium',         -- 'short' | 'medium' | 'long' | 'random'
  copy_tone text default 'conversational',   -- 'conversational' | 'persuasive' | 'informative' | 'inspirational' | 'humorous' | 'professional' | 'random'
  copy_custom_rules text default '',
  utm_suffix text default '',

  -- Piloto Automático (Autopilot)
  auto_post_enabled boolean not null default false,
  posts_per_day smallint not null default 3,
  posting_hours int[] not null default '{9,13,18}',
  timezone text not null default 'America/Sao_Paulo',
  last_auto_post_at timestamptz,
  topic_source text not null default 'mine',  -- 'mine' | 'trending' | 'mixed'
  
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Tabela de Grupos do Facebook (facebook_groups)
-- ---------------------------------------------------------------------------
create table if not exists facebook_groups (
  id text primary key,                        -- ID numérico ou identificador do Grupo
  name text not null,                         -- Nome do Grupo
  description text,                          -- Descrição / Regras do Grupo
  privacy text default 'PUBLIC',             -- 'PUBLIC' | 'CLOSED' | 'SECRET'
  status text not null default 'MEMBER',     -- 'MEMBER' | 'ADMIN' | 'PENDING' | 'DISCOVERED' | 'BLACKLISTED'
  member_count integer default 0,
  group_url text,                            -- Link direto (https://facebook.com/groups/...)
  icon_url text,                             -- Foto / Banner do grupo
  category text,                             -- Nicho / Categoria (ex: 'Renda Extra', 'Marketing')
  tags text[] default '{}',
  can_post boolean not null default true,    -- Se o bot está autorizado a postar neste grupo
  requires_approval boolean default false,   -- Se as postagens passam por moderação prévia
  is_secret boolean not null default false,  -- Se é grupo privado oculto (antigo grupo secreto)
  post_count integer not null default 0,     -- Total de postagens realizadas
  last_posted_at timestamptz,                -- Última postagem realizada neste grupo
  notes text,                                -- Observações manuais
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fb_groups_status_idx on facebook_groups (status);
create index if not exists fb_groups_can_post_idx on facebook_groups (can_post, last_posted_at nulls first);
create index if not exists fb_groups_category_idx on facebook_groups (category);

-- ---------------------------------------------------------------------------
-- 3. Tabela de Posts / Publicações (posts)
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  title text not null,
  description text not null,
  hashtags text[] not null default '{}',
  image_url text,                            -- Imagem final ou thumbnail de vídeo
  image_source text,                         -- 'ai' | 'stock'
  media_type text not null default 'image',  -- 'image' | 'video' | 'text'
  media_url text,                            -- URL direta de vídeo quando aplicável
  link_url text,                             -- Link opcional inserido no corpo do post
  
  -- Destinos
  target_type text not null default 'group', -- 'group' | 'page' | 'multiple_groups'
  group_id text,                             -- ID do grupo individual
  group_name text,                           -- Nome do grupo
  target_group_ids text[] default '{}',      -- Lista de IDs quando enviado para múltiplos grupos
  page_id text,                              -- ID da página (retrocompatibilidade)
  page_name text,                            -- Nome da página
  
  -- Status e Agendamento
  status text not null default 'draft',      -- 'draft' | 'scheduled' | 'processing' | 'posted' | 'failed'
  scheduled_at timestamptz,
  posted_at timestamptz,
  facebook_post_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists posts_status_scheduled_idx on posts (status, scheduled_at);
create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists posts_target_type_idx on posts (target_type);

-- ---------------------------------------------------------------------------
-- 4. Entregas por Grupo para Posts Multi-Grupo (post_group_deliveries)
-- ---------------------------------------------------------------------------
create table if not exists post_group_deliveries (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  group_id text not null,
  group_name text not null,
  status text not null default 'pending',     -- 'pending' | 'posted' | 'failed' | 'skipped'
  facebook_post_id text,
  error_message text,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_post_id_idx on post_group_deliveries (post_id);
create index if not exists deliveries_status_idx on post_group_deliveries (status);

-- ---------------------------------------------------------------------------
-- 5. Cache de Páginas (pages_cache) - Mantido para flexibilidade
-- ---------------------------------------------------------------------------
create table if not exists pages_cache (
  page_id text primary key,
  name text not null,
  category text,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Tópicos e Palavras-chave do Usuário (topics)
-- ---------------------------------------------------------------------------
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  enabled boolean not null default true,
  category text,                             -- Nicho opcional do tópico
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists topics_text_lower_idx on topics (lower(text));
create index if not exists topics_rotation_idx on topics (enabled, last_used_at nulls first);

-- ---------------------------------------------------------------------------
-- 7. Storage Bucket para Imagens Re-hospedadas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Atualizações Incrementais Seguras (Upgrades para bancos já existentes)
-- ---------------------------------------------------------------------------
alter table app_settings add column if not exists stock_provider text default 'any';
alter table app_settings add column if not exists pexels_api_key text;
alter table app_settings add column if not exists pixabay_api_key text;
alter table app_settings add column if not exists cloudflare_account_id text;
alter table app_settings add column if not exists cloudflare_api_token text;
alter table app_settings add column if not exists pollinations_api_key text;
alter table app_settings add column if not exists default_target_type text default 'group';
alter table app_settings add column if not exists default_group_id text;
alter table app_settings add column if not exists default_group_name text;
alter table app_settings add column if not exists min_delay_between_posts_seconds integer not null default 120;
alter table app_settings add column if not exists max_delay_between_posts_seconds integer not null default 300;
alter table app_settings add column if not exists max_group_posts_per_day integer not null default 20;
alter table app_settings add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table posts add column if not exists target_type text not null default 'group';
alter table posts add column if not exists group_id text;
alter table posts add column if not exists group_name text;
alter table posts add column if not exists target_group_ids text[] default '{}';
alter table posts alter column image_url drop not null;
alter table posts alter column image_source drop not null;
alter table posts alter column page_id drop not null;
alter table posts alter column page_name drop not null;

alter table topics add column if not exists category text;
