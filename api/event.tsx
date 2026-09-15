// dstn.app  ·  event link page
// Lives at:  api/event.tsx   ->   shared as  dstn.app/event/SOME_ID

export const config = { runtime: 'edge' };

const TZ = 'America/Los_Angeles';

type EventRow = {
  name: string;
  performer: string | null;
  starts_at: string | null;
  ends_at: string | null;
  address: string | null; // flattened from the joined location
};

async function getEvent(id: string | null): Promise<EventRow | null> {
  if (!id) return null;
  try {
    const url =
      `${process.env.SUPABASE_URL}/rest/v1/events` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=name,performer,starts_at,ends_at,locations(address)&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY as string}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as any[];
    const row = rows[0];
    if (!row) return null;
    const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    return {
      name: row.name,
      performer: row.performer ?? null,
      starts_at: row.starts_at ?? null,
      ends_at: row.ends_at ?? null,
      address: loc?.address ?? null,
    };
  } catch {
    return null;
  }
}

function cityFrom(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 3] : parts[1] ?? parts[0] ?? null;
}

// Pacific-time formatting, so a 2026-08-29 00:00Z event reads as Fri Aug 28.
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ,
  }).format(new Date(iso));
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
  }).format(new Date(iso)).replace(':00', ''); // "5:00 PM" -> "5 PM"
}

// One-line summary for og:description: performer, when, city, whatever exists.
function summarize(e: EventRow): string {
  const bits: string[] = [];
  if (e.performer) bits.push(e.performer);
  if (e.starts_at) {
    const time = e.ends_at ? `${fmtTime(e.starts_at)} – ${fmtTime(e.ends_at)}` : fmtTime(e.starts_at);
    bits.push(`${fmtDate(e.starts_at)}, ${time}`);
  }
  const city = cityFrom(e.address);
  if (city) bits.push(city);
  return bits.length ? bits.join('  ·  ') : 'An event worth finding, on Destin.';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const id = searchParams.get('id');

  const event = (await getEvent(id)) ?? {
    name: 'An Evening on Destin',
    performer: null,
    starts_at: null,
    ends_at: null,
    address: null,
  };

  const title = esc(event.name);
  const desc = esc(summarize(event));
  const imageUrl = `${origin}/api/og/event${id ? `?id=${encodeURIComponent(id)}` : ''}`;
  const pageUrl = `${origin}/event/${id ?? ''}`;
  const appLink = `destin://event/${id ?? ''}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Destin</title>

<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:url" content="${pageUrl}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${imageUrl}" />

<style>
  html,body{margin:0;height:100%;background:#0A0806;color:#EDE0C4;
    font-family:-apple-system,'Inter',sans-serif;
    display:flex;align-items:center;justify-content:center;flex-direction:column;padding:24px;}
  img{width:100%;max-width:600px;border:1px solid #2E2018;}
  a{margin-top:24px;color:#B8611E;text-decoration:none;
    font-size:13px;letter-spacing:2.4px;text-transform:uppercase;font-weight:600;}
</style>
</head>
<body>
  <img src="${imageUrl}" alt="${title}" />
  <a href="${appLink}">Open in Destin</a>
</body>
</html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}