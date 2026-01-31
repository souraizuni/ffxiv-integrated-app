// ============================================
// FFXIV 食物與藥水數據
// 包含各種增強物品對製作屬性的加成效果
// 參照 ffxiv-best-craft 專案結構設計
// ============================================

export interface Enhancer {
  id: number;
  name: string;
  nameZh: string;
  itemLevel: number;
  // 是否為 HQ 版本
  is_hq?: boolean;
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
  // 是否為固定加成（非百分比，如專家之證）
  isFixedBonus?: boolean;
}

// HQ 符號
// 原始專案使用 FFXIV 特殊字體符號 \uE03C，但瀏覽器無法顯示
// 這裡使用通用的 ★ 符號作為替代
export const HQ_SYMBOL = '★';

/**
 * 取得增強物品的顯示名稱（包含 HQ 符號）
 * 格式與 ffxiv-best-craft 相同
 */
export function getEnhancerDisplayName(enhancer: Enhancer): string {
  if (enhancer.is_hq) {
    return `${enhancer.nameZh} ${HQ_SYMBOL}`;
  }
  return enhancer.nameZh;
}

/**
 * 取得增強物品的效果描述文字
 * 格式類似 ffxiv-best-craft: "作業 +10% (max 114)"
 */
export function getEnhancerEffectText(enhancer: Enhancer): string {
  const effects: string[] = [];
  
  if (enhancer.isFixedBonus) {
    // 固定加成（如專家之證）
    if (enhancer.cm_max) effects.push(`作業 +${enhancer.cm_max}`);
    if (enhancer.ct_max) effects.push(`加工 +${enhancer.ct_max}`);
    if (enhancer.cp_max) effects.push(`CP +${enhancer.cp_max}`);
  } else {
    // 百分比加成
    if (enhancer.cm && enhancer.cm_max) {
      effects.push(`作業 +${enhancer.cm}% (max ${enhancer.cm_max})`);
    }
    if (enhancer.ct && enhancer.ct_max) {
      effects.push(`加工 +${enhancer.ct}% (max ${enhancer.ct_max})`);
    }
    if (enhancer.cp && enhancer.cp_max) {
      effects.push(`CP +${enhancer.cp}% (max ${enhancer.cp_max})`);
    }
  }
  
  return effects.join(', ');
}

/**
 * 計算增強後的屬性
 * 使用 ffxiv-best-craft 相同的計算邏輯
 */
