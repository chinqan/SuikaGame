/* ============================================
   Overlays — Difficulty, GameOver, Leaderboard,
   Settings, Blurred background
   ============================================ */

import { Application, BlurFilter, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import type { Difficulty, SoundType, GameLayers } from '@/data/types';
import { ALL_SHAPES, DESIGN_W, DESIGN_H } from '@/data/config';
import { hexToRGBA } from '@/rendering/design-system';
import { AudioManager } from '@/audio/audio';
import { loadLeaderboard } from './leaderboard';

export class OverlayManager {
  private blurredBg: Container | null = null;

  constructor(
    private readonly app: Application,
    private readonly layers: GameLayers,
    private readonly audio: AudioManager,
  ) {}

  // ─── Blurred Background ─────────────────────

  showBlurredOverlay(): void {
    this.destroyBlurredBg();

    const tex = this.app.renderer.generateTexture({
      target: this.app.stage,
      frame: new Rectangle(0, 0, DESIGN_W, DESIGN_H),
    });
    const sprite = new Sprite(tex);
    sprite.filters = [new BlurFilter({ strength: 6, quality: 2 })];

    const dark = new Graphics();
    dark.rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x000000, alpha: 0.65 });

    this.blurredBg = new Container();
    this.blurredBg.addChild(sprite, dark);
    this.app.stage.addChild(this.blurredBg);

    this.setLayersVisible(false);
    this.app.renderer.render(this.app.stage);
  }

  hideBlurredOverlay(): void {
    this.destroyBlurredBg();
    this.setLayersVisible(true);
  }

  private destroyBlurredBg(): void {
    if (this.blurredBg) {
      this.app.stage.removeChild(this.blurredBg);
      this.blurredBg.destroy({ children: true, texture: true });
      this.blurredBg = null;
    }
  }

  private setLayersVisible(v: boolean): void {
    this.layers.bg.visible = v;
    this.layers.wallGlow.visible = v;
    this.layers.gameOverLine.visible = v;
    this.layers.shapes.visible = v;
    this.layers.particles.visible = v;
    this.layers.ui.visible = v;
    this.layers.aimGuide.visible = v;
  }

  // ─── Difficulty Select ──────────────────────

  bindDifficultyButtons(onSelect: (diff: Difficulty, playerId: string) => void): void {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const diff = (btn as HTMLElement).dataset.diff as Difficulty;
        const idInput = document.getElementById('player-id-input') as HTMLInputElement;
        const playerId = (idInput.value.trim() || 'guest').substring(0, 16);
        idInput.value = playerId;
        localStorage.setItem('neonMergePlayerId', playerId);
        onSelect(diff, playerId);
      });
    });
  }

  showDifficultySelect(): void {
    document.getElementById('difficulty-select')?.classList.remove('hidden');
  }

  hideDifficultySelect(): void {
    document.getElementById('difficulty-select')?.classList.add('hidden');
  }

  // ─── Game Over ──────────────────────────────

  showGameOver(score: number, highScore: number): void {
    const finalEl = document.getElementById('final-score');
    const highEl = document.getElementById('high-score');
    if (finalEl) finalEl.textContent = String(score);
    if (highEl) highEl.textContent = String(highScore);
    document.getElementById('game-over')?.classList.remove('hidden');
  }

  hideGameOver(): void {
    document.getElementById('game-over')?.classList.add('hidden');
  }

  bindRestartButton(onRestart: () => void): void {
    document.getElementById('restart-btn')?.addEventListener('click', onRestart);
  }

  // ─── Leaderboard ────────────────────────────

  bindLeaderboardButtons(): void {
    document.getElementById('leaderboard-btn')?.addEventListener('click', () => this.openLeaderboard());
    document.getElementById('leaderboard-close-btn')?.addEventListener('click', () => this.closeLeaderboard());
  }

  private openLeaderboard(): void {
    document.getElementById('settings')?.classList.add('hidden');
    this.hideForegroundOverlays();
    loadLeaderboard();
    document.getElementById('leaderboard')?.classList.remove('hidden');
  }

  private closeLeaderboard(): void {
    document.getElementById('leaderboard')?.classList.add('hidden');
    this.restoreForegroundOverlays();
  }

  // ─── Settings ───────────────────────────────

  bindSettingsButtons(): void {
    document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());
    document.getElementById('settings-close-btn')?.addEventListener('click', () => this.closeSettings());
  }

  private openSettings(): void {
    document.getElementById('leaderboard')?.classList.add('hidden');
    this.hideForegroundOverlays();
    this.initSoundTypeSelector();
    this.buildSoundPreviewGrid();
    document.getElementById('settings')?.classList.remove('hidden');
  }

  private closeSettings(): void {
    document.getElementById('settings')?.classList.add('hidden');
    this.restoreForegroundOverlays();
  }

  /** 記錄哪些前景 overlay 被暫時隱藏 */
  private savedOverlayStates: string[] = [];

  private hideForegroundOverlays(): void {
    // Don't overwrite if already saved (switching between leaderboard/settings)
    if (this.savedOverlayStates.length > 0) return;
    const ids = ['difficulty-select', 'game-over'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) {
        el.classList.add('hidden');
        this.savedOverlayStates.push(id);
      }
    }
  }

  private restoreForegroundOverlays(): void {
    for (const id of this.savedOverlayStates) {
      document.getElementById(id)?.classList.remove('hidden');
    }
    this.savedOverlayStates = [];
  }

  private initSoundTypeSelector(): void {
    const select = document.getElementById('sound-type-select') as HTMLSelectElement;
    if (!select) return;
    const newSelect = select.cloneNode(true) as HTMLSelectElement;
    select.parentNode?.replaceChild(newSelect, select);
    newSelect.value = this.audio.currentSoundType;
    newSelect.addEventListener('change', () => {
      this.audio.setSoundType(newSelect.value as SoundType);
    });
  }

  private buildSoundPreviewGrid(): void {
    const grid = document.getElementById('sound-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    ALL_SHAPES.forEach((shape: typeof ALL_SHAPES[number], level: number) => {
      const btn = document.createElement('button');
      btn.className = 'sound-preview-btn';
      btn.style.borderColor = shape.color;
      btn.style.color = shape.color;
      btn.style.boxShadow = `0 0 12px ${hexToRGBA(shape.color, 0.15)}, inset 0 0 12px ${hexToRGBA(shape.color, 0.08)}`;

      // Pure CSS shape preview (no PixiJS renderer needed)
      const shapeDiv = document.createElement('div');
      shapeDiv.style.width = '36px';
      shapeDiv.style.height = '36px';
      shapeDiv.style.borderRadius = '50%';
      shapeDiv.style.background = `radial-gradient(circle at 35% 35%, ${hexToRGBA(shape.color, 0.9)}, ${hexToRGBA(shape.color, 0.4)})`;
      shapeDiv.style.border = `2px solid ${shape.color}`;
      shapeDiv.style.boxShadow = `0 0 10px ${hexToRGBA(shape.color, 0.4)}, inset 0 0 8px ${hexToRGBA(shape.color, 0.2)}`;
      shapeDiv.style.flexShrink = '0';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'shape-name'; nameSpan.textContent = shape.name;
      const levelSpan = document.createElement('span');
      levelSpan.className = 'shape-level'; levelSpan.textContent = `Lv.${level}`;

      btn.appendChild(shapeDiv);
      btn.appendChild(nameSpan);
      btn.appendChild(levelSpan);

      btn.addEventListener('click', () => {
        btn.classList.remove('playing');
        void btn.offsetWidth;
        btn.classList.add('playing');
        this.audio.playMergeSound(level);
        setTimeout(() => btn.classList.remove('playing'), 500);
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.background = hexToRGBA(shape.color, 0.1);
        btn.style.boxShadow = `0 0 25px ${hexToRGBA(shape.color, 0.3)}, inset 0 0 20px ${hexToRGBA(shape.color, 0.15)}`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.boxShadow = `0 0 12px ${hexToRGBA(shape.color, 0.15)}, inset 0 0 12px ${hexToRGBA(shape.color, 0.08)}`;
      });

      grid.appendChild(btn);
    });
  }

  /** 載入已儲存的 Player ID */
  loadSavedPlayerId(): void {
    const savedId = localStorage.getItem('neonMergePlayerId');
    if (savedId) {
      const input = document.getElementById('player-id-input') as HTMLInputElement;
      if (input) input.value = savedId;
    }
  }
}
