# 階段三：建立 Workflow & Sub-workflows，自動化撰寫 GDD

> **輸入**：階段二產出的 7 個 Agent Skills
> **輸出**：1 個主工作流 + 6 個子工作流檔案
> **核心原則**：Workflow 是「執行腳本」—— AI 照著走，就能產出高品質 GDD

---

## 為什麼需要 Workflow？

Skills 定義了「怎麼寫好 GDD」，但沒有定義「先寫什麼、後寫什麼、寫完怎麼驗收」。Workflow 做的就是：

1. **定義順序** — Phase 之間有依賴（先有形狀表才能寫配色）
2. **調用 Skills** — 每個 Phase 明確使用哪個 Skill 的模板和品質標準
3. **設置檢查點** — 每步完成後確認品質
4. **交叉驗證** — 最終檢查跨章節一致性

---

## Step 1：拆解 GDD 章節為有依賴關係的 Phase

### 操作

```
1. 列出 9 個 GDD 章節
2. 分析章節間的依賴關係（需要先有什麼才能寫什麼）
3. 合併或拆分，形成可執行的 Phase
```

### 提示詞

```
我的 GDD 有 9 個章節，Agent Skills 有 7 個。
請分析章節之間的依賴關係，並將其拆分為有前後順序的 Phase。

規則：
1. 每個 Phase 對應 1-2 個 GDD 章節
2. 每個 Phase 標明「要呼叫哪個 Agent Skill」
3. 標明前置依賴（需要先完成哪個 Phase）
4. 最後一個 Phase 做「交叉驗證」

請用以下格式呈現：

| Phase | 名稱 | 章節 | Skill | 前置依賴 |
|-------|------|------|-------|---------|
```

### 預期產出

```
Phase 1 核心設計     → 01 章 → game-designer     → 無
Phase 2 空間設計     → 02 章 → level-designer     → Phase 1
Phase 3 技術架構     → 03 章 → technical-artist   → Phase 2
Phase 4 視覺風格     → 04 章 → art-style-director → Phase 2, 3
Phase 5 UI/UX       → 05 章 → ui-ux-designer     → Phase 4
Phase 6 遊戲流程     → 06 章 → game+level         → Phase 1-5
Phase 7 音效         → 07 章 → audio-engineer     → Phase 1
Phase 8 特效規格     → 08 章 → tech+art           → Phase 4
Phase 9 測試         → 09 章 → qa-tester          → Phase 1-8
Phase 10 交叉驗證   → 00 索引 → 全部              → Phase 1-9
```

---

## Step 2：建立主工作流

### 操作

建立 `.agents/workflows/write-gdd.md`，作為統籌所有 Phase 的入口。

### 提示詞

```
請建立一個主工作流檔案 .agents/workflows/write-gdd.md。

格式要求：
1. YAML frontmatter 包含 description
2. 「前置準備」章節：
   - 確認遊戲定位的問題清單
   - 需要讀取的 Agent Skills 清單
   - GDD 目錄結構
3. 「執行流程」章節：
   - 逐一列出每個 Phase
   - 每個 Phase 標明：調用的 Skill、產出檔案、Steps 數量
   - 每個 Phase 附帶「→ 執行 sub-workflow：/gdd-phaseN-xxx」的引用
4. 「驗收標準」章節：
   - 5 項最終驗收標準

主流程不需要寫各 Phase 的細節——細節在 sub-workflow 中。
主流程的角色是「導航地圖」。
```

---

## Step 3：建立 Sub-workflows

### 操作

為每個 Phase（或 Phase 組合）建立獨立的子工作流檔案。

### 提示詞模板

對每個 Sub-workflow，使用以下提示詞結構：

```
請建立子工作流 .agents/workflows/gdd-phase[N]-[name].md。

**Phase 資訊**：
- 調用 Skill：[skill_name]
- 產出 GDD 章節：docs/gdd/[chapter].md
- 前置依賴：Phase [X] 完成

**要求**：
1. YAML frontmatter 包含 description
2. 開頭標明調用的 Skill、產出檔案、前置依賴
3. 將此 Phase 拆分為 [N] 個 Steps

**每個 Step 必須包含**：
a) Step 標題和目的
b) 具體的操作指引（要產出什麼格式的內容）
c) 如果涉及模板，引用對應 Skill 中的模板
d) 結尾有 3-5 條「檢查點」Checklist
   （用 - [ ] 格式，讓 AI 可以逐條驗證）

**Phase 結尾必須包含**：
- 「Phase N 完成驗收」清單
- 「→ 產出確認後進入 Phase N+1」的導航
```

### 各 Phase 的 Steps 參考

在呼叫生成子工作流時，可附帶以下參考提示，讓 AI 知道切分粒度：

| Phase | 建議的 Steps | 說明 |
|-------|-------------|------|
| **1 核心設計** | 設計支柱 → 核心循環 → 玩家輪廓 → 情感弧線 → 合成規格 → 難度平衡 → 得分經濟 | 7 Steps，最基礎的設計決策 |
| **2 空間設計** | 設計解析度 → 牆壁 → 圖層 → 難度精確規格 → 進化系統 → 數值分析 | 6 Steps，含 ASCII 空間圖 |
| **3 技術架構** | 架構圖 → 物理引擎 → 渲染初始化 → Texture 快取 → Pool → 輸入 → 持久化 → 建構 | 8 Steps，技術面最細 |
| **4 視覺風格** | 風格定義 → 配色 → 形狀繪製 → 環境場景 → 世界觀 | 5 Steps，含氛圍意圖 |
| **5 UI/UX** | UI架構 → Token → HUD → Overlay → 回饋 → Viewport → 無障礙 | 7 Steps，含版面圖 |
| **6+7 流程+音效** | 初始化 → 主循環 → 合成流程 → GameOver → 重置 ‖ Sonic Identity → 音效 → 音效包 → Budget | 9 Steps，兩個 Skill 合在一個檔案 |
| **8+9+10 特效+測試+驗證** | 粒子 → 環境特效 → 效能預算 ‖ 玩法測試 → 難度測試 → UI測試 → 效能 → 跨平台 → 邊界 → GDD一致性 ‖ 索引 → 一致性驗證 → 最終驗收 | 13 Steps |

