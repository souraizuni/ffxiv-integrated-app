import { describe, it, expect } from 'vitest';
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
