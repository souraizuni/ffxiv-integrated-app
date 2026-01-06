// ============================================
// FFXIV Integrated App - Type Definitions
// ============================================

// ---- 基礎物品類型 ----
export interface Item {
  id: number;
  name: string;
  name_en: string;
  name_ja: string;
  name_zh: string;
  icon: string;
  iconUrl: string;
  description?: string;
  itemLevel: number;
  stackSize: number;
  isUntradable: boolean;
  categoryId: number;
  categoryName: string;
}

// ---- 配方相關類型 ----
export interface RecipeIngredient {
  itemId: number;
  item?: Item;
  amount: number;
  isHQ: boolean;
}

export interface Recipe {
  id: number;
  itemId: number;
  item?: Item;
  craftType: CraftJob;
  craftTypeLevel: number;
  recipeLevel: number;
  difficulty: number;
  durability: number;
  quality: number;
  requiredCraftsmanship: number;
  requiredControl: number;
  ingredients: RecipeIngredient[];
  canQuickSynth: boolean;
  canHQ: boolean;
  stars: number;
  amountResult?: number; // 每次製作產出數量
  // 配方等級相關參數（用於精確計算進度/品質）
  progressDivider: number;
  progressModifier: number;
  qualityDivider: number;
  qualityModifier: number;
  conditionsFlag: number;
  // RecipeLevelTable 的基礎值（用於 WASM 求解器的精確計算）
  baseDifficulty?: number;
  baseQuality?: number;
  baseDurability?: number;
  // RecipeLevelTable ID（用於 WASM 求解器）
  recipeLevelId?: number;
}

// ---- 材料樹結構 ----
export interface MaterialTreeNode {
  itemId: number;
  item: Item;
  amount: number;
  recipe?: Recipe;
  children: MaterialTreeNode[];
  depth: number;
  isBaseMaterial: boolean;
}

export interface FlattenedMaterial {
  itemId: number;
  item: Item;
  totalAmount: number;
  isBaseMaterial: boolean;
  gatheredFrom?: GatheringPoint[];
}

// ---- 採集點資訊 ----
export interface GatheringPoint {
  id: number;
  itemId: number;
  zoneId: number;
  zoneName: string;
  mapX: number;
  mapY: number;
  gatheringType: 'Mining' | 'Quarrying' | 'Logging' | 'Harvesting' | 'Fishing';
  level: number;
  isHidden: boolean;
  spawnTimes?: string[];
}

// ---- 生產職業類型 ----
export type CraftJob =
  | 'CRP' // 刻木匠
  | 'BSM' // 鍛冶匠
  | 'ARM' // 鑄甲匠
  | 'GSM' // 雕金匠
  | 'LTW' // 製革匠
  | 'WVR' // 裁縫師
  | 'ALC' // 鍊金術師
  | 'CUL'; // 烹調師

export const CraftJobNames: Record<CraftJob, string> = {
  CRP: '刻木匠',
  BSM: '鍛冶匠',
  ARM: '鑄甲匠',
  GSM: '雕金匠',
  LTW: '製革匠',
  WVR: '裁縫師',
  ALC: '鍊金術師',
  CUL: '烹調師',
};

// ---- 玩家屬性 ----
export interface CrafterStats {
  job: CraftJob;
  level: number;
  craftsmanship: number;
  control: number;
  cp: number;
  specialist: boolean;
}

// ---- 生產模擬相關 ----
export interface CraftingState {
  recipe: Recipe;
  crafterStats: CrafterStats;
  step: number;
  progress: number;
  quality: number;
  durability: number;
  cp: number;
  condition: CraftCondition;
  buffs: CraftBuff[];
  actions: CraftAction[];
  isComplete: boolean;
  isSuccess: boolean;
  isHQ: boolean;
}

export type CraftCondition =
  | 'Normal'
  | 'Good'
  | 'Excellent'
  | 'Poor'
  | 'Centered'
  | 'Sturdy'
  | 'Pliant'
  | 'Malleable'
  | 'Primed';

export interface CraftBuff {
  name: string;
  duration: number;
  stacks?: number;
}

export interface CraftAction {
  id: string;
  name: string;
  nameZh: string;
  cpCost: number;
  durabilityCost: number;
  successRate: number;
  category: 'progress' | 'quality' | 'durability' | 'buff' | 'other';
  levelRequirement: number;
  description: string;
}

// ---- 收集追蹤相關 ----
export interface CollectionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories?: CollectionSubcategory[];
}

export interface CollectionSubcategory {
  id: string;
  name: string;
  parentId: string;
  itemIds: number[];
}

export interface CollectedItem {
  id: string;
  userId: string;
  itemId: number;
  collectedAt: Date;
  isHQ: boolean;
  notes?: string;
}

export interface CollectionProgress {
  categoryId: string;
  totalItems: number;
  collectedItems: number;
  percentage: number;
}

// ---- 市場價格相關 (Universalis) ----
export interface MarketListing {
  listingId: string;
  itemId: number;
  worldId: number;
  worldName: string;
  pricePerUnit: number;
  quantity: number;
  total: number;
  isHQ: boolean;
  retainerName: string;
  lastReviewTime: number;
}

export interface MarketHistory {
  itemId: number;
  worldId: number;
  entries: MarketHistoryEntry[];
}

export interface MarketHistoryEntry {
  pricePerUnit: number;
  quantity: number;
  timestamp: number;
  isHQ: boolean;
  buyerName?: string;
}

export interface MarketData {
  itemId: number;
  worldId?: number;
  dcName?: string;
  listings: MarketListing[];
  recentHistory: MarketHistoryEntry[];
  currentAveragePrice: number;
  currentAveragePriceNQ: number;
  currentAveragePriceHQ: number;
  minPriceNQ: number;
  minPriceHQ: number;
  lastUploadTime: number;
}

// ---- 使用者設定 ----
export interface UserSettings {
  userId: string;
  defaultServer: string;
  defaultDataCenter: string;
  crafterStats: CrafterStats[];
  theme: 'light' | 'dark' | 'system';
  language: 'zh-TW' | 'en' | 'ja';
}

// ---- API 回應類型 ----
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---- Supabase 資料表類型 ----
export interface Database {
  public: {
    Tables: {
      collected_items: {
        Row: CollectedItem;
        Insert: Omit<CollectedItem, 'id' | 'collectedAt'>;
        Update: Partial<CollectedItem>;
      };
      user_settings: {
        Row: UserSettings;
        Insert: UserSettings;
        Update: Partial<UserSettings>;
      };
      crafting_lists: {
        Row: CraftingList;
        Insert: Omit<CraftingList, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<CraftingList>;
      };
    };
  };
}

export interface CraftingList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  items: CraftingListItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CraftingListItem {
  itemId: number;
  quantity: number;
  isCompleted: boolean;
}
