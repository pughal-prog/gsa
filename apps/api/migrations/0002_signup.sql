-- Self sign-up: accounts wait for owner approval before they can sign in.
ALTER TABLE users ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN signup_note TEXT;
