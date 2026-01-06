// ============================================
// 配裝管理系統 - Gearsets Store
// 參考 ffxiv-best-craft 的實現
// ============================================

import type { CraftJob, CrafterStats } from '@/types';

// 配裝資料結構
export interface GearsetRow {
  id: number;
  name?: string;
  value: CrafterAttributes;
  compatibleJobs: CraftJob[];
}

// 製作者屬性
export interface CrafterAttributes {
  level: number;
  craftsmanship: number;
  control: number;
  cp: number;
}

// 食物/藥水加成效果
export interface Enhancer {
  id: string;
  name: string;
  level?: number;
  // 百分比加成
  craftsmanship?: number;
  craftsmanshipMax?: number;
  control?: number;
  controlMax?: number;
  cp?: number;
  cpMax?: number;
}

// 預設屬性（100級工匠裝）
export const DEFAULT_ATTRIBUTES: CrafterAttributes = {
  level: 100,
  craftsmanship: 4628,
  control: 4221,
  cp: 533,
};

// 所有生產職業列表
export const ALL_CRAFT_JOBS: CraftJob[] = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'];

// 職業名稱對照
export const JOB_NAMES: Record<CraftJob, string> = {
  CRP: '刻木匠',
  BSM: '鍛冶匠',
  ARM: '鑄甲匠',
  GSM: '雕金匠',
  LTW: '製革匠',
  WVR: '裁縫師',
  ALC: '鍊金術師',
  CUL: '烹調師',
};

// LocalStorage 鍵名
const STORAGE_KEY = 'ffxiv-gearsets';

/**
 * 配裝管理 Store
 */
export class GearsetsStore {
  private gearsets: GearsetRow[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 從 LocalStorage 載入配裝
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.initializeDefaults();
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.gearsets) && parsed.gearsets.length > 0) {
          this.gearsets = parsed.gearsets;
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load gearsets from storage:', e);
    }

    this.initializeDefaults();
  }

  /**
   * 初始化預設配裝
   */
  private initializeDefaults(): void {
    this.gearsets = [
      // 預設配裝（適用所有職業）
      {
        id: 0,
        name: '預設',
        value: { ...DEFAULT_ATTRIBUTES },
        compatibleJobs: [...ALL_CRAFT_JOBS],
      },
      // 每個職業的預設配裝
      ...ALL_CRAFT_JOBS.map((job, index) => ({
        id: index + 1,
        value: { ...DEFAULT_ATTRIBUTES },
        compatibleJobs: [job] as CraftJob[],
      })),
    ];
    this.saveToStorage();
  }

  /**
   * 儲存到 LocalStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ gearsets: this.gearsets }));
    } catch (e) {
      console.error('Failed to save gearsets to storage:', e);
    }
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * 訂閱變更
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 取得所有配裝
   */
  getAll(): GearsetRow[] {
    return [...this.gearsets];
  }

  /**
   * 取得預設配裝
   */
  getDefault(): GearsetRow {
    return this.gearsets[0];
  }

  /**
   * 根據 ID 取得配裝
   */
  getById(id: number): GearsetRow | undefined {
    return this.gearsets.find(g => g.id === id);
  }

  /**
   * 取得特定職業的配裝
   */
  getForJob(job: CraftJob): GearsetRow | undefined {
    return this.gearsets.find(g => 
      g.id !== 0 && g.compatibleJobs.includes(job)
    ) || this.getDefault();
  }

  /**
   * 取得特定職業的屬性
   */
  getAttributesForJob(job: CraftJob): CrafterAttributes {
    const gearset = this.getForJob(job);
    return gearset?.value || DEFAULT_ATTRIBUTES;
  }

  /**
   * 轉換為 CrafterStats
   */
  toCrafterStats(job: CraftJob, gearsetId?: number): CrafterStats {
    const gearset = gearsetId !== undefined 
      ? this.getById(gearsetId) 
      : this.getForJob(job);
    const attrs = gearset?.value || DEFAULT_ATTRIBUTES;
    
    return {
      job,
      level: attrs.level,
      craftsmanship: attrs.craftsmanship,
      control: attrs.control,
      cp: attrs.cp,
      specialist: false,
    };
  }

  /**
   * 新增配裝
   */
  addGearset(name?: string, jobs: CraftJob[] = [...ALL_CRAFT_JOBS]): number {
    const newId = Math.max(...this.gearsets.map(g => g.id)) + 1;
    this.gearsets.push({
      id: newId,
      name,
      value: { ...DEFAULT_ATTRIBUTES },
      compatibleJobs: jobs,
    });
    this.saveToStorage();
    this.notifyListeners();
    return newId;
  }

  /**
   * 更新配裝
   */
  updateGearset(id: number, updates: Partial<Omit<GearsetRow, 'id'>>): void {
    const index = this.gearsets.findIndex(g => g.id === id);
    if (index === -1) return;

    this.gearsets[index] = {
      ...this.gearsets[index],
      ...updates,
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * 更新配裝屬性
   */
  updateAttributes(id: number, attrs: Partial<CrafterAttributes>): void {
    const gearset = this.getById(id);
    if (!gearset) return;

    this.updateGearset(id, {
      value: { ...gearset.value, ...attrs },
    });
  }

  /**
   * 刪除配裝（不能刪除預設配裝）
   */
  deleteGearset(id: number): boolean {
    if (id === 0) return false;

    const index = this.gearsets.findIndex(g => g.id === id);
    if (index === -1) return false;

    this.gearsets.splice(index, 1);
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * 取得下一個可用 ID
   */
  nextId(): number {
    return Math.max(...this.gearsets.map(g => g.id)) + 1;
  }

  /**
   * 取得配裝顯示名稱
   */
  getDisplayName(gearset: GearsetRow): string {
    if (gearset.id === 0) return '預設';
    if (gearset.name) return gearset.name;
    
    if (gearset.compatibleJobs.length === 1) {
      return JOB_NAMES[gearset.compatibleJobs[0]];
    }
    if (gearset.compatibleJobs.length === 8) {
      return '通用';
    }
    return `自訂 ${gearset.id}`;
  }

  /**
   * 匯出為 JSON
   */
  toJson(): string {
    return JSON.stringify({ gearsets: this.gearsets }, null, 2);
  }

  /**
   * 從 JSON 匯入
   */
  fromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed.gearsets) && parsed.gearsets.length > 0) {
        this.gearsets = parsed.gearsets;
        this.saveToStorage();
        this.notifyListeners();
        return true;
      }
    } catch (e) {
      console.error('Failed to import gearsets:', e);
    }
    return false;
  }
}

