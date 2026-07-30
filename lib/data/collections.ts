// ============================================
// 收集追蹤資料（按分頁載入）
// ============================================
// 原本 public/data/collections_data.json 是單一 34.8 MB 檔案，收集頁一掛載就整包下載，
// 但畫面同時只顯示一個分頁，而 Glamour 一項就佔了九成資料。
// 改成索引 + 每個分頁一個 msgpack 之後，首次進入只需載入預設分頁（坐騎約 63 KB）。

import { loadPack, isPackLoaded } from './msgpack-loader';
import { getIconUrl, type Collection, type CollectionItem } from '@/lib/collection/filters';

interface CollectionIndexEntry {
  name: string;
  slug: string;
  orderKey: number;
  count: number;
}

interface CollectionsIndexPack {
  v: number;
  exportedAt: string;
  collections: CollectionIndexEntry[];
}

/** 單一分頁的壓縮紀錄（短鍵是為了體積） */
interface RawCollectionItem {
  id: number;
  n: string;
  d: string;
  p: number;
  dp: string;
  c: number;
  s: Array<{ n: string; t: string; c: string[] }>;
}

interface CollectionPack {
  v: number;
  name: string;
  items: RawCollectionItem[];
}

export interface CollectionSummary {
  name: string;
  slug: string;
  orderKey: number;
  count: number;
}

/** 取得收集類型索引（很小，約 700 B） */
export async function getCollectionIndex(): Promise<{
  exportedAt: string;
  collections: CollectionSummary[];
}> {
  const pack = await loadPack<CollectionsIndexPack>('collections/index.msgpack');
  return { exportedAt: pack.exportedAt, collections: pack.collections };
}

function toCollectionItem(raw: RawCollectionItem): CollectionItem {
  return {
    Id: raw.id,
    Name: raw.n,
    Description: raw.d || undefined,
    PatchAdded: raw.p,
    DisplayPatch: raw.dp,
    IconId: raw.c,
    // IconUrl 原本逐筆存整條網址，等於把同一段前綴重複兩萬多次；改為由 IconId 推導
    IconUrl: getIconUrl(raw.c),
    Sources: raw.s.map((source) => ({
      Name: source.n,
      Type: source.t,
      Categories: source.c,
    })),
  };
}

/** 載入單一收集類型的完整項目 */
export async function getCollection(slug: string): Promise<Collection> {
  const pack = await loadPack<CollectionPack>(`collections/${slug}.msgpack`);

  return {
    CollectionName: pack.name,
    OrderKey: 0,
    Items: pack.items.map(toCollectionItem),
  };
}

/** 該分頁是否已在記憶體中（用來決定要不要顯示載入中） */
export function isCollectionLoaded(slug: string): boolean {
  return isPackLoaded(`collections/${slug}.msgpack`);
}
