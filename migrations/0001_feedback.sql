CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feedback', 'question')),
  lang TEXT NOT NULL CHECK (lang IN ('ko', 'en', 'ja', 'pt-BR')),
  message TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS feedback_created_at ON feedback (created_at);
