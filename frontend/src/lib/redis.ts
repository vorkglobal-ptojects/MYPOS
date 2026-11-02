import { Redis } from '@upstash/redis';
import { normalizeBranchId } from './branch-mapping';

// Server-side Redis configuration
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// Configurable TTL with safe default of 300 seconds (5 minutes)
export const DEFAULT_INVENTORY_CACHE_TTL = parseInt(
  process.env.INVENTORY_CACHE_TTL_SECONDS || '300',
  10
);

let upstashClient: Redis | null = null;

if (REDIS_URL && REDIS_TOKEN) {
  try {
    upstashClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
  } catch (initErr) {
    console.warn('[Redis Cache] Failed to initialize Upstash Redis client:', initErr);
    upstashClient = null;
  }
}

// In-memory fallback cache with TTL for environments without cloud Redis credentials
interface LocalCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const localDevCache = new Map<string, LocalCacheEntry<any>>();

// Allow testing failure simulation (TEST 8)
let simulatedFailure = false;
export function setSimulatedRedisFailure(fail: boolean) {
  simulatedFailure = fail;
}

/**
 * Checks whether remote Redis is configured via environment variables.
 */
export function isRedisConfigured(): boolean {
  return !!upstashClient && !simulatedFailure;
}

/**
 * Builds a strict, branch-isolated cache key.
 * Format:
 *   inventory:branch:<CANONICAL_BRANCH_ID>:date:<YYYY-MM-DD>
 * or:
 *   inventory:branch:<CANONICAL_BRANCH_ID>
 */
export function buildInventoryCacheKey(branchId: string, date?: string): string {
  const normBranch = (branchId || '').trim().toUpperCase() === 'ALL'
    ? 'ALL'
    : normalizeBranchId(branchId);

  const cleanDate = (date || '').trim();
  if (cleanDate) {
    return `inventory:branch:${normBranch}:date:${cleanDate}`;
  }
  return `inventory:branch:${normBranch}`;
}

/**
 * Retrieves cached inventory data from Redis (or safe local cache fallback).
 * Returns null on Cache MISS or if Redis encounters an error.
 */
export async function getInventoryCache<T = any>(key: string): Promise<T | null> {
  if (simulatedFailure) {
    console.warn(`[Redis Cache] Simulated Redis failure active for key: ${key}`);
    return null;
  }

  try {
    if (upstashClient) {
      const data = await upstashClient.get<T>(key);
      if (data !== null && data !== undefined) {
        return data;
      }
      return null;
    }

    // In-memory fallback
    const local = localDevCache.get(key);
    if (!local) return null;

    if (Date.now() > local.expiresAt) {
      localDevCache.delete(key);
      return null;
    }
    return local.data as T;
  } catch (err: any) {
    // Graceful error handling - never crash Mifos if Redis is unreachable
    console.error(`[Redis Cache Error] get failed for key "${key}":`, err?.message || err);
    return null;
  }
}

/**
 * Stores inventory data into Redis (or safe local cache fallback) with TTL.
 */
export async function setInventoryCache<T = any>(
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_INVENTORY_CACHE_TTL
): Promise<boolean> {
  if (simulatedFailure) {
    return false;
  }

  try {
    const ttl = Math.max(1, ttlSeconds || DEFAULT_INVENTORY_CACHE_TTL);

    if (upstashClient) {
      await upstashClient.set(key, data, { ex: ttl });
      return true;
    }

    // In-memory fallback
    localDevCache.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000,
    });
    return true;
  } catch (err: any) {
    console.error(`[Redis Cache Error] set failed for key "${key}":`, err?.message || err);
    return false;
  }
}

/**
 * Invalidates the inventory cache for a specific branch (and all-branch view).
 * Non-blocking and resilient to Redis connection drops.
 */
export async function invalidateBranchInventoryCache(
  branchId: string,
  date?: string
): Promise<{ count: number; keys: string[] }> {
  if (simulatedFailure) {
    return { count: 0, keys: [] };
  }

  const normBranch = (branchId || '').trim().toUpperCase() === 'ALL'
    ? 'ALL'
    : normalizeBranchId(branchId);

  const invalidatedKeys: string[] = [];

  try {
    const specificKey = buildInventoryCacheKey(normBranch, date);
    const branchPrefix = `inventory:branch:${normBranch}`;
    const allPrefix = `inventory:branch:ALL`;

    if (upstashClient) {
      // Direct delete of specific key
      await upstashClient.del(specificKey);
      invalidatedKeys.push(specificKey);

      // Scan and delete related branch keys
      try {
        const branchKeys = await upstashClient.keys(`${branchPrefix}*`);
        const allKeys = await upstashClient.keys(`${allPrefix}*`);
        const toDelete = Array.from(new Set([...branchKeys, ...allKeys]));
        if (toDelete.length > 0) {
          await upstashClient.del(...toDelete);
          invalidatedKeys.push(...toDelete);
        }
      } catch (scanErr) {
        console.warn('[Redis Cache] Pattern keys delete warning:', scanErr);
      }
    } else {
      // Local dev cache invalidation
      for (const k of Array.from(localDevCache.keys())) {
        if (k.startsWith(branchPrefix) || k.startsWith(allPrefix) || k === specificKey) {
          localDevCache.delete(k);
          invalidatedKeys.push(k);
        }
      }
    }

    const uniqueKeys = Array.from(new Set(invalidatedKeys));
    return { count: uniqueKeys.length, keys: uniqueKeys };
  } catch (err: any) {
    console.error(`[Redis Cache Error] Invalidation failed for branch "${normBranch}":`, err?.message || err);
    return { count: 0, keys: [] };
  }
}
