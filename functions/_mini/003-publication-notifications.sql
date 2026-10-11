-- Publication outbox only: no chapter text, approval or release dates are changed.
CREATE TABLE IF NOT EXISTS mini_publication_outbox (
 chapter_id TEXT PRIMARY KEY REFERENCES mini_chapters(id),event_id TEXT NOT NULL,
 topic_id TEXT NOT NULL DEFAULT 'little-mini',kind TEXT NOT NULL,number INTEGER NOT NULL,
 title TEXT NOT NULL,path TEXT NOT NULL,published_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',last_error TEXT,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mini_publication_notification_events ON mini_publication_outbox(event_id,status);
