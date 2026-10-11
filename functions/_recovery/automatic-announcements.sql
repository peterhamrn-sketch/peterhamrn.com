-- Reuse the existing subscriber/preferences/updates/delivery database and tables.
CREATE TABLE IF NOT EXISTS subscription_automatic_updates (
 update_id TEXT PRIMARY KEY REFERENCES subscription_updates(id),details_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending',last_error TEXT,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscription_auto_delivery_meta (
 update_id TEXT NOT NULL,email TEXT NOT NULL,payload_json TEXT NOT NULL,idempotency_key TEXT NOT NULL,
 first_attempt_at TEXT,last_attempt_at TEXT,last_error TEXT,
 PRIMARY KEY(update_id,email),FOREIGN KEY(update_id,email) REFERENCES subscription_deliveries(update_id,email)
);
INSERT OR IGNORE INTO subscription_topics(id,label) VALUES('asm-instructor','ASM Instructor');
