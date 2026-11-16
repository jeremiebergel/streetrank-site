CREATE TABLE IF NOT EXISTS matches (
  code TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  pseudo TEXT NOT NULL,
  team TEXT NOT NULL,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  top1 TEXT, top2 TEXT, top3 TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(code, pseudo)
);
CREATE INDEX IF NOT EXISTS idx_decl_pseudo ON declarations(pseudo);
