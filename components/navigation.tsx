'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '首頁', icon: '🏠' },
  { href: '/collection', label: '收集追蹤', icon: '📦' },
  { href: '/crafting', label: '生產指引', icon: '🔨' },
  { href: '/lists', label: '需求清單', icon: '📝' },
  { href: '/production', label: '生產紀錄', icon: '📋' },
  { href: '/gearsets', label: '配裝管理', icon: '👔' },
  // 模擬器功能已整合至生產指引頁面，移除獨立頁面入口
  // { href: '/simulator', label: '模擬器', icon: '⚙️' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400"
          >
            <span>⚔️</span>
            <span>FFXIV 助手</span>
          </Link>

          {/* 導航連結 */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                  ${pathname === item.href
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }
                `}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

// 側邊欄組件（用於詳細頁面）
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Sidebar({ isOpen, onClose, title, children, width = 'md' }: SidebarProps) {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* 側邊欄 */}
      <div 
        className={`
          fixed right-0 top-0 h-full w-full ${widthClasses[width]}
          bg-white dark:bg-gray-900 shadow-xl z-50 
          overflow-y-auto transform transition-transform
        `}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
