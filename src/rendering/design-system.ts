/* ============================================
   Design System — Colors, drawing helpers
   ============================================ */

import { Graphics } from 'pixi.js';
import type { ShapeDef } from '@/data/types';

/** hex 字串（#RRGGBB）轉 number */
export function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** hex 字串轉 rgba 字串 */
export function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 建立正多邊形頂點 */
export function buildPolygonPoints(cx: number, cy: number, sides: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

/** 繪製霓虹形狀（含 glow 層） */
export function drawNeonShape(g: Graphics, shape: ShapeDef, r: number, withGlow: boolean): void {
  const color = hexToNum(shape.color);
  g.clear();

  // Glow layers
  if (withGlow) {
    for (let i = 3; i >= 1; i--) {
      const glowR = r + i * 4;
      const alpha = 0.08 / i;
      if (shape.sides === 0) {
        g.circle(0, 0, glowR).fill({ color, alpha });
      } else {
        g.poly(buildPolygonPoints(0, 0, shape.sides, glowR)).fill({ color, alpha });
      }
    }
  }

  // Main shape
  if (shape.sides === 0) {
    g.circle(0, 0, r).fill({ color, alpha: 0.08 });
    g.circle(0, 0, r).stroke({ color, width: 6, alpha: 1 });
    g.circle(0, 0, r * 0.55).stroke({ color, width: 3, alpha: 0.2 });
  } else {
    const pts = buildPolygonPoints(0, 0, shape.sides, r);
    g.poly(pts).fill({ color, alpha: 0.08 });
    g.poly(pts).stroke({ color, width: 6, alpha: 1 });
    const innerPts = buildPolygonPoints(0, 0, shape.sides, r * 0.55);
    g.poly(innerPts).stroke({ color, width: 3, alpha: 0.2 });
  }
}
