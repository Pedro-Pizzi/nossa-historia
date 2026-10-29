CREATE TABLE IF NOT EXISTS nh_accounts (
  id text PRIMARY KEY CHECK (id IN ('ana', 'pedro')),
  name text NOT NULL UNIQUE CHECK (name IN ('Ana', 'Pedro'))
);
INSERT INTO nh_accounts(id,name) VALUES ('ana','Ana'),('pedro','Pedro') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS nh_sessions (
  id uuid PRIMARY KEY, account_id text NOT NULL REFERENCES nh_accounts(id),
  account_version text NOT NULL, issued_at bigint NOT NULL, expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS nh_sessions_account ON nh_sessions(account_id,issued_at);
CREATE TABLE IF NOT EXISTS nh_login_limits (
  bucket text PRIMARY KEY CHECK (bucket IN ('ana','pedro','unknown')),
  attempts integer NOT NULL, until_ms bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS nh_collections (key text PRIMARY KEY, revision integer NOT NULL DEFAULT 0);
INSERT INTO nh_collections(key) VALUES
 ('nossa-historia-tres-diarios-v1'),('nossa-historia-descobertas-v1'),('nossa-historia-cartinhas-v1'),
 ('nossa-historia-desafios-v1'),('nossa-historia-convites-v1'),('nh-v3-choice'),('nh-v3-milestone'),('nh-v3-checkin')
 ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS nh_entries (
  id uuid PRIMARY KEY, ordinal bigserial NOT NULL UNIQUE, collection text NOT NULL REFERENCES nh_collections(key), group_key text NOT NULL DEFAULT '',
  author_id text NOT NULL REFERENCES nh_accounts(id), data jsonb NOT NULL,
  fingerprint text NOT NULL, original_author text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nh_entries_collection ON nh_entries(collection,created_at,id);
CREATE INDEX IF NOT EXISTS nh_entries_fingerprint ON nh_entries(collection,author_id,fingerprint);
CREATE TABLE IF NOT EXISTS nh_flags (
  key text PRIMARY KEY, done boolean NOT NULL, updated_by text NOT NULL REFERENCES nh_accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nh_media (
  id uuid PRIMARY KEY, author_id text NOT NULL REFERENCES nh_accounts(id),
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif')),
  bytes bytea NOT NULL CHECK (octet_length(bytes) <= 3145728),
  caption text NOT NULL DEFAULT '', date text NOT NULL DEFAULT '', sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), import_key text UNIQUE
);
CREATE TABLE IF NOT EXISTS nh_legacy_archive (
  id uuid PRIMARY KEY, author_id text NOT NULL REFERENCES nh_accounts(id),
  key text NOT NULL, value jsonb NOT NULL, fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(author_id,key,fingerprint)
);
