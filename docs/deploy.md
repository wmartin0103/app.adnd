# Putting the site online

The site is the landing page (`site/index.html`), the two tools and the
shared spell catalog. `npm run build` copies just those into `dist/`, so the
repo's character saves, docs and scripts are never published.

The steps below are done once, by the owner, in their own accounts.

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

Other branches get preview addresses (`<branch>.<project>.pages.dev`); a
gate (step 3) covers those too if added.

## 2. Your own domain

1. Buy a domain (about $10–15 a year). Simplest: **Domain Registration →
   Register Domains** in the same Cloudflare account (sold at cost; DNS is set
   up for you). A domain from another registrar works too: add it to
   Cloudflare as a site and switch its nameservers to Cloudflare's.
2. **Workers & Pages → your project → Custom domains → Set up a custom
   domain**, and enter it (e.g. `adnd.example.com` or the bare domain).
   HTTPS is automatic.
3. In Supabase: **Authentication → URL Configuration → Site URL** = your
   domain (`https://…`), and add it under **Redirect URLs**. Password sign-in
   works without this; password resets and invite emails need it.

## 3. Optional: Cloudflare Access in front of the whole site

Now that the tools have sign-in, campaign data is already protected (the
database's rules; see `supabase/`). Without a gate, anyone with the link can
open the tools, but signed out they only see their own browser's sheet. Add
Access only if the tools themselves should stay private; players then get an
email code before the page loads, as well as signing in.

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
