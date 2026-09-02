// Mirrors booking-form submissions into Supabase so we own a copy of the lead
// independent of Default. Best-effort: this endpoint never affects what the
// visitor sees, so failures are logged and swallowed with a 204.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "booking_submissions";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[submit] Supabase env vars missing — skipping mirror");
    return res.status(204).end();
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
    return res.status(400).json({ error: "email_required" });
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
      console.error("[submit] supabase insert failed", r.status, await r.text());
    }
  } catch (err) {
    console.error("[submit] supabase insert threw", err);
  }

  return res.status(204).end();
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
