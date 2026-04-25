// KV abstraction: in-memory for local dev, @vercel/kv when env is set.
//
// Three primitives the codebase needs:
//   1. setNX(key, ttlSec): atomic set-if-not-exists with TTL — for nonce replay protection
//   2. incrby(key, delta, ttlSec): cap counters + rate-limit buckets (delta may be negative)
//   3. get(key): read
//
// In-memory implementation runs GC at insert time when the store grows past a
// soft cap, so bursts can't blow up memory between idle ticks.

interface KV {
  setNX(key: string, value: string, ttlSec: number): Promise<boolean>;
  incrby(key: string, delta: number, ttlSec: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
}

const SOFT_CAP = 10_000;

class MemoryKV implements KV {
  private store = new Map<string, { v: string; expiresAt: number }>();

  private gc() {
    const now = Date.now();
    for (const [k, e] of this.store) if (e.expiresAt < now) this.store.delete(k);
  }

  private maybeGc() {
    if (this.store.size > SOFT_CAP) this.gc();
  }

  async setNX(key: string, value: string, ttlSec: number): Promise<boolean> {
    this.maybeGc();
    const e = this.store.get(key);
    if (e && e.expiresAt > Date.now()) return false;
    this.store.set(key, { v: value, expiresAt: Date.now() + ttlSec * 1000 });
    return true;
  }

  async incrby(key: string, delta: number, ttlSec: number): Promise<number> {
    this.maybeGc();
    const e = this.store.get(key);
    const current = e && e.expiresAt > Date.now() ? Number(e.v) : 0;
    // Clamp at 0 — rollback against an expired entry must not persist a
    // negative balance that gives the next legit call free headroom.
    const next = Math.max(0, current + delta);
    this.store.set(key, { v: String(next), expiresAt: Date.now() + ttlSec * 1000 });
    return next;
  }

  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e || e.expiresAt < Date.now()) return null;
    return e.v;
  }

  async set(key: string, value: string, ttlSec = 86400): Promise<void> {
    this.maybeGc();
    this.store.set(key, { v: value, expiresAt: Date.now() + ttlSec * 1000 });
  }
}

let _kv: KV | null = null;

export function kv(): KV {
  if (_kv) return _kv;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // Vercel KV (Redis). Lazy-load to avoid hard dep failure in local dev.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { kv: vercelKv } = require("@vercel/kv");
    _kv = {
      async setNX(key, value, ttlSec) {
        const res = await vercelKv.set(key, value, { nx: true, ex: ttlSec });
        return res === "OK";
      },
      async incrby(key, delta, ttlSec) {
        let next = await vercelKv.incrby(key, delta);
        // Same clamp as MemoryKV — Redis INCRBY happily returns negative.
        if (next < 0) {
          await vercelKv.set(key, "0", { ex: ttlSec });
          next = 0;
        } else {
          await vercelKv.expire(key, ttlSec);
        }
        return next;
      },
      async get(key) {
        const v = await vercelKv.get(key);
        return v == null ? null : String(v);
      },
      async set(key, value, ttlSec = 86400) {
        await vercelKv.set(key, value, { ex: ttlSec });
      },
    };
  } else {
    _kv = new MemoryKV();
  }
  return _kv;
}
