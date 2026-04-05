-- Explanation depth preference
-- Run this in your Supabase SQL Editor

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS technical_level text DEFAULT 'intermediate'
    CHECK (technical_level IN ('beginner', 'intermediate', 'expert'));
