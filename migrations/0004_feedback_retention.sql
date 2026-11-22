-- UTC anniversary. A February 29 receipt expires on February 28 the following year.
ALTER TABLE feedback ADD COLUMN expires_at TEXT GENERATED ALWAYS AS (
  datetime(CASE WHEN substr(created_at, 6, 5) = '02-29'
    THEN substr(created_at, 1, 4) || '-02-28' || substr(created_at, 11)
    ELSE created_at END, '+1 year')
) VIRTUAL;
CREATE INDEX feedback_expiry ON feedback (expires_at, id);

ALTER TABLE public_qa RENAME TO public_qa_before_retention;

CREATE TABLE public_qa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id TEXT UNIQUE REFERENCES feedback(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('ko', 'en', 'ja', 'pt-BR')),
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
  answer TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 3000),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'rules', 'other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT,
  updated_at TEXT,
  privacy_reviewed_at TEXT,
  CHECK ((status = 'published' AND privacy_reviewed_at IS NOT NULL)
    OR (status = 'draft' AND privacy_reviewed_at IS NULL AND feedback_id IS NOT NULL))
);

-- Earlier approvals had no recorded privacy review. Preserve the text for re-review.
INSERT INTO public_qa (id, feedback_id, lang, question, answer, published_at, category, status, created_at, updated_at)
SELECT id, feedback_id, lang, question, answer, published_at, category, 'draft', created_at, updated_at
FROM public_qa_before_retention;

INSERT INTO sqlite_sequence (name, seq)
SELECT 'public_qa', seq FROM sqlite_sequence
WHERE name = 'public_qa_before_retention' AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'public_qa');
UPDATE sqlite_sequence SET seq = max(seq, coalesce(
  (SELECT seq FROM sqlite_sequence WHERE name = 'public_qa_before_retention'), 0))
WHERE name = 'public_qa';

DROP TABLE public_qa_before_retention;
CREATE INDEX public_qa_lang_id ON public_qa (lang, id DESC);
CREATE INDEX public_qa_visibility ON public_qa (lang, status, id DESC);
CREATE INDEX public_qa_independent ON public_qa (id DESC) WHERE feedback_id IS NULL;

-- Applies to both the administrator's DELETE and expiry DELETE, in the same statement.
CREATE TRIGGER feedback_preserve_reviewed_qa BEFORE DELETE ON feedback
BEGIN
  UPDATE public_qa SET feedback_id = NULL
  WHERE feedback_id = OLD.id AND status = 'published' AND privacy_reviewed_at IS NOT NULL;
END;
