-- Run this once in the Supabase SQL editor.

create table if not exists public.booking_submissions (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  first_name     text,
  last_name      text,
  email          text not null,
  company_name   text,
  job_title      text,
  provider_count text,
  page_url       text,
  referrer       text,
  utm            jsonb,
  user_agent     text
);

create index if not exists booking_submissions_email_idx
  on public.booking_submissions (email);

create index if not exists booking_submissions_created_at_idx
  on public.booking_submissions (created_at desc);

-- Lock the table down. The API route uses the service role key, which bypasses
-- RLS, so no policies are needed and the anon key can never read leads.
alter table public.booking_submissions enable row level security;
