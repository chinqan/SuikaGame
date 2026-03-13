/* ============================================
   Neon Shape Merge – Game Logic (v2)
   ============================================ */

// ─── Shape Definitions ───────────────────────
// [修改3] 移除凹型多邊形（星星），全部使用凸型多邊形
// 參考圖片：三角形→圓形(小)→正方形→五角形→六角形→圓形(中)→大正方形→大圓形
const ALL_SHAPES = [
  { name: 'Triangle',      sides: 3,  radius: 18, color: '#00FFFF', score: 1  },
  { name: 'Small Circle',  sides: 0,  radius: 22, color: '#FFFF00', score: 3  },
  { name: 'Square',        sides: 4,  radius: 28, color: '#FF6B6B', score: 6  },
  { name: 'Pentagon',      sides: 5,  radius: 36, color: '#39FF14', score: 10 },
  { name: 'Hexagon',       sides: 6,  radius: 44, color: '#FF8C00', score: 15 },
  { name: 'Circle',        sides: 0,  radius: 54, color: '#FF00FF', score: 21 },
  { name: 'Large Square',  sides: 4,  radius: 68, color: '#BF00FF', score: 28 },
  { name: 'Large Hexagon', sides: 6,  radius: 80, color: '#00FF88', score: 36 },
  { name: 'Large Circle',  sides: 0,  radius: 96, color: '#FFFFFF', score: 50 },
];

// 難度設定
let SHAPES = ALL_SHAPES;
let MAX_DROP_LEVEL = 4;
let currentDifficulty = 'hard';

// ─── Globals ─────────────────────────────────
const { Engine, Runner, Bodies, Body, Composite, Events } = Matter;

let engine, runner;
let canvas, ctx;
let canvasW, canvasH;
let wallThickness = 30;
let containerLeft, containerRight, containerBottom;
let gameOverLineY;

// 遊戲容器內縮與底部地板
const gameInsetX = 35;  // 左右內縮距離
const floorAreaH = 100; // 底部 3D 地板預留高度
let gameAreaH;          // 實際遊戲區高度 (canvasH - floorAreaH)

let score = 0;
let highScore = parseInt(localStorage.getItem('neonMergeHigh') || '0');
let currentLevel = 0;
let nextLevel = 0;
let dropX = 0;
let canDrop = true;
let isGameOver = false;
let gameOverTimer = null;

// 多人排行榜
let playerId = 'guest';
let gameStartTime = 0;

// Particles
let particles = [];

// 浮動加分文字
let floatingTexts = [];

// Combo 連擊
let comboCount = 0;
let comboTimer = null;
const COMBO_WINDOW = 1200; // 1.2 秒內連續消除算 combo

// Screen shake
let shakeAmount = 0;

// 電子流動粒子
let gridFlows = [];

// Audio context
let audioCtx = null;

// Bodies tracking: Map<Matter.Body.id, shapeLevel>
const bodyLevelMap = new Map();

// Merge cooldown set to prevent double merges
const mergeCooldown = new Set();

// ─── Init ────────────────────────────────────
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  // Input
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });

  // Restart
  document.getElementById('restart-btn').addEventListener('click', restart);

  // 難度選擇按鈕
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectDifficulty(btn.dataset.diff);
    });
  });

  // 排行榜按鈕
  document.getElementById('leaderboard-btn').addEventListener('click', openLeaderboard);
  document.getElementById('leaderboard-close-btn').addEventListener('click', closeLeaderboard);

  // 讀取上次的 ID
  const savedId = localStorage.getItem('neonMergePlayerId');
  if (savedId) {
    document.getElementById('player-id-input').value = savedId;
  }

  // 顯示難度選單，等待選擇
  document.getElementById('difficulty-select').classList.remove('hidden');
}

