/* ============================================
   Physics System — Matter.js management
   ============================================ */

import Matter from 'matter-js';
import type { ShapeDef } from '@/data/types';
import {
  DESIGN_W, DESIGN_H, GAME_INSET_X, FLOOR_AREA_H,
  WALL_THICKNESS, PHYSICS_CONFIG, SHAPE_BODY_CONFIG, WALL_BODY_CONFIG,
} from '@/data/config';

const { Engine, Runner, Bodies, Body, Composite, Events } = Matter;

export class PhysicsSystem {
  engine!: Matter.Engine;
  runner!: Matter.Runner;

  private containerLeft: Matter.Body | null = null;
  private containerRight: Matter.Body | null = null;
  private containerBottom: Matter.Body | null = null;

  private readonly canvasW = DESIGN_W;
  private readonly gameAreaH = DESIGN_H - FLOOR_AREA_H;

  /** body id → shape level 的映射 */
  readonly bodyLevelMap = new Map<number, number>();

  /** 合成冷卻中的 body id */
  readonly mergeCooldown = new Set<number>();

  /** 建立引擎並開始運行 */
  create(onCollision: (event: Matter.IEventCollision<Matter.Engine>) => void): void {
    this.engine = Engine.create({
      gravity: PHYSICS_CONFIG.gravity,
      positionIterations: PHYSICS_CONFIG.positionIterations,
      velocityIterations: PHYSICS_CONFIG.velocityIterations,
      constraintIterations: PHYSICS_CONFIG.constraintIterations,
    });

    this.createWalls();
    Events.on(this.engine, 'collisionStart', onCollision);

    this.runner = Runner.create({ delta: PHYSICS_CONFIG.runnerDelta });
    Runner.run(this.runner, this.engine);
  }

  /** 停止引擎 */
  stop(): void {
    if (this.runner) Runner.stop(this.runner);
  }

  /** 清除所有 shape bodies */
  clearShapeBodies(): void {
    const bodies = Composite.allBodies(this.engine.world);
    for (const body of bodies) {
      if (this.bodyLevelMap.has(body.id)) {
        Composite.remove(this.engine.world, body);
      }
    }
    this.bodyLevelMap.clear();
    this.mergeCooldown.clear();
  }

  /** 建立牆壁 */
  private createWalls(): void {
    if (this.containerLeft) Composite.remove(this.engine.world, this.containerLeft);
    if (this.containerRight) Composite.remove(this.engine.world, this.containerRight);
    if (this.containerBottom) Composite.remove(this.engine.world, this.containerBottom);

    const opts = WALL_BODY_CONFIG;
    const lx = GAME_INSET_X;
    const rx = this.canvasW - GAME_INSET_X;
    const wt = WALL_THICKNESS;
    const h = DESIGN_H;

    this.containerLeft = Bodies.rectangle(lx - wt / 2 + 2, h / 2, wt, h * 3, opts);
    this.containerRight = Bodies.rectangle(rx + wt / 2 - 2, h / 2, wt, h * 3, opts);
    this.containerBottom = Bodies.rectangle(this.canvasW / 2, this.gameAreaH + wt / 2 - 2, this.canvasW * 3, wt, opts);

    Composite.add(this.engine.world, [this.containerLeft, this.containerRight, this.containerBottom]);
  }

  /** 建立形狀 body */
  createShapeBody(x: number, y: number, level: number, shapes: readonly ShapeDef[]): Matter.Body {
    const shape = shapes[level];
    return Bodies.circle(x, y, shape.radius + 3, {
      restitution: SHAPE_BODY_CONFIG.restitution,
      friction: SHAPE_BODY_CONFIG.friction,
      frictionStatic: SHAPE_BODY_CONFIG.frictionStatic,
      density: SHAPE_BODY_CONFIG.baseDensity + level * SHAPE_BODY_CONFIG.densityPerLevel,
      slop: SHAPE_BODY_CONFIG.slop,
      label: 'shape',
    });
  }

  /** 新增 body 到世界 */
  addBody(body: Matter.Body): void {
    Composite.add(this.engine.world, body);
  }

  /** 移除 body */
  removeBody(body: Matter.Body): void {
    Composite.remove(this.engine.world, body);
  }

  /** 設定 body 速度 */
  setVelocity(body: Matter.Body, velocity: { x: number; y: number }): void {
    Body.setVelocity(body, velocity);
  }

  /** 取得所有 bodies */
  getAllBodies(): Matter.Body[] {
    return Composite.allBodies(this.engine.world);
  }
}
