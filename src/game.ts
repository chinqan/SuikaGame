/* ============================================
   Game — Main orchestrator
   ============================================ */

import { Application, Graphics, Sprite } from 'pixi.js';
import type { Difficulty, ShapeDef, GameLayers } from '@/data/types';
import {
  ALL_SHAPES, DESIGN_W, DESIGN_H, DIFFICULTY_MAP, GAME_INSET_X,
  FLOOR_AREA_H, GAME_OVER_LINE_Y, DROP_COOLDOWN_MS, GAME_OVER_DELAY_MS,
  STORAGE_KEYS, FLOOR_PERSPECTIVE,
} from '@/data/config';
import { InputManager } from '@/core/input';
import { createLayers, mountLayers } from '@/rendering/layers';
import { initTextures, getShapeTexture, getBubbleTexture } from '@/rendering/textures';
import { applyViewportScale } from '@/rendering/viewport';
import { PhysicsSystem } from '@/systems/physics';
import { MergeSystem } from '@/systems/merge';
import { ParticleSystem } from '@/systems/particles';
import { AimGuide } from '@/systems/aim-guide';
import { AudioManager } from '@/audio/audio';
import { HUD } from '@/ui/hud';
import { OverlayManager } from '@/ui/overlays';
import { submitScore } from '@/ui/leaderboard';

export class Game {
  private app!: Application;
  private layers!: GameLayers;
  private input!: InputManager;
  private physics!: PhysicsSystem;
  private mergeSys!: MergeSystem;
  private particleSys!: ParticleSystem;
  private aimGuide!: AimGuide;
  private audio!: AudioManager;
  private hud!: HUD;
  private overlays!: OverlayManager;

  // Game state
  private shapes: ShapeDef[] = [];
  private maxDropLevel = 4;
  private score = 0;
  private highScore = 0;
  private currentLevel = 0;
  private nextLevel = 0;
  private canDrop = true;
  private isGameOver = false;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private shakeAmount = 0;
  private playerId = 'guest';
  private currentDifficulty: Difficulty = 'hard';
  private gameStartTime = 0;

  private readonly bodyGraphicsMap = new Map<number, Sprite>();
  private readonly bodyDebugCircles = new Map<number, Sprite>();

  private readonly canvasW = DESIGN_W;
  private readonly canvasH = DESIGN_H;
  private readonly gameAreaH = DESIGN_H - FLOOR_AREA_H;

  // ─── Init ──────────────────────────────────

  async init(): Promise<void> {
    this.highScore = parseInt(localStorage.getItem(STORAGE_KEYS.highScore) || '0');

    // Create PixiJS app
    this.app = new Application();
    await this.app.init({
      width: this.canvasW,
      height: this.canvasH,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: 1,
      autoDensity: true,
    });

    const container = document.getElementById('game-canvas-container')!;
    container.appendChild(this.app.canvas);
    this.app.canvas.style.width = this.canvasW + 'px';
    this.app.canvas.style.height = this.canvasH + 'px';

    // Init texture system
    initTextures(this.app);

    // Create layers
    this.layers = createLayers();
    this.app.stage.interactiveChildren = false;
    mountLayers(this.app.stage, this.layers);

    // Init systems
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.physics = new PhysicsSystem();
    this.particleSys = new ParticleSystem(this.layers);
    this.aimGuide = new AimGuide(this.layers);
    this.hud = new HUD(this.app);
    this.overlays = new OverlayManager(this.app, this.layers, this.audio);

    // Merge system (needs physics, particles, audio, layers)
    this.mergeSys = new MergeSystem(
      this.physics, this.particleSys, this.audio, this.layers,
      this.bodyGraphicsMap, this.bodyDebugCircles,
      {
        onScoreAdd: (pts, color, x, y) => {
          this.score += pts;
          this.hud.updateScore(this.score);
          this.particleSys.spawnFloatingText(x, y, '+' + pts, color);
        },
        onCombo: (count, x, y) => {
          this.particleSys.spawnFloatingText(x, y - 30, 'COMBO x' + count, '#FFD700', count);
        },
        onShake: (amount) => { this.shakeAmount = amount; },
      },
    );

    // Input binding
    this.input.bind(this.app.canvas, this.canvasW, (x) => this.handleDrop(x));

    // UI bindings
    this.overlays.bindDifficultyButtons((diff, pid) => this.selectDifficulty(diff, pid));
    this.overlays.bindRestartButton(() => this.restart());
    this.overlays.bindLeaderboardButtons();
    this.overlays.bindSettingsButtons();
    this.overlays.loadSavedPlayerId();

    // Draw static backgrounds
    this.drawBgScene();
    this.drawWallGlow();
    this.drawGameOverLine();

    // Viewport resize
    window.addEventListener('resize', applyViewportScale);
    applyViewportScale();

    // Show difficulty selection
    this.overlays.showBlurredOverlay();
    this.app.ticker.stop();
    this.overlays.showDifficultySelect();
  }

  // ─── Difficulty & Start ─────────────────────

