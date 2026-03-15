/* ============================================
   Merge System — Collision merging logic
   ============================================ */

import type Matter from 'matter-js';
import { Sprite } from 'pixi.js';
import type { ShapeDef } from '@/data/types';
import { COMBO_WINDOW_MS } from '@/data/config';
import { PhysicsSystem } from './physics';
import { getShapeTexture } from '@/rendering/textures';
import type { ParticleSystem } from './particles';
import type { AudioManager } from '@/audio/audio';
import type { GameLayers } from '@/data/types';

export interface MergeCallbacks {
  onScoreAdd: (points: number, color: string, x: number, y: number) => void;
  onCombo: (count: number, x: number, y: number) => void;
  onShake: (amount: number) => void;
}

export class MergeSystem {
  private comboCount = 0;
  private comboTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly physics: PhysicsSystem,
    private readonly particleSys: ParticleSystem,
    private readonly audio: AudioManager,
    private readonly layers: GameLayers,
    private readonly bodyGraphicsMap: Map<number, Sprite>,
    private readonly callbacks: MergeCallbacks,
  ) {}

  /** 取得現在的 shapes（可被外部切換） */
  private _shapes: readonly ShapeDef[] = [];
  set shapes(s: readonly ShapeDef[]) { this._shapes = s; }
  get shapes(): readonly ShapeDef[] { return this._shapes; }

  /** 處理碰撞事件 */
  handleCollision(event: Matter.IEventCollision<Matter.Engine>): void {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.label !== 'shape' || b.label !== 'shape') continue;

      const levelA = this.physics.bodyLevelMap.get(a.id);
      const levelB = this.physics.bodyLevelMap.get(b.id);
      if (levelA === undefined || levelB === undefined || levelA !== levelB) continue;
      if (this.physics.mergeCooldown.has(a.id) || this.physics.mergeCooldown.has(b.id)) continue;

      this.physics.mergeCooldown.add(a.id);
      this.physics.mergeCooldown.add(b.id);

      const level = levelA;
      const newLevel = level + 1;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;

      // Remove old bodies & graphics
      this.physics.removeBody(a);
      this.physics.removeBody(b);
      this.physics.bodyLevelMap.delete(a.id);
      this.physics.bodyLevelMap.delete(b.id);
      this.physics.mergeCooldown.delete(a.id);
      this.physics.mergeCooldown.delete(b.id);

      const gA = this.bodyGraphicsMap.get(a.id);
      if (gA) { this.layers.shapes.removeChild(gA); gA.destroy(); }
      const gB = this.bodyGraphicsMap.get(b.id);
      if (gB) { this.layers.shapes.removeChild(gB); gB.destroy(); }
      this.bodyGraphicsMap.delete(a.id);
      this.bodyGraphicsMap.delete(b.id);

      // Score
      const gained = newLevel < this._shapes.length ? this._shapes[newLevel].score : 80;
      const scoreColor = newLevel < this._shapes.length ? this._shapes[newLevel].color : '#FFFFFF';
      this.callbacks.onScoreAdd(gained, scoreColor, mx, my);

      // Combo
      this.comboCount++;
      if (this.comboTimer) clearTimeout(this.comboTimer);
      this.comboTimer = setTimeout(() => {
        this.comboCount = 0;
        this.comboTimer = null;
      }, COMBO_WINDOW_MS);

      if (this.comboCount >= 2) {
        this.callbacks.onCombo(this.comboCount, mx, my);
      }

      // Spawn merged shape
      if (newLevel < this._shapes.length) {
        const newBody = this.physics.createShapeBody(mx, my, newLevel, this._shapes);
        this.physics.bodyLevelMap.set(newBody.id, newLevel);
        this.physics.addBody(newBody);
        this.physics.setVelocity(newBody, {
          x: (Math.random() - 0.5) * 1.5,
          y: -1.5,
        });

        const ng = new Sprite(getShapeTexture(newLevel, this._shapes));
        ng.anchor.set(0.5);
        ng.x = mx;
        ng.y = my;
        this.layers.shapes.addChild(ng);
        this.bodyGraphicsMap.set(newBody.id, ng);
      }

      // Effects
      this.particleSys.spawnMergeParticles(mx, my, level, this._shapes);
      this.audio.playMergeSound(level);
      this.callbacks.onShake(4 + level * 1.5 + this.comboCount * 0.5);
    }
  }

  /** 重置連擊系統 */
  reset(): void {
    this.comboCount = 0;
    if (this.comboTimer) {
      clearTimeout(this.comboTimer);
      this.comboTimer = null;
    }
  }
}
