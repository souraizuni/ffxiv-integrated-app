import type { NextConfig } from "next";

// 判斷是否為 GitHub Pages 部署
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoName = 'ffxiv-integrated-app';

const nextConfig: NextConfig = {
  // 靜態輸出設定
  output: 'export',
  
  // GitHub Pages 需要 basePath（因為部署在 /repo-name/ 路徑下）
  basePath: isGitHubPages ? `/${repoName}` : '',
  assetPrefix: isGitHubPages ? `/${repoName}/` : '',
  
  // 禁用圖片優化（靜態輸出不支援）
  images: {
    unoptimized: true,
  },
  
  // 生成 trailing slash
  trailingSlash: true,

  // 在開發模式下允許來自 proxy 的 dev 資源請求
  // allowedDevOrigins 用來允許像是 service.cangle.xyz 對 /_next/* 的請求（防止 dev 模式下的跨域警告）
  allowedDevOrigins: ['https://service.cangle.xyz','http://service.cangle.xyz'],

  // 啟用 WASM 支援 (Webpack)
  webpack: (config, { isServer }) => {
    // 啟用 WebAssembly 實驗性功能
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // 處理 WASM 檔案
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // 在伺服器端忽略 WASM 檔案（僅用於客戶端）
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@/lib/wasm/app_wasm': 'commonjs @/lib/wasm/app_wasm',
      });
    }

    return config;
  },

  // Turbopack 設定（Next.js 16 預設使用 Turbopack）
  turbopack: {
    // 解析 .wasm 檔案
    resolveExtensions: ['.wasm', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
};

export default nextConfig;
