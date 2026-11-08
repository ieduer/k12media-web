// Account cooldown protects the source from repeated password submissions.
// A shared school NAT gets a bounded burst, not a single-student lock.
export function createLoginLimiter({now = Date.now, accountMs = 60000, networkMs = 10000, networkBurst = 20} = {}) {
  const accounts = new Map(), networks = new Map();
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');
  return async (request, username) => {
    const at = now();
    for (const [key, until] of accounts) if (until <= at) accounts.delete(key);
    for (const [key, value] of networks) if (value.until <= at) networks.delete(key);
    const account = await hash(username.trim()), ip = request.headers.get('CF-Connecting-IP');
    const network = ip ? await hash(ip) : null, bucket = networks.get(network);
    const until = accounts.get(account) || (bucket?.count >= networkBurst ? bucket.until : 0);
    if (until > at) return {allowed: false, retryAfter: Math.ceil((until - at) / 1000)};
    if (accounts.size >= 4000 || networks.size >= 4000) return {allowed: false, retryAfter: 10};
    accounts.set(account, at + accountMs);
    if (network) networks.set(network, {until: bucket?.until || at + networkMs, count: (bucket?.count || 0) + 1});
    return {allowed: true};
  };
}
