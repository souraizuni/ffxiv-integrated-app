// ============================================
// 有上限的 LRU 快取
// ============================================
// 專案先前所有快取都是無上限的 Map（物品、配方、來源、圖示…），
// 長時間停在頁面上會持續累積、不會釋放。市場資料還會隨時間失效，
// 因此這裡同時支援 TTL。

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();

  constructor(
    private readonly maxSize = 500,
    /** 存活時間（毫秒）；<= 0 表示不過期 */
    private readonly ttlMs = 0
  ) {}

  private isExpired(entry: Entry<V>): boolean {
    return this.ttlMs > 0 && Date.now() > entry.expiresAt;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }

    // Map 會保留插入順序，刪除後重新插入即代表「最近使用」
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);

    this.map.set(key, {
      value,
      expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : Number.POSITIVE_INFINITY,
    });

    // 超出上限時淘汰最久未使用的（Map 的第一個）
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
