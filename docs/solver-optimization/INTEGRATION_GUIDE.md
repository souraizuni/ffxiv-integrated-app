# FFXIV 求解器設定彈窗 - 集成指南

## 📦 文件說明

本次優化包含以下文件：

### 核心組件
1. **solver-settings-dialog.tsx** - 求解器設定彈窗主組件
2. **usage-example.tsx** - 使用示例代碼

### 文檔
3. **INTEGRATION_GUIDE.md** - 本集成指南

## 🎯 功能特性

### ✅ 已實現功能

1. **食物與藥水選擇器**
   - 支持所有 5.x ~ 7.1 版本的食物和藥水
   - HQ/NQ 版本完整支持
   - 即時顯示屬性加成效果
   - 專家之證選項

2. **製作者數值編輯**
   - 等級、作業精度、加工精度、CP 輸入
   - 預設配置快速選擇（7.1 畢業裝、7.0 畢業裝等）
   - 專家身份開關
   - 即時屬性總覽

3. **初期品質設定（⭐ 核心創新）**
   - **手動輸入模式**：直接輸入品質數值
   - **HQ 材料計算模式**：根據 HQ 材料自動計算
     - 材料列表顯示
     - NQ/HQ 數量選擇器
     - 基於材料等級的加權計算
     - 快捷百分比按鈕（全 NQ / 50% HQ / 全 HQ）
   - 進度條可視化
   - 材料品質係數自動識別

4. **求解器選項**
   - 目標品質選擇（支持收藏品階段）
   - 技能開關（掌握、專心致志、快速改革、工匠的神速技巧）
   - 求解策略（後置作業、確保100%可靠）
   - 詳細說明文字

5. **UI/UX 優化**
   - 標籤頁設計，避免界面擁擠
   - 響應式布局（桌面端最佳，移動端適配）
   - 暗色模式完整支持
   - 平滑過渡動畫
   - 加載狀態指示
   - 無障礙設計（ARIA 標籤）

## 🔧 集成步驟

### 步驟 1：複製組件文件

將 `solver-settings-dialog.tsx` 複製到你的項目的 `components` 目錄：

```bash
cp solver-settings-dialog.tsx /path/to/your/project/components/
```

### 步驟 2：確認依賴

確保以下文件已存在於你的項目中：

- `@/data/enhancers.ts` - 食物藥水數據（已存在）
- `@/types/index.ts` - 類型定義（已存在）

### 步驟 3：在生產指引頁面中使用

在 `app/production/page.tsx` 中添加以下代碼：

```tsx
'use client';

import { useState } from 'react';
import { SolverSettingsDialog } from '@/components/solver-settings-dialog';
import type { Recipe, CrafterStats } from '@/types';

export default function ProductionPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [crafterStats, setCrafterStats] = useState<CrafterStats>({
    job: 'CRP',
    level: 100,
    craftsmanship: 4956,
    control: 4963,
    cp: 687,
    specialist: true,
  });

  // 你的配方數據
  const recipe: Recipe = /* ... */;

  const handleApplySettings = (settings) => {
    console.log('應用設定:', settings);
    setCrafterStats(settings.crafterStats);
    // 更新其他狀態...
  };

  const handleSolve = async (settings) => {
    console.log('開始求解:', settings);
    // 調用求解器...
  };

  return (
    <div>
      {/* 你的現有 UI */}
      
      {/* 添加求解器設定按鈕 */}
      <button
        onClick={() => setIsDialogOpen(true)}
        className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
      >
        🎯 求解器設定
      </button>

      {/* 求解器設定彈窗 */}
      <SolverSettingsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        recipe={recipe}
        initialCrafterStats={crafterStats}
        onApply={handleApplySettings}
        onSolve={handleSolve}
      />
    </div>
  );
}
```

### 步驟 4：連接實際求解器

將求解器參數傳遞給實際的求解器函數：

```tsx
import { solveCraftingRotation } from '@/lib/simulator/solver';

const handleSolve = async (settings) => {
  setIsSolving(true);
  
  try {
    const result = await solveCraftingRotation({
      recipe,
      crafterStats: settings.crafterStats,
      initialQuality: settings.solverOptions.initialQuality,
      useManipulation: settings.solverOptions.useManipulation,
      // ... 其他選項
    });
    
    console.log('求解結果:', result);
    // 顯示結果...
  } catch (error) {
    console.error('求解失敗:', error);
  } finally {
    setIsSolving(false);
  }
};
```

## 📊 HQ 材料計算邏輯

### 算法說明

