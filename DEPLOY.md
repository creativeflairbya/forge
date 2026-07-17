# Deploying Forge to a permanent URL

This is a standard Next.js 16 + PostgreSQL app. Two proven paths below.
Both give you a permanent URL. The app self-heals: on first contact it
creates all database tables and the admin account automatically.

Default login after first deploy: `admin` / `ForgeMaster@2026`
→ change it in /admin immediately (on a permanent DB it sticks forever).

---

## Option 1 — Vercel + Neon (easiest, $0)

1. Push this project to a GitHub repository.
2. Create a free Postgres DB at https://neon.tech → copy the connection
   string (`postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`).
3. On https://vercel.com → Add New Project → import the repo.
   - Environment variable: `DATABASE_URL` = the Neon string.
   - Deploy.
4. Open `https://your-app.vercel.app/api/health` once → `{"ok":true}`
   means tables + admin account were created.
5. Log in at `/admin`, change the password, add your Gemini key
   (`AIza…` from https://aistudio.google.com/app/apikey), press "Test now".

Notes:
- Live crypto prices stream directly from the user's browser to Binance,
  so Vercel serverless is fully compatible.
- Free tier cold starts (~1-2s after idle) are normal.

---

## Option 2 — Your own server (VPS: Ubuntu/Debian)

⚠️ IMPORTANT: the app sets `Secure` login cookies, so it MUST be served
over HTTPS. The Caddy step below gives you free auto-renewing SSL.
Without HTTPS, login will silently fail.

### 1. Install Node.js 20+ and PostgreSQL

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql
```

### 2. Create the database and user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER forge WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE forge_db OWNER forge;
SQL
```

### 3. Get the code onto the server and configure

```bash
git clone https://github.com/YOURNAME/YOURREPO.git forge
cd forge

# Environment
cat > .env <<'ENV'
DATABASE_URL=postgresql://forge:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/forge_db
ENV

npm ci
npm run build
```

No manual table creation needed — the app creates its own schema on
first request (self-healing bootstrap).

### 4. Run it as a service (pm2)

```bash
sudo npm install -g pm2
pm2 start npm --name forge -- start   # serves on port 3000
pm2 save
pm2 startup                            # auto-start on reboot; run printed cmd
```

### 5. HTTPS + domain with Caddy (free automatic SSL)

Point your domain's A record at the server IP, then:

```bash
sudo apt-get install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtains and renews the SSL certificate automatically.

### 6. First run

- Visit `https://yourdomain.com/api/health` → should return `{"ok":true}`
  (tables + admin created).
- Log in at `https://yourdomain.com/admin` with the default credentials,
  change the password, add your API keys in the Key Vault.

### Maintenance cheatsheet

```bash
pm2 logs forge          # view app logs
pm2 restart forge       # restart after changes
git pull && npm ci && npm run build && pm2 restart forge   # update
sudo -u postgres pg_dump forge_db > backup.sql             # backup DB
```

---

## Environment variables reference

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `GEMINI_API_KEY` | optional | fallback if no key saved in admin vault |
| `GEMINI_MODEL` | optional | default `gemini-2.0-flash` |
| `OPENAI_API_KEY` | optional | OpenAI-compatible provider key |
| `OPENAI_BASE_URL` | optional | e.g. Groq / OpenRouter endpoint |
| `OPENAI_MODEL` | optional | default `gpt-4o-mini` |
| `BINANCE_BASE_URL` | optional | default `https://data-api.binance.vision` |

## Pages

- `/` — AI WebApp builder (dashboard + API docs)
- `/signals` — live crypto signals (login required)
- `/login` — user sign-in (accounts created by admin)
- `/admin` — master admin: key vault, real usage stats, user management
