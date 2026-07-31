'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CraftAction } from '@/types';
import { craftActions } from '@/lib/simulator/crafting-engine';

// 簡單的通知組件
interface NotificationState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

// 技能等待時間（秒）
const ACTION_WAIT_TIMES: Record<string, number> = {
  basic_synthesis: 3,
  careful_synthesis: 3,
  rapid_synthesis: 3,
  groundwork: 3,
  prudent_synthesis: 3,
  intensive_synthesis: 3,
  muscle_memory: 3,
  delicate_synthesis: 3,
  basic_touch: 3,
  standard_touch: 3,
  advanced_touch: 3,
  hasty_touch: 3,
  precise_touch: 3,
  prudent_touch: 3,
  preparatory_touch: 3,
  byregots_blessing: 3,
  reflect: 3,
  trained_finesse: 3,
  focused_touch: 3,
  masters_mend: 3,
  waste_not: 2,
  waste_not_2: 2,
  manipulation: 2,
  innovation: 2,
  veneration: 2,
  great_strides: 2,
  observe: 3,
};

// 取得技能等待時間
function getActionWaitTime(actionId: string): number {
  return ACTION_WAIT_TIMES[actionId] ?? 3;
}

// 技能名稱一律取自 crafting-engine 的 craftActions。
//
// 這裡原本另外維護一份 ACTION_NAMES_ZH，只涵蓋 27 個技能，7.x 之後新增的
// 工匠的絕技、巧奪天工、專心致志等都不在其中，匯出的巨集會退回英文名
//（例如 /ac "Trained Perfection"），玩家貼進遊戲就跑不動。
// 名稱表分散在多處必然漂移，所以改為單一來源。
const ACTION_NAME_INDEX = new Map(craftActions.map((action) => [action.id, action]));

function resolveActionName(action: CraftAction, language: 'zh' | 'en'): string {
  const known = ACTION_NAME_INDEX.get(action.id) ?? action;
  return language === 'zh' ? known.nameZh || known.name : known.name;
}

// 提示音選項
const NOTIFY_SOUNDS = [
  { label: '無提示音', value: '' },
  { label: '隨機提示音', value: '<se>' },
  ...Array.from({ length: 16 }, (_, i) => ({
    label: `<se.${i + 1}>`,
    value: `<se.${i + 1}>`,
  })),
];

/**
 * 產生簡單的巨集文字（用於測試和外部調用）
 */
export function generateMacro(
  actions: CraftAction[],
  options: {
    language?: 'zh' | 'en';
    hasLock?: boolean;
    notifySound?: string;
    waitTimeInc?: number;
  } = {}
): string {
  const {
    language = 'zh',
    hasLock = true,
    notifySound = '<se.1>',
    waitTimeInc = 0,
  } = options;
  
  const lines: string[] = [];
  
  // 添加鎖定宏
  if (hasLock) {
    lines.push('/mlock');
  }
  
  // 取得技能名稱
  const getActionName = (action: CraftAction): string =>
    resolveActionName(action, language);
  
  // 添加技能指令
  for (const action of actions) {
    const waitTime = getActionWaitTime(action.id) + waitTimeInc;
    const actionName = getActionName(action);
    lines.push(`/ac ${actionName} <wait.${waitTime}>`);
  }
  
  // 添加完成提示
  lines.push(`/e 巨集#1 已完成！ ${notifySound}`);
  
  return lines.join('\n');
}

interface MacroExporterProps {
  actions: CraftAction[];
  language?: 'zh' | 'en';
}

interface MacroChunk {
  lines: string[];
  totalWaitTime: number;
}

type SectionMethod = 'avg' | 'greedy' | 'disable';
type AddNotification = boolean | 'auto';

export function MacroExporter({ actions, language = 'zh' }: MacroExporterProps) {
  // 通知狀態
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  
  // 顯示通知
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
    // 3 秒後自動移除
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);
  
  // 設定選項
  const [hasLock, setHasLock] = useState(false);
  const [addNotification, setAddNotification] = useState<AddNotification>('auto');
  const [sectionMethod, setSectionMethod] = useState<SectionMethod>('avg');
  const [notifySound, setNotifySound] = useState('<se.1>');
  const [waitTimeInc, setWaitTimeInc] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // 取得技能名稱
  const getActionName = useCallback(
    (action: CraftAction): string => resolveActionName(action, language),
    [language]
  );
  
  // 判斷是否需要顯示完成提示
  const hasNotify = useMemo(() => {
    if (addNotification !== 'auto') {
      return addNotification;
    }
    // 自動判斷：如果添加提示不會增加宏數量，就添加
    let maxLinesPerChunk = 15;
    if (hasLock) maxLinesPerChunk--;
    const minChunks1 = Math.ceil(actions.length / maxLinesPerChunk);
    maxLinesPerChunk--;
    const minChunks2 = Math.ceil(actions.length / maxLinesPerChunk);
    return minChunks1 === minChunks2;
  }, [addNotification, hasLock, actions.length]);
  
  // 產生分段後的巨集
  const macroChunks = useMemo((): MacroChunk[] => {
    if (actions.length === 0) return [];
    
    const macros: MacroChunk[] = [];
    
    // 計算每段最大行數
    let maxLinesPerChunk = 15;
    if (hasNotify) maxLinesPerChunk--;
    if (hasLock) maxLinesPerChunk--;
    if (sectionMethod === 'disable') maxLinesPerChunk = 99999;
    
    // 計算需要幾段
    const minChunks = Math.ceil(actions.length / maxLinesPerChunk);
    const size = Math.ceil(actions.length / minChunks);
    
    for (let sec = 0; sec < minChunks; sec++) {
      let sectionActions: CraftAction[];
      
      switch (sectionMethod) {
        case 'avg':
          // 平均分配
          sectionActions = actions.slice(
            sec * size,
            Math.min(actions.length, (sec + 1) * size)
          );
          break;
        case 'greedy':
          // 貪婪分配（每段盡可能多）
          const start = sec * maxLinesPerChunk;
          sectionActions = actions.slice(
            start,
            Math.min(actions.length, start + maxLinesPerChunk)
          );
          break;
        case 'disable':
        default:
          sectionActions = actions.slice();
          break;
      }
      
      const lines: string[] = [];
      let totalWaitTime = 0;
      
      // 添加鎖定宏
      if (hasLock) {
        lines.push('/mlock');
      }
      
      // 添加技能指令
      for (const action of sectionActions) {
        const waitTime = getActionWaitTime(action.id) + waitTimeInc;
        const actionName = getActionName(action);
        
        // 如果技能名稱包含空格，需要加引號
        const formattedName = actionName.includes(' ') ? `"${actionName}"` : actionName;
        
        lines.push(`/ac ${formattedName} <wait.${waitTime}>`);
        totalWaitTime += waitTime;
      }
      
      // 添加完成提示
      if (hasNotify) {
        lines.push(`/echo 巨集 #${sec + 1} 已完成！ ${notifySound}`);
      }
      
      macros.push({ lines, totalWaitTime });
    }
    
    return macros;
  }, [actions, hasLock, hasNotify, sectionMethod, notifySound, waitTimeInc, getActionName]);
  
  // 複製單個巨集到剪貼簿
  const copyMacro = useCallback(async (index: number) => {
    const chunk = macroChunks[index];
    if (!chunk) return;
    
    const macroText = chunk.lines.join('\r\n');
    try {
      await navigator.clipboard.writeText(macroText);
      showNotification(`已複製 巨集 #${index + 1} 到剪貼簿`, 'success');
    } catch (err) {
      showNotification('複製失敗', 'error');
      console.error(err);
    }
  }, [macroChunks]);
  
  // 複製所有巨集到剪貼簿
  const copyAllMacros = useCallback(async () => {
    if (macroChunks.length === 0) return;
    
    const allMacros = macroChunks
      .map((chunk, i) => `=== 巨集 #${i + 1}/${macroChunks.length} ===\n${chunk.lines.join('\n')}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allMacros);
      showNotification(`已複製 ${macroChunks.length} 個巨集到剪貼簿`, 'success');
    } catch (err) {
      showNotification('複製失敗', 'error');
      console.error(err);
    }
  }, [macroChunks]);
  
  // 計算總時間
  const totalDuration = useMemo(() => {
    const totalSeconds = macroChunks.reduce((sum, chunk) => sum + chunk.totalWaitTime, 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }, [macroChunks]);
  
  if (actions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        尚無技能序列可匯出
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* 通知訊息 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in ${
              n.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {n.message}
          </div>
        ))}
      </div>
      
      {/* 統計資訊與操作按鈕 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex gap-4 text-sm text-gray-500">
          <span>步數：{actions.length}</span>
          <span>巨集數：{macroChunks.length}</span>
          <span>總耗時：{totalDuration}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {showSettings ? '隱藏設定' : '⚙️ 設定'}
          </button>
          {macroChunks.length > 1 && (
            <button
              onClick={copyAllMacros}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              一鍵複製全部
            </button>
          )}
        </div>
      </div>
      
      {/* 設定選項（可收闔） */}
      {showSettings && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
          <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">巨集設定</h3>
          
          {/* 鎖定與提示 */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasLock}
                onChange={(e) => setHasLock(e.target.checked)}
                className="rounded"
              />
              <span>鎖定巨集 (/mlock)</span>
            </label>
          </div>
          
          {/* 完成提示 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">完成提示：</span>
            <div className="flex gap-1">
              {(['auto', true, false] as const).map((value) => (
                <button
                  key={String(value)}
                  onClick={() => setAddNotification(value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    addNotification === value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {value === 'auto' ? '自動' : value ? '總是' : '不提示'}
                </button>
              ))}
            </div>
          </div>
          
          {/* 分段方式 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">分段方式：</span>
            <div className="flex gap-1">
              {([
                { value: 'avg', label: '平均' },
                { value: 'greedy', label: '貪婪' },
                { value: 'disable', label: '停用' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSectionMethod(value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sectionMethod === value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 提示音 */}
          {hasNotify && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">提示音：</span>
              <select
                value={notifySound}
                onChange={(e) => setNotifySound(e.target.value)}
                className="text-sm px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
              >
                {NOTIFY_SOUNDS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* 等待時間調整 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">增加等待時間：</span>
            <input
              type="number"
              value={waitTimeInc}
              onChange={(e) => setWaitTimeInc(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              max={10}
              className="w-16 text-sm px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-xs text-gray-500">秒</span>
          </div>
        </div>
      )}
      
      {/* 巨集卡片 */}
      <div className="space-y-3">
        {macroChunks.map((chunk, index) => (
          <div
            key={index}
            onClick={() => copyMacro(index)}
            className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                巨集 #{index + 1}
              </span>
              <span className="text-xs text-gray-500">
                {chunk.totalWaitTime}s • 點擊複製
              </span>
            </div>
            <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
              {chunk.lines.join('\n')}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
