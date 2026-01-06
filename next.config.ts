import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

  // 輸出設定
  output: 'standalone',
};

export default nextConfig;
