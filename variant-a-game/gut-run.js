const WIDTH = 360;
const HEIGHT = 640;
const FIELD_TOP = 168.5;
const PLAYER_X = 76;
const START_Y = 316;
const PLAYER_HITBOX_SCALE = 0.7;
const BORDER_OVERLAP = 24;
const STEP = 1 / 120;
const START_SPEED = 65;
const SPEED = 110;
const RAMP_DISTANCE = 360;
const GRAVITY = 900;
const JUMP_VELOCITY = -255;
const RESULT_ACTION_DELAY = 850;

const obstacleNames = [
  'bac1', 'bac2', 'bac3', 'bac4', 'bac5', 'bac6',
  'txt1', 'txt2', 'txt3', 'txt4', 'txt5', 'txt6', 'txt7', 'txt8', 'txt9',
];

const ad = document.body;
const stage = document.querySelector('.stage');
const canvas = document.getElementById('playfield');
const context = canvas.getContext('2d');
context.scale(2, 2);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const showHitboxes = new URLSearchParams(location.search).get('debug') === '1';

const start = document.getElementById('start');
const status = document.getElementById('status');
const failed = document.getElementById('failed');
const won = document.getElementById('won');
const replay = document.getElementById('replay');
const mute = document.getElementById('mute');

const clickTag = window.clickTag || 'https://example.com/landing';
document.querySelectorAll('.clickout').forEach(link => { link.href = clickTag; });

const music = loadTrack('background_music/Funny Game Loop.mp3', { volume: 0.4, loop: true });
const crash = loadTrack('crash/Cartoon Crash Boing.mp3', { volume: 0.4 });
const failSound = loadTrack('endcard_fail/Fail.mp3', { volume: 0.8, delay: 0.15 });
const cheer = loadTrack('endcard_win/Celebrative Happy Woohoo Cheer 2.mp3');

let audioContext;
let activeSources = [];
let soundSequence = 0;
let muted = false;
let inView = true;
let state = 'loading';
let frame = null;
let resultTimer;
let pressedAction = null;
let previousTime = null;
let accumulator = 0;
let distance = 0;
let playerY = START_Y;
let velocity = 0;
let player;
let border;
let gut;
let texture;
let obstacleSprites;
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
  const pixels = maskContext.getImageData(0, 0, mask.width, mask.height);
  const rgba = pixels.data;
  const solid = new Uint8Array(mask.width * mask.height);

  for (let i = 0; i < solid.length; i += 1) {
    solid[i] = rgba[i * 4 + 3] >= 160;
  }

  if (showHitboxes) {
    for (let i = 0; i < solid.length; i += 1) {
      const offset = i * 4;
      rgba[offset] = 0;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 224;
      rgba[offset + 3] = solid[i] ? 128 : 0;
    }
    maskContext.putImageData(pixels, 0, 0);
  }

  return { image, width, height, maskWidth: mask.width, maskHeight: mask.height, solid, hitbox: showHitboxes ? mask : null };
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateCourse(sprites, random = Math.random) {
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const bacteria = shuffle(sprites.slice(0, 6), random);
  const text = shuffle(sprites.slice(6), random);
  const [openingText] = text.splice(text.findIndex(sprite => sprite.height <= 114), 1);

  // Put a bacterium between runs of one or two words. The opening always has one of each.
  const startsWithText = between(0, 1) === 0;
  const wordRuns = [1, ...shuffle(startsWithText ? [1, 1, 1, 1, 2, 2] : [1, 1, 2, 2, 2], random)];
  const textSlots = startsWithText ? [] : [false];
  for (const [index, length] of wordRuns.entries()) {
    if (index > 0) textSlots.push(false);
    textSlots.push(...Array(length).fill(true));
  }

  // Two lower pairs and three upper pairs guarantee room for long words on both sides.
  const upperSizes = shuffle([1, 2, 2, 2], random);
  const lowerSizes = shuffle([1, 1, 2, 2], random);
  const groupSizes = [2, ...upperSizes.flatMap((size, index) => [size, lowerSizes[index]])];
  const lanes = groupSizes.flatMap((size, index) => Array(size).fill(index % 2 === 1));
  const upperTextCount = lanes.filter((high, index) => high && textSlots[index]).length;
  const longText = text.filter(sprite => sprite.height > 140);
  const [firstUpper, lastUpper] = longText.filter(sprite => sprite.height < 160);
  const [firstLower, lastLower] = longText.filter(sprite => sprite !== firstUpper && sprite !== lastUpper);
  const shortText = text.filter(sprite => !longText.includes(sprite));
  const upperText = [firstUpper, ...shortText.slice(0, upperTextCount - 2), lastUpper];
  const lowerText = [firstLower, ...shortText.slice(upperTextCount - 2), lastLower];
  let left = between(246, 254);

  return lanes.map((high, index) => {
    let sprite = openingText;
    if (!textSlots[index]) sprite = bacteria.shift();
    else if (index >= 2) sprite = (high ? upperText : lowerText).shift();

    if (index > 0) left += high !== lanes[index - 1] ? between(130, 134) : between(38, 43);
    const height = Math.ceil(sprite.height);
    let top;
    if (index < 2) {
      top = between(428, Math.min(474, 562 - height));
    } else if (high) {
      top = height > 140 ? between(239, 245) : between(395, 411) - height;
    } else if (height > 140) {
      top = between(558, 562) - height;
    } else {
      top = between(373, Math.min(391, 562 - height));
    }

    const placement = { sprite, left, top };
    left += Math.ceil(sprite.width);
    return placement;
  });
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
    if (sprite.hitbox) context.drawImage(sprite.hitbox, x, top);
  }

  context.drawImage(border.image, 0, 0, WIDTH, HEIGHT);
  if (border.hitbox) context.drawImage(border.hitbox, 0, 0);
  const top = Math.round(playerY - player.height / 2);
  context.translate(PLAYER_X, top + player.height / 2);
  if (!reducedMotion.matches) context.rotate(Math.max(-0.08, Math.min(0.08, velocity / 3800)));
  context.drawImage(player.image, -player.width / 2, -player.height / 2, player.width, player.height);
  context.restore();
  if (player.hitbox) context.drawImage(player.hitbox, PLAYER_X - player.width / 2, top);
}

