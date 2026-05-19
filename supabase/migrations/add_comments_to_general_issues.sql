-- Migration: Add comments JSONB column to general_issues table
-- Each element: { id: uuid, author: text, text: text, timestamp: iso-string }

ALTER TABLE general_issues
  ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index for potential future queries on comment author (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_general_issues_comments ON general_issues USING gin (comments);
