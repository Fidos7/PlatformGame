const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const W = 800, H = 500;
const GROUND  = 470;

const knightImg = new Image();
let   knightReady = false;

knightImg.onload = () => {
    const tmp = document.createElement('canvas');
    tmp.width  = knightImg.width;
    tmp.height = knightImg.height;
    const tc   = tmp.getContext('2d');
    tc.drawImage(knightImg, 0, 0);
    const data = tc.getImageData(0, 0, tmp.width, tmp.height);
    for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i] < 30 && data.data[i+1] < 30 && data.data[i+2] < 30)
            data.data[i+3] = 0;
    }
    tc.putImageData(data, 0, 0);
    knightImg.src = tmp.toDataURL();
    knightReady = true;
};
knightImg.src = 'assets/postava.png';

let score, lives, level, running, paused, frame;
let keys = {}, mouseX = 0, mouseY = 0;

let player;

let hook;

const PLATFORMS = [
    // bottom row
    { x: 50,  y: 420, w: 110, h: 14 },
    { x: 390, y: 420, w: 110, h: 14 },
    { x: 695, y: 420, w: 100, h: 14 },
    // mid row
    { x: 105, y: 328, w: 100, h: 14 },
    { x: 455, y: 318, w: 100, h: 14 },
    { x: 732, y: 328, w: 60,  h: 14 },
    // upper row
    { x: 52,  y: 218, w: 90,  h: 14 },
    { x: 383, y: 208, w: 90,  h: 14 },
    { x: 533, y: 188, w: 100, h: 14 },
    // top row
    { x: 133, y: 118, w: 110, h: 14 },
    { x: 333, y: 98,  w: 120, h: 14 },
    { x: 713, y: 123, w: 80,  h: 14 },
];

const SPIKE_ZONES = [
    { x: 200,  w: 48 },
    { x: 275, w: 48 },
    { x: 605, w: 48 },
    { x: 500, w: 48 },
];

let items = [];

let particles = [];


function init(lvl = 1) {
    level = lvl;

    player = {
        x: 120, y: 400,
        vx: 0,  vy: 0,
        w: 28,  h: 36,
        onGround: false,
        facing: 1
    };

    hook = {
        state: 'idle',
        x: 0, y: 0,
        vx: 0, vy: 0,
        attachX: 0, attachY: 0,
        ropeLen: 0,
        trail: []
    };

    spawnItems();
    particles = [];
}

function spawnItems() {
    items = PLATFORMS.map(p => ({
        x: p.x + p.w / 2,
        y: p.y - 12,
        r: 7,
        collected: false,
        bob: Math.random() * Math.PI * 2,
        kind: Math.floor(Math.random() * 3)
    }));
}


canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
});

canvas.addEventListener('mousedown', e => {
    if (!running || paused) return;
    if (e.button === 0) fireHook();
    if (e.button === 2) releaseHook();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyR')    releaseHook();
    if (e.code === 'Escape' && running) paused = !paused;
});
document.addEventListener('keyup', e => keys[e.code] = false);

// ─────────────────────────────────────────────
//  HOOK LOGIC
// ─────────────────────────────────────────────
function fireHook() {
    const dx = mouseX - player.x;
    const dy = mouseY - (player.y + player.h / 2);
    const d  = Math.hypot(dx, dy) || 1;
    const SPEED = 18;

    hook.state = 'flying';
    hook.x  = player.x;
    hook.y  = player.y + player.h / 2;
    hook.vx = (dx / d) * SPEED;
    hook.vy = (dy / d) * SPEED;
    hook.trail = [];
}

function releaseHook() {
    hook.state = 'idle';
    hook.trail = [];
}


const GRAVITY   = 0.45;
const FRICTION  = 0.86;
const HOOK_PULL = 0.22;

