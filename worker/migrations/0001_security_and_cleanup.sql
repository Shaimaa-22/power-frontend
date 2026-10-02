-- Apply once, after the existing schema.sql. Existing hashes and content are preserved.
ALTER TABLE admins ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE items ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN image_storage TEXT NOT NULL DEFAULT 'b2' CHECK (image_storage IN ('b2', 'r2'));

CREATE TRIGGER admins_revoke_sessions AFTER UPDATE OF password_hash, is_active ON admins
WHEN NEW.password_hash != OLD.password_hash OR NEW.is_active != OLD.is_active
BEGIN
  UPDATE admins SET token_version = OLD.token_version + 1 WHERE id = NEW.id;
END;

-- Durable outbox: item mutation and cleanup scheduling share the same transaction.
CREATE TABLE image_cleanup (
  filename TEXT NOT NULL,
  storage_driver TEXT NOT NULL CHECK (storage_driver IN ('b2', 'r2')),
  available_at INTEGER NOT NULL DEFAULT (unixepoch()),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease TEXT,
  PRIMARY KEY (filename, storage_driver)
);
CREATE INDEX idx_image_cleanup_due ON image_cleanup(available_at);
CREATE INDEX idx_items_image ON items(image_url, image_storage);

CREATE TRIGGER items_cleanup_delete AFTER DELETE ON items
WHEN OLD.image_url IS NOT NULL
BEGIN
  INSERT INTO image_cleanup(filename, storage_driver) VALUES (OLD.image_url, OLD.image_storage)
  ON CONFLICT(filename, storage_driver) DO UPDATE SET available_at = unixepoch(), lease = NULL;
END;

CREATE TRIGGER items_cleanup_update AFTER UPDATE OF image_url, image_storage ON items
WHEN OLD.image_url IS NOT NULL AND (OLD.image_url IS NOT NEW.image_url OR OLD.image_storage != NEW.image_storage)
BEGIN
  INSERT INTO image_cleanup(filename, storage_driver) VALUES (OLD.image_url, OLD.image_storage)
  ON CONFLICT(filename, storage_driver) DO UPDATE SET available_at = unixepoch(), lease = NULL;
END;
