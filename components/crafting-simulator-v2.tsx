'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import type {
  CraftingState,
  CraftAction,
  Recipe,
  CrafterStats,
} from '@/types';
import {
  craftActions,
} from '@/lib/simulator/crafting-engine';
import { raphaelSolver, type RaphaelSolverOptions, type SolverResult } from '@/lib/simulator/solver';
import { MacroExporter } from './macro-exporter';

// Cookie 鍵名
const SOLVER_OPTIONS_COOKIE_KEY = 'ffxiv-solver-options';

// 預設求解器選項
const DEFAULT_SOLVER_OPTIONS: Omit<RaphaelSolverOptions, 'targetQuality'> = {
  useManipulation: false,
  useHeartAndSoul: false,
  useQuickInnovation: false,
  useTrainedEye: false,
  backloadProgress: false,
  adversarial: false,
};

// 從 cookie 讀取求解器選項
function loadSolverOptionsFromCookie(): Partial<RaphaelSolverOptions> {
  try {
    const saved = Cookies.get(SOLVER_OPTIONS_COOKIE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse solver options from cookie:', e);
  }
  return {};
}

// 儲存求解器選項到 cookie
function saveSolverOptionsToCookie(options: RaphaelSolverOptions) {
  const { targetQuality, ...optionsToSave } = options;
  Cookies.set(SOLVER_OPTIONS_COOKIE_KEY, JSON.stringify(optionsToSave), { expires: 365 });
}

// 技能名稱映射
const ACTION_NAMES: Record<string, string> = {
  'basic_synthesis': '製作',
  'basic_touch': '加工',
  'masters_mend': '精修',
  'hasty_touch': '倉促加工',
  'rapid_synthesis': '高速製作',
  'observe': '觀察',
  'tricks_of_the_trade': '秘訣',
  'standard_touch': '中級加工',
  'great_strides': '闊步',
  'innovation': '改革',
  'veneration': '崇敬',
  'muscle_memory': '堅信',
  'careful_synthesis': '模範製作',
  'manipulation': '掌控',
  'prudent_touch': '儉約加工',
  'reflect': '閒靜',
  'preparatory_touch': '坯料加工',
  'groundwork': '坯料製作',
  'delicate_synthesis': '精密製作',
  'intensive_synthesis': '集中製作',
  'advanced_touch': '上級加工',
  'prudent_synthesis': '儉約製作',
  'trained_finesse': '工匠的神技',
  'careful_observation': '設計變動',
  'heart_and_soul': '專心致志',
  'trained_eye': '工匠的神速技',
  'waste_not': '儉約',
  'waste_not_2': '長期儉約',
  'byregots_blessing': '比爾格的祝福',
  'focused_synthesis': '注視製作',
  'focused_touch': '注視加工',
  'precise_touch': '集中加工',
  'final_appraisal': '最終確認',
  'immaculate_mend': '精修（強化）',
  'trained_perfection': '工匠的神業',
  'refined_touch': '精煉加工',
  'daring_touch': '大膽加工',
  'quick_innovation': '快速改革',
};

// 收藏品等級類型
interface CollectabilityLevel {
  low: number;
  mid: number;
  high: number;
}

interface CraftingSimulatorProps {
  recipe: Recipe;
  crafterStats: CrafterStats;
  recipeName?: string;
  collectability?: CollectabilityLevel;
  onClose?: () => void;
}

// 進度條組件
function ProgressBar({
  current,
  max,
  color,
  label,
  showValues = true,
  markers,
}: {
  current: number;
  max: number;
  color: 'green' | 'yellow' | 'cyan' | 'purple';
  label?: string;
  showValues?: boolean;
  markers?: { position: number; color: string; label?: string }[];
}) {
  const percentage = Math.min((current / max) * 100, 100);
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-500',
  };

  return (
    <div className="space-y-1">
      {(label || showValues) && (
        <div className="flex justify-between text-xs text-gray-400">
          {label && <span>{label}</span>}
          {showValues && <span>{current} / {max}</span>}
        </div>
      )}
      <div className="relative h-4 bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
        {markers?.map((marker, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-0.5"
            style={{ 
              left: `${(marker.position / max) * 100}%`,
              backgroundColor: marker.color,
            }}
            title={marker.label}
          />
        ))}
      </div>
    </div>
  );
}

