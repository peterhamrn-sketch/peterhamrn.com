-- Additive migration: no owner records or existing preferences are changed.
CREATE TABLE IF NOT EXISTS subscription_topics (id TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
INSERT OR IGNORE INTO subscription_topics(id,label) VALUES ('little-mini','Little Mini'),('recovery-tags','Recovery Tags');
CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS subscriber_topics (email TEXT NOT NULL REFERENCES subscribers(email), topic_id TEXT NOT NULL REFERENCES subscription_topics(id), active INTEGER NOT NULL DEFAULT 0, confirmed_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(email,topic_id));
CREATE TABLE IF NOT EXISTS subscription_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, topic_id TEXT, code_mac TEXT NOT NULL, ip_mac TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS subscription_challenge_rate ON subscription_challenges(created_at,email,ip_mac);
CREATE TABLE IF NOT EXISTS subscription_sessions (session_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscription_unsubscribe (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, topic_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscription_updates (id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, published_at TEXT NOT NULL, created_at TEXT NOT NULL, audience_frozen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS subscription_deliveries (update_id TEXT NOT NULL REFERENCES subscription_updates(id), email TEXT NOT NULL, status TEXT NOT NULL, resend_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY(update_id,email));
