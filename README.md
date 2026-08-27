# Day Rush — New Repo Build

This is the clean restart build.

## Included changes

- Desktop-first horizontal layout
- Black + red dark theme
- White + red light theme
- Normal week calendar grid
- Seven actual day columns
- Hour-by-hour time rows
- Empty/dead space where nothing is scheduled
- Canvas assignments shown in the calendar's DUE row
- Your recurring class schedule
- Wayfinder shifts:
  - Monday 7:00–2:00
  - Wednesday 7:00–2:00
  - Friday 9:00–3:00
- Beta events from the supplied schedule
- `ZTA Afters @ CJ's` remains TBD instead of guessing
- Canvas integration
- Canvas proxy included to avoid browser/CORS problems

## Why the old Canvas button failed

The old build tried to call Miami Canvas directly from a GitHub Pages browser app. That can fail because the browser is making a cross-origin authenticated API request. The new build can route Canvas requests through the included tiny Cloudflare Worker proxy.

## Step 1 — make a brand-new GitHub repo

Create a new repo such as:

`Day-Rush-2`

Upload the **contents of this folder** to the root of the repo.

At the root you should see:

- `index.html`
- `styles.css`
- `manifest.webmanifest`
- `sw.js`
- `README.md`
- `src/`
- `icons/`
- `canvas-proxy/`

Do not upload the ZIP itself.

## Step 2 — publish the frontend

GitHub:

**Settings → Pages → Deploy from a branch → main → /(root)**

Wait for the Pages deployment to turn green in Actions.

## Step 3 — deploy the Canvas proxy

The folder `canvas-proxy/` contains a Cloudflare Worker.

Easiest path:

1. Create/sign into Cloudflare.
2. Workers & Pages → Create → Worker.
3. Replace the default Worker code with `canvas-proxy/worker.js`.
4. Deploy.
5. Copy the resulting URL, which looks roughly like:

`https://day-rush-canvas-proxy.<your-subdomain>.workers.dev`

This proxy is hard-locked to:

`https://miamioh.instructure.com`

It cannot proxy arbitrary websites.

## Step 4 — connect Canvas

Open Day Rush → **You → Canvas**

Use:

Canvas URL:
`https://miamioh.instructure.com`

Canvas Proxy URL:
your Cloudflare Worker URL

Access token:
paste your Canvas token **only inside Day Rush on your own device**

Then click **Connect Canvas**.

## Token security

Never put the Canvas token in GitHub.

Day Rush stores the token locally on your own device. The Worker receives the token only for the request and does not store it.

For a future production-grade version, use Canvas OAuth instead of a personal token.

## Calendar

The Calendar tab uses a conventional desktop week view:

- day columns
- visible time scale
- event blocks positioned by actual start/end time
- empty space is intentionally preserved
- Canvas due items sit above the time grid


## UI / calendar redesign
This build simplifies the interface and makes Calendar the default tab.

Calendar now includes:
- Day / Week / Month views
- Previous / Today / Next navigation
- Week-to-week and month-to-month browsing
- Zoom controls for the time grid
- Visible empty time / deadspace
- Click any calendar event to edit title, date, start/end time, type, and location
- Delete events from the editor
- Month cells can be clicked to jump into that day
- Manual + button opens the same working event editor

The older fixed bottom navigation and dense dashboard presentation have been removed.
