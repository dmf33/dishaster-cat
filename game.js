const scoreValue = document.getElementById("score-value");
const timerValue = document.getElementById("timer-value");
const overlay = document.getElementById("overlay");
const overlayEyebrow = document.getElementById("overlay-eyebrow");
const overlayTitle = document.getElementById("overlay-title");
const finalScore = document.getElementById("final-score");
const restartButton = document.getElementById("restart-button");

const GAME_WIDTH = 900;
const GAME_HEIGHT = 540;
const ROUND_TIME_SECONDS = 45;
const FLOOR_HEIGHT = 58;
const WORLD_GRAVITY = 900;
const PLAYER_SPEED = 230;
const JUMP_SPEED = 430;
const PLAYER_START_X = 96;
const PLAYER_BODY_HEIGHT = 42;
const FLOOR_BREAK_Y = GAME_HEIGHT - FLOOR_HEIGHT - 10;
const SHELF_HEIGHT = 18;
const MAIN_PATH_SHELF_COUNT_MIN = 5;
const MAIN_PATH_SHELF_COUNT_MAX = 7;
const EXTRA_SHELF_COUNT_MAX = 2;
const SHELF_WIDTH_MIN = 150;
const SHELF_WIDTH_MAX = 220;
const MAX_REACHABLE_VERTICAL_GAP = Math.floor((JUMP_SPEED * JUMP_SPEED) / (2 * WORLD_GRAVITY));
const MAX_REACHABLE_HORIZONTAL_GAP = Math.floor((2 * JUMP_SPEED / WORLD_GRAVITY) * PLAYER_SPEED * 0.78);
const SHELF_SIDE_PADDING = 44;
const ROOM_TOP_PADDING = PLAYER_BODY_HEIGHT + 40;
const ROOM_BACKGROUND_ASSET = "assets/images/easter-wallpaper.png";
const MIN_PLATFORM_VERTICAL_GAP = Math.max(80, PLAYER_BODY_HEIGHT + SHELF_HEIGHT + 20);
const SAFE_FIRST_VERTICAL_GAP_MIN = MIN_PLATFORM_VERTICAL_GAP;
const SAFE_FIRST_VERTICAL_GAP_MAX = Math.min(84, MAX_REACHABLE_VERTICAL_GAP - 12);
const SAFE_VERTICAL_GAP_MIN = MIN_PLATFORM_VERTICAL_GAP;
const SAFE_VERTICAL_GAP_MAX = Math.min(88, MAX_REACHABLE_VERTICAL_GAP - 8);
const SAFE_HORIZONTAL_OFFSET_MAX = Math.min(140, MAX_REACHABLE_HORIZONTAL_GAP - 18);
const SAFE_HORIZONTAL_OFFSET_MIN = 64;
const SAFE_HORIZONTAL_EDGE_GAP = 118;
const MAIN_PATH_ZONE_CENTERS = [190, 450, 710];
const MAIN_PATH_ZONE_JITTER = 58;
const SAFE_SIDE_SHELF_HORIZONTAL_MIN = 72;
const SAFE_SIDE_SHELF_HORIZONTAL_MAX = Math.min(110, SAFE_HORIZONTAL_OFFSET_MAX);
const SAFE_SIDE_SHELF_VERTICAL_MIN = MIN_PLATFORM_VERTICAL_GAP;
const SAFE_SIDE_SHELF_VERTICAL_MAX = SAFE_VERTICAL_GAP_MAX;

let game;

class RetroSoundPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.noiseBuffer = null;
  }

  unlock() {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      context.resume();
    }
  }

  playJump() {
    this.playTone({
      type: "square",
      startFrequency: 380,
      endFrequency: 620,
      duration: 0.12,
      volume: 0.05
    });
  }

  playKnock() {
    this.playTone({
      type: "square",
      startFrequency: 180,
      endFrequency: 120,
      duration: 0.08,
      volume: 0.035
    });
  }

  playBreak() {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    this.unlock();

    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer();

    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(700, now);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + 0.15);

    this.playTone({
      type: "triangle",
      startFrequency: 520,
      endFrequency: 180,
      duration: 0.15,
      volume: 0.025,
      delay: 0.01
    });
  }

  playWin() {
    this.playSequence([
      { type: "square", startFrequency: 523, endFrequency: 523, duration: 0.09, volume: 0.05, delay: 0 },
      { type: "square", startFrequency: 659, endFrequency: 659, duration: 0.09, volume: 0.05, delay: 0.11 },
      { type: "square", startFrequency: 784, endFrequency: 784, duration: 0.15, volume: 0.055, delay: 0.22 }
    ]);
  }

  playLose() {
    this.playSequence([
      { type: "sawtooth", startFrequency: 240, endFrequency: 220, duration: 0.12, volume: 0.045, delay: 0 },
      { type: "sawtooth", startFrequency: 180, endFrequency: 140, duration: 0.18, volume: 0.04, delay: 0.13 }
    ]);
  }

  playSequence(steps) {
    steps.forEach((step) => this.playTone(step));
  }

  playTone({ type, startFrequency, endFrequency, duration, volume, delay = 0 }) {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    this.unlock();

    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  getAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    this.audioContext = new AudioContextClass();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.audioContext.destination);

    return this.audioContext;
  }

  getNoiseBuffer() {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const context = this.getAudioContext();
    if (!context) {
      return null;
    }

    const buffer = context.createBuffer(1, context.sampleRate * 0.2, context.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let index = 0; index < channelData.length; index += 1) {
      channelData[index] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }
}

const soundPlayer = new RetroSoundPlayer();

window.addEventListener("pointerdown", () => {
  soundPlayer.unlock();
}, { passive: true });

window.addEventListener("keydown", () => {
  soundPlayer.unlock();
});

class DishasterScene extends Phaser.Scene {
  constructor() {
    super("DishasterScene");

    this.score = 0;
    this.timeLeft = ROUND_TIME_SECONDS;
    this.gameEnded = false;
  }

  preload() {
    this.load.image("roomWallpaper", ROOM_BACKGROUND_ASSET);
    this.createTextures();
  }

