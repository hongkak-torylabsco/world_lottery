ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'in_progress', 'resolved'));

CREATE TABLE public_qa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id TEXT NOT NULL UNIQUE REFERENCES feedback(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('ko', 'en', 'ja', 'pt-BR')),
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
  answer TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 3000),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX public_qa_lang_id ON public_qa (lang, id DESC);
