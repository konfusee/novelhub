import { createPublicKey, createVerify } from 'node:crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';

const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

export function createGoogleProvider(config, fetchImpl = fetch) {
  return {
    authorizationUrl({ state, codeChallenge }) {
      const query = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
    },
    async exchange({ code, codeVerifier }) {
      const response = await fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      });
      if (!response.ok) throw new Error('Google token exchange failed');
      const tokens = await response.json();
      return verifyGoogleIdToken(tokens.id_token, config.clientId, fetchImpl);
    },
  };
}

export async function verifyGoogleIdToken(token, audience, fetchImpl = fetch) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Invalid Google identity token');
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decode(encodedHeader);
  const claims = decode(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Google token algorithm');
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) {
    throw new Error('Invalid Google token issuer');
  }
  if (claims.aud !== audience) throw new Error('Invalid Google token audience');
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new Error('Expired Google identity token');
  if (!claims.sub || !claims.email || claims.email_verified !== true) {
    throw new Error('Google email is not verified');
  }
  const jwksResponse = await fetchImpl(JWKS_ENDPOINT);
  if (!jwksResponse.ok) throw new Error('Google signing keys unavailable');
  const { keys } = await jwksResponse.json();
  const jwk = keys.find((key) => key.kid === header.kid && key.alg === 'RS256');
  if (!jwk) throw new Error('Google signing key not found');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  if (!verifier.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'))) {
    throw new Error('Invalid Google token signature');
  }
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: claims.name || claims.email };
}
