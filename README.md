# 🛠️ FFXIV Integrated Assistant

一站式的 Final Fantasy XIV 遊戲輔助平台，整合收集追蹤、材料指引、生產模擬器等功能。

## ✨ 功能特色

- **📦 收集追蹤** - 追蹤坐騎、寵物、幻化裝備等收集進度
- **🔨 生產指引** - 自動拆解材料樹，顯示所有需要的基礎材料
- **⚙️ 生產模擬器** - 模擬生產過程，測試最佳技能組合
- **💰 市場價格** - 查詢各伺服器的即時市場價格
- **📋 製作清單** - 建立並管理製作清單

## 🚀 快速開始

### 環境需求

- Node.js 18.17 或更高版本
- npm、yarn 或 pnpm

### 安裝步驟

1. **複製專案**
   ```bash
   git clone https://github.com/your-username/ffxiv-integrated-app.git
   cd ffxiv-integrated-app
   ```

2. **安裝相依套件**
   ```bash
   npm install
   ```

3. **設定環境變數**
   ```bash
   cp .env.example .env.local
   ```
   編輯 `.env.local` 填入您的 Supabase 設定

4. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

5. 開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 📁 專案結構

```
/ffxiv-integrated-app
├── /app                    # Next.js App Router 頁面
│   ├── /api               # API Routes
│   ├── /collection        # 收集追蹤頁面
│   ├── /crafting          # 生產指引頁面
│   ├── /market            # 市場價格頁面
│   └── /simulator         # 生產模擬器頁面
├── /components            # 共用 UI 組件
├── /hooks                 # 自訂 React Hooks
├── /lib                   # 核心邏輯層
│   ├── /simulator         # 生產模擬計算引擎
│   ├── /recipe-tree       # 材料樹遞歸拆解
│   └── /supabase          # 資料庫連接
├── /types                 # TypeScript 類型定義
└── /supabase              # 資料庫 Schema
```

## 🗄️ 資料庫設定

本專案使用 [Supabase](https://supabase.com) 作為後端資料庫。

### 設定步驟

1. 前往 [Supabase](https://supabase.com) 建立免費帳號
2. 建立新專案
3. 在 SQL Editor 中執行 `supabase/schema.sql` 建立資料表
4. 複製專案的 URL 和 anon key 到 `.env.local`

## 🌐 外部 API

本專案使用以下外部 API：

- **[XIVAPI](https://xivapi.com)** - 遊戲物品、配方資料
- **[Universalis](https://universalis.app)** - 市場價格資料

這些 API 都是免費使用的，但有頻率限制。

## 🚢 部署

### Vercel 部署（推薦）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ffxiv-integrated-app)

1. Fork 此專案
2. 在 Vercel 建立新專案並連接 GitHub
3. 設定環境變數
4. 部署！

### 其他平台

專案也可以部署到任何支援 Next.js 的平台：
- Netlify
- Railway
- Render

## 📊 免費額度管理

為維持免費運作，請注意：

- **Supabase**: 免費層 500MB 資料庫空間
- **Vercel**: 免費層每月 100GB 頻寬
- **XIVAPI**: 公開 API 有頻率限制

### 最佳實踐

1. 將複雜運算放在客戶端執行
2. 使用 JSONB 儲存複雜資料減少 Table 數量
3. 圖片直接引用 XIVAPI 的圖片網址

## 🛠️ 技術棧

- **框架**: Next.js 14+ (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **資料庫**: Supabase (PostgreSQL)
- **狀態管理**: Zustand + SWR
- **部署**: Vercel

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## ⚠️ 免責聲明

本平台為玩家製作的第三方工具，與 Square Enix 無關。
FINAL FANTASY 是 Square Enix Holdings Co., Ltd. 的註冊商標。
