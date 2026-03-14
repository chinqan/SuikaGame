/* ============================================
   Neon Shape Merge – PixiJS v8 + Matter.js
   ============================================ */

// ─── Shape Definitions ───────────────────────
const ALL_SHAPES = [
  { name: 'Triangle', sides: 3, radius: 23, color: '#00FFFF', score: 1 },
  { name: 'Small Circle', sides: 0, radius: 29, color: '#FFFF00', score: 3 },
  { name: 'Square', sides: 4, radius: 36, color: '#FF6B6B', score: 6 },
  { name: 'Pentagon', sides: 5, radius: 47, color: '#39FF14', score: 10 },
  { name: 'Hexagon', sides: 6, radius: 57, color: '#FF8C00', score: 15 },
  { name: 'Circle', sides: 0, radius: 70, color: '#FF00FF', score: 21 },
  { name: 'Large Square', sides: 4, radius: 88, color: '#BF00FF', score: 28 },
  { name: 'Large Hexagon', sides: 6, radius: 104, color: '#00FF88', score: 36 },
  { name: 'Large Circle', sides: 0, radius: 125, color: '#FFFFFF', score: 50 },
];

let SHAPES = ALL_SHAPES;
let MAX_DROP_LEVEL = 4;
let currentDifficulty = 'hard';

// ─── Globals ─────────────────────────────────
const { Engine, Runner, Bodies, Body, Composite, Events } = Matter;

let engine, runner;
let app; // PixiJS Application
const DESIGN_W = 546, DESIGN_H = 779;
let canvasW = DESIGN_W, canvasH = DESIGN_H;
let wallThickness = 30;
let containerLeft, containerRight, containerBottom;
let gameOverLineY;

const gameInsetX = 35;
const floorAreaH = 70;
let gameAreaH;

let score = 0;
let highScore = parseInt(localStorage.getItem('neonMergeHigh') || '0');
let currentLevel = 0;
let nextLevel = 0;
let dropX = 0;
let canDrop = true;
let isGameOver = false;
let gameOverTimer = null;

let playerId = 'guest';
let gameStartTime = 0;
let currentSoundType = localStorage.getItem('neonMergeSoundType') || 'standard';

let particles = [];
let floatingTexts = [];
let comboCount = 0;
let comboTimer = null;
const COMBO_WINDOW = 1200;
let shakeAmount = 0;
let gridFlows = [];
let audioCtx = null;

const bodyLevelMap = new Map();
const mergeCooldown = new Set();

// PixiJS layer references
let bgContainer, wallGlowContainer, gameOverLineGfx, shapesContainer;
let particleContainer, uiContainer, aimGuideContainer;
let bodyGraphicsMap = new Map(); // Matter body id -> PIXI.Graphics

// Next preview & evo bar PixiJS apps
let nextApp, evoApp;

// ─── PixiJS helpers ──────────────────────────
function hexToNum(hex) {
  return parseInt(hex.slice(1), 16);
}

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildPolygonPoints(cx, cy, sides, r) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

function drawNeonShape(g, shape, r, withGlow) {
  const color = hexToNum(shape.color);
  g.clear();

  // Glow layers (3 layers of increasing alpha for neon effect)
  if (withGlow) {
    for (let i = 3; i >= 1; i--) {
      const glowR = r + i * 4;
      const alpha = 0.08 / i;
      if (shape.sides === 0) {
        g.circle(0, 0, glowR).fill({ color, alpha });
      } else {
        g.poly(buildPolygonPoints(0, 0, shape.sides, glowR)).fill({ color, alpha });
      }
    }
  }

  // Fill (very dim)
  if (shape.sides === 0) {
    g.circle(0, 0, r).fill({ color, alpha: 0.08 });
    g.circle(0, 0, r).stroke({ color, width: 6, alpha: 1 });
    // Inner ring
    g.circle(0, 0, r * 0.55).stroke({ color, width: 3, alpha: 0.2 });
  } else {
    const pts = buildPolygonPoints(0, 0, shape.sides, r);
    g.poly(pts).fill({ color, alpha: 0.08 });
    g.poly(pts).stroke({ color, width: 6, alpha: 1 });
    const innerPts = buildPolygonPoints(0, 0, shape.sides, r * 0.55);
    g.poly(innerPts).stroke({ color, width: 3, alpha: 0.2 });
  }
}

// ─── Init ────────────────────────────────────
async function init() {
  canvasW = DESIGN_W;
  canvasH = DESIGN_H;
  gameAreaH = canvasH - floorAreaH;
  gameOverLineY = 55;

  // Create main PixiJS app with fixed design resolution
  app = new PIXI.Application();
  await app.init({
    width: canvasW,
    height: canvasH,
    backgroundColor: 0x0a0a0f,
    antialias: true,
    resolution: 1,
    autoDensity: true,
  });
  const container = document.getElementById('game-canvas-container');
  container.appendChild(app.canvas);
  app.canvas.style.width = canvasW + 'px';
  app.canvas.style.height = canvasH + 'px';

  // Create layer containers
  bgContainer = new PIXI.Container();
  wallGlowContainer = new PIXI.Container();
  gameOverLineGfx = new PIXI.Graphics();
  shapesContainer = new PIXI.Container();
  particleContainer = new PIXI.Container();
  uiContainer = new PIXI.Container();
  aimGuideContainer = new PIXI.Container();

  app.stage.addChild(bgContainer, wallGlowContainer, gameOverLineGfx,
    shapesContainer, particleContainer, uiContainer, aimGuideContainer);

  // Input
  app.canvas.addEventListener('mousemove', onPointerMove);
  app.canvas.addEventListener('mousedown', onPointerDown);
  app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Buttons
  document.getElementById('restart-btn').addEventListener('click', restart);
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => selectDifficulty(btn.dataset.diff));
  });
  document.getElementById('leaderboard-btn').addEventListener('click', openLeaderboard);
  document.getElementById('leaderboard-close-btn').addEventListener('click', closeLeaderboard);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);

  const savedId = localStorage.getItem('neonMergePlayerId');
  if (savedId) document.getElementById('player-id-input').value = savedId;

  // Draw static backgrounds
  drawBgScene();
  drawWallGlow();
  drawGameOverLine();

  // Init next preview & evo bar
  await initNextPreview();
  await initEvoBar();

  window.addEventListener('resize', onResize);
  onResize(); // apply initial scale
  document.getElementById('difficulty-select').classList.remove('hidden');
}

async function initNextPreview() {
  nextApp = new PIXI.Application();
  await nextApp.init({ width: 80, height: 80, backgroundColor: 0x0a0a0f, backgroundAlpha: 0.3, antialias: true, resolution: 1, autoDensity: true });
  const nc = document.getElementById('next-container');
  nc.innerHTML = '';
  nc.appendChild(nextApp.canvas);
  nextApp.canvas.style.width = '80px';
  nextApp.canvas.style.height = '80px';
  nextApp.canvas.style.borderRadius = '8px';
  nextApp.canvas.style.border = '1px solid rgba(255,255,255,0.1)';
}

async function initEvoBar() {
  const evoW = DESIGN_W - 20;
  evoApp = new PIXI.Application();
  await evoApp.init({ width: evoW, height: 80, backgroundColor: 0x0a0a0f, backgroundAlpha: 0, antialias: true, resolution: 1, autoDensity: true });
  const ec = document.getElementById('evo-container');
  ec.innerHTML = '';
  ec.appendChild(evoApp.canvas);
  evoApp.canvas.style.width = evoW + 'px';
  evoApp.canvas.style.height = '80px';
}

