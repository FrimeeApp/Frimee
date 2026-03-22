-- Fix: add missing values to visibilidad_plan enum
-- Run in Supabase Dashboard → SQL Editor

-- Add all expected visibility values if they don't already exist
ALTER TYPE visibilidad_plan ADD VALUE IF NOT EXISTS 'PUBLICO';
ALTER TYPE visibilidad_plan ADD VALUE IF NOT EXISTS 'SOLO_GRUPO';
ALTER TYPE visibilidad_plan ADD VALUE IF NOT EXISTS 'SOLO_AMIGOS';
ALTER TYPE visibilidad_plan ADD VALUE IF NOT EXISTS 'SOLO_FOLLOW';

-- Verify the final enum values:
-- SELECT unnest(enum_range(NULL::visibilidad_plan));
