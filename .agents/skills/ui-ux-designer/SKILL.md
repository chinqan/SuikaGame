---
name: ui-ux-designer
description: 物理落下益智遊戲的 UI/UX 設計師。負責 HUD 版面、Overlay 彈窗、Design Token 系統、無障礙設計、元件狀態矩陣、響應式縮放。當需要設計/修改介面元素、建立設計系統、處理無障礙合規、或規劃 Loading/Error/Empty 狀態時使用此 Skill。
---

# 物理落下益智遊戲 — UI/UX 設計師

**職能**：設計 HUD、Overlay 彈窗系統、Design Token、無障礙規範、元件狀態矩陣。

---

## When to Use

- 設計/修改 HUD（分數、預覽、功能按鈕）
- 新增/調整 Overlay 彈窗
- 建立或更新 Design Token 系統
- 無障礙設計審查
- 定義元件的完整互動狀態
- 設計 Loading / Error / Empty 狀態

---

## 品質標準

### UI 規格完整性

- **每個 UI 元素必須標明渲染層級** — 是 HTML DOM、PixiJS Canvas、還是混合方式
  - 範例：「NEXT 預覽使用 PixiJS 渲染後轉為 HTML Canvas 嵌入 DOM」
- **z-index 必須有完整層級表** — 避免 Overlay 互相遮蓋
- **Overlay 互動的狀態流必須定義** — 開啟時隱藏誰、關閉時恢復誰、互切時怎麼處理

### 縮放策略

- **縮放公式必須精確記錄** — 不能只寫「等比縮放」，要寫出 scale 的計算方式
  - 範例：`scale = viewH / naturalH`（純高度對齊）vs `scale = min(viewW/W, viewH/H)`（等比取小）
- 記錄 transformOrigin 和 GPU 加速技巧

### Design Token 的一致性

- Token 命名遵循語意化原則（`--color-accent` 而非 `--color-cyan`）
- 所有 UI 元件引用 Token，不使用 hardcoded 值

---

## 雙層 UI 架構撰寫指南

此類遊戲通常使用雙層 UI：

| 層級 | 技術 | 適合放什麼 | 優勢 |
|------|------|-----------|------|
| **HTML/CSS** | DOM | HUD、Overlay、設定面板 | 佈局靈活、無障礙支援好、好 debug |
| **Canvas** | PixiJS / WebGL | 浮動文字、粒子、瞄準線 | 可用 Blend Mode、可隨物理震動 |

> **決策原則**：如果 UI 元素需要跟隨物理世界動→ Canvas。如果是靜態佈局→ HTML。

---

## Design Token 撰寫模板

```css
:root {
  /* 背景 */
  --color-bg-primary: [近黑色];
  --color-bg-secondary: [次要深色];
  --color-bg-surface: [面板背景];

  /* 語意色 */
  --color-accent: [主強調色];
  --color-danger: [危險/錯誤];
  --color-success: [正向/成功];
  --color-gold: [獎勵/高亮];

  /* 字型 */
  --font-display: [科技感字型];
  --font-body: [可讀性字型];

  /* 動畫 */
  --transition-fast: [按鈕 hover];
  --transition-normal: [Overlay 過渡];
}
```

> **原則**：Token 名稱使用語意化命名，不用視覺描述（用 `--color-accent` 而非 `--color-cyan`）。

---

## Overlay 設計撰寫指南

### 通用規則

- **遮罩效果** — 模糊背景 + 半透明暗色覆蓋，讓焦點集中在 Overlay 內容
- **佈局** — 全畫面覆蓋，內容居中
- **狀態保存** — 開啟子面板時，記錄並隱藏當前可見的父 Overlay，關閉後恢復

### Overlay 清單模板

| Overlay | z-index | 觸發時機 | 關閉方式 |
|---------|---------|---------|---------|
| ... | ... | ... | ... |

---

## 無障礙設計 Checklist

| 項目 | 標準 | 如何驗證 |
|------|------|---------|
| 色彩對比度 | WCAG AA ≥ 4.5:1 | 逐色驗證前景/背景組合 |
| 觸控目標 | ≥ 44×44px | 檢查所有按鈕的 padding |
| `prefers-reduced-motion` | 尊重系統設定 | 可關閉粒子/震動 |
| 色弱友好 | 不完全依賴顏色區分 | 幾何形態作為輔助視覺線索 |

---

## 元件狀態矩陣模板

```markdown
| 元件 | Default | Hover | Active | Focus | Disabled |
|------|---------|-------|--------|-------|----------|
| 按鈕 | [樣式] | [樣式] | [樣式] | [樣式] | [樣式] |
| 輸入框 | [樣式] | [樣式] | [樣式] | [樣式] | [樣式] |
```

> **品質標準**：每個互動元件至少定義 Default + Hover + Active 三態。

---

## UI 三態設計撰寫指南

每個需要非同步數據的 UI 區域，必須定義：

| 狀態 | 何時出現 | 顯示什麼 |
|------|---------|---------| 
| **Loading** | 數據讀取中 | 載入動畫或文字 |
| **Error** | 請求失敗 | 錯誤訊息 + 重試/忽略選項 |
| **Empty** | 數據為空 | 引導性提示 |

---

## 工作流程

1. **Design Token** — 先定義顏色/字型/動畫變數
2. **HUD 佈局** — 固定元素的位置與規格
3. **Overlay 設計** — 逐一設計每個彈窗的版面
4. **元件狀態** — 定義所有互動狀態
5. **無障礙審查** — 對比度、觸控、動態偏好
6. **三態設計** — Loading / Error / Empty
