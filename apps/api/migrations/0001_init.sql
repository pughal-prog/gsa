PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','staff','student')),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE sports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'indoor'
);

CREATE TABLE staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  dob TEXT,
  phone TEXT,
  photo_key TEXT,
  primary_sport_id INTEGER REFERENCES sports(id),
  experience_years REAL DEFAULT 0,
  category TEXT,
  training TEXT,
  achievements TEXT,
  major_domain TEXT,
  permissions TEXT NOT NULL DEFAULT '["students.view","attendance.mark","achievements.edit","fees.view"]',
  joined_on TEXT
);

CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  admission_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dob TEXT,
  birthplace TEXT,
  identification_mark TEXT,
  address TEXT,
  photo_key TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  parent_occupation TEXT,
  joined_on TEXT,
  school TEXT,
  college TEXT,
  academic_year TEXT,
  studying TEXT,
  remarks TEXT,
  biometric_id TEXT UNIQUE,
  batch_time TEXT NOT NULL DEFAULT '17:00',
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sport_id INTEGER NOT NULL REFERENCES sports(id),
  staff_id INTEGER REFERENCES staff(id),
  level TEXT,
  category TEXT,
  sport_meta TEXT,
  joined_on TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (student_id, sport_id)
);

CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sport_id INTEGER REFERENCES sports(id),
  title TEXT NOT NULL,
  level TEXT,
  position TEXT,
  event_date TEXT,
  cash_prize REAL DEFAULT 0,
  photo_key TEXT
);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sport_id INTEGER REFERENCES sports(id),
  event TEXT NOT NULL,
  category TEXT,
  event_date TEXT,
  result TEXT,
  photo_key TEXT
);

CREATE TABLE academic_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  year TEXT NOT NULL,
  percentage REAL,
  notes TEXT
);

CREATE TABLE fee_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport_id INTEGER NOT NULL REFERENCES sports(id),
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly'
);

CREATE TABLE fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','waived')),
  paid_on TEXT,
  method TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  reminder_sent_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fees_student ON fees(student_id, status);

CREATE TABLE incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('student_fee','entry_fee','cash_prize','equipment_sale','other')),
  amount REAL NOT NULL,
  student_id INTEGER REFERENCES students(id),
  note TEXT,
  income_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','pending'))
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  expense_date TEXT NOT NULL
);

CREATE TABLE equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sport_id INTEGER REFERENCES sports(id),
  qty INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 2,
  cost_price REAL DEFAULT 0,
  sale_price REAL DEFAULT 0
);

CREATE TABLE equipment_txns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  type TEXT NOT NULL CHECK (type IN ('purchase','sale','issue','return','damage')),
  qty INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  student_id INTEGER REFERENCES students(id),
  party TEXT,
  txn_date TEXT NOT NULL,
  note TEXT
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  att_date TEXT NOT NULL,
  check_in TEXT,
  status TEXT NOT NULL CHECK (status IN ('present','late','absent')),
  source TEXT NOT NULL DEFAULT 'biometric',
  UNIQUE (student_id, att_date)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  to_phone TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('profile','prize','match','other')),
  r2_key TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('query','suggestion','report','help')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO sports (name) VALUES ('Fencing'), ('Table Tennis'), ('Carrom'), ('Chess'), ('Physical Fitness');
