# 階段二：從 GDD + 參考 Skills，推導出專屬 Agent Skills

> **輸入**：
> - 階段一產出的 GDD（docs/gdd/01~09）
> - 通用遊戲開發 Agent Skills 參考（temp/*.md）
>
> **輸出**：7 個專屬於此遊戲類型的 Agent Skill 檔案（.agents/skills/*/SKILL.md）
>
> **核心原則**：Skills ≠ GDD 的副本。Skills 是**方法論（怎麼寫好 GDD）**，不是**內容（GDD 寫了什麼）**

---

## 重要觀念：Skills 與 GDD 的區別

| | GDD（規格書） | Skill（方法論） |
|--|------------|-------------|
| **內容** | 具體數值、公式、配置 | 撰寫模板、品質標準、設計原則 |
| **目的** | 讓工程師能實作 | 讓 AI 能寫出好的 GDD |
| **舉例** | 「gravity.y = 2.2」 | 「物理參數必須完整列出，並附帶對遊戲手感的影響說明」 |
| **數值** | 硬編碼 | 用範例舉例，不強制數值 |

---

## Step 1：分析參考 Skills 的結構

### 目的
理解通用 Agent Skills 的共同結構模式，作為自己 Skills 的骨架。

### 操作

```
讀取 temp/ 目錄下所有 7 個 .md 檔案，
分析它們的共同結構
```

### 提示詞

```
請讀取 temp/ 目錄下所有 .md 檔案（共 7 個），
分析它們的共同結構模式：

1. YAML frontmatter 包含哪些欄位？
2. 文件的章節結構是什麼？（通常有：Identity, Core Mission, Critical Rules, Workflows…）
3. Critical Rules 的寫法特色是什麼？
4. 每個 Skill 如何區分「必須做」和「建議做」？

整理成一份「Skill 結構模板」，
我將用這個模板來撰寫自己的 Skills。
```

### 預期產出

```markdown
## Skill 結構模板

---
name: [名稱]
description: [一句話描述職能]
---

# [職能全名]
**職能**：[做什麼]

## When to Use
- [觸發場景列表]

## 品質標準
### [標準類別]
- [具體規則 + 範例]

## [撰寫指南/模板]
### [子主題]
[空白模板 + 範例]

## 工作流程
1. ...
```

---

## Step 2：職能分組——決定需要哪些 Skills

### 目的
根據 GDD 的章節分類 + 參考 Skills 的職能覆蓋，決定最終需要的 Skill 數量與分工。

### 操作

```
1. 列出 GDD 的 9 個章節
2. 列出 temp/ 的 7 個參考 Skill
3. 建立「GDD 章節 × Skill 職能」的對照矩陣
4. 決定需要合併、拆分或新增哪些職能
```

### 提示詞

```
根據我的 GDD 9 個章節，和 temp/ 的 7 個參考 Skills，
請建立一份對照矩陣：

| GDD 章節 | 對應的參考 Skill | 需要的專屬 Skill | 差異/調整 |
|---------|----------------|----------------|----------|

然後回答：
1. 哪些參考 Skill 可以直接沿用？
2. 哪些需要合併？（例如 ui-designer + ux-architect → ui-ux-designer）
3. 哪些需要新增？（例如參考中沒有 QA，但 GDD 需要測試章節）
4. narrative-designer 在這類遊戲中扮演什麼角色？需要獨立還是併入 art-style-director？
```

### 預期產出——職能決策表

```
最終決定的 7 個 Skills：
1. game-designer      ← 對應 temp/game-designer.md
2. level-designer     ← 對應 temp/level-designer.md
3. technical-artist   ← 對應 temp/technical-artist.md
4. art-style-director ← 合併 temp/narrative-designer.md 的敘事部分
5. ui-ux-designer     ← 合併 temp/design-ui-designer.md + design-ux-architect.md
6. audio-engineer     ← 對應 temp/game-audio-engineer.md
7. qa-tester          ← 新增（參考中無對應，但 GDD 第 9 章需要）
```

---

## Step 3：逐一撰寫每個 Skill

### 目的
以參考 Skills 為骨架，以 GDD 為內容來源，抽象出方法論。

### 核心轉換原則

```
GDD 說：「gravity.y = 2.2」
→ Skill 說：「物理參數必須完整列出，並附帶對遊戲手感的影響說明」
→ Skill 範例：「例如 gravity.y = 2.2，設計意圖：比真實重力快，讓落地節奏緊湊」

GDD 說：「Glow 層 alpha = 0.08/i，由外到內 4 層」
→ Skill 說：「Texture 規格必須記錄每層的尺寸/顏色/alpha/繪製順序，確保可還原」
→ Skill 範例：「例如 Glow 層 alpha = 0.08/i，由外到內繪製」
```

### 提示詞（以 game-designer 為例）

