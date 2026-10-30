import { Hono } from 'hono';
import { isIP } from 'node:net';

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  // Strip brackets from IPv6 hostnames like [::1]
  const cleanHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Known localhost identifiers
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost === '0.0.0.0'
  ) {
    return true;
  }

  // Check IPv6 loopback and private/link-local/unique-local
  if (cleanHost === '::1' || cleanHost === '::') {
    return true;
  }
  if (
    cleanHost.startsWith('fc') ||
    cleanHost.startsWith('fd') ||
    cleanHost.startsWith('fe80:')
  ) {
    return true;
  }

  // Check IPv4
  const ipVersion = isIP(cleanHost);
  if (ipVersion === 4) {
    const parts = cleanHost.split('.').map(Number);
    if (parts.length === 4) {
      const [a, b] = parts;
      // 0.0.0.0/8 (Current network)
      if (a === 0) return true;
      // 127.0.0.0/8 (Loopback)
      if (a === 127) return true;
      // 10.0.0.0/8 (Private)
      if (a === 10) return true;
      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16 (Private)
      if (a === 192 && b === 168) return true;
      // 169.254.0.0/16 (Link-local / cloud metadata)
      if (a === 169 && b === 254) return true;
    }
  }

  return false;
}

export function createProxyRoutes() {
  const proxy = new Hono();

  proxy.post('/', async (c) => {
    let body: { url?: string; headers?: Record<string, string> };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const { url, headers } = body;
    if (!url || typeof url !== 'string') {
      return c.json({ success: false, error: 'Target URL is required' }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return c.json({ success: false, error: 'Target URL not permitted' }, 400);
    }

    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return c.json({ success: false, error: 'Target URL not permitted' }, 400);
    }

    // SSRF Check
    if (isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      return c.json({ success: false, error: 'Target URL not permitted' }, 400);
    }

    try {
      const forwardHeaders: Record<string, string> = {};
      if (headers && typeof headers === 'object') {
        for (const [k, v] of Object.entries(headers)) {
          if (typeof v === 'string') {
            forwardHeaders[k] = v;
          }
        }
      }

      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: forwardHeaders,
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return c.json(data, response.status as any);
      } else {
        const text = await response.text();
        return c.text(text, response.status as any);
      }
    } catch (err: any) {
      return c.json(
        { success: false, error: err?.message || 'Proxy request failed' },
        502
      );
    }
  });

  return proxy;
}
