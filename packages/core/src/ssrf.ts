import { lookup } from 'node:dns/promises';
import net from 'node:net';

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, p) => acc * 256 + Number(p), 0);
}
const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
];

/** True for loopback, private, link-local (incl. cloud metadata 169.254.169.254), multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const size = 2 ** (32 - bits);
      const start = v4ToInt(base);
      return n >= start && n < start + size;
    });
  }
  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase();
    if (a === '::' || a === '::1') return true;
    if (a.startsWith('::ffff:')) {
      const rest = a.slice(7);
      return net.isIPv4(rest) ? isPrivateAddress(rest) : true;
    }
    return /^(fc|fd|fe[89ab]|ff)/.test(a);
  }
  return true; // not an IP at all: treat as unsafe
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

export class UnsafeUrlError extends Error {}

/**
 * Validates an outbound URL: http(s) only, no credentials, ports 80/443, and every resolved
 * address must be public. Callers must re-run it on every redirect hop.
 * Note: DNS rebinding between this check and the connection is a residual risk; run the worker
 * with egress firewall rules in production.
 */
export async function assertSafeUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError('نشانی نامعتبر است'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeUrlError('فقط http و https مجاز است');
  if (u.username || u.password) throw new UnsafeUrlError('نشانی نباید شامل نام کاربری یا رمز باشد');
  if (u.port && !['80', '443'].includes(u.port)) throw new UnsafeUrlError('درگاه غیرمجاز');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : await resolve(host);
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) throw new UnsafeUrlError('دسترسی به نشانی داخلی مسدود است');
  return u;
}