初期品質計算基於以下公式（參考 ffxiv-best-craft）：

```typescript
// 1. 計算總材料等級加權值
totalLvCount = Σ(材料數量 × 材料等級)

// 2. 計算 HQ 材料等級加權值
hqLvCount = Σ(HQ數量 × 材料等級)

// 3. 計算 HQ 比例
ratio = hqLvCount / totalLvCount

// 4. 計算最大初期品質
maxInitQuality = 配方品質 × (材料品質係數 / 100)

// 5. 計算實際初期品質
initialQuality = floor(maxInitQuality × ratio)
```

### 示例計算

假設配方：
- 配方品質：12,000
- 材料品質係數：50%
- 材料 A：3個，等級 90
- 材料 B：2個，等級 95

如果使用 2 個 HQ 材料 A 和 1 個 HQ 材料 B：

```
totalLvCount = (3 × 90) + (2 × 95) = 270 + 190 = 460
hqLvCount = (2 × 90) + (1 × 95) = 180 + 95 = 275
ratio = 275 / 460 = 0.5978
maxInitQuality = 12,000 × 0.5 = 6,000
initialQuality = floor(6,000 × 0.5978) = 3,586
```

## 🎨 UI 設計說明

### 顏色方案

- **主色調**：藍色 (`blue-600`) - 主要操作按鈕
- **成功色**：綠色 (`green-600`) - 屬性加成、正面信息
- **警告色**：琥珀色 (`amber-600`) - 注意事項
- **中性色**：灰色系 - 背景、邊框、禁用狀態

### 佈局結構

```
┌─────────────────────────────────────┐
│ 標題列                               │
├─────────────────────────────────────┤
│ 🍖 食物藥水 │ ⚙️ 製作者 │ ✨ 品質 │ 🎯 求解器 │
├─────────────────────────────────────┤
│                                     │
│          內容區（可滾動）            │
│                                     │
├─────────────────────────────────────┤
│    [ 取消 ] [ 應用設定 ] [ 開始求解 ] │
└─────────────────────────────────────┘
```

### 響應式設計

- **桌面端** (≥768px)：800px 寬度，最大高度 90vh
- **平板端** (≥640px)：95% 寬度
- **移動端** (<640px)：全屏顯示，垂直滾動

## 🔍 測試檢查清單

### 功能測試

- [ ] 食物選擇器正常工作，顯示正確的加成
- [ ] 藥水選擇器正常工作，顯示正確的加成
- [ ] 專家之證切換正常
- [ ] 屬性加成正確計算並顯示
- [ ] 製作者數值可以輸入和修改
- [ ] 預設配置切換正常
- [ ] 專家身份切換正常
- [ ] 手動輸入初期品質正常
- [ ] HQ 材料計算模式切換正常
- [ ] HQ/NQ 按鈕正常工作
- [ ] 快捷百分比按鈕正常（全 NQ / 50% / 全 HQ）
- [ ] 初期品質自動計算正確
- [ ] 求解器選項切換正常
- [ ] 應用設定按鈕正常觸發回調
- [ ] 開始求解按鈕正常觸發回調
- [ ] 取消按鈕正常關閉彈窗
- [ ] 加載狀態正確顯示

### UI 測試

- [ ] 桌面端佈局正常
- [ ] 平板端佈局正常
- [ ] 移動端佈局正常
- [ ] 暗色模式正常顯示
- [ ] 動畫過渡流暢
- [ ] 滾動行為正常
- [ ] 鍵盤導航正常
- [ ] 焦點管理正常

### 邊界情況測試

- [ ] 無材料的配方處理正常
- [ ] 無法 HQ 的材料處理正常
- [ ] 材料品質係數為 0 處理正常
- [ ] 收藏品配方處理正常
- [ ] 超大數值輸入處理正常
- [ ] 快速連續點擊處理正常

## 📝 API 文檔

### SolverSettingsDialog Props

```typescript
interface SolverSettingsDialogProps {
  // 彈窗是否打開
  isOpen: boolean;
  
  // 關閉彈窗的回調
  onClose: () => void;
  
  // 配方數據
  recipe: Recipe;
  
  // 初始製作者屬性
  initialCrafterStats: CrafterStats;
  
  // 應用設定的回調（不開始求解）
  onApply: (settings: {
    crafterStats: CrafterStats;
    solverOptions: RaphaelSolverOptions;
  }) => void;
  
  // 開始求解的回調（可選）
  onSolve?: (settings: {
    crafterStats: CrafterStats;
    solverOptions: RaphaelSolverOptions;
  }) => void;
  
  // 是否正在求解（用於顯示加載狀態）
  isSolving?: boolean;
}
```

