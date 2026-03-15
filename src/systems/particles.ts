/* ============================================
   Particle System — Merge particles, floating
   text, grid flows
   ============================================ */

import { Container, Sprite, Text } from 'pixi.js';
import type { GameParticle, FloatingTextData, GridFlowData, ShapeDef, GameLayers } from '@/data/types';
import { DESIGN_W, DESIGN_H, GAME_INSET_X, FLOOR_AREA_H, FLOOR_PERSPECTIVE, GRID_FLOW_CONFIG } from '@/data/config';
import { getShapeTexture, getDotTexture, getRingTexture, getGlowTexture } from '@/rendering/textures';
import { ObjectPool } from '@/core/pool';

export class ParticleSystem {
  readonly particles: GameParticle[] = [];
  readonly floatingTexts: FloatingTextData[] = [];
  readonly gridFlows: GridFlowData[] = [];

  private readonly floatingTextPool: ObjectPool<Text>;
  private readonly gridFlowSpritePool: ObjectPool<Sprite>;

  private readonly canvasW = DESIGN_W;
  private readonly canvasH = DESIGN_H;
  private readonly gameAreaH = DESIGN_H - FLOOR_AREA_H;

  constructor(private readonly layers: GameLayers) {
    this.floatingTextPool = new ObjectPool<Text>(
      () => {
        const t = new Text({
          text: '', style: {
            fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 'bold',
            fill: '#ffffff', align: 'center',
          },
        });
        t.anchor.set(0.5);
        return t;
      },
      (t) => { t.visible = false; },
    );

    this.gridFlowSpritePool = new ObjectPool<Sprite>(
      () => {
        const s = new Sprite(getGlowTexture());
        s.anchor.set(0.5);
        s.blendMode = 'add';
        this.layers.bg.addChild(s);
        return s;
      },
      (s) => { s.visible = false; },
    );
  }

  /** 產生合成粒子效果 */
  spawnMergeParticles(x: number, y: number, level: number, shapes: readonly ShapeDef[]): void {
    const shape = shapes[level];

    // Ring
    const ringBaseR = 5;
    const ring = new Sprite(getRingTexture(shape.color));
    ring.anchor.set(0.5);
    ring.x = x; ring.y = y;
    this.layers.particles.addChild(ring);
    this.particles.push({
      type: 'ring', display: ring, radius: ringBaseR, baseRadius: ringBaseR,
      maxRadius: shape.radius * 3.5, life: 1, decay: 0.04, color: shape.color, lineWidth: 4,
    });

    // Shards
    const shardCount = 8 + level * 2;
    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 6;
      const sc = 0.32 + Math.random() * 0.26;
      const s = new Sprite(getShapeTexture(level, shapes));
      s.anchor.set(0.5);
      s.x = x; s.y = y; s.scale.set(sc);
      s.rotation = Math.random() * Math.PI * 2;
      this.layers.particles.addChild(s);
      this.particles.push({
        type: 'shard', display: s, vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, decay: 0.012 + Math.random() * 0.015,
        rotSpeed: (Math.random() - 0.5) * 0.3, initScale: sc,
      });
    }

