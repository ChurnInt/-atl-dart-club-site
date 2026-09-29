# -atl-dart-club-site
Marketing site for ATL Dart Club — full-service mobile Nerf battle events in Decatur & Atlanta.

## Admin
The editor lives at `/admin.html` (not linked in the public menu). It can add public events, upload Recent Battles photos, and edit a few homepage lines.

In the Vercel project, add two environment variables, then redeploy:

1. `ADMIN_PASSWORD` — the password you will type on the admin page
2. `GITHUB_TOKEN` — a GitHub personal access token with write access to this repo (`contents: write`)

Optional: `GITHUB_REPO` (defaults to `ChurnInt/-atl-dart-club-site`) and `GITHUB_BRANCH` (defaults to `main`).

Saves commit to `data/content.json` and `assets/gallery/`. Vercel republishes the site about a minute later.
