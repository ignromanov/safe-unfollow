# Umami on a VPS

Self-hosted Umami for `m.safeunfollow.app`, moved off Vercel (Edge Request
limits) and Supabase (500 MB Free-plan database cap, which forced data
purges). The target is one small VPS — OVHcloud VPS-1, 2 vCPU / 4 GB /
40 GB NVMe, ~€4.50/month — running Umami and Postgres side by side, with
Cloudflare in front.

```
visitor ──https──▶ Cloudflare edge ──tunnel──▶ cloudflared ──▶ umami:3000 ──▶ db (Postgres 17)
                   (caches su.js)              └──────────── one VPS, no open ports but SSH ───┘
```

The hostname stays `m.safeunfollow.app`, so the site's CSP and its
`VITE_UMAMI_*` variables do not change.

Sizing, measured on Supabase in October 2026: ~510K events and ~490 MB in
under a month (`website_event` 282 MB, `event_data` 205 MB). That is
0.6–0.8 GB a month, so the ~35 GB left on the disk lasts years even with no
retention at all.

| File                 | What it does                                                                           |
| -------------------- | -------------------------------------------------------------------------------------- |
| `docker-compose.yml` | Umami (pinned version), Postgres 17, Cloudflare Tunnel                                 |
| `.env.example`       | Every setting, with where to get it                                                    |
| `bin/migrate.sh`     | Full copy Supabase → local Postgres                                                    |
| `bin/sync-delta.sh`  | Copies rows the old instance wrote after the full copy; idempotent                     |
| `bin/backup.sh`      | Nightly `pg_dump` to Cloudflare R2                                                     |
| `bin/retention.sh`   | Weekly delete of data older than `RETENTION_DAYS`, using `scripts/umami-retention.sql` |

The scripts need only Docker on the host; `psql`/`pg_dump` run inside the `db`
container, and that includes the connection to Supabase.

---

## Runbook

### 0. Before you start

- `safeunfollow.app` DNS is on Cloudflare (a tunnel can only publish into a
  Cloudflare zone).
- From the Vercel Umami project → Settings → Environment Variables, copy
  `APP_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `TRACKER_SCRIPT_NAME`,
  `COLLECT_API_ENDPOINT` — whichever exist.
- Note the Umami version the Vercel instance runs (dashboard → profile menu →
  About). The new instance must start on exactly that version.
- From Supabase → Connect, copy the **Session pooler** URI (port 5432).

### 1. Order and prepare the VPS

OVHcloud → VPS → VPS-1, Ubuntu 24.04, an EU datacentre. Add your SSH key at
checkout. Then, as root:

```sh
apt update && apt -y full-upgrade
curl -fsSL https://get.docker.com | sh

# 2 GB swap as a safety margin for Postgres + Node on 4 GB of RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Nothing listens publicly except SSH — the tunnel is outbound
ufw allow OpenSSH && ufw --force enable
```

Ubuntu installs security updates unattended by default; leave that on.

### 2. Check out this folder

```sh
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/ignromanov/safe-unfollow.git /opt/safe-unfollow
cd /opt/safe-unfollow
git sparse-checkout set infra/umami scripts
cd infra/umami
cp .env.example .env && chmod 600 .env
```

Fill in `.env` from the notes in it. Wrap a value in single quotes if it
contains `$` (docker compose would otherwise expand it).

> `APP_SECRET`: if Vercel had none, Umami was deriving its secret from
> `DATABASE_URL`. Paste the old Supabase `DATABASE_URL` as `APP_SECRET` and the
> derived secret stays identical — no one is logged out, and visitor tokens in
> flight keep validating.

### 3. Cloudflare

1. **Tunnel**: Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared.
   Copy the token from the Docker install command into
   `CLOUDFLARE_TUNNEL_TOKEN`. Add a public hostname for the rehearsal:
   `m-new.safeunfollow.app` → `HTTP` → `umami:3000`.
2. **Location headers**: Rules → Settings → Managed Transforms → turn on
   **Add visitor location headers**. Umami reads `cf-ipcountry`,
   `cf-region-code` and `cf-ipcity`; without the transform only the
   country arrives and region/city go empty.
3. **R2**: create bucket `safeunfollow-umami-backups`. Add a lifecycle rule
   that deletes objects after 30 days. Create an R2 API token with "Object
   Read & Write" on that bucket only; fill the `R2_*` values.

### 4. Rehearsal (no impact on production)

```sh
docker compose up -d --wait db
bin/migrate.sh             # prints source → local row counts
docker compose up -d       # umami applies no migrations: same version
```

Check `https://m-new.safeunfollow.app`: log in with the existing account, and
compare a few reports with the old dashboard.
`curl -s https://m-new.safeunfollow.app/api/config` should report
`"trackerScriptName":"su.js"`.

### 5. Cutover

```sh
docker compose stop cloudflared umami
bin/migrate.sh --force     # fresh copy; records its start time for sync-delta
docker compose up -d
```

Then in Cloudflare:

1. DNS → delete the `m` record that points at Vercel.
2. Tunnel → Public hostnames → add `m.safeunfollow.app` → `HTTP` →
   `umami:3000` (this creates the proxied CNAME). Remove `m-new`.

Verify:

```sh
curl -sI https://m.safeunfollow.app/su.js | grep -iE '^server|x-vercel'   # server: cloudflare, no x-vercel-*
```

Open the site in a browser and watch the visit appear in Realtime.

Resolvers that cached the old record keep sending some visitors to Vercel for
a while, and Vercel keeps writing them to Supabase. Leave the Vercel project
running and copy those rows across:

```sh
bin/sync-delta.sh          # after 1 hour, and again after 48 hours
```

It skips rows it already has, so running it more than once is safe.

### 6. Schedule backups and retention

`crontab -e` as root:

```cron
17 3 * * * cd /opt/safe-unfollow/infra/umami && bin/backup.sh >> /var/log/umami-backup.log 2>&1
47 3 * * 0 cd /opt/safe-unfollow/infra/umami && bin/retention.sh >> /var/log/umami-retention.log 2>&1
```

Run `bin/backup.sh` once by hand and check the object in the R2 bucket.

### 7. Decommission (after the 48-hour sync-delta)

- Vercel: delete the Umami project.
- Remove `SOURCE_DATABASE_URL` from `.env`, and remove `dumps/source-*.dump` and `dumps/restore.list`.
- In this repository, delete `.github/workflows/umami-cleanup.yml` and the
  `UMAMI_DB_URL` secret. Retention now runs on the VPS.
- Supabase: pause the project, and delete it a week later.
- Optional: a free uptime monitor on `https://m.safeunfollow.app/api/heartbeat`.

---

## Operations

```sh
docker compose ps
docker compose logs -f umami
df -h / && docker compose exec db psql -U umami -c "select pg_size_pretty(pg_database_size('umami'))"
```

**Upgrade Umami** (only after decommission — `sync-delta.sh` needs matching
schemas): `bin/backup.sh`, set the new `UMAMI_VERSION` in `.env`,
`docker compose up -d`. Migrations apply on start.

**Restore a backup**: the commands are in the header of `bin/backup.sh`. Pull
the file from R2 into `dumps/` first if it is older than three days.

**Update these scripts**: `git -C /opt/safe-unfollow pull`.
