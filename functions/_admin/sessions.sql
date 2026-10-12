CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,user_name TEXT NOT NULL,credential_hash TEXT NOT NULL,
 remembered INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiration ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_login_attempts (id TEXT PRIMARY KEY,ip_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS admin_login_attempts_rate ON admin_login_attempts(ip_hash,created_at);
