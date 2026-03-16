/* ============================================
   Texture Cache Manager
   ============================================ */

import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ShapeDef } from '@/data/types';
import { drawNeonShape, hexToNum } from './design-system';

let _app: Application | null = null;

// ─── Shape Texture Cache ─────────────────────
const _shapeTexCache = new Map<number, Texture>();
let _shapeTexShapesRef: readonly ShapeDef[] | null = null;

// ─── Particle Texture Caches ─────────────────
const _dotTexCache = new Map<string, Texture>();
const _ringTexCache = new Map<string, Texture>();
const _bubbleTexCache = new Map<string, Texture>();
let _glowTexture: Texture | null = null;

/** 初始化 texture manager（綁定 app） */
export function initTextures(app: Application): void {
  _app = app;
}

/** 取得形狀 texture（快取） */
export function getShapeTexture(level: number, shapes: readonly ShapeDef[]): Texture {
  // SHAPES 變更時清除快取（切換難度）
  if (_shapeTexShapesRef !== shapes) {
    clearShapeTextureCache();
    _shapeTexShapesRef = shapes;
  }
  if (_shapeTexCache.has(level)) return _shapeTexCache.get(level)!;

  const shape = shapes[level];
  const g = new Graphics();
  drawNeonShape(g, shape, shape.radius, true);
  const pad = shape.radius + 16;
  g.x = pad;
  g.y = pad;

  const container = new Container();
  container.addChild(g);
  const size = pad * 2;
  const tex = _app!.renderer.generateTexture({
    target: container,
    frame: new Rectangle(0, 0, size, size),
  });
  g.destroy();
  container.destroy();
  _shapeTexCache.set(level, tex);
  return tex;
}

/** 取得 dot particle texture（快取） */
export function getDotTexture(colorHex: string): Texture {
  if (_dotTexCache.has(colorHex)) return _dotTexCache.get(colorHex)!;
  const sz = 8;
  const g = new Graphics();
  g.circle(sz, sz, sz).fill({ color: hexToNum(colorHex) });
  const tex = _app!.renderer.generateTexture({
    target: g,
    frame: new Rectangle(0, 0, sz * 2, sz * 2),
  });
  g.destroy();
  _dotTexCache.set(colorHex, tex);
  return tex;
}

/** 取得 ring particle texture（快取） */
export function getRingTexture(colorHex: string): Texture {
  if (_ringTexCache.has(colorHex)) return _ringTexCache.get(colorHex)!;
  const R = 5;
  const g = new Graphics();
  g.circle(R + 4, R + 4, R).stroke({ color: hexToNum(colorHex), width: 4, alpha: 0.7 });
  const pad = R + 6;
  const tex = _app!.renderer.generateTexture({
    target: g,
    frame: new Rectangle(0, 0, pad * 2, pad * 2),
  });
  g.destroy();
  _ringTexCache.set(colorHex, tex);
  return tex;
}

/** 取得氣泡 texture（快取） */
export function getBubbleTexture(colorHex: string, radius: number): Texture {
  const key = `${colorHex}_${radius}`;
  if (_bubbleTexCache.has(key)) return _bubbleTexCache.get(key)!;

  const pad = 4; // Add a small padding to prevent clipping
  const totalRadius = radius + pad;
  const g = new Graphics();
  
  // 半透明基底
  g.circle(totalRadius, totalRadius, radius).fill({ color: hexToNum(colorHex), alpha: 0.15 });
  // 邊框
  g.circle(totalRadius, totalRadius, radius).stroke({ color: hexToNum(colorHex), width: 1, alpha: 0.2 });
  
  const size = totalRadius * 2;
  const tex = _app!.renderer.generateTexture({
    target: g,
    frame: new Rectangle(0, 0, size, size),
  });
  g.destroy();
  _bubbleTexCache.set(key, tex);
  return tex;
}

/** 取得光暈 texture（格線流用） */
export function getGlowTexture(): Texture {
  if (_glowTexture) return _glowTexture;
  const R = 32;
  const g = new Graphics();
  g.circle(R, R, R).fill({ color: 0x00ffff, alpha: 0.08 });
  g.circle(R, R, R * 0.7).fill({ color: 0x00ffff, alpha: 0.18 });
  g.circle(R, R, R * 0.45).fill({ color: 0x88ffff, alpha: 0.45 });
  g.circle(R, R, R * 0.25).fill({ color: 0xffffff, alpha: 1.0 });
  _glowTexture = _app!.renderer.generateTexture({ target: g, resolution: Math.min(window.devicePixelRatio || 1, 2) });
  g.destroy();
  return _glowTexture;
}

/** 清除形狀 texture 快取 */
export function clearShapeTextureCache(): void {
  for (const tex of _shapeTexCache.values()) tex.destroy(true);
  _shapeTexCache.clear();
}

/** 清除 particle texture 快取 */
export function clearParticleTexCaches(): void {
  for (const tex of _dotTexCache.values()) tex.destroy(true);
  _dotTexCache.clear();
  for (const tex of _ringTexCache.values()) tex.destroy(true);
  _ringTexCache.clear();
  for (const tex of _bubbleTexCache.values()) tex.destroy(true);
  _bubbleTexCache.clear();
}

/** 清除所有 texture 快取 */
export function clearAllTextureCaches(): void {
  clearShapeTextureCache();
  clearParticleTexCaches();
  if (_glowTexture) {
    _glowTexture.destroy(true);
    _glowTexture = null;
  }
}
