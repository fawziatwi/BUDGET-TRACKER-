# Smart Budget Tracker

A personal budget tracker, dashboards + subscription detection + budget pacing, that installs on your iPhone home screen like a native app. All data stays on your device (IndexedDB) — nothing is sent anywhere.

## Get it on your iPhone (fastest: same WiFi, right now)

1. Run the local server:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
   ```
2. It prints a `Network:` URL like `http://192.168.1.144:8080/`. If it instead says the network binding needs an admin reservation, run the `netsh http add urlacl ...` line it gives you **once**, as Administrator, then re-run `serve.ps1` normally.
   - If your iPhone still can't reach it, Windows Firewall may be blocking the port — allow inbound TCP 8080 for `powershell.exe` (Windows Security → Firewall → Allow an app).
3. On your iPhone (same WiFi network as this PC), open **Safari** (must be Safari, not Chrome) and go to that `http://192.168.x.x:8080/` address.
4. Tap the **Share** button → **Add to Home Screen** → **Add**.
5. Open it from your home screen — it launches full-screen, no Safari address bar, with its own icon.

This works as long as this PC is on and `serve.ps1` is running, and only while your phone is on the same WiFi.

## Permanent link with full offline support (recommended once you like it)

The local server above is great for testing, but it's plain HTTP and tied to this PC being on. For a permanent HTTPS link that works anywhere and fully caches for offline use:

1. Create a free repo at [github.com/new](https://github.com/new) (public or private both work), name it e.g. `budget-tracker`. Don't initialize it with a README.
2. In this folder, run:
   ```
   git init
   git add .
   git commit -m "Initial budget tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/budget-tracker.git
   git push -u origin main
   ```
3. On GitHub: repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: `main` / `/(root)` → Save.
4. After a minute, your app is live at `https://<your-username>.github.io/budget-tracker/`. Open that in iPhone Safari and **Add to Home Screen** the same way as above.
5. Whenever you want to update the app, just `git add . && git commit -m "..." && git push` again — GitHub Pages redeploys automatically, and the service worker will pick up the new version next time you open the app.

## What's inside

- **Dashboard** — net position, this month's spend vs. income, smart insight callout, budget pacing, upcoming subscriptions, recent activity.
- **Activity** — searchable, filterable transaction log. Tap `+` to log cash or card spending in a few taps (amount, merchant with autocomplete, category, account).
- **Budgets** — per-category monthly limits with a pace indicator (on-track / spending fast / over) and a month-end projection.
- **Subscriptions** — automatically detects recurring charges from your transaction history (same merchant, similar amount, regular interval) and flags price increases. You can also add subscriptions manually before they've charged once.
- **Insights** — 6-month spending trend, this month's category breakdown, month-over-month comparison, and unusual-transaction flags (anything 2x+ a category's normal average).
- **Accounts** (via More → Manage Accounts) — Cash, Checking, Savings, Credit Card by default; add/edit/delete, track credit utilization.
- **More** — currency, manage categories, and **export your data** (JSON full backup / CSV transactions) — do this periodically, since this is the only backup mechanism (nothing is stored in the cloud).

## Why manual entry instead of automatic bank sync

Real bank-sync (Plaid, Yodlee, etc.) needs a hosted backend holding API secrets, plus — for personal use — a production approval process from the provider that isn't something I can complete on your behalf. So v1 is manual entry, designed to be fast: merchant autocomplete remembers your past entries, and category selection learns from your corrections so it gets faster the more you use it. If you want to add real bank sync later, the data model (`js/db.js`) already has the shape (`accounts`, `transactions`) a sync job would write into.

## Project structure

```
index.html, manifest.json, sw.js     — PWA shell, offline caching
css/styles.css                        — iOS-style design system (light + dark mode)
js/db.js                              — IndexedDB wrapper
js/state.js                           — in-memory store + pub-sub
js/smart.js                           — recurring detection, budget pacing, anomaly detection, insights
js/charts.js                          — hand-rolled SVG charts (no dependencies)
js/screens/*.js                       — one file per tab
serve.ps1                             — local static file server (no Node/Python needed)
generate-icons.ps1                    — regenerates the app icons if you want a different look
```