function selectDifficulty(diff) {
  // 讀取玩家 ID
  const idInput = document.getElementById('player-id-input');
  playerId = (idInput.value.trim() || 'guest').substring(0, 16);
  idInput.value = playerId;
  localStorage.setItem('neonMergePlayerId', playerId);

  currentDifficulty = diff;

  // 根據難度過濾形狀
  if (diff === 'easy') {
    SHAPES = ALL_SHAPES.slice(2);
    MAX_DROP_LEVEL = 3;
  } else if (diff === 'normal') {
    SHAPES = ALL_SHAPES.slice(1);
    MAX_DROP_LEVEL = 3;
  } else {
    SHAPES = ALL_SHAPES.slice(0);
    MAX_DROP_LEVEL = 4;
  }

  // 記錄開始時間
  gameStartTime = Date.now();

  document.getElementById('difficulty-select').classList.add('hidden');
  startGame();
}

function startGame() {
  // 如果已有 engine，清除舊的
  if (engine) {
    const bodies = Composite.allBodies(engine.world);
    for (const body of bodies) {
      if (bodyLevelMap.has(body.id)) {
        Composite.remove(engine.world, body);
      }
    }
    bodyLevelMap.clear();
    mergeCooldown.clear();
    particles.length = 0;
    floatingTexts.length = 0;
    Runner.stop(runner);
  }

  // 重置狀態
  score = 0;
  document.getElementById('score-value').textContent = '0';
  isGameOver = false;
  canDrop = true;
  gameOverTimer = null;
  shakeAmount = 0;
  comboCount = 0;
  if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }

  // 建立物理引擎
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
  requestAnimationFrame(gameLoop);
}

// [修改1] 畫面高度減小，加快遊戲節奏
function resize() {
  const wrapper = document.getElementById('game-wrapper');
  const hud = document.getElementById('hud');
  const evo = document.getElementById('evolution-bar');
  const hudH = hud.getBoundingClientRect().height;
  const evoH = evo.getBoundingClientRect().height;

  canvasW = Math.min(wrapper.getBoundingClientRect().width, 546);
  const maxCanvasH = 879;
  canvasH = Math.min(window.innerHeight - hudH - evoH - 20, maxCanvasH);
  gameAreaH = canvasH - floorAreaH;
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';

  gameOverLineY = 55;

  // Recreate walls if engine exists
  if (engine) {
    createWalls();
  }

  // Evo canvas width
  const evoCanvas = document.getElementById('evo-canvas');
  evoCanvas.width = evo.getBoundingClientRect().width - 20;
  drawEvolutionBar();
}

// ─── Walls ───────────────────────────────────
function createWalls() {
  // Remove old walls
  if (containerLeft) Composite.remove(engine.world, containerLeft);
  if (containerRight) Composite.remove(engine.world, containerRight);
  if (containerBottom) Composite.remove(engine.world, containerBottom);

  // [修改6] 更大的牆壁、更高的摩擦力和更低的彈性
  const opts = {
    isStatic: true,
    friction: 1.0,
    restitution: 0.1,
    frictionStatic: 1.0,
    render: { visible: false }
  };

  // 牆壁使用 gameInsetX 內縮
  containerLeft = Bodies.rectangle(
    gameInsetX - wallThickness / 2 + 2, canvasH / 2,
    wallThickness, canvasH * 3,
    opts
  );
  containerRight = Bodies.rectangle(
    canvasW - gameInsetX + wallThickness / 2 - 2, canvasH / 2,
    wallThickness, canvasH * 3,
    opts
  );
  containerBottom = Bodies.rectangle(
    canvasW / 2, gameAreaH + wallThickness / 2 - 2,
    canvasW * 3, wallThickness,
    opts
  );

  Composite.add(engine.world, [containerLeft, containerRight, containerBottom]);
}

// ─── Random Level ────────────────────────────
function randLevel() {
  return Math.floor(Math.random() * (MAX_DROP_LEVEL + 1));
}

