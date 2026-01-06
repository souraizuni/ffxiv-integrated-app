import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero 區塊 */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
          FFXIV 綜合助手
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          整合收集追蹤、材料指引、生產模擬器 — 一站式的 Final Fantasy XIV 遊戲輔助平台
        </p>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 收集追蹤 */}
        <FeatureCard
          href="/collection"
          icon="📦"
          title="收集追蹤"
          description="追蹤您的坐騎、寵物、幻化裝備等收集進度，輕鬆管理您的收藏。"
          color="green"
        />

        {/* 生產指引 */}
        <FeatureCard
          href="/crafting"
          icon="🔨"
          title="生產指引"
          description="自動拆解材料樹，顯示您需要的所有基礎材料與中間製品。"
          color="blue"
        />

        {/* 生產模擬器 */}
        <FeatureCard
          href="/simulator"
          icon="⚙️"
          title="生產模擬器"
          description="模擬生產過程，測試最佳技能組合，確保 HQ 成功率。"
          color="purple"
        />

        {/* 市場查詢 */}
        <FeatureCard
          href="/market"
          icon="💰"
          title="市場價格"
          description="查詢市場價格，比較各伺服器的物品售價，找到最佳交易機會。"
          color="amber"
        />

        {/* 製作清單 */}
        <FeatureCard
          href="/crafting/lists"
          icon="📋"
          title="製作清單"
          description="建立並管理您的製作清單，追蹤材料準備進度。"
          color="cyan"
        />

        {/* 設定 */}
        <FeatureCard
          href="/settings"
          icon="⚙️"
          title="設定"
          description="設定您的角色資訊、伺服器偏好和生產職業屬性。"
          color="gray"
        />
      </div>

      {/* 快速開始 */}
      <div className="mt-16 p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center">快速開始</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">1️⃣</span>
            </div>
            <h3 className="font-semibold mb-2">搜尋物品</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              在生產指引頁面搜尋您想製作的物品
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">2️⃣</span>
            </div>
            <h3 className="font-semibold mb-2">查看材料</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              系統會自動拆解所有需要的材料
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">3️⃣</span>
            </div>
            <h3 className="font-semibold mb-2">開始製作</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              使用模擬器測試技能組合，確保成功
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>
          本平台為玩家製作的第三方工具，與 Square Enix 無關。
        </p>
        <p className="mt-2">
          遊戲資料來自{' '}
          <a
            href="https://xivapi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            XIVAPI
          </a>
          {' '}與{' '}
          <a
            href="https://universalis.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Universalis
          </a>
        </p>
      </footer>
    </div>
  );
}

// 功能卡片組件
interface FeatureCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  color: 'green' | 'blue' | 'purple' | 'amber' | 'cyan' | 'gray';
}

function FeatureCard({ href, icon, title, description, color }: FeatureCardProps) {
  const colorClasses = {
    green: 'border-green-200 hover:border-green-400 dark:border-green-800',
    blue: 'border-blue-200 hover:border-blue-400 dark:border-blue-800',
    purple: 'border-purple-200 hover:border-purple-400 dark:border-purple-800',
    amber: 'border-amber-200 hover:border-amber-400 dark:border-amber-800',
    cyan: 'border-cyan-200 hover:border-cyan-400 dark:border-cyan-800',
    gray: 'border-gray-200 hover:border-gray-400 dark:border-gray-800',
  };

  const iconBgClasses = {
    green: 'bg-green-100 dark:bg-green-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    amber: 'bg-amber-100 dark:bg-amber-900/30',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30',
    gray: 'bg-gray-100 dark:bg-gray-800',
  };

  return (
    <Link
      href={href}
      className={`
        block p-6 bg-white dark:bg-gray-900 rounded-xl border-2 transition-all
        hover:shadow-lg hover:-translate-y-1
        ${colorClasses[color]}
      `}
    >
      <div
        className={`
          w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4
          ${iconBgClasses[color]}
        `}
      >
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </Link>
  );
}
