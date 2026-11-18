-- Rate limiting for the public website assistant (no personal data kept)
CREATE TABLE chat_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_hits ON chat_hits (ip, created_at);
