CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  answer TEXT NOT NULL CHECK (length(trim(answer)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1))
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  days TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('easy', 'medium', 'hard')),
  label TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
) STRICT;
CREATE INDEX IF NOT EXISTS alarms_user ON alarms(user_id);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image TEXT,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL
) STRICT;
INSERT OR IGNORE INTO quiz_questions VALUES
  (1, 'easy', 'a little brain warm-up', NULL, '["12", "15", "18"]', 1),
  (2, 'medium', 'wake up those neurons!', NULL, '["36", "42", "48"]', 1),
  (3, 'hard', 'who dis?!', '/images/sahur.png', '["Tralalero Tralala", "Bombardiro Crocodilo", "Tung Tung Tung Sahur"]', 2);
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  time TEXT NOT NULL,
  mode TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS challenges_user ON challenges(user_id, solved);