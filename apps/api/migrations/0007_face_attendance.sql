-- Face attendance (separate GSA Face Attendance phone app).
-- ADDITIVE ONLY: no existing table, column or constraint is changed or removed.
-- attendance keeps UNIQUE (student_id, att_date): it stays the one daily summary row that the
-- website, the app, reports and parent notifications already read. Every scan is stored in
-- attendance_events, and the daily row is derived from the events (first ENTRY sets check_in,
-- latest EXIT sets check_out).

ALTER TABLE attendance ADD COLUMN check_out TEXT;

-- One row per authorised phone. The phone holds a random token; only its SHA-256 is stored here.
CREATE TABLE face_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT UNIQUE,
  mode TEXT NOT NULL DEFAULT 'ENTRY' CHECK (mode IN ('ENTRY','EXIT')),
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paired_at TEXT,
  last_seen TEXT,
  revoked_at TEXT
);

-- One-time pairing codes (stored hashed, short lived).
CREATE TABLE face_pairing_codes (
  code_hash TEXT PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES face_devices(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Consent and lifecycle of a student's face template. The template itself NEVER leaves the phone;
-- the server only keeps this metadata.
CREATE TABLE face_enrolments (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('consented','enrolled','revoked')),
  is_minor INTEGER NOT NULL DEFAULT 1,
  guardian_name TEXT,
  guardian_relation TEXT,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  consent_recorded_by INTEGER REFERENCES users(id),
  enrolled_at TEXT,
  enrolled_device_id INTEGER REFERENCES face_devices(id),
  model_sha TEXT,
  retention_until TEXT,
  revoked_at TEXT,
  revoked_by INTEGER REFERENCES users(id),
  delete_confirmed_at TEXT
);

-- Every ENTRY / EXIT scan. event_id is generated on the phone, so a retried upload is idempotent.
CREATE TABLE attendance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES face_devices(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY','EXIT')),
  method TEXT NOT NULL DEFAULT 'face' CHECK (method IN ('face','manual')),
  occurred_at TEXT NOT NULL,
  att_date TEXT NOT NULL,
  att_time TEXT NOT NULL,
  match_score REAL,
  liveness_score REAL,
  marked_by TEXT,
  applied INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_att_events_student_day ON attendance_events (student_id, att_date);
CREATE INDEX idx_att_events_day ON attendance_events (att_date);
