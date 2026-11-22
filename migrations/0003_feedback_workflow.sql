ALTER TABLE feedback ADD COLUMN category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'rules', 'other'));
ALTER TABLE feedback ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback ADD COLUMN internal_note TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback ADD COLUMN operator_answer TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback ADD COLUMN updated_at TEXT;
UPDATE feedback SET updated_at = created_at;

ALTER TABLE public_qa ADD COLUMN category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'rules', 'other'));
ALTER TABLE public_qa ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));
ALTER TABLE public_qa ADD COLUMN created_at TEXT;
ALTER TABLE public_qa ADD COLUMN updated_at TEXT;
UPDATE public_qa SET created_at = published_at, updated_at = published_at;
CREATE INDEX public_qa_visibility ON public_qa (lang, status, id DESC);

CREATE TABLE feedback_rate (
  identifier TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (identifier, bucket)
);
CREATE INDEX feedback_rate_bucket ON feedback_rate (bucket);
