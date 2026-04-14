# Server Setup Guide

This guide walks through the fastest way to run the collaborative version of Elementary Classroom List Engine for local testing, home-server sharing, or a small pilot group.

It is written for a practical first deployment, not a large enterprise rollout.

## What this branch expects

This branch is web-first and uses three moving parts:

- a React frontend
- a Fastify backend API
- a PostgreSQL database

Shared roster data lives in Postgres. Users sign in through the backend, join workspaces, and edit through a single workspace lock.

## Fastest test setup: Docker Compose

This is the easiest way to get a shared test server running.

### Prerequisites

- Docker Desktop, Docker Engine, or another Docker-compatible runtime
- ports `8080`, `8787`, and `5432` available on the host

### Start the stack

From the project root:

```bash
docker compose up --build
```

That starts:

- frontend at `http://localhost:8080`
- backend inside the Compose network
- Postgres on `localhost:5432`

### Default admin account

The included Compose file bootstraps an admin user for first login:

- username: `admin`
- password: `change-me-now`

Change that password in `docker-compose.yml` before sharing the app with anyone else.

### First login checklist

1. Open `http://localhost:8080`
2. Sign in with the bootstrap admin account
3. Create a workspace
4. Create an invite for another editor or viewer
5. Open the invite in a separate browser profile or another machine
6. Verify one user can acquire the lock while the other sees read-only mode

## Important environment variables

The backend uses these environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `COOKIE_SECURE`
- `APP_BASE_URL`
- `APP_ALLOWED_ORIGINS`
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_DISPLAY_NAME`

Recommended local values:

```env
DATABASE_URL=postgres://classroom:classroom@postgres:5432/classroom_engine
SESSION_SECRET=replace-this-with-a-long-random-string
COOKIE_SECURE=false
APP_BASE_URL=http://localhost:8080
APP_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=change-me-now
BOOTSTRAP_ADMIN_DISPLAY_NAME=Server Admin
```

Notes:

- `SESSION_SECRET` should be long and random.
- `COOKIE_SECURE` should be `true` when you serve the app over HTTPS.
- `APP_ALLOWED_ORIGINS` should list every frontend origin allowed to make authenticated API writes.

## Home server deployment notes

For a private test on a home server:

1. Run the Compose stack on the server.
2. Put the server behind HTTPS.
3. Update `APP_BASE_URL` and `APP_ALLOWED_ORIGINS` to the real frontend URL.
4. Change the bootstrap admin password.
5. Limit access to trusted testers only.

Good private sharing options:

- Tailscale Serve
- Tailscale Funnel
- nginx or Caddy behind your own domain

If you expose the app beyond your local machine, do not leave the default admin password or placeholder session secret in place.

## Manual setup without Docker

If you want to run the pieces yourself, you can start them separately.

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

Create a database and user that match your chosen `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgres://classroom:classroom@127.0.0.1:5432/classroom_engine
```

### 3. Start the backend

Set the required environment variables, then run:

```bash
npm run server:start
```

The backend will:

- connect to Postgres
- run Drizzle migrations automatically
- create the bootstrap admin user if the configured username and password are set and the users table is empty

### 4. Start the frontend

In another terminal:

```bash
npm run dev
```

For local development, Vite proxies `/api` calls to the backend.

If you want both together in one command during development:

```bash
npm run dev:full
```

## Production-minded checklist

Before calling a server "ready for testers," make sure these are true:

- `SESSION_SECRET` is no longer a placeholder
- the bootstrap admin password has been changed
- `COOKIE_SECURE=true` when using HTTPS
- `APP_ALLOWED_ORIGINS` only includes trusted frontend URLs
- the database volume is persistent
- you can log in from two separate browser sessions
- one session can acquire the lock while the other becomes read-only
- stale saves show a conflict instead of overwriting newer edits
- invite acceptance works for a brand-new user

## Recommended smoke test

After the server is up, run this manual check:

1. Sign in as the admin user in Browser A.
2. Create a workspace.
3. Create an editor invite.
4. Accept that invite in Browser B.
5. In Browser A, acquire the lock and change the school name.
6. In Browser B, confirm the workspace is read-only.
7. Save in Browser A.
8. Reload in Browser B and confirm the new school name appears.
9. Release or take over the lock and confirm Browser B can edit.

## Troubleshooting

### Login succeeds but saves fail

Check:

- `APP_ALLOWED_ORIGINS`
- `APP_BASE_URL`
- whether the frontend is being served from the same URL you configured

This branch blocks mutating requests from untrusted origins.

### The app loads but no one can sign in

Check:

- backend logs
- `DATABASE_URL`
- whether Postgres is reachable
- whether the bootstrap admin variables were set before first startup

### The frontend opens but API calls fail

Check:

- backend container health/logs
- nginx reverse proxy config
- that `/api` is reaching the backend

### Two people can see the workspace but nobody can edit

Check:

- that the user has `owner` or `editor` role
- whether another active lock is still held
- whether the lock expired and needs takeover

## Files involved in deployment

- [docker-compose.yml](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/docker-compose.yml)
- [server/Dockerfile](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/server/Dockerfile)
- [docker/frontend.Dockerfile](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/docker/frontend.Dockerfile)
- [docker/nginx.conf](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/docker/nginx.conf)
- [server/config.ts](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/server/config.ts)
