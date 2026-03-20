# 第 3 章：遊戲基礎建設

[← 返回目錄](00_index.md) | [← 上一章](02_scene_and_level_design.md)

---

## 3.1 技術架構

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (Browser)                       │
│  index.html ── HTML UI 結構（HUD / Overlay / Settings）    │
│  style.css  ── 全域樣式（742 行）                          │
│                                                           │
│  PixiJS 8 Application (WebGPU 優先 / WebGL2 降級)           │
│  ├── Game          主控制器              (src/game.ts)      │
│  ├── InputManager  滑鼠/觸控輸入         (src/core/input.ts)│
│  ├── PhysicsSystem Matter.js 物理封裝    (src/systems/physics.ts)│
│  ├── MergeSystem   碰撞合成邏輯          (src/systems/merge.ts)│
│  ├── ParticleSystem 粒子/浮字/格線光流    (src/systems/particles.ts)│
│  ├── AimGuide      瞄準線+幽靈預覽       (src/systems/aim-guide.ts)│
│  ├── AudioManager  8 種程式合成音效      (src/audio/audio.ts)│
│  ├── HUD           分數/NEXT/Evolution   (src/ui/hud.ts)│
│  ├── OverlayManager 所有 Overlay 視窗    (src/ui/overlays.ts)│
│  └── Rendering     Texture/Layer/Viewport (src/rendering/) │
│                                                           │
│  Vite ── 開發伺服器 + TypeScript 編譯 + 生產打包            │
└─────────────────────────────────────────────────────────┘
                       HTTP API
┌─────────────────────────────────────────────────────────┐
│                      後端 (Node.js)                       │
│  server.js ── Express HTTP 伺服器 (Port 7860)              │
│  ├── POST /api/scores   提交分數                           │
│  └── GET  /api/scores   取得 Top 50 排行榜                 │
│                                                           │
│  leaderboard.db ── SQLite 資料庫 (WAL 模式)                │
└─────────────────────────────────────────────────────────┘
```

---

## 3.2 物理引擎

**引擎**：Matter.js  
**更新頻率**：120 Hz（`runnerDelta = 1000/120` ms）

### 引擎參數

| 參數 | 數值 | 說明 |
|------|------|------|
| gravity.x | 0 | 無水平重力 |
| gravity.y | 2.2 | 較強垂直重力（快速沈降） |
| positionIterations | 12 | 位置修正精確度（高） |
| velocityIterations | 10 | 速度修正精確度 |
| constraintIterations | 4 | 約束修正次數 |

### 形狀 Body 物理屬性

| 屬性 | 數值 | 說明 |
|------|------|------|
| restitution | 0.15 | 碰撞恢復係數（略微彈跳） |
| friction | 0.6 | 動態摩擦力 |
| frictionStatic | 0.8 | 靜摩擦力（穩定堆疊） |
| baseDensity | 0.0015 | 基礎密度（小形狀輕） |
| densityPerLevel | 0.0004 | 每升一級增加密度（大形狀重） |
| slop | 0.005 | 允許微小穿透（避免休息態抖動） |

### 牆壁 Body 物理屬性

| 屬性 | 數值 |
|------|------|
| isStatic | true |
| friction | 1.0 |
| restitution | 0.1 |
| frictionStatic | 1.0 |

### 碰撞體設計

- **重要設計決策**：所有形狀（含多邊形）一律使用**圓形碰撞體**（`Bodies.circle`）
- **碰撞半徑**：`shape.radius + 3` px（略大於視覺半徑，提供容錯空間）
- **Body label**：固定為 `'shape'`（區分遊戲形狀與牆壁）
- **設計理由**：簡化物理計算、避免多邊形卡角問題、降低 CPU 負擔

---

## 3.3 渲染系統

### PixiJS 初始化設定

| 參數 | 值 | 說明 |
|------|-----|------|
| width | 546 | 設計寬度 |
| height | 779 | 設計高度 |
| backgroundColor | `0x0a0a0f` | 近黑深藍 |
| antialias | true | 抗鋸齒 |
| resolution | `min(devicePixelRatio, 2)` | 限制最高 2× |
| autoDensity | true | 自動密度適配 |
| powerPreference | `'high-performance'` | 要求高效能 GPU |
| preference | `'webgpu'` | 優先 WebGPU |
| clearBeforeRender | true | 每幀清除 |

### Texture 快取策略

| Texture 類型 | 快取 Key | 清除時機 |
|-------------|---------|---------|
| 形狀 Texture | `level` (number) | 切換難度時全部清除重建 |
| Dot 粒子 | `colorHex` (string) | 手動清除 |
| Ring 粒子 | `colorHex` (string) | 手動清除 |
| Bubble（氣泡） | `color_radius` (string) | 手動清除 |
| Glow（光暈） | 全域單例 | 手動清除 |

---

## 3.4 Object Pool（物件池）

使用通用物件池減少 Garbage Collection 壓力：

| 池 | 物件類型 | 用途 |
|----|---------|------|
| `floatingTextPool` | PixiJS Text | 浮動分數 / COMBO 文字（頻繁生成銷毀） |
| `gridFlowSpritePool` | PixiJS Sprite | 格線光流粒子（持續生成銷毀） |

**Pool 行為**：
- `acquire()`：從池中取出已回收的物件，若無則建立新的
- `release(obj)`：回收物件、設為不可見
- `drain(destroyFn)`：遊戲結束時銷毀全部

---

## 3.5 輸入系統

### 支援輸入方式

| 平台 | 移動準心 | 觸發投放 |
|------|---------|---------|
| 桌機 | `mousemove` | `mousedown` |
| 行動裝置 | `touchmove`（passive: false） | `touchstart`（passive: false） |

### 座標轉換

```
gameX = (clientX - canvas.rect.left) × (DESIGN_W / canvas.rect.width)
```

- 根據 Canvas 的 `getBoundingClientRect()` 動態計算
- 支援畫面縮放後的正確座標映射

### 投放冷卻

- **DROP_COOLDOWN_MS = 450ms**
- 投放後鎖定 `canDrop = false`，450ms 後恢復

---

## 3.6 資料持久化

### 前端 localStorage

| Key | 型別 | 說明 |
|-----|------|------|
| `neonMergeHigh` | string (number) | 本機最高分 |
| `neonMergePlayerId` | string | 玩家 ID（最多 16 字元） |
| `neonMergeSoundType` | string | 音效偏好類型 |

### 後端 SQLite

**資料庫**：`leaderboard.db`（WAL 模式，提升並發讀寫效能）

**`scores` 資料表結構：**

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | INTEGER (PK, AUTO) | 自增主鍵 |
| player_id | TEXT NOT NULL | 玩家識別碼 |
| score | INTEGER NOT NULL | 得分 |
| difficulty | TEXT NOT NULL | 難度（easy/normal/hard） |
| play_time | INTEGER NOT NULL | 遊戲時長（秒） |
| created_at | TEXT NOT NULL | 記錄時間（M/D HH:MM 格式） |

---

## 3.7 建構與部署

| 指令 | 用途 |
|------|------|
| `npm run dev` | Vite 開發伺服器（Hot Reload） |
| `npm run build` | 生產打包（輸出至 `dist/`） |
| `node server.js` | 啟動生產伺服器（Port 7860） |

**Path Alias**：`@/` → `./src`（Vite + TypeScript 路徑別名）

---

[下一章：遊戲風格與故事設計 →](04_art_style_and_narrative.md)
