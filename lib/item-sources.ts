// ============================================
// 物品來源資訊 API - 整合 Teamcraft 資料
// ============================================

import nodesData from '@/data/nodes.json';
import npcsData from '@/data/npcs.json';
import placesZh from '@/data/places-zh.json';
import { simplifiedToTw } from '@/lib/i18n/tw-translation';

// 類型定義
interface NodeData {
  items: number[];
  limited?: boolean;
  level: number;
  type: number;
  base?: number;
  legendary?: boolean;
  ephemeral?: boolean;
  spawns?: number[];
  duration?: number;
  zoneid?: number;
  radius?: number;
  x?: number;
  y?: number;
  z?: number;
  map?: number;
}

interface NpcData {
  en: string;
  ja: string;
  de: string;
  fr: string;
  title?: {
    en: string;
    ja: string;
    de: string;
    fr: string;
  };
  defaultTalks?: number[];
  position?: {
    zoneid: number;
    map: number;
    x: number;
    y: number;
    z: number;
  };
}

const nodes = nodesData as unknown as Record<string, NodeData>;
const npcs = npcsData as unknown as Record<string, NpcData>;
const placesZhMap = placesZh as unknown as Record<string, string | number>;

// 快取
const GARLAND_API_BASE = 'https://garlandtools.org/db/doc';
const itemSourceCache = new Map<number, { data: ItemSourceInfo | null; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 分鐘快取

// 採集類型對照
const GATHERING_TYPES: Record<number, { name: string; nameZh: string; icon: string }> = {
  0: { name: 'Mining', nameZh: '採掘', icon: '⛏️' },
  1: { name: 'Quarrying', nameZh: '碎石', icon: '🪨' },
  2: { name: 'Logging', nameZh: '伐木', icon: '🪓' },
  3: { name: 'Harvesting', nameZh: '割草', icon: '🌿' },
  4: { name: 'Spearfishing', nameZh: '刺魚', icon: '🔱' },
};

// ====== 類型定義 ======

export interface ItemSourceInfo {
  itemId: number;
  itemName: string;
  price?: number;
  gatheringNodes: GatheringNodeInfo[];
  vendors: VendorInfoDetail[];
  drops: MobDropInfo[];
}

export interface GatheringNodeInfo {
  id: number;
  name: string;
  nameZh: string;
  level: number;
  type: number;
  typeName: string;
  typeNameZh: string;
  typeIcon: string;
  zoneId: number;
  zoneName: string;
  zoneNameZh: string;
  x: number;
  y: number;
  mapId: number;
  limited: boolean;
  legendary: boolean;
  ephemeral: boolean;
  spawns: number[];
  duration: number;
}

export interface VendorInfoDetail {
  id: number;
  name: string;
  nameZh: string;
  title: string;
  titleZh: string;
  zoneId: number;
  zoneName: string;
  zoneNameZh: string;
  x: number;
  y: number;
  mapId: number;
  price: number;
}

export interface MobDropInfo {
  id: number;
  name: string;
  level: string;
  zoneId: number;
  zoneName: string;
  zoneNameZh: string;
}

// ====== 輔助函式 ======

/**
 * 取得區域中文名稱（自動轉換為繁體中文）
 */
export function getZoneNameZh(zoneId: number): string {
  const value = placesZhMap[String(zoneId)];
  if (typeof value === 'string') {
    // 將簡體中文轉換為繁體中文
    return simplifiedToTw(value);
  }
  return `區域 ${zoneId}`;
}

/**
 * 從 Teamcraft 資料取得採集點資訊
 */
function getNodeInfoFromTeamcraft(nodeId: number): Omit<GatheringNodeInfo, 'name'> | null {
  const nodeData = nodes[String(nodeId)];
  if (!nodeData) return null;

  const gatheringType = GATHERING_TYPES[nodeData.type] || GATHERING_TYPES[0];
  const zoneNameZh = getZoneNameZh(nodeData.zoneid || 0);

  return {
    id: nodeId,
    nameZh: zoneNameZh,
    level: nodeData.level,
    type: nodeData.type,
    typeName: gatheringType.name,
    typeNameZh: gatheringType.nameZh,
    typeIcon: gatheringType.icon,
    zoneId: nodeData.zoneid || 0,
    zoneName: `Zone ${nodeData.zoneid || 0}`,
    zoneNameZh,
    x: nodeData.x || 0,
    y: nodeData.y || 0,
    mapId: nodeData.map || 0,
    limited: nodeData.limited || false,
    legendary: nodeData.legendary || false,
    ephemeral: nodeData.ephemeral || false,
    spawns: nodeData.spawns || [],
    duration: nodeData.duration || 0,
  };
}

/**
 * 從 Teamcraft 資料取得 NPC 資訊
 */
function getNpcInfoFromTeamcraft(npcId: number): Omit<VendorInfoDetail, 'price'> | null {
  const npcData = npcs[String(npcId)];
  if (!npcData) return null;

  // 過濾掉沒有位置資訊的 NPC
  if (!npcData.position) return null;

  const zoneNameZh = getZoneNameZh(npcData.position.zoneid);
  
  // 嘗試解析日文名稱中的中文部分，或使用英文
  let nameZh = npcData.en;
  // 日文名稱格式通常是 "職業 名字" 或直接名字
  if (npcData.ja) {
    // 部分 NPC 可以直接用
    nameZh = npcData.ja;
  }

  let titleZh = npcData.title?.en || '';
  if (npcData.title?.ja) {
    // 日文職稱
    const japaneseToZh: Record<string, string> = {
      'SHOP': '商店',
      '素材屋': '素材屋',
      '雑貨屋': '雜貨店',
      '道具屋': '道具店',
      '武器屋': '武器店',
      '防具屋': '防具店',
      '商店': '商店',
    };
    titleZh = japaneseToZh[npcData.title.ja] || npcData.title.ja;
  }

  return {
    id: npcId,
    name: npcData.en,
    nameZh,
    title: npcData.title?.en || '',
    titleZh,
    zoneId: npcData.position.zoneid,
    zoneName: `Zone ${npcData.position.zoneid}`,
    zoneNameZh,
    x: Math.round(npcData.position.x * 10) / 10,
    y: Math.round(npcData.position.y * 10) / 10,
    mapId: npcData.position.map,
  };
}

// ====== 主要 API ======

/**
 * 從 Garland Tools 取得物品來源，並整合 Teamcraft 座標資料
 */
export async function getItemSources(itemId: number): Promise<ItemSourceInfo | null> {
  // 檢查快取
  const cached = itemSourceCache.get(itemId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${GARLAND_API_BASE}/item/en/3/${itemId}.json`);
    if (!response.ok) {
      itemSourceCache.set(itemId, { data: null, timestamp: Date.now() });
      return null;
    }
    
    const data = await response.json();
    const item = data.item;
    const partials = data.partials || [];
    
    // 建立 partial 索引
    const partialMap = new Map<string, any>();
    for (const partial of partials) {
      const key = `${partial.type}-${partial.id}`;
      partialMap.set(key, partial.obj);
    }
    
    // 解析採集點 - 整合 Teamcraft 座標資料
    const gatheringNodes: GatheringNodeInfo[] = [];
    if (item.nodes) {
      for (const nodeId of item.nodes) {
        const garlandNode = partialMap.get(`node-${nodeId}`);
        const teamcraftNode = getNodeInfoFromTeamcraft(nodeId);
        
        if (teamcraftNode) {
          gatheringNodes.push({
            ...teamcraftNode,
            name: garlandNode?.n || `採集點 ${nodeId}`,
          });
        } else if (garlandNode) {
          // 沒有 Teamcraft 資料，使用 Garland 基本資料
          const gatheringType = GATHERING_TYPES[garlandNode.t] || GATHERING_TYPES[0];
          gatheringNodes.push({
            id: nodeId,
            name: garlandNode.n,
            nameZh: getZoneNameZh(garlandNode.z),
            level: garlandNode.l,
            type: garlandNode.t,
            typeName: gatheringType.name,
            typeNameZh: gatheringType.nameZh,
            typeIcon: gatheringType.icon,
            zoneId: garlandNode.z,
            zoneName: garlandNode.n,
            zoneNameZh: getZoneNameZh(garlandNode.z),
            x: 0,
            y: 0,
            mapId: 0,
            limited: false,
            legendary: false,
            ephemeral: false,
            spawns: [],
            duration: 0,
          });
        }
      }
    }
    
    // 解析商店 - 整合 Teamcraft 座標資料
    const vendors: VendorInfoDetail[] = [];
    if (item.vendors) {
      for (const vendorId of item.vendors) {
        const npcInfo = getNpcInfoFromTeamcraft(vendorId);
        
        // 只加入有位置資訊的 NPC
        if (npcInfo) {
          vendors.push({
            ...npcInfo,
            price: item.price || 0,
          });
        }
      }
    }
    
    // 解析怪物掉落
    const drops: MobDropInfo[] = [];
    if (item.drops) {
      for (const dropId of item.drops) {
        const mobData = partialMap.get(`mob-${dropId}`);
        if (mobData) {
          drops.push({
            id: mobData.i,
            name: mobData.n,
            level: mobData.l,
            zoneId: mobData.z,
            zoneName: mobData.n,
            zoneNameZh: getZoneNameZh(mobData.z),
          });
        }
      }
    }
    
    const result: ItemSourceInfo = {
      itemId,
      itemName: item.name,
      price: item.price,
      gatheringNodes,
      vendors,
      drops,
    };

    // 儲存到快取
    itemSourceCache.set(itemId, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error('Failed to fetch item sources:', error);
    itemSourceCache.set(itemId, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * 批次取得多個物品的來源資訊
 */
export async function getItemSourcesBatch(itemIds: number[]): Promise<Map<number, ItemSourceInfo>> {
  const results = new Map<number, ItemSourceInfo>();
  
  // 並行請求，但限制並發數
  const batchSize = 5;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const promises = batch.map(id => getItemSources(id));
    const batchResults = await Promise.all(promises);
    
    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result) {
        results.set(batch[j], result);
      }
    }
  }
  
  return results;
}

/**
 * 根據物品 ID 搜尋可採集的節點
 */
export function findNodesForItem(itemId: number): GatheringNodeInfo[] {
  const result: GatheringNodeInfo[] = [];
  
  for (const [nodeIdStr, nodeData] of Object.entries(nodes)) {
    if (nodeData.items.includes(itemId)) {
      const nodeId = parseInt(nodeIdStr);
      const gatheringType = GATHERING_TYPES[nodeData.type] || GATHERING_TYPES[0];
      const zoneNameZh = getZoneNameZh(nodeData.zoneid || 0);
      
      result.push({
        id: nodeId,
        name: zoneNameZh,
        nameZh: zoneNameZh,
        level: nodeData.level,
        type: nodeData.type,
        typeName: gatheringType.name,
        typeNameZh: gatheringType.nameZh,
        typeIcon: gatheringType.icon,
        zoneId: nodeData.zoneid || 0,
        zoneName: zoneNameZh,
        zoneNameZh,
        x: nodeData.x || 0,
        y: nodeData.y || 0,
        mapId: nodeData.map || 0,
        limited: nodeData.limited || false,
        legendary: nodeData.legendary || false,
        ephemeral: nodeData.ephemeral || false,
        spawns: nodeData.spawns || [],
        duration: nodeData.duration || 0,
      });
    }
  }
  
  return result;
}
