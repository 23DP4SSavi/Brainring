CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  answer TEXT NOT NULL CHECK (length(trim(answer)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;