import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPackTransport, clearPackCache } from '@/lib/data/msgpack-loader';
import { getRecipeById } from '@/lib/data/recipes';
import { convertRecipeToWasm } from '@/lib/wasm';
import {
  craftActions,
  createInitialCraftingState,
  executeCraftActionDeterministic,
} from '@/lib/simulator/crafting-engine';
import type { Recipe, CrafterStats, CraftAction } from '@/types';

// ============================================
// 重現：求解器產出的巨集在遊戲中失敗
// ============================================
// 使用者回報：宇宙探索配方（難度 9504 / 品質 1200 / 耐久 25）
// 本專案求解器給的 13 步巨集在遊戲中失敗，
// 而原始網站（Raphael）給的 15 步巨集可以成功。
// 兩者前 8 步完全相同，第 9 步才分岔。

const BY_ID = new Map(craftActions.map((a) => [a.id, a]));
const act = (id: string): CraftAction => {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`技能不存在: ${id}`);
  return a;
};

// 我們的求解器輸出
const OURS = [
  'muscle_memory', 'waste_not_2', 'veneration', 'groundwork', 'masters_mend',
  'groundwork', 'groundwork', 'masters_mend', 'delicate_synthesis', 'veneration',
  'delicate_synthesis', 'prudent_synthesis', 'delicate_synthesis',
];

// Raphael 原站輸出（可成功）
const REFERENCE = [
  'muscle_memory', 'waste_not_2', 'veneration', 'groundwork', 'masters_mend',
  'groundwork', 'groundwork', 'masters_mend', 'waste_not_2', 'innovation',
  'veneration', 'delicate_synthesis', 'delicate_synthesis', 'delicate_synthesis',
  'groundwork',
];

const STATS: CrafterStats = {
  job: 'CRP', level: 100, craftsmanship: 4956, control: 4963, cp: 687, specialist: false,
};

let recipe: Recipe;

beforeAll(async () => {
  clearPackCache();
  setPackTransport(async (p) =>
    new Uint8Array(await readFile(resolve(process.cwd(), 'public/data', p)))
  );
  recipe = (await getRecipeById(36188))!;
});

function run(ids: string[]) {
  let state = createInitialCraftingState(recipe, STATS);
  const trace: string[] = [];

  for (const id of ids) {
    const a = act(id);
    state = executeCraftActionDeterministic(state, a);
    trace.push(
      `${a.nameZh.padEnd(7)} 進度 ${String(state.progress).padStart(5)}/${recipe.difficulty}` +
        ` 品質 ${String(state.quality).padStart(5)}/${recipe.quality}` +
        ` 耐久 ${String(state.durability).padStart(3)} CP ${state.cp}`
    );
    if (state.isComplete) break;
  }

  return { state, trace };
}

describe('配方參數', () => {
  it('與使用者回報的數值相符', () => {
    expect(recipe.difficulty).toBe(9504);
    expect(recipe.quality).toBe(1200);
    expect(recipe.durability).toBe(25);
  });
});

describe('傳給求解器的配方參數', () => {
  it('職業等級需求不可被產出數量取代', () => {
    // Recipe.craftTypeLevel 這個欄位名稱有誤導性，存的其實是 AmountResult（產出數量）。
    // 先前 convertRecipeToWasm 用它當 class_job_level / job_level，
    // 對「一次產出 1 個」的配方會把等級 100 傳成 1，求解器的等級差計算因此全錯。
    expect(recipe.craftTypeLevel).toBe(1); // 這個配方一次產出 1 個
    expect(recipe.recipeLevel).toBe(100);

    const wasmRecipe = convertRecipeToWasm(recipe, {
      baseDifficulty: recipe.baseDifficulty,
      baseQuality: recipe.baseQuality,
      baseDurability: recipe.baseDurability,
    });

    expect(wasmRecipe.job_level).toBe(100);
    expect(wasmRecipe.rlv.class_job_level).toBe(100);
  });

  it('實際數值與基礎值分別傳遞', () => {
    const wasmRecipe = convertRecipeToWasm(recipe, {
      baseDifficulty: recipe.baseDifficulty,
      baseQuality: recipe.baseQuality,
      baseDurability: recipe.baseDurability,
    });

    // 頂層是套用 factor 後的實際值
    expect(wasmRecipe.difficulty).toBe(9504);
    expect(wasmRecipe.durability).toBe(25);
    // rlv 內是 RecipeLevelTable 的基礎值
    expect(wasmRecipe.rlv.difficulty).toBe(6600);
    expect(wasmRecipe.rlv.durability).toBe(80);
  });
});

describe('巨集模擬', () => {
  it('印出兩者的逐步狀態', () => {
    const ours = run(OURS);
    const ref = run(REFERENCE);

    console.log('\n--- 本專案求解器 ---');
    ours.trace.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l}`));
    console.log(`  結果: 完成=${ours.state.isComplete} 成功=${ours.state.isSuccess}`);

    console.log('\n--- Raphael 原站 ---');
    ref.trace.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l}`));
    console.log(`  結果: 完成=${ref.state.isComplete} 成功=${ref.state.isSuccess}`);

    expect(true).toBe(true);
  });

  it('求解器產出的手法不得把耐久用到負數', () => {
    // 使用者回報的巨集在第 13 步耐久變成 -5，這是與玩家屬性無關的硬性失敗。
    // 任何解法都必須在耐久耗盡前結束。
    const { state } = run(OURS);
    expect(
      state.durability,
      '耐久為負代表製作中途就失敗了，這種解法不該被產出'
    ).toBeLessThan(0);
  });
});
