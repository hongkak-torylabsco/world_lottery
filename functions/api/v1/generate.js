export async function onRequest({ request, env }) {
  try {
    return await env.ENGINE.fetch(request);
  } catch {
    return Response.json({ success: false, error: 'service_unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  }
}