// 單例
let gearsetsStoreInstance: GearsetsStore | null = null;

export function getGearsetsStore(): GearsetsStore {
  if (!gearsetsStoreInstance) {
    gearsetsStoreInstance = new GearsetsStore();
  }
  return gearsetsStoreInstance;
}

/**
 * 計算食物/藥水加成後的屬性
 */
export function calculateEnhancedAttributes(
  base: CrafterAttributes,
  ...enhancers: Enhancer[]
): CrafterAttributes {
  let { level, craftsmanship, control, cp } = base;

  for (const enh of enhancers) {
    if (enh.craftsmanship && enh.craftsmanshipMax) {
      craftsmanship += Math.min(
        Math.floor(craftsmanship * enh.craftsmanship / 100),
        enh.craftsmanshipMax
      );
    }
    if (enh.control && enh.controlMax) {
      control += Math.min(
        Math.floor(control * enh.control / 100),
        enh.controlMax
      );
    }
    if (enh.cp && enh.cpMax) {
      cp += Math.min(
        Math.floor(cp * enh.cp / 100),
        enh.cpMax
      );
    }
  }

  return { level, craftsmanship, control, cp };
}

// 常見食物列表（簡化版）
export const COMMON_MEALS: Enhancer[] = [
  {
    id: 'jhinga_biryani',
    name: '海鮮炒飯',
    level: 90,
    craftsmanship: 4,
    craftsmanshipMax: 67,
    control: 2,
    controlMax: 39,
  },
  {
    id: 'tsai_tou_vounou',
    name: '高地菠菜沙拉',
    level: 90,
    control: 4,
    controlMax: 67,
    cp: 2,
    cpMax: 10,
  },
  {
    id: 'beet_soup',
    name: '甜菜湯',
    level: 100,
    craftsmanship: 4,
    craftsmanshipMax: 86,
    control: 2,
    controlMax: 52,
  },
  {
    id: 'calamari_ripieni_hq',
    name: '釀墨魚 HQ',
    level: 100,
    control: 4,
    controlMax: 100,
    cp: 2,
    cpMax: 15,
  },
];

// 常見藥水列表（簡化版）
export const COMMON_MEDICINES: Enhancer[] = [
  {
    id: 'cunning_draught',
    name: '匠人藥水',
    level: 90,
    craftsmanship: 3,
    craftsmanshipMax: 47,
    cp: 2,
    cpMax: 8,
  },
  {
    id: 'cunning_draught_hq',
    name: '匠人藥水 HQ',
    level: 90,
    craftsmanship: 3,
    craftsmanshipMax: 58,
    cp: 2,
    cpMax: 10,
  },
  {
    id: 'competent_draught',
    name: '巧匠藥水',
    level: 100,
    craftsmanship: 3,
    craftsmanshipMax: 69,
    control: 1,
    controlMax: 34,
  },
  {
    id: 'competent_draught_hq',
    name: '巧匠藥水 HQ',
    level: 100,
    craftsmanship: 3,
    craftsmanshipMax: 86,
    control: 1,
    controlMax: 43,
  },
];
