/* ============================================
   Viewport — Responsive scaling
   ============================================ */

/** 根據視窗大小調整 game-wrapper 的縮放 */
export function applyViewportScale(): void {
  const wrapper = document.getElementById('game-wrapper');
  if (!wrapper) return;

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  // 取得 wrapper 自然尺寸
  wrapper.style.transform = 'none';
  const naturalW = wrapper.offsetWidth;
  const naturalH = wrapper.offsetHeight;

  const scale = viewH / naturalH; // Force height to 100% of viewport

  wrapper.style.transform = `scale(${scale}) translateZ(0)`;
  wrapper.style.transformOrigin = 'center center';
}
