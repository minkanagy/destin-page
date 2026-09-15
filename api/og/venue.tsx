// dstn.app  ·  venue share image  (v4 — redesigned card)
// Lives at:  api/og/venue.tsx   ->   /api/og/venue?id=SOME_VENUE_ID
// Optional:  &from=Minka   adds a signature to the handwritten caption
// Optional:  &img=<url>    drops a real photo into the right panel (temporary
//            manual override until we wire the real venue-photo source)

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const C = {
  card:'#1F1510', bgAlt:'#16100A', bg:'#0A0806', cream:'#EDE0C4',
  secondary:'#8A7A68', tertiary:'#5A4D3F', amber:'#B8611E', border:'#2E2018',
};

// Core fonts are required. The handwritten font is loaded separately and
// optionally, so a hiccup fetching it can never blank out the whole card.
async function loadFonts() {
  const grab = (u: string) => fetch(u).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.arrayBuffer();
  });

  const [frauncesReg, interMed, interLight] = await Promise.all([
    grab('https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-400-normal.woff'),
    grab('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-500-normal.woff'),
    grab('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-300-normal.woff'),
  ]);

  const fonts: any[] = [
    { name: 'Fraunces', data: frauncesReg,  weight: 400 as const, style: 'normal' as const },
    { name: 'Inter',    data: interMed,     weight: 500 as const, style: 'normal' as const },
    { name: 'Inter',    data: interLight,   weight: 300 as const, style: 'normal' as const },
  ];

  // Handwritten caption font. STAND-IN: Caveat. Swap the URL for the real one.
  try {
    const caveat = await grab('https://cdn.jsdelivr.net/npm/@fontsource/caveat@5/files/caveat-latin-400-normal.woff');
    fonts.push({ name: 'Script', data: caveat, weight: 400 as const, style: 'normal' as const });
  } catch {
    // caption falls back to Fraunces if the script font can't be fetched
  }

  return fonts;
}

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

// Later: replace with a fetch to your public venue-photo source and return the
// first image URL (or null). For now it just honours a manual &img= override.
async function getVenuePhoto(id: string | null, override: string | null): Promise<string | null> {
  // manual override still wins — keeps &img= working for testing
  if (override && /^https?:\/\//i.test(override)) return override;
  if (!id) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/get_public_location_photo`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY as string}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_location_id: id }),
      },
    );
    if (!res.ok) return null;
    const path = (await res.json()) as string | null; // scalar text or null
    if (!path) return null;
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/review-images/${path}`;
  } catch {
    return null;
  }
}

function parseWhere(address: string | null): { city: string; line: string } {
  if (!address) return { city: 'San Francisco', line: '' };
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1] ?? parts[0] ?? 'San Francisco';
  const street = parts[0] ?? '';
  const line = [street, city].filter(Boolean).join(', ');
  return { city, line };
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const from = searchParams.get('from');
  const imgOverride = searchParams.get('img');

  const venue: Venue = (await getVenue(id)) ?? {
    name: 'Ferry Building',
    address: '1 Ferry Building, San Francisco, CA 94105, USA',
  };

  const [fonts, photo] = await Promise.all([loadFonts(), getVenuePhoto(id, imgOverride)]);
  const where = parseWhere(venue.address);
  const initial = (venue.name.trim()[0] ?? 'D').toUpperCase();
  const caption = from ? `Look what I found on Destin!  — ${from}` : 'Look what I found on Destin!';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: C.card, border: `1px solid ${C.border}`, fontFamily: 'Inter', color: C.cream }}>

        {/* header — the only place the brand name appears */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '30px 48px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Fraunces', fontSize: 28, letterSpacing: 8, textTransform: 'uppercase', color: C.cream }}>Destin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 500, letterSpacing: 3.4, textTransform: 'uppercase', color: C.secondary }}>
            <div style={{ display: 'flex', width: 9, height: 9, backgroundColor: C.secondary, transform: 'rotate(45deg)' }} />
            {where.city}
          </div>
        </div>

        {/* middle — venue info left, photo panel right */}
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 48px', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 70, lineHeight: 1.03, color: C.cream }}>{venue.name}</div>
            {where.line ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34 }}>
                <div style={{ display: 'flex', width: 10, height: 10, backgroundColor: C.amber, transform: 'rotate(45deg)' }} />
                <div style={{ display: 'flex', fontSize: 23, fontWeight: 300, color: C.secondary }}>{where.line}</div>
              </div>
            ) : null}
          </div>

          {/* photo panel */}
          <div style={{ display: 'flex', width: 430, borderLeft: `1px solid ${C.border}`, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} width={430} height={438} style={{ width: 430, height: '100%', objectFit: 'cover' }} alt="" />
            ) : (
              <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 210, color: C.tertiary, opacity: 0.5 }}>{initial}</div>
            )}
          </div>
        </div>

        {/* handwritten caption — replaces the old branded footer */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 48px', height: 96, borderTop: `1px solid ${C.border}`, backgroundColor: C.bg }}>
          <div style={{ display: 'flex', fontFamily: 'Script', fontSize: 42, color: C.amber }}>{caption}</div>
        </div>

      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}