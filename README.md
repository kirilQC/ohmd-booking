# OhMD booking page

Single-page booking form that feeds Default's routing workflow, which in turn
fires the Zapier booked-meeting enrichment webhook. Every submission is also
mirrored into Supabase (`ohmd_default_booking_submissions`) so we keep our own
copy of the lead.

```
index.html        the page (form + Default Pixel SDK)
api/submit.js     Vercel function → Supabase insert (best-effort mirror)
supabase.sql      table + indexes, run once
```

No build step, no dependencies.

## Deploy

1. Push to GitHub, then import the repo in Vercel. Framework preset: **Other**.
   Leave build command and output directory empty.
2. In Supabase, open the SQL editor and run `supabase.sql`.
3. Add two env vars in Vercel (Project → Settings → Environment Variables),
   for Production, Preview and Development:

   | Name | Where to find it |
   |---|---|
   | `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key |

   The service role key is **secret** — it only ever lives in the Vercel
   function, never in `index.html`.
4. Redeploy. Add the custom domain (e.g. `book.ohmd.com`) in Vercel → Domains.

If the env vars are absent the page still works end to end; the mirror is just
skipped and logged.

## Testing a submission

Two ways to check a deploy without guessing:

- **`GET /api/submit`** — open it in a browser. Reports whether both env vars
  are set, whether the table is reachable with that key, and the current row
  count. Reads no lead data.
- **`?debug=1`** — e.g. `https://book.ohmd.com/?debug=1`. Logs the payload, the
  Supabase mirror response and Default's raw result to the console, and blocks
  the redirect into the scheduler so you can read them.

A failed Default submit does **not** throw — the SDK resolves with
`{success:false, status, error}`. The page checks for that explicitly and shows
an error instead of a false "You're all set", so a lead is never silently lost.

## Default config

Values came from the embed snippet Default generated. If Default regenerates
the form, these three need updating together:

- `publicKey` — `721fb4d5-d65f-4c0c-aaf5-fa202417f077`
- `pixelFormId` — `6c1e28ba-8a52-468b-af42-4beb4022cffb`
- form element `id` — `manual-5d8fac5d-c043-4c9f-845e-c491cd500c13`

The field `name` attributes (`first_name`, `last_name`, `email`,
`company_name`, `job_title`, `provider_count`) map to Default's form questions
and drive the routing rules. Renaming one breaks routing.

`provider_count` is rendered as two radio cards rather than Default's original
`<select>`, but submits the same `name` and the same two values (`1-30`, `31+`),
so routing is unaffected. Changing either value breaks it.

`schedulerOrigins` includes `window.location.origin` so the scheduler works on
preview deploys as well as the production domain.

**Default also has to allowlist the domain.** The SDK loads and initializes on
any origin, but `/api/pixel/scheduler-style` returns `403` until the domain is
added to the pixel's allowed domains in Default. Add the production domain (and
`*.vercel.app` if you want previews to work) there before testing a real
booking, otherwise the form submits and the scheduler never appears.

## Local

```sh
npx vercel dev
```

Static-only preview (no `/api/submit`): `python3 -m http.server 8080`.

## Notes

- The page is `noindex` — it's for outbound, not organic.
- The Supabase mirror uses `navigator.sendBeacon`, so it survives the redirect
  into Default's scheduler.
- Styling is a handful of CSS custom properties at the top of `index.html`;
  `--accent` is the only one worth touching for brand.
