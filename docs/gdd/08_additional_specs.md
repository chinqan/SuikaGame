# 第 8 章：遊戲其他規格與設定

[← 返回目錄](00_index.md) | [← 上一章](07_audio_design.md)

---

## 8.1 視覺特效規格

### 8.1.1 合成粒子效果（Merge Particles）

每次成功合成觸發 3 種粒子同時噴出，以合成中點為原點：

| 粒子類型 | 數量公式 | 速度 | 衰減率 | 行為 |
|---------|---------|------|--------|------|
| **Ring** | 固定 1 | 擴張動畫 | 0.04/幀 | 從半徑 5px 漸擴至 `shape.radius × 3.5`px |
| **Shard** | `8 + level × 2` | 3~9 px/幀 | 0.012~0.027/幀 | 四方飛散、旋轉、縮小消失 |
| **Dot** | `16 + level × 3` | 2~9 px/幀 | 0.015~0.035/幀 | 四方飛散、受微重力影響 |

#### Ring（擴散圓環）

| 屬性 | 值 |
|------|-----|
| 起始半徑 | 5px |
| 最大半徑 | `shape.radius × 3.5`（level 越高圈越大） |
| 擴張速率 | `(maxRadius - radius) × 0.15` / 幀 |
| 透明度 | `life × 0.7` |
| 線寬 | 4px |
| Texture | RingTexture（對應顏色） |

#### Shard（碎片）

| 屬性 | 值 |
|------|-----|
| 縮放 | 0.32 ~ 0.58（隨機，逐幀 × life 衰減） |
| 旋轉 | ±0.3 rad/幀（隨機） |
| 重力 | vy += 0.08 / 幀 |
| Texture | 當前等級形狀的 ShapeTexture |

#### Dot（光點）

| 屬性 | 值 |
|------|-----|
| 大小 | 2~5px（縮放至 Dot Texture 的 sz/8） |
| 重力 | vy += 0.08 / 幀 |
| Texture | DotTexture（對應顏色） |

#### 粒子 Texture 繪製規格

| Texture | 繪製方式 | 基底尺寸 | 快取 Key |
|---------|---------|---------|---------|
| **DotTexture** | `circle(sz, sz, sz).fill(color)` | 16×16px（sz=8） | `colorHex` string |
| **RingTexture** | `circle(R+4, R+4, R).stroke(color, width=4, alpha=0.7)` | 22×22px（R=5） | `colorHex` string |
| **BubbleTexture** | 半透明 `fill(color, alpha=0.15)` + `stroke(color, width=1, alpha=0.2)` | `(radius+4)×2` px | `color_radius` string |
| **ShapeTexture** | `drawNeonShape()` 三層架構 | `(radius+16)×2` px | `level` number |

> 所有 Texture 使用 `app.renderer.generateTexture()` 程式生成，首次繪製後快取。

### 8.1.2 格線光流效果（Grid Flow）

#### 基本參數

| 參數 | 值 | 說明 |
|------|-----|------|
| 最大同時數量 | 20（GRID_FLOW_CONFIG.maxCount） | 限制 GPU 負擔 |
| 生成機率 | 0.06/幀（6%） | 每幀 6% 機率產生新光點 |
| 方向分布 | 60% 水平 / 40% 垂直 | 優先沿水平線流動 |
| 大小 | 8~18px（隨機） | Sprite scale = size / 32 |
| 亮度 | 0.7~1.0（隨機） | |
| 移動速度 | 0.001~0.003 t/幀 | t 從 0 到 1 代表路徑進度 |
| 初始 t | random() × 0.2 | 不從線頭開始，避免「擠在起點」 |
| BlendMode | `'add'`（加法混合） | 發光效果 |
| 閃爍 | `0.6 + 0.4 × sin(t × 40 + lineIdx × 7)` | 快速閃爍 |
| 消失曲線 | `brightness × max(0, 1 - |t-0.5| × 2.2) × flicker` | 中點最亮，兩端漸滅 |

#### lineIdx 選擇規則

| 方向 | lineIdx 範圍 | 說明 |
|------|-------------|------|
| 水平（60%） | 1 ~ hLines（1~8） | 對應透視地板的 8 條水平格線 |
| 垂直（40%） | 0 ~ vLines（0~10） | 對應透視地板的 11 條垂直格線（含左右邊界） |

> 光流嚴格沿著透視地板格線移動，不會出現在格線之外。

#### GridFlowData 結構

```typescript
interface GridFlowData {
  t: number;           // 路徑進度 0~1
  speed: number;       // 移動速度
  lineIdx: number;     // 所在格線索引
  isHorizontal: boolean; // 方向
  size: number;        // Sprite 大小
  brightness: number;  // 基礎亮度
  sprite: Sprite;      // 渲染物件（從 Pool 取得）
}
```

#### GlowTexture 繪製規格

光流 Sprite 使用程式生成的 GlowTexture（非外部圖片），**由外向內繪製**（後繪製的覆蓋先繪製的）：

| 繪製順序 | 半徑 | 顏色 | alpha | 說明 |
|---------|------|------|-------|------|
| 1（最先） | R=32px（100%） | `#00FFFF` | 0.08 | 最外層極淡光暈 |
| 2 | R×0.7=22.4px | `#00FFFF` | 0.18 | 中層擴散 |
| 3 | R×0.45=14.4px | `#88FFFF` | 0.45 | 內層亮光（偏白） |
| 4（最後） | R×0.25=8px | `#FFFFFF` | 1.0 | 核心白色亮點 |

- Texture 基底尺寸：**32×32px** → Sprite scale = `size / 32`
- 繪製方式：4 個 `g.circle().fill()`，由外到內，內層覆蓋外層
- 核心是**白色**（不是青色）——模擬高溫核心的能量白光
- `resolution = min(devicePixelRatio, 2)` 確保高清
- 生成一次後快取至 `_glowTexture`，不重複繪製

