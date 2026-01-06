// ============================================
// FFXIV 食物與藥水數據
// 包含各種增強物品對製作屬性的加成效果
// ============================================

export interface Enhancer {
  id: number;
  name: string;
  nameZh: string;
  itemLevel: number;
  // 作業精度加成 (百分比)
  cm?: number;
  // 作業精度最大加成值
  cm_max?: number;
  // 加工精度加成 (百分比)
  ct?: number;
  // 加工精度最大加成值
  ct_max?: number;
  // CP 加成 (百分比)
  cp?: number;
  // CP 最大加成值
  cp_max?: number;
  // HQ 版本加成倍數 (通常是 1.5)
  hqMultiplier?: number;
}

/**
 * 計算增強後的屬性
 */
export function calculateEnhancedAttributes(
  baseAttributes: {
    craftsmanship: number;
    control: number;
    cp: number;
    level: number;
  },
  enhancers: Enhancer[],
  useHQ: boolean = true
): {
  craftsmanship: number;
  control: number;
  cp: number;
  level: number;
  bonuses: { cm: number; ct: number; cp: number };
} {
  let cmBonus = 0;
  let ctBonus = 0;
  let cpBonus = 0;
  
  const multiplier = useHQ ? 1.5 : 1;
  
  for (const enhancer of enhancers) {
    if (enhancer.cm && enhancer.cm_max) {
      const bonus = Math.floor(
        Math.min(
          (baseAttributes.craftsmanship * enhancer.cm * multiplier) / 100,
          enhancer.cm_max * multiplier
        )
      );
      cmBonus += bonus;
    }
    if (enhancer.ct && enhancer.ct_max) {
      const bonus = Math.floor(
        Math.min(
          (baseAttributes.control * enhancer.ct * multiplier) / 100,
          enhancer.ct_max * multiplier
        )
      );
      ctBonus += bonus;
    }
    if (enhancer.cp && enhancer.cp_max) {
      const bonus = Math.floor(
        Math.min(
          (baseAttributes.cp * enhancer.cp * multiplier) / 100,
          enhancer.cp_max * multiplier
        )
      );
      cpBonus += bonus;
    }
  }
  
  return {
    craftsmanship: baseAttributes.craftsmanship + cmBonus,
    control: baseAttributes.control + ctBonus,
    cp: baseAttributes.cp + cpBonus,
    level: baseAttributes.level,
    bonuses: { cm: cmBonus, ct: ctBonus, cp: cpBonus },
  };
}

// ============================================
// 食物列表 (7.0 版本常用)
// ============================================
export const MEALS: Enhancer[] = [
  // 7.0 End-game 食物
  {
    id: 44096,
    name: 'Stuffed Peppers',
    nameZh: '釀青椒',
    itemLevel: 710,
    ct: 10,
    ct_max: 114,
    cp: 6,
    cp_max: 68,
  },
  {
    id: 44097,
    name: 'Caviar Sandwich',
    nameZh: '魚子醬三明治',
    itemLevel: 710,
    cm: 10,
    cm_max: 114,
    cp: 6,
    cp_max: 68,
  },
  {
    id: 43996,
    name: 'Clam Chowder',
    nameZh: '蛤蜊濃湯',
    itemLevel: 700,
    ct: 10,
    ct_max: 108,
    cp: 6,
    cp_max: 65,
  },
  {
    id: 43997,
    name: 'Blood Tomato Salad',
    nameZh: '血番茄沙拉',
    itemLevel: 700,
    cm: 10,
    cm_max: 108,
    cp: 6,
    cp_max: 65,
  },
  // 6.0 食物
  {
    id: 38263,
    name: 'Tsai tou Vounou',
    nameZh: '野蔬盅',
    itemLevel: 640,
    ct: 10,
    ct_max: 93,
    cp: 6,
    cp_max: 55,
  },
  {
    id: 38264,
    name: 'Piennolo Tomato Salad',
    nameZh: '小番茄沙拉',
    itemLevel: 640,
    cm: 10,
    cm_max: 93,
    cp: 6,
    cp_max: 55,
  },
  {
    id: 36059,
    name: 'Chili Crab',
    nameZh: '辣椒蟹',
    itemLevel: 590,
    ct: 10,
    ct_max: 79,
    cp: 6,
    cp_max: 48,
  },
  {
    id: 36060,
    name: 'Jhinga Biryani',
    nameZh: '咖喱蝦飯',
    itemLevel: 590,
    cm: 10,
    cm_max: 79,
    cp: 6,
    cp_max: 48,
  },
  // 通用食物
  {
    id: 0,
    name: 'None',
    nameZh: '無',
    itemLevel: 0,
  },
];

// ============================================
// 藥水列表 (7.0 版本常用)
// ============================================
export const MEDICINES: Enhancer[] = [
  // 7.0 藥水
  {
    id: 44165,
    name: "Cunning Craftsman's Syrup",
    nameZh: '巧匠之藥漿',
    itemLevel: 710,
    cm: 6,
    cm_max: 68,
    ct: 6,
    ct_max: 68,
  },
  {
    id: 44164,
    name: "Cunning Craftsman's Draught",
    nameZh: '巧匠之秘藥',
    itemLevel: 700,
    cm: 6,
    cm_max: 65,
    ct: 6,
    ct_max: 65,
  },
  // 6.0 藥水
  {
    id: 39727,
    name: "Cunning Craftsman's Tea",
    nameZh: '巧匠之茶',
    itemLevel: 640,
    cm: 6,
    cm_max: 55,
    ct: 6,
    ct_max: 55,
  },
  {
    id: 36233,
    name: "Cunning Craftsman's Potion",
    nameZh: '巧匠之水',
    itemLevel: 590,
    cm: 6,
    cm_max: 48,
    ct: 6,
    ct_max: 48,
  },
  // 通用藥水
  {
    id: 0,
    name: 'None',
    nameZh: '無',
    itemLevel: 0,
  },
];

// ============================================
// 特殊技能選項
// ============================================
export interface SpecialActionOption {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  // 是否需要專家身份
  requiresSpecialist?: boolean;
  // 是否需要消耗道具
  consumesItem?: boolean;
}

export const SPECIAL_ACTIONS: SpecialActionOption[] = [
  {
    id: 'manipulation',
    name: 'Manipulation',
    nameZh: '掌握',
    description: '使用掌握技能（每回合恢復 5 耐久，持續 8 回合）',
  },
  {
    id: 'waste_not',
    name: 'Waste Not',
    nameZh: '儉約',
    description: '使用儉約/長期儉約技能（減少耐久消耗）',
  },
  {
    id: 'heart_and_soul',
    name: 'Heart and Soul',
    nameZh: '專心致志',
    description: '使用專心致志（允許無視狀態使用集中技能，需消耗能工巧匠圖紙）',
    consumesItem: true,
  },
  {
    id: 'careful_observation',
    name: 'Careful Observation',
    nameZh: '設計變動',
    description: '使用設計變動（改變作業狀態，需消耗能工巧匠圖紙，最多3次）',
    consumesItem: true,
  },
  {
    id: 'trained_perfection',
    name: 'Trained Perfection',
    nameZh: '工匠的神技',
    description: '使用工匠的神技（下次加工不消耗耐久，內靜 10 層才能使用）',
  },
  {
    id: 'quick_innovation',
    name: 'Quick Innovation',
    nameZh: '快速改革',
    description: '使用快速改革（立即獲得改革效果，持續1回合）',
  },
];

// ============================================
// 預設職業配置
// ============================================
export interface CrafterPreset {
  name: string;
  level: number;
  craftsmanship: number;
  control: number;
  cp: number;
}

export const CRAFTER_PRESETS: CrafterPreset[] = [
  {
    name: '7.0 畢業裝 (HQ 全附魔)',
    level: 100,
    craftsmanship: 4956,
    control: 4963,
    cp: 687,
  },
  {
    name: '7.0 中期裝備',
    level: 100,
    craftsmanship: 4200,
    control: 4100,
    cp: 620,
  },
  {
    name: '7.0 初期裝備',
    level: 100,
    craftsmanship: 3800,
    control: 3700,
    cp: 580,
  },
  {
    name: '6.0 畢業裝',
    level: 90,
    craftsmanship: 4041,
    control: 3963,
    cp: 616,
  },
  {
    name: '自訂',
    level: 100,
    craftsmanship: 4000,
    control: 4000,
    cp: 600,
  },
];
