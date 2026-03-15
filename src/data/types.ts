/* ============================================
   Type Definitions
   ============================================ */

import type { Sprite, Graphics, Text } from 'pixi.js';

/** 形狀定義 */
export interface ShapeDef {
  name: string;
  sides: number;   // 0 = circle
  radius: number;
  color: string;   // hex e.g. '#00FFFF'
  score: number;
}

/** 難度設定 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  shapesSlice: number;   // ALL_SHAPES.slice(shapesSlice)
  maxDropLevel: number;
}

/** 粒子（共用介面） */
export interface ParticleBase {
  display: Sprite;
  life: number;
  decay: number;
}

export interface RingParticle extends ParticleBase {
  type: 'ring';
  radius: number;
  baseRadius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
}

export interface ShardParticle extends ParticleBase {
  type: 'shard';
  vx: number;
  vy: number;
  rotSpeed: number;
  initScale: number;
}

export interface DotParticle extends ParticleBase {
  type: 'dot';
  vx: number;
  vy: number;
}

export type GameParticle = RingParticle | ShardParticle | DotParticle;

/** 浮動文字 */
export interface FloatingTextData {
  display: Text;
  life: number;
  decay: number;
  vy: number;
  targetScale: number;
}

/** 格線光流 */
export interface GridFlowData {
  t: number;
  speed: number;
  lineIdx: number;
  isHorizontal: boolean;
  size: number;
  brightness: number;
  sprite: Sprite;
}

/** 音效類型 */
export type SoundType = 'standard' | 'crystal' | 'waterdrop' | 'bomb' | 'stone' | 'cosmic' | 'fighting' | 'shooting';

/** 圖層結構 */
export interface GameLayers {
  bg: import('pixi.js').Container;
  wallGlow: import('pixi.js').Container;
  gameOverLine: Graphics;
  shapes: import('pixi.js').Container;
  particles: import('pixi.js').Container;
  ui: import('pixi.js').Container;
  aimGuide: import('pixi.js').Container;
}
