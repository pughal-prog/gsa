ALTER TABLE achievements ADD COLUMN age_category TEXT;
ALTER TABLE matches ADD COLUMN age_category TEXT;
ALTER TABLE equipment ADD COLUMN category TEXT;
ALTER TABLE notifications ADD COLUMN batch TEXT;
ALTER TABLE fee_plans ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Fee structure assigned to a student (custom amount overrides the plan amount)
CREATE TABLE student_fee_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES fee_plans(id) ON DELETE CASCADE,
  custom_amount REAL,
  UNIQUE (student_id, plan_id)
);
