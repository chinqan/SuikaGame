/* ============================================
   Rendering Layers — PixiJS Container hierarchy
   ============================================ */

import { Container, Graphics } from 'pixi.js';
import type { GameLayers } from '@/data/types';

/** 建立遊戲圖層容器 */
export function createLayers(): GameLayers {
  return {
    bg:           new Container({ isRenderGroup: true }),
    wallGlow:     new Container({ isRenderGroup: true }),
    gameOverLine: new Graphics(),
    shapes:       new Container(),
    particles:    new Container(),
    ui:           new Container(),
    aimGuide:     new Container(),
  };
}

/** 將所有圖層依序加入 stage */
export function mountLayers(stage: Container, layers: GameLayers): void {
  stage.addChild(
    layers.bg,
    layers.wallGlow,
    layers.gameOverLine,
    layers.shapes,
    layers.particles,
    layers.ui,
    layers.aimGuide,
  );
}