export function calculateEnhancedAttributes(
  baseAttributes: {
    craftsmanship: number;
    control: number;
    cp: number;
    level: number;
  },
  enhancers: Enhancer[]
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
  
  for (const enhancer of enhancers) {
    if (enhancer.isFixedBonus) {
      // 固定加成（如專家之證）- 使用 max 值作為固定加成
      if (enhancer.cm_max) cmBonus += enhancer.cm_max;
      if (enhancer.ct_max) ctBonus += enhancer.ct_max;
      if (enhancer.cp_max) cpBonus += enhancer.cp_max;
    } else {
      // 百分比加成 - 數值已經根據 NQ/HQ 預先計算好
      if (enhancer.cm && enhancer.cm_max) {
        const bonus = Math.floor(
          Math.min(
            (baseAttributes.craftsmanship * enhancer.cm) / 100,
            enhancer.cm_max
          )
        );
        cmBonus += bonus;
      }
      if (enhancer.ct && enhancer.ct_max) {
        const bonus = Math.floor(
          Math.min(
            (baseAttributes.control * enhancer.ct) / 100,
            enhancer.ct_max
          )
        );
        ctBonus += bonus;
      }
      if (enhancer.cp && enhancer.cp_max) {
        const bonus = Math.floor(
          Math.min(
            (baseAttributes.cp * enhancer.cp) / 100,
            enhancer.cp_max
          )
        );
        cpBonus += bonus;
      }
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
// 食物列表
// 包含 NQ 和 HQ 版本
// 數據來源: XIVAPI / ffxiv-best-craft
// 格式說明:
//   cm/ct/cp = 百分比加成值 (%)
//   cm_max/ct_max/cp_max = 最大加成值上限
//   HQ 版本通常有更高的百分比和上限
// ============================================
export const MEALS: Enhancer[] = [
  // ========== 7.1 食物 (iLv 720) ==========
  // 釀青椒 - 加工/CP (Control + CP)
  { id: 44280, name: 'Stuffed Peppers', nameZh: '釀青椒', itemLevel: 720, is_hq: true, ct: 10, ct_max: 180, cp: 8, cp_max: 102 },
  { id: 44279, name: 'Stuffed Peppers', nameZh: '釀青椒', itemLevel: 720, is_hq: false, ct: 8, ct_max: 120, cp: 6, cp_max: 68 },
  // 魚子醬三明治 - 作業/CP (Craftsmanship + CP)
  { id: 44278, name: 'Caviar Sandwich', nameZh: '魚子醬三明治', itemLevel: 720, is_hq: true, cm: 10, cm_max: 180, cp: 8, cp_max: 102 },
  { id: 44277, name: 'Caviar Sandwich', nameZh: '魚子醬三明治', itemLevel: 720, is_hq: false, cm: 8, cm_max: 120, cp: 6, cp_max: 68 },
  
  // ========== 7.0 食物 (iLv 710) ==========
  // 釀青椒 - 加工/CP
  { id: 44096, name: 'Stuffed Peppers', nameZh: '釀青椒', itemLevel: 710, is_hq: true, ct: 10, ct_max: 171, cp: 6, cp_max: 102 },
  { id: 44095, name: 'Stuffed Peppers', nameZh: '釀青椒', itemLevel: 710, is_hq: false, ct: 8, ct_max: 114, cp: 5, cp_max: 68 },
  // 魚子醬三明治 - 作業/CP
  { id: 44098, name: 'Caviar Sandwich', nameZh: '魚子醬三明治', itemLevel: 710, is_hq: true, cm: 10, cm_max: 171, cp: 6, cp_max: 102 },
  { id: 44097, name: 'Caviar Sandwich', nameZh: '魚子醬三明治', itemLevel: 710, is_hq: false, cm: 8, cm_max: 114, cp: 5, cp_max: 68 },
  
  // ========== 7.0 初期食物 (iLv 700) ==========
  // 蛤蜊濃湯 - 加工/CP
  { id: 43996, name: 'Clam Chowder', nameZh: '蛤蜊濃湯', itemLevel: 700, is_hq: true, ct: 10, ct_max: 162, cp: 6, cp_max: 97 },
  { id: 43995, name: 'Clam Chowder', nameZh: '蛤蜊濃湯', itemLevel: 700, is_hq: false, ct: 8, ct_max: 108, cp: 5, cp_max: 65 },
  // 血番茄沙拉 - 作業/CP
  { id: 43998, name: 'Blood Tomato Salad', nameZh: '血番茄沙拉', itemLevel: 700, is_hq: true, cm: 10, cm_max: 162, cp: 6, cp_max: 97 },
  { id: 43997, name: 'Blood Tomato Salad', nameZh: '血番茄沙拉', itemLevel: 700, is_hq: false, cm: 8, cm_max: 108, cp: 5, cp_max: 65 },
  
  // ========== 6.4 食物 (iLv 640) ==========
  // 野蔬盅 - 加工/CP
  { id: 38264, name: 'Tsai tou Vounou', nameZh: '野蔬盅', itemLevel: 640, is_hq: true, ct: 10, ct_max: 139, cp: 6, cp_max: 82 },
  { id: 38263, name: 'Tsai tou Vounou', nameZh: '野蔬盅', itemLevel: 640, is_hq: false, ct: 8, ct_max: 93, cp: 5, cp_max: 55 },
  // 小番茄沙拉 - 作業/CP
  { id: 38266, name: 'Piennolo Tomato Salad', nameZh: '小番茄沙拉', itemLevel: 640, is_hq: true, cm: 10, cm_max: 139, cp: 6, cp_max: 82 },
  { id: 38265, name: 'Piennolo Tomato Salad', nameZh: '小番茄沙拉', itemLevel: 640, is_hq: false, cm: 8, cm_max: 93, cp: 5, cp_max: 55 },
  // 卷心菜飯捲 - 加工/CP
  { id: 38268, name: 'Calamari Ripieni', nameZh: '卷心菜飯捲', itemLevel: 640, is_hq: true, ct: 10, ct_max: 139, cp: 6, cp_max: 82 },
  { id: 38267, name: 'Calamari Ripieni', nameZh: '卷心菜飯捲', itemLevel: 640, is_hq: false, ct: 8, ct_max: 93, cp: 5, cp_max: 55 },
  
  // ========== 6.0 初期食物 (iLv 590) ==========
  // 鮮蝦印度炒飯 - 加工/CP
  { id: 36062, name: 'Jhinga Biryani', nameZh: '鮮蝦印度炒飯', itemLevel: 590, is_hq: true, ct: 10, ct_max: 118, cp: 6, cp_max: 70 },
  { id: 36061, name: 'Jhinga Biryani', nameZh: '鮮蝦印度炒飯', itemLevel: 590, is_hq: false, ct: 8, ct_max: 79, cp: 5, cp_max: 47 },
  // 白麵包 - 作業/CP
  { id: 36064, name: 'Archon Loaf', nameZh: '白麵包', itemLevel: 590, is_hq: true, cm: 10, cm_max: 118, cp: 6, cp_max: 70 },
  { id: 36063, name: 'Archon Loaf', nameZh: '白麵包', itemLevel: 590, is_hq: false, cm: 8, cm_max: 79, cp: 5, cp_max: 47 },
  
  // ========== 5.x 食物 (iLv 560) ==========
  // 高山茶 - 加工精度 +5% (上限76) / CP +26% (上限78) - 來自資料庫正確數據
  { id: 36060, name: 'Camellia Tea', nameZh: '高山茶', itemLevel: 554, is_hq: true, ct: 5, ct_max: 76, cp: 26, cp_max: 78 },
  { id: 36060, name: 'Camellia Tea', nameZh: '高山茶', itemLevel: 554, is_hq: false, ct: 4, ct_max: 61, cp: 21, cp_max: 62 },
  // 辣椒蟹 - 加工/CP
  { id: 34058, name: 'Chili Crab', nameZh: '辣椒蟹', itemLevel: 560, is_hq: true, ct: 10, ct_max: 108, cp: 5, cp_max: 67 },
  { id: 34057, name: 'Chili Crab', nameZh: '辣椒蟹', itemLevel: 560, is_hq: false, ct: 8, ct_max: 72, cp: 4, cp_max: 45 },
  // 香草燉肉 - 作業/CP
  { id: 34056, name: 'Tsai tou Vounou', nameZh: '香草燉肉', itemLevel: 560, is_hq: true, cm: 10, cm_max: 108, cp: 5, cp_max: 67 },
  { id: 34055, name: 'Tsai tou Vounou', nameZh: '香草燉肉', itemLevel: 560, is_hq: false, cm: 8, cm_max: 72, cp: 4, cp_max: 45 },
  
  // ========== 5.4 食物 (iLv 530) ==========
  // 巧匠之茶 - CP 專用
  { id: 31902, name: 'Cunning Craftsman\'s Tea', nameZh: '巧匠之茶', itemLevel: 530, is_hq: true, cp: 12, cp_max: 79 },
  { id: 31901, name: 'Cunning Craftsman\'s Tea', nameZh: '巧匠之茶', itemLevel: 530, is_hq: false, cp: 10, cp_max: 53 },
  // 無花果布丁 - 加工/CP
  { id: 31900, name: 'Sykon Bavarois', nameZh: '無花果布丁', itemLevel: 530, is_hq: true, ct: 9, ct_max: 98, cp: 5, cp_max: 62 },
  { id: 31899, name: 'Sykon Bavarois', nameZh: '無花果布丁', itemLevel: 530, is_hq: false, ct: 7, ct_max: 66, cp: 4, cp_max: 41 },
  // 蒜香淡菜 - 作業/CP
  { id: 31898, name: 'Mejillones al Ajillo', nameZh: '蒜香淡菜', itemLevel: 530, is_hq: true, cm: 9, cm_max: 98, cp: 5, cp_max: 62 },
  { id: 31897, name: 'Mejillones al Ajillo', nameZh: '蒜香淡菜', itemLevel: 530, is_hq: false, cm: 7, cm_max: 66, cp: 4, cp_max: 41 },
];

// ============================================
// 藥水列表
// 包含 NQ 和 HQ 版本
// 資料來源: ffxiv-best-craft 資料庫 (xiv.db)
// 藥水分為三類：
//   - 名匠 (Craftsmanship): 提升作業精度 (cm)
//   - 巨匠 (Control): 提升加工精度 (ct)
//   - 魔匠 (CP): 提升製作力 (cp)
// ============================================
export const MEDICINES: Enhancer[] = [
  // ========== 7.0 藥水 (iLv 670+) ==========
  // 魔匠藥液 - CP專用
  { id: 44169, name: "Craftsman's Cunning Soda", nameZh: '魔匠藥液', itemLevel: 675, is_hq: true, cp: 6, cp_max: 27 },
  { id: 44169, name: "Craftsman's Cunning Soda", nameZh: '魔匠藥液', itemLevel: 675, is_hq: false, cp: 5, cp_max: 21 },
  // 巨匠藥液 - 加工精度
  { id: 44168, name: "Craftsman's Command Soda", nameZh: '巨匠藥液', itemLevel: 670, is_hq: true, ct: 3, ct_max: 63 },
  { id: 44168, name: "Craftsman's Command Soda", nameZh: '巨匠藥液', itemLevel: 670, is_hq: false, ct: 2, ct_max: 50 },
  // 名匠藥液 - 作業精度
  { id: 44167, name: "Craftsman's Competence Soda", nameZh: '名匠藥液', itemLevel: 665, is_hq: true, cm: 3, cm_max: 63 },
  { id: 44167, name: "Craftsman's Competence Soda", nameZh: '名匠藥液', itemLevel: 665, is_hq: false, cm: 2, cm_max: 50 },

  // ========== 6.0 藥水 (iLv 540+) ==========
  // 魔匠藥酒 - CP專用
  { id: 36116, name: "Craftsman's Cunning Draught", nameZh: '魔匠藥酒', itemLevel: 554, is_hq: true, cp: 6, cp_max: 21 },
  { id: 36116, name: "Craftsman's Cunning Draught", nameZh: '魔匠藥酒', itemLevel: 554, is_hq: false, cp: 5, cp_max: 17 },
  // 巨匠藥酒 - 加工精度
  { id: 36115, name: "Craftsman's Command Draught", nameZh: '巨匠藥酒', itemLevel: 540, is_hq: true, ct: 3, ct_max: 50 },
  { id: 36115, name: "Craftsman's Command Draught", nameZh: '巨匠藥酒', itemLevel: 540, is_hq: false, ct: 2, ct_max: 40 },
  // 名匠藥酒 - 作業精度
  { id: 36114, name: "Craftsman's Competence Draught", nameZh: '名匠藥酒', itemLevel: 527, is_hq: true, cm: 3, cm_max: 50 },
  { id: 36114, name: "Craftsman's Competence Draught", nameZh: '名匠藥酒', itemLevel: 527, is_hq: false, cm: 2, cm_max: 40 },

  // ========== 5.x 藥水 (iLv 410+) ==========
  // 魔匠藥水 - CP專用
  { id: 27959, name: "Craftsman's Cunning Potion", nameZh: '魔匠藥水', itemLevel: 412, is_hq: true, cp: 6, cp_max: 16 },
  { id: 27959, name: "Craftsman's Cunning Potion", nameZh: '魔匠藥水', itemLevel: 412, is_hq: false, cp: 5, cp_max: 13 },
  // 巨匠藥水 - 加工精度
  { id: 27958, name: "Craftsman's Command Potion", nameZh: '巨匠藥水', itemLevel: 412, is_hq: true, ct: 3, ct_max: 42 },
  { id: 27958, name: "Craftsman's Command Potion", nameZh: '巨匠藥水', itemLevel: 412, is_hq: false, ct: 2, ct_max: 34 },
  // 名匠藥水 - 作業精度
  { id: 27957, name: "Craftsman's Competence Potion", nameZh: '名匠藥水', itemLevel: 406, is_hq: true, cm: 3, cm_max: 41 },
  { id: 27957, name: "Craftsman's Competence Potion", nameZh: '名匠藥水', itemLevel: 406, is_hq: false, cm: 2, cm_max: 33 },

  // ========== 4.x 藥水 (iLv 270+) ==========
  // 魔匠藥茶 - CP專用
  { id: 19884, name: "Craftsman's Cunning Tea", nameZh: '魔匠藥茶', itemLevel: 282, is_hq: true, cp: 5, cp_max: 13 },
  { id: 19884, name: "Craftsman's Cunning Tea", nameZh: '魔匠藥茶', itemLevel: 282, is_hq: false, cp: 4, cp_max: 10 },
  // 巨匠藥茶 - 加工精度
  { id: 19883, name: "Craftsman's Command Tea", nameZh: '巨匠藥茶', itemLevel: 276, is_hq: true, ct: 3, ct_max: 25 },
  { id: 19883, name: "Craftsman's Command Tea", nameZh: '巨匠藥茶', itemLevel: 276, is_hq: false, ct: 2, ct_max: 20 },
  // 名匠藥茶 - 作業精度
  { id: 19882, name: "Craftsman's Competence Tea", nameZh: '名匠藥茶', itemLevel: 273, is_hq: true, cm: 3, cm_max: 25 },
  { id: 19882, name: "Craftsman's Competence Tea", nameZh: '名匠藥茶', itemLevel: 273, is_hq: false, cm: 2, cm_max: 20 },
];

// ============================================
// 專家之證 (Soul of the Crafter)
// 裝備時提供固定的製作屬性加成
// 與 ffxiv-best-craft 相同設計
// ============================================
export const SOUL_OF_THE_CRAFTER: Enhancer = {
  id: -1,
  name: 'Soul of the Crafter',
  nameZh: '專家之證',
  itemLevel: 1,
  // 使用超大百分比確保達到 max 值
  cm: Number.MAX_VALUE,
  cm_max: 20,
  ct: Number.MAX_VALUE,
  ct_max: 20,
  cp: Number.MAX_VALUE,
  cp_max: 15,
  isFixedBonus: true,
};

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
    name: '7.1 畢業裝 (HQ 全附魔)',
    level: 100,
    craftsmanship: 5182,
    control: 5369,
    cp: 714,
  },
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