function selectDifficulty(diff) {
  const idInput = document.getElementById('player-id-input');
  playerId = (idInput.value.trim() || 'guest').substring(0, 16);
  idInput.value = playerId;
  localStorage.setItem('neonMergePlayerId', playerId);
  currentDifficulty = diff;
  if (diff === 'easy') { SHAPES = ALL_SHAPES.slice(2); MAX_DROP_LEVEL = 3; }
  else if (diff === 'normal') { SHAPES = ALL_SHAPES.slice(1); MAX_DROP_LEVEL = 3; }
  else { SHAPES = ALL_SHAPES.slice(0); MAX_DROP_LEVEL = 4; }
  gameStartTime = Date.now();
  document.getElementById('difficulty-select').classList.add('hidden');
  startGame();
}

function startGame() {
  if (engine) {
    const bodies = Composite.allBodies(engine.world);
    for (const body of bodies) {
      if (bodyLevelMap.has(body.id)) Composite.remove(engine.world, body);
    }
    bodyLevelMap.clear();
    mergeCooldown.clear();
    Runner.stop(runner);
  }
  // Clear PixiJS shape graphics
  shapesContainer.removeChildren();
  bodyGraphicsMap.forEach(g => g.destroy());
  bodyGraphicsMap.clear();
  // Clear particles – 必須 destroy 釋放 PIXI/GPU 資源，不能只 removeChildren
  for (const p of particles) { p.display.destroy(); }
  particles.length = 0;
  particleContainer.removeChildren();
  // Clear floating texts – 同上
  for (const ft of floatingTexts) { ft.display.destroy(); }
  floatingTexts.length = 0;
  uiContainer.removeChildren();

  score = 0;
  document.getElementById('score-value').textContent = '0';
  isGameOver = false;
  canDrop = true;
  // 必須 clearTimeout，否則舊的 gameOver 計時器會在新遊戲中觸發
  if (gameOverTimer) { clearTimeout(gameOverTimer); gameOverTimer = null; }
  shakeAmount = 0;
  app.stage.x = 0; app.stage.y = 0;
  comboCount = 0;
  if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }
  // 歸還 gridFlow sprites 到物件池
  for (const f of gridFlows) { f.sprite.visible = false; _gridFlowPool.push(f.sprite); }
  gridFlows.length = 0;
  // 重置瞄準線（已預繪，不需 destroy，只需重新建立）
  if (aimLineGfx) { aimGuideContainer.removeChild(aimLineGfx); aimLineGfx.destroy(); aimLineGfx = null; }
  if (aimGhostGfx) { aimGuideContainer.removeChild(aimGhostGfx); aimGhostGfx.destroy(); aimGhostGfx = null; aimGhostLevel = -1; }

  engine = Engine.create({
    gravity: { x: 0, y: 2.2 },
    positionIterations: 12,
    velocityIterations: 10,
    constraintIterations: 4
  });
  createWalls();
  Events.on(engine, 'collisionStart', onCollision);

  currentLevel = randLevel();
  nextLevel = randLevel();
  runner = Runner.create({ delta: 1000 / 120 });
  Runner.run(runner, engine);

  drawNextPreview();
  drawEvolutionBar();
  document.getElementById('game-over').classList.add('hidden');

  // Start game loop via ticker（恢復 triggerGameOver 停止的渲染器）
  app.ticker.start();
  app.ticker.remove(gameLoop);
  app.ticker.add(gameLoop);
}

// ─── Resize ──────────────────────────────────
function onResize() {
  const wrapper = document.getElementById('game-wrapper');
  // Calculate uniform scale to fit viewport
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  // Get wrapper's natural size (fixed design)
  wrapper.style.transform = 'none';
  const naturalW = wrapper.offsetWidth;
  const naturalH = wrapper.offsetHeight;
  const scaleX = viewW / naturalW;
  const scaleY = viewH / naturalH;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale beyond 1
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = 'top center';
}

// ─── Walls ───────────────────────────────────
function createWalls() {
  if (containerLeft) Composite.remove(engine.world, containerLeft);
  if (containerRight) Composite.remove(engine.world, containerRight);
  if (containerBottom) Composite.remove(engine.world, containerBottom);
  const opts = { isStatic: true, friction: 1.0, restitution: 0.1, frictionStatic: 1.0 };
  containerLeft = Bodies.rectangle(gameInsetX - wallThickness / 2 + 2, canvasH / 2, wallThickness, canvasH * 3, opts);
  containerRight = Bodies.rectangle(canvasW - gameInsetX + wallThickness / 2 - 2, canvasH / 2, wallThickness, canvasH * 3, opts);
  containerBottom = Bodies.rectangle(canvasW / 2, gameAreaH + wallThickness / 2 - 2, canvasW * 3, wallThickness, opts);
  Composite.add(engine.world, [containerLeft, containerRight, containerBottom]);
}

function randLevel() { return Math.floor(Math.random() * (MAX_DROP_LEVEL + 1)); }

// ─── Drop Shape ──────────────────────────────
function dropShape(x) {
  if (!canDrop || isGameOver) return;
  canDrop = false;
  const level = currentLevel;
  const shape = SHAPES[level];
  x = Math.max(gameInsetX + shape.radius + 4, Math.min(canvasW - gameInsetX - shape.radius - 4, x));
  const body = createShapeBody(x, -shape.radius, level);
  bodyLevelMap.set(body.id, level);
  Composite.add(engine.world, body);

  // Create PixiJS graphics for this body
  const g = new PIXI.Graphics();
  drawNeonShape(g, shape, shape.radius, true);
  g.x = x;
  g.y = -shape.radius;
  shapesContainer.addChild(g);
  bodyGraphicsMap.set(body.id, g);

  playDropSound();
  currentLevel = nextLevel;
  nextLevel = randLevel();
  drawNextPreview();
  setTimeout(() => { canDrop = true; }, 450);
}

function createShapeBody(x, y, level) {
  const shape = SHAPES[level];
  return Bodies.circle(x, y, shape.radius, {
    restitution: 0.15, friction: 0.6, frictionStatic: 0.8,
    density: 0.0015 + level * 0.0004, slop: 0.005, label: 'shape'
  });
}

