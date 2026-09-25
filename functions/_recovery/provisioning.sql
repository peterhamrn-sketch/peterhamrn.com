ALTER TABLE recovery_tags ADD COLUMN serial_number TEXT;
ALTER TABLE recovery_tags ADD COLUMN programmed_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS recovery_tags_serial_number ON recovery_tags(serial_number) WHERE serial_number IS NOT NULL;
