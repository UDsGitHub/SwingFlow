-- ============================================================
-- SwingFlow — Persisted developing candidates
-- ============================================================

CREATE TABLE IF NOT EXISTS developing_candidates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL,
  symbol             TEXT NOT NULL,
  strategy           TEXT NOT NULL,
  direction          TEXT NOT NULL DEFAULT 'LONG',
  confidence         NUMERIC NOT NULL,
  explanation        TEXT NOT NULL,
  entry_zone_low       NUMERIC,
  entry_zone_high      NUMERIC,
  status               TEXT NOT NULL DEFAULT 'ACTIVE',
  sessions_seen        INTEGER NOT NULL DEFAULT 0,
  first_seen_at        BIGINT NOT NULL,
  last_seen_at         BIGINT NOT NULL,
  converted_at         BIGINT,
  last_scan_id         UUID,
  UNIQUE (user_id, symbol, strategy),
  CONSTRAINT developing_candidates_status_chk
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'CONVERTED'))
);

CREATE INDEX IF NOT EXISTS idx_developing_candidates_user_status_seen
  ON developing_candidates (user_id, status, last_seen_at DESC);