#### Game Over 時的行為

| 狀態 | 行為 | 氛圍意圖 |
|------|------|---------|
| 正常遊戲中 | 持續生成新光流 | 能量持續注入 |
| Game Over 後 | **停止生成新光流** | 能量供應中斷 |
| Game Over 後 | 已存在的光流繼續移動至消失 | 殘存能量逐漸耗散 |
| 重新開局 | clearAll() 清除所有光流 | 系統重啟 |

> **氛圍意圖**：Game Over 時光流停止生成，已有光流像「迴光返照」般慢慢消失，暗示能量系統正在崩潰。

#### 物件池規格

| 參數 | 值 |
|------|-----|
| Pool 類型 | `gridFlowSpritePool` |
| 預熱數量 | 20 |
| acquire() | visible=true, alpha=1 |
| release() | visible=false |
| 容器 | `layers.bg`（背景層） |

### 8.1.3 VFX 效能預算

| 指標 | 桌機 | 行動裝置 | 說明 |
|------|------|---------|------|
| 最大同時粒子數 | 500 | 200 | Ring + Shard + Dot 總計 |
| 最大同時格線光流 | 20 | 20 | GRID_FLOW_CONFIG.maxCount |
| Overdraw 層數 | 不限 | ≤ 3 | Additive Blend 粒子疊加 |
| 粒子 GPU 預算 | < 2ms/幀 | < 1ms/幀 | 含繪製 + 混合 |
| Additive Blend 佔比 | 不限 | < 50% | 格線光流為 Additive |
| Texture 記憶體 | 不限 | < 8MB | 形狀 + 粒子 Texture 總和 |

**效能保護機制**：
- 格線光流最大數量硬限制 20 個（`maxCount`）
- 粒子有 `life` 壽命衰減，自動回收（不會無限堆積）
- Object Pool 回收機制防止 GC 壓力

---

## 8.2 後端 API 規格

### 服務設定

| 項目 | 值 |
|------|-----|
| 框架 | Express.js |
| 端口 | 7860 |
| 監聽位址 | `0.0.0.0`（支援區網訪問） |
| 資料庫 | SQLite（better-sqlite3），WAL 模式 |
| 靜態檔案 | `dist/` 目錄（需先 `npm run build`） |

### API 端點

#### `POST /api/scores` — 提交分數

**Request Body：**
```json
{
  "player_id": "player1",
  "score": 1250,
  "difficulty": "hard",
  "play_time": 325
}
```

**Response（成功）：**
```json
{ "success": true }
```

**Response（失敗 400）：**
```json
{ "error": "Missing required fields" }
```

**伺服器行為**：
- 自動生成 `created_at` 為 `M/D HH:MM` 格式
- 使用 Prepared Statement 防止 SQL Injection

#### `GET /api/scores` — 取得排行榜

**Response：** Top 50 筆，按分數降序
```json
[
  {
    "player_id": "player1",
    "score": 1250,
    "difficulty": "hard",
    "play_time": 325,
    "created_at": "3/20 11:30"
  }
]
```

---

## 8.3 行動裝置相容性

### Viewport 設定

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### 觸控處理

| 處理 | 說明 |
|------|------|
| `touch-action: none` | CSS 禁用預設觸控手勢 |
| `passive: false` | touchmove/touchstart 可 preventDefault() |
| `-webkit-user-select: none` | 禁用文字選取 |
| DPR 限制 | `min(devicePixelRatio, 2)` 避免過高渲染負擔 |

### WebGPU → WebGL2 降級

- PixiJS 8 設定 `preference: 'webgpu'`
- iOS Safari 不支援 WebGPU 時自動降級為 WebGL2

---

## 8.4 系統邊界條件處理

| 條件 | 處理方式 |
|------|---------|
| 投放超出左牆 | Clamp 至 `GAME_INSET_X + shape.radius + 4` |
| 投放超出右牆 | Clamp 至 `canvasW - GAME_INSET_X - shape.radius - 4` |
| 最高等級形狀碰撞 | 得 80 分，不生成新形狀 |
| 投放冷卻中點擊 | 靜默忽略（`canDrop = false`） |
| 遊戲結束中點擊 | 靜默忽略（`isGameOver = true`） |
| 後端提交失敗 | `console.warn`，遊戲正常繼續 |
| 排行榜載入失敗 | 顯示紅色「無法連線伺服器」文字 |
| Player ID 為空 | 預設為 `'guest'` |
| Player ID 過長 | 截斷至 16 字元 |
| 難度切換 | 清除 Texture 快取並重建 |
| 同一對形狀重複碰撞 | `mergeCooldown Set` 防止同幀重複合成 |

---

## 8.5 關鍵常數速查

```typescript
// 設計解析度
DESIGN_W             = 546      // Canvas 寬度
DESIGN_H             = 779      // Canvas 高度

// 遊戲區域
GAME_INSET_X         = 35       // 左右內縮
FLOOR_AREA_H         = 70       // 地板佔用高度
WALL_THICKNESS       = 30       // 牆壁碰撞厚度
GAME_OVER_LINE_Y     = 55       // Game Over 判定線 Y

// 時間常數
DROP_COOLDOWN_MS     = 450      // 投放冷卻
COMBO_WINDOW_MS      = 1200     // 連擊窗口
GAME_OVER_DELAY_MS   = 1500     // Game Over 確認延遲

// 格線光流
GRID_FLOW_CONFIG.maxCount    = 20
GRID_FLOW_CONFIG.spawnChance = 0.06
```

---

[下一章：遊戲測試 →](09_testing.md)