function update() {
    if (!running || paused) return;
    frame++;

    if (keys['KeyA'] || keys['ArrowLeft'])  { player.vx -= 0.5; player.facing = -1; }
    if (keys['KeyD'] || keys['ArrowRight']) { player.vx += 0.5; player.facing =  1; }

    player.vy += GRAVITY;
    player.vx *= FRICTION;
    // hook lita
    if (hook.state === 'flying') {
        hook.trail.push({ x: hook.x, y: hook.y, life: 1 });
        hook.x  += hook.vx;
        hook.y  += hook.vy;
        hook.vy += 0.05;

        if (hook.x < 0 || hook.x > W || hook.y < 0 || hook.y > H) {
            releaseHook();
        }

        for (const p of PLATFORMS) {
            if (hook.x > p.x && hook.x < p.x + p.w &&
                hook.y > p.y && hook.y < p.y + p.h) {
                hook.state   = 'attached';
                hook.attachX = hook.x;
                hook.attachY = hook.y;
                hook.ropeLen = Math.hypot(hook.attachX - player.x, hook.attachY - (player.y + player.h / 2));
                spawnParticles(hook.attachX, hook.attachY, '#7cfc00', 8);
                break;
            }
        }
    }

    if (hook.state === 'attached') {
        const cx  = player.x;
        const cy  = player.y + player.h / 2;
        const dx  = hook.attachX - cx;
        const dy  = hook.attachY - cy;
        const dist = Math.hypot(dx, dy) || 1;

        player.vx += (dx / dist) * HOOK_PULL;
        player.vy += (dy / dist) * HOOK_PULL;

        if (dist > hook.ropeLen) {
            const over = dist - hook.ropeLen;
            const nx   = dx / dist;
            const ny   = dy / dist;
            player.x  += nx * over;
            player.y  += ny * over;
            const dot = player.vx * nx + player.vy * ny;
            if (dot < 0) {
                player.vx -= dot * nx * 0.85;
                player.vy -= dot * ny * 0.85;
            }
        }
    }

    player.x += player.vx;
    player.y += player.vy;

    player.onGround = false;

    for (const p of PLATFORMS) {
        const inX = player.x + player.w / 2 > p.x + 2 &&
            player.x - player.w / 2 < p.x + p.w - 2;
        if (!inX) continue;

        if (player.vy >= 0 &&
            player.y + player.h > p.y &&
            player.y + player.h < p.y + p.h + player.vy + 4) {
            player.y        = p.y - player.h;
            player.vy       = 0;
            player.onGround = true;
        }
        else if (player.vy < 0 &&
            player.y < p.y + p.h &&
            player.y > p.y + player.vy - 4) {
            player.y  = p.y + p.h;
            player.vy = 1;
        }
    }

    for (const p of PLATFORMS) {
        const inY = player.y + player.h > p.y + 4 && player.y < p.y + p.h - 4;
        if (!inY) continue;
        if (player.x + player.w / 2 > p.x && player.x + player.w / 2 < p.x + p.w / 2 + 4) { player.x = p.x - player.w / 2; player.vx = 0; }
        if (player.x - player.w / 2 < p.x + p.w && player.x - player.w / 2 > p.x + p.w / 2 - 4) { player.x = p.x + p.w + player.w / 2; player.vx = 0; }
    }

    if (player.y + player.h > GROUND) {
        player.y        = GROUND - player.h;
        player.vy       = 0;
        player.onGround = true;
    }

    // Screen walls
    if (player.x < 14)      { player.x = 14;      player.vx = 0; }
    if (player.x > W - 14)  { player.x = W - 14;  player.vx = 0; }

    // skok
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.onGround) {
        player.vy = -10;
        spawnParticles(player.x, player.y + player.h, '#aaa', 5);
    }

    // itemy collect
    for (const item of items) {
        if (item.collected) continue;
        const cx = Math.max(player.x - player.w / 2, Math.min(item.x, player.x + player.w / 2));
        const cy = Math.max(player.y, Math.min(item.y, player.y + player.h));
        if (Math.hypot(cx - item.x, cy - item.y) < item.r + 3) {
            item.collected = true;
            score += 10;
            updateHUD();
            spawnParticles(item.x, item.y, '#ffcc00', 10);
        }
    }

    // smrt
    let dead = false;

    // Spikes on ground
    for (const sz of SPIKE_ZONES) {
        if (player.x + player.w / 2 > sz.x + 2 &&
            player.x - player.w / 2 < sz.x + sz.w - 2 &&
            player.y + player.h >= GROUND - 2) {
            dead = true;
        }
    }

    if (player.y > H + 60) dead = true;

    if (dead) {
        lives--;
        updateHUD();
        if (lives <= 0) { endGame(); return; }
        respawn();
    }

    if (items.every(i => i.collected)) {
        score += 100;
        level++;
        updateHUD();
        init(level);
    }

    hook.trail    = hook.trail.filter(t => t.life > 0);
    for (const t of hook.trail) t.life -= 0.1;

    particles     = particles.filter(p => p.life > 0);
    for (const p of particles) {
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.08;
        p.life -= p.decay;
    }
}