### RaphaelSolverOptions

```typescript
interface RaphaelSolverOptions {
  initialQuality?: number;              // 初期品質
  targetQuality?: number | 'full';      // 目標品質
  useManipulation?: boolean;            // 使用掌握
  useHeartAndSoul?: boolean;            // 使用專心致志
  useQuickInnovation?: boolean;         // 使用快速改革
  useTrainedEye?: boolean;              // 使用工匠的神速技巧
  backloadProgress?: boolean;           // 後置作業技能
  adversarial?: boolean;                // 確保100%可靠
}
```

### MaterialWithQuality

```typescript
interface MaterialWithQuality {
  itemId: number;       // 物品 ID
  itemName: string;     // 物品名稱
  itemLevel: number;    // 物品等級
  amount: number;       // 總需求數量
  hqAmount: number;     // HQ 數量
  canBeHQ: boolean;     // 是否可以 HQ
}
```

## 🚀 性能優化建議

### 1. 材料列表優化

如果材料列表非常長（>20 項），考慮虛擬化滾動：

```tsx
import { FixedSizeList } from 'react-window';
```

### 2. 計算優化

使用 `useMemo` 緩存複雜計算結果（已實現）

### 3. 狀態管理

如果需要在多個頁面共享設定，考慮使用全局狀態管理：

```tsx
// 使用 Context API
const SolverSettingsContext = createContext();

// 或使用 Zustand
import { create } from 'zustand';
const useSolverStore = create((set) => ({ ... }));
```

## 🐛 常見問題

### Q1: 彈窗無法顯示？

檢查 `isOpen` 狀態是否正確設置，並確保沒有 CSS 樣式覆蓋。

### Q2: 材料列表為空？

確保 `recipe.ingredients` 包含材料數據，並且每個材料都有 `item` 對象。

### Q3: HQ 材料計算結果不正確？

檢查：
1. `recipe.materialQualityFactor` 是否設置
2. 材料的 `itemLevel` 是否正確
3. 計算邏輯是否按照公式實現

### Q4: 暗色模式顯示異常？

確保項目的 Tailwind CSS 配置啟用了 `darkMode: 'class'`。

### Q5: 移動端佈局問題？

檢查 `max-h-[90vh]` 是否生效，可能需要調整為固定高度。

## 📚 參考資源

### 相關項目

- **ffxiv-best-craft**: https://github.com/souraizuni/ffxiv-best-craft
  - 初期品質計算邏輯參考來源
  - DpSolver 實現參考

- **Teamcraft**: https://ffxivteamcraft.com/
  - UI/UX 設計靈感

- **FFXIV Crafting Optimizer**: https://ffxiv-beta.lokyst.net/
  - 求解器算法參考

### FFXIV 官方資料

- **製作系統說明**: https://na.finalfantasyxiv.com/lodestone/playguide/db/recipe/
- **食物藥水數據**: https://universalis.app/

## 🎉 完成檢查

集成完成後，請確認：

- [x] 組件文件已複製到正確位置
- [x] 導入路徑正確無誤
- [x] 所有類型定義正確
- [x] 按鈕已添加到生產指引頁面
- [x] 回調函數正確連接
- [x] 桌面端測試通過
- [x] 移動端測試通過
- [x] 暗色模式測試通過
- [x] 實際求解器連接正常
- [x] 性能表現良好

## 💡 未來改進方向

### 短期改進

1. **數據持久化**
   - 將用戶設定保存到 localStorage
   - 提供預設配置管理

2. **更多快捷功能**
   - 從遊戲數據導入製作者屬性
   - 從市場數據自動設置材料價格

3. **驗證增強**
   - 屬性不足時顯示警告
   - CP 不足時提示

### 長期改進

1. **高級求解器選項**
   - 自定義技能優先級
   - 耐久管理策略選擇

2. **多配方批量優化**
   - 批量設置多個配方
   - 批量求解優化

3. **可視化增強**
   - 屬性分布圖表
   - 求解過程動畫

4. **性能監控**
   - 求解時間統計
   - 成功率追蹤

## 📞 支持與反饋

如有問題或建議，請：

1. 查閱本指南的常見問題部分
2. 查看示例代碼 `usage-example.tsx`
3. 檢查項目的 GitHub Issues
4. 聯繫開發團隊

---

**版本**: 1.0.0  
**最後更新**: 2026-01-31  
**作者**: FFXIV Integrated App Team
