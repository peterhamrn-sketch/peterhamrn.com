-- Additive workspace metadata; does not change subscribers, deliveries, or frozen payloads.
CREATE TABLE IF NOT EXISTS subscription_announcement_senders (
 announcement_id TEXT PRIMARY KEY REFERENCES subscription_announcement_drafts(id),
 topic_id TEXT NOT NULL REFERENCES subscription_topics(id)
);
CREATE TABLE IF NOT EXISTS subscription_manual_approvals (
 update_id TEXT PRIMARY KEY REFERENCES subscription_updates(id),
 approved_at TEXT NOT NULL
);
