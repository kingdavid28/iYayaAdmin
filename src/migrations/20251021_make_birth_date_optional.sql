-- Migration: make children.birth_date optional
-- Run this migration after ensuring the original children table exists.

ALTER TABLE children
  ALTER COLUMN birth_date DROP NOT NULL;
