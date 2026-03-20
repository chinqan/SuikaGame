# 第 6 章：遊戲流程設計

[← 返回目錄](00_index.md) | [← 上一章](05_ui_ux_design.md)

---

## 6.1 完整遊戲流程圖

```
啟動應用程式
  │
  ▼
遊戲初始化 (Game.init)
  │  • PixiJS App 建立 (WebGPU → WebGL2)
  │  • Texture 系統初始化
  │  • 建立所有 System：Physics / Merge / Particle / AimGuide / Audio
  │  • 建立所有 UI：HUD / OverlayManager
  │  • 繪製靜態背景（格線、牆壁 Glow、Game Over 線）
  │  • 綁定輸入事件
  │  • 綁定 UI 按鈕事件
  │  • 設定 Viewport 縮放
  │
  ▼
[模糊遮罩] 難度選擇畫面
  │  • Ticker 停止（無遊戲渲染）
  │  • 玩家輸入 ID + 選擇 EASY/NORMAL/HARD
  │
  ▼
選擇難度 (selectDifficulty)
  │  • 設定 shapes[] 與 maxDropLevel
  │  • 記錄 gameStartTime
  │  • 隱藏難度選擇 Overlay
  │
  ▼
遊戲開始 (startGame)
  │  • 清理上局殘留（Physics Bodies + Sprites + Particles）
  │  • 重設分數 = 0、canDrop = true、isGameOver = false
  │  • 建立 Matter.js 物理引擎（綁定碰撞回呼）
  │  • 隨機生成 currentLevel / nextLevel
  │  • 更新 HUD（NEXT 預覽 + Evolution Bar）
  │  • 隱藏模糊遮罩
  │  • 啟動 Ticker → 進入遊戲主循環
  │
  ▼
◀─────────── 遊戲主循環 (gameLoop, 每幀執行) ──────────
│              │
│              │  1. 更新粒子系統
│              │  2. 檢查 Game Over 條件
│              │  3. 套用畫面震動效果
│              │  4. 同步 Physics Body → Sprite 位置/旋轉
│              │  5. 更新瞄準導線位置
│              │
│   玩家點擊/觸控
│       │
│       ▼
│  handleDrop(x)
│    ├── 若 !canDrop || isGameOver → 忽略
│    ├── canDrop = false
│    ├── Clamp X 到牆壁安全範圍內
│    ├── 建立 Physics Body + Sprite + Bubble
│    ├── 播放投落音效
│    ├── currentLevel = nextLevel
│    ├── nextLevel = 隨機新等級
│    ├── 更新 NEXT 預覽
│    └── setTimeout(450ms) → canDrop = true
│       │
│       ▼
│  [Physics Engine 自動模擬 120Hz]
│       │
│       ▼
│  碰撞事件 (collisionStart)
│    │
│    ▼
│  MergeSystem.handleCollision
│    ├── 過濾：非 'shape' label → 跳過
│    ├── 過濾：不同等級 → 跳過
│    ├── 過濾：已在 mergeCooldown → 跳過
│    │
│    ├── 移除兩個舊 Body + Sprite + Bubble
│    ├── 生成新等級 Body + Sprite + Bubble（中點位置）
│    ├── 新 Body 隨機上噴速度
│    │
│    ├── 計分：score += shapes[newLevel].score
│    ├── COMBO 計數 +1
│    ├── 產生浮動分數文字
│    ├── 若 COMBO ≥ 2 → 產生 COMBO 提示
│    ├── 產生合成粒子（Ring + Shard + Dot）
│    ├── 播放合成音效
│    └── 觸發畫面震動
│       │
└───────┘
  │
  ▼ (Game Over 觸發)
  │
遊戲結束 (triggerGameOver)
  │  • 停止 Ticker + 物理引擎
  │  • 顯示模糊遮罩（截圖 → 模糊 → 暗化）
  │  • 清理所有 Body / Sprite / Particle
  │  • 更新本機最高分（localStorage）
  │  • 顯示 Game Over Overlay
  │  • 提交分數到後端 API
  │
  ▼
玩家點擊「再來一局」
  │  • 隱藏 Game Over Overlay
  │  • 顯示難度選擇畫面
  │
  ▼
（回到難度選擇畫面，循環）
```

---

## 6.2 Game Over 判定機制

### 三重條件

| # | 條件 | 說明 |
|---|------|------|
| 1 | `body.position.y < GAME_OVER_LINE_Y (55)` | 形狀超出判定線 |
| 2 | `bodyLevelMap.has(body.id)` | 該 body 是遊戲形狀（非牆壁） |
| 3 | `body.speed < 1.5` | 形狀已趨於靜止 |

### 延遲機制

| 參數 | 值 | 說明 |
|------|-----|------|
| GAME_OVER_DELAY_MS | 1500ms | 持續越線 1.5 秒後觸發 |

### 狀態機

```
正常遊戲 ──(越線 + 靜止)──→ 倒計時中 ──(1500ms 未解除)──→ Game Over
           ↑                    │
           └──(形狀離開/合成)──←─┘（取消倒計時）
```

- **設計意圖**：給玩家 1.5 秒緩衝「救場」時間
- **取消條件**：所有形狀都在判定線以下 → clearTimeout

---

## 6.3 連擊（COMBO）系統

| 規則 | 說明 |
|------|------|
| 連擊窗口 | COMBO_WINDOW_MS = 1200ms |
| 計數觸發 | 每次合成 comboCount++ |
| 重置條件 | 1200ms 內無新合成 → comboCount = 0 |
| 顯示條件 | comboCount ≥ 2 |

### COMBO 對遊戲的影響

| 影響 | 公式 |
|------|------|
| COMBO 提示字型大小 | `28 + comboCount × 4` px |
| COMBO 提示上飄速度 | `vy = -4.5 - comboCount × 0.3` |
| 畫面震動增量 | `+comboCount × 0.5` |

> **注意**：COMBO 不影響實際得分，僅影響視覺回饋強度。

---

## 6.4 投放機制

### 投放 X 座標 Clamp

```
clampedX = clamp(
  GAME_INSET_X + shape.radius + 4,    // 左邊界
  canvasW - GAME_INSET_X - shape.radius - 4,  // 右邊界
  dropX  // 玩家指標位置
)
```

### 投放 Y 起始位置

- 所有形狀從 `y = -shape.radius` 開始（在畫面上方外），自然落進容器

### 形狀輪替流程

```
投放 currentLevel 形狀
  ↓
currentLevel = nextLevel
  ↓
nextLevel = random(0 ~ maxDropLevel)
  ↓
更新 NEXT 預覽顯示
```

---

[下一章：遊戲音樂音效設計 →](07_audio_design.md)