```
請幫我撰寫 .agents/skills/game-designer/SKILL.md。

**參考**：
- 結構骨架：temp/game-designer.md（取其「Identity / Critical Rules / Workflow」的結構精神）
- 內容來源：docs/gdd/01_game_overview.md（取其設計支柱、核心循環、難度平衡的「議題」）

**要求**：
1. YAML frontmatter: name, description（用中文）
2. 「品質標準」取代「Critical Rules」—— 定義撰寫 GDD 時的品質把關，而非程式碼規範
3. 提供「撰寫模板」而非具體數值——
   例如：提供空白的「難度平衡表模板」，附帶填寫原則，而非填好的表
4. 硬數值只在「範例」中出現——
   例如：「範例：gravity.y = 2.2，意圖：快速落地」
   而非：「gravity.y 必須設為 2.2」
5. 工作流程用中文的步驟式描述

**重要**：
- 不要照抄 GDD 的數值
- 不要限制創意——同一個模板可以填入不同的遊戲設定
- 聚焦「怎麼寫好 GDD」而非「GDD 寫了什麼」
```

### 其他 6 個 Skill 的提示詞模式

對每個 Skill，使用同樣的結構，只替換對應的參考和內容來源：

```
請幫我撰寫 .agents/skills/[SKILL_NAME]/SKILL.md。

**參考**：
- 結構骨架：temp/[REFERENCE_FILE].md
- 內容來源：docs/gdd/[GDD_CHAPTER].md

**要求**：
[同上 5 條通用要求]

**此 Skill 特別注意**：
- [該職能特有的注意事項]
```

#### 各 Skill 的「特別注意」

| Skill | 特別注意 |
|-------|---------|
| **level-designer** | 空間規格需要 ASCII 圖模板；進化表需完整欄位定義 |
| **technical-artist** | 物理參數需分組模板（引擎/形狀/牆壁）；Texture 需可還原性標準 |
| **art-style-director** | 每個視覺元素需附帶「氛圍意圖」模板；Merge narrative-designer 的敘事部分 |
| **ui-ux-designer** | 合併 UI + UX 兩個參考；需定義雙層渲染（DOM/Canvas）決策原則 |
| **audio-engineer** | 程式合成音效的圖層模板；Voice Budget 分桌機/行動 |
| **qa-tester** | 無直接參考——從 GDD 09 測試章節抽象出測試方法論 |

---

## Step 4：品質檢查——驗證 Skills 的方法論純度

### 提示詞

```
請檢查剛撰寫的 7 個 Skill 檔案，
驗證以下 3 項標準：

1. **無硬編碼數值**：
   搜尋所有出現的數字（如 2.2, 0.08, 1200），
   判斷是「範例中的參考值」還是「強制的規定值」。
   如果是後者，改寫為範例形式。

2. **有撰寫模板**：
   每個 Skill 至少提供 2 個「空白可填寫的模板」。
   檢查模板是否足夠通用（可用於不同風格的同類遊戲）。

3. **有品質標準**：
   每個 Skill 至少定義 3 條品質標準。
   品質標準應該是可檢查的（不是「寫得好」，而是「每個數值附帶設計意圖」）。

列出所有不合格的地方，並提供修改建議。
```

---

## 階段二完成標準

✅ 7 個 Skill 檔案就緒於 `.agents/skills/*/SKILL.md`
✅ 無硬編碼數值（只在範例中出現）
✅ 每個 Skill 有撰寫模板 + 品質標準
✅ Skills 聚焦方法論，不限制創意

---

## ⚠️ 常見陷阱（實戰經驗）

### 陷阱 1：Skill 變成 GDD 的副本

**問題**：第一版 Skills 寫了 `gravity.y = 2.2`、`friction = 0.6` 這類硬編碼數值。
這讓 Skill 變成了「GDD 的逆向工程參考文件」，而非「方法論」。

**解法**：嚴格區分：
```
❌ Skill 寫：「gravity.y 必須設為 2.2」
✅ Skill 寫：「物理參數必須完整列出，並附帶手感影響說明」
   範例：「gravity.y = 2.2，意圖：快速落地，節奏緊湊」
```

### 陷阱 2：Critical Rules 限制了創意

**問題**：第一版的 Critical Rules 寫成「GlowTexture 必須是 4 層同心圓，半徑 32/22/14/8px」。
這等於鎖死了設計空間，未來換風格就得改 Skill。

**解法**：Critical Rules 改為「品質標準」——
規定**必須記錄什麼**，而非**必須等於什麼**：
```
❌ 「Glow 層 alpha 必須是 0.08/i」
✅ 「Texture 規格必須記錄每層的 alpha 公式和繪製順序，確保可還原」
```

### 陷阱 3：忘記合併或拆分參考 Skills

**問題**：參考 `temp/` 中有 `design-ui-designer.md` 和 `design-ux-architect.md` 兩個檔案，
但在此類遊戲中 UI 和 UX 的分工界線很模糊。
同時沒有 QA Skill，但 GDD 需要測試章節。

**解法**：Step 2 的職能分組決策非常重要——
不是照搬參考結構，而是根據自己 GDD 的實際章節分類來決定。

### 陷阱 4：品質標準不可量化

**問題**：品質標準寫「設計得好」、「視覺有質感」——這無法被 AI 執行。

**解法**：品質標準必須是**可檢查的**：
```
❌ 「視覺效果要好」
✅ 「每個視覺元素必須附帶氛圍意圖（這個元素對玩家產生什麼感受？）」
✅ 「每個 UI 元素必須標明渲染層級（HTML DOM / Canvas / 混合）」
```
