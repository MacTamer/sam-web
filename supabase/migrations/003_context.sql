-- Conversation context/summary column
-- Run this in your Supabase SQL Editor

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS summary text;
