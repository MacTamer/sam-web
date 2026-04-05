-- Sam Memory System
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS memories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users NOT NULL,
  type           text NOT NULL CHECK (type IN ('general', 'project', 'preference', 'task')),
  content        text NOT NULL,
  source_conv_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_type_idx    ON memories(user_id, type);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories"
  ON memories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