// ─── Collision → Merge ───────────────────────
function onCollision(event) {
  for (const pair of event.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    if (a.label !== 'shape' || b.label !== 'shape') continue;
    const levelA = bodyLevelMap.get(a.id), levelB = bodyLevelMap.get(b.id);
    if (levelA === undefined || levelB === undefined || levelA !== levelB) continue;
    if (mergeCooldown.has(a.id) || mergeCooldown.has(b.id)) continue;
    mergeCooldown.add(a.id); mergeCooldown.add(b.id);

    const level = levelA;
    const newLevel = level + 1;
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;

    // Remove old bodies & graphics
    Composite.remove(engine.world, a); Composite.remove(engine.world, b);
    bodyLevelMap.delete(a.id); bodyLevelMap.delete(b.id);
    mergeCooldown.delete(a.id); mergeCooldown.delete(b.id);
    const gA = bodyGraphicsMap.get(a.id); if (gA) { shapesContainer.removeChild(gA); gA.destroy(); }
    const gB = bodyGraphicsMap.get(b.id); if (gB) { shapesContainer.removeChild(gB); gB.destroy(); }
    bodyGraphicsMap.delete(a.id); bodyGraphicsMap.delete(b.id);

    let gained = newLevel < SHAPES.length ? SHAPES[newLevel].score : 80;
    score += gained;
    document.getElementById('score-value').textContent = score;

    comboCount++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { comboCount = 0; comboTimer = null; }, COMBO_WINDOW);

    const scoreColor = newLevel < SHAPES.length ? SHAPES[newLevel].color : '#FFFFFF';
    spawnFloatingText(mx, my, '+' + gained, scoreColor);
    if (comboCount >= 2) spawnFloatingText(mx, my - 30, 'COMBO x' + comboCount, '#FFD700', comboCount);

    if (newLevel < SHAPES.length) {
      const newBody = createShapeBody(mx, my, newLevel);
      bodyLevelMap.set(newBody.id, newLevel);
      Composite.add(engine.world, newBody);
      Body.setVelocity(newBody, { x: (Math.random() - 0.5) * 1.5, y: -1.5 });
      const ng = new PIXI.Graphics();
      drawNeonShape(ng, SHAPES[newLevel], SHAPES[newLevel].radius, true);
      ng.x = mx; ng.y = my;
      shapesContainer.addChild(ng);
      bodyGraphicsMap.set(newBody.id, ng);
    }

    spawnMergeParticles(mx, my, level);
    playMergeSound(level);
    shakeAmount = 4 + level * 1.5 + comboCount * 0.5;
  }
}

// ─── Floating text ───────────────────────────
function spawnFloatingText(x, y, text, color, comboNum) {
  const fontSize = comboNum ? (28 + comboNum * 4) : 22;
  const t = new PIXI.Text({
    text, style: {
      fontFamily: 'Orbitron, sans-serif', fontSize, fontWeight: 'bold',
      fill: color, align: 'center',
    }
  });
  t.anchor.set(0.5);
  t.x = x; t.y = y;
  t.scale.set(0.5);
  uiContainer.addChild(t);
  floatingTexts.push({
    display: t, life: 1, decay: 0.018,
    vy: comboNum ? (-4.5 - comboNum * 0.3) : -2.5,
    targetScale: 1.2
  });
}

// ─── Particle System ─────────────────────────
function spawnMergeParticles(x, y, level) {
  const shape = SHAPES[level];
  const color = hexToNum(shape.color);

  // Ring — 畫一次固定大小，之後用 scale 放大（避免 PixiJS v8 clear/redraw 洩漏）
  const ringBaseR = 5;
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, ringBaseR).stroke({ color: hexToNum(shape.color), width: 4, alpha: 0.7 });
  ring.x = x; ring.y = y;
  particleContainer.addChild(ring);
  particles.push({ type: 'ring', display: ring, radius: ringBaseR, baseRadius: ringBaseR, maxRadius: shape.radius * 3.5, life: 1, decay: 0.04, color: shape.color, lineWidth: 4 });

  // Shards
  const shardCount = 8 + level * 2;
  for (let i = 0; i < shardCount; i++) {
    const angle = (Math.PI * 2 * i) / shardCount + (Math.random() - 0.5) * 0.4;
    const speed = 3 + Math.random() * 6;
    const g = new PIXI.Graphics();
    const sc = 0.18 + Math.random() * 0.15;
    drawNeonShape(g, shape, shape.radius, false);
    g.x = x; g.y = y; g.scale.set(sc); g.rotation = Math.random() * Math.PI * 2;
    particleContainer.addChild(g);
    particles.push({
      type: 'shard', display: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      life: 1, decay: 0.012 + Math.random() * 0.015, rotSpeed: (Math.random() - 0.5) * 0.3, initScale: sc
    });
  }

  // Dots
  const dotCount = 16 + level * 3;
  for (let i = 0; i < dotCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;
    const sz = 2 + Math.random() * 5;
    const g = new PIXI.Graphics();
    g.circle(0, 0, sz).fill({ color });
    g.x = x; g.y = y;
    particleContainer.addChild(g);
    particles.push({
      type: 'dot', display: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      life: 1, decay: 0.015 + Math.random() * 0.02
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay;
    if (p.life <= 0) {
      particleContainer.removeChild(p.display); p.display.destroy();
      particles[i] = particles[particles.length - 1]; particles.pop();
      continue;
    }
    if (p.type === 'ring') {
      p.radius += (p.maxRadius - p.radius) * 0.15;
      // 用 scale 控制 ring 大小，不再 clear/redraw（PixiJS v8 clear 洩漏）
      const sc = p.radius / p.baseRadius;
      p.display.scale.set(sc);
      p.display.alpha = p.life * 0.7;
    } else {
      p.display.x += p.vx; p.display.y += p.vy;
      p.vy += 0.08;
      p.display.alpha = p.life;
      if (p.type === 'shard') {
        p.display.rotation += p.rotSpeed;
        p.display.scale.set(p.initScale * p.life);
      }
    }
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= ft.decay;
    if (ft.life <= 0) { uiContainer.removeChild(ft.display); ft.display.destroy(); floatingTexts[i] = floatingTexts[floatingTexts.length - 1]; floatingTexts.pop(); continue; }
    ft.display.y += ft.vy;
    ft.vy *= 0.97;
    ft.display.alpha = ft.life;
    const s = Math.min(ft.display.scale.x + 0.08, ft.targetScale);
    ft.display.scale.set(s);
  }
}

// ─── Draw static scenes ─────────────────────
function drawBgScene() {
  bgContainer.removeChildren();
  const g = new PIXI.Graphics();
  const lx = gameInsetX, rx = canvasW - gameInsetX;

  // Game area bg
  g.rect(lx, 0, rx - lx, gameAreaH).fill({ color: 0x0f0f23, alpha: 0.4 });

  // Vertical grid lines inside game area
  const step = 45;
  for (let x = lx + step; x < rx; x += step) {
    g.moveTo(x, 0).lineTo(x, gameAreaH).stroke({ color: 0xffffff, width: 1, alpha: 0.025 });
  }

  // 3D perspective floor
  const farY = gameAreaH - 30, farL = lx, farR = rx;
  const nearY = canvasH, nearL = -220, nearR = canvasW + 220;
  const hLines = 8, vLines = 10;

  for (let i = 1; i <= hLines; i++) {
    const t = i / hLines;
    const tC = 1 - Math.pow(1 - t, 2.5);
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

  bgContainer.addChild(g);
}

function drawWallGlow() {
  wallGlowContainer.removeChildren();
  const g = new PIXI.Graphics();
  const lx = gameInsetX, rx = canvasW - gameInsetX;

  // Left/Right wall glow lines
  g.moveTo(lx, 0).lineTo(lx, gameAreaH).stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });
  g.moveTo(rx, 0).lineTo(rx, gameAreaH).stroke({ color: 0x00ffff, width: 2, alpha: 0.6 });
  // Bottom floor line
  g.moveTo(lx, gameAreaH).lineTo(rx, gameAreaH).stroke({ color: 0x00ffff, width: 2.5, alpha: 0.7 });

  wallGlowContainer.addChild(g);
}

function drawGameOverLine() {
  gameOverLineGfx.clear();
  // Dashed line simulation with small segments
  const lx = gameInsetX, rx = canvasW - gameInsetX;
  let x = lx;
  while (x < rx) {
    const end = Math.min(x + 8, rx);
    gameOverLineGfx.moveTo(x, gameOverLineY).lineTo(end, gameOverLineY)
      .stroke({ color: 0xff3131, width: 1.5, alpha: 0.35 });
    x += 14;
  }
}

