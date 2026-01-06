# FFXIV 製作模擬器求解器整合分析

## 背景

目前的求解器與原專案 (ffxiv-best-craft) 有差異：
1. 原專案根據製作者等級過濾可用技能
2. 後期技能 (如 Lv90+ 技能) 求解更快速
3. 原專案使用 Rust/WASM 實現，效能更高

## 原專案架構

### 求解器類型

| 求解器 | 說明 | 適用場景 |
|--------|------|----------|
| **Raphael** | 分支定界 + 最佳優先搜尋 + 動態規劃 | 通用，品質最高 |
| **DFS** | 深度優先搜尋 | 簡單配方 |
| **DP** | 動態規劃（記憶化搜尋） | 堅信起手 |
| **Rika** | 經驗剪枝策略 | 特定版本配方 |
| **Reflect** | 閒靜手法專用 | 閒靜起手 |

### 技術棧

```
┌─────────────────────────────────────────────┐
│  Frontend (Vue.js / TypeScript)             │
├─────────────────────────────────────────────┤
│  Web Worker (SolverWorker.ts)               │
├─────────────────────────────────────────────┤
│  WASM Bridge (app_wasm.js)                  │
├─────────────────────────────────────────────┤
│  Rust Core (src-libs, src-wasm)             │
│  - ffxiv-crafting (製作引擎)                │
│  - solver (求解器)                           │
│  - raphael-rs (Raphael 演算法)              │
└─────────────────────────────────────────────┘
```

### 核心 Rust 依賴

```toml
# Cargo.toml
ffxiv-crafting = "..."        # 製作模擬核心
raphael-simulator = "..."     # Raphael 模擬器
raphael-solvers = "..."       # Raphael 求解器
wasm-bindgen = "..."          # WASM 綁定
serde-wasm-bindgen = "..."    # 序列化
```

## 方案比較

### 方案 A：直接使用原專案 WASM

**實作步驟：**
1. 安裝 Rust 工具鏈 (`rustup`)
2. 安裝 `wasm-pack` 和 `wasm-bindgen-cli`
3. Fork 或複製原專案的 `src-libs` 和 `src-wasm`
4. 編譯 WASM 模組
5. 配置 Next.js 載入 WASM
6. 建立 TypeScript 介面層

**建構命令：**
```bash
# 安裝依賴
cargo install wasm-pack wasm-bindgen-cli

# 編譯 WASM
wasm-pack build src-wasm --target web --out-dir ../pkg-wasm
```

**Next.js 配置：**
```javascript
// next.config.ts
const nextConfig = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};
```

**優缺點：**
- ✅ 求解品質最高
- ✅ 效能優異
- ❌ 建構複雜
- ❌ 需要維護 Rust 程式碼

---

### 方案 B：改進 TypeScript 求解器

**改進重點：**

1. **等級過濾** - 根據製作者等級過濾技能
2. **更好的開場判斷** - 根據配方和屬性選擇最佳開場
3. **優化剪枝策略** - 減少無效搜尋
4. **加入更多策略** - 閒靜起手、堅信起手等

**程式碼範例：**
```typescript
// 根據等級過濾技能
function getActionsByLevel(level: number, actions: CraftAction[]): CraftAction[] {
  return actions.filter(a => a.levelRequirement <= level);
}

// 選擇開場策略
function selectOpenerStrategy(state: CraftingState, actions: CraftAction[]): 'reflect' | 'muscle_memory' | 'standard' {
  const hasReflect = actions.some(a => a.id === 'reflect');
  const hasMuscleMemory = actions.some(a => a.id === 'muscle_memory');
  
  const { recipe, crafterStats } = state;
  const qualityRequired = recipe.quality;
  const progressRequired = recipe.difficulty;
  
  // 如果品質要求高，用閒靜
  if (hasReflect && qualityRequired > 0) {
    return 'reflect';
  }
  
  // 如果進度要求高，用堅信
  if (hasMuscleMemory && progressRequired > 5000) {
    return 'muscle_memory';
  }
  
  return 'standard';
}
```

**優缺點：**
- ✅ 維護簡單
- ✅ 無額外依賴
- ✅ 易於除錯
- ❌ 求解品質較低
- ❌ 效能較差

---

### 方案 C：混合方案（推薦）

**策略：**
1. 短期使用改進的 TypeScript 求解器
2. 提供「使用進階求解器」選項
3. 進階求解器載入原專案的預編譯 WASM

**檔案結構：**
```
lib/simulator/
├── crafting-engine.ts    # 製作引擎
├── solver.ts             # TypeScript 求解器
├── solver-wasm.ts        # WASM 求解器介面
└── wasm/
    └── app_wasm_bg.wasm  # 預編譯 WASM
```

**漸進式載入：**
```typescript
// solver-wasm.ts
let wasmModule: typeof import('./wasm/app_wasm') | null = null;

export async function loadWasmSolver(): Promise<boolean> {
  try {
    wasmModule = await import('./wasm/app_wasm');
    return true;
  } catch {
    return false;
  }
}

export async function raphaelSolve(
  status: Status,
  options: RaphaelOptions
): Promise<Actions[]> {
  if (!wasmModule) {
    throw new Error('WASM 模組未載入');
  }
  return wasmModule.raphael_solve(
    status,
    options.targetQuality,
    options.useManipulation,
    // ...
  );
}
```

## 建議實作順序

### 第一階段：改進 TypeScript 求解器（1-2 天）

1. 加入等級過濾邏輯
2. 改進開場策略選擇
3. 優化 Buff 管理邏輯
4. 加入更多測試案例

### 第二階段：整合 WASM（可選，3-5 天）

1. 設定 Rust/WASM 建構環境
2. 編譯原專案 WASM
3. 配置 Next.js WASM 載入
4. 建立 TypeScript 介面
5. 加入 Web Worker 執行

### 第三階段：UI 整合（1 天）

1. 加入求解器選擇 UI
2. 顯示求解進度
3. 支援取消操作

## 參考資源

- [原專案 GitHub](https://github.com/Tnze/ffxiv-best-craft)
- [Raphael FFXIV Crafting Solver](https://github.com/KonaeAkira/raphael-rs)
- [wasm-pack 文件](https://rustwasm.github.io/wasm-pack/)
- [Next.js WASM 支援](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading#with-external-libraries)
