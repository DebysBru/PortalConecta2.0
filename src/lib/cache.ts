// Cache em memória com TTL (Time To Live)
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(defaultTTLms: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLms;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    // Limitar tamanho do cache (max 500 entradas)
    if (this.cache.size >= 500) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Instância global do cache
export const cache = new MemoryCache();

// Helper para buscar com cache
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  
  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}