// ─── Aim Guide ───────────────────────────────
let aimLineGfx = null, aimGhostGfx = null, aimGhostLevel = -1;
function drawAimGuide() {
  if (!canDrop || isGameOver) {
    if (aimLineGfx) aimLineGfx.visible = false;
    if (aimGhostGfx) aimGhostGfx.visible = false;
    return;
  }
  const shape = SHAPES[currentLevel];
  const r = shape.radius;
  const x = Math.max(gameInsetX + r + 4, Math.min(canvasW - gameInsetX - r - 4, dropX));

  // 預先建立一條垂直線（x=0），只移動位置，不再每幀 clear/redraw
  if (!aimLineGfx) {
    aimLineGfx = new PIXI.Graphics();
    aimLineGfx.moveTo(0, 0).lineTo(0, gameAreaH).stroke({ color: 0xffffff, width: 1, alpha: 0.10 });
    aimGuideContainer.addChild(aimLineGfx);
  }
  aimLineGfx.visible = true;
  aimLineGfx.x = x;

  // Reuse or create ghost graphics (only recreate when level changes)
  if (!aimGhostGfx || aimGhostLevel !== currentLevel) {
    if (aimGhostGfx) { aimGuideContainer.removeChild(aimGhostGfx); aimGhostGfx.destroy(); }
    aimGhostGfx = new PIXI.Graphics();
    drawNeonShape(aimGhostGfx, shape, r, false);
    aimGhostGfx.alpha = 0.55;
    aimGuideContainer.addChild(aimGhostGfx);
    aimGhostLevel = currentLevel;
  }
  aimGhostGfx.visible = true;
  aimGhostGfx.x = x; aimGhostGfx.y = r + 8;
}

// ─── Grid Flows (animated) ───────────────────
let gridFlowGfx = null;
let _glowTexture = null;
const _gridFlowPool = []; // Sprite pool

function getGlowTexture() {
  if (_glowTexture) return _glowTexture;
  const g = new PIXI.Graphics();
  g.circle(0, 0, 16).fill({ color: 0xffffff, alpha: 1 });
  const renderer = app.renderer;
  _glowTexture = renderer.generateTexture({ target: g, resolution: 1 });
  g.destroy();
  return _glowTexture;
}

function spawnGridFlow() {
  const isH = Math.random() < 0.6;
  const flow = {
    t: Math.random() * 0.2, speed: 0.001 + Math.random() * 0.002,
    lineIdx: isH ? Math.floor(Math.random() * 8) + 1 : Math.floor(Math.random() * 11),
    isHorizontal: isH, size: 2.5 + Math.random() * 4.5, brightness: 0.7 + Math.random() * 0.3,
    sprite: null
  };
  // Get or create sprite from pool
  if (_gridFlowPool.length > 0) {
    flow.sprite = _gridFlowPool.pop();
    flow.sprite.visible = true;
  } else {
    const tex = getGlowTexture();
    flow.sprite = new PIXI.Sprite(tex);
    flow.sprite.anchor.set(0.5);
    flow.sprite.tint = 0x00ffff;
    bgContainer.addChild(flow.sprite);
  }
  gridFlows.push(flow);
}

function updateGridFlows() {
  if (!isGameOver && gridFlows.length < 20 && Math.random() < 0.06) spawnGridFlow();
  const lx = gameInsetX, rx = canvasW - gameInsetX;
  const farY = gameAreaH - 30, farL = lx, farR = rx;
  const nearY = canvasH, nearL = -220, nearR = canvasW + 220;
  const hLines = 8, vLines = 10;

  for (let i = gridFlows.length - 1; i >= 0; i--) {
    const f = gridFlows[i];
    f.t += f.speed;
    if (f.t > 1) {
      // Return sprite to pool
      f.sprite.visible = false;
      _gridFlowPool.push(f.sprite);
      gridFlows[i] = gridFlows[gridFlows.length - 1];
      gridFlows.pop();
      continue;
    }
    let px, py;
    if (f.isHorizontal) {
      const t = f.lineIdx / hLines;
      const tC = 1 - Math.pow(1 - t, 2.5);
      const lineY = nearY + (farY - nearY) * tC;
      const lineL = nearL + (farL - nearL) * tC;
      const lineR = nearR + (farR - nearR) * tC;
      px = lineL + (lineR - lineL) * f.t; py = lineY;
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
    f.sprite.scale.set(f.size / 16); // 16 = texture radius
  }
}

// ─── Game Loop ───────────────────────────────
function gameLoop() {
  updateParticles();
  updateGridFlows();
  checkGameOver();

  if (shakeAmount > 0) {
    app.stage.x = (Math.random() - 0.5) * shakeAmount * 2;
    app.stage.y = (Math.random() - 0.5) * shakeAmount * 2;
    shakeAmount *= 0.85;
    if (shakeAmount < 0.3) { shakeAmount = 0; app.stage.x = 0; app.stage.y = 0; }
  }

  // Sync Matter.js body positions to PixiJS Graphics
  const bodies = Composite.allBodies(engine.world);
  for (const body of bodies) {
    const g = bodyGraphicsMap.get(body.id);
    if (g) { g.x = body.position.x; g.y = body.position.y; g.rotation = body.angle; }
  }

  drawAimGuide();
}

// ─── Next Shape Preview ──────────────────────
function drawNextPreview() {
  if (!nextApp) return;
  // destroy 舊物件以釋放 GPU/記憶體資源
  for (const child of nextApp.stage.children) child.destroy();
  nextApp.stage.removeChildren();
  const shape = SHAPES[nextLevel];
  const scale = 28 / shape.radius;
  const g = new PIXI.Graphics();
  drawNeonShape(g, shape, shape.radius, true);
  g.x = 40; g.y = 40;
  g.scale.set(scale);
  nextApp.stage.addChild(g);
}

// ─── Evolution Bar ───────────────────────────
function drawEvolutionBar() {
  if (!evoApp) return;
  // destroy 舊物件以釋放 GPU/記憶體資源
  for (const child of evoApp.stage.children) child.destroy();
  evoApp.stage.removeChildren();
  const count = SHAPES.length;
  const w = DESIGN_W - 20;
  const h = 80;
  const minR = 11, maxR = 34;

  // Step 1: Calculate each shape's display radius (small → large)
  const radii = [];
  for (let i = 0; i < count; i++) {
    radii.push(minR + (maxR - minR) * (i / (count - 1)));
  }

  // Step 2: Each shape's slot width = its display diameter (2*r)
  const diameters = radii.map(r => r * 2);
  const totalDiameters = diameters.reduce((sum, d) => sum + d, 0);

  // Step 3: Scale slots to fit available width
  const slotScale = w / totalDiameters;

  // Step 4: Place each shape centered in its slot
  let curX = 0;
  for (let i = 0; i < count; i++) {
    const shape = SHAPES[i];
    const displayR = radii[i];
    const slotW = diameters[i] * slotScale;
    const x = curX + slotW / 2;  // center of this slot
    const y = h / 2;              // vertical center
    const scale = displayR / shape.radius;
    const g = new PIXI.Graphics();
    drawNeonShape(g, shape, shape.radius, true);
    g.x = x; g.y = y;
    g.scale.set(scale);
    evoApp.stage.addChild(g);
    curX += slotW;
  }
}

// ─── Game Over ───────────────────────────────
function checkGameOver() {
  if (isGameOver) return;
  const bodies = Composite.allBodies(engine.world);
  let aboveLine = false;
  for (const body of bodies) {
    if (bodyLevelMap.has(body.id) && body.position.y < gameOverLineY && body.speed < 1.5) { aboveLine = true; break; }
  }
  if (aboveLine) {
    if (!gameOverTimer) gameOverTimer = setTimeout(() => triggerGameOver(), 1500);
  } else {
    if (gameOverTimer) { clearTimeout(gameOverTimer); gameOverTimer = null; }
  }
}

function triggerGameOver() {
  isGameOver = true;
  // 停止遊戲循環和物理引擎
  app.ticker.remove(gameLoop);
  if (runner) Runner.stop(runner);
  // 完全停止 PixiJS 渲染器，閒置畫面不再消耗 GPU
  app.ticker.stop();
  if (score > highScore) { highScore = score; localStorage.setItem('neonMergeHigh', highScore.toString()); }
  document.getElementById('final-score').textContent = score;
  document.getElementById('high-score').textContent = highScore;
  document.getElementById('game-over').classList.remove('hidden');
  const playTimeSec = Math.round((Date.now() - gameStartTime) / 1000);
  submitScore(playerId, score, currentDifficulty, playTimeSec);
}

function restart() {
  app.ticker.remove(gameLoop);
  if (runner) Runner.stop(runner);
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('difficulty-select').classList.remove('hidden');
}

// ─── Input ───────────────────────────────────
function getCanvasX(clientX) {
  const rect = app.canvas.getBoundingClientRect();
  return (clientX - rect.left) * (canvasW / rect.width);
}
function onPointerMove(e) { dropX = getCanvasX(e.clientX); }
function onPointerDown(e) {
  dropX = getCanvasX(e.clientX);
  const shape = SHAPES[currentLevel];
  dropShape(Math.max(shape.radius + 4, Math.min(canvasW - shape.radius - 4, dropX)));
}
function onTouchMove(e) { e.preventDefault(); dropX = getCanvasX(e.touches[0].clientX); }
function onTouchStart(e) {
  e.preventDefault(); dropX = getCanvasX(e.touches[0].clientX);
  const shape = SHAPES[currentLevel];
  dropShape(Math.max(shape.radius + 4, Math.min(canvasW - shape.radius - 4, dropX)));
}

// ─── Audio ───────────────────────────────────
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// AudioBuffer 快取：避免每次合成都重新 allocate 大型 ArrayBuffer（每個約 50~150KB）
const _noiseBufCache = new Map();
function getNoiseBuffer(key, numFrames, fillFn) {
  if (_noiseBufCache.has(key)) return _noiseBufCache.get(key);
  ensureAudioCtx();
  const buf = audioCtx.createBuffer(1, numFrames, audioCtx.sampleRate);
  fillFn(buf.getChannelData(0), numFrames);
  _noiseBufCache.set(key, buf);
  return buf;
}

// 用 onended 事件觸發全部 disconnect，讓 AudioNode 立即進入 GC young generation
// primarySrc: OscillatorNode 或 AudioBufferSourceNode（有 onended）
// ...nodes: 所有需要清理的節點（包含 primarySrc 本身）
function autoDisconnect(node, duration) {
  // 保留相容性：僅在 onended 不適用時作為後備
  setTimeout(() => { try { node.disconnect(); } catch (e) {} }, (duration + 0.15) * 1000);
}
function setOnEnded(primarySrc, ...nodes) {
  primarySrc.onended = () => {
    nodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
  };
}

function playDropSound() {
  ensureAudioCtx();
  const t = audioCtx.currentTime;
  const dur = 0.12;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + dur);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur);
  setOnEnded(osc, osc, gain);
}

