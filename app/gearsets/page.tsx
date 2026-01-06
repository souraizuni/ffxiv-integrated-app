'use client';

import { useState } from 'react';
import { useGearsets, ALL_CRAFT_JOBS, JOB_NAMES, DEFAULT_ATTRIBUTES, GearsetRow } from '@/hooks/use-gearsets';
import type { CraftJob } from '@/types';

export default function GearsetsPage() {
  const {
    gearsets,
    addGearset,
    updateGearset,
    updateAttributes,
    deleteGearset,
    getDisplayName,
    exportJson,
    importJson,
  } = useGearsets();

  const [selectedId, setSelectedId] = useState<number>(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');

  const selectedGearset = gearsets.find(g => g.id === selectedId) || gearsets[0];

  const handleAddGearset = () => {
    const newId = addGearset();
    setSelectedId(newId);
  };

  const handleDeleteGearset = (id: number) => {
    if (id === 0) {
      alert('無法刪除預設配裝');
      return;
    }
    if (confirm('確定要刪除這個配裝嗎？')) {
      deleteGearset(id);
      setSelectedId(0);
    }
  };

  const handleExport = () => {
    const json = exportJson();
    navigator.clipboard.writeText(json);
    alert('配裝資料已複製到剪貼簿！');
  };

  const handleImport = () => {
    if (importJson(importText)) {
      setShowImportDialog(false);
      setImportText('');
      alert('匯入成功！');
    } else {
      alert('匯入失敗，請檢查資料格式');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">配裝管理</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
          >
            <span>📤</span> 匯出
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
          >
            <span>📥</span> 匯入
          </button>
          <button
            onClick={handleAddGearset}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2"
          >
            <span>➕</span> 新增配裝
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 配裝列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold">配裝列表</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {gearsets.map((gearset) => (
                <button
                  key={gearset.id}
                  onClick={() => setSelectedId(gearset.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    selectedId === gearset.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{getDisplayName(gearset)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {gearset.compatibleJobs.length === 8 ? (
                          '所有職業'
                        ) : (
                          gearset.compatibleJobs.map(j => JOB_NAMES[j]).join(', ')
                        )}
                      </div>
                    </div>
                    {gearset.id === selectedId && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 配裝編輯 */}
        <div className="lg:col-span-3">
          {selectedGearset && (
            <GearsetEditor
              gearset={selectedGearset}
              onUpdate={updateGearset}
              onUpdateAttributes={updateAttributes}
              onDelete={handleDeleteGearset}
              getDisplayName={getDisplayName}
            />
          )}
        </div>
      </div>

      {/* 匯入對話框 */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">匯入配裝資料</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="貼上 JSON 資料..."
              className="w-full h-48 px-3 py-2 border rounded-lg font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg"
              >
                匯入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface GearsetEditorProps {
  gearset: GearsetRow;
  onUpdate: (id: number, updates: Partial<Omit<GearsetRow, 'id'>>) => void;
  onUpdateAttributes: (id: number, attrs: Partial<GearsetRow['value']>) => void;
  onDelete: (id: number) => void;
  getDisplayName: (gearset: GearsetRow) => string;
}

function GearsetEditor({ gearset, onUpdate, onUpdateAttributes, onDelete, getDisplayName }: GearsetEditorProps) {
  const isDefault = gearset.id === 0;

  const handleJobToggle = (job: CraftJob) => {
    if (isDefault) return;
    
    const currentJobs = gearset.compatibleJobs;
    const newJobs = currentJobs.includes(job)
      ? currentJobs.filter(j => j !== job)
      : [...currentJobs, job];
    
    if (newJobs.length === 0) return; // 至少要有一個職業
    
    onUpdate(gearset.id, { compatibleJobs: newJobs });
  };

  const handleSelectAllJobs = () => {
    if (isDefault) return;
    onUpdate(gearset.id, { compatibleJobs: [...ALL_CRAFT_JOBS] });
  };

  const handleResetToDefault = () => {
    onUpdateAttributes(gearset.id, { ...DEFAULT_ATTRIBUTES });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 標題 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{getDisplayName(gearset)}</h2>
          {isDefault && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
              預設
            </span>
          )}
        </div>
        {!isDefault && (
          <button
            onClick={() => onDelete(gearset.id)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* 名稱 */}
        {!isDefault && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              配裝名稱
            </label>
            <input
              type="text"
              value={gearset.name || ''}
              onChange={(e) => onUpdate(gearset.id, { name: e.target.value })}
              placeholder={getDisplayName(gearset)}
              className="w-full max-w-xs px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
        )}

        {/* 適配職業 */}
        {!isDefault && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                適配職業
              </label>
              <button
                onClick={handleSelectAllJobs}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                全選
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CRAFT_JOBS.map((job) => (
                <button
                  key={job}
                  onClick={() => handleJobToggle(job)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    gearset.compatibleJobs.includes(job)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {JOB_NAMES[job]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 屬性設定 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              裝備屬性
            </label>
            <button
              onClick={handleResetToDefault}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              重置為預設
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">等級</label>
              <input
                type="number"
                value={gearset.value.level}
                onChange={(e) => onUpdateAttributes(gearset.id, { level: Math.max(1, Math.min(100, Number(e.target.value))) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">作業精度</label>
              <input
                type="number"
                value={gearset.value.craftsmanship}
                onChange={(e) => onUpdateAttributes(gearset.id, { craftsmanship: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">加工精度</label>
              <input
                type="number"
                value={gearset.value.control}
                onChange={(e) => onUpdateAttributes(gearset.id, { control: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">製作力 (CP)</label>
              <input
                type="number"
                value={gearset.value.cp}
                onChange={(e) => onUpdateAttributes(gearset.id, { cp: Math.max(0, Number(e.target.value)) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* 屬性預覽 */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
          <h4 className="font-medium mb-3">屬性預覽</h4>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{gearset.value.level}</div>
              <div className="text-xs text-gray-500">等級</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{gearset.value.craftsmanship}</div>
              <div className="text-xs text-gray-500">作業精度</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{gearset.value.control}</div>
              <div className="text-xs text-gray-500">加工精度</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{gearset.value.cp}</div>
              <div className="text-xs text-gray-500">製作力</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
