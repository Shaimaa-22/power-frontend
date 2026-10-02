-- ==========================================
-- Power Website - D1 (SQLite) schema
-- Run once:  npm run db:init:local   /   npm run db:init:remote
-- ==========================================

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_he TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_he TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  description_he TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_service_id ON categories(service_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);

-- The 4 fixed services
INSERT OR IGNORE INTO services (slug, icon) VALUES
  ('industrial-electricity', 'bolt'),
  ('residential-electricity', 'home'),
  ('solar-energy', 'sun'),
  ('iot-smart-solutions', 'cpu');