function playMergeSound(level) {
  const handlers = {
    standard: playMergeSoundStandard, crystal: playMergeSoundCrystal,
    waterdrop: playMergeSoundWaterDrop, bomb: playMergeSoundBomb,
    stone: playMergeSoundStone, cosmic: playMergeSoundCosmic
  };
  (handlers[currentSoundType] || playMergeSoundStandard)(level);
}

function playMergeSoundStandard(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.7 + level * 0.1;
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-20, t); comp.knee.setValueAtTime(10, t);
  comp.ratio.setValueAtTime(12, t); comp.attack.setValueAtTime(0, t);
  comp.release.setValueAtTime(0.1, t); comp.connect(audioCtx.destination);
  const noiseDur = 0.3 + level * 0.03;
  const bufSz = Math.floor(audioCtx.sampleRate * noiseDur);
  const nBuf = getNoiseBuffer(`std_noise_${level}`, bufSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  });
  const nSrc = audioCtx.createBufferSource(); nSrc.buffer = nBuf;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.5 * intensity, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  const lpf = audioCtx.createBiquadFilter(); lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(3000 + level * 400, t);
  lpf.frequency.exponentialRampToValueAtTime(300, t + noiseDur);
  nSrc.connect(lpf).connect(nGain).connect(comp); nSrc.start(t); nSrc.stop(t + noiseDur);
  setOnEnded(nSrc, nSrc, lpf, nGain);
  const subO = audioCtx.createOscillator(); const subG = audioCtx.createGain();
  subO.type = 'sine'; subO.frequency.setValueAtTime(100, t);
  subO.frequency.exponentialRampToValueAtTime(20, t + 0.3);
  subG.gain.setValueAtTime(0.6 * intensity, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  subO.connect(subG).connect(comp); subO.start(t); subO.stop(t + 0.35);
  setOnEnded(subO, subO, subG);
  const mFreq = 800 + level * 150; const mO = audioCtx.createOscillator();
  const mG = audioCtx.createGain(); mO.type = 'square';
  mO.frequency.setValueAtTime(mFreq, t);
  mO.frequency.exponentialRampToValueAtTime(mFreq * 0.3, t + 0.08);
  mG.gain.setValueAtTime(0.2 * intensity, t);
  mG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  const hpf = audioCtx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 600;
  mO.connect(hpf).connect(mG).connect(comp); mO.start(t); mO.stop(t + 0.1);
  setOnEnded(mO, mO, hpf, mG);
  const rFreq = 300 + level * 80; const rO = audioCtx.createOscillator();
  const rG = audioCtx.createGain(); rO.type = 'sine';
  rO.frequency.setValueAtTime(rFreq, t + 0.05);
  rO.frequency.exponentialRampToValueAtTime(rFreq * 3, t + 0.4);
  rG.gain.setValueAtTime(0.001, t);
  rG.gain.linearRampToValueAtTime(0.15 * intensity, t + 0.08);
  rG.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  rO.connect(rG).connect(comp); rO.start(t); rO.stop(t + 0.45);
  // rO 是最後停止的節點，由它負責 disconnect comp
  setOnEnded(rO, rO, rG, comp);
}

