-- Apply only to peterhamrn-little-mini. Additive; existing prose/revisions stay intact.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS mini_release_queue (
 chapter_id TEXT PRIMARY KEY REFERENCES mini_chapters(id),
 scheduled_at TEXT, approved_revision TEXT REFERENCES mini_revisions(id),
 published_at TEXT
);
CREATE INDEX IF NOT EXISTS mini_due_releases ON mini_release_queue(scheduled_at);
CREATE TABLE IF NOT EXISTS mini_release_events (
 id TEXT PRIMARY KEY, action TEXT NOT NULL, chapter_ids TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mini_track_numbers ON mini_chapters(kind,number);
