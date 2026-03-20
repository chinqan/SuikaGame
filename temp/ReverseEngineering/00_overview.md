# 逆向工程教學：從程式碼到遊戲規格書到自動化開發流程

> **適用對象**：想要從一個「已完成的遊戲專案」出發，建立可複用的開發標準流程的開發者。
> **最終產出**：GDD（遊戲規格書） + Agent Skills（職能方法論） + Workflow（自動化撰寫流程）

---

## 本教學的經驗來源

這份教學文件並非憑空設計，而是從一次**完整的逆向工程實戰**中提煉而來。
在實戰過程中，我們遇到了大量的陷阱、走過不少彎路，最終歸納出可重複使用的方法論。

以下是實戰中發現的**關鍵教訓**，已融入各階段的步驟和提示詞中：

| 階段 | 踩過的坑 | 修正後的做法 |
|------|---------|------------|
| **GDD 逆向** | Texture 繪製順序沒記錄，導致視覺無法還原 | 每個程式生成 Texture 必須記錄繪製順序（由外到內 or 由內到外） |
| **GDD 逆向** | 難度系統只寫「形狀種類」，實際上有兩個獨立參數軸 | 必須分析完整的配置結構，區分每個獨立維度 |
| **GDD 逆向** | 公式模糊帶過，寫「有震動」而非完整公式 | 所有公式必須完整記錄，包括每個變數的影響 |
| **GDD 逆向** | 環境氛圍元素（極淡背景、微格線）被忽略 | 「感覺不到但不能沒有」的元素也要規格化 |
| **Skills** | 第一版 Skills 充滿硬編碼數值（gravity=2.2），變成逆向工程文件 | Skills 是方法論，用範例舉例，不強制數值 |
| **Skills** | Critical Rules 寫成「必須設為某值」，限制了創意空間 | 改為品質標準：「必須記錄完整」，而非「必須等於某值」 |
| **Workflow** | 沒有 Sub-workflow，Phase 太粗糙，容易遺漏細節 | 每個 Phase 拆為獨立的 Sub-workflow，每步有檢查點 |

大多數遊戲專案在開發完成後，知識散落在程式碼的各個角落——常數定義、碰撞邏輯、渲染管線、UI 互動。
這份教學帶你透過 **3 個階段**，將這些隱性知識系統化：

```
階段一                    階段二                     階段三
程式碼 ──逆向工程──→ 遊戲規格書(GDD) ──提煉方法論──→ Agent Skills ──組裝流程──→ Workflow
(實作層)                 (設計層)                    (方法論層)                (自動化層)
```

---

## 三個階段總覽

| 階段 | 輸入 | 輸出 | 核心動作 |
|------|------|------|---------|
| **一、逆向推導 GDD** | 程式碼（src/*.ts） | 9 章 GDD 文件 | 讀碼→提取→結構化 |
| **二、推導 Agent Skills** | GDD + 參考 Skills（temp/*.md） | 7 個職能 Skill 檔案 | 去耦合→模板化→定品質標準 |
| **三、建立 Workflow** | Agent Skills | 主流程 + 子流程檔案 | 拆階段→加檢查點→串依賴 |

---

## 教學文件索引

| # | 檔案 | 內容 |
|---|------|------|
| 00 | **本文件**（00_overview.md） | 總覽與三階段概述 |
| 01 | [01_reverse_engineer_gdd.md](01_reverse_engineer_gdd.md) | 階段一：程式碼 → GDD 的完整流程與提示詞 |
| 02 | [02_derive_agent_skills.md](02_derive_agent_skills.md) | 階段二：GDD + 參考 → Agent Skills 的推導方法 |
| 03 | [03_create_workflows.md](03_create_workflows.md) | 階段三：建立 Workflow & Sub-workflows |

---

## 專案結構參考

### 程式碼結構（需先掃描辨識）

典型的 Suika-type 遊戲專案，原始碼會涵蓋以下子系統：

```
原始碼目錄/
├── [入口檔案]               ← 應用程式入口
├── [遊戲主控制器]            ← 遊戲生命週期管理
├── [資料/配置]
│   ├── [常數定義]           ← 物理、形狀、難度等所有可調參數
│   └── [型別定義]           ← 介面/型別
├── [核心系統]
│   ├── [物理引擎整合]       ← Matter.js / Box2D 等
│   ├── [合成邏輯]           ← 核心：碰撞→合成→得分
│   ├── [粒子系統]           ← 合成粒子、環境粒子
│   └── [輸入處理]           ← 滑鼠/觸控→遊戲座標
├── [渲染系統]
│   ├── [圖層管理]           ← z-order, Container 結構
│   ├── [Texture 生成/快取]  ← 程式繪製材質 + 快取策略
│   └── [視窗縮放]           ← 響應式縮放邏輯
├── [音效系統]               ← Web Audio API / 素材播放
└── [UI 系統]
    ├── [HUD]                ← 分數、NEXT 預覽、按鈕
    ├── [Overlay 彈窗]       ← 難度選擇、Game Over、設定
    └── [排行榜]             ← 線上/本地排行
```

> 📌 **實際檔案名稱因專案而異**，在階段一 Step 1 會透過掃描辨識出來。

### 參考 Skills（temp/*.md）

```
temp/
├── game-designer.md         ← 通用遊戲系統設計師
├── level-designer.md        ← 通用關卡設計師
├── technical-artist.md      ← 通用技術美術師
├── design-ui-designer.md    ← 通用 UI 設計師
├── design-ux-architect.md   ← 通用 UX 架構師
├── game-audio-engineer.md   ← 通用音效工程師
└── narrative-designer.md    ← 通用敘事設計師
```

### 最終產出結構

```
docs/gdd/                    ← 遊戲規格書
├── 00_index.md
├── 01_game_overview.md
├── ...
└── 09_testing.md

.agents/skills/              ← Agent Skills（職能方法論）
├── game-designer/SKILL.md
├── level-designer/SKILL.md
├── technical-artist/SKILL.md
├── art-style-director/SKILL.md
├── ui-ux-designer/SKILL.md
├── audio-engineer/SKILL.md
└── qa-tester/SKILL.md

.agents/workflows/            ← 自動化工作流
├── write-gdd.md              ← 主流程
├── gdd-phase1-core-design.md ← 子流程
├── gdd-phase2-level-design.md
├── ...
└── gdd-phase8-10-specs-test-verify.md
```
