-- R22 (UAE compliance) — additive only, no existing data touched. Applied to project emzgwkvkgojcaqngkatw.
-- Overtime: typed hours + frozen legal rate (Art 19).
ALTER TABLE public.overtime   ADD COLUMN IF NOT EXISTS kind text DEFAULT 'normal';
ALTER TABLE public.overtime   ADD COLUMN IF NOT EXISTS rate numeric;
-- Discipline: due-process case fields (Art 39/40 + Cabinet Res 1/2022).
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS discovered_at date;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS defence text;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS defence_at timestamptz;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS penalty jsonb;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.discipline ADD COLUMN IF NOT EXISTS decided_by text;
-- Surveys: confidential (anonymised) responses (PDPL — DL 45/2021).
ALTER TABLE public.surveys    ADD COLUMN IF NOT EXISTS anonymous boolean DEFAULT false;
