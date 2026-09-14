// dstn.app  ·  venue share image
// Lives at:  api/og/venue.tsx   ->   /api/og/venue?id=SOME_VENUE_ID

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const C = {
  card:'#1F1510', bgAlt:'#16100A', cream:'#EDE0C4', secondary:'#8A7A68',
  amber:'#B8611E', border:'#2E2018',
};

async function loadFonts() {
  const grab = (u: string) => fetch(u).then((r) => r.arrayBuffer());
  const [frauncesReg, frauncesItal, interMed, interLight] = await Promise.all([
    grab('https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-400-normal.woff'),
    grab('https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-400-italic.woff'),
    grab('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-500-normal.woff'),
    grab('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-300-normal.woff'),
  ]);
  return [
    { name: 'Fraunces', data: frauncesReg,  weight: 400 as const, style: 'normal' as const },
    { name: 'Fraunces', data: frauncesItal, weight: 400 as const, style: 'italic' as const },
    { name: 'Inter',    data: interMed,     weight: 500 as const, style: 'normal' as const },
    { name: 'Inter',    data: interLight,   weight: 300 as const, style: 'normal' as const },
  ];
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

// pull a city + a short "street, city" line out of the full address
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

  const venue: Venue = (await getVenue(id)) ?? {
    name: 'Ferry Building',
    address: '1 Ferry Building, San Francisco, CA 94105, USA',
  };

  const fonts = await loadFonts();
  const where = parseWhere(venue.address);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: C.card, border: `1px solid ${C.border}`, fontFamily: 'Inter', color: C.cream }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '36px 56px 30px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Fraunces', fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', color: C.cream }}>Destin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, fontWeight: 500, letterSpacing: 3.6, textTransform: 'uppercase', color: C.secondary }}>
            <div style={{ display: 'flex', width: 9, height: 9, backgroundColor: C.secondary, transform: 'rotate(45deg)' }} />
            {where.city}
          </div>
        </div>

        {/* body */}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '48px 56px' }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 500, letterSpacing: 5, textTransform: 'uppercase', color: C.amber, marginBottom: 28 }}>A find on Destin</div>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 88, lineHeight: 1.02, color: C.cream, maxWidth: 1000 }}>{venue.name}</div>
          {where.line ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 40 }}>
              <div style={{ display: 'flex', width: 10, height: 10, backgroundColor: C.amber, transform: 'rotate(45deg)' }} />
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 300, color: C.secondary }}>{where.line}</div>
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px', borderTop: `1px solid ${C.border}`, backgroundColor: C.bgAlt }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 500, letterSpacing: 3.6, textTransform: 'uppercase', color: C.secondary }}>dstn.app</div>
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 500, letterSpacing: 3.6, textTransform: 'uppercase', color: C.amber }}>Open in Destin</div>
        </div>

      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}