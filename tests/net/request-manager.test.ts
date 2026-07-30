import { describe, it, expect, vi } from 'vitest';
import { RequestManager, isAbortError } from '@/lib/net/request-manager';
import { LRUCache } from '@/lib/net/lru-cache';

// ============================================
// 請求治理層
// ============================================
// 存在的理由：市場掃描一次會連發數十個批次請求，先前是裸 fetch、
// 批次之間沒有任何間隔，大範圍掃描很容易被 Universalis 擋下來。

describe('RequestManager 節流', () => {
  it('請求之間維持最小間隔', async () => {
    const manager = new RequestManager(60);
    const timestamps: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, () =>
        manager.request(async () => {
          timestamps.push(Date.now());
        })
      )
    );

    expect(timestamps).toHaveLength(4);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(50);
    }
  });

  it('併發呼叫會排隊而非同時放行', async () => {
    // 若各自比對時間戳而不排隊，這幾個請求會同時通過檢查
    const manager = new RequestManager(50);
    let concurrent = 0;
    let maxConcurrent = 0;

    await Promise.all(
      Array.from({ length: 5 }, () =>
        manager.request(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
        })
      )
    );

    expect(maxConcurrent).toBe(1);
  });
});

describe('RequestManager 重試', () => {
  it('429 會以退避重試並最終成功', async () => {
    const manager = new RequestManager(10, 20, 100);
    let attempts = 0;

    const result = await manager.request(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error('rate limited'), { status: 429 });
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('5xx 也會重試', async () => {
    const manager = new RequestManager(10, 20, 100);
    let attempts = 0;

    await manager.request(async () => {
      attempts++;
      if (attempts < 2) throw Object.assign(new Error('boom'), { status: 503 });
      return 'ok';
    });

    expect(attempts).toBe(2);
  });

  it('4xx（非 429）不重試，直接拋出', async () => {
    const manager = new RequestManager(10, 20, 100);
    let attempts = 0;

    await expect(
      manager.request(async () => {
        attempts++;
        throw Object.assign(new Error('not found'), { status: 404 });
      })
    ).rejects.toThrow('not found');

    expect(attempts).toBe(1);
  });

  it('超過重試上限後拋出最後一個錯誤', async () => {
    const manager = new RequestManager(10, 10, 30);
    let attempts = 0;

    await expect(
      manager.request(
        async () => {
          attempts++;
          throw Object.assign(new Error('always 429'), { status: 429 });
        },
        { maxRetries: 2 }
      )
    ).rejects.toThrow('always 429');

    expect(attempts).toBe(3); // 首次 + 2 次重試
  });

  it('觸發速率限制時會通知呼叫端', async () => {
    const manager = new RequestManager(10, 20, 100);
    const onRateLimit = vi.fn();
    let attempts = 0;

    await manager.request(
      async () => {
        attempts++;
        if (attempts < 2) throw Object.assign(new Error('429'), { status: 429 });
        return 'ok';
      },
      { onRateLimit }
    );

    expect(onRateLimit).toHaveBeenCalledOnce();
  });
});

describe('RequestManager 取消', () => {
  it('已取消的 signal 不會執行請求', async () => {
    const manager = new RequestManager(10);
    const controller = new AbortController();
    controller.abort();

    const task = vi.fn();
    await expect(manager.request(task, { signal: controller.signal })).rejects.toSatisfy(
      isAbortError
    );

    expect(task).not.toHaveBeenCalled();
  });

  it('單一請求失敗不會卡住後續請求', async () => {
    const manager = new RequestManager(10);

    await expect(
      manager.request(async () => {
        throw Object.assign(new Error('fail'), { status: 400 });
      })
    ).rejects.toThrow();

    await expect(manager.request(async () => 'still works')).resolves.toBe('still works');
  });
});

describe('LRUCache', () => {
  it('超過上限時淘汰最久未使用的項目', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    cache.get('a'); // a 變成最近使用
    cache.set('d', 4); // 應淘汰 b

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('TTL 到期後視為未命中', async () => {
    const cache = new LRUCache<string, number>(10, 30);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);

    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get('a')).toBeUndefined();
  });

  it('重複寫入同一個 key 不會增加大小', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('a', 2);

    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBe(2);
  });
});