  private selectDifficulty(diff: Difficulty, playerId: string): void {
    this.playerId = playerId;
    this.currentDifficulty = diff;
    const config = DIFFICULTY_MAP[diff];
    this.shapes = ALL_SHAPES.slice(config.shapesSlice) as ShapeDef[];
    this.maxDropLevel = config.maxDropLevel;
    this.gameStartTime = Date.now();
    this.overlays.hideDifficultySelect();
    this.startGame();
  }

  private startGame(): void {
    // Clean up previous game state
    if (this.physics.engine) {
      this.physics.clearShapeBodies();
      this.physics.stop();
    }

    // Clear PixiJS shape graphics
    this.layers.shapes.removeChildren();
    this.bodyGraphicsMap.forEach(g => g.destroy());
    this.bodyGraphicsMap.clear();
    this.bodyDebugCircles.forEach(g => g.destroy());
    this.bodyDebugCircles.clear();

    // Clear particles
    this.particleSys.clearAll(false);

    // Reset state
    this.score = 0;
    this.hud.updateScore(0);
    this.isGameOver = false;
    this.canDrop = true;
    if (this.gameOverTimer) { clearTimeout(this.gameOverTimer); this.gameOverTimer = null; }
    this.shakeAmount = 0;
    this.app.stage.x = 0; this.app.stage.y = 0;
    this.mergeSys.reset();
    this.mergeSys.shapes = this.shapes;
    this.aimGuide.destroy();

    // Create physics
    this.physics.create((event) => this.mergeSys.handleCollision(event));

    // Initialize levels
    this.currentLevel = this.randLevel();
    this.nextLevel = this.randLevel();

    // Update UI
    this.hud.drawNextPreview(this.nextLevel, this.shapes);
    this.hud.drawEvolutionBar(this.shapes);
    this.overlays.hideGameOver();

    // Start rendering
    this.overlays.hideBlurredOverlay();
    this.app.ticker.start();
    this.app.ticker.remove(this.gameLoop, this);
    this.app.ticker.add(this.gameLoop, this);
  }

  // ─── Game Loop ─────────────────────────────

  private gameLoop(): void {
    this.particleSys.update(this.isGameOver);
    this.checkGameOver();

    // Screen shake
    if (this.shakeAmount > 0) {
      this.app.stage.x = (Math.random() - 0.5) * this.shakeAmount * 2;
      this.app.stage.y = (Math.random() - 0.5) * this.shakeAmount * 2;
      this.shakeAmount *= 0.85;
      if (this.shakeAmount < 0.3) {
        this.shakeAmount = 0;
        this.app.stage.x = 0;
        this.app.stage.y = 0;
      }
    }

    // Sync physics body positions to sprites
    const bodies = this.physics.getAllBodies();
    for (const body of bodies) {
      const g = this.bodyGraphicsMap.get(body.id);
      if (g) {
        g.x = body.position.x;
        g.y = body.position.y;
        g.rotation = body.angle;
      }
      const dc = this.bodyDebugCircles.get(body.id);
      if (dc) {
        dc.x = body.position.x;
        dc.y = body.position.y;
        dc.rotation = body.angle;
      }
    }

    // Update aim guide
    this.aimGuide.update(this.input.dropX, this.currentLevel, this.shapes, this.canDrop, this.isGameOver);
  }

  // ─── Drop Shape ────────────────────────────

  private handleDrop(x: number): void {
    if (!this.canDrop || this.isGameOver) return;
    this.canDrop = false;

    const shape = this.shapes[this.currentLevel];
    const clampedX = Math.max(
      GAME_INSET_X + shape.radius + 4,
      Math.min(this.canvasW - GAME_INSET_X - shape.radius - 4, x),
    );

    const body = this.physics.createShapeBody(clampedX, -shape.radius, this.currentLevel, this.shapes);
    this.physics.bodyLevelMap.set(body.id, this.currentLevel);
    this.physics.addBody(body);

    const g = new Sprite(getShapeTexture(this.currentLevel, this.shapes));
    g.anchor.set(0.5);
    g.x = clampedX;
    g.y = -shape.radius;
    this.layers.shapes.addChild(g);
    this.bodyGraphicsMap.set(body.id, g);

    // Debug circle outline -> Bubble Sprite
    const dc = new Sprite(getBubbleTexture(shape.color, shape.radius + 3));
    dc.anchor.set(0.5);
    dc.x = clampedX;
    dc.y = -shape.radius;
    this.layers.shapes.addChild(dc);
    this.bodyDebugCircles.set(body.id, dc);

    this.audio.playDropSound();
    this.currentLevel = this.nextLevel;
    this.nextLevel = this.randLevel();
    this.hud.drawNextPreview(this.nextLevel, this.shapes);

    setTimeout(() => { this.canDrop = true; }, DROP_COOLDOWN_MS);
  }

  private randLevel(): number {
    return Math.floor(Math.random() * (this.maxDropLevel + 1));
  }

  // ─── Game Over ─────────────────────────────