    // Dots
    const dotCount = 16 + level * 3;
    const dotTex = getDotTexture(shape.color);
    for (let i = 0; i < dotCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      const sz = 2 + Math.random() * 5;
      const s = new Sprite(dotTex);
      s.anchor.set(0.5);
      s.scale.set(sz / 8);
      s.x = x; s.y = y;
      this.layers.particles.addChild(s);
      this.particles.push({
        type: 'dot', display: s, vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, decay: 0.015 + Math.random() * 0.02,
      });
    }
  }

  /** 產生浮動文字 */
  spawnFloatingText(x: number, y: number, text: string, color: string, comboNum?: number): void {
    const fontSize = comboNum ? (28 + comboNum * 4) : 22;
    const t = this.floatingTextPool.acquire();
    t.text = text;
    t.style.fontSize = fontSize;
    t.style.fill = color;
    t.visible = true;
    t.alpha = 1;
    t.x = x; t.y = y;
    t.scale.set(0.5);
    this.layers.ui.addChild(t);
    this.floatingTexts.push({
      display: t, life: 1, decay: 0.018,
      vy: comboNum ? (-4.5 - comboNum * 0.3) : -2.5,
      targetScale: 1.2,
    });
  }

  /** 產生格線光流 */
  spawnGridFlow(): void {
    const isH = Math.random() < 0.6;
    const sprite = this.gridFlowSpritePool.acquire();
    sprite.visible = true;

    this.gridFlows.push({
      t: Math.random() * 0.2,
      speed: 0.001 + Math.random() * 0.002,
      lineIdx: isH ? Math.floor(Math.random() * 8) + 1 : Math.floor(Math.random() * 11),
      isHorizontal: isH,
      size: 8 + Math.random() * 10,
      brightness: 0.7 + Math.random() * 0.3,
      sprite,
    });
  }

  /** 每幀更新 */
  update(isGameOver: boolean): void {
    this.updateParticles();
    this.updateFloatingTexts();
    this.updateGridFlows(isGameOver);
  }

  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        this.layers.particles.removeChild(p.display);
        p.display.destroy();
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      if (p.type === 'ring') {
        p.radius += (p.maxRadius - p.radius) * 0.15;
        const sc = p.radius / p.baseRadius;
        p.display.scale.set(sc);
        p.display.alpha = p.life * 0.7;
      } else {
        p.display.x += p.vx;
        p.display.y += p.vy;
        p.vy += 0.08;
        p.display.alpha = p.life;
        if (p.type === 'shard') {
          p.display.rotation += p.rotSpeed;
          p.display.scale.set(p.initScale * p.life);
        }
      }
    }
  }

  private updateFloatingTexts(): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= ft.decay;
      if (ft.life <= 0) {
        this.layers.ui.removeChild(ft.display);
        ft.display.visible = false;
        this.floatingTextPool.release(ft.display);
        this.floatingTexts[i] = this.floatingTexts[this.floatingTexts.length - 1];
        this.floatingTexts.pop();
        continue;
      }
      ft.display.y += ft.vy;
      ft.vy *= 0.97;
      ft.display.alpha = ft.life;
      const s = Math.min(ft.display.scale.x + 0.08, ft.targetScale);
      ft.display.scale.set(s);
    }
  }

  private updateGridFlows(isGameOver: boolean): void {
    if (!isGameOver && this.gridFlows.length < GRID_FLOW_CONFIG.maxCount && Math.random() < GRID_FLOW_CONFIG.spawnChance) {
      this.spawnGridFlow();
    }

    const lx = GAME_INSET_X;
    const rx = this.canvasW - GAME_INSET_X;
    const farY = this.gameAreaH - FLOOR_PERSPECTIVE.farOffset;
    const farL = lx, farR = rx;
    const nearY = this.canvasH;
    const nearL = -FLOOR_PERSPECTIVE.nearExtend;
    const nearR = this.canvasW + FLOOR_PERSPECTIVE.nearExtend;
    const hLines = FLOOR_PERSPECTIVE.hLines;
    const vLines = FLOOR_PERSPECTIVE.vLines;

    for (let i = this.gridFlows.length - 1; i >= 0; i--) {
      const f = this.gridFlows[i];
      f.t += f.speed;
      if (f.t > 1) {
        f.sprite.visible = false;
        this.gridFlowSpritePool.release(f.sprite);
        this.gridFlows[i] = this.gridFlows[this.gridFlows.length - 1];
        this.gridFlows.pop();
        continue;
      }
      let px: number, py: number;
      if (f.isHorizontal) {
        const t = f.lineIdx / hLines;
        const tC = 1 - Math.pow(1 - t, FLOOR_PERSPECTIVE.power);
        const lineY = nearY + (farY - nearY) * tC;
        const lineL = nearL + (farL - nearL) * tC;
        const lineR = nearR + (farR - nearR) * tC;
        px = lineL + (lineR - lineL) * f.t;
        py = lineY;
      } else {
        const frac = f.lineIdx / vLines;
        const xNear = nearL + (nearR - nearL) * frac;
        const xFar = farL + (farR - farL) * frac;
        px = xNear + (xFar - xNear) * f.t;
        py = nearY + (farY - nearY) * f.t;
      }
      const flicker = 0.6 + 0.4 * Math.sin(f.t * 40 + f.lineIdx * 7);
      const alpha = f.brightness * Math.max(0, 1 - Math.abs(f.t - 0.5) * 2.2) * flicker;
      f.sprite.x = px;
      f.sprite.y = py;
      f.sprite.alpha = Math.max(0, alpha);
      f.sprite.scale.set(f.size / 32);
    }
  }

  /** 清除所有粒子效果 */
  clearAll(destroy: boolean): void {
    // Particles
    for (const p of this.particles) {
      this.layers.particles.removeChild(p.display);
      p.display.destroy();
    }
    this.particles.length = 0;

    // Floating texts
    for (const ft of this.floatingTexts) {
      this.layers.ui.removeChild(ft.display);
      if (destroy) {
        ft.display.destroy();
      } else {
        ft.display.visible = false;
        this.floatingTextPool.release(ft.display);
      }
    }
    this.floatingTexts.length = 0;

    // Grid flows
    for (const f of this.gridFlows) {
      if (destroy) {
        this.layers.bg.removeChild(f.sprite);
        f.sprite.destroy();
      } else {
        f.sprite.visible = false;
        this.gridFlowSpritePool.release(f.sprite);
      }
    }
    this.gridFlows.length = 0;

    if (destroy) {
      this.floatingTextPool.drain((t) => t.destroy());
      this.gridFlowSpritePool.drain((s) => { this.layers.bg.removeChild(s); s.destroy(); });
    }
  }
}