function respawn() {
    player.x = 120; player.y = 400;
    player.vx = 0;  player.vy = 0;
    releaseHook();
}

function spawnParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x, y, color,
            vx:    Math.cos(angle) * speed,
            vy:    Math.sin(angle) * speed,
            life:  1,
            decay: 0.025 + Math.random() * 0.03,
            r:     2 + Math.random() * 3
        });
    }
}

ä

function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#236e23');
    grad.addColorStop(1, '#0d2e0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97  + 20) % (H * 0.7));
        const sr = i % 3 === 0 ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGround() {
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(0, GROUND, W, H - GROUND);

    ctx.fillStyle = '#2d6a2d';
    ctx.fillRect(0, GROUND, W, 6);
    ctx.fillStyle = '#3a8c3a';
    ctx.fillRect(0, GROUND, W, 2);

    for (const sz of SPIKE_ZONES) {
        const n = Math.floor(sz.w / 16);
        for (let i = 0; i < n; i++) {
            const sx = sz.x + i * 16;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(sx, GROUND);
            ctx.lineTo(sx + 8, GROUND - 18);
            ctx.lineTo(sx + 16, GROUND);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff1600';
            ctx.beginPath();
            ctx.moveTo(sx + 2, GROUND);
            ctx.lineTo(sx + 8, GROUND - 15);
            ctx.lineTo(sx + 14, GROUND);
            ctx.closePath();
            ctx.fill();
        }
    }
}

function drawPlatforms() {
    for (const p of PLATFORMS) {
        ctx.fillStyle = '#5c3d1e';
        ctx.fillRect(p.x, p.y + 4, p.w, p.h - 4);

        ctx.fillStyle = '#4a2e10';
        for (let i = 0; i < p.w; i += 10) {
            ctx.fillRect(p.x + i, p.y + 5, 4, p.h - 7);
        }

        ctx.fillStyle = '#2d6a2d';
        ctx.fillRect(p.x, p.y, p.w, 5);
        ctx.fillStyle = '#3a8c3a';
        ctx.fillRect(p.x, p.y, p.w, 2);

        ctx.fillStyle = '#3a8c3a';
        for (let i = 4; i < p.w - 4; i += 8) {
            ctx.fillRect(p.x + i,     p.y - 3, 2, 4);
            ctx.fillRect(p.x + i + 3, p.y - 4, 2, 4);
        }
    }
}

function drawItems() {
    for (const item of items) {
        if (item.collected) continue;
        const iy = item.y + Math.sin(frame * 0.05 + item.bob) * 2;

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(item.x, iy + item.r + 3, item.r * 0.8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (item.kind === 0) {
            // Apple
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(item.x - item.r + 1, iy - item.r + 1, item.r * 2 - 2, item.r * 2 - 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(item.x - item.r + 2, iy - item.r,     item.r * 2 - 4, item.r * 2 - 3);
            ctx.fillStyle = '#fadbd8';
            ctx.fillRect(item.x - 2, iy - item.r + 1, 3, 3);
            ctx.fillStyle = '#5d3a1a';
            ctx.fillRect(item.x - 1, iy - item.r - 3, 2, 4);
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(item.x + 1, iy - item.r - 3, 5, 2);

        } else if (item.kind === 1) {
            // Blue
            ctx.fillStyle = '#2980b9';
            ctx.beginPath();
            ctx.moveTo(item.x, iy - item.r);
            ctx.lineTo(item.x + item.r, iy);
            ctx.lineTo(item.x, iy + item.r);
            ctx.lineTo(item.x - item.r, iy);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#7fb3d3';
            ctx.fillRect(item.x - 2, iy - item.r + 2, 3, 3);

        } else {
            // Coin
            ctx.fillStyle = '#d4ac0d';
            ctx.beginPath();
            ctx.arc(item.x, iy, item.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f9e547';
            ctx.beginPath();
            ctx.arc(item.x - 1, iy - 1, item.r - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b7950b';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('$', item.x, iy + 3);
            ctx.textAlign = 'left';
        }
    }
}

function drawRope() {
    if (hook.state === 'idle') return;

    const tipX = hook.state === 'attached' ? hook.attachX : hook.x;
    const tipY = hook.state === 'attached' ? hook.attachY : hook.y;
    const baseY = player.y + player.h / 2;

    for (const t of hook.trail) {
        ctx.globalAlpha = t.life * 0.4;
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    const dx   = tipX - player.x;
    const dy   = tipY - baseY;
    const dist = Math.hypot(dx, dy) || 1;
    const segs = Math.max(2, Math.floor(dist / 5));

    for (let i = 0; i <= segs; i++) {
        const t   = i / segs;
        const sag = Math.sin(t * Math.PI) * Math.min(20, dist * 0.1);
        const rx  = player.x + dx * t;
        const ry  = baseY   + dy * t + sag;
        ctx.fillStyle = i % 2 === 0 ? '#a0522d' : '#7a3e1f';
        ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 2, 2);
    }

    ctx.fillStyle = '#ccc';
    ctx.fillRect(tipX - 3, tipY - 3, 6, 6);
    ctx.fillStyle = '#888';
    ctx.fillRect(tipX - 5, tipY - 1, 3, 2);
    ctx.fillRect(tipX + 3, tipY - 1, 3, 2);
}

function drawAimLine() {
    if (hook.state === 'attached') return;
    const dx    = mouseX - player.x;
    const dy    = mouseY - (player.y + player.h / 2);
    const steps = Math.floor(Math.hypot(dx, dy) / 10);

    ctx.fillStyle = 'rgba(255,255,180,0.2)';
    for (let i = 0; i < steps; i += 2) {
        const t = (i + 0.5) / steps;
        ctx.fillRect(Math.round(player.x + dx * t) - 1,
            Math.round(player.y + player.h / 2 + dy * t) - 1, 2, 2);
    }
    // Crosshair
    ctx.strokeStyle = 'rgba(255,220,80,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(mouseX - 8, mouseY); ctx.lineTo(mouseX + 8, mouseY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouseX, mouseY - 8); ctx.lineTo(mouseX, mouseY + 8); ctx.stroke();
}

function drawPlayer() {
    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    if (player.facing < 0) ctx.scale(-1, 1);

    if (knightReady) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(knightImg, -player.w / 2, 0, player.w, player.h);
    } else {
        // Fallback rectangle while image loads
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-player.w / 2, 0, player.w, player.h);
    }
    ctx.restore();
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle   = p.color;
        ctx.fillRect(Math.round(p.x - p.r / 2), Math.round(p.y - p.r / 2),
            Math.ceil(p.r), Math.ceil(p.r));
    }
    ctx.globalAlpha = 1;
}

function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle   = '#eee';
    ctx.font        = 'bold 32px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('PAUZA', W / 2, H / 2 - 10);
    ctx.font      = '14px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('[ESC] pokracovat', W / 2, H / 2 + 24);
    ctx.textAlign = 'left';
}


function loop() {
    update();
    drawBackground();
    drawGround();
    drawPlatforms();
    drawItems();
    drawAimLine();
    drawRope();
    drawPlayer();
    drawParticles();
    if (paused) drawPauseScreen();
    requestAnimationFrame(loop);
}


function updateHUD() {
    document.getElementById('sc').textContent = score;
    document.getElementById('li').textContent = '❤ '.repeat(Math.max(0, lives)).trim() || '✕';
    document.getElementById('lv').textContent = 'LEVEL ' + level;
}

function startGame() {
    document.getElementById('overlay').style.display = 'none';
    score = 0; lives = 3; frame = 0;
    init(1);
    updateHUD();
    running = true;
    loop();
}

function endGame() {
    running = false;
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
    <h1 style="color:#e74c3c">GAME OVER</h1>
    <p>Skore: <span style="font-size:28px">${score}</span></p>
    <button onclick="restartGame()">ZNOVA</button>
  `;
    ov.style.display = 'flex';
}

function restartGame() {
    document.getElementById('overlay').style.display = 'none';
    score = 0; lives = 3; frame = 0;
    init(1);
    updateHUD();
    running = true;
}