function playMergeSoundCrystal(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.6 + level * 0.08;
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-12, t); comp.knee.setValueAtTime(4, t);
  comp.ratio.setValueAtTime(6, t); comp.attack.setValueAtTime(0.001, t);
  comp.release.setValueAtTime(0.15, t); comp.connect(audioCtx.destination);
  const clickDur = 0.012;
  const clickSz = Math.floor(audioCtx.sampleRate * clickDur);
  const clickBuf = getNoiseBuffer(`cry_click_${level}`, clickSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 8);
  });
  const clickSrc = audioCtx.createBufferSource(); clickSrc.buffer = clickBuf;
  const clickGain = audioCtx.createGain();
  clickGain.gain.setValueAtTime(0.7 * intensity, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
  const clickHPF = audioCtx.createBiquadFilter(); clickHPF.type = 'highpass';
  clickHPF.frequency.setValueAtTime(2000, t); clickHPF.Q.setValueAtTime(1.5, t);
  clickSrc.connect(clickHPF).connect(clickGain).connect(comp);
  clickSrc.start(t); clickSrc.stop(t + clickDur);
  setOnEnded(clickSrc, clickSrc, clickHPF, clickGain);
  const pingFreq = 3200 - level * 180; const pingDur = 0.15 + level * 0.025;
  const pingO = audioCtx.createOscillator(); const pingG = audioCtx.createGain();
  pingO.type = 'sine'; pingO.frequency.setValueAtTime(pingFreq, t);
  pingO.frequency.exponentialRampToValueAtTime(pingFreq * 0.7, t + pingDur);
  pingG.gain.setValueAtTime(0.35 * intensity, t);
  pingG.gain.setValueAtTime(0.35 * intensity, t + 0.003);
  pingG.gain.exponentialRampToValueAtTime(0.001, t + pingDur);
  const pingBPF = audioCtx.createBiquadFilter(); pingBPF.type = 'bandpass';
  pingBPF.frequency.setValueAtTime(pingFreq, t); pingBPF.Q.setValueAtTime(3, t);
  pingO.connect(pingBPF).connect(pingG).connect(comp); pingO.start(t); pingO.stop(t + pingDur);
  setOnEnded(pingO, pingO, pingBPF, pingG);
  const resDur = 0.25 + level * 0.04; const resBase = 1800 - level * 100; const detune = 12 + level * 3;
  for (let d = 0; d < 2; d++) {
    const resO = audioCtx.createOscillator(); const resG = audioCtx.createGain();
    resO.type = 'triangle';
    resO.frequency.setValueAtTime(resBase + (d === 0 ? detune : -detune), t);
    resG.gain.setValueAtTime(0.12 * intensity, t + 0.002);
    resG.gain.exponentialRampToValueAtTime(0.001, t + resDur);
    resO.connect(resG).connect(comp); resO.start(t); resO.stop(t + resDur);
    setOnEnded(resO, resO, resG);
  }
  const shimFreq = 5000 + level * 300; const shimDur = 0.4 + level * 0.05;
  const shimO = audioCtx.createOscillator(); const shimG = audioCtx.createGain();
  shimO.type = 'sine'; shimO.frequency.setValueAtTime(shimFreq, t + 0.01);
  shimO.frequency.exponentialRampToValueAtTime(shimFreq * 0.5, t + shimDur);
  shimG.gain.setValueAtTime(0.001, t);
  shimG.gain.linearRampToValueAtTime(0.06 * intensity, t + 0.02);
  shimG.gain.exponentialRampToValueAtTime(0.001, t + shimDur);
  shimO.connect(shimG).connect(comp); shimO.start(t); shimO.stop(t + shimDur);
  const thudO = audioCtx.createOscillator(); const thudG = audioCtx.createGain();
  thudO.type = 'sine'; thudO.frequency.setValueAtTime(180 + level * 15, t);
  thudO.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  thudG.gain.setValueAtTime(0.15 * intensity, t);
  thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  thudO.connect(thudG).connect(comp); thudO.start(t); thudO.stop(t + 0.08);
  setOnEnded(thudO, thudO, thudG);
  // shimO 最後停止，由它負責 disconnect comp
  setOnEnded(shimO, shimO, shimG, comp);
}

function playMergeSoundWaterDrop(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.5 + level * 0.06;
  const dropFreq = 1800 - level * 120; const dropDur = 0.08 + level * 0.01;
  const dropO = audioCtx.createOscillator(); const dropG = audioCtx.createGain();
  dropO.type = 'sine'; dropO.frequency.setValueAtTime(dropFreq, t);
  dropO.frequency.exponentialRampToValueAtTime(dropFreq * 0.25, t + dropDur);
  dropG.gain.setValueAtTime(0.5 * intensity, t);
  dropG.gain.exponentialRampToValueAtTime(0.001, t + dropDur);
  dropO.connect(dropG).connect(audioCtx.destination); dropO.start(t); dropO.stop(t + dropDur);
  setOnEnded(dropO, dropO, dropG);
  const rippleDur = 0.35 + level * 0.04;
  for (let i = 0; i < 2; i++) {
    const ripO = audioCtx.createOscillator(); const ripG = audioCtx.createGain();
    ripO.type = 'sine'; const rFreq = (600 - level * 30) + (i === 0 ? 8 : -8);
    ripO.frequency.setValueAtTime(rFreq, t + 0.02);
    ripO.frequency.exponentialRampToValueAtTime(rFreq * 0.4, t + rippleDur);
    ripG.gain.setValueAtTime(0.001, t);
    ripG.gain.linearRampToValueAtTime(0.12 * intensity, t + 0.03);
    ripG.gain.exponentialRampToValueAtTime(0.001, t + rippleDur);
    ripO.connect(ripG).connect(audioCtx.destination); ripO.start(t + 0.02); ripO.stop(t + rippleDur);
    setOnEnded(ripO, ripO, ripG);
  }
  const splashDur = 0.1 + level * 0.015;
  const splSz = Math.floor(audioCtx.sampleRate * splashDur);
  const splBuf = getNoiseBuffer(`wdrop_spl_${level}`, splSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  });
  const splSrc = audioCtx.createBufferSource(); splSrc.buffer = splBuf;
  const splG = audioCtx.createGain();
  splG.gain.setValueAtTime(0.08 * intensity, t + 0.01);
  splG.gain.exponentialRampToValueAtTime(0.001, t + splashDur);
  const splBPF = audioCtx.createBiquadFilter(); splBPF.type = 'bandpass';
  splBPF.frequency.setValueAtTime(3000, t); splBPF.Q.setValueAtTime(2, t);
  splSrc.connect(splBPF).connect(splG).connect(audioCtx.destination);
  splSrc.start(t + 0.01); splSrc.stop(t + splashDur + 0.01);
  setOnEnded(splSrc, splSrc, splBPF, splG);
  const shimDur = 0.5 + level * 0.03;
  const shimO = audioCtx.createOscillator(); const shimG = audioCtx.createGain();
  shimO.type = 'sine'; shimO.frequency.setValueAtTime(4000 + level * 200, t + 0.05);
  shimO.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
  shimG.gain.setValueAtTime(0.001, t);
  shimG.gain.linearRampToValueAtTime(0.04 * intensity, t + 0.08);
  shimG.gain.exponentialRampToValueAtTime(0.001, t + shimDur);
  shimO.connect(shimG).connect(audioCtx.destination);
  shimO.start(t + 0.05); shimO.stop(t + shimDur);
  setOnEnded(shimO, shimO, shimG);
}

