import { createHmac, timingSafeEqual } from 'node:crypto';
export const LICENSE_TTL_SECONDS = 7 * 24 * 60 * 60;
export function signLicense(payload, secret) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${mac(body, secret)}`;
}
export function verifyLicense(token, secret, now = Date.now() / 1000) {
    const [body, sig, extra] = token.split('.');
    if (!body || !sig || extra !== undefined)
        return null;
    const expected = Buffer.from(mac(body, secret));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
        return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (typeof payload.customer !== 'string' || payload.plan !== 'pro' || typeof payload.exp !== 'number')
            return null;
        if (payload.kind !== undefined && payload.kind !== 'sub' && payload.kind !== 'pass')
            return null;
        return payload.exp > now ? payload : null;
    }
    catch {
        return null;
    }
}
function mac(body, secret) {
    return createHmac('sha256', secret).update(body).digest('base64url');
}
