'use client';

import { useState, useEffect } from 'react';
import type { CrafterStats, CraftJob } from '@/types';
import { CraftJobNames } from '@/types';
import { useAuth } from '@/hooks/use-auth';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'crafter' | 'display'>('profile');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dataSize, setDataSize] = useState<string>('計算中...');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // 認證狀態
  const { user, isLoading: isAuthLoading, isLoggedIn, login, logout } = useAuth();
  
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

  // 計算資料大小
  useEffect(() => {
    if (!isLoggedIn) {
      setDataSize('未登入');
      setLastSyncTime(null);
      return;
    }

    // 計算 localStorage 資料大小
    let totalSize = 0;
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += key.length + item.length;
      }
    }

    // 轉換為 KB
    const sizeKB = (totalSize / 1024).toFixed(2);
    setDataSize(`${sizeKB} KB`);

    // 從 localStorage 取得最後同步時間
    const lastSync = localStorage.getItem('ffxiv-last-sync');
    if (lastSync) {
      setLastSyncTime(new Date(lastSync));
    }
  }, [isLoggedIn]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('登出失敗:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
      // 更新最後同步時間
      localStorage.setItem('ffxiv-last-sync', new Date().toISOString());
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('登入失敗:', error);
    }
  };

  const handleSave = () => {
    // 儲存到 localStorage
    const settings = {
      crafterStats,
      theme,
      language,
    };
    localStorage.setItem('ffxiv-settings', JSON.stringify(settings));
    // 更新同步時間
    localStorage.setItem('ffxiv-last-sync', new Date().toISOString());
    setLastSyncTime(new Date());
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
          {isAuthLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-gray-500">載入認證資訊...</p>
            </div>
          ) : isLoggedIn && user ? (
            <>
              {/* 使用者資訊卡片 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || user.email || '使用者'}
                        className="w-16 h-16 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                        {(user.displayName || user.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {user.displayName || user.email || '使用者'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        帳號已驗證 ✓
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoggingOut ? '登出中...' : '登出'}
                  </button>
                </div>
              </div>

              {/* 資料統計 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">💾 使用資料大小</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{dataSize}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">🔄 最後同步</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {lastSyncTime ? (
                      <div>
                        <div>{lastSyncTime.toLocaleDateString('zh-TW')}</div>
                        <div className="text-sm font-normal text-gray-500">
                          {lastSyncTime.toLocaleTimeString('zh-TW')}
                        </div>
                      </div>
                    ) : (
                      '未同步'
                    )}
                  </div>
                </div>
              </div>

              {/* 帳號資訊 */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">帳號資訊</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">登入方式</span>
                    <span className="font-medium text-gray-900 dark:text-white">Google 帳號</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">驗證狀態</span>
                    <span className="font-medium text-green-600 dark:text-green-400">已驗證</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">帳號 ID</span>
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {user.uid}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  💡 提示：登入後，您的配裝、收集清單和設定會自動同步到雲端，可跨設備使用。
                </p>
              </div>
            </>
          ) : (
            <>
              {/* 未登入狀態 */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-8 text-center border border-amber-200 dark:border-amber-800">
                <div className="text-5xl mb-4">🔐</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  您尚未登入
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  登入後可以同步您的配裝、收集清單等資料到雲端，跨設備使用。
                </p>
                <button
                  onClick={handleLogin}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  使用 Google 登入
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  本應用使用 Firebase Authentication，您的登入資料由 Google 安全管理。
                </p>
              </div>
            </>
          )}
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
