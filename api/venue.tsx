// dstn.app  ·  venue link page
// Lives at:  api/venue.tsx   ->   shared as  dstn.app/venue/SOME_ID

export const config = { runtime: 'edge' };

type Venue = { name: string; address: string | null };

async function getVenue(id: string | null): Promise<Venue | null> {
  if (!id) return null;
  try {
    const url =
      `${process.env.SUPABASE_URL}/rest/v1/locations` +
      `?id=eq.${encodeURIComponent(id)}&select=name,address&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY as string}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Venue[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function shortAddress(address: string | null): string {
  if (!address) return 'A place worth finding, on Destin.';
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1] ?? parts[0];
  return [parts[0], city].filter(Boolean).join(', ');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const id = searchParams.get('id');

  const venue = (await getVenue(id)) ?? {
    name: 'Ferry Building',
    address: '1 Ferry Building, San Francisco, CA 94105, USA',
  };

  const title = esc(venue.name);
  const desc = esc(shortAddress(venue.address));
  const imageUrl = `${origin}/api/og/venue${id ? `?id=${encodeURIComponent(id)}` : ''}`;
  const pageUrl = `${origin}/venue/${id ?? ''}`;
  const appLink = `destin://location/${id ?? ''}`;

  const html = `<!DOCTYPE html>
<html lang="en">$
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