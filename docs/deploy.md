# How the site goes online

The site is at https://wmartin0103.github.io/app.adnd/, on GitHub Pages. It's
Home (`site/index.html`), Account, the two tools and the shared spell catalog.
`npm run build` copies just those into `dist/`, so the repo's docs, scripts and
test data are never published.

## What happens on a merge

Every push to `main` runs `.github/workflows/pages.yml`: the tests, the build,
and the deploy. Because of the rule on `main`, a push only happens when a pull
request merges, so **a merge is a release**. There's no staging site yet (see
the Status section of `PLAN.md`).

Only `main` is allowed to deploy: the `github-pages` environment's branch policy
lists it alone.

Pull requests run `.github/workflows/test.yml` instead, which doesn't deploy.

The rule on `main` is `.github/rulesets/protect-main.json`. That file is a copy
for the record: changing it doesn't change the rule, which the owner manages on
GitHub.

## Undoing a release

Open the merged pull request on GitHub and press **Revert**. That makes a new
pull request; merging it redeploys the site as it was.

This doesn't undo a database migration, which needs its own fix.

## Old addresses

The tools used to be at `legacy/character-sheet.html` and `legacy/dm-helper.html`.
`scripts/build-site.mjs` keeps small pages there that forward to `sheet/` and
`dm/`, keeping `?id=…`, so older links still work.

## The owner's one-time settings

Already done, and listed in case the site is ever set up again:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. In Supabase: **Authentication → URL Configuration → Site URL** = the site's
   address, and the same under **Redirect URLs**.

## Checking a build locally

```
npm run build
```

Then serve `dist/` with any static server. Its links are relative, so it works
from any folder.
