# NEXXUS — Nexxathon Portal

A clean registration and operations portal for Nexxathon.

## Product decisions

- **Problem statements are the primary challenge unit.**
- **Tracks are filters/categories, not registration choices.**
- Teams register first and can choose a problem statement later.
- Maximum team capacity is four members.
- Admins can publish/edit/delete problem statements, manage teams and participants, approve members, publish announcements and resolve support tickets.
- No fixed institution/college branding is hard-coded into the portal.

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Set the required Supabase and security environment variables.
4. Run `npm install`.
5. Run `npm start`.
6. Open `/` for the participant portal and `/admin` for operations.

## Environment variables

`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ENCRYPTION_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD` are required for production. `ALLOWED_ORIGINS` is optional and accepts a comma-separated list.

For LAN testing from a separate frontend, add the computer's current Wi-Fi URL
(for example, `http://127.0.0.1:8080`) to `ALLOWED_ORIGINS`. The deployed
site always permits requests back to its own `/api` endpoint, including Vercel
preview URLs.

Do not commit `.env`, credentials or service keys.

## Supabase

Run `supabase_schema.sql` in the Supabase SQL editor before first use. The schema intentionally does not create public CRUD policies; the Express server is the application security boundary.

The browser only calls the local `/api` endpoints. Keep `SUPABASE_SECRET_KEY`
server-side (in `.env` locally and your host's environment-variable settings in
production); never add it or a service key to `js/api.js`. This project also
supports an ignored `.env.supabase` file as a local override when switching
Supabase projects.

Registration, joining a team, support requests, admin updates, announcements,
and problem statements all fail visibly if Supabase does not confirm the write.
They are never kept in an in-memory fallback cache.

## Deployment

This package is prepared for a standard Node/Express deployment. Configure
environment variables in your hosting provider rather than editing source
code. For Vercel, set every required variable for both **Production** and
**Preview**, then redeploy. `SUPABASE_URL` may be either the project URL or
the `/rest/v1` URL; the server normalizes it automatically.
