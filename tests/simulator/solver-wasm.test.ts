// ============================================
// WASM 求解器迴歸測試
// ============================================
// 起因：使用者回報宇宙探索配方（進度 9504 / 品質 1200 / 耐久 25）求解出的巨集
// 在第 13 步耐久變成負數，直接製作失敗。
//
// 根因是 convertRecipeToWasm 把 Recipe.craftTypeLevel 當成職業等級傳給求解器，
// 但那個欄位存的其實是「一次製作的產出數量」（AmountResult）。對產出 1 個的配方，
// 求解器收到的等級是 1 而不是 100，等級差修正全錯，解出來的手法自然不可行。

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { setPackTransport } from '@/lib/data/msgpack-loader';
import { getRecipeById } from '@/lib/data/recipes';
import { convertRecipeToWasm } from '@/lib/wasm';
import type { Recipe } from '@/types';

// 使用者實測的配方：宇宙探索木工「試驗加工用的木材」
const RECIPE_ID = 36188;
const STATS = { level: 100, craftsmanship: 4956, control: 4963, craft_points: 687 };

let wasm: any;
let recipe: Recipe;

beforeAll(async () => {
  setPackTransport(async (path) => new Uint8Array(await readFile(`public/data/${path}`)));

  // 刻意複製 initWasm() 在瀏覽器裡的做法：glue 用 lib/wasm/app_wasm_bg.js，
  // 二進位檔用 public/wasm/app_wasm_bg.wasm。兩者若不同步，這裡就會炸。
  const bg: any = await import('@/lib/wasm/app_wasm_bg.js');
  const { instance } = await WebAssembly.instantiate(
    await readFile('public/wasm/app_wasm_bg.wasm'),
    { './app_wasm_bg.js': bg }
  );
  bg.__wbg_set_wasm(instance.exports);
  (instance.exports as any).__wbindgen_start?.();
  wasm = bg;

  recipe = (await getRecipeById(RECIPE_ID))!;
}, 60_000);

function toWasm(overrides: Record<string, unknown> = {}) {
  const base = convertRecipeToWasm(recipe, {
    baseDifficulty: recipe.baseDifficulty,
    baseQuality: recipe.baseQuality,
    baseDurability: recipe.baseDurability,
  });
  return { ...base, ...overrides };
}

function solveAndSimulate(wasmRecipe: any) {
  const status = wasm.new_status(STATS, wasmRecipe, 0);
  const actions = wasm.raphael_solve(status, null, true, false, false, false, false, false, 0);
  const result: any = wasm.simulate(status, actions);
  const final = result.status ?? result;

  return {
    actions: actions as string[],
    progress: final.progress as number,
    quality: final.quality as number,
    durability: final.durability as number,
  };
}

describe('WASM 求解器', () => {
  it('配方的職業等級需求不會被產出數量取代', () => {
    // craftTypeLevel 這個欄位名稱有誤導性，它存的是 AmountResult
    expect(recipe.craftTypeLevel).toBe(1);
    expect(recipe.recipeLevel).toBe(100);

    const wr = toWasm();
    expect(wr.job_level).toBe(100);
    expect(wr.rlv.class_job_level).toBe(100);
  });

  it('解出的手法能完成製作且耐久不歸零', () => {
    const wr = toWasm();
    const { actions, progress, durability } = solveAndSimulate(wr);

    expect(actions.length).toBeGreaterThan(0);
    expect(progress, `進度未達標，手法：${actions.join(' ')}`).toBeGreaterThanOrEqual(wr.difficulty);
    expect(durability, `耐久耗盡，手法：${actions.join(' ')}`).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('解出的手法同時達到品質目標', () => {
    const wr = toWasm();
    const { actions, quality } = solveAndSimulate(wr);
    expect(quality, `品質未達標，手法：${actions.join(' ')}`).toBeGreaterThanOrEqual(wr.quality);
  }, 120_000);
});

describe('求解器降級', () => {
  it('退回 TypeScript 求解器時必須標記出來', async () => {
    // Node 環境沒有 window，raphaelSolver 一定走備用路徑。
    // 這條測試釘住「降級不得靜默」：TS 版會產出耐久歸零的巨集，
    // 使用者必須看得出手上這份不是正式解。
    const { raphaelSolver } = await import('@/lib/simulator/solver');
    const result = await raphaelSolver(recipe, {
      level: 100, craftsmanship: 4956, control: 4963, cp: 687,
    } as never);

    expect(result.solverUsed).toBe('typescript');
    expect(result.degradedReason, '降級時必須附上原因供 UI 顯示').toBeTruthy();
  }, 60_000);
});
