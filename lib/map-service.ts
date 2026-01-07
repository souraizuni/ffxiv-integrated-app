// ============================================
// 地圖服務 - FFXIV 遊戲地圖顯示與座標轉換
// ============================================

import mapEntriesData from '@/data/map-entries.json';

// 地圖資料類型
interface MapEntryRaw {
  id: number;
  zone: number;
  name: string;
  territory: number;
  scale: number;
  weatherRate: number;
}

export interface MapData {
  id: number;
  zoneId: number;
  name: string;
  territoryId: number;
  sizeFactor: number; // scale 欄位，用於座標轉換
  image: string;
}

export interface MapMarker {
  x: number;
  y: number;
  iconType?: 'gathering' | 'vendor' | 'monster' | 'custom';
  icon?: string;
  tooltip?: string;
  color?: string;
  size?: number;
  zIndex?: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

// 載入地圖資料
const mapEntries = mapEntriesData as MapEntryRaw[];
const mapById = new Map<number, MapEntryRaw>();
const mapByZone = new Map<number, MapEntryRaw>();

// 建立索引
mapEntries.forEach((entry) => {
  mapById.set(entry.id, entry);
  // 只保留第一個匹配的 zone（主地圖）
  if (!mapByZone.has(entry.zone)) {
    mapByZone.set(entry.zone, entry);
  }
});

/**
 * 根據地圖 ID 取得地圖資料
 */
export function getMapById(mapId: number): MapData | null {
  const entry = mapById.get(mapId);
  if (!entry) return null;

  return {
    id: entry.id,
    zoneId: entry.zone,
    name: entry.name,
    territoryId: entry.territory,
    sizeFactor: entry.scale,
    image: getMapImageUrl(mapId),
  };
}

/**
 * 根據區域 ID 取得地圖資料
 */
export function getMapByZone(zoneId: number): MapData | null {
  const entry = mapByZone.get(zoneId);
  if (!entry) return null;

  return {
    id: entry.id,
    zoneId: entry.zone,
    name: entry.name,
    territoryId: entry.territory,
    sizeFactor: entry.scale,
    image: getMapImageUrl(entry.id),
  };
}

// 地圖 ID 到 XIVAPI MapFilenameId 的映射快取
const mapFilenameCache = new Map<number, string>();

/**
 * 從 XIVAPI 取得地圖檔案路徑
 * 這會查詢並快取地圖的實際檔案名稱
 */
export async function fetchMapFilename(mapId: number): Promise<string | null> {
  // 檢查快取
  if (mapFilenameCache.has(mapId)) {
    return mapFilenameCache.get(mapId)!;
  }

  try {
    const response = await fetch(`https://xivapi.com/Map/${mapId}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const filename = data.MapFilenameId; // 例如 "f1f1/00"
    
    if (filename) {
      mapFilenameCache.set(mapId, filename);
      return filename;
    }
  } catch (error) {
    console.error('Failed to fetch map filename:', error);
  }
  
  return null;
}

/**
 * 取得地圖圖片 URL（同步版本，用於初始渲染）
 * 這會返回一個可以異步更新的 URL
 */
export function getMapImageUrl(mapId: number): string {
  // 如果快取中有，直接使用
  const cachedFilename = mapFilenameCache.get(mapId);
  if (cachedFilename) {
    return `https://xivapi.com/m/${cachedFilename.replace('/', '/')}.jpg`;
  }
  
  // 回傳空字串，讓元件使用異步載入
  return '';
}

/**
 * 取得完整的地圖圖片 URL（異步版本）
 */
export async function getMapImageUrlAsync(mapId: number): Promise<string> {
  const filename = await fetchMapFilename(mapId);
  if (!filename) return '';
  
  // XIVAPI 地圖圖片 URL 格式
  // MapFilenameId = "f1f1/00" => URL = "/m/f1f1/f1f1.00.jpg"
  const parts = filename.split('/');
  if (parts.length === 2) {
    return `https://xivapi.com/m/${parts[0]}/${parts[0]}.${parts[1]}.jpg`;
  }
  
  return '';
}

/**
 * 將遊戲座標轉換為地圖上的百分比位置
 * 這是 Teamcraft 的核心演算法
 * 
 * @param mapData 地圖資料
 * @param position 遊戲內座標 (x, y)
 * @returns 百分比位置 (0-100)
 */
export function getPositionPercentOnMap(mapData: MapData, position: Vector2): Vector2 {
  const scale = mapData.sizeFactor / 100;

  // Teamcraft 公式：將遊戲座標轉換為地圖圖片上的百分比位置
  // 遊戲座標從 1 開始，地圖座標系統是 2048 像素
  const x = ((position.x - 1) * 50 * scale) / 20.48;
  const y = ((position.y - 1) * 50 * scale) / 20.48;

  return { x, y };
}

/**
 * 將地圖百分比位置轉換回遊戲座標
 * 
 * @param mapData 地圖資料
 * @param percent 百分比位置 (0-100)
 * @returns 遊戲內座標
 */
export function getGamePositionFromPercent(mapData: MapData, percent: Vector2): Vector2 {
  const scale = mapData.sizeFactor / 100;

  // 反向計算：percent -> gameCoord
  // gameCoord = percent * 20.48 / (50 * scale) + 1
  const x = (percent.x * 20.48) / (50 * scale) + 1;
  const y = (percent.y * 20.48) / (50 * scale) + 1;

  return { x, y };
}

/**
 * 格式化座標為遊戲內顯示格式
 */
export function formatCoordinate(x: number, y: number): string {
  return `(${x.toFixed(1)}, ${y.toFixed(1)})`;
}

/**
 * 取得標記的樣式
 */
export function getMarkerStyle(marker: MapMarker): {
  icon: string;
  color: string;
  bgColor: string;
} {
  switch (marker.iconType) {
    case 'gathering':
      return {
        icon: marker.icon || '⛏️',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      };
    case 'vendor':
      return {
        icon: marker.icon || '🏪',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
      };
    case 'monster':
      return {
        icon: marker.icon || '👾',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
      };
    default:
      return {
        icon: marker.icon || '📍',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      };
  }
}

/**
 * 搜尋地圖
 */
export function searchMaps(query: string): MapData[] {
  const lowerQuery = query.toLowerCase();
  return mapEntries
    .filter((entry) => entry.name.toLowerCase().includes(lowerQuery))
    .map((entry) => ({
      id: entry.id,
      zoneId: entry.zone,
      name: entry.name,
      territoryId: entry.territory,
      sizeFactor: entry.scale,
      image: getMapImageUrl(entry.id),
    }));
}

/**
 * 取得所有地圖列表
 */
export function getAllMaps(): MapData[] {
  return mapEntries.map((entry) => ({
    id: entry.id,
    zoneId: entry.zone,
    name: entry.name,
    territoryId: entry.territory,
    sizeFactor: entry.scale,
    image: getMapImageUrl(entry.id),
  }));
}
