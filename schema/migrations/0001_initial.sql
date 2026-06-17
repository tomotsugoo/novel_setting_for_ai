-- NovelSync v0.1 Initial Schema

CREATE TABLE IF NOT EXISTS timeline_branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_branch_id TEXT NULL,
  branch_point_time TEXT
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',  -- JSON array
  role TEXT CHECK(role IN ('protagonist', 'antagonist', 'supporting')),
  is_twin INTEGER DEFAULT 0,
  twin_of TEXT REFERENCES characters(id),
  secret TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS character_states (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  valid_from TEXT NOT NULL,  -- ISO8601 story time
  valid_to TEXT NULL,        -- NULL = current
  location TEXT,
  status TEXT CHECK(status IN ('alive', 'dead', 'missing', 'unknown')),
  appearance TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  story_time TEXT,
  narrative_order INTEGER,
  location TEXT,
  timeline_branch_id TEXT REFERENCES timeline_branches(id),
  disclosure_notes TEXT,
  is_written INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  character_id_a TEXT NOT NULL REFERENCES characters(id),
  character_id_b TEXT NOT NULL REFERENCES characters(id),
  relation_type TEXT CHECK(relation_type IN ('friend', 'enemy', 'family', 'lover', 'unknown')),
  valid_from TEXT,
  valid_to TEXT,
  notes TEXT,
  is_public INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS world_rules (
  id TEXT PRIMARY KEY,
  category TEXT CHECK(category IN ('physics', 'magic', 'technology', 'society')),
  rule TEXT NOT NULL,
  applies_from TEXT NULL  -- NULL = all time
);
