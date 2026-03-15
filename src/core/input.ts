/* ============================================
   Input Manager — Mouse/Touch handling
   ============================================ */

export class InputManager {
  private _dropX = 0;
  private _canvasEl: HTMLCanvasElement | null = null;
  private _canvasW = 0;

  /** 目前指標的 x 座標（遊戲空間） */
  get dropX(): number { return this._dropX; }

  /** 設定 dropX（供外部直接調整） */
  set dropX(v: number) { this._dropX = v; }

  /** 綁定到 canvas，onDrop 在點擊/觸碰時呼叫 */
  bind(canvas: HTMLCanvasElement, canvasW: number, onDrop: (x: number) => void): void {
    this._canvasEl = canvas;
    this._canvasW = canvasW;

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this._dropX = this.getCanvasX(e.clientX);
    });

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this._dropX = this.getCanvasX(e.clientX);
      onDrop(this._dropX);
    });

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      this._dropX = this.getCanvasX(e.touches[0].clientX);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      this._dropX = this.getCanvasX(e.touches[0].clientX);
      onDrop(this._dropX);
    }, { passive: false });
  }

  private getCanvasX(clientX: number): number {
    if (!this._canvasEl) return 0;
    const rect = this._canvasEl.getBoundingClientRect();
    return (clientX - rect.left) * (this._canvasW / rect.width);
  }
}