function playMergeSoundBomb(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.55 + level * 0.07;
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-15, t); comp.knee.setValueAtTime(6, t);
  comp.ratio.setValueAtTime(8, t); comp.attack.setValueAtTime(0.001, t);
  comp.release.setValueAtTime(0.2, t); comp.connect(audioCtx.destination);
  const subDur = 0.25 + level * 0.03;
  const subO = audioCtx.createOscillator(); const subG = audioCtx.createGain();
  subO.type = 'sine'; subO.frequency.setValueAtTime(60 + level * 5, t);
  subO.frequency.exponentialRampToValueAtTime(25, t + subDur);
  subG.gain.setValueAtTime(0.5 * intensity, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + subDur);
  subO.connect(subG).connect(comp); subO.start(t); subO.stop(t + subDur);
  setOnEnded(subO, subO, subG);
  const clickDur = 0.02;
  const clickSz = Math.floor(audioCtx.sampleRate * clickDur);
  const clickBuf = getNoiseBuffer(`bomb_click_${level}`, clickSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  });
  const clickSrc = audioCtx.createBufferSource(); clickSrc.buffer = clickBuf;
  const clickG = audioCtx.createGain();
  clickG.gain.setValueAtTime(0.4 * intensity, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
  clickSrc.connect(clickG).connect(comp); clickSrc.start(t); clickSrc.stop(t + clickDur);
  setOnEnded(clickSrc, clickSrc, clickG);
  const crklDur = 0.4 + level * 0.05;
  const crklSz = Math.floor(audioCtx.sampleRate * crklDur);
  const crklBuf = getNoiseBuffer(`bomb_crkl_${level}`, crklSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  });
  const crklSrc = audioCtx.createBufferSource(); crklSrc.buffer = crklBuf;
  const crklG = audioCtx.createGain();
  crklG.gain.setValueAtTime(0.001, t);
  crklG.gain.linearRampToValueAtTime(0.15 * intensity, t + 0.03);
  crklG.gain.exponentialRampToValueAtTime(0.001, t + crklDur);
  const crklLPF = audioCtx.createBiquadFilter(); crklLPF.type = 'lowpass';
  crklLPF.frequency.setValueAtTime(2000 + level * 200, t);
  crklLPF.frequency.exponentialRampToValueAtTime(400, t + crklDur);
  crklSrc.connect(crklLPF).connect(crklG).connect(comp);
  crklSrc.start(t); crklSrc.stop(t + crklDur);
  setOnEnded(crklSrc, crklSrc, crklLPF, crklG);
  const resDur = 0.5 + level * 0.04;
  const resO = audioCtx.createOscillator(); const resG = audioCtx.createGain();
  resO.type = 'triangle'; resO.frequency.setValueAtTime(120 + level * 10, t + 0.03);
  resO.frequency.exponentialRampToValueAtTime(40, t + resDur);
  resG.gain.setValueAtTime(0.001, t);
  resG.gain.linearRampToValueAtTime(0.1 * intensity, t + 0.06);
  resG.gain.exponentialRampToValueAtTime(0.001, t + resDur);
  resO.connect(resG).connect(comp); resO.start(t + 0.03); resO.stop(t + resDur);
  setOnEnded(resO, resO, resG, comp);
}

function playMergeSoundStone(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.6 + level * 0.07;
  const clickDur = 0.008;
  const clickSz = Math.floor(audioCtx.sampleRate * clickDur);
  const clickBuf = getNoiseBuffer(`stone_click_${level}`, clickSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 12);
  });
  const clickSrc = audioCtx.createBufferSource(); clickSrc.buffer = clickBuf;
  const clickG = audioCtx.createGain();
  clickG.gain.setValueAtTime(0.8 * intensity, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
  const clickHPF = audioCtx.createBiquadFilter(); clickHPF.type = 'highpass';
  clickHPF.frequency.setValueAtTime(3000, t); clickHPF.Q.setValueAtTime(2, t);
  clickSrc.connect(clickHPF).connect(clickG).connect(audioCtx.destination);
  clickSrc.start(t); clickSrc.stop(t + clickDur);
  setOnEnded(clickSrc, clickSrc, clickHPF, clickG);
  const knockDur = 0.12 + level * 0.02; const knockFreq = 800 - level * 40;
  const knockO = audioCtx.createOscillator(); const knockG = audioCtx.createGain();
  knockO.type = 'triangle'; knockO.frequency.setValueAtTime(knockFreq, t);
  knockO.frequency.exponentialRampToValueAtTime(knockFreq * 0.5, t + knockDur);
  knockG.gain.setValueAtTime(0.35 * intensity, t);
  knockG.gain.exponentialRampToValueAtTime(0.001, t + knockDur);
  const knockBPF = audioCtx.createBiquadFilter(); knockBPF.type = 'bandpass';
  knockBPF.frequency.setValueAtTime(knockFreq, t); knockBPF.Q.setValueAtTime(5, t);
  knockO.connect(knockBPF).connect(knockG).connect(audioCtx.destination);
  knockO.start(t); knockO.stop(t + knockDur);
  setOnEnded(knockO, knockO, knockBPF, knockG);
  const gritDur = 0.15 + level * 0.02;
  const gritSz = Math.floor(audioCtx.sampleRate * gritDur);
  const gritBuf = getNoiseBuffer(`stone_grit_${level}`, gritSz, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 5);
  });
  const gritSrc = audioCtx.createBufferSource(); gritSrc.buffer = gritBuf;
  const gritG = audioCtx.createGain();
  gritG.gain.setValueAtTime(0.18 * intensity, t + 0.005);
  gritG.gain.exponentialRampToValueAtTime(0.001, t + gritDur);
  const gritBPF = audioCtx.createBiquadFilter(); gritBPF.type = 'bandpass';
  gritBPF.frequency.setValueAtTime(1500 + level * 100, t); gritBPF.Q.setValueAtTime(3, t);
  gritSrc.connect(gritBPF).connect(gritG).connect(audioCtx.destination);
  gritSrc.start(t + 0.005); gritSrc.stop(t + gritDur);
  setOnEnded(gritSrc, gritSrc, gritBPF, gritG);
  const thudO = audioCtx.createOscillator(); const thudG = audioCtx.createGain();
  thudO.type = 'sine'; thudO.frequency.setValueAtTime(200 + level * 10, t);
  thudO.frequency.exponentialRampToValueAtTime(70, t + 0.05);
  thudG.gain.setValueAtTime(0.25 * intensity, t);
  thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  thudO.connect(thudG).connect(audioCtx.destination); thudO.start(t); thudO.stop(t + 0.07);
  setOnEnded(thudO, thudO, thudG);
  const tailDur = 0.2 + level * 0.03;
  const tailO = audioCtx.createOscillator(); const tailG = audioCtx.createGain();
  tailO.type = 'sine'; tailO.frequency.setValueAtTime(1200 + level * 50, t + 0.02);
  tailO.frequency.exponentialRampToValueAtTime(600, t + tailDur);
  tailG.gain.setValueAtTime(0.001, t);
  tailG.gain.linearRampToValueAtTime(0.04 * intensity, t + 0.04);
  tailG.gain.exponentialRampToValueAtTime(0.001, t + tailDur);
  tailO.connect(tailG).connect(audioCtx.destination);
  tailO.start(t + 0.02); tailO.stop(t + tailDur);
  setOnEnded(tailO, tailO, tailG);
}

