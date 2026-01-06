// ============================================
// 來源分類定義（參考 ffxiv-collection-tc）
// ============================================

// 來源分類及圖示
export const SOURCE_CATEGORIES: Record<string, { name: string; iconId: number }> = {
  Gil: { name: '金幣', iconId: 65002 },
  Scrips: { name: '工票', iconId: 65028 },
  MGP: { name: '金碟幣', iconId: 65025 },
  PvP: { name: 'PvP', iconId: 61806 },
  Duty: { name: '副本', iconId: 60414 },
  Quest: { name: '任務', iconId: 61419 },
  Event: { name: '活動', iconId: 61757 },
  Tomestones: { name: '神典石', iconId: 65086 },
  DeepDungeon: { name: '深層迷宮', iconId: 61824 },
  BeastTribes: { name: '蠻族', iconId: 65016 },
  MogStation: { name: '商城', iconId: 61831 },
  Achievement: { name: '成就', iconId: 6 },
  AchievementCertificate: { name: '成就幣', iconId: 65059 },
  CompanySeals: { name: '軍票', iconId: 65005 },
  IslandSanctuary: { name: '無人島', iconId: 65096 },
  HuntSeals: { name: '狩獵', iconId: 65034 },
  TreasureHunts: { name: '挖寶', iconId: 115 },
  Crafting: { name: '製作', iconId: 62202 },
  Voyages: { name: '遠航探索', iconId: 65035 },
  Venture: { name: '雇員探索', iconId: 65049 },
  FirmamentFete: { name: '蒼天街', iconId: 65073 },
  Other: { name: '其他', iconId: 60414 },
};

// 版本篩選
export const PATCH_VERSIONS = [
  { label: '7.x', minPatch: 7.0, maxPatch: 7.99, iconId: 61880 },
  { label: '6.x', minPatch: 6.0, maxPatch: 6.99, iconId: 61879 },
  { label: '5.x', minPatch: 5.0, maxPatch: 5.99, iconId: 61878 },
  { label: '4.x', minPatch: 4.0, maxPatch: 4.99, iconId: 61877 },
  { label: '3.x', minPatch: 3.0, maxPatch: 3.99, iconId: 61876 },
  { label: '2.x', minPatch: 2.0, maxPatch: 2.99, iconId: 61875 },
];

// 收集類型名稱翻譯
export const COLLECTION_NAMES: Record<string, string> = {
  'Glamour': '裝備',
  'Mounts': '坐騎',
  'Minions': '寵物',
  'Emotes': '表情',
  'Hairstyles': '髮型',
  'Triple Triad': '幻卡',
  'Blue Mage': '青魔',
  'Bardings': '鳥鞍',
  'Orchestrions': '管弦樂譜',
  'Framer Kits': '肖像',
  'Fashion Accessories': '時尚配件',
  'Glasses': '眼鏡',
};

// 取得圖示 URL
export function getIconUrl(iconId: number): string {
  const folder = Math.floor(iconId / 1000) * 1000;
  const folderStr = folder.toString().padStart(6, '0');
  const iconStr = iconId.toString().padStart(6, '0');
  return `https://xivapi.com/i/${folderStr}/${iconStr}.png`;
}

// 收集項目類型
export interface CollectionItem {
  Id: number;
  Name: string;
  Description?: string;
  PatchAdded: number;
  DisplayPatch: string;
  IconId: number;
  IconUrl: string;
  Sources?: ItemSource[];
}

// 來源類型
export interface ItemSource {
  Name: string;
  Type: string;
  Categories?: string[];
  Costs?: { ItemName: string; Amount: number }[];
  NpcName?: string;
  Location?: { Territory: string };
}

// 收集類型
export interface Collection {
  CollectionName: string;
  DisplayName?: string;
  OrderKey: number;
  Items: CollectionItem[];
}

// 收集資料
export interface CollectionsData {
  ExportedAt: string;
  Collections: Collection[];
}

// 篩選狀態
export interface FilterState {
  activeCategories: Set<string>;
  activePatches: Set<string>;
  searchQuery: string;
  showNoSource: boolean;
  ownershipFilter: 'all' | 'owned' | 'not-owned';
}

// 建立預設篩選狀態
export function createDefaultFilterState(): FilterState {
  return {
    activeCategories: new Set(),
    activePatches: new Set(),
    searchQuery: '',
    showNoSource: false,
    ownershipFilter: 'all',
  };
}

// 檢查項目是否通過篩選
export function passesFilters(
  item: CollectionItem,
  filterState: FilterState,
  isOwned: (id: number) => boolean
): boolean {
  // 搜尋過濾
  if (filterState.searchQuery) {
    const query = filterState.searchQuery.toLowerCase();
    if (!item.Name.toLowerCase().includes(query)) {
      return false;
    }
  }

  // 擁有狀態過濾
  if (filterState.ownershipFilter === 'owned' && !isOwned(item.Id)) {
    return false;
  }
  if (filterState.ownershipFilter === 'not-owned' && isOwned(item.Id)) {
    return false;
  }

  // 來源分類過濾
  if (filterState.activeCategories.size > 0) {
    if (!item.Sources || item.Sources.length === 0) {
      if (!filterState.showNoSource) return false;
    } else {
      let categoryMatch = false;
      for (const source of item.Sources) {
        if (source.Categories) {
          for (const cat of source.Categories) {
            if (filterState.activeCategories.has(cat)) {
              categoryMatch = true;
              break;
            }
          }
        }
        if (categoryMatch) break;
      }
      if (!categoryMatch) return false;
    }
  }

  // 版本過濾
  if (filterState.activePatches.size > 0) {
    let patchMatch = false;
    for (const patchDef of PATCH_VERSIONS) {
      if (filterState.activePatches.has(patchDef.label)) {
        if (item.PatchAdded >= patchDef.minPatch && item.PatchAdded <= patchDef.maxPatch) {
          patchMatch = true;
          break;
        }
      }
    }
    if (!patchMatch) return false;
  }

  return true;
}
