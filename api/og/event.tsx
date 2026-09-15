// dstn.app  ·  event share image
// Lives at:  api/og/event.tsx   ->   /api/og/event?id=SOME_EVENT_ID
// Optional:  &from=Minka   adds a signature to the handwritten caption
// Optional:  &img=<url>    overrides the cover photo (testing only)
//
// Mirrors api/og/venue.tsx. Difference: events carry cover_image_url on their
// own row (no photo RPC), but no city, so we join locations for the address and
// reuse parseWhere. Date and time are formatted in America/Los_Angeles.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const TZ = 'America/Los_Angeles';

const C = {
  card:'#1F1510', bgAlt:'#16100A', bg:'#0A0806', cream:'#EDE0C4',
  secondary:'#8A7A68', tertiary:'#5A4D3F', amber:'#B8611E', border:'#2E2018',
};

// Identical to venue: core fonts required, handwritten font optional so a
// hiccup fetching it can never blank the whole card.
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

  // Subtitle italic — Fraunces italic for the description line. try/catch so a
  // fetch hiccup can't blank the whole card.
  try {
    const frauncesItalic = await grab('https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-300-italic.woff');
    fonts.push({ name: 'Fraunces', data: frauncesItalic, weight: 300 as const, style: 'italic' as const });
  } catch {
    // description falls back to upright Fraunces if the italic can't be fetched
  }

  return fonts;
}

type EventRow = {
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  address: string | null; // flattened from the joined location
};

async function getEvent(id: string | null): Promise<EventRow | null> {
  if (!id) return null;
  try {
    const url =
      `${process.env.SUPABASE_URL}/rest/v1/events` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=name,description,starts_at,ends_at,cover_image_url,locations(address)&limit=1`;
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
    // Embedded to-one usually returns an object, but handle the array shape too.
    const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
return {
  name: row.name,
  description: row.description ?? null,
  starts_at: row.starts_at ?? null,
  ends_at: row.ends_at ?? null,
  cover_image_url: row.cover_image_url ?? null,
  address: loc?.address ?? null,
};
  } catch {
    return null;
  }
}

// cover_image_url can be a full URL OR a bare Supabase storage path. Turn a
// path into a public URL so Satori can fetch it; leave full URLs untouched.
const STORAGE_BUCKET = 'event-covers';

function toPublicUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value; // already a full URL
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${value}`;
}

// Satori fetches and decodes the photo itself; if it can't (a non-public
// bucket returns 403, or the format is one it can't decode, like WebP or
// AVIF) it throws and blanks the WHOLE card. So validate first: only pass a
// photo through when it fetches cleanly as PNG or JPEG, otherwise fall back
// to the initial letter and the card still renders.
async function usablePhoto(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    return /^image\/(png|jpe?g)/i.test(type) ? url : null;
  } catch {
    return null;
  }
}

// Same city parsing as the venue card, run on the joined address.
function parseWhere(address: string | null): { city: string; line: string } {
  if (!address) return { city: 'San Francisco', line: '' };
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1] ?? parts[0] ?? 'San Francisco';
  const street = parts[0] ?? '';
  const line = [street, city].filter(Boolean).join(', ');
  return { city, line };
}

// Pacific-time formatting. Stored value is UTC, so this is what keeps a
// 2026-08-29 00:00Z event reading as Fri Aug 28, not Aug 29.
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
function formatWhen(starts: string | null, ends: string | null): string {
  if (!starts) return '';
  const time = ends ? `${fmtTime(starts)} – ${fmtTime(ends)}` : fmtTime(starts);
  return `${fmtDate(starts)}  ·  ${time}`;
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const from = searchParams.get('from');
  const imgOverride = searchParams.get('img');

const event: EventRow = (await getEvent(id)) ?? {
  name: 'An Evening on Destin',
  description: null,
  starts_at: null,
  ends_at: null,
  cover_image_url: null,
  address: '3158 Mission St, San Francisco, CA 94110, USA',
};

    const where = parseWhere(event.address);
    const when = formatWhen(event.starts_at, event.ends_at);

    const description = event.description?.trim();
  const blurb = description
    ? (description.length > 120 ? description.slice(0, 119).trimEnd() + '…' : description)
    : null;

    const photoSrc =
    imgOverride && /^https?:\/\//i.test(imgOverride)
      ? imgOverride
      : toPublicUrl(event.cover_image_url);
  const [fonts, photo] = await Promise.all([loadFonts(), usablePhoto(photoSrc)]);
  const initial = (event.name.match(/[A-Za-z0-9]/)?.[0] ?? 'D').toUpperCase();
  // No em dash in the signature, per house style; en dash in handwriting reads fine.
  const caption = from ? `Look what I found on Destin!  – ${from}` : 'Look what I found on Destin!';

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

        {/* middle — event info left, photo panel right */}
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 48px', flex: 1 }}>
            <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 70, lineHeight: 1.03, color: C.cream }}>{event.name}</div>

            {blurb ? (
              <div style={{ display: 'flex', fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 300, fontSize: 27, lineHeight: 1.35, color: C.secondary, marginTop: 24 }}>{blurb}</div>
            ) : null}

            {when ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
                <div style={{ display: 'flex', width: 12, height: 12, backgroundColor: C.amber, transform: 'rotate(45deg)' }} />
                <div style={{ display: 'flex', fontSize: 31, fontWeight: 500, color: C.amber }}>{when}</div>
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

        {/* handwritten caption */}
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