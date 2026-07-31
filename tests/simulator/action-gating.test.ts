import { describe, it, expect } from 'vitest';
import { craftActions, getAvailableActions } from '@/lib/simulator/crafting-engine';

// ============================================
// 高階／條件技能的可用性
// ============================================
// 使用者回報求解器輸出了他手上沒有的技能。這組測試釘住兩件事：
//   1. 技能的等級需求正確
//   2. 名稱沒有互相張冠李戴（先前 Trained Perfection 被標成「一心不亂」，
//      而那其實是 Heart and Soul 的名字，導致使用者誤以為求解器在用專家技能）

const BY_ID = new Map(craftActions.map((a) => [a.id, a]));

describe('技能等級需求', () => {
  it.each([
    ['careful_observation', 55],
    ['heart_and_soul', 86],
    ['quick_innovation', 96],
    ['immaculate_mend', 98],
    ['trained_perfection', 100],
  ])('%s 需要等級 %i', (id, level) => {
    expect(BY_ID.get(id)?.levelRequirement).toBe(level);
  });

  it('等級不足時不會出現在可用清單中', () => {
    const at97 = getAvailableActions(97).map((a) => a.id);
    expect(at97).not.toContain('immaculate_mend');
    expect(at97).not.toContain('trained_perfection');

    const at100 = getAvailableActions(100).map((a) => a.id);
    expect(at100).toContain('immaculate_mend');
    expect(at100).toContain('trained_perfection');
  });
});

describe('技能名稱', () => {
  it('每個技能的中文名唯一，不可重複', () => {
    const names = craftActions.map((a) => a.nameZh);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `重複的技能名稱: ${[...new Set(dupes)].join('、')}`).toEqual([]);
  });

  it('不可使用日文名當作繁中譯名', () => {
    // 「一心不亂」是 Heart and Soul 的日文名（一心不乱），繁中譯名是「專心致志」
    expect(craftActions.map((a) => a.nameZh)).not.toContain('一心不亂');
  });

  it('每個技能都有英文名，翻譯有疑慮時可據此辨識', () => {
    for (const action of craftActions) {
      expect(action.name, `${action.id} 缺少英文名`).toBeTruthy();
    }
  });

  // 以下對應關係由遊戲內技能選單截圖（100 級烹調師）逐一核對，
  // 並以「等級 + CP」交叉驗證，不是猜的。
  it.each([
    ['immaculate_mend', '巧奪天工', 98, 112],
    ['trained_perfection', '工匠的絕技', 100, 0],
    ['trained_finesse', '工匠的神技', 90, 32],
    ['refined_touch', '精煉加工', 92, 24],
    ['advanced_touch', '上級加工', 84, 46],
    ['heart_and_soul', '專心致志', 86, 0],
    ['careful_observation', '設計變動', 55, 0],
    ['quick_innovation', '快速改革', 96, 0],
    ['daring_touch', '冒進', 96, 0],
    ['manipulation', '掌握', 65, 96],
    ['trained_eye', '工匠的神速技巧', 80, 250],
  ])('%s 的名稱／等級／CP 與遊戲一致', (id, nameZh, level, cp) => {
    const action = BY_ID.get(id);
    expect(action?.nameZh).toBe(nameZh);
    expect(action?.levelRequirement).toBe(level);
    expect(action?.cpCost).toBe(cp);
  });
});

describe('專家限定技能', () => {
  // 使用者的 100 級烹調師技能列表中沒有這三個 —— 它們需要裝備能工巧匠之魂。
  // 求解器預設不得使用，否則會產出玩家做不出來的手法。
  const SPECIALIST_ONLY = ['heart_and_soul', 'careful_observation', 'quick_innovation'];

  it('即使等級足夠也不應預設啟用', () => {
    for (const id of SPECIALIST_ONLY) {
      expect(BY_ID.get(id), `${id} 應存在於技能表中`).toBeDefined();
    }
  });

  it('求解器選項中對應的開關預設為關', async () => {
    const { DEFAULT_SOLVER_OPTIONS } = await import('@/components/solver-options');
    expect(DEFAULT_SOLVER_OPTIONS.useHeartAndSoul).toBe(false);
    expect(DEFAULT_SOLVER_OPTIONS.useQuickInnovation).toBe(false);
  });
});

describe('巨集匯出的技能名稱', () => {
  // 起因：匯出的巨集出現 /ac "Trained Perfection"、/ac "Immaculate Mend"。
  // 遊戲的繁中客戶端不認得英文技能名，這種巨集貼進去整段跑不動。
  //
  // 根因是名稱表被複製了三份（crafting-engine、macro-exporter、simulator-v2），
  // 各自漂移：匯出用的那份只涵蓋 27 個技能，7.x 之後新增的全部落到英文 fallback；
  // simulator-v2 那份則把掌握寫成「掌控」、工匠的絕技寫成「工匠的神業」。
  // 現在三處統一從 craftActions 取名，這條測試釘住它不再分岔。

  it('每個技能都能匯出繁中名，不會退回英文', async () => {
    const { generateMacro } = await import('@/components/macro-exporter');
    const macro = generateMacro(craftActions, { language: 'zh', hasLock: false });

    // 只看技能名本身，不看後面的 <wait.n>
    const names = [...macro.matchAll(/^\/ac (.+?) <wait\./gm)].map((m) => m[1]);
    const englishFallbacks = names.filter((name) => /[A-Za-z]/.test(name));

    expect(
      englishFallbacks,
      `這些技能沒有繁中名可用：${englishFallbacks.join('、')}`
    ).toEqual([]);
  });

  it('匯出的每一行都對應到一個技能', async () => {
    const { generateMacro } = await import('@/components/macro-exporter');
    const macro = generateMacro(craftActions, { language: 'zh', hasLock: false });
    const acLines = macro.split('\n').filter((line) => line.startsWith('/ac '));

    expect(acLines).toHaveLength(craftActions.length);
  });
});
