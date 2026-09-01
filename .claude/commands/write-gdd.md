---
description: 撰寫物理落下益智遊戲（Suika-type）的完整遊戲規格書（GDD）
---

# 撰寫 Suika-type 遊戲規格書 Workflow

> **適用場景**：給定一個類似 Suika 的物理落下益智遊戲，需要產出涵蓋全面的 GDD。
> **產出目標**：多檔案結構的 GDD（`docs/gdd/`），足以讓程式架構師理解並實作。

---

## 前置準備

1. **確認遊戲定位** — 向用戶確認：
   - 遊戲的核心玩法一句話描述
   - 目標平台（Web / Mobile / Desktop）
   - 風格方向（寫實 / 卡通 / 賽博龐克…）
   - 是否有參考遊戲

2. **讀取 Agent Skills** — 開始前讀取所有 7 個 Skills 了解品質標準：
   ```
   .agents/skills/game-designer/SKILL.md
   .agents/skills/level-designer/SKILL.md
   .agents/skills/art-style-director/SKILL.md
   .agents/skills/ui-ux-designer/SKILL.md
   .agents/skills/audio-engineer/SKILL.md
   .agents/skills/technical-artist/SKILL.md
   .agents/skills/qa-tester/SKILL.md
   ```

3. **建立 GDD 目錄結構**：
   ```
   docs/gdd/
   ├── 00_index.md
   ├── 01_game_overview.md
   ├── 02_scene_and_level_design.md
   ├── 03_technical_foundation.md
   ├── 04_art_style_and_narrative.md
   ├── 05_ui_ux_design.md
   ├── 06_game_flow.md
   ├── 07_audio_design.md
   ├── 08_additional_specs.md
   └── 09_testing.md
   ```

---

## 執行流程

### Phase 1：核心設計
**→ 執行 sub-workflow：`/gdd-phase1-core-design`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| game-designer | `01_game_overview.md` | 7 Steps：設計支柱 → 核心循環 → 玩家輪廓 → 情感弧線 → 合成規格 → 難度平衡 → 得分經濟 |

---

### Phase 2：空間與關卡設計
**→ 執行 sub-workflow：`/gdd-phase2-level-design`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| level-designer | `02_scene_and_level_design.md` | 6 Steps：設計解析度 → 牆壁設定 → 圖層系統 → 難度精確規格 → 進化系統 → 數值平衡分析 |

---

### Phase 3：技術架構
**→ 執行 sub-workflow：`/gdd-phase3-technical`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| technical-artist | `03_technical_foundation.md` | 8 Steps：架構圖 → 物理引擎 → 渲染初始化 → Texture 快取 → Object Pool → 輸入系統 → 持久化 → 建構部署 |

---

### Phase 4：視覺風格
**→ 執行 sub-workflow：`/gdd-phase4-art-style`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| art-style-director | `04_art_style_and_narrative.md` | 5 Steps：風格定義 → 配色系統 → 形狀繪製 → 環境場景 → 隱性世界觀 |

---

### Phase 5：UI/UX 設計
**→ 執行 sub-workflow：`/gdd-phase5-ui-ux`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| ui-ux-designer | `05_ui_ux_design.md` | 7 Steps：UI 架構 → Design Token → HUD → Overlay → 回饋系統 → Viewport → 無障礙 |

---

### Phase 6-7：遊戲流程與音效
**→ 執行 sub-workflow：`/gdd-phase6-7-flow-audio`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| game-designer + level-designer | `06_game_flow.md` | 5 Steps：初始化 → 主循環 → 合成流程 → Game Over → 重置 |
| audio-engineer | `07_audio_design.md` | 4 Steps：Sonic Identity → 合成音效 → 音效包 → Voice Budget |

---

### Phase 8-10：特效規格、測試、驗收
**→ 執行 sub-workflow：`/gdd-phase8-10-specs-test-verify`**

| 調用 Skill | 產出 | Steps |
|-----------|------|-------|
| technical-artist + art-style-director | `08_additional_specs.md` | 3 Steps：粒子效果 → 環境特效 → 效能預算 |
| qa-tester | `09_testing.md` | 7 Steps：玩法測試 → 難度測試 → UI 測試 → 效能 → 跨平台 → 邊界 → GDD 一致性 |
| 全部 | `00_index.md` | 3 Steps：目錄索引 → 跨章節一致性 → 最終驗收 |

---

## 驗收標準

完成後的 GDD 必須滿足：

1. ✅ **架構師可理解** — 任何工程師讀完能獨立實作
2. ✅ **設計意圖透明** — 每個「是什麼」都附帶「為什麼」
3. ✅ **數值精確** — 公式完整、建議標註程式碼常數名
4. ✅ **跨章節一致** — 同一數值在不同章節的描述一致
5. ✅ **可測試** — 每項規格在 09 有對應的驗收標準
