import { pool } from "@/db";

// Self-healing schema bootstrap. Creates all tables if they don't exist yet,
// so a brand-new sandbox/database can never produce Internal Server Errors.
// Cached promise → runs at most once per server process (retries on failure).

let pending: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!pending) {
    pending = createAll().catch((err) => {
      pending = null; // allow retry on next request
      throw err;
    });
  }
  return pending;
}

async function createAll(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      framework text NOT NULL DEFAULT 'vanilla',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id serial PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      meta jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS files (
      id serial PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path text NOT NULL,
      content text NOT NULL DEFAULT '',
      language text NOT NULL DEFAULT 'plaintext',
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chart_analyses (
      id serial PRIMARY KEY,
      symbol text NOT NULL DEFAULT '',
      timeframe text NOT NULL DEFAULT '',
      verdict text NOT NULL DEFAULT 'HOLD',
      confidence integer NOT NULL DEFAULT 0,
      analysis text NOT NULL DEFAULT '',
      indicators jsonb,
      source text NOT NULL DEFAULT 'gemini',
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id serial PRIMARY KEY,
      provider text NOT NULL UNIQUE,
      key_value text NOT NULL,
      tier text NOT NULL DEFAULT 'free',
      status text NOT NULL DEFAULT 'active',
      note text NOT NULL DEFAULT '',
      last_error text NOT NULL DEFAULT '',
      last_status_code integer,
      limited_at timestamp,
      last_used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id serial PRIMARY KEY,
      provider text NOT NULL,
      endpoint text NOT NULL DEFAULT '',
      ok boolean NOT NULL DEFAULT true,
      status_code integer,
      tokens_in integer NOT NULL DEFAULT 0,
      tokens_out integer NOT NULL DEFAULT 0,
      latency_ms integer NOT NULL DEFAULT 0,
      error text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admin_config (
      id serial PRIMARY KEY,
      config_key text NOT NULL UNIQUE,
      config_value text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      username text NOT NULL UNIQUE,
      password_salt text NOT NULL,
      password_hash text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      can_signals boolean NOT NULL DEFAULT true,
      can_analyze boolean NOT NULL DEFAULT false,
      can_generate boolean NOT NULL DEFAULT true,
      last_login_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}
