/* ============================================
   Game Configuration & Constants
   ============================================ */

import type { ShapeDef, DifficultyConfig, Difficulty } from './types';

/** 所有形狀定義 */
export const ALL_SHAPES: readonly ShapeDef[] = [
  { name: 'Triangle',      sides: 3, radius: 23,  color: '#00FFFF', score: 1 },
  { name: 'Small Circle',  sides: 0, radius: 29,  color: '#FFFF00', score: 3 },
  { name: 'Square',        sides: 4, radius: 36,  color: '#FF6B6B', score: 6 },
  { name: 'Pentagon',      sides: 5, radius: 47,  color: '#39FF14', score: 10 },
  { name: 'Hexagon',       sides: 6, radius: 57,  color: '#FF8C00', score: 15 },
  { name: 'Circle',        sides: 0, radius: 70,  color: '#FF00FF', score: 21 },
  { name: 'Large Square',  sides: 4, radius: 88,  color: '#BF00FF', score: 28 },
  { name: 'Large Hexagon', sides: 6, radius: 104, color: '#00FF88', score: 36 },
  { name: 'Large Circle',  sides: 0, radius: 125, color: '#FFFFFF', score: 50 },
] as const;

/** 難度配置 */
export const DIFFICULTY_MAP: Record<Difficulty, DifficultyConfig> = {
  easy:   { shapesSlice: 2, maxDropLevel: 3 },
  normal: { shapesSlice: 1, maxDropLevel: 3 },
  hard:   { shapesSlice: 0, maxDropLevel: 4 },
};

/** 設計解析度 */
export const DESIGN_W = 546;
export const DESIGN_H = 779;

/** 遊戲區域 */
export const GAME_INSET_X = 35;
export const FLOOR_AREA_H = 70;
export const WALL_THICKNESS = 30;
export const GAME_OVER_LINE_Y = 55;

/** 物理引擎參數 */
export const PHYSICS_CONFIG = {
  gravity: { x: 0, y: 2.2 },
  positionIterations: 12,
  velocityIterations: 10,
  constraintIterations: 4,
  runnerDelta: 1000 / 120,
} as const;

/** 形狀 body 參數 */
export const SHAPE_BODY_CONFIG = {
  restitution: 0.15,
  friction: 0.6,
  frictionStatic: 0.8,
  baseDensity: 0.0015,
  densityPerLevel: 0.0004,
  slop: 0.005,
} as const;

/** 牆壁 body 參數 */
export const WALL_BODY_CONFIG = {
  isStatic: true,
  friction: 1.0,
  restitution: 0.1,
  frictionStatic: 1.0,
} as const;

/** 掉落延遲（ms） */
export const DROP_COOLDOWN_MS = 450;

/** 連擊時間窗口（ms） */
export const COMBO_WINDOW_MS = 1200;

/** Game Over 延遲（ms） */
export const GAME_OVER_DELAY_MS = 1500;

/** 3D 地板透視參數 */
export const FLOOR_PERSPECTIVE = {
  hLines: 8,
  vLines: 10,
  nearExtend: 220,
  farOffset: 30,
  power: 2.5,
} as const;

/** 格線流動參數 */
export const GRID_FLOW_CONFIG = {
  maxCount: 20,
  spawnChance: 0.06,
} as const;

/** localStorage 鍵值 */
export const STORAGE_KEYS = {
  highScore: 'neonMergeHigh',
  playerId: 'neonMergePlayerId',
  soundType: 'neonMergeSoundType',
} as const;