// ─── Drop Shape ──────────────────────────────
function dropShape(x) {
  if (!canDrop || isGameOver) return;
  canDrop = false;

  const level = currentLevel;
  const shape = SHAPES[level];
  // 限制投放位置在遊戲區域內
  x = Math.max(gameInsetX + shape.radius + 4, Math.min(canvasW - gameInsetX - shape.radius - 4, x));
  const body = createShapeBody(x, -shape.radius, level);

  bodyLevelMap.set(body.id, level);
  Composite.add(engine.world, body);

  playDropSound();

  currentLevel = nextLevel;
  nextLevel = randLevel();
  drawNextPreview();

  // Cooldown before next drop
  setTimeout(() => { canDrop = true; }, 450);
}

// ─── Create Physics Body ─────────────────────
function createShapeBody(x, y, level) {
  const shape = SHAPES[level];
  const r = shape.radius;

  // 所有形狀統一使用圓形碰撞體，徹底避免尖角穿透
  // 視覺上仍繪製為多邊形，但物理碰撞用圓形保證精確
  const body = Bodies.circle(x, y, r, {
    restitution: 0.15,
    friction: 0.6,
    frictionStatic: 0.8,
    density: 0.0015 + level * 0.0004,
    slop: 0.005,
    label: 'shape'
  });
  return body;
}

// ─── Collision → Merge ───────────────────────
function onCollision(event) {
  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (a.label !== 'shape' || b.label !== 'shape') continue;

    const levelA = bodyLevelMap.get(a.id);
    const levelB = bodyLevelMap.get(b.id);
    if (levelA === undefined || levelB === undefined) continue;
    if (levelA !== levelB) continue;

    // Cooldown check
    if (mergeCooldown.has(a.id) || mergeCooldown.has(b.id)) continue;
    mergeCooldown.add(a.id);
    mergeCooldown.add(b.id);

    const level = levelA;
    const newLevel = level + 1;

    // Midpoint
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;

    // Remove old
    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);
    bodyLevelMap.delete(a.id);
    bodyLevelMap.delete(b.id);
    mergeCooldown.delete(a.id);
    mergeCooldown.delete(b.id);

    // Score
    let gained = 0;
    if (newLevel < SHAPES.length) {
      gained = SHAPES[newLevel].score;
    } else {
      gained = 80;
    }
    score += gained;
    document.getElementById('score-value').textContent = score;

    // Combo 連擊
    comboCount++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { comboCount = 0; comboTimer = null; }, COMBO_WINDOW);

    // 浮動加分文字
    const scoreColor = (newLevel < SHAPES.length) ? SHAPES[newLevel].color : '#FFFFFF';
    spawnFloatingText(mx, my, '+' + gained, scoreColor);
    if (comboCount >= 2) {
      spawnFloatingText(mx, my - 30, 'COMBO x' + comboCount, '#FFD700', comboCount);
    }

    // Spawn merged shape (if not max)
    if (newLevel < SHAPES.length) {
      const newBody = createShapeBody(mx, my, newLevel);
      bodyLevelMap.set(newBody.id, newLevel);
      Composite.add(engine.world, newBody);
      Body.setVelocity(newBody, { x: (Math.random() - 0.5) * 1.5, y: -1.5 });
    }

    // 消除特效
    spawnMergeParticles(mx, my, level);
    playMergeSound(level);
    // Screen shake（combo 越高震動越大）
    shakeAmount = 4 + level * 1.5 + comboCount * 0.5;
  }
}

// 浮動加分文字
function spawnFloatingText(x, y, text, color, comboNum) {
  floatingTexts.push({
    x, y,
    text,
    color,
    life: 1,
    decay: 0.018,
    vy: comboNum ? (-4.5 - comboNum * 0.3) : -2.5,
    scale: 0.5,
    isCombo: !!comboNum,
    comboNum: comboNum || 0
  });
}