  create() {
    this.score = 0;
    this.timeLeft = ROUND_TIME_SECONDS;
    this.gameEnded = false;
    this.updateHud();
    this.hideOverlay();

    this.cameras.main.setBackgroundColor("#f7e4b7");
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawRoom();
    this.createPlatforms();
    this.createPlayer();
    this.createDishes();
    this.createTimer();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update() {
    if (this.gameEnded) {
      this.player.setVelocityX(0);
      return;
    }

    const moveLeft = this.cursors.left.isDown;
    const moveRight = this.cursors.right.isDown;

    if (moveLeft) {
      this.player.setVelocityX(-PLAYER_SPEED);
      this.player.setFlipX(true);
    } else if (moveRight) {
      this.player.setVelocityX(PLAYER_SPEED);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (jumpPressed && this.player.body.blocked.down) {
      this.player.setVelocityY(-JUMP_SPEED);
      soundPlayer.playJump();
    }

    this.checkFallingDishes();
  }

  createTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    if (!this.textures.exists("cat")) {
      graphics.fillStyle(0x7b4b2a, 1);
      graphics.fillRoundedRect(4, 14, 52, 28, 12);
      graphics.fillTriangle(12, 16, 20, 4, 26, 16);
      graphics.fillTriangle(34, 16, 40, 4, 48, 16);
      graphics.fillCircle(48, 26, 10);
      graphics.fillRect(12, 38, 8, 16);
      graphics.fillRect(24, 38, 8, 16);
      graphics.fillRect(38, 38, 8, 16);
      graphics.generateTexture("cat", 60, 56);
      graphics.clear();
    }

    if (!this.textures.exists("plate")) {
      graphics.fillStyle(0xe9eff5, 1);
      graphics.fillCircle(14, 14, 12);
      graphics.lineStyle(4, 0xcfd8e3, 1);
      graphics.strokeCircle(14, 14, 10);
      graphics.generateTexture("plate", 28, 28);
      graphics.clear();
    }

    if (!this.textures.exists("cup")) {
      graphics.fillStyle(0x9cc9d6, 1);
      graphics.fillRoundedRect(6, 6, 16, 20, 5);
      graphics.lineStyle(3, 0x6ea7ba, 1);
      graphics.strokeRoundedRect(6, 6, 16, 20, 5);
      graphics.strokeCircle(24, 16, 5);
      graphics.generateTexture("cup", 30, 32);
      graphics.clear();
    }

    if (!this.textures.exists("vase")) {
      graphics.fillStyle(0xcfd0f7, 1);
      graphics.fillEllipse(14, 18, 18, 22);
      graphics.fillRect(11, 4, 6, 10);
      graphics.lineStyle(3, 0xa3a5d8, 1);
      graphics.strokeEllipse(14, 18, 18, 22);
      graphics.generateTexture("vase", 28, 34);
      graphics.clear();
    }

    graphics.destroy();
  }

  drawRoom() {
    const roomHeight = GAME_HEIGHT - FLOOR_HEIGHT;
    const wallpaperBase = this.add.rectangle(0, 0, GAME_WIDTH, roomHeight, 0xf7ecd0)
      .setOrigin(0, 0);
    wallpaperBase.setDepth(-3);

    const wallpaper = this.add.image(GAME_WIDTH / 2, roomHeight / 2, "roomWallpaper");
    wallpaper.setDisplaySize(GAME_WIDTH, roomHeight);
    wallpaper.setAlpha(0.78);
    wallpaper.setDepth(-2);

    const wallpaperWash = this.add.rectangle(0, 0, GAME_WIDTH, roomHeight, 0xfffbf2)
      .setOrigin(0, 0)
      .setAlpha(0.18);
    wallpaperWash.setDepth(-1.5);

    const background = this.add.graphics();
    background.setDepth(-1);

    background.fillStyle(0xe7c98e, 1);
    background.fillRect(0, GAME_HEIGHT - FLOOR_HEIGHT, GAME_WIDTH, FLOOR_HEIGHT);

    background.fillStyle(0xd9b677, 1);
    background.fillRect(0, GAME_HEIGHT - FLOOR_HEIGHT, GAME_WIDTH, 8);

    background.fillStyle(0xf3e3b9, 1);
    background.fillRect(40, 36, GAME_WIDTH - 80, 10);

    background.lineStyle(4, 0xe0b96d, 0.9);
    for (let x = 96; x < GAME_WIDTH; x += 140) {
      background.strokeLineShape(new Phaser.Geom.Line(x, 36, x + 40, 46));
    }
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    const floorTop = GAME_HEIGHT - FLOOR_HEIGHT;

    this.floor = this.createPlatform({
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - FLOOR_HEIGHT / 2,
      width: GAME_WIDTH,
      height: FLOOR_HEIGHT,
      color: 0xaf7c47
    });

    this.generatedShelves = this.generateReachableShelves(floorTop);

    this.generatedShelves.forEach((shelfData) => {
      const shelf = this.createPlatform({
        ...shelfData,
        color: 0x9e6d3f
      });

      this.platforms.add(shelf);
    });
  }

  createPlatform({ x, y, width, height, color }) {
    const platform = this.add.rectangle(x, y, width, height, color);
    platform.setStrokeStyle(4, 0x7f5129);
    this.physics.add.existing(platform, true);
    return platform;
  }

  generateReachableShelves(floorTop) {
    const mainPathShelves = [];
    const maxShelvesThatFit = Math.max(
      MAIN_PATH_SHELF_COUNT_MIN,
      Math.floor((floorTop - ROOM_TOP_PADDING) / SAFE_VERTICAL_GAP_MIN)
    );
    const mainShelfCount = Phaser.Math.Between(
      MAIN_PATH_SHELF_COUNT_MIN,
      Math.min(MAIN_PATH_SHELF_COUNT_MAX, maxShelvesThatFit)
    );
    let previousShelf = {
      x: PLAYER_START_X + 54,
      y: floorTop + FLOOR_HEIGHT / 2,
      width: GAME_WIDTH,
      height: FLOOR_HEIGHT
    };
    const lanePlan = this.buildMainPathLanePlan(mainShelfCount);

    for (let index = 0; index < mainShelfCount; index += 1) {
      const width = Phaser.Math.Between(SHELF_WIDTH_MIN, SHELF_WIDTH_MAX);
      const shelvesRemaining = mainShelfCount - index - 1;
      const verticalGap = this.getVerticalGapForShelf(previousShelf, shelvesRemaining, index === 0);
      const desiredTop = this.getPlatformTop(previousShelf) - verticalGap;
      const y = desiredTop + SHELF_HEIGHT / 2;
      const targetX = this.getReachableMainPathX(previousShelf, width, lanePlan[index], index);
      const shelf = {
        x: targetX,
        y,
        width,
        height: SHELF_HEIGHT
      };

      if (!this.isShelfReachable(previousShelf, shelf)) {
        shelf.x = this.clampShelfX(
          previousShelf.x + Phaser.Math.Between(-SAFE_HORIZONTAL_OFFSET_MAX, SAFE_HORIZONTAL_OFFSET_MAX),
          width
        );
      }

      mainPathShelves.push(shelf);
      previousShelf = shelf;
    }

    const allShelves = [...mainPathShelves];
    const extraShelfCount = Phaser.Math.Between(0, EXTRA_SHELF_COUNT_MAX);

    for (let index = 0; index < extraShelfCount; index += 1) {
      const anchorShelf = Phaser.Utils.Array.GetRandom(mainPathShelves.slice(1));
      const extraShelf = this.createReachableSideShelf(anchorShelf, allShelves);

      if (extraShelf) {
        allShelves.push(extraShelf);
      }
    }

    return allShelves.sort((a, b) => a.y - b.y);
  }

  buildMainPathLanePlan(mainShelfCount) {
    const zonePatterns = {
      5: [
        [0, 1, 2, 1, 2],
        [0, 1, 0, 1, 2]
      ],
      6: [
        [0, 1, 2, 1, 2, 1],
        [0, 1, 0, 1, 2, 1],
        [0, 1, 2, 1, 0, 1]
      ],
      7: [
        [0, 1, 2, 1, 2, 1, 2],
        [0, 1, 0, 1, 2, 1, 2],
        [0, 1, 2, 1, 0, 1, 2]
      ]
    };

    return Phaser.Utils.Array.GetRandom(zonePatterns[mainShelfCount]);
  }

  getReachableMainPathX(previousShelf, width, zoneIndex, shelfIndex) {
    const zoneCenter = MAIN_PATH_ZONE_CENTERS[zoneIndex];
    const safeCenterDelta = SAFE_HORIZONTAL_EDGE_GAP + (previousShelf.width + width) / 2;
    const minReachX = previousShelf.x - safeCenterDelta;
    const maxReachX = previousShelf.x + safeCenterDelta;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidateX = this.clampShelfX(
        zoneCenter + Phaser.Math.Between(-MAIN_PATH_ZONE_JITTER, MAIN_PATH_ZONE_JITTER),
        width
      );

      if (candidateX >= minReachX && candidateX <= maxReachX) {
        return candidateX;
      }
    }

    if (shelfIndex === 0) {
      return this.clampShelfX(Phaser.Math.Between(150, 240), width);
    }

    const clampedZoneX = this.clampShelfX(zoneCenter, width);
    return Phaser.Math.Clamp(
      clampedZoneX,
      this.clampShelfX(minReachX, width),
      this.clampShelfX(maxReachX, width)
    );
  }

