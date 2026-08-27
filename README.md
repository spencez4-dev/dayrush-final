# Revised Day Rush Canvas Worker

Replace only these two files inside `canvas-proxy/`:

- `worker.js`
- `wrangler.toml`

Then commit to `main`.

Because Cloudflare is connected to the GitHub repo, it should redeploy automatically.

## Test

Open:

`https://dayrush-final.spencez4.workers.dev/health`

Expected:

`{"ok":true,"service":"dayrush-canvas-proxy"}`

Then try **Connect Canvas** in Day Rush again.

This revision makes the Canvas calendar-feed request look more like a normal Safari/calendar client and follows redirects.

If Canvas still returns 403, that means Miami Canvas is likely blocking Cloudflare/data-center fetches specifically, and the next step should be a different fetch architecture rather than more header tweaking.
