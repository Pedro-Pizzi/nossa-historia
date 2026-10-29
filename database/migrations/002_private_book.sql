CREATE TABLE IF NOT EXISTS nh_book (
 id text PRIMARY KEY CHECK(id='primary'), data jsonb NOT NULL,
 sha256 text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nh_book_assets (
 path text PRIMARY KEY, mime text NOT NULL, bytes bytea NOT NULL,
 sha256 text NOT NULL, CHECK(octet_length(bytes)<=20971520)
);
