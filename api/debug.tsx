// dstn.app  ·  TEMPORARY debug endpoint  ·  delete after we fix the fetch
// Lives at:  api/debug.tsx
// Open at:   /api/debug?id=1a497bfb-6035-4b7b-9224-3f5117f1b175
//
// This exposes no secrets. It reports only whether the two env vars EXIST
// (true/false, never their values), the fetch status code, and the response
// body (which is either public venue data or a non-secret error message).

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '1a497bfb-6035-4b7b-9224-3f5117f1b175';

  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_ANON_KEY;

  let fetch_status: number | string = 'did-not-run (an env var is missing)';
  let fetch_body = '';

  if (hasUrl && hasKey) {
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
      fetch_status = res.status;
      fetch_body = await res.text();
    } catch (e) {
      fetch_status = 'threw an error';
      fetch_body = String(e);
    }
  }

  const report = {
    SUPABASE_URL_is_set: hasUrl,
    SUPABASE_ANON_KEY_is_set: hasKey,
    fetch_status,
    fetch_body,
  };

  return new Response(JSON.stringify(report, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}