---

## Step 4：加入 AI 執行時的 Skill 調用指引

### 目的
確保 AI 在執行 Workflow 時，會去讀取對應的 Skill，並使用其中的模板和品質標準。

### 提示詞

```
請檢查所有 sub-workflow 檔案，
確認每個 Phase 的開頭都有以下格式：

> **調用 Skill**：`[skill-name]`
>
> **使用的模板**：
> - [Skill 中的模板 A 名稱]
> - [Skill 中的模板 B 名稱]
>
> **品質標準**（來自 Skill）：
> - [Skill 中的品質標準 1]
> - [Skill 中的品質標準 2]

如果某個 sub-workflow 缺少這些資訊，請補上。
```

---

## Step 5：驗證 Workflow 的完整性

### 提示詞

```
請驗證 Workflow 系統的完整性：

1. **覆蓋率**：
   - 9 個 GDD 章節是否都被某個 Phase 覆蓋？
   - 7 個 Skills 是否都被某個 Phase 調用？
   
2. **依賴正確性**：
   - 每個 Phase 的前置依賴是否合理？
   - 是否有循環依賴？
   
3. **檢查點密度**：
   - 每個 Step 是否有 3-5 條檢查點？
   - 檢查點是否可量化（不是「寫得好」，而是「有 ASCII 圖」）？

4. **Slash Command 可用性**：
   - 確認主流程可用 /write-gdd 啟動
   - 確認每個子流程可單獨用 /gdd-phaseN-xxx 啟動

列出所有不合格項目和修正建議。
```

---

## 最終產出結構

```
.agents/workflows/
├── write-gdd.md                      ← /write-gdd（主入口）
├── gdd-phase1-core-design.md         ← /gdd-phase1-core-design
├── gdd-phase2-level-design.md        ← /gdd-phase2-level-design
├── gdd-phase3-technical.md           ← /gdd-phase3-technical
├── gdd-phase4-art-style.md           ← /gdd-phase4-art-style
├── gdd-phase5-ui-ux.md               ← /gdd-phase5-ui-ux
├── gdd-phase6-7-flow-audio.md        ← /gdd-phase6-7-flow-audio
└── gdd-phase8-10-specs-test-verify.md ← /gdd-phase8-10-specs-test-verify
```

### 使用方式

```
# 完整流程
/write-gdd

# 只執行某個階段
/gdd-phase1-core-design
/gdd-phase4-art-style

# 補寫特定章節
/gdd-phase8-10-specs-test-verify
```

---

## 階段三完成標準

✅ 主工作流可用 `/write-gdd` 啟動
✅ 每個子流程可單獨啟動
✅ 每個 Step 有操作指引 + 檢查點
✅ 每個 Phase 有完成驗收清單
✅ Workflow 覆蓋全部 9 章 GDD 和 7 個 Skills
✅ 無循環依賴

---

## ⚠️ 常見陷阱（實戰經驗）

### 陷阱 1：Phase 粒度太粗，遺漏細節

**問題**：第一版 Workflow 只有 10 行的高層描述，
執行時容易跳過「環境場景氛圍意圖」、「Overlay 狀態保存」這類細節。

**解法**：每個 Phase 拆為獨立的 Sub-workflow，
每個 Sub-workflow 有 3-8 個 Steps，每步有 3-5 條 Checklist。
具體到「這一步必須產出一個表格」的粒度。

### 陷阱 2：沒有跨 Phase 驗證

**問題**：Phase 2 寫了形狀進化表，Phase 4 寫了形狀配色表——兩邊的等級數、顏色可能不一致。

**解法**：Phase 10（交叉驗證）做三維一致性檢查：
1. **數值一致性** — 同一數值跨章節相同
2. **命名一致性** — 常數名、圖層名跨章節相同
3. **邏輯一致性** — 流程中提到的系統都在架構圖中

### 陷阱 3：Sub-workflow 沒有引用 Skill

**問題**：Sub-workflow 寫了步驟，但沒標明「使用哪個 Skill 的哪個模板」。
AI 執行時不知道去讀 Skill，產出品質下降。

**解法**：每個 Sub-workflow 開頭必須標明：
```markdown
> **調用 Skill**：`[skill-name]`
> **使用的模板**：[Skill 中的具體模板名稱]
> **品質標準**：[Skill 中的具體標準]
```

### 陷阱 4：檢查點不可量化

**問題**：檢查點寫「✅ 內容完整」——AI 不知道什麼叫「完整」。

**解法**：檢查點必須是客觀可驗證的：
```
❌ - [ ] 形狀表完整
✅ - [ ] 形狀表每個等級都有：名稱、邊數、半徑、顏色、得分、設計意圖
✅ - [ ] 物理參數分為「引擎全域」和「形狀 Body」兩組
✅ - [ ] 每個 Overlay 有 z-index + 觸發時機 + 關閉方式
```
