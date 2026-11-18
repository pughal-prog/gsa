-- Student medical records (owner only, plus the student's own view)
CREATE TABLE student_medical (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  takes_medicine INTEGER NOT NULL DEFAULT 0,
  medicine_details TEXT,
  has_allergy INTEGER NOT NULL DEFAULT 0,
  allergy_details TEXT,
  had_surgery INTEGER NOT NULL DEFAULT 0,
  surgery_details TEXT,
  bone_damage INTEGER NOT NULL DEFAULT 0,
  bone_details TEXT,
  other_issues TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CCTV cameras (stream links, owner only by default)
CREATE TABLE cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  stream_url TEXT NOT NULL,
  stream_type TEXT NOT NULL DEFAULT 'hls' CHECK (stream_type IN ('hls','mjpeg','image','embed')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Files kept in D1 when no R2 bucket is bound (free tier, no card needed)
CREATE TABLE blobs (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  b64 TEXT NOT NULL
);

-- Unread tracking for the notification bell
ALTER TABLE users ADD COLUMN notif_seen_id INTEGER NOT NULL DEFAULT 0;

-- Device tokens for phone push (optional)
CREATE TABLE device_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