function playMergeSoundCosmic(level) {
  ensureAudioCtx(); const t = audioCtx.currentTime; const intensity = 0.5 + level * 0.06;
  const fmDur = 0.2 + level * 0.03;
  const carrier = audioCtx.createOscillator(); const modulator = audioCtx.createOscillator();
  const modGain = audioCtx.createGain(); const carGain = audioCtx.createGain();
  modulator.type = 'sine'; modulator.frequency.setValueAtTime(200 + level * 30, t);
  modulator.frequency.exponentialRampToValueAtTime(50, t + fmDur);
  modGain.gain.setValueAtTime(800 + level * 100, t);
  modGain.gain.exponentialRampToValueAtTime(50, t + fmDur);
  carrier.type = 'sine'; carrier.frequency.setValueAtTime(1500 - level * 60, t);
  carrier.frequency.exponentialRampToValueAtTime(400, t + fmDur);
  carGain.gain.setValueAtTime(0.25 * intensity, t);
  carGain.gain.exponentialRampToValueAtTime(0.001, t + fmDur);
  modulator.connect(modGain); modGain.connect(carrier.frequency);
  carrier.connect(carGain).connect(audioCtx.destination);
  modulator.start(t); carrier.start(t); modulator.stop(t + fmDur); carrier.stop(t + fmDur);
  setOnEnded(modulator, modulator, modGain);
  setOnEnded(carrier, carrier, carGain);
  const shimBase = 3000 + level * 200;
  for (let i = 0; i < 3; i++) {
    const shimDur = 0.5 + level * 0.05 + i * 0.15;
    const shimO = audioCtx.createOscillator(); const shimG = audioCtx.createGain();
    shimO.type = 'sine'; const freq = shimBase + i * 700 + Math.random() * 200;
    shimO.frequency.setValueAtTime(freq, t + 0.03 + i * 0.04);
    shimO.frequency.exponentialRampToValueAtTime(freq * 0.4, t + shimDur);
    shimG.gain.setValueAtTime(0.001, t);
    shimG.gain.linearRampToValueAtTime(0.05 * intensity / (i + 1), t + 0.06 + i * 0.04);
    shimG.gain.exponentialRampToValueAtTime(0.001, t + shimDur);
    shimO.connect(shimG).connect(audioCtx.destination);
    shimO.start(t + 0.03 + i * 0.04); shimO.stop(t + shimDur);
    setOnEnded(shimO, shimO, shimG);
  }
  const padDur = 0.6 + level * 0.06;
  const padO = audioCtx.createOscillator(); const padG = audioCtx.createGain();
  padO.type = 'triangle'; padO.frequency.setValueAtTime(90 + level * 8, t);
  padO.frequency.exponentialRampToValueAtTime(50 + level * 3, t + padDur);
  padG.gain.setValueAtTime(0.001, t);
  padG.gain.linearRampToValueAtTime(0.1 * intensity, t + 0.1);
  padG.gain.exponentialRampToValueAtTime(0.001, t + padDur);
  padO.connect(padG).connect(audioCtx.destination); padO.start(t); padO.stop(t + padDur);
  autoDisconnect(padO, padDur); autoDisconnect(padG, padDur);
  const statDur = 0.15 + level * 0.02;
  const statSz = Math.floor(audioCtx.sampleRate * statDur);
  const statBuf = audioCtx.createBuffer(1, statSz, audioCtx.sampleRate);
  const statData = statBuf.getChannelData(0);
  for (let i = 0; i < statSz; i++) statData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / statSz, 6);
  const statSrc = audioCtx.createBufferSource(); statSrc.buffer = statBuf;
  const statG = audioCtx.createGain();
  statG.gain.setValueAtTime(0.06 * intensity, t + 0.01);
  statG.gain.exponentialRampToValueAtTime(0.001, t + statDur);
  const statHPF = audioCtx.createBiquadFilter(); statHPF.type = 'highpass';
  statHPF.frequency.setValueAtTime(5000, t);
  statSrc.connect(statHPF).connect(statG).connect(audioCtx.destination);
  statSrc.start(t + 0.01); statSrc.stop(t + statDur + 0.01);
  autoDisconnect(statSrc, statDur); autoDisconnect(statHPF, statDur); autoDisconnect(statG, statDur);
}

// ─── Leaderboard API ────────────────────────
async function submitScore(pid, sc, diff, playTimeSec) {
  try {
    await fetch('/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: pid, score: sc, difficulty: diff, play_time: playTimeSec })
    });
  } catch (e) { console.warn('Failed to submit score:', e); }
}

function openLeaderboard() { loadLeaderboard(); document.getElementById('leaderboard').classList.remove('hidden'); }
function closeLeaderboard() { document.getElementById('leaderboard').classList.add('hidden'); }

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,0.3)">載入中...</td></tr>';
  try {
    const res = await fetch('/api/scores'); const data = await res.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,0.3)">尚無紀錄</td></tr>'; return; }
    tbody.innerHTML = data.map((row, i) => {
      const mins = Math.floor(row.play_time / 60);
      const secs = row.play_time % 60;
      const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
      const diffLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[row.difficulty] || row.difficulty;
      return `<tr><td>${i + 1}</td><td>${escapeHtml(row.player_id)}</td><td>${row.score.toLocaleString()}</td><td>${diffLabel}</td><td>${timeStr}</td><td>${row.created_at}</td></tr>`;
    }).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="6" style="color:#ff3131">無法連線伺服器</td></tr>'; }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// ─── Settings ────────────────────────────────
function openSettings() { initSoundTypeSelector(); buildSoundPreviewGrid(); document.getElementById('settings').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings').classList.add('hidden'); }

function initSoundTypeSelector() {
  const select = document.getElementById('sound-type-select');
  const newSelect = select.cloneNode(true);
  select.parentNode.replaceChild(newSelect, select);
  newSelect.value = currentSoundType;
  newSelect.addEventListener('change', () => {
    currentSoundType = newSelect.value;
    localStorage.setItem('neonMergeSoundType', currentSoundType);
  });
}

function buildSoundPreviewGrid() {
  const grid = document.getElementById('sound-preview-grid');
  grid.innerHTML = '';
  ALL_SHAPES.forEach((shape, level) => {
    const btn = document.createElement('button');
    btn.className = 'sound-preview-btn';
    btn.style.borderColor = shape.color;
    btn.style.color = shape.color;
    btn.style.boxShadow = `0 0 12px ${hexToRGBA(shape.color, 0.15)}, inset 0 0 12px ${hexToRGBA(shape.color, 0.08)}`;

    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 48; miniCanvas.height = 48;
    const mc = miniCanvas.getContext('2d');
    const scale = 18 / shape.radius;
    mc.save(); mc.translate(24, 24); mc.scale(scale, scale);
    mc.shadowColor = shape.color; mc.shadowBlur = 10;
    mc.strokeStyle = shape.color; mc.lineWidth = 4 / scale;
    mc.fillStyle = hexToRGBA(shape.color, 0.12);
    mc.beginPath();
    if (shape.sides === 0) { mc.arc(0, 0, shape.radius, 0, Math.PI * 2); }
    else { drawPolygonPathCanvas(mc, 0, 0, shape.sides, shape.radius); }
    mc.closePath(); mc.fill(); mc.stroke(); mc.restore();

    const nameSpan = document.createElement('span');
    nameSpan.className = 'shape-name'; nameSpan.textContent = shape.name;
    const levelSpan = document.createElement('span');
    levelSpan.className = 'shape-level'; levelSpan.textContent = `Lv.${level}`;
    btn.appendChild(miniCanvas); btn.appendChild(nameSpan); btn.appendChild(levelSpan);

    btn.addEventListener('click', () => {
      btn.classList.remove('playing'); void btn.offsetWidth; btn.classList.add('playing');
      playMergeSound(level); setTimeout(() => btn.classList.remove('playing'), 500);
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

// Canvas 2D polygon helper for settings preview
function drawPolygonPathCanvas(ctx, cx, cy, sides, r) {
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = cx + r * Math.cos(a); const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
}

// ─── Start ───────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { init(); });