  createReachableSideShelf(anchorShelf, existingShelves) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const width = Phaser.Math.Between(SHELF_WIDTH_MIN - 10, SHELF_WIDTH_MAX - 20);
      const horizontalDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
      const horizontalOffset = Phaser.Math.Between(SAFE_SIDE_SHELF_HORIZONTAL_MIN, SAFE_SIDE_SHELF_HORIZONTAL_MAX);
      const verticalOffset = Phaser.Math.Between(SAFE_SIDE_SHELF_VERTICAL_MIN, SAFE_SIDE_SHELF_VERTICAL_MAX);
      const shelf = {
        x: this.clampShelfX(anchorShelf.x + horizontalDirection * horizontalOffset, width),
        y: anchorShelf.y - verticalOffset,
        width,
        height: SHELF_HEIGHT
      };

      if (this.getPlatformTop(shelf) < ROOM_TOP_PADDING) {
        continue;
      }

      if (!this.isShelfReachable(anchorShelf, shelf)) {
        continue;
      }

      if (this.overlapsShelf(existingShelves, shelf)) {
        continue;
      }

      return shelf;
    }

    return null;
  }

  overlapsShelf(existingShelves, candidateShelf) {
    return existingShelves.some((shelf) => {
      const horizontalOverlap = Math.abs(shelf.x - candidateShelf.x) < (shelf.width + candidateShelf.width) / 2 + 18;
      const verticalOverlap = Math.abs(shelf.y - candidateShelf.y) < MIN_PLATFORM_VERTICAL_GAP;
      return horizontalOverlap && verticalOverlap;
    });
  }

  isShelfReachable(fromShelf, toShelf) {
    const verticalGap = this.getPlatformTop(fromShelf) - this.getPlatformTop(toShelf);
    const horizontalGap = this.getHorizontalEdgeGap(fromShelf, toShelf);

    return verticalGap >= 0 &&
      verticalGap <= SAFE_VERTICAL_GAP_MAX &&
      horizontalGap <= SAFE_HORIZONTAL_EDGE_GAP;
  }

  getHorizontalEdgeGap(fromShelf, toShelf) {
    return Math.max(
      0,
      Math.abs(toShelf.x - fromShelf.x) - (fromShelf.width + toShelf.width) / 2
    );
  }

  getPlatformTop(platform) {
    return platform.y - platform.height / 2;
  }

  getVerticalGapForShelf(previousShelf, shelvesRemaining, isFirstShelf) {
    const minGap = isFirstShelf ? SAFE_FIRST_VERTICAL_GAP_MIN : SAFE_VERTICAL_GAP_MIN;
    const baseMaxGap = isFirstShelf ? SAFE_FIRST_VERTICAL_GAP_MAX : SAFE_VERTICAL_GAP_MAX;
    const previousTop = this.getPlatformTop(previousShelf);
    const maxAllowedGap = previousTop - (ROOM_TOP_PADDING + shelvesRemaining * MIN_PLATFORM_VERTICAL_GAP);
    const safeMaxGap = Phaser.Math.Clamp(maxAllowedGap, minGap, baseMaxGap);
    return Phaser.Math.Between(minGap, safeMaxGap);
  }

  clampShelfX(x, width) {
    const minX = width / 2 + SHELF_SIDE_PADDING;
    const maxX = GAME_WIDTH - width / 2 - SHELF_SIDE_PADDING;
    return Phaser.Math.Clamp(x, minX, maxX);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(96, GAME_HEIGHT - FLOOR_HEIGHT - 48, "cat");
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.02);
    this.player.body.setSize(40, 42).setOffset(10, 12);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.floor);
  }

  createDishes() {
    this.dishes = this.physics.add.group();
    const dishTypes = ["plate", "cup", "vase"];

    this.generatedShelves.forEach((shelf) => {
      const maxDishCount = Math.min(3, Math.max(1, Math.floor((shelf.width - 32) / 52)));
      const dishCount = Phaser.Math.Between(1, maxDishCount);
      const leftEdge = shelf.x - shelf.width / 2 + 30;
      const rightEdge = shelf.x + shelf.width / 2 - 30;
      const step = dishCount === 1 ? 0 : (rightEdge - leftEdge) / (dishCount - 1);

      for (let index = 0; index < dishCount; index += 1) {
        const type = dishTypes[(index + Phaser.Math.Between(0, dishTypes.length - 1)) % dishTypes.length];
        const x = dishCount === 1 ? shelf.x : leftEdge + step * index;
        const y = shelf.y - shelf.height / 2 - 18;
        const dish = this.dishes.create(x, y, type);
        dish.type = type;
        dish.isFalling = false;
        dish.isBroken = false;
        dish.body.setAllowGravity(false);
        dish.body.setImmovable(true);
        dish.body.setCollideWorldBounds(false);
        dish.body.setBounce(0.1, 0);
      }
    });

    this.physics.add.overlap(this.player, this.dishes, this.knockDish, undefined, this);
  }

  createTimer() {
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameEnded) {
          return;
        }

        this.timeLeft -= 1;
        this.updateHud();

        if (this.timeLeft <= 0) {
          this.endGame();
        }
      }
    });
  }

  knockDish(player, dish) {
    if (dish.isFalling || dish.isBroken || this.gameEnded) {
      return;
    }

    dish.isFalling = true;
    dish.body.setAllowGravity(true);
    dish.body.setImmovable(false);
    dish.setAngularVelocity(player.body.velocity.x >= 0 ? 140 : -140);
    dish.setVelocity(player.body.velocity.x * 0.7, -40);
    soundPlayer.playKnock();
  }

  checkFallingDishes() {
    const dishes = this.dishes.getChildren();

    for (const dish of dishes) {
      if (!dish.active || !dish.isFalling || dish.isBroken) {
        continue;
      }

      if (dish.y >= FLOOR_BREAK_Y) {
        this.breakDish(dish);

        if (this.gameEnded) {
          return;
        }
      }
    }
  }

  breakDish(dish) {
    if (this.gameEnded) {
      return;
    }

    dish.isBroken = true;
    this.score += 1;
    dish.destroy();
    soundPlayer.playBreak();
    this.updateHud();

    if (this.getRemainingDishes() === 0) {
      this.winGame();
    }
  }

  getRemainingDishes() {
    return this.dishes.countActive(true);
  }

  updateHud() {
    scoreValue.textContent = String(this.score);
    timerValue.textContent = String(Math.max(this.timeLeft, 0));
  }

  endGame() {
    soundPlayer.playLose();
    this.finishRound("Game Over", "Time's up");
  }

  winGame() {
    soundPlayer.playWin();
    this.finishRound("You Win!", "All dishes smashed");
  }

  finishRound(title, eyebrow) {
    if (this.gameEnded) {
      return;
    }

    this.gameEnded = true;
    this.gameTimer.remove(false);
    this.physics.world.pause();
    this.player.setTint(0xb5a18f);
    this.player.setVelocity(0, 0);
    this.player.body.enable = false;
    overlayEyebrow.textContent = eyebrow;
    overlayTitle.textContent = title;
    finalScore.textContent = `Final Score: ${this.score}`;
    overlay.classList.remove("overlay--hidden");
  }

  hideOverlay() {
    overlay.classList.add("overlay--hidden");
    overlayEyebrow.textContent = "Time's up";
    overlayTitle.textContent = "Game Over";
    finalScore.textContent = "Final Score: 0";
  }
}

function startGame() {
  if (game) {
    game.destroy(true);
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game-container",
    backgroundColor: "#f7e4b7",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: WORLD_GRAVITY },
        debug: false
      }
    },
    scene: DishasterScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
}

restartButton.addEventListener("click", () => {
  startGame();
});

startGame();
