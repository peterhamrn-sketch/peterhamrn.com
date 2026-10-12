-- Additive public email-link authentication. Existing preferences, sessions,
-- code challenges, announcements, and delivery history are not changed.
CREATE TABLE IF NOT EXISTS subscription_link_challenges (
 token_hash TEXT PRIMARY KEY,
 id TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('subscribe','manage')),
 ip_mac TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 consumed_at TEXT,
 consumption_id TEXT,
 revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS subscription_link_rate
 ON subscription_link_challenges(created_at,email,ip_mac);
CREATE TABLE IF NOT EXISTS subscription_link_topics (
 token_hash TEXT NOT NULL REFERENCES subscription_link_challenges(token_hash),
 topic_id TEXT NOT NULL REFERENCES subscription_topics(id),
 PRIMARY KEY(token_hash,topic_id)
);
