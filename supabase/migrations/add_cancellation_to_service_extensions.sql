-- Add cancellation column to service_extensions table
ALTER TABLE public.service_extensions
  ADD COLUMN IF NOT EXISTS cancellation JSONB;
