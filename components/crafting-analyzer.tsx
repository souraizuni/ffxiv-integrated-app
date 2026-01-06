'use client';

import { useState, useMemo } from 'react';
import type {
  CraftingState,
  CraftAction,
  Recipe,
  CrafterStats,
} from '@/types';
import {
  runSimulations,
  calculateAttributeScope,
  analyzeSequence,
  estimateCraftingResult,
  validateActionSequence,
  type SimulationStatistics,
  type AttributeScope,
  type SequenceAnalysis,
  type CraftingEstimate,
} from '@/lib/simulator';

interface CraftingAnalyzerProps {
  recipe: Recipe;
  crafterStats: CrafterStats;
  actions: CraftAction[];
  currentState?: CraftingState;
}

export function CraftingAnalyzer({
  recipe,
  crafterStats,
  actions,
  currentState,
}: CraftingAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'scope' | 'detail'>('overview');
  const [simulationRuns, setSimulationRuns] = useState(1000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationStatistics | null>(null);

  // 即時預估
  const estimate = useMemo(() => {
    if (actions.length === 0) return null;
    return estimateCraftingResult(recipe, crafterStats, actions);
  }, [recipe, crafterStats, actions]);

  // 驗證技能序列
  const validation = useMemo(() => {
    if (actions.length === 0) return { valid: true, issues: [] };
    return validateActionSequence(recipe, crafterStats, actions);
  }, [recipe, crafterStats, actions]);

  // 屬性適配範圍
  const attributeScope = useMemo(() => {
    if (actions.length === 0) return null;
    return calculateAttributeScope(recipe, crafterStats, actions);
  }, [recipe, crafterStats, actions]);

  // 技能序列分析
  const sequenceAnalysis = useMemo(() => {
    if (actions.length === 0) return null;
    return analyzeSequence(recipe, crafterStats, actions);
  }, [recipe, crafterStats, actions]);

  // 執行模擬
  const handleRunSimulation = () => {
    setIsSimulating(true);
    // 使用 setTimeout 讓 UI 更新
    setTimeout(() => {
      const result = runSimulations(recipe, crafterStats, actions, simulationRuns);
      setSimulationResult(result);
      setIsSimulating(false);
    }, 10);
  };

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📊</div>
        <p>請先添加技能以進行分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 分頁選擇 */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {[
          { key: 'overview', label: '總覽' },
          { key: 'simulation', label: '模擬' },
          { key: 'scope', label: '適配範圍' },
          { key: 'detail', label: '詳細分析' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`
              flex-1 px-3 py-1.5 text-sm rounded-md transition-colors
              ${activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 總覽 */}
      {activeTab === 'overview' && estimate && (
        <div className="space-y-4">
          {/* 預估結果 */}
          <div className="grid grid-cols-2 gap-3">
            <ResultCard
              label="預估進度"
              value={estimate.estimatedProgress}
              max={recipe.difficulty}
              color={estimate.canComplete ? 'green' : 'red'}
              suffix={`/ ${recipe.difficulty}`}
            />
            <ResultCard
              label="預估品質"
              value={estimate.estimatedQuality}
              max={recipe.quality}
              color={estimate.estimatedHQChance >= 100 ? 'amber' : 'gray'}
              suffix={`/ ${recipe.quality}`}
            />
            <ResultCard
              label="HQ 機率"
              value={estimate.estimatedHQChance}
              max={100}
              color={estimate.estimatedHQChance >= 100 ? 'amber' : estimate.estimatedHQChance >= 50 ? 'blue' : 'gray'}
              suffix="%"
            />
            <ResultCard
              label="剩餘 CP"
              value={estimate.estimatedCP}
              max={crafterStats.cp}
              color="purple"
              suffix={`/ ${crafterStats.cp}`}
            />
          </div>

          {/* 狀態指示 */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              status={estimate.canComplete ? 'success' : 'error'}
              label={estimate.canComplete ? '可完成製作' : '無法完成'}
            />
            <StatusBadge
              status={estimate.estimatedHQChance >= 100 ? 'success' : estimate.estimatedHQChance >= 50 ? 'warning' : 'error'}
              label={`HQ ${estimate.estimatedHQChance >= 100 ? '100%' : estimate.estimatedHQChance.toFixed(0) + '%'}`}
            />
            <StatusBadge
              status="info"
              label={`${estimate.estimatedSteps} 步`}
            />
          </div>

          {/* 警告 */}
          {!validation.valid && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">⚠️ 問題</h4>
              <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                {validation.issues.map((issue, i) => (
                  <li key={i}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 建議 */}
          {sequenceAnalysis && sequenceAnalysis.suggestions.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">💡 建議</h4>
              <ul className="text-sm text-amber-600 dark:text-amber-300 space-y-1">
                {sequenceAnalysis.suggestions.map((suggestion, i) => (
                  <li key={i}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 模擬分頁 */}
      {activeTab === 'simulation' && (
        <div className="space-y-4">
          {/* 模擬設定 */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-500">模擬次數</label>
            <select
              value={simulationRuns}
              onChange={(e) => setSimulationRuns(Number(e.target.value))}
              className="px-3 py-1.5 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              <option value={100}>100 次</option>
              <option value={500}>500 次</option>
              <option value={1000}>1,000 次</option>
              <option value={5000}>5,000 次</option>
              <option value={10000}>10,000 次</option>
            </select>
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSimulating ? '模擬中...' : '執行模擬'}
            </button>
          </div>

          {/* 模擬結果 */}
          {simulationResult && (
            <div className="space-y-4">
              {/* 結果分布 */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="font-medium mb-3">結果分布</h4>
                <div className="space-y-2">
                  <DistributionBar
                    label="HQ"
                    value={simulationResult.highQuality}
                    total={simulationResult.totalRuns}
                    color="bg-amber-500"
                  />
                  <DistributionBar
                    label="普通"
                    value={simulationResult.normal}
                    total={simulationResult.totalRuns}
                    color="bg-green-500"
                  />
                  <DistributionBar
                    label="失敗"
                    value={simulationResult.fails}
                    total={simulationResult.totalRuns}
                    color="bg-red-500"
                  />
                  <DistributionBar
                    label="未完成"
                    value={simulationResult.unfinished}
                    total={simulationResult.totalRuns}
                    color="bg-gray-400"
                  />
                </div>
              </div>

              {/* 統計數據 */}
              <div className="grid grid-cols-2 gap-3">
                <StatItem label="成功率" value={`${simulationResult.successRate.toFixed(1)}%`} />
                <StatItem label="HQ 率" value={`${simulationResult.hqRate.toFixed(1)}%`} />
                <StatItem label="平均品質" value={simulationResult.averageQuality.toFixed(0)} />
                <StatItem label="平均 HQ 機率" value={`${simulationResult.averageHQChance.toFixed(1)}%`} />
                <StatItem label="最低品質" value={simulationResult.minQuality.toString()} />
                <StatItem label="最高品質" value={simulationResult.maxQuality.toString()} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 適配範圍 */}
      {activeTab === 'scope' && attributeScope && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-4">
            {/* 作業精度範圍 */}
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">作業精度適配範圍</h4>
              <div className="text-lg font-semibold">
                {attributeScope.craftsmanshipRange[0] !== null
                  ? attributeScope.craftsmanshipRange[0]
                  : '?'}
                {' ~ '}
                {attributeScope.craftsmanshipRange[1] !== null
                  ? attributeScope.craftsmanshipRange[1]
                  : '∞'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                目前: {crafterStats.craftsmanship}
              </p>
            </div>

            {/* 加工精度最小值 */}
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">加工精度最小值 (100% HQ)</h4>
              <div className="text-lg font-semibold">
                {attributeScope.controlMin !== null
                  ? `${attributeScope.controlMin} ~`
                  : attributeScope.canAchieveHQ
                    ? '計算中...'
                    : '無法達到 100% HQ'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                目前: {crafterStats.control}
              </p>
            </div>

            {/* CP 消耗 */}
            <div>
              <h4 className="font-medium text-sm text-gray-500 mb-2">CP 消耗</h4>
              <div className="text-lg font-semibold">
                {attributeScope.cpUsed} / {crafterStats.cp}
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(attributeScope.cpUsed / crafterStats.cp) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 狀態 */}
          <div className="flex gap-2">
            <StatusBadge
              status={attributeScope.canComplete ? 'success' : 'error'}
              label={attributeScope.canComplete ? '可完成' : '無法完成'}
            />
            <StatusBadge
              status={attributeScope.canAchieveHQ ? 'success' : 'warning'}
              label={attributeScope.canAchieveHQ ? '可達 100% HQ' : '無法達 100% HQ'}
            />
          </div>
        </div>
      )}

      {/* 詳細分析 */}
      {activeTab === 'detail' && sequenceAnalysis && (
        <div className="space-y-4">
          {/* 效率統計 */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="總步數" value={sequenceAnalysis.totalSteps.toString()} />
            <StatItem label="CP 消耗" value={sequenceAnalysis.totalCPCost.toString()} />
            <StatItem label="耐久消耗" value={sequenceAnalysis.totalDurabilityCost.toString()} />
            <StatItem label="進度效率" value={`${sequenceAnalysis.progressEfficiency.toFixed(1)}/步`} />
          </div>

          {/* 步驟詳情 */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h4 className="font-medium mb-3">步驟詳情</h4>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr className="text-left text-gray-500">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">技能</th>
                    <th className="py-1 pr-2">進度</th>
                    <th className="py-1 pr-2">品質</th>
                    <th className="py-1 pr-2">耐久</th>
                    <th className="py-1">CP</th>
                  </tr>
                </thead>
                <tbody>
                  {sequenceAnalysis.steps.map((step) => (
                    <tr key={step.step} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="py-1.5 pr-2 text-gray-500">{step.step}</td>
                      <td className="py-1.5 pr-2 font-medium">{step.action.nameZh}</td>
                      <td className="py-1.5 pr-2">
                        {step.progress}
                        {step.progressGain > 0 && (
                          <span className="text-blue-500 ml-1">+{step.progressGain}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">
                        {step.quality}
                        {step.qualityGain > 0 && (
                          <span className="text-amber-500 ml-1">+{step.qualityGain}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">{step.durability}</td>
                      <td className="py-1.5">{step.cp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 輔助組件

interface ResultCardProps {
  label: string;
  value: number;
  max: number;
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';
  suffix?: string;
}

function ResultCard({ label, value, max, color, suffix }: ResultCardProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  const colorClasses = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };
  
  const bgClasses = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-400',
  };
  
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorClasses[color]}`}>
        {value.toLocaleString()}{suffix && <span className="text-sm opacity-60">{suffix}</span>}
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
        <div
          className={`h-full ${bgClasses[color]} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: 'success' | 'error' | 'warning' | 'info';
  label: string;
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const classes = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '!',
    info: 'ℹ',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${classes[status]}`}>
      <span>{icons[status]}</span>
      {label}
    </span>
  );
}

interface DistributionBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function DistributionBar({ label, value, total, color }: DistributionBarProps) {
  const percentage = (value / total) * 100;
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-20 text-right text-sm">
        {value} ({percentage.toFixed(1)}%)
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
