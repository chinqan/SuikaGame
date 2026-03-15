/* ============================================
   HUD — Score display, Next preview, Evo bar
   ============================================ */

import { Application, Container, Sprite, Rectangle } from 'pixi.js';
import type { ShapeDef } from '@/data/types';
import { DESIGN_W } from '@/data/config';
import { getShapeTexture } from '@/rendering/textures';

export class HUD {
  constructor(private readonly app: Application) {}

  /** 更新分數顯示 */
  updateScore(score: number): void {
    const el = document.getElementById('score-value');
    if (el) el.textContent = String(score);
  }

  /** 繪製 Next 形狀預覽 */
  drawNextPreview(nextLevel: number, shapes: readonly ShapeDef[]): void {
    const nc = document.getElementById('next-container');
    if (!nc) return;
    nc.innerHTML = '';

    const shape = shapes[nextLevel];
    const scale = 28 / shape.radius;
    const sprite = new Sprite(getShapeTexture(nextLevel, shapes));
    sprite.anchor.set(0.5);
    sprite.x = 40; sprite.y = 40; sprite.scale.set(scale);

    const tmp = new Container();
    tmp.addChild(sprite);
    const tex = this.app.renderer.generateTexture({
      target: tmp,
      frame: new Rectangle(0, 0, 80, 80),
    });
    const canvas = this.app.renderer.extract.canvas(new Sprite(tex)) as HTMLCanvasElement;
    canvas.style.width = '80px';
    canvas.style.height = '80px';
    canvas.style.borderRadius = '8px';
    canvas.style.border = '1px solid rgba(255,255,255,0.1)';
    nc.appendChild(canvas);

    sprite.destroy();
    tmp.destroy();
    tex.destroy(true);
  }

  /** 繪製 Evolution bar */
  drawEvolutionBar(shapes: readonly ShapeDef[]): void {
    const ec = document.getElementById('evo-container');
    if (!ec) return;
    ec.innerHTML = '';

    const count = shapes.length;
    const w = DESIGN_W - 20;
    const h = 80;
    const minR = 11, maxR = 34;
    const radii: number[] = [];
    for (let i = 0; i < count; i++) {
      radii.push(minR + (maxR - minR) * (i / (count - 1)));
    }

    const diameters = radii.map(r => r * 2);
    const totalDiameters = diameters.reduce((sum, d) => sum + d, 0);
    const slotScale = w / totalDiameters;

    const tmp = new Container();
    let curX = 0;
    for (let i = 0; i < count; i++) {
      const shape = shapes[i];
      const displayR = radii[i];
      const slotW = diameters[i] * slotScale;
      const x = curX + slotW / 2;
      const y = h / 2;
      const scale = displayR / shape.radius;
      const s = new Sprite(getShapeTexture(i, shapes));
      s.anchor.set(0.5);
      s.x = x; s.y = y; s.scale.set(scale);
      tmp.addChild(s);
      curX += slotW;
    }

    const tex = this.app.renderer.generateTexture({
      target: tmp,
      frame: new Rectangle(0, 0, w, h),
    });
    const canvas = this.app.renderer.extract.canvas(new Sprite(tex)) as HTMLCanvasElement;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ec.appendChild(canvas);

    for (const child of tmp.children) child.destroy();
    tmp.destroy();
    tex.destroy(true);
  }
}
