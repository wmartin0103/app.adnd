# Putting the site online (Phase 1)

The site is the landing page (`site/index.html`), the two tools and the
shared spell catalog. `npm run build` copies just those into `dist/`, so the
repo's character saves, docs and scripts are never published.

Both steps below are done once, by the owner, in their own accounts.

## 1. Cloudflare Pages: host the site

1. Sign up at https://dash.cloudflare.com (free plan).
2. **Workers & Pages → Create → Pages → Connect to Git.** Authorize GitHub
   for the `wmartin0103/app.adnd` repo only.
3. Build settings:
   - Production branch: `claude/vibrant-wozniak-gjkyjd` (or `main` once the
     work is merged there)
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
4. **Save and Deploy.** The site appears at `https://<project>.pages.dev`.
   Every push to the production branch redeploys it.

Other branches get preview addresses (`<branch>.<project>.pages.dev`); the
gate in step 2 covers those too.

## 2. Cloudflare Access: keep it private until logins exist

1. In the dashboard, **Zero Trust** (free for up to 50 people; it asks for a
   team name and may ask for a card for the free plan).
2. **Access → Applications → Add an application → Self-hosted.**
   - Domain: `<project>.pages.dev`, and add `*.<project>.pages.dev` for the
     preview addresses.
   - Policy: Action **Allow**, Include **Emails**, and list each player's
     email address.
   - Login method: **One-time PIN** (Cloudflare emails a code; nobody needs
     a password).
3. Open the site in a private window: it should ask for an email first.

Adding a player later: add their email to the policy.

## Checking a build locally

```
npm run build
```

Then open `dist/index.html`, or serve `dist/` with any static server.
