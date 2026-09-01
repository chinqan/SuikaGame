# Neon Shape Merge（Suika-type 物理合成遊戲）

霓虹風格的物理落下合成益智遊戲（類西瓜遊戲）。前端使用 PixiJS 8 渲染 + Matter.js 物理引擎，後端為 Express + better-sqlite3 排行榜 API。

## 常用指令

```bash
npm run dev      # Vite 開發伺服器（http://localhost:5173，/api 會 proxy 到 7860）
npm run build    # Vite 產出 dist/
npm run preview  # 預覽 build 結果
npm start        # 啟動 Express 伺服器（http://localhost:7860，serve dist/ + 排行榜 API）
npx tsc --noEmit # TypeScript 型別檢查（tsconfig 為 noEmit，僅檢查）
```

完整開發流程：需同時跑 `npm run dev`（前端）與 `npm start`（後端 API）；或先 `npm run build` 再 `npm start` 只跑單一伺服器。

## 架構

- `index.html` / `style.css` — 頁面外殼與 UI 樣式（HUD、覆蓋層為 DOM，遊戲畫面為 canvas）
- `src/index.ts` — 進入點；`src/game.ts` — 遊戲主迴圈與狀態機
- `src/core/` — 輸入處理（input.ts）、物件池（pool.ts）
- `src/data/` — 遊戲設定（config.ts：形狀等級、難度、分數）與型別（types.ts）
- `src/systems/` — 物理（physics.ts，Matter.js）、合成（merge.ts）、粒子（particles.ts）、瞄準線（aim-guide.ts）
- `src/rendering/` — PixiJS 圖層（layers.ts）、向量紋理（textures.ts）、視口縮放（viewport.ts）、設計系統（design-system.ts）
- `src/ui/` — HUD、排行榜、遊戲結束等覆蓋層
- `src/audio/` — Web Audio 音效
- `server.js` — Express 伺服器（port 7860）：serve `dist/`、`GET/POST /api/scores` 排行榜 API，資料存於 `leaderboard.db`（SQLite，WAL 模式）
- `game.js` — 舊版單檔實作（已被 `src/` 取代，勿修改）
- `docs/` — 遊戲設計文件（GDD）

路徑別名：`@/` 對應 `src/`（vite.config.ts 與 tsconfig.json 皆有設定）。

## Skills 與指令

- `.claude/skills/` — 遊戲開發專職 skills（game-designer、level-designer、pixi-vector-arcade、qa-tester 等），設計機制、平衡數值、PixiJS 渲染問題時使用
- `.claude/commands/` — GDD 撰寫工作流（`/write-gdd` 及各 phase 指令）

## 注意事項

- TypeScript strict 模式；tsconfig 為 `noEmit`，實際打包由 Vite 處理
- `leaderboard.db*` 為本機資料庫檔案，不要提交或覆蓋
- better-sqlite3 為原生模組，Node 版本更換後需 `npm rebuild better-sqlite3`
