// Mirrors booking-form submissions into Supabase so we own a copy of the lead
// independent of Default.
//
// POST — insert a row. Best-effort: a failure here must never affect what the
//        visitor sees, so the page ignores the response in normal operation.
// GET  — health check. Reports whether the env vars are wired and whether the
//        table is actually reachable, so you can verify a deploy without
//        submitting a fake lead.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "ohmd_default_booking_submissions";

export default async function handler(req, res) {
  if (req.method === "GET") return health(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!configured()) {
    console.warn("[submit] Supabase env vars missing — skipping mirror");
    return res.status(200).json({ ok: true, mirrored: false, reason: "not_configured" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  const row = {
    first_name: str(body.first_name),
    last_name: str(body.last_name),
    email: str(body.email)?.toLowerCase(),
    company_name: str(body.company_name),
    job_title: str(body.job_title),
    provider_count: str(body.provider_count),
    page_url: str(body.page_url),
    referrer: str(body.referrer),
    utm: body.utm && typeof body.utm === "object" ? body.utm : null,
    user_agent: str(req.headers["user-agent"]),
  };

  if (!row.email) {
    return res.status(400).json({ ok: false, error: "email_required" });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("[submit] supabase insert failed", r.status, detail);
      return res.status(200).json({ ok: true, mirrored: false, status: r.status, detail });
    }

    return res.status(200).json({ ok: true, mirrored: true });
  } catch (err) {
    console.error("[submit] supabase insert threw", err);
    return res.status(200).json({ ok: true, mirrored: false, error: String(err) });
  }
}

// Hit /api/submit in a browser to confirm the deploy is wired up correctly.
async function health(req, res) {
  const out = {
    ok: true,
    env: {
      SUPABASE_URL: SUPABASE_URL ? "set" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY ? "set" : "MISSING",
    },
    table: TABLE,
  };

  if (!configured()) {
    out.ok = false;
    out.hint = "Add both env vars in Vercel → Settings → Environment Variables, then redeploy.";
    return res.status(200).json(out);
  }

  // Count-only probe. Reads no lead data but proves the key works and the
  // table exists.
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "count=exact",
      },
    });

    if (!r.ok) {
      out.ok = false;
      out.table_reachable = false;
      out.status = r.status;
      out.detail = await r.text();
      out.hint =
        r.status === 404
          ? `Table ${TABLE} not found — run supabase.sql in the Supabase SQL editor.`
          : "Check that SUPABASE_SERVICE_ROLE_KEY is the service_role key, not the anon key.";
      return res.status(200).json(out);
    }

    out.table_reachable = true;
    // Supabase returns the total in a content-range header like "0-0/42".
    const range = r.headers.get("content-range") || "";
    out.row_count = Number(range.split("/")[1]) || 0;
  } catch (err) {
    out.ok = false;
    out.table_reachable = false;
    out.error = String(err);
  }

  return res.status(200).json(out);
}

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function str(v) {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 500);
  return t.length ? t : null;
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
