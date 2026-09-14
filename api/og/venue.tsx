// dstn.app  ·  venue share image
// Lives at:  api/og/venue.tsx   ->   opens at  /api/og/venue?id=SOME_VENUE_ID
//
// You do not need to edit anything to see it work the first time.
// With no id (or before the database is wired up) it draws a placeholder card.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// ── Destin colours (from your colors.ts) ─────────────────────────────
const C = {
  card:       '#1F1510',
  bgAlt:      '#16100A',
  cream:      '#EDE0C4',
  secondary:  '#8A7A68',
  amber:      '#B8611E',
  border:     '#2E2018',
  rateBg:     '#1e1208',
  rateBorder: '#5a3a14',
  rateText:   '#c87941',
};

// Fonts are pulled from a public CDN so you do not have to download anything.
// Satori (the image engine) cannot read woff2, so we use woff on purpose.
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

type Venue = {
  name: string;
  address: string | null;
  city: string | null;
  tagline: string | null;
  rating: number | null;
};

async function getVenue(id: string | null): Promise<Venue | null> {
  if (!id) return null;
  try {
    const url =
      `${process.env.SUPABASE_URL}/rest/v1/locations` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=name,address,city,tagline,rating&limit=1`;
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
    return null; // if anything goes wrong, we fall back to the placeholder
  }
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const venue: Venue = (await getVenue(id)) ?? {
    name: 'Bar Shiru',
    address: '1611 Telegraph Ave',
    city: 'Oakland',
    tagline: 'A jazz kissa in Uptown, analog sound and soul on vinyl',
    rating: 9.1,
  };

  const fonts = await loadFonts();
  const addressLine = [venue.address, venue.city].filter(Boolean).join(', ');

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: C.card, border: `1px solid ${C.border}`, fontFamily: 'Inter', color: C.cream }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '36px 56px 30px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Fraunces', fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', color: C.cream }}>Destin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, fontWeight: 500, letterSpacing: 3.6, textTransform: 'uppercase', color: C.secondary }}>
            <div style={{ display: 'flex', width: 9, height: 9, backgroundColor: C.secondary, transform: 'rotate(45deg)' }} />
            {venue.city ?? 'San Francisco'}
          </div>
        </div>

        {/* body */}
        <div style={{ display: 'flex', flex: 1, padding: '48px 56px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 500, letterSpacing: 5, textTransform: 'uppercase', color: C.amber, marginBottom: 28 }}>A find on Destin</div>
            <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 84, lineHeight: 1.02, color: C.cream }}>{venue.name}</div>
            {venue.tagline ? (
              <div style={{ display: 'flex', fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 30, lineHeight: 1.45, color: '#b09d80', marginTop: 22, maxWidth: 640 }}>{venue.tagline}</div>
            ) : null}
            {addressLine ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 40 }}>
                <div style={{ display: 'flex', width: 10, height: 10, backgroundColor: C.amber, transform: 'rotate(45deg)' }} />
                <div style={{ display: 'flex', fontSize: 22, fontWeight: 300, color: C.secondary }}>{addressLine}</div>
              </div>
            ) : null}
          </div>

          {/* rating badge */}
          {venue.rating != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: C.rateBg, border: `1px solid ${C.rateBorder}`, padding: '20px 26px 16px' }}>
              <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 56, lineHeight: 1, color: C.rateText }}>{venue.rating.toFixed(1)}</div>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#8a7358', marginTop: 10 }}>Rating</div>
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