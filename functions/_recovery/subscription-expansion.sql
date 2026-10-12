-- Additive: no enrollment, no existing publication/recipient changes.
INSERT OR IGNORE INTO subscription_topics(id,label) VALUES ('classes-basic','Basic ASM Classes'),('classes-advanced','Advanced ASM Classes');
CREATE TABLE IF NOT EXISTS subscription_announcement_drafts (
 id TEXT PRIMARY KEY,mode TEXT NOT NULL CHECK(mode IN ('published','standalone')),
 subject TEXT NOT NULL,message TEXT NOT NULL,links_json TEXT NOT NULL DEFAULT '[]',publication_date TEXT,
 operation_id TEXT,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','prepared','approved','sent')),
 version INTEGER NOT NULL DEFAULT 1,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscription_announcement_topics (
 announcement_id TEXT NOT NULL REFERENCES subscription_announcement_drafts(id),topic_id TEXT NOT NULL REFERENCES subscription_topics(id),PRIMARY KEY(announcement_id,topic_id)
);
CREATE TABLE IF NOT EXISTS subscription_unsubscribe_scopes (
 token_hash TEXT NOT NULL REFERENCES subscription_unsubscribe(token_hash),topic_id TEXT NOT NULL REFERENCES subscription_topics(id),PRIMARY KEY(token_hash,topic_id)
);