// 技能圖標組件
function ActionIcon({ action, size = 'md' }: { action: CraftAction; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const categoryColors: Record<string, string> = {
    progress: 'bg-blue-600',
    quality: 'bg-amber-600',
    durability: 'bg-green-600',
    buff: 'bg-purple-600',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${categoryColors[action.category] || 'bg-gray-600'} rounded flex items-center justify-center text-white font-bold`}
      title={ACTION_NAMES[action.id] || action.name}
    >
      {(ACTION_NAMES[action.id] || action.name).charAt(0)}
    </div>
  );
}

export function CraftingSimulatorV2({
  recipe,
  crafterStats,
  recipeName,
  collectability,
  onClose,
}: CraftingSimulatorProps) {
  // 求解器狀態
  const [solverOptions, setSolverOptions] = useState<RaphaelSolverOptions>(() => {
    const savedOptions = loadSolverOptionsFromCookie();
    return {
      targetQuality: recipe.quality,
      ...DEFAULT_SOLVER_OPTIONS,
      ...savedOptions,
    };
  });
  const [isSolving, setIsSolving] = useState(false);
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [showMacroExport, setShowMacroExport] = useState(false);
  const [showSolverSettings, setShowSolverSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // 儲存選項到 cookie
  useEffect(() => {
    saveSolverOptionsToCookie(solverOptions);
  }, [solverOptions]);

  // 當 recipe 改變時重置
  useEffect(() => {
    setSolverResult(null);
    setSolverOptions(prev => ({
      ...prev,
      targetQuality: recipe.quality,
    }));
  }, [recipe]);

  // 執行求解
  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    setSolverResult(null);

    try {
      const result = await raphaelSolver(recipe, crafterStats, solverOptions);
      setSolverResult(result);
    } catch (error) {
      console.error('Solver error:', error);
      alert('求解失敗，請嘗試調整參數');
    } finally {
      setIsSolving(false);
    }
  }, [recipe, crafterStats, solverOptions]);

  // 計算品質率和收藏價值
  const qualityRate = solverResult
    ? Math.round((solverResult.finalState.quality / recipe.quality) * 100)
    : 0;

  // 收藏品等級判斷
  const collectabilityLevel = useMemo(() => {
    if (!collectability || !solverResult) return null;
    const quality = solverResult.finalState.quality;
    if (quality >= collectability.high) return { level: 3, name: '特選', color: 'text-yellow-400' };
    if (quality >= collectability.mid) return { level: 2, name: '精選', color: 'text-cyan-400' };
    if (quality >= collectability.low) return { level: 1, name: '普通', color: 'text-gray-400' };
    return { level: 0, name: '不合格', color: 'text-red-400' };
  }, [collectability, solverResult]);

  // 巨集資訊計算
  const macroInfo = useMemo(() => {
    if (!solverResult) return null;
    const steps = solverResult.steps;
    const macroCount = Math.ceil(steps / 15);
    const totalWaitTime = solverResult.actions.reduce((sum, action) => {
      // 大部分技能需要 3 秒，buff 技能需要 2 秒
      return sum + (action.category === 'buff' ? 2 : 3);
    }, 0);
    const manualTime = totalWaitTime * 0.7; // 手動操作約 70% 時間

    return {
      macroCount,
      steps,
      totalWaitTime,
      manualTime: Math.round(manualTime * 10) / 10,
    };
  }, [solverResult]);

  return (
    <div className="bg-gray-900 text-white rounded-lg overflow-hidden">
      {/* 頂部資訊區 */}
      <div className="p-4 space-y-3">
        {/* 配方名稱 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-red-400">
            {recipeName || recipe.item?.name || `配方 ${recipe.id}`}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 狀態條 - 上半部：耐久、進展 */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
          <div className="text-sm text-gray-400">
            耐久 {solverResult ? solverResult.finalState.durability : recipe.durability} / {recipe.durability}
          </div>
          <div className="flex-1">
            <ProgressBar
              current={solverResult?.finalState.progress || 0}
              max={recipe.difficulty}
              color="green"
              label={`進展 ${solverResult?.finalState.progress || 0} / ${recipe.difficulty}`}
              showValues={false}
            />
          </div>
          <div className="text-right text-sm">
            <div>等級: <span className="text-white">{crafterStats.level}</span></div>
          </div>
        </div>

        {/* CP */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
          <div className="text-sm text-gray-400">
            CP(製作力) {solverResult ? solverResult.finalState.cp : crafterStats.cp} / {crafterStats.cp}
          </div>
          <div className="flex-1">
            {/* 品質條 */}
            <ProgressBar
              current={solverResult?.finalState.quality || 0}
              max={recipe.quality}
              color="yellow"
              label={`品質 ${solverResult?.finalState.quality || 0} / ${recipe.quality}${qualityRate > 0 ? `  優質率 ${qualityRate}%` : ''}${collectabilityLevel ? `  收藏價值等級 ${collectabilityLevel.level}` : ''}`}
              showValues={false}
              markers={collectability ? [
                { position: collectability.low, color: '#9CA3AF', label: '普通' },
                { position: collectability.mid, color: '#22D3EE', label: '精選' },
                { position: collectability.high, color: '#FACC15', label: '特選' },
              ] : undefined}
            />
          </div>
          <div className="text-right text-sm">
            <div>作業精度: <span className="text-white">{crafterStats.craftsmanship}</span></div>
            <div>加工精度: <span className="text-white">{crafterStats.control}</span></div>
            <div>CP(製作力): <span className="text-white">{crafterStats.cp}</span></div>
          </div>
        </div>
      </div>

      {/* 技能序列區 */}
      {solverResult && (
        <div className="px-4 pb-4">
          {/* 求解器降級警告。
              TS 備用求解器只是粗略啟發式，會產出耐久中途歸零、抄進遊戲直接失敗的
              巨集。以前降級是靜默的，使用者只會覺得「求解器算錯了」。 */}
          {solverResult.degradedReason && (
            <div className="mb-3 p-3 rounded-lg border border-amber-600/60 bg-amber-900/30">
              <div className="font-medium text-amber-200">⚠ 這是備用求解器的結果，不保證可行</div>
              <div className="mt-1 text-sm text-amber-300">
                {solverResult.degradedReason}。備用求解器算出的技能序列可能中途耐久歸零，
                抄進遊戲會製作失敗，請重新整理頁面再試一次。
              </div>
            </div>
          )}

          {/* 技能圖標列表 */}
          <div className="flex flex-wrap gap-1 p-3 bg-gray-800 rounded-lg mb-3">
            {solverResult.actions.map((action, index) => (
              <ActionIcon key={index} action={action} size="md" />
            ))}
          </div>

          {/* 巨集資訊 */}
          {macroInfo && (
            <div className="flex items-center gap-4 text-sm text-cyan-400 mb-4">
              <span>巨集長度: {macroInfo.macroCount}</span>
              <span>工次: {macroInfo.steps}</span>
              <span>巨集耗時: {macroInfo.totalWaitTime}s</span>
              <span>手搓耗時: {macroInfo.manualTime}s</span>
            </div>
          )}
        </div>
      )}

      {/* 分頁區 */}
      <div className="border-t border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-sm ${activeTab === 'export' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            匯出
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-sm ${activeTab === 'import' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            匯入
          </button>
          <button
            onClick={handleSolve}
            disabled={isSolving}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            {isSolving ? '求解中...' : '求解'}
          </button>
          <button
            onClick={() => setShowSolverSettings(!showSolverSettings)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            設定
          </button>
        </div>

        {/* 設定面板 */}
        {showSolverSettings && (
          <div className="p-4 bg-gray-800 space-y-3">
            <div className="text-sm font-medium mb-2">求解器選項</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={solverOptions.useManipulation}
                  onChange={(e) => setSolverOptions(prev => ({ ...prev, useManipulation: e.target.checked }))}
                  className="rounded"
                />
                <span>使用掌控</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={solverOptions.useHeartAndSoul}
                  onChange={(e) => setSolverOptions(prev => ({ ...prev, useHeartAndSoul: e.target.checked }))}
                  className="rounded"
                />
                <span>專心致志</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={solverOptions.backloadProgress}
                  onChange={(e) => setSolverOptions(prev => ({ ...prev, backloadProgress: e.target.checked }))}
                  className="rounded"
                />
                <span>後置進度</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={solverOptions.adversarial}
                  onChange={(e) => setSolverOptions(prev => ({ ...prev, adversarial: e.target.checked }))}
                  className="rounded"
                />
                <span>防黑球</span>
              </label>
            </div>
          </div>
        )}

        {/* 匯出區域 */}
        {activeTab === 'export' && solverResult && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded" defaultChecked />
                <span className="text-green-400">鎖定巨集指令</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded" defaultChecked />
                <span className="text-green-400">一鍵複製</span>
              </label>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span>新增完成提示</span>
              <button className="px-3 py-1 bg-gray-700 rounded text-white">自動確定</button>
              <button className="px-3 py-1 bg-gray-800 rounded text-gray-400">總是提示</button>
              <button className="px-3 py-1 bg-gray-800 rounded text-gray-400">不提示</button>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span>拆分過長的巨集</span>
              <button className="px-3 py-1 bg-gray-700 rounded text-white">平均</button>
              <button className="px-3 py-1 bg-gray-800 rounded text-gray-400">貪婪</button>
              <button className="px-3 py-1 bg-gray-800 rounded text-gray-400">停用</button>
            </div>

            {/* 巨集文字區域 */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {Array.from({ length: macroInfo?.macroCount || 1 }, (_, i) => {
                const startIdx = i * 15;
                const endIdx = Math.min((i + 1) * 15, solverResult.actions.length);
                const macroActions = solverResult.actions.slice(startIdx, endIdx);
                
                return (
                  <div key={i} className="bg-gray-800 rounded p-3 font-mono text-xs">
                    <div className="text-gray-500 mb-2">/mlock</div>
                    {macroActions.map((action, j) => {
                      const waitTime = action.category === 'buff' ? 2 : 3;
                      return (
                        <div key={j} className="text-gray-300">
                          /ac {ACTION_NAMES[action.id] || action.name} &lt;wait.{waitTime}&gt;
                        </div>
                      );
                    })}
                    <div className="text-gray-500">/e 巨集#{i + 1} 已完成！ &lt;se.1&gt;</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 匯入區域 */}
        {activeTab === 'import' && (
          <div className="p-4">
            <textarea
              className="w-full h-32 bg-gray-800 rounded p-3 text-sm font-mono text-gray-300"
              placeholder="在此貼上巨集文字..."
            />
            <button className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
              匯入巨集
            </button>
          </div>
        )}

        {/* 無結果時顯示求解按鈕 */}
        {!solverResult && activeTab === 'export' && (
          <div className="p-4 text-center">
            <p className="text-gray-400 mb-4">點擊「求解」按鈕開始自動求解</p>
            <button
              onClick={handleSolve}
              disabled={isSolving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white"
            >
              {isSolving ? '求解中...' : '🚀 開始求解'}
            </button>
          </div>
        )}
      </div>

      {/* 巨集匯出對話框 */}
      {showMacroExport && solverResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">巨集匯出</h3>
              <button
                onClick={() => setShowMacroExport(false)}
                className="p-2 hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MacroExporter actions={solverResult.actions} />
          </div>
        </div>
      )}
    </div>
  );
}

export default CraftingSimulatorV2;
