const WIDTH = 360;
const HEIGHT = 640;
const FIELD_TOP = 168.5;
const PLAYER_X = 76;
const START_Y = 316;
const PLAYER_HITBOX_SCALE = 0.78;
const BORDER_OVERLAP = 24;
const STEP = 1 / 120;
const START_SPEED = 65;
const SPEED = 110;
const RAMP_DISTANCE = 360;
const GRAVITY = 900;
const JUMP_VELOCITY = -255;

// Positions are sprite centers in the scrolling 1x artwork, in course order.
const placements = [
  ['bac1', 280, 427], ['txt1', 310, 495],
  ['bac2', 392, 496], ['txt2', 420, 473],
  ['txt3', 540, 277], ['bac3', 657, 516],
  ['txt4', 770, 504], ['bac4', 902, 310],
  ['txt5', 1045, 485], ['bac5', 1190, 352],
  ['txt6', 1350, 305], ['bac6', 1510, 485],
  ['txt7', 1680, 365], ['txt8', 1850, 483],
  ['txt9', 2030, 325],
];

const ad = document.body;
const stage = document.querySelector('.stage');
const canvas = document.getElementById('playfield');
const context = canvas.getContext('2d');
context.scale(2, 2);

const start = document.getElementById('start');
const status = document.getElementById('status');
const failed = document.getElementById('failed');
const won = document.getElementById('won');
const replay = document.getElementById('replay');
const mute = document.getElementById('mute');

const clickTag = window.clickTag || 'https://example.com/landing';
document.querySelectorAll('.clickout').forEach(link => { link.href = clickTag; });

const music = new Audio('assets/music/background_music/Funny Game Loop.mp3');
const crash = new Audio('assets/music/crash/Cartoon Crash Boing.mp3');
const failSound = new Audio('assets/music/endcard_fail/Fail.mp3');
const cheer = new Audio('assets/music/endcard_win/Celebrative Happy Woohoo Cheer 2.mp3');
music.loop = true;
music.volume = 0.4;

let sound = null;
let muted = false;
let inView = true;
let state = 'loading';
let frame = null;
let previousTime = null;
let accumulator = 0;
let distance = 0;
let playerY = START_Y;
let velocity = 0;
let player;
let border;
let gut;
let texture;
let course;
let finishDistance;

function loadImage(path) {
  const image = new Image();
  image.src = `assets/${path}`;
  return image.decode().then(() => image);
}

function makeSprite(image, hitboxScale = 1) {
  const width = image.naturalWidth / 2;
  const height = image.naturalHeight / 2;
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(width);
  mask.height = Math.ceil(height);
  const maskContext = mask.getContext('2d');
  const hitboxWidth = width * hitboxScale;
  const hitboxHeight = height * hitboxScale;
  maskContext.drawImage(image, (width - hitboxWidth) / 2, (height - hitboxHeight) / 2, hitboxWidth, hitboxHeight);
  const rgba = maskContext.getImageData(0, 0, mask.width, mask.height).data;
  const solid = new Uint8Array(mask.width * mask.height);

  for (let i = 0; i < solid.length; i += 1) {
    solid[i] = rgba[i * 4 + 3] >= 160;
  }

  return { image, width, height, maskWidth: mask.width, maskHeight: mask.height, solid };
}

function touches(a, ax, ay, b, bx, by, minOverlap = 6) {
  const left = Math.max(ax, bx);
  const top = Math.max(ay, by);
  const right = Math.min(ax + a.maskWidth, bx + b.maskWidth);
  const bottom = Math.min(ay + a.maskHeight, by + b.maskHeight);
  if (left >= right || top >= bottom) return false;

  // Allow a small graze so isolated pixels and antialiased edges do not kill the run.
  let overlap = 0;
  for (let y = top; y < bottom; y += 1) {
    const rowA = (y - ay) * a.maskWidth - ax;
    const rowB = (y - by) * b.maskWidth - bx;
    for (let x = left; x < right; x += 1) {
      if (a.solid[rowA + x] && b.solid[rowB + x]) overlap += 1;
      if (overlap >= minOverlap) return true;
    }
  }
  return false;
}

function draw() {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.save();
  context.beginPath();
  context.rect(0, FIELD_TOP, WIDTH, HEIGHT - FIELD_TOP);
  context.clip();
  context.drawImage(texture, 0, 0, WIDTH, HEIGHT);
  context.drawImage(gut, -distance, 0, gut.naturalWidth / 2, HEIGHT);

  for (const { sprite, left, top } of course) {
    const x = Math.round(left - distance);
    if (x >= WIDTH || x + sprite.width <= 0) continue;
    context.drawImage(sprite.image, x, top, sprite.width, sprite.height);
  }

  context.drawImage(border.image, 0, 0, WIDTH, HEIGHT);
  const top = Math.round(playerY - player.height / 2);
  context.drawImage(player.image, PLAYER_X - player.width / 2, top, player.width, player.height);
  context.restore();
}

