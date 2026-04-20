-- Phase 1 schema for Dental Clinic AI Automation. Single-tenant demo (no auth yet);
-- RLS enabled with permissive demo policies so the app works without login.
-- Tighten policies once auth/multi-tenant is added.

create extension if not exists pgcrypto;

-- Reusable updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Enums
do $$ begin
  create type public.patient_status as enum ('new_lead','booked','treated','follow_up','inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled','completed','missed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_sender as enum ('patient','ai','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_intent as enum ('booking','inquiry','emergency','casual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_urgency as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- patients
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status public.patient_status not null default 'new_lead',
  last_visit timestamptz,
  treatment_type text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.patients (status);
create index on public.patients (created_at desc);
create trigger trg_patients_updated before update on public.patients
  for each row execute function public.set_updated_at();

-- appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  treatment_type text,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (starts_at);
create index on public.appointments (patient_id);
create trigger trg_appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();

-- messages (conversation threads grouped by patient_id)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  sender public.message_sender not null,
  body text not null,
  intent public.ai_intent,
  urgency public.ai_urgency,
  suggested_action text,
  tags text[] not null default '{}',
  human_takeover boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages (patient_id, created_at);

-- ai_config (singleton row pattern; one config for the clinic)
create table public.ai_config (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null default 'Bright Smile Dental',
  services_offered text[] not null default '{"Cleaning","Whitening","Implants","Orthodontics","Root Canal"}',
  pricing_details text not null default 'Cleaning from $80, Whitening from $250, Implants from $1500, Orthodontics from $3000.',
  tone text not null default 'friendly',
  personality text not null default 'Warm, calm, and reassuring receptionist who values patient comfort.',
  custom_instructions text not null default 'Always greet by name when known. Offer to book a consultation when relevant. Keep replies under 80 words.',
  emergency_rules text not null default 'Severe pain, swelling, bleeding, or trauma = high urgency. Recommend same-day visit.',
  booking_rules text not null default 'After answering, gently propose 1-2 concrete time slots within the next 3 days.',
  disallowed_behaviors text not null default 'No medical diagnoses. No prescriptions. No promises of outcomes. No discussion of competitors.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_ai_config_updated before update on public.ai_config
  for each row execute function public.set_updated_at();

-- automations_log
create table public.automations_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  automation_type text not null, -- e.g. 'reply','missed_appt','reactivation','post_treatment'
  trigger text,
  ai_output jsonb,
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index on public.automations_log (created_at desc);

-- Enable RLS
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;
alter table public.ai_config enable row level security;
alter table public.automations_log enable row level security;

-- Demo policies: allow public read/write so the app works without auth in Phase 1.
-- Replace with auth-scoped policies before production.
create policy "demo all patients" on public.patients for all using (true) with check (true);
create policy "demo all appointments" on public.appointments for all using (true) with check (true);
create policy "demo all messages" on public.messages for all using (true) with check (true);
create policy "demo all ai_config" on public.ai_config for all using (true) with check (true);
create policy "demo all automations_log" on public.automations_log for all using (true) with check (true);

-- Seed default ai_config row
insert into public.ai_config default values;