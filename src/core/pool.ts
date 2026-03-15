/* ============================================
   Object Pool — Generic reusable pool
   ============================================ */

export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private _activeCount = 0;

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
  ) {}

  acquire(): T {
    this._activeCount++;
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(item: T): void {
    this._activeCount--;
    this.reset(item);
    this.pool.push(item);
  }

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /** 清空池中所有物件，可選擇性 dispose */
  drain(dispose?: (item: T) => void): void {
    if (dispose) {
      for (const item of this.pool) {
        dispose(item);
      }
    }
    this.pool.length = 0;
    this._activeCount = 0;
  }

  get activeCount(): number { return this._activeCount; }
  get pooledCount(): number { return this.pool.length; }
}
