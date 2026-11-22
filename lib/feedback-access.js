const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const productionHost = 'world-lottery-admin.pages.dev';
const deploymentHost = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.world-lottery-admin\.pages\.dev$/;

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid JWT component');
  return Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

export async function authorized(request, env, legacyAudience = env.FEEDBACK_ACCESS_AUD) {
  const issuer = env.FEEDBACK_ACCESS_ISSUER;
  const email = env.FEEDBACK_ACCESS_ADMIN_EMAIL;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const url = new URL(request.url);
  const baseHost = url.hostname === productionHost;
  const alternateHost = deploymentHost.test(url.hostname);
  const scoped = baseHost || alternateHost || env.FEEDBACK_ACCESS_DEPLOYMENT_AUD !== undefined;
  let audience = legacyAudience;
  if (scoped) {
    const baseAudience = env.FEEDBACK_ACCESS_AUD;
    const alternateAudience = env.FEEDBACK_ACCESS_DEPLOYMENT_AUD;
    if (url.protocol !== 'https:' || url.port || (!baseHost && !alternateHost)
      || !baseAudience || !alternateAudience || baseAudience === alternateAudience) return false;
    audience = baseHost ? baseAudience : alternateAudience;
  }
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer ?? '')
    || !audience || !email || !token || token.length > 8192) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, claims] = parts.slice(0, 2).map(part => JSON.parse(new TextDecoder().decode(decode(part))));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || header.crit !== undefined || typeof header.kid !== 'string'
      || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience)
      || (scoped && claims.aud.length !== 1)
      || claims.email !== email
      || claims.type !== 'app' || !Number.isSafeInteger(claims.exp) || claims.exp <= now
      || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) return false;
    const response = await fetch(issuer + '/cdn-cgi/access/certs', {
      redirect: 'manual', signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const { keys } = await response.json();
    const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
    return await crypto.subtle.verify(algorithm, key, decode(parts[2]),
      new TextEncoder().encode(parts.slice(0, 2).join('.')));
  } catch {
    return false;
  }
}
