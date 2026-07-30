import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { simplifiedToTw } from '@/lib/i18n/tw-translation';

// 物品名稱查詢與搜尋的測試已移至 tests/data/local-database.test.ts
// （改由本地 msgpack 資料庫提供）。這裡只剩不依賴資料檔的字元轉換。

describe('simplifiedToTw', () => {
  it('轉換常見簡體字', () => {
    expect(simplifiedToTw('铁')).toBe('鐵');
    expect(simplifiedToTw('黑铁锭')).toBe('黑鐵錠');
  });

  it('已是繁體時維持原樣', () => {
    expect(simplifiedToTw('黑鐵錠')).toBe('黑鐵錠');
  });

  it('轉換 FFXIV 專有名詞', () => {
    expect(simplifiedToTw('艾欧泽亚')).toBe('艾歐澤亞');
    expect(simplifiedToTw('陆行鸟')).toBe('陸行鳥');
  });

  it('非中文字元不受影響', () => {
    expect(simplifiedToTw('Iron Ingot 123')).toBe('Iron Ingot 123');
  });

  it('空字串安全', () => {
    expect(simplifiedToTw('')).toBe('');
  });
});

describe('bundle 體積守衛', () => {
  // tw-items.json 有 2.1 MB，被 import 就會整包進 JS bundle。
  // 物品名稱已改由 public/data/items.msgpack 按需載入，這裡把「不要再 import 回來」釘住。
  it('執行時的程式碼不得 import 大型 JSON 資料檔', async () => {
    const sources = [
      'lib/i18n/tw-translation.ts',
      'lib/data/items.ts',
      'lib/item-sources.ts',
      'app/market/page.tsx',
    ];

    for (const rel of sources) {
      const code = await readFile(resolve(process.cwd(), rel), 'utf8');
      const importsJson = /^\s*import\s+[^;]*from\s+['"][^'"]*\.json['"]/m.test(code);
      expect(importsJson, `${rel} 不應直接 import .json 資料檔`).toBe(false);
    }
  });
});
