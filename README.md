# 4D Smart Timetable PWA

This app is a static PWA (HTML/CSS/JS + service worker).

## Deploy on Render (recommended: Blueprint)

1. Push this repo to GitHub.
2. In Render, click **New +** → **Blueprint**.
3. Select your repo and deploy.
4. Render reads `render.yaml` and creates a free Web Service.

## Render manual setup

- **Runtime**: `Node`
- **Plan**: `Free`
- **Build Command**: `npm ci`
- **Start Command**: `npm start`
- **Auto-Deploy**: `Yes`

## Automatic period notifications

- The app updates notifications automatically when the next period starts.
- While the app is open (or recently active), updates are exact at period boundaries.
- For app-closed behavior, the service worker uses **Periodic Background Sync** where browser support exists.
- Browser/OS policies can restrict background execution when phone is fully off, battery-optimized, or browser doesn't support periodic sync.

## If you see “Not Found”

- Open your service URL (`https://<service-name>.onrender.com`) not `dashboard.render.com`.
- Verify Render **Root Directory** points to this project.
- Verify latest deploy is successful.
- Hard refresh / clear site data if old service worker cache persists.
