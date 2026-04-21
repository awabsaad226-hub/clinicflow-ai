
-- 1) Extend ai_config with clinic availability & Calendly link
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS clinic_hours text NOT NULL DEFAULT 'Mon–Fri 9:00–18:00, Sat 10:00–14:00, closed Sunday',
  ADD COLUMN IF NOT EXISTS calendly_url text NOT NULL DEFAULT '';

-- 2) Integrations table — one row per channel (gmail, slack, calendly)
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,           -- 'gmail' | 'slack' | 'calendly'
  status text NOT NULL DEFAULT 'disconnected', -- 'connected' | 'disconnected'
  config jsonb NOT NULL DEFAULT '{}'::jsonb,   -- e.g. { webhook_url, email, calendly_url }
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo all integrations" ON public.integrations FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the three integration rows
INSERT INTO public.integrations (provider) VALUES ('gmail'), ('slack'), ('calendly')
ON CONFLICT (provider) DO NOTHING;

-- 3) External messages — incoming emails from Gmail show here
CREATE TABLE IF NOT EXISTS public.external_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                   -- 'gmail' for now
  from_email text NOT NULL,
  from_name text,
  subject text,
  body text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo all external_messages" ON public.external_messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_external_messages_received ON public.external_messages(received_at DESC);
