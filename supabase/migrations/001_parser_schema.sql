
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Existing Projects Table (Keep this for Agency management)
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  initials text not null,
  status text check (status in ('active', 'paused')) default 'active',
  health_score integer default 100,
  goal integer default 0,
  achieved integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Buyers/Scripts tables might be needed, but sticking to Parser Sync first.

-- 1. SELLERS (Synced with Parser)
-- Replaces 'leads' conceptually, but we'll create a new table to match Parser exact schema
create table if not exists sellers (
    id uuid default uuid_generate_v4() primary key,
    
    -- Identifiers
    inn text unique,
    wb_brand_id text,
    wb_product_id text,
    
    -- Core Data
    brand_name text not null,
    revenue_monthly numeric,
    top_product_name text,
    
    -- Contact Info
    contact_name text,
    phone text,
    email text,
    
    -- Metadata
    source text default 'WB_API' check (source in ('WB_API', 'TG_CHAT', 'VK', 'INSTAGRAM')),
    status text check (status in ('NEW', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'CONVERTED', 'REJECTED')) default 'NEW',
    
    -- Dashboard Specific (Optional, but useful for linking)
    project_id uuid references projects(id) on delete set null, 

    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. INTERACTIONS (The Heat)
create table if not exists interactions (
    id uuid default uuid_generate_v4() primary key,
    seller_id uuid references sellers(id) on delete cascade,
    channel text check (channel in ('TELEGRAM', 'WHATSAPP', 'EMAIL')),
    direction text check (direction in ('OUTBOUND', 'INBOUND')),
    content text,
    status text check (status in ('SENT', 'DELIVERED', 'READ', 'FAILED')) default 'SENT',
    sent_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. PARSER JOBS (Command Center)
create table if not exists parser_jobs (
    id uuid default uuid_generate_v4() primary key,
    query text not null,
    status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
    result_count integer default 0,
    error_log text,
    project_id uuid references projects(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table sellers enable row level security;
alter table interactions enable row level security;
alter table parser_jobs enable row level security;

create policy "Enable all access for anon" on sellers for all using (true) with check (true);
create policy "Enable all access for anon" on interactions for all using (true) with check (true);
create policy "Enable all access for anon" on parser_jobs for all using (true) with check (true);

-- Indexes
create index if not exists idx_sellers_status on sellers(status);
create index if not exists idx_sellers_revenue on sellers(revenue_monthly);
create index if not exists idx_parser_jobs_status on parser_jobs(status);
