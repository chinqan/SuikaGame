/* ============================================
   Aim Guide — Aiming line & ghost preview
   ============================================ */

import { Graphics } from 'pixi.js';
import type { ShapeDef, GameLayers } from '@/data/types';
import { DESIGN_W, DESIGN_H, GAME_INSET_X, FLOOR_AREA_H } from '@/data/config';
import { drawNeonShape } from '@/rendering/design-system';

export class AimGuide {
  private lineGfx: Graphics | null = null;
  private ghostGfx: Graphics | null = null;
  private ghostLevel = -1;

  private readonly canvasW = DESIGN_W;
  private readonly gameAreaH = DESIGN_H - FLOOR_AREA_H;

  constructor(private readonly layers: GameLayers) {}

  /** 更新瞄準引導 */
  update(dropX: number, currentLevel: number, shapes: readonly ShapeDef[], canDrop: boolean, isGameOver: boolean): void {
    if (!canDrop || isGameOver) {
      if (this.lineGfx) this.lineGfx.visible = false;
      if (this.ghostGfx) this.ghostGfx.visible = false;
      return;
    }

    const shape = shapes[currentLevel];
    const r = shape.radius;
    const x = Math.max(GAME_INSET_X + r + 4, Math.min(this.canvasW - GAME_INSET_X - r - 4, dropX));

    // Aim line
    if (!this.lineGfx) {
      this.lineGfx = new Graphics();
      this.lineGfx.moveTo(0, 0).lineTo(0, this.gameAreaH)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.10 });
      this.layers.aimGuide.addChild(this.lineGfx);
    }
    this.lineGfx.visible = true;
    this.lineGfx.x = x;

    // Ghost shape
    if (!this.ghostGfx || this.ghostLevel !== currentLevel) {
      if (this.ghostGfx) {
        this.layers.aimGuide.removeChild(this.ghostGfx);
        this.ghostGfx.destroy();
      }
      this.ghostGfx = new Graphics();
      drawNeonShape(this.ghostGfx, shape, r, false);
      this.ghostGfx.alpha = 0.55;
      this.layers.aimGuide.addChild(this.ghostGfx);
      this.ghostLevel = currentLevel;
    }
    this.ghostGfx.visible = true;
    this.ghostGfx.x = x;
    this.ghostGfx.y = r + 8;
  }

  /** 清理資源 */
  destroy(): void {
    if (this.lineGfx) {
      this.layers.aimGuide.removeChild(this.lineGfx);
      this.lineGfx.destroy();
      this.lineGfx = null;
    }
    if (this.ghostGfx) {
      this.layers.aimGuide.removeChild(this.ghostGfx);
      this.ghostGfx.destroy();
      this.ghostGfx = null;
      this.ghostLevel = -1;
    }
  }
}