// 粒子系統
// [修改4] 全新粒子系統：形狀碎片 + 光點 + 更大範圍
function spawnMergeParticles(x, y, level) {
  const shape = SHAPES[level];
  const color = shape.color;

  // 環形閃光 (glow ring) — 一個大的快速消散環
  particles.push({
    type: 'ring',
    x, y,
    radius: 5,
    maxRadius: shape.radius * 3.5,
    life: 1,
    decay: 0.04,
    color,
    lineWidth: 4
  });

  // 形狀碎片粒子 — [修改4] 用原元素的縮小圖當成粒子碎片
  const shardCount = 8 + level * 2;
  for (let i = 0; i < shardCount; i++) {
    const angle = (Math.PI * 2 * i) / shardCount + (Math.random() - 0.5) * 0.4;
    const speed = 3 + Math.random() * 6;
    particles.push({
      type: 'shard',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.012 + Math.random() * 0.015,
      shapeLevel: level,
      scale: 0.18 + Math.random() * 0.15,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      color
    });
  }

  // 散射光點粒子
  const dotCount = 16 + level * 3;
  for (let i = 0; i < dotCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;
    particles.push({
      type: 'dot',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      size: 2 + Math.random() * 5,
      color
    });
  }
}

function updateParticles() {
  // 更新粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.type === 'ring') {
      p.radius += (p.maxRadius - p.radius) * 0.15;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      if (p.vy !== undefined) p.vy += 0.08;
      if (p.type === 'shard') {
        p.rotation += p.rotSpeed;
      }
    }
  }
  // 更新浮動文字
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= ft.decay;
    if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }
    ft.y += ft.vy;
    ft.vy *= 0.97; // 減速
    ft.scale = Math.min(ft.scale + 0.08, 1.2); // 放大到 1.2
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.type === 'ring') {
      ctx.globalAlpha = p.life * 0.7;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.lineWidth * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === 'shard') {
      // [修改4] 用原元素的縮小圖當粒子碎片
      ctx.globalAlpha = p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scale * p.life, p.scale * p.life);

      const shape = SHAPES[p.shapeLevel];
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 / (p.scale || 1);
      ctx.fillStyle = hexToRGBA(p.color, 0.15);

      ctx.beginPath();
      if (shape.sides === 0) {
        ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
      } else {
        drawPolygonPath(ctx, 0, 0, shape.sides, shape.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // dot
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // 繪製浮動加分文字
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.life;
    ctx.translate(ft.x, ft.y);
    ctx.scale(ft.scale, ft.scale);

    const fontSize = ft.isCombo ? (28 + ft.comboNum * 4) : 22;
    ctx.font = `bold ${fontSize}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 發光效果
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    // 再畫一次加強發光
    ctx.shadowBlur = 40;
    ctx.fillText(ft.text, 0, 0);

    ctx.restore();
  }
}

// ─── Drawing ─────────────────────────────────
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// === 電子流動系統 ===
function spawnGridFlow() {
  const isH = Math.random() < 0.6;
  gridFlows.push({
    t: 0,
    speed: 0.003 + Math.random() * 0.005,
    lineIdx: isH
      ? Math.floor(Math.random() * 8) + 1
      : Math.floor(Math.random() * 11),
    isHorizontal: isH,
    size: 2 + Math.random() * 2,
    brightness: 0.6 + Math.random() * 0.4
  });
}

function updateGridFlows() {
  if (gridFlows.length < 25 && Math.random() < 0.12) {
    spawnGridFlow();
  }
  for (let i = gridFlows.length - 1; i >= 0; i--) {
    const f = gridFlows[i];
    f.t += f.speed;
    if (f.t > 1) gridFlows.splice(i, 1);
  }
}

function drawGridFlows(farY, farL, farR, nearY, nearL, nearR, hLineCount, vLineCount) {
  for (const f of gridFlows) {
    let px, py;

    if (f.isHorizontal) {
      const t = f.lineIdx / hLineCount;
      const tCurve = 1 - Math.pow(1 - t, 2.5);
      const lineY = nearY + (farY - nearY) * tCurve;
      const lineL = nearL + (farL - nearL) * tCurve;
      const lineR = nearR + (farR - nearR) * tCurve;
      px = lineL + (lineR - lineL) * f.t;
      py = lineY;
    } else {
      const frac = f.lineIdx / vLineCount;
      const xNear = nearL + (nearR - nearL) * frac;
      const xFar = farL + (farR - farL) * frac;
      px = xNear + (xFar - xNear) * f.t;
      py = nearY + (farY - nearY) * f.t;
    }

    // 亮度：中間最亮，兩端淡出
    const alpha = f.brightness * Math.max(0, 1 - Math.abs(f.t - 0.5) * 2.2);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 光暈
    const glow = ctx.createRadialGradient(px, py, 0, px, py, f.size * 8);
    glow.addColorStop(0, 'rgba(0,255,255,0.7)');
    glow.addColorStop(0.3, 'rgba(0,255,255,0.2)');
    glow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - f.size * 8, py - f.size * 8, f.size * 16, f.size * 16);

    // 中心亮點
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, f.size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function update() {
  updateParticles();
  updateGridFlows();
  checkGameOver();

  // Screen shake decay
  if (shakeAmount > 0) {
    shakeAmount *= 0.85;
    if (shakeAmount < 0.3) shakeAmount = 0;
  }
}

function draw() {
  ctx.save();

  // Screen shake offset
  if (shakeAmount > 0) {
    const sx = (Math.random() - 0.5) * shakeAmount * 2;
    const sy = (Math.random() - 0.5) * shakeAmount * 2;
    ctx.translate(sx, sy);
  }

  // Clear
  ctx.clearRect(-10, -10, canvasW + 20, canvasH + 20);

  // Background grid
  drawGrid();

  // Container walls glow
  drawContainerGlow();

  // Game over line
  drawGameOverLine();

  // Shapes
  drawShapes();

  // Particles (on top)
  drawParticles();

  // Aim guide
  if (canDrop && !isGameOver) {
    drawAimGuide();
  }

  ctx.restore();
}

function drawGrid() {
  const floorTop = gameAreaH;
  const lx = gameInsetX;
  const rx = canvasW - gameInsetX;

  // === 遊戲區背板 ===
  const bgGrad = ctx.createLinearGradient(0, 0, 0, gameAreaH);
  bgGrad.addColorStop(0, 'rgba(15,15,35,0.4)');
  bgGrad.addColorStop(0.8, 'rgba(8,12,25,0.5)');
  bgGrad.addColorStop(1, 'rgba(0,8,18,0.6)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(lx, 0, rx - lx, gameAreaH);

  // === 遊戲區內部暗紋垂直線 ===
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const step = 45;
  for (let x = lx + step; x < rx; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, floorTop);
    ctx.stroke();
  }

  // === 底部 3D 透視地板 ===
  // 遠端深入遊戲區 40px，讓圖形像站在地板上
  const farY = floorTop - 40;
  const farL = lx;
  const farR = rx;
  // 近端超出畫面左右各 50px，讓地板更寬廣
  const nearY = canvasH;
  const nearL = -50;
  const nearR = canvasW + 50;

  // 水平線：近端(底)疏、遠端(頂)密
  const hLines = 8;
  for (let i = 1; i <= hLines; i++) {
    const t = i / hLines;
    // 1-(1-t)^2.5 讓近端間距大、遠端間距小
    const tCurve = 1 - Math.pow(1 - t, 2.5);
    const y = nearY + (farY - nearY) * tCurve;
    const lineL = nearL + (farL - nearL) * tCurve;
    const lineR = nearR + (farR - nearR) * tCurve;
    ctx.globalAlpha = 0.5 + 0.5 * (1 - tCurve);
    ctx.strokeStyle = 'rgba(0,255,255,1.0)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineL, y);
    ctx.lineTo(lineR, y);
    ctx.stroke();
  }

  // 垂直線：底邊均分的點連到遠端對應的點
  const vLines = 10;
  ctx.lineWidth = 1;
  for (let i = 0; i <= vLines; i++) {
    const frac = i / vLines;
    const xNear = nearL + (nearR - nearL) * frac;
    const xFar = farL + (farR - farL) * frac;
    ctx.globalAlpha = 0.35 + 0.35 * (1 - Math.abs(frac - 0.5) * 2);
    ctx.strokeStyle = 'rgba(0,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(xNear, nearY);
    ctx.lineTo(xFar, farY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // === 電子流動特效 ===
  drawGridFlows(farY, farL, farR, nearY, nearL, nearR, hLines, vLines);
}

function drawContainerGlow() {
  const lx = gameInsetX;
  const rx = canvasW - gameInsetX;
  const depthW = 15;

  // === 左側 3D 深度面 ===
  const leftGrad = ctx.createLinearGradient(lx, 0, lx + depthW, 0);
  leftGrad.addColorStop(0, 'rgba(0,255,255,0.15)');
  leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(lx, 0, depthW, gameAreaH);

  // 左邊緣發光線
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(0,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx, 0);
  ctx.lineTo(lx, gameAreaH);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // === 右側 3D 深度面 ===
  const rightGrad = ctx.createLinearGradient(rx, 0, rx - depthW, 0);
  rightGrad.addColorStop(0, 'rgba(0,255,255,0.15)');
  rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(rx - depthW, 0, depthW, gameAreaH);

  // 右邊緣發光線
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(0,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(rx, gameAreaH);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // === 底部發光地板線 (遊戲區底邊) ===
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(0,255,255,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(lx, gameAreaH);
  ctx.lineTo(rx, gameAreaH);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawGameOverLine() {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,49,49,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(gameInsetX, gameOverLineY);
  ctx.lineTo(canvasW - gameInsetX, gameOverLineY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAimGuide() {
  const shape = SHAPES[currentLevel];
  const r = shape.radius;
  const x = Math.max(gameInsetX + r + 4, Math.min(canvasW - gameInsetX - r - 4, dropX));

  // Vertical dashed line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x, r + 4);
  ctx.lineTo(x, gameAreaH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Preview shape ghost
  ctx.globalAlpha = 0.55;
  drawSingleShape(x, r + 8, currentLevel);
  ctx.globalAlpha = 1;
}

function drawShapes() {
  const bodies = Composite.allBodies(engine.world);
  for (const body of bodies) {
    const level = bodyLevelMap.get(body.id);
    if (level === undefined) continue;
    drawSingleShape(body.position.x, body.position.y, level, body.angle);
  }
}

// [修改2] 線條加粗 — lineWidth 從 2.5 提升至 4，內部線也加粗
function drawSingleShape(x, y, level, angle = 0) {
  const shape = SHAPES[level];
  const r = shape.radius;
  const color = shape.color;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Neon glow — 厚實線條 + 強發光
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.fillStyle = hexToRGBA(color, 0.08);

  ctx.beginPath();
  if (shape.sides === 0) {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else {
    drawPolygonPath(ctx, 0, 0, shape.sides, r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner lighter stroke for depth
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexToRGBA(color, 0.2);
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (shape.sides === 0) {
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  } else {
    drawPolygonPath(ctx, 0, 0, shape.sides, r * 0.55);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

function drawPolygonPath(ctx, cx, cy, sides, r) {
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

// ─── Next Shape Preview ──────────────────────
function drawNextPreview() {
  const c = document.getElementById('next-canvas');
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, c.width, c.height);

  const shape = SHAPES[nextLevel];
  const scale = 22 / shape.radius;

  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  cx.scale(scale, scale);

  cx.shadowColor = shape.color;
  cx.shadowBlur = 12;
  cx.strokeStyle = shape.color;
  cx.lineWidth = 4 / scale;
  cx.fillStyle = hexToRGBA(shape.color, 0.15);

  cx.beginPath();
  if (shape.sides === 0) {
    cx.arc(0, 0, shape.radius, 0, Math.PI * 2);
  } else {
    drawPolygonPath(cx, 0, 0, shape.sides, shape.radius);
  }
  cx.closePath();
  cx.fill();
  cx.stroke();

  cx.restore();
}

// ─── Evolution Bar ───────────────────────────
function drawEvolutionBar() {
  const c = document.getElementById('evo-canvas');
  if (!c) return;
  const cx = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  cx.clearRect(0, 0, w, h);

  const count = SHAPES.length;
  const spacing = w / count;

  for (let i = 0; i < count; i++) {
    const shape = SHAPES[i];
    const x = spacing * i + spacing / 2;
    const y = h / 2;
    const r = 9 + i * 1.3;
    const scale = r / shape.radius;

    cx.save();
    cx.translate(x, y);
    cx.scale(scale, scale);
    cx.shadowColor = shape.color;
    cx.shadowBlur = 8;
    cx.strokeStyle = shape.color;
    cx.lineWidth = 3.5 / scale;
    cx.fillStyle = hexToRGBA(shape.color, 0.1);

    cx.beginPath();
    if (shape.sides === 0) {
      cx.arc(0, 0, shape.radius, 0, Math.PI * 2);
    } else {
      drawPolygonPath(cx, 0, 0, shape.sides, shape.radius);
    }
    cx.closePath();
    cx.fill();
    cx.stroke();
    cx.restore();

    // Arrow
    if (i < count - 1) {
      cx.fillStyle = 'rgba(255,255,255,0.15)';
      cx.font = '10px Rajdhani';
      cx.textAlign = 'center';
      cx.fillText('›', x + spacing / 2, y + 4);
    }
  }
}

// ─── Game Over ───────────────────────────────
function checkGameOver() {
  if (isGameOver) return;

  const bodies = Composite.allBodies(engine.world);
  let aboveLine = false;
  for (const body of bodies) {
    if (bodyLevelMap.has(body.id)) {
      if (body.position.y < gameOverLineY && body.speed < 1.5) {
        aboveLine = true;
        break;
      }
    }
  }

  if (aboveLine) {
    if (!gameOverTimer) {
      gameOverTimer = setTimeout(() => {
        triggerGameOver();
      }, 1500);
    }
  } else {
    if (gameOverTimer) {
      clearTimeout(gameOverTimer);
      gameOverTimer = null;
    }
  }
}

function triggerGameOver() {
  isGameOver = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('neonMergeHigh', highScore.toString());
  }
  document.getElementById('final-score').textContent = score;
  document.getElementById('high-score').textContent = highScore;
  document.getElementById('game-over').classList.remove('hidden');

  // 提交分數到後端
  const playTimeMs = Date.now() - gameStartTime;
  const playTimeSec = Math.round(playTimeMs / 1000);
  submitScore(playerId, score, currentDifficulty, playTimeSec);
}

function restart() {
  // 顯示難度選單，讓玩家重新選擇
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('difficulty-select').classList.remove('hidden');
}

// ─── Input ───────────────────────────────────
function onPointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  dropX = e.clientX - rect.left;
}

function onPointerDown(e) {
  const rect = canvas.getBoundingClientRect();
  dropX = e.clientX - rect.left;
  const shape = SHAPES[currentLevel];
  const x = Math.max(shape.radius + 4, Math.min(canvasW - shape.radius - 4, dropX));
  dropShape(x);
}

function onTouchMove(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  dropX = e.touches[0].clientX - rect.left;
}

function onTouchStart(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  dropX = e.touches[0].clientX - rect.left;
  const shape = SHAPES[currentLevel];
  const x = Math.max(shape.radius + 4, Math.min(canvasW - shape.radius - 4, dropX));
  dropShape(x);
}

// ─── Audio ───────────────────────────────────
function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playDropSound() {
  ensureAudioCtx();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

// 震撼爆破音效
function playMergeSound(level) {
  ensureAudioCtx();
  const t = audioCtx.currentTime;
  const intensity = 0.7 + level * 0.1;

  // === 壓縮器 — 讓爆破音更飽滿 ===
  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-20, t);
  comp.knee.setValueAtTime(10, t);
  comp.ratio.setValueAtTime(12, t);
  comp.attack.setValueAtTime(0, t);
  comp.release.setValueAtTime(0.1, t);
  comp.connect(audioCtx.destination);

  // === 1. 爆破白噪 (主體衝擊) ===
  const noiseDur = 0.3 + level * 0.03;
  const bufSz = Math.floor(audioCtx.sampleRate * noiseDur);
  const nBuf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
  const nData = nBuf.getChannelData(0);
  for (let i = 0; i < bufSz; i++) {
    nData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSz, 2);
  }
  const nSrc = audioCtx.createBufferSource();
  nSrc.buffer = nBuf;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.5 * intensity, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  const lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(3000 + level * 400, t);
  lpf.frequency.exponentialRampToValueAtTime(300, t + noiseDur);
  nSrc.connect(lpf).connect(nGain).connect(comp);
  nSrc.start(t);
  nSrc.stop(t + noiseDur);

  // === 2. 低頻重擊 (衝擊波) ===
  const subO = audioCtx.createOscillator();
  const subG = audioCtx.createGain();
  subO.type = 'sine';
  subO.frequency.setValueAtTime(100, t);
  subO.frequency.exponentialRampToValueAtTime(20, t + 0.3);
  subG.gain.setValueAtTime(0.6 * intensity, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  subO.connect(subG).connect(comp);
  subO.start(t);
  subO.stop(t + 0.35);

  // === 3. 金屬撞擊 (碎裂) ===
  const mFreq = 800 + level * 150;
  const mO = audioCtx.createOscillator();
  const mG = audioCtx.createGain();
  mO.type = 'square';
  mO.frequency.setValueAtTime(mFreq, t);
  mO.frequency.exponentialRampToValueAtTime(mFreq * 0.3, t + 0.08);
  mG.gain.setValueAtTime(0.2 * intensity, t);
  mG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  const hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 600;
  mO.connect(hpf).connect(mG).connect(comp);
  mO.start(t);
  mO.stop(t + 0.1);

  // === 4. 升調回饋 (成功感) ===
  const rFreq = 300 + level * 80;
  const rO = audioCtx.createOscillator();
  const rG = audioCtx.createGain();
  rO.type = 'sine';
  rO.frequency.setValueAtTime(rFreq, t + 0.05);
  rO.frequency.exponentialRampToValueAtTime(rFreq * 3, t + 0.4);
  rG.gain.setValueAtTime(0.001, t);
  rG.gain.linearRampToValueAtTime(0.15 * intensity, t + 0.08);
  rG.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  rO.connect(rG).connect(comp);
  rO.start(t);
  rO.stop(t + 0.45);
}

// ─── Leaderboard API ────────────────────────
async function submitScore(pid, sc, diff, playTimeSec) {
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: pid,
        score: sc,
        difficulty: diff,
        play_time: playTimeSec
      })
    });
  } catch (e) {
    console.warn('Failed to submit score:', e);
  }
}

function openLeaderboard() {
  loadLeaderboard();
  document.getElementById('leaderboard').classList.remove('hidden');
}

function closeLeaderboard() {
  document.getElementById('leaderboard').classList.add('hidden');
}

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,0.3)">載入中...</td></tr>';
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,0.3)">尚無紀錄</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((row, i) => {
      const mins = Math.floor(row.play_time / 60);
      const secs = row.play_time % 60;
      const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
      const diffLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[row.difficulty] || row.difficulty;
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(row.player_id)}</td>
        <td>${row.score.toLocaleString()}</td>
        <td>${diffLabel}</td>
        <td>${timeStr}</td>
        <td>${row.created_at}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#ff3131">無法連線伺服器</td></tr>';
    console.warn('Failed to load leaderboard:', e);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Utilities ───────────────────────────────
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Start ───────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