  private checkGameOver(): void {
    if (this.isGameOver) return;
    const bodies = this.physics.getAllBodies();
    let aboveLine = false;
    for (const body of bodies) {
      if (this.physics.bodyLevelMap.has(body.id) && body.position.y < GAME_OVER_LINE_Y && body.speed < 1.5) {
        aboveLine = true;
        break;
      }
    }
    if (aboveLine) {
      if (!this.gameOverTimer) {
        this.gameOverTimer = setTimeout(() => this.triggerGameOver(), GAME_OVER_DELAY_MS);
      }
    } else {
      if (this.gameOverTimer) { clearTimeout(this.gameOverTimer); this.gameOverTimer = null; }
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.app.ticker.remove(this.gameLoop, this);
    this.physics.stop();

    // Screenshot before cleanup
    this.overlays.showBlurredOverlay();

    // Clean up all game resources
    this.physics.clearShapeBodies();
    this.layers.shapes.removeChildren();
    this.bodyGraphicsMap.forEach(g => g.destroy());
    this.bodyGraphicsMap.clear();
    this.bodyDebugCircles.forEach(g => g.destroy());
    this.bodyDebugCircles.clear();
    this.particleSys.clearAll(true);
    this.aimGuide.destroy();

    if (this.gameOverTimer) { clearTimeout(this.gameOverTimer); this.gameOverTimer = null; }
    this.mergeSys.reset();
    this.shakeAmount = 0;
    this.app.stage.x = 0; this.app.stage.y = 0;

    // Stop renderer
    this.app.ticker.stop();

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(STORAGE_KEYS.highScore, this.highScore.toString());
    }

    this.overlays.showGameOver(this.score, this.highScore);

    // Submit score
    const playTimeSec = Math.round((Date.now() - this.gameStartTime) / 1000);
    submitScore(this.playerId, this.score, this.currentDifficulty, playTimeSec);
  }

  private restart(): void {
    this.overlays.hideGameOver();
    this.overlays.showDifficultySelect();
  }

  // ─── Static Scene Drawing ──────────────────

  private drawBgScene(): void {
    this.layers.bg.removeChildren();
    const g = new Graphics();
    const lx = GAME_INSET_X;
    const rx = this.canvasW - GAME_INSET_X;

    // Game area bg
    g.rect(lx, 0, rx - lx, this.gameAreaH).fill({ color: 0x0f0f23, alpha: 0.4 });

    // Vertical grid lines
    const step = 45;
    for (let x = lx + step; x < rx; x += step) {
      g.moveTo(x, 0).lineTo(x, this.gameAreaH).stroke({ color: 0xffffff, width: 1, alpha: 0.025 });
    }

    // 3D floor
    const farY = this.gameAreaH - FLOOR_PERSPECTIVE.farOffset;
    const farL = lx, farR = rx;
    const nearY = this.canvasH;
    const nearL = -FLOOR_PERSPECTIVE.nearExtend;
    const nearR = this.canvasW + FLOOR_PERSPECTIVE.nearExtend;
    const { hLines, vLines, power } = FLOOR_PERSPECTIVE;

    for (let i = 1; i <= hLines; i++) {
      const t = i / hLines;
      const tC = 1 - Math.pow(1 - t, power);
      const y = nearY + (farY - nearY) * tC;
      const lineL = nearL + (farL - nearL) * tC;
      const lineR = nearR + (farR - nearR) * tC;
      const alpha = 0.5 + 0.5 * (1 - tC);
      g.moveTo(lineL, y).lineTo(lineR, y).stroke({ color: 0x00ffff, width: 1, alpha });
    }

    for (let i = 0; i <= vLines; i++) {
      const frac = i / vLines;
      const xNear = nearL + (nearR - nearL) * frac;
      const xFar = farL + (farR - farL) * frac;
      const alpha = 0.35 + 0.35 * (1 - Math.abs(frac - 0.5) * 2);
      g.moveTo(xNear, nearY).lineTo(xFar, farY).stroke({ color: 0x00ffff, width: 1, alpha: alpha * 0.9 });
    }

    this.layers.bg.addChild(g);
  }

  private drawWallGlow(): void {
    this.layers.wallGlow.removeChildren();
    const g = new Graphics();
    const lx = GAME_INSET_X;
    const rx = this.canvasW - GAME_INSET_X;

    g.moveTo(lx, 0).lineTo(lx, this.gameAreaH).stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });
    g.moveTo(rx, 0).lineTo(rx, this.gameAreaH).stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });
    g.moveTo(lx, this.gameAreaH).lineTo(rx, this.gameAreaH).stroke({ color: 0x00ffff, width: 2.5, alpha: 0.7 });

    this.layers.wallGlow.addChild(g);
  }

  private drawGameOverLine(): void {
    this.layers.gameOverLine.clear();
    const lx = GAME_INSET_X;
    const rx = this.canvasW - GAME_INSET_X;
    let x = lx;
    while (x < rx) {
      const end = Math.min(x + 8, rx);
      this.layers.gameOverLine.moveTo(x, GAME_OVER_LINE_Y).lineTo(end, GAME_OVER_LINE_Y)
        .stroke({ color: 0xff3131, width: 1.5, alpha: 0.35 });
      x += 14;
    }
  }
}
