import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/swingflow.db');

let _db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS watchlist (
  symbol    TEXT PRIMARY KEY,
  added_at  INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trade_setups (
  id                TEXT PRIMARY KEY,
  symbol            TEXT NOT NULL,
  strategy          TEXT NOT NULL,
  direction         TEXT NOT NULL,
  entry             REAL NOT NULL,
  stop              REAL NOT NULL,
  target            REAL NOT NULL,
  confidence        REAL NOT NULL,
  risk_reward       REAL NOT NULL,
  detected_at       INTEGER NOT NULL,
  status            TEXT DEFAULT 'ACTIVE',
  notes             TEXT,
  stock_suggestion  TEXT,
  options_suggestion TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  setup_id  TEXT,
  type      TEXT NOT NULL,
  message   TEXT NOT NULL,
  sent_at   INTEGER NOT NULL,
  delivered INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT UNIQUE NOT NULL,
  auth       TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('accountSize',  '5000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('dailyGoal',    '100');
INSERT OR IGNORE INTO settings (key, value) VALUES ('riskPercent',  '1.5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('dataProvider', 'mock');

-- Default watchlist
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('AAPL', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('NVDA', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('TSLA', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('MSFT', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('AMD',  unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('META', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('AMZN', unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('SPY',  unixepoch() * 1000, 1);
INSERT OR IGNORE INTO watchlist (symbol, added_at, is_active) VALUES ('QQQ',  unixepoch() * 1000, 1);
`;

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.exec(SCHEMA);
    console.log('[DB] Database initialized at', DB_PATH);
  }
  return _db;
}
