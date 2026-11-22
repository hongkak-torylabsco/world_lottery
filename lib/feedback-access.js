const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid JWT component');
  return Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

export async function authorized(request, env, audience = env.FEEDBACK_ACCESS_AUD) {
  const issuer = env.FEEDBACK_ACCESS_ISSUER;
  const email = env.FEEDBACK_ACCESS_ADMIN_EMAIL;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer ?? '')
    || !audience || !email || !token || token.length > 8192) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, claims] = parts.slice(0, 2).map(part => JSON.parse(new TextDecoder().decode(decode(part))));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || header.crit !== undefined || typeof header.kid !== 'string'
      || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience)
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
