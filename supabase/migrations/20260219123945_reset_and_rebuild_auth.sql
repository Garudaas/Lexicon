/*
  # Full Reset and Rebuild for LEXICON Auth Schema
  Drops all existing LEXICON tables and recreates them cleanly.
*/

DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS game_history CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  active_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert" ON users FOR INSERT TO anon
  WITH CHECK (username IS NOT NULL AND email IS NOT NULL AND password_hash IS NOT NULL AND length(username) >= 3);

CREATE POLICY "users_select" ON users FOR SELECT TO anon
  USING (email IS NOT NULL);

CREATE POLICY "users_update" ON users FOR UPDATE TO anon
  USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE POLICY "sessions_select" ON sessions FOR SELECT TO anon
  USING (expires_at > now());

CREATE POLICY "sessions_insert" ON sessions FOR INSERT TO anon
  WITH CHECK (user_id IS NOT NULL AND token IS NOT NULL);

CREATE POLICY "sessions_update" ON sessions FOR UPDATE TO anon
  USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);

CREATE TABLE verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  otp text NOT NULL,
  type text NOT NULL CHECK (type IN ('email_verify', 'password_reset')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vt_token ON verification_tokens(token);
CREATE INDEX idx_vt_user_id ON verification_tokens(user_id);

CREATE POLICY "vt_select" ON verification_tokens FOR SELECT TO anon
  USING (used = false AND expires_at > now());

CREATE POLICY "vt_insert" ON verification_tokens FOR INSERT TO anon
  WITH CHECK (user_id IS NOT NULL AND token IS NOT NULL AND type IN ('email_verify', 'password_reset'));

CREATE POLICY "vt_update" ON verification_tokens FOR UPDATE TO anon
  USING (id IS NOT NULL) WITH CHECK (used = true);