function canRun() {
  return !document.hidden && inView;
}

function loadTrack(path, { volume = 1, loop = false, delay = 0 } = {}) {
  const file = fetch(`assets/music/${path}`)
    .then(response => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);
  return { file, volume, loop, delay };
}

function unlockSound() {
  if (audioContext || !window.AudioContext) return;
  try {
    audioContext = new AudioContext();
  } catch {
    return;
  }

  for (const track of [music, crash, failSound, cheer]) {
    track.buffer = track.file
      .then(file => file && audioContext.decodeAudioData(file))
      .catch(() => null);
  }
}

function syncSound() {
  if (!audioContext) return;
  const change = muted || !canRun() ? audioContext.suspend() : audioContext.resume();
  change.catch(() => {});
}

function setSound(...tracks) {
  const sequence = ++soundSequence;
  for (const source of activeSources) source.stop();
  activeSources = [];
  if (!audioContext) return;

  for (const track of tracks) {
    track.buffer.then(buffer => {
      // A replay or screen change can happen while a clip is still decoding.
      if (!buffer || sequence !== soundSequence) return;
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      source.loop = track.loop;
      gain.gain.value = track.volume;
      source.connect(gain).connect(audioContext.destination);
      source.start(audioContext.currentTime + track.delay);
      activeSources.push(source);
    });
  }
}

function showScreen(next) {
  clearTimeout(resultTimer);
  pressedAction = null;
  state = next;
  ad.dataset.state = next;
  start.hidden = next !== 'ready';
  canvas.hidden = next === 'loading' || next === 'error';
  failed.hidden = next !== 'failed';
  won.hidden = next !== 'won';
  mute.hidden = next === 'loading' || next === 'error';
  status.hidden = next !== 'loading' && next !== 'error';

  const endcard = next === 'failed' ? failed : next === 'won' ? won : null;
  if (endcard) {
    const actions = endcard.querySelector('.endcard-actions');
    actions.hidden = true;
    endcard.focus({ preventScroll: true });
    resultTimer = setTimeout(() => { actions.hidden = false; }, RESULT_ACTION_DELAY);
  }
  canvas.setAttribute('aria-hidden', String(next !== 'playing'));
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
    if (hit) setSound(crash, failSound);
    else setSound(failSound);
  } else if (distance >= finishDistance) {
    showScreen('won');
    setSound(cheer);
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

  draw();
  if (state === 'playing') frame = requestAnimationFrame(tick);
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
  course = generateCourse(obstacleSprites);
  distance = 0;
  playerY = START_Y;
  velocity = 0;
  accumulator = 0;
  previousTime = null;
  setSound();
  draw();
  showScreen('ready');
}

function beginRun() {
  if (state !== 'ready') return;

  velocity = JUMP_VELOCITY;
  showScreen('playing');
  canvas.focus({ preventScroll: true });
  unlockSound();
  setSound(music);
  syncVisibility();
}

function jump() {
  if (state !== 'playing' || !canRun()) return;
  velocity = JUMP_VELOCITY;
  if (!muted && audioContext?.state !== 'running') syncSound();
}

start.addEventListener('click', beginRun);
ad.addEventListener('click', event => {
  const action = event.target.closest('.image-control');
  // A touch released after the controls appear must have started on that control.
  if (action && event.detail > 0 && action !== pressedAction) {
    event.preventDefault();
    event.stopPropagation();
    if (document.activeElement === action) action.closest('.endcard').focus({ preventScroll: true });
  }
  pressedAction = null;
  if (event.target === ad) beginRun();
}, { capture: true });
replay.addEventListener('click', () => {
  readyRun();
  start.focus({ preventScroll: true });
});
ad.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  pressedAction = event.target.closest('.image-control');
  if (event.target === ad || event.target === canvas) jump();
});
canvas.addEventListener('keydown', event => {
  if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
  event.preventDefault();
  if (!event.repeat) jump();
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
    ...obstacleNames.map(name => loadImage(`01_game/${name}.png`)),
  ]);

  gut = gutImage;
  texture = textureImage;
  border = makeSprite(borderImage);
  player = makeSprite(playerImage, PLAYER_HITBOX_SCALE);
  obstacleSprites = obstacleImages.map(image => makeSprite(image));
  finishDistance = gut.naturalWidth / 2 - WIDTH;

  readyRun();
}

prepare().catch(error => {
  console.error(error);
  status.textContent = 'Gut Run konnte nicht geladen werden.';
  showScreen('error');
});
