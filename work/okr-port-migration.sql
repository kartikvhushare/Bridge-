-- ═══════════════════════════════════════════════════════════════════
-- Evarca · OKR port migration (ADDITIVE ONLY — no data modified/deleted)
-- Adds the columns the ported Bridge OKR feature needs on public.okrs.
-- Safe to run repeatedly (IF NOT EXISTS everywhere).
-- Run in Supabase Studio → SQL editor, or I apply it via the connector
-- once it's re-authorized.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS is_annual boolean NOT NULL DEFAULT false;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS quarter_label text;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS closed_reason text;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.okrs ADD COLUMN IF NOT EXISTS closed_by text;
COMMENT ON COLUMN public.okrs.is_annual IS 'Annual objective that auto-updates from its quarterly child objectives';
COMMENT ON COLUMN public.okrs.quarter_label IS 'Set on quarterly child objectives generated from an annual one (e.g. Q1)';
COMMENT ON COLUMN public.okrs.closed IS 'Closed for record — frozen, no further updates';