function canRun() {
  return !document.hidden && inView;
}

function syncSound() {
  if (!sound) return;
  if (muted || !canRun()) {
    sound.pause();
  } else if (sound.paused && !sound.ended) {
    sound.play().catch(() => {});
  }
}

function setSound(next) {
  if (sound) {
    sound.pause();
    sound.currentTime = 0;
  }
  sound = next;
  if (sound) sound.currentTime = 0;
  syncSound();
}

function showScreen(next) {
  state = next;
  ad.dataset.state = next;
  start.hidden = next !== 'ready';
  canvas.hidden = next !== 'ready' && next !== 'playing';
  failed.hidden = next !== 'failed';
  won.hidden = next !== 'won';
  mute.hidden = next === 'loading' || next === 'error';
  status.hidden = next !== 'loading' && next !== 'error';
}

function update() {
  velocity += GRAVITY * STEP;
  playerY += velocity * STEP;
  const ramp = Math.min(distance / RAMP_DISTANCE, 1);
  distance += (START_SPEED + (SPEED - START_SPEED) * ramp) * STEP;

  const x = PLAYER_X - player.width / 2;
  const y = Math.round(playerY - player.height / 2);
  // The tunnel art can overlap the edge of the player before the wall counts as a hit.
  const hit = touches(player, x, y, border, 0, 0, BORDER_OVERLAP) ||
    course.some(({ sprite, left, top }) => touches(player, x, y, sprite, Math.round(left - distance), top));

  if (hit || y < 0 || y + player.height > HEIGHT) {
    showScreen('failed');
    setSound(hit ? crash : failSound);
    replay.focus({ preventScroll: true });
  } else if (distance >= finishDistance) {
    showScreen('won');
    setSound(cheer);
    won.querySelector('a').focus({ preventScroll: true });
  }
}

function tick(now) {
  frame = null;
  if (state !== 'playing' || !canRun()) return;

  if (previousTime !== null) accumulator += Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  while (accumulator >= STEP && state === 'playing') {
    update();
    accumulator -= STEP;
  }

  if (state === 'playing') {
    draw();
    frame = requestAnimationFrame(tick);
  }
}

function syncVisibility() {
  if (state === 'playing') {
    if (!canRun() && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
    } else if (canRun() && frame === null) {
      frame = requestAnimationFrame(tick);
    }
  }
  syncSound();
}

function readyRun() {
  distance = 0;
  playerY = START_Y;
  velocity = 0;
  accumulator = 0;
  previousTime = null;
  setSound(null);
  draw();
  showScreen('ready');
}

function beginRun() {
  if (state !== 'ready') return;

  velocity = JUMP_VELOCITY;
  showScreen('playing');
  canvas.focus({ preventScroll: true });
  setSound(music);
  syncVisibility();
}

function jump() {
  if (state === 'playing' && canRun()) velocity = JUMP_VELOCITY;
}

start.addEventListener('click', beginRun);
ad.addEventListener('click', event => {
  if (event.target === ad) beginRun();
});
replay.addEventListener('click', () => {
  readyRun();
  start.focus({ preventScroll: true });
});
ad.addEventListener('pointerdown', event => {
  if (event.isPrimary && event.button === 0 && (event.target === ad || event.target === canvas)) jump();
});
canvas.addEventListener('keydown', event => {
  if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
  event.preventDefault();
  if (!event.repeat) jump();
});

crash.addEventListener('ended', () => {
  if (state === 'failed' && sound === crash) setSound(failSound);
});
mute.addEventListener('click', () => {
  muted = !muted;
  mute.setAttribute('aria-pressed', String(muted));
  if (state === 'playing') canvas.focus({ preventScroll: true });
  syncSound();
});
document.addEventListener('visibilitychange', syncVisibility);
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  syncVisibility();
}).observe(stage);

async function prepare() {
  const [gutImage, textureImage, borderImage, playerImage, ...obstacleImages] = await Promise.all([
    loadImage('01_game/gameplay.png'),
    loadImage('01_game/bg_texture.png'),
    loadImage('border.png'),
    loadImage('01_game/player.png'),
    ...placements.map(([name]) => loadImage(`01_game/${name}.png`)),
  ]);

  gut = gutImage;
  texture = textureImage;
  border = makeSprite(borderImage);
  player = makeSprite(playerImage, PLAYER_HITBOX_SCALE);
  course = placements.map(([, x, y], index) => {
    const sprite = makeSprite(obstacleImages[index]);
    return {
      sprite,
      left: Math.round(x - sprite.width / 2),
      top: Math.round(y - sprite.height / 2),
    };
  });
  finishDistance = Math.max(gut.naturalWidth / 2 - WIDTH, ...course.map(({ left, sprite }) =>
    left + sprite.width + 1
  ));

  readyRun();
}

prepare().catch(error => {
  console.error(error);
  status.textContent = 'Gut Run konnte nicht geladen werden.';
  showScreen('error');
});
