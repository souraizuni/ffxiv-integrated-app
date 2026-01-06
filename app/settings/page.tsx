'use client';

import { useState } from 'react';
import type { CrafterStats, CraftJob } from '@/types';
import { CraftJobNames } from '@/types';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'crafter' | 'display'>('profile');
  
  // 伺服器設定
  const [server, setServer] = useState('Tonberry');
  const [dataCenter, setDataCenter] = useState('Elemental');
  
  // 製作者屬性
  const [crafterStats, setCrafterStats] = useState<CrafterStats>({
    job: 'CRP',
    level: 90,
    craftsmanship: 3500,
    control: 3500,
    cp: 600,
    specialist: false,
  });
  
  // 顯示設定
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [language, setLanguage] = useState('zh-TW');

  // Data Center 與伺服器列表
  const dataCenters = {
    'Elemental': ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'],
    'Gaia': ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'],
    'Mana': ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'],
    'Meteor': ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'],
  };

  const handleSave = () => {
    // 儲存到 localStorage
    const settings = {
      server,
      dataCenter,
      crafterStats,
      theme,
      language,
    };
    localStorage.setItem('ffxiv-settings', JSON.stringify(settings));
    alert('設定已儲存！');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">設定</h1>

      {/* 分頁選項 */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'profile', label: '個人資料', icon: '👤' },
          { id: 'crafter', label: '製作者屬性', icon: '🔨' },
          { id: 'display', label: '顯示設定', icon: '🎨' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`
              px-4 py-3 font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 個人資料設定 */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Center
            </label>
            <select
              value={dataCenter}
              onChange={(e) => {
                setDataCenter(e.target.value);
                const servers = dataCenters[e.target.value as keyof typeof dataCenters];
                if (servers && !servers.includes(server)) {
                  setServer(servers[0]);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
            >
              {Object.keys(dataCenters).map((dc) => (
                <option key={dc} value={dc}>{dc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              伺服器
            </label>
            <select
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
            >
              {dataCenters[dataCenter as keyof typeof dataCenters]?.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              這些設定會用於市場價格查詢的預設伺服器。
            </p>
          </div>
        </div>
      )}

      {/* 製作者屬性設定 */}
      {activeTab === 'crafter' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              預設職業
            </label>
            <select
              value={crafterStats.job}
              onChange={(e) =>
                setCrafterStats({ ...crafterStats, job: e.target.value as CraftJob })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
            >
              {Object.entries(CraftJobNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                等級
              </label>
              <input
                type="number"
                value={crafterStats.level}
                onChange={(e) =>
                  setCrafterStats({ ...crafterStats, level: parseInt(e.target.value) || 1 })
                }
                min={1}
                max={100}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                製作力 (CP)
              </label>
              <input
                type="number"
                value={crafterStats.cp}
                onChange={(e) =>
                  setCrafterStats({ ...crafterStats, cp: parseInt(e.target.value) || 0 })
                }
                min={0}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                作業精度
              </label>
              <input
                type="number"
                value={crafterStats.craftsmanship}
                onChange={(e) =>
                  setCrafterStats({ ...crafterStats, craftsmanship: parseInt(e.target.value) || 0 })
                }
                min={0}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                加工精度
              </label>
              <input
                type="number"
                value={crafterStats.control}
                onChange={(e) =>
                  setCrafterStats({ ...crafterStats, control: parseInt(e.target.value) || 0 })
                }
                min={0}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="specialist"
              checked={crafterStats.specialist}
              onChange={(e) =>
                setCrafterStats({ ...crafterStats, specialist: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="specialist" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              專家
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              這些數值會在生產模擬器中作為預設值使用。
            </p>
          </div>
        </div>
      )}

      {/* 顯示設定 */}
      {activeTab === 'display' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              主題
            </label>
            <div className="flex gap-4">
              {[
                { value: 'light', label: '淺色', icon: '☀️' },
                { value: 'dark', label: '深色', icon: '🌙' },
                { value: 'system', label: '跟隨系統', icon: '💻' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value as typeof theme)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors
                    ${theme === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              語言
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>
      )}

      {/* 儲存按鈕 */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          儲存設定
        </button>
      </div>
    </div>
  );
}
