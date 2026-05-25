const BESTIARY_DEFAULTS = {
  worker: { name: "Рабочий", cost: 50, hp: 45, speed: 115, damage: 3 },
  soldier: { name: "Воин игрока", cost: 100, hp: 115, speed: 72, damage: 10 },
  archer: { name: "Лучник", cost: 140, hp: 27, speed: 82, damage: 9, range: 255 },
  enemy: { name: "Воин врага", cost: 0, hp: 78, speed: 42, damage: 7 },
  enemyBase: { name: "Вражеское здание", hp: 520, damage: 0 },
  tower: { name: "Башня", cost: 75, hp: 160, range: 210, damage: 14 },
  barracks: { name: "Казарма", cost: 150, hp: 220, production: 0, damage: 0 },
  base: { name: "Кубик", hp: 420, income: 0, interval: 3, damage: 10 },
  mine: { name: "Рудник", hp: 999, income: 3, interval: 1, damage: 0 },
};

const STORAGE_KEY = "clay_strategy_bestiary_v3";
const SOUND_SETTINGS_KEY = "clay_strategy_sound_settings_v1";
const SOUND_DB_NAME = "clay_strategy_sound_files";
const SOUND_DB_STORE = "sounds";
const WORLD_LIMITS = { minX: -320, maxX: 3200, minY: 50, maxY: 980 };
const SOUND_DEFS = {
  bow: { src: "assets/sound-bow.mp3", volume: 0.72, duration: 0.9 },
  towerShot: { src: "assets/sound-bow.mp3", volume: 0.72, duration: 0.9 },
  melee: { src: "assets/sound-melee.mp3", volume: 0.6, duration: 0.65 },
  build: { src: "assets/sound-build.mp3", volume: 0.56, duration: 0.7 },
  pickaxe: { src: "assets/sound-pickaxe.mp3", volume: 0.46, duration: 0.34 },
  death: { src: "assets/sound-death.mp3", volume: 0.55, duration: 0.55 },
  buildingBreak: { src: "assets/sound-building-break.mp3", volume: 0.68, duration: 0.72 },
  music: { src: null, volume: 0.36, duration: 0 },
};
const UNIT_SOUND_CONTROLS = {
  worker: [{ key: "pickaxe", label: "Звук добывания руды (рабочий)" }],
  soldier: [
    { key: "melee", label: "Звук атаки (воин)" },
    { key: "death", label: "Звук смерти юнита" },
  ],
  archer: [
    { key: "bow", label: "Звук атаки (лучник)" },
    { key: "death", label: "Звук смерти юнита" },
  ],
  enemy: [
    { key: "melee", label: "Звук атаки (враг)" },
    { key: "death", label: "Звук смерти юнита" },
  ],
  base: [
    { key: "buildingBreak", label: "Звук разрушения (замок)" },
    { key: "music", label: "Музыка на фоне" },
  ],
  enemyBase: [{ key: "buildingBreak", label: "Звук разрушения (вражеский замок)" }],
  barracks: [{ key: "build", label: "Звук создания здания (казарма)" }],
  tower: [
    { key: "towerShot", label: "Звук выстрела башни" },
    { key: "build", label: "Звук создания здания (башня)" },
  ],
};
const world = document.getElementById("world");
const camera = document.getElementById("camera");
const entitiesLayer = document.getElementById("entities");
const rangeLayer = document.getElementById("rangeLayer");
const effectsLayer = document.getElementById("effects");
const radialMenu = document.getElementById("radialMenu");
const ghost = document.getElementById("ghost");
const selectionBox = document.getElementById("selectionBox");
const moneyValue = document.getElementById("moneyValue");
const zoomValue = document.getElementById("zoomValue");
const waveTimer = document.getElementById("waveTimer");
const messageLog = document.getElementById("messageLog");
const continueBtn = document.getElementById("continueBtn");

let roadsLayer = document.getElementById("roads");
if (!roadsLayer) {
  roadsLayer = document.createElement("div");
  roadsLayer.id = "roads";
  roadsLayer.className = "roads";
  camera.insertBefore(roadsLayer, rangeLayer);
}
if (radialMenu.parentElement !== camera) {
  camera.append(radialMenu);
}

const screens = {
  menu: document.getElementById("mainMenu"),
  bestiary: document.getElementById("bestiaryScreen"),
  game: document.getElementById("gameScreen"),
};

const state = {
  money: 200,
  zoom: 1,
  panX: 0,
  panY: 0,
  baseLevel: 1,
  baseTowerCount: 1,
  baseTowers: [true, false, false],
  level: 1,
  selected: [],
  selectedTowerIndex: null,
  radialAnchor: null,
  lastClick: { type: null, time: 0 },
  buildMode: null,
  nextId: 1,
  entities: [],
  enemies: [],
  workers: [],
  soldiers: [],
  archers: [],
  barracks: [],
  towers: [],
  enemyBase: null,
  enemyMine: null,
  enemyMoney: 0,
  enemyBarracks: null,
  enemyWorkers: [],
  enemyIncomeTimer: 0,
  enemySpawnTimer: 0,
  firstWaveCleared: false,
  victoryPending: false,
  buildWorker: null,
  mine: null,
  waveStarted: false,
  waveStartAt: 60,
  lastTime: 0,
  mineIncomeTimer: 0,
  drag: null,
  rightDrag: null,
  suppressContext: false,
  jobs: [],
  productionJobs: [],
  rallyPoints: new Map(),
  radialButtons: [],
  hasStarted: false,
  isPaused: false,
  audioContext: null,
  sounds: {},
  customSoundUrls: {},
  soundSettings: loadSoundSettings(),
  musicAudio: null,
  bestiary: loadBestiary(),
};

Object.entries(SOUND_DEFS).forEach(([key, def]) => {
  if (!def.src) return;
  const audio = new Audio(def.src);
  audio.preload = "auto";
  audio.volume = def.volume;
  state.sounds[key] = audio;
});
loadCustomSounds();

function loadBestiary() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(BESTIARY_DEFAULTS);
  try {
    const data = { ...structuredClone(BESTIARY_DEFAULTS), ...JSON.parse(saved) };
    if (data.archer?.hp === 80) data.archer.hp = 27;
    return data;
  } catch {
    return structuredClone(BESTIARY_DEFAULTS);
  }
}

function saveBestiary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bestiary));
}

function loadSoundSettings() {
  try {
    return JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSoundSettings() {
  localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(state.soundSettings));
}

function openSoundDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SOUND_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SOUND_DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putSoundBlob(key, blob) {
  const db = await openSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_DB_STORE, "readwrite");
    tx.objectStore(SOUND_DB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSoundBlob(key) {
  const db = await openSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_DB_STORE, "readonly");
    const request = tx.objectStore(SOUND_DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSoundBlob(key) {
  const db = await openSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_DB_STORE, "readwrite");
    tx.objectStore(SOUND_DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadCustomSounds() {
  await Promise.all(Object.keys(state.soundSettings).map(async key => {
    const blob = await getSoundBlob(key);
    if (blob) setSoundFromBlob(key, blob);
  }));
}

function setSoundFromBlob(key, blob) {
  if (state.customSoundUrls[key]) URL.revokeObjectURL(state.customSoundUrls[key]);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = SOUND_DEFS[key]?.volume ?? 0.6;
  if (key === "music") audio.loop = true;
  state.customSoundUrls[key] = url;
  state.sounds[key] = audio;
}

async function saveCustomSound(key, file) {
  await putSoundBlob(key, file);
  state.soundSettings[key] = { fileName: file.name, type: file.type, size: file.size };
  saveSoundSettings();
  setSoundFromBlob(key, file);
  if (key === "music" && screens.game && !screens.game.classList.contains("hidden")) playBackgroundMusic();
}

async function resetCustomSound(key) {
  await deleteSoundBlob(key);
  delete state.soundSettings[key];
  saveSoundSettings();
  if (state.customSoundUrls[key]) URL.revokeObjectURL(state.customSoundUrls[key]);
  delete state.customSoundUrls[key];
  if (key === "music") stopBackgroundMusic();
  const def = SOUND_DEFS[key];
  if (def?.src) {
    const audio = new Audio(def.src);
    audio.preload = "auto";
    audio.volume = def.volume;
    state.sounds[key] = audio;
  } else {
    delete state.sounds[key];
  }
}

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  if (name === "bestiary") renderBestiary();
  if (name === "game") playBackgroundMusic();
  else stopBackgroundMusic();
}

function setMessage(text) {
  messageLog.textContent = text;
}

function playSound(name, options = {}) {
  const def = SOUND_DEFS[name];
  const base = state.sounds[name];
  if (!def || !base) return;
  const audio = base.cloneNode();
  audio.volume = options.volume ?? def.volume;
  audio.currentTime = options.start ?? 0;
  audio.play().catch(() => {});
  const duration = options.duration ?? def.duration;
  if (duration) {
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, duration * 1000);
  }
}

function playBackgroundMusic() {
  const base = state.sounds.music;
  if (!base) return;
  if (state.musicAudio && state.musicAudio.src === base.src) {
    state.musicAudio.play().catch(() => {});
    return;
  }
  stopBackgroundMusic();
  state.musicAudio = base.cloneNode();
  state.musicAudio.loop = true;
  state.musicAudio.volume = SOUND_DEFS.music.volume;
  state.musicAudio.play().catch(() => {});
}

function stopBackgroundMusic() {
  if (!state.musicAudio) return;
  state.musicAudio.pause();
  state.musicAudio.currentTime = 0;
  state.musicAudio = null;
}

function flashDamaged(entity) {
  if (!entity?.el) return;
  entity.el.classList.remove("damaged");
  void entity.el.offsetWidth;
  entity.el.classList.add("damaged");
  setTimeout(() => entity.el?.classList.remove("damaged"), 130);
}

function alertEnemyGroup(target, source) {
  if (!target?.enemyOwned && target?.type !== "enemy") return;
  if (!source || source.enemyOwned) return;
  const nearby = state.enemies.filter(enemy => enemy.hp > 0 && distance(enemy, target) <= 220);
  nearby.forEach(enemy => {
    enemy.guard = false;
    enemy.attackTarget = source;
    enemy.targetEntity = source;
  });
}

function alertPlayerGroup(target, source) {
  if (!target || target.enemyOwned || target.type === "base" || target.type === "barracks" || target.type === "tower") return;
  if (!source?.enemyOwned && source?.type !== "enemy") return;
  const nearby = [...state.soldiers, ...state.archers, ...state.workers]
    .filter(unit => unit.hp > 0 && distance(unit, target) <= aggroRange(unit) + 70);
  nearby.forEach(unit => {
    unit.attackTarget = source;
    unit.targetEntity = source;
    unit.forceMoveUntil = 0;
  });
}

function applyDamage(target, amount, source) {
  if (!target || target.hp <= 0) return;
  target.hp -= amount;
  flashDamaged(target);
  alertEnemyGroup(target, source);
  alertPlayerGroup(target, source);
}

function spend(amount) {
  if (state.money < amount) {
    setMessage(`Не хватает монет: нужно ${amount}.`);
    return false;
  }
  state.money -= amount;
  updateMoney();
  return true;
}

function updateMoney() {
  moneyValue.textContent = Math.floor(state.money);
}

function applyZoom() {
  camera.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(value) {
  state.zoom = Math.max(0.8, Math.min(1.65, Math.round(value * 100) / 100));
  applyZoom();
}

function renderBestiary() {
  const list = document.getElementById("bestiaryList");
  list.innerHTML = "";
  Object.entries(state.bestiary).forEach(([key, unit]) => {
    const card = document.createElement("article");
    card.className = "unit-card";
    const title = document.createElement("h3");
    title.textContent = unit.name;
    card.append(title);
    Object.entries(unit).forEach(([prop, value]) => {
      if (prop === "name") return;
      const label = document.createElement("label");
      label.textContent = prop;
      const input = document.createElement("input");
      input.type = "number";
      input.value = value;
      input.min = "0";
      input.addEventListener("input", () => {
        state.bestiary[key][prop] = Number(input.value);
        saveBestiary();
      });
      label.append(input);
      card.append(label);
    });
    (UNIT_SOUND_CONTROLS[key] || []).forEach(control => {
      card.append(createSoundControl(control.key, control.label));
    });
    list.append(card);
  });
}

function createSoundControl(soundKey, labelText) {
  const wrap = document.createElement("div");
  wrap.className = "sound-control";
  const title = document.createElement("div");
  title.className = "sound-title";
  title.textContent = labelText;
  const status = document.createElement("div");
  status.className = "sound-status";
  status.textContent = state.soundSettings[soundKey]?.fileName || "Стандартный звук";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/*";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    await saveCustomSound(soundKey, file);
    renderBestiary();
  });
  const actions = document.createElement("div");
  actions.className = "sound-actions";
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "secondary-btn small-btn";
  pick.textContent = "Загрузить";
  pick.addEventListener("click", () => input.click());
  const test = document.createElement("button");
  test.type = "button";
  test.className = "secondary-btn small-btn";
  test.textContent = "Прослушать";
  test.disabled = soundKey === "music" && !state.sounds.music;
  test.addEventListener("click", () => {
    if (soundKey === "music") {
      playBackgroundMusic();
      return;
    }
    playSound(soundKey);
  });
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "secondary-btn small-btn";
  reset.textContent = "Сбросить";
  reset.disabled = !state.soundSettings[soundKey];
  reset.addEventListener("click", async () => {
    await resetCustomSound(soundKey);
    renderBestiary();
  });
  actions.append(pick, test, reset);
  wrap.append(title, status, input, actions);
  return wrap;
}

function worldBounds() {
  return world.getBoundingClientRect();
}

function updateCameraBoundsFor(point) {
  const rect = worldBounds();
  return {
    x: Math.max(40, Math.min(Math.max(rect.width - 40, point.x), point.x)),
    y: Math.max(76, Math.min(Math.max(rect.height - 56, point.y), point.y)),
  };
}

function panTo(point) {
  const rect = worldBounds();
  state.panX = rect.width / 2 - point.x * state.zoom;
  state.panY = rect.height / 2 - point.y * state.zoom;
  applyZoom();
}

function viewToWorld(x, y) {
  const rect = worldBounds();
  return {
    x: rect.width / 2 + (x - rect.width / 2 - state.panX) / state.zoom,
    y: rect.height / 2 + (y - rect.height / 2 - state.panY) / state.zoom,
  };
}

function worldToView(point) {
  const rect = worldBounds();
  return {
    x: rect.width / 2 + (point.x - rect.width / 2) * state.zoom + state.panX,
    y: rect.height / 2 + (point.y - rect.height / 2) * state.zoom + state.panY,
  };
}

function eventToWorld(event) {
  const rect = worldBounds();
  return viewToWorld(event.clientX - rect.left, event.clientY - rect.top);
}

function eventToView(event) {
  const rect = worldBounds();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function clampToWorld(point) {
  return {
    x: Math.max(WORLD_LIMITS.minX, Math.min(WORLD_LIMITS.maxX, point.x)),
    y: Math.max(WORLD_LIMITS.minY, Math.min(WORLD_LIMITS.maxY, point.y)),
  };
}

function clearSelection() {
  state.selected.forEach(entity => entity.el.classList.remove("selected"));
  state.entities.forEach(entity => {
    if (entity.rallyFlag) entity.rallyFlag.classList.add("hidden");
  });
  state.selected = [];
  state.selectedTowerIndex = null;
  state.radialAnchor = null;
  document.querySelectorAll(".tower-on-base").forEach(tower => tower.classList.remove("selected-tower"));
  rangeLayer.innerHTML = "";
}

function selectOne(entity) {
  clearSelection();
  state.selected = [entity];
  entity.el.classList.add("selected");
  if (entity.rallyFlag) entity.rallyFlag.classList.remove("hidden");
  if (entity.type === "soldier" || entity.type === "archer" || entity.type === "worker") showUnitAggroRange(entity);
}

function selectByType(type) {
  const selectableTypes = ["worker", "soldier", "archer", "base", "barracks", "tower"];
  const group = state.entities.filter(entity => entity.type === type && selectableTypes.includes(entity.type) && !entity.enemyOwned);
  if (group.length) {
    selectMany(group);
    if (type === "barracks") openBarracksMenu(group[0]);
    setMessage(`Выделено юнитов типа: ${group.length}.`);
  }
}

function selectMany(entities) {
  clearSelection();
  state.selected = entities;
  state.selected.forEach(entity => entity.el.classList.add("selected"));
  if (entities.length === 1 && entities[0].type === "worker" && !entities[0].enemyOwned) openWorkerMenu(entities[0]);
  if (entities.length === 1 && (entities[0].type === "soldier" || entities[0].type === "archer")) showUnitAggroRange(entities[0]);
}

function showUnitAggroRange(unit) {
  rangeLayer.innerHTML = "";
  const range = aggroRange(unit);
  const circle = document.createElement("div");
  circle.className = "range-circle unit-trigger-range";
  circle.style.left = `${unit.x}px`;
  circle.style.top = `${unit.y}px`;
  circle.style.width = `${range * 2}px`;
  circle.style.height = `${range * 2}px`;
  rangeLayer.append(circle);
}

function selectedWorkers(options = {}) {
  return state.selected.filter(entity => entity.type === "worker" && !entity.enemyOwned && (options.includeBusy || !entity.busy));
}

function selectedMovables() {
  return state.selected.filter(entity => (entity.type === "worker" || entity.type === "soldier" || entity.type === "archer") && !entity.enemyOwned && !entity.busy);
}

function meleeRange(unit) {
  if (unit.type === "archer") return (state.bestiary.archer.range || 170) * 1.5;
  if (unit.type === "worker") return 46;
  return 58;
}

function aggroRange(unit) {
  if (unit.type === "archer") return 240;
  if (unit.type === "soldier") return 185;
  if (unit.type === "worker") return 80;
  return 120;
}

function makeEntity(type, x, y) {
  const el = document.createElement("div");
  el.className = `entity ${type}`;
  const hp = state.bestiary[type]?.hp || 100;
  const entity = {
    id: state.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    target: null,
    targetEntity: null,
    attackTarget: null,
    mining: false,
    busy: false,
    walkPhase: Math.random() * Math.PI * 2,
    barracksLevel: 1,
    el,
    cooldown: 0,
    radius: type === "worker" ? 14 : type === "soldier" || type === "enemy" ? 12 : type === "archer" ? 18 : type === "tower" ? 42 : 46,
  };
  if (type === "enemy" || type === "enemyBase") entity.enemyOwned = true;
  el.dataset.id = String(entity.id);

  if (type === "worker" || type === "soldier" || type === "archer" || type === "enemy" || type === "base" || type === "barracks" || type === "tower" || type === "construction" || type === "enemyBase") {
    const bar = document.createElement("div");
    bar.className = "health-bar";
    bar.innerHTML = '<div class="health-fill"></div>';
    el.append(bar);
    if (type === "base" || type === "barracks" || type === "tower" || type === "construction" || type === "enemyBase") {
      const hpText = document.createElement("div");
      hpText.className = "hp-text";
      el.append(hpText);
    }
  }

  entitiesLayer.append(el);
  state.entities.push(entity);
  if (type === "worker") state.workers.push(entity);
  if (type === "soldier") state.soldiers.push(entity);
  if (type === "archer") state.archers.push(entity);
  if (type === "enemy") state.enemies.push(entity);
  if (type === "barracks") state.barracks.push(entity);
  if (type === "tower") state.towers.push(entity);
  if (type === "enemyBase") state.enemyBase = entity;
  if (type === "worker" || type === "soldier" || type === "archer" || type === "base" || type === "barracks" || type === "tower") {
    el.addEventListener("dblclick", event => {
      event.stopPropagation();
      selectByType(type);
    });
  }
  positionEntity(entity);
  return entity;
}

function makeBase() {
  const base = makeEntity("base", window.innerWidth / 2, window.innerHeight / 2 - 10);
  renderBaseModel(base);
  base.el.addEventListener("click", event => {
    event.stopPropagation();
    const slot = event.target.closest(".tower-slot");
    if (slot && state.buildMode === "towerSlot") {
      chooseTowerSlot(base, Number(slot.dataset.slotIndex || 0));
      return;
    }
    const tower = event.target.closest(".tower-on-base");
    if (tower) {
      clearSelection();
      state.selectedTowerIndex = Number(tower.dataset.towerIndex || 0);
      tower.classList.add("selected-tower");
      showTowerRange(base);
      setMessage("Выбрана башня. Радиус стрельбы показан.");
      return;
    }
    selectOne(base);
    openBaseMenu(base);
  });
  return base;
}

function setRallyPoint(building, point) {
  state.rallyPoints.set(building.id, point);
  building.rallyMine = Boolean(state.mine && distance(point, state.mine) < 100);
  let flag = building.rallyFlag;
  if (!flag) {
    flag = document.createElement("div");
    flag.className = "rally-flag hidden";
    effectsLayer.append(flag);
    building.rallyFlag = flag;
  }
  flag.style.left = `${point.x}px`;
  flag.style.top = `${point.y}px`;
  flag.classList.toggle("hidden", !state.selected.includes(building));
  setMessage(`Пункт сбора установлен для здания.`);
}

function setRallyPointForBuildings(buildings, point) {
  buildings.forEach(building => setRallyPoint(building, point));
  setMessage(`Пункт сбора назначен для зданий: ${buildings.length}.`);
}

function sendToRally(unit, building) {
  const point = state.rallyPoints.get(building.id);
  if (building.rallyMine && unit.type === "worker") {
    assignWorkersToMine([unit]);
    return;
  }
  if (point) {
    const angle = (unit.id % 8) * (Math.PI / 4);
    unit.target = {
      x: point.x + Math.cos(angle) * 18,
      y: point.y + Math.sin(angle) * 18,
    };
  }
}

function renderBaseModel(base) {
  const health = base.el.querySelector(".health-bar")?.outerHTML || "";
  const hpText = base.el.querySelector(".hp-text")?.outerHTML || '<div class="hp-text"></div>';
  base.el.innerHTML = `${health}${hpText}<div class="chimney"></div><div class="door"></div>`;
  base.el.classList.toggle("level-2", state.baseLevel === 2);
  base.el.classList.toggle("slot-selecting", state.buildMode === "towerSlot");
  for (let i = 0; i < state.baseTowers.length; i += 1) {
    const slot = document.createElement("div");
    slot.className = `tower-slot slot-pos-${i} ${state.baseTowers[i] ? "occupied" : ""}`;
    slot.dataset.slotIndex = String(i);
    base.el.append(slot);
  }
  state.baseTowers.forEach((built, i) => {
    if (!built) return;
    const tower = document.createElement("div");
    tower.className = `tower-on-base tower-pos-${i}`;
    tower.dataset.towerIndex = String(i);
    tower.addEventListener("click", event => {
      event.stopPropagation();
      clearSelection();
      state.selectedTowerIndex = i;
      tower.classList.add("selected-tower");
      showTowerRange(base);
      setMessage("Выбрана башня. Радиус стрельбы показан.");
    });
    base.el.append(tower);
  });
  state.baseTowerCount = state.baseTowers.filter(Boolean).length;
  positionEntity(base);
}

function showTowerRange(base) {
  rangeLayer.innerHTML = "";
  const range = state.bestiary.tower.range;
  const circle = document.createElement("div");
  circle.className = "range-circle";
  const point = typeof state.selectedTowerIndex === "number" && base.type === "base"
    ? getBaseTowerPoint(base, state.selectedTowerIndex)
    : { x: base.x, y: base.y };
  circle.style.left = `${point.x}px`;
  circle.style.top = `${point.y}px`;
  circle.style.width = `${range * 2}px`;
  circle.style.height = `${range * 2}px`;
  rangeLayer.append(circle);
}

function getBaseTowerPoint(base, index) {
  const offsets = state.baseLevel === 2
    ? [{ x: -86, y: -26 }, { x: 86, y: -24 }, { x: 0, y: -56 }, { x: 44, y: 16 }]
    : [{ x: -74, y: -18 }, { x: 74, y: -16 }, { x: 0, y: -48 }, { x: 38, y: 20 }];
  const offset = offsets[index] || { x: 0, y: 0 };
  return { x: base.x + offset.x, y: base.y + offset.y };
}

function getBaseTowerMuzzlePoint(base, index) {
  const point = getBaseTowerPoint(base, index);
  return { x: point.x, y: point.y - 22 };
}

function getEnemyBaseTowerPoint(enemyBase, index) {
  const offsets = [{ x: -54, y: -28 }, { x: 58, y: -26 }, { x: 0, y: -54 }];
  const offset = offsets[index] || offsets[0];
  return { x: enemyBase.x + offset.x, y: enemyBase.y + offset.y };
}

function makeMine(x, y) {
  const mine = makeEntity("mine", x, y);
  state.mine = mine;
  mine.assignedWorkers = [];
  mine.el.dataset.workers = "0";
  mine.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(mine);
    setMessage("Рудник выбран. Выдели рабочих и нажми правой кнопкой по руднику, чтобы отправить их добывать.");
  });
  return mine;
}

function makeEnemyMine(x, y) {
  const mine = makeEntity("mine", x, y);
  mine.el.classList.add("enemy-mine");
  mine.assignedWorkers = [];
  mine.el.dataset.workers = "3";
  const economy = document.createElement("div");
  economy.className = "enemy-economy";
  economy.textContent = "0";
  mine.el.append(economy);
  mine.goldTotalEl = economy;
  state.enemyMine = mine;
  return mine;
}

function spawnEnemyWorker(mine, index) {
  const worker = makeEntity("worker", mine.x - 34 + index * 34, mine.y + 60);
  state.workers = state.workers.filter(item => item !== worker);
  worker.el.classList.add("enemy-worker", "mining");
  worker.enemyOwned = true;
  worker.mining = true;
  worker.targetEntity = mine;
  worker.target = { x: mine.x - 34 + index * 34, y: mine.y + 60 };
  state.enemyWorkers.push(worker);
  return worker;
}

function makeBarracks(x, y) {
  const barracks = makeEntity("barracks", x, y);
  renderBarracksModel(barracks);
  barracks.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(barracks);
    openBarracksMenu(barracks);
  });
  return barracks;
}

function makeEnemyBarracks(x, y) {
  const barracks = makeEntity("barracks", x, y);
  barracks.el.classList.add("enemy-barracks");
  barracks.enemyOwned = true;
  renderBarracksModel(barracks);
  state.enemyBarracks = barracks;
  return barracks;
}

function renderBarracksModel(barracks) {
  barracks.el.classList.toggle("level-2", barracks.barracksLevel >= 2);
  positionEntity(barracks);
}

function makeEnemyBase(x, y) {
  const enemyBase = makeEntity("enemyBase", x, y);
  enemyBase.enemyOwned = true;
  renderEnemyBaseModel(enemyBase);
  enemyBase.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(enemyBase);
    setMessage("Вражеское здание. Уничтожь его, чтобы выиграть первый уровень.");
  });
  return enemyBase;
}

function renderEnemyBaseModel(enemyBase) {
  enemyBase.enemyTowerCount = state.level >= 3 ? 3 : 1;
  for (let i = 0; i < enemyBase.enemyTowerCount; i += 1) {
    const tower = document.createElement("div");
    tower.className = `enemy-base-tower enemy-base-tower-${i}`;
    enemyBase.el.append(tower);
  }
  enemyBase.enemyTowerCooldowns = Array.from({ length: enemyBase.enemyTowerCount }, (_, i) => enemyBase.enemyTowerCooldowns?.[i] || 0);
}

function makeTower(x, y) {
  const tower = makeEntity("tower", x, y);
  tower.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(tower);
    showTowerRange(tower);
    setMessage("Выбрана большая башня. Радиус стрельбы показан.");
  });
  return tower;
}

function spawnWorker() {
  const base = state.entities.find(entity => entity.type === "base");
  const worker = makeEntity("worker", base.x + 104, base.y + 42);
  worker.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(worker);
    openWorkerMenu(worker);
  });
  sendToRally(worker, base);
  setMessage("Рабочий готов. Правый клик отправляет его, правый клик по врагу приказывает атаковать.");
}

function spawnSoldier(barracks) {
  const soldier = makeEntity("soldier", barracks.x + 86, barracks.y + 18);
  soldier.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(soldier);
    closeRadial();
    setMessage("Воин выбран. Правый клик по земле отправит его к точке.");
  });
  sendToRally(soldier, barracks);
  setMessage("Воин вышел из казармы.");
}

function spawnArcher(barracks) {
  const archer = makeEntity("archer", barracks.x + 92, barracks.y - 18);
  archer.el.addEventListener("click", event => {
    event.stopPropagation();
    selectOne(archer);
    closeRadial();
    setMessage("Лучник выбран. Правый клик по врагу прикажет стрелять.");
  });
  sendToRally(archer, barracks);
  setMessage("Лучник вышел из улучшенной казармы.");
}

function spawnEnemies() {
  if (state.waveStarted) return;
  state.waveStarted = true;
  setMessage("На базу напали 5 воинов.");
  const rect = worldBounds();
  for (let i = 0; i < 5; i += 1) {
    const enemy = makeEntity("enemy", rect.width + 70 + i * 32, rect.height * 0.28 + i * 54);
    enemy.targetEntity = state.entities.find(entity => entity.type === "base");
  }
}

function spawnEnemyFromBase() {
  if (!state.enemyBase) return;
  const count = state.level >= 3 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const enemy = makeEntity("enemy", state.enemyBase.x - 96 - i * 34, state.enemyBase.y + 72 + i * 26);
    enemy.targetEntity = state.entities.find(entity => entity.type === "base");
  }
  setMessage(`Вражеское здание отправило воинов: ${count}.`);
}

function spawnEnemyFromBarracks() {
  if (!state.enemyBarracks) return;
  const enemy = makeEntity("enemy", state.enemyBarracks.x - 84, state.enemyBarracks.y + 38);
  enemy.targetEntity = state.entities.find(entity => entity.type === "base");
}

function spawnLevelGuards(enemyBase) {
  if (state.level < 2) return;
  for (let i = 0; i < 5; i += 1) {
    const enemy = makeEntity("enemy", enemyBase.x - 130 + i * 42, enemyBase.y + 120);
    enemy.guard = true;
    enemy.targetEntity = null;
  }
  for (let i = 0; i < 3; i += 1) {
    const archer = makeEntity("enemy", enemyBase.x - 80 + i * 62, enemyBase.y + 172);
    archer.el.classList.add("enemy-archer");
    archer.enemyArcher = true;
    archer.guard = true;
    archer.targetEntity = null;
  }
}

function startJob(owner, duration, onDone) {
  const progress = document.createElement("div");
  progress.className = "progress-wrap";
  progress.innerHTML = '<div class="progress-fill"></div><div class="progress-label">0%</div>';
  owner.el.append(progress);
  state.jobs.push({ owner, duration, elapsed: 0, progress, onDone });
}

function startQueuedProduction(owner, duration, onDone, kind = "unit") {
  if (!owner.productionQueue) owner.productionQueue = [];
  owner.productionQueue.push({ duration, elapsed: 0, onDone, kind });
  updateQueueBadge(owner);
  if (!owner.activeProduction) startNextProduction(owner);
}

function startNextProduction(owner) {
  if (!owner.productionQueue?.length) {
    owner.activeProduction = null;
    updateQueueBadge(owner);
    return;
  }
  const job = owner.productionQueue[0];
  const progress = document.createElement("div");
  progress.className = "progress-wrap";
  progress.innerHTML = '<div class="progress-fill"></div><div class="progress-label">0%</div>';
  owner.el.append(progress);
  owner.activeProduction = { ...job, progress };
  updateQueueBadge(owner);
}

function updateQueueBadge(owner) {
  owner.queueBadges?.forEach(badge => badge.remove());
  owner.queueBadges = [];
  const queue = owner.productionQueue || [];
  if (!queue.length) {
    owner.queueBadge = null;
    return;
  }
  queue.forEach((job, index) => {
    const badge = document.createElement("div");
    badge.className = `queue-badge queue-${job.kind || "unit"}`;
    badge.style.left = `calc(50% + ${(index - (queue.length - 1) / 2) * 34}px)`;
    badge.textContent = job.kind === "worker" ? "●" : job.kind === "tower" ? "♜" : job.kind === "archer" ? "⌒" : "⚔";
    owner.el.append(badge);
    owner.queueBadges.push(badge);
  });
  owner.queueBadge = owner.queueBadges[0] || null;
}

function updateProduction(dt) {
  state.entities.forEach(owner => {
    const job = owner.activeProduction;
    if (!job) return;
    job.elapsed += dt;
    const pct = Math.min(100, (job.elapsed / job.duration) * 100);
    const fill = job.progress.querySelector(".progress-fill");
    if (fill) fill.style.width = `${pct}%`;
    const label = job.progress.querySelector(".progress-label");
    if (label) label.textContent = `${Math.ceil(job.duration - job.elapsed)}с`;
    if (job.elapsed < job.duration) return;
    job.progress.remove();
    owner.productionQueue.shift();
    job.onDone();
    if (job.kind === "tower" || job.kind === "upgrade") playSound("build");
    owner.activeProduction = null;
    startNextProduction(owner);
  });
}

function assignWorkersToMine(workers) {
  const mine = state.mine;
  workers.forEach(worker => {
    worker.mining = true;
    worker.attackTarget = null;
    worker.targetEntity = mine;
    worker.el.classList.add("mining");
    if (!mine.assignedWorkers.includes(worker)) mine.assignedWorkers.push(worker);
  });
  layoutMiners();
  mine.el.dataset.workers = String(mine.assignedWorkers.length);
  setMessage(`На руднике рабочих: ${mine.assignedWorkers.length}. Доход: +${mine.assignedWorkers.length * state.bestiary.mine.income} в секунду.`);
}

function removeWorkerFromMine(worker) {
  if (!state.mine) return;
  state.mine.assignedWorkers = state.mine.assignedWorkers.filter(item => item !== worker);
  state.mine.el.dataset.workers = String(state.mine.assignedWorkers.length);
  worker.mining = false;
  worker.el.classList.remove("mining");
  worker.targetEntity = null;
  worker.target = null;
  layoutMiners();
}

function layoutMiners() {
  if (!state.mine) return;
  const miners = state.mine.assignedWorkers;
  miners.forEach((worker, index) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(miners.length)));
    const col = index % cols;
    const row = Math.floor(index / cols);
    worker.target = {
      x: state.mine.x - 42 + col * 28,
      y: state.mine.y + 48 + row * 24,
    };
  });
}

function closeRadial() {
  radialMenu.classList.add("hidden");
  radialMenu.innerHTML = "";
  state.radialButtons = [];
  state.radialAnchor = null;
}

function makeRadialOption(label, className, x, y, disabled, handler) {
  const button = document.createElement("button");
  const offset = state.radialAnchor ? { x: x - state.radialAnchor.entity.x, y: y - state.radialAnchor.entity.y } : { x: 0, y: 0 };
  const disabledGetter = typeof disabled === "function" ? disabled : () => Boolean(disabled);
  button.className = `radial-option ${className}${disabledGetter() ? " disabled" : ""}`;
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
  button.innerHTML = label;
  button.disabled = disabledGetter();
  button.classList.toggle("disabled", button.disabled);
  button.addEventListener("click", event => {
    event.stopPropagation();
    if (className === "soldier-action" && state.radialAnchor?.entity?.type === "barracks" && button.textContent.includes("100")) {
      if (!disabledGetter()) orderSoldiersFromSelectedBarracks(state.radialAnchor.entity);
      return;
    }
    if (!disabledGetter()) handler();
  });
  radialMenu.append(button);
  state.radialButtons.push({ button, disabledGetter, offset });
}

function updateRadialButtons() {
  state.radialButtons = state.radialButtons.filter(entry => document.body.contains(entry.button));
  state.radialButtons.forEach(({ button, disabledGetter, offset }) => {
    button.disabled = disabledGetter();
    button.classList.toggle("disabled", button.disabled);
    if (state.radialAnchor?.entity) {
      button.style.left = `${state.radialAnchor.entity.x + offset.x}px`;
      button.style.top = `${state.radialAnchor.entity.y + offset.y}px`;
    }
  });
}

function openBaseMenu(base) {
  closeBuildMode();
  closeRadial();
  radialMenu.classList.remove("hidden");
  state.radialAnchor = { entity: base };
  makeRadialOption(`Рабочий<br>${state.bestiary.worker.cost}`, "worker-action", base.x - 112, base.y - 118, () => state.money < state.bestiary.worker.cost, () => {
    if (!spend(state.bestiary.worker.cost)) return;
    startQueuedProduction(base, 5, spawnWorker, "worker");
    setMessage("Рабочий производится: 5 секунд.");
  });
  makeRadialOption("Грейд<br>200", "upgrade-action", base.x, base.y - 142, () => state.money < 200 || state.baseLevel > 1, () => {
    if (!spend(200)) return;
    startQueuedProduction(base, 8, () => {
      state.baseLevel = 2;
      if (state.baseTowers.length < 4) state.baseTowers.push(false);
      renderBaseModel(base);
      setMessage("Главное здание стало крупнее и сложнее.");
    }, "upgrade");
    setMessage("Улучшение главного здания: 8 секунд.");
  });
  makeRadialOption(`Башня<br>${state.bestiary.tower.cost}`, "tower-action", base.x + 112, base.y - 118, () => state.money < state.bestiary.tower.cost || state.baseTowers.every(Boolean), () => {
    closeRadial();
    state.buildMode = "towerSlot";
    renderBaseModel(base);
    setMessage("Выбери подсвеченный слот на главном здании для башни.");
  });
}

function chooseTowerSlot(base, slotIndex) {
  if (state.baseTowers[slotIndex]) {
    setMessage("Этот слот уже занят башней.");
    return;
  }
  if (!spend(state.bestiary.tower.cost)) return;
  state.buildMode = null;
  renderBaseModel(base);
  startQueuedProduction(base, 6, () => {
    state.baseTowers[slotIndex] = true;
    renderBaseModel(base);
    setMessage("Башня добавлена в выбранный слот.");
  }, "tower");
  setMessage("Башня строится в выбранном слоте: 6 секунд.");
}

function openWorkerMenu(worker) {
  closeBuildMode();
  closeRadial();
  radialMenu.classList.remove("hidden");
  state.radialAnchor = { entity: worker };
  makeRadialOption("Казарма<br>150", "barracks-action", worker.x - 54, worker.y - 84, () => state.money < state.bestiary.barracks.cost || (worker.busy && !worker.mining), () => startBuildMode("barracks"));
  makeRadialOption("Башня<br>75", "tower-action", worker.x + 54, worker.y - 84, () => state.money < state.bestiary.tower.cost || (worker.busy && !worker.mining), () => startBuildMode("tower"));
}

function openBarracksMenu(barracks) {
  closeBuildMode();
  closeRadial();
  radialMenu.classList.remove("hidden");
  state.radialAnchor = { entity: barracks };
  makeRadialOption("Воин<br>100", "soldier-action", barracks.x, barracks.y - 104, () => state.money < state.bestiary.soldier.cost, () => {
    if (!spend(state.bestiary.soldier.cost)) return;
    startQueuedProduction(barracks, 7, () => spawnSoldier(barracks), "soldier");
    setMessage("Воин тренируется: 7 секунд.");
  });
  makeRadialOption("Грейд<br>250", "upgrade-action", barracks.x - 76, barracks.y - 86, () => state.money < 250 || barracks.barracksLevel > 1, () => {
    if (!spend(250)) return;
    startQueuedProduction(barracks, 10, () => {
      barracks.barracksLevel = 2;
      renderBarracksModel(barracks);
      setMessage("Казарма улучшена. Открыт лучник.");
    }, "upgrade");
    setMessage("Казарма улучшается: 10 секунд.");
  });
  if (barracks.barracksLevel >= 2) {
    makeRadialOption("Лучник<br>140", "soldier-action", barracks.x + 76, barracks.y - 86, () => state.money < state.bestiary.archer.cost, () => {
      if (!spend(state.bestiary.archer.cost)) return;
      startQueuedProduction(barracks, 8, () => spawnArcher(barracks), "archer");
      setMessage("Лучник тренируется: 8 секунд.");
    });
  }
}

function orderSoldiersFromSelectedBarracks(fallbackBarracks) {
  const barracksGroup = state.selected.filter(entity => entity.type === "barracks");
  const targets = barracksGroup.length ? barracksGroup : [fallbackBarracks];
  let ordered = 0;
  targets.forEach(target => {
    if (state.money < state.bestiary.soldier.cost) return;
    if (!spend(state.bestiary.soldier.cost)) return;
    startQueuedProduction(target, 7, () => spawnSoldier(target), "soldier");
    ordered += 1;
  });
  if (ordered) setMessage(`Воины тренируются в казармах: ${ordered}.`);
}

function startBuildMode(type) {
  const worker = selectedWorkers({ includeBusy: true }).find(item => !item.busy || item.mining);
  if (!worker) {
    setMessage("Нужен свободный рабочий для строительства.");
    return;
  }
  state.buildWorker = worker;
  closeRadial();
  state.buildMode = type;
  ghost.className = `building-ghost ${type}`;
  ghost.classList.remove("hidden");
  setMessage(type === "tower" ? "Выбери место для большой башни." : "Выбери место для казармы.");
}

function closeBuildMode() {
  state.buildMode = null;
  ghost.classList.add("hidden");
}

function placeBuilding(point) {
  if (state.buildMode !== "barracks" && state.buildMode !== "tower") return;
  const buildType = state.buildMode;
  const cost = buildType === "tower" ? state.bestiary.tower.cost : state.bestiary.barracks.cost;
  if (!spend(cost)) return;
  const pos = clampToWorld(point);
  const builder = state.buildWorker;
  if (builder) {
    removeWorkerFromMine(builder);
    builder.mining = false;
    builder.repairTarget = null;
    builder.attackTarget = null;
    builder.targetEntity = null;
    builder.busy = true;
    builder.el.classList.add("busy");
    builder.target = { x: pos.x, y: pos.y + 58 };
  }
  const construction = makeEntity("construction", pos.x, pos.y);
  playSound("build");
  construction.buildType = buildType;
  construction.waitingBuilder = builder || null;
  construction.pendingJob = {
    duration: buildType === "tower" ? 7 : 8,
    started: false,
    onDone: () => {
      construction.el.remove();
      state.entities = state.entities.filter(entity => entity !== construction);
      if (buildType === "tower") makeTower(pos.x, pos.y);
      else makeBarracks(pos.x, pos.y);
      if (builder) {
        builder.busy = false;
        builder.el.classList.remove("busy");
        builder.target = null;
      }
      playSound("build");
      setMessage(buildType === "tower" ? "Большая башня построена." : "Казарма построена. В ней можно заказать воина за 100.");
    },
  };
  if (!builder) startJob(construction, construction.pendingJob.duration, construction.pendingJob.onDone);
  state.buildWorker = null;
  closeBuildMode();
  setMessage(buildType === "tower" ? "Башня строится: 7 секунд." : "Казарма строится: 8 секунд.");
}

function positionEntity(entity) {
  entity.el.style.left = `${entity.x}px`;
  entity.el.style.top = `${entity.y}px`;
  const unitLift = entity.type === "worker" || entity.type === "soldier" || entity.type === "archer" || entity.type === "enemy" ? 4000 : 1000;
  entity.el.style.zIndex = String(unitLift + Math.round(entity.y));
  const fill = entity.el.querySelector(".health-fill");
  if (fill) fill.style.width = `${Math.max(0, entity.hp / entity.maxHp) * 100}%`;
  const hpText = entity.el.querySelector(".hp-text");
  if (hpText) hpText.textContent = `${Math.max(0, Math.ceil(entity.hp))}/${entity.maxHp}`;
  if (entity.el.classList.contains("selected")) updateRadialButtons();
  if (entity.el.classList.contains("selected") && (entity.type === "soldier" || entity.type === "archer" || entity.type === "worker")) {
    const circle = rangeLayer.querySelector(".unit-trigger-range");
    if (circle) {
      circle.style.left = `${entity.x}px`;
      circle.style.top = `${entity.y}px`;
    }
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updateMovement(entity, dt) {
  if (!entity.target) return;
  const speed = state.bestiary[entity.type].speed || 40;
  const dx = entity.target.x - entity.x;
  const dy = entity.target.y - entity.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) {
    if (!entity.mining) entity.target = null;
    return;
  }
  const step = Math.min(d, speed * dt);
  entity.x += (dx / d) * step;
  entity.y += (dy / d) * step;
  if (entity.type === "worker" || entity.type === "soldier" || entity.type === "archer" || entity.type === "enemy") {
    entity.walkPhase += dt * 14;
    entity.el.style.setProperty("--bob", `${Math.sin(entity.walkPhase) * 4}px`);
  }
}

function updateCombat(dt) {
  const base = state.entities.find(entity => entity.type === "base");
  if (base) {
    if (!base.towerCooldowns) base.towerCooldowns = [];
    state.baseTowers.forEach((built, index) => {
      if (!built) return;
      base.towerCooldowns[index] = (base.towerCooldowns[index] || 0) - dt;
      if (base.towerCooldowns[index] > 0) return;
      const rangeCenter = getBaseTowerPoint(base, index);
      const muzzle = getBaseTowerMuzzlePoint(base, index);
      const target = [...state.enemies, ...state.enemyWorkers]
        .find(enemy => enemy.hp > 0 && distance(rangeCenter, enemy) <= state.bestiary.tower.range);
      if (!target) return;
      applyDamage(target, state.bestiary.tower.damage, base);
      spawnArrow({ x: muzzle.x, y: muzzle.y, type: "towerShot" }, target, { tower: true });
      base.towerCooldowns[index] = 0.75;
    });
  }

  state.towers.forEach(source => {
    source.cooldown -= dt;
    if (source.cooldown > 0) return;
    const muzzle = { x: source.x, y: source.y - 58 };
    const target = [...state.enemies, ...state.enemyWorkers]
      .find(enemy => enemy.hp > 0 && distance(source, enemy) <= state.bestiary.tower.range);
    if (!target) return;
    applyDamage(target, state.bestiary.tower.damage, source);
    spawnArrow({ x: muzzle.x, y: muzzle.y, type: "towerShot" }, target, { tower: true });
    source.cooldown = 0.75;
  });

  if (state.enemyBase) {
    if (!state.enemyBase.enemyTowerCooldowns) state.enemyBase.enemyTowerCooldowns = [];
    const towerCount = state.enemyBase.enemyTowerCount || (state.level >= 3 ? 3 : 1);
    for (let index = 0; index < towerCount; index += 1) {
      state.enemyBase.enemyTowerCooldowns[index] = (state.enemyBase.enemyTowerCooldowns[index] || 0) - dt;
      if (state.enemyBase.enemyTowerCooldowns[index] > 0) continue;
      const rangeCenter = getEnemyBaseTowerPoint(state.enemyBase, index);
      const muzzle = { x: rangeCenter.x, y: rangeCenter.y - 22 };
      const target = [...state.soldiers, ...state.archers, ...state.workers]
        .find(unit => unit.hp > 0 && distance(rangeCenter, unit) <= state.bestiary.tower.range);
      if (!target) continue;
      applyDamage(target, state.bestiary.tower.damage, state.enemyBase);
      spawnArrow({ x: muzzle.x, y: muzzle.y, type: "towerShot", enemyOwned: true }, target, { tower: true });
      state.enemyBase.enemyTowerCooldowns[index] = 0.85;
    }
  }

  [...state.soldiers, ...state.workers, ...state.archers].forEach(unit => {
    unit.cooldown -= dt;
    const damage = state.bestiary[unit.type].damage || 0;
    if (!damage) return;
    const enemiesAndBuildings = [...state.enemies, ...state.enemyWorkers, state.enemyBase, state.enemyBarracks].filter(Boolean);
    if (unit.forceMoveUntil && performance.now() > unit.forceMoveUntil) unit.forceMoveUntil = 0;
    if (unit.attackTarget && (!enemiesAndBuildings.includes(unit.attackTarget) || unit.attackTarget.hp <= 0)) {
      unit.attackTarget = null;
      unit.targetEntity = null;
    }
    const attackRange = meleeRange(unit);
    const explicitTarget = unit.attackTarget && enemiesAndBuildings.includes(unit.attackTarget)
      ? unit.attackTarget
      : null;
    const autoTarget = explicitTarget || unit.forceMoveUntil
      ? null
      : enemiesAndBuildings.find(enemy => enemy.hp > 0 && distance(unit, enemy) <= aggroRange(unit));
    const target = explicitTarget || autoTarget;
    if (autoTarget) {
      unit.attackTarget = autoTarget;
      unit.targetEntity = autoTarget;
    }
    const targetIsBuilding = target?.type === "enemyBase" || target?.type === "barracks";
    const effectiveRange = targetIsBuilding ? Math.max(attackRange, 96) : attackRange;
    if (target && distance(unit, target) > effectiveRange - 6) {
      const angle = Math.atan2(unit.y - target.y, unit.x - target.x) || 0;
      const approach = targetIsBuilding ? 76 : attackRange - 8;
      unit.target = {
        x: target.x + Math.cos(angle) * approach,
        y: target.y + Math.sin(angle) * approach,
      };
    }
    if (target && distance(unit, target) <= effectiveRange && unit.cooldown <= 0) {
      unit.target = null;
      applyDamage(target, damage, unit);
      if (unit.type === "archer") {
        unit.el.classList.remove("shooting");
        void unit.el.offsetWidth;
        unit.el.classList.add("shooting");
        spawnArrow(unit, target);
      }
      else {
        unit.el.classList.remove("attacking");
        void unit.el.offsetWidth;
        unit.el.classList.add("attacking");
        playSound("melee");
        spawnHit(target.x, target.y);
      }
      unit.cooldown = unit.type === "worker" ? 1.1 : unit.type === "archer" ? 1.0 : 0.8;
    }
  });

  state.enemies.forEach(enemy => {
    const nearbyUnit = [...state.soldiers, ...state.workers, ...state.archers]
      .find(unit => unit.hp > 0 && distance(enemy, unit) <= 155);
    if (nearbyUnit) enemy.targetEntity = nearbyUnit;
    if (enemy.guard && !nearbyUnit && !enemy.attackTarget) {
      enemy.target = null;
      return;
    }
    if (!enemy.targetEntity || enemy.targetEntity.hp <= 0) enemy.targetEntity = base;
    if (!enemy.targetEntity) return;
    const angle = Math.atan2(enemy.y - enemy.targetEntity.y, enemy.x - enemy.targetEntity.x);
    const targetIsUnit = enemy.targetEntity.type === "worker" || enemy.targetEntity.type === "soldier" || enemy.targetEntity.type === "archer";
    const surroundRadius = targetIsUnit ? 34 : 78 + (enemy.id % 5) * 8;
    enemy.target = {
      x: enemy.targetEntity.x + Math.cos(angle || Math.PI / 2) * surroundRadius,
      y: enemy.targetEntity.y + (targetIsUnit ? Math.sin(angle || Math.PI / 2) * surroundRadius : Math.abs(Math.sin(angle || Math.PI / 2)) * surroundRadius + 18),
    };
    const enemyRange = enemy.enemyArcher ? 170 : targetIsUnit ? 50 : 10;
    if (distance(enemy, enemy.targetEntity) <= enemyRange || distance(enemy, enemy.target) < 10) {
      enemy.target = null;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        applyDamage(enemy.targetEntity, state.bestiary.enemy.damage, enemy);
        if (targetIsUnit) {
          enemy.targetEntity.attackTarget = enemy;
          enemy.targetEntity.targetEntity = enemy;
          enemy.targetEntity.forceMoveUntil = 0;
        }
        if (enemy.enemyArcher) spawnArrow(enemy, enemy.targetEntity);
        else {
          enemy.el.classList.remove("attacking");
          void enemy.el.offsetWidth;
          enemy.el.classList.add("attacking");
          playSound("melee", { volume: 0.42 });
          spawnMeleeHit(enemy.targetEntity.x + (targetIsUnit ? 0 : (enemy.id % 5 - 2) * 18), enemy.targetEntity.y + (targetIsUnit ? 2 : 54));
        }
        enemy.cooldown = enemy.enemyArcher ? 1.4 : 1.2;
        if (enemy.targetEntity.type === "base" && enemy.targetEntity.hp <= 0) {
          if (!enemy.targetEntity.breakSoundPlayed) {
            enemy.targetEntity.breakSoundPlayed = true;
            playSound("buildingBreak");
          }
          setMessage("Кубик разрушен. Нужно больше воинов и башен.");
        }
      }
    }
  });
}

function updateJobs(dt) {
  state.jobs.slice().forEach(job => {
    job.elapsed += dt;
    const pct = Math.min(100, (job.elapsed / job.duration) * 100);
    const fill = job.progress.querySelector(".progress-fill");
    if (fill) fill.style.width = `${pct}%`;
    const label = job.progress.querySelector(".progress-label");
    if (label) label.textContent = `${Math.ceil(job.duration - job.elapsed)}с`;
    if (job.elapsed >= job.duration) {
      job.progress.remove();
      state.jobs = state.jobs.filter(item => item !== job);
      job.onDone();
    }
  });
}

function updateConstructionStarts() {
  state.entities.forEach(entity => {
    if (entity.type !== "construction" || !entity.pendingJob || entity.pendingJob.started) return;
    const builder = entity.waitingBuilder;
    if (builder && distance(builder, { x: entity.x, y: entity.y + 58 }) > 12) return;
    entity.pendingJob.started = true;
    startJob(entity, entity.pendingJob.duration, entity.pendingJob.onDone);
    setMessage("Рабочий приступил к строительству.");
  });
}

function updateRepairs(dt) {
  state.workers.forEach(worker => {
    if (!worker.repairTarget) return;
    const target = worker.repairTarget;
    if (target.hp >= target.maxHp) {
      worker.repairTarget = null;
      worker.busy = false;
      worker.el.classList.remove("busy");
      return;
    }
    if (distance(worker, target) > 92) return;
    target.hp = Math.min(target.maxHp, target.hp + 16 * dt);
    if (Math.random() < 0.12) spawnRepairSpark(worker.x, worker.y - 8);
  });
}

function applySeparation() {
  const units = [...state.workers, ...state.soldiers, ...state.archers, ...state.enemies, ...state.enemyWorkers];
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const a = units[i];
      const b = units[j];
      const min = a.radius + b.radius;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      if (d >= min) continue;
      const push = (min - d) * 0.5;
      const fallbackAngle = ((a.id * 37 + b.id * 17) % 360) * Math.PI / 180;
      const nx = Math.abs(dx) + Math.abs(dy) < 0.01 ? Math.cos(fallbackAngle) : dx / d;
      const ny = Math.abs(dx) + Math.abs(dy) < 0.01 ? Math.sin(fallbackAngle) : dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

function removeDead() {
  state.enemyWorkers.filter(worker => worker.hp <= 0).forEach(worker => {
    playSound("death");
    worker.el.remove();
    state.entities = state.entities.filter(entity => entity !== worker);
    state.enemyWorkers = state.enemyWorkers.filter(entity => entity !== worker);
    if (state.enemyMine) state.enemyMine.el.dataset.workers = String(state.enemyWorkers.length);
    state.money += 5;
    updateMoney();
  });
  [...state.workers, ...state.soldiers, ...state.archers].filter(unit => unit.hp <= 0).forEach(unit => {
    playSound("death");
    unit.el.remove();
    state.entities = state.entities.filter(entity => entity !== unit);
    state.workers = state.workers.filter(entity => entity !== unit);
    state.soldiers = state.soldiers.filter(entity => entity !== unit);
    state.archers = state.archers.filter(entity => entity !== unit);
    state.selected = state.selected.filter(entity => entity !== unit);
    state.enemies.forEach(enemy => {
      if (enemy.targetEntity === unit) enemy.targetEntity = null;
    });
  });
  state.enemies.filter(enemy => enemy.hp <= 0).forEach(enemy => {
    playSound("death");
    enemy.el.remove();
    state.entities = state.entities.filter(entity => entity !== enemy);
    state.enemies = state.enemies.filter(item => item !== enemy);
    state.money += 10;
    updateMoney();
    if (state.enemies.length === 0 && state.waveStarted) {
      state.firstWaveCleared = true;
      state.enemySpawnTimer = 10;
      setMessage("Первая волна отбита. Вражеское здание начнет посылать подкрепления.");
    }
  });
  if (state.enemyBarracks && state.enemyBarracks.hp <= 0) {
    playSound("buildingBreak");
    state.enemyBarracks.el.remove();
    state.entities = state.entities.filter(entity => entity !== state.enemyBarracks);
    state.barracks = state.barracks.filter(entity => entity !== state.enemyBarracks);
    state.selected = state.selected.filter(entity => entity !== state.enemyBarracks);
    state.enemyBarracks = null;
    setMessage("Вражеская казарма разрушена.");
  }
  if (state.enemyBase && state.enemyBase.hp <= 0) {
    playSound("buildingBreak");
    state.enemyBase.el.remove();
    state.entities = state.entities.filter(entity => entity !== state.enemyBase);
    state.enemyBase = null;
    showVictoryAndStartNextLevel();
    waveTimer.textContent = "Победа";
  }
}

function showVictoryAndStartNextLevel() {
  if (state.victoryPending) return;
  state.victoryPending = true;
  showVictoryMenu();
  setMessage(`Победа! Уровень ${state.level} пройден. Загружается следующий уровень...`);
  setTimeout(() => {
    document.querySelector(".victory-menu")?.remove();
    state.level += 1;
    resetGame();
    setMessage(`Уровень ${state.level}. У вражеского замка появилась охрана.`);
  }, 1800);
}

function showVictoryMenu() {
  document.querySelector(".victory-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "victory-menu";
  menu.innerHTML = `<strong>Победа</strong><span>Уровень ${state.level} пройден</span><small>Следующий уровень запускается...</small>`;
  world.append(menu);
}

function spawnEffect(className, x, y) {
  const effect = document.createElement("div");
  effect.className = className;
  effect.style.left = `${x}px`;
  effect.style.top = `${y}px`;
  effectsLayer.append(effect);
  setTimeout(() => effect.remove(), 800);
}

function spawnMineSpark() {
  if (!state.mine) return;
  if (state.mine.assignedWorkers.length) playSound("pickaxe", { duration: 0.28, volume: 0.42 });
  state.mine.assignedWorkers.forEach((worker, index) => {
    setTimeout(() => {
      spawnEffect("mine-spark", worker.x + 8, worker.y - 8);
      const label = document.createElement("div");
      label.className = "gold-pop";
      label.textContent = `+${state.bestiary.mine.income}`;
      label.style.left = `${state.mine.x - 22 + (index % 3) * 22}px`;
      label.style.top = `${state.mine.y - 72 - Math.floor(index / 3) * 18}px`;
      effectsLayer.append(label);
      setTimeout(() => label.remove(), 900);
    }, index * 120);
  });
}

function spawnEnemyMineSpark() {
  if (!state.enemyMine) return;
  if (state.enemyWorkers.length) playSound("pickaxe", { duration: 0.24, volume: 0.24 });
  state.enemyWorkers.forEach((worker, index) => {
    setTimeout(() => {
      spawnEffect("mine-spark", worker.x + 8, worker.y - 8);
      const label = document.createElement("div");
      label.className = "gold-pop";
      label.textContent = `+${state.bestiary.mine.income}`;
      label.style.left = `${state.enemyMine.x - 22 + (index % 3) * 22}px`;
      label.style.top = `${state.enemyMine.y - 72 - Math.floor(index / 3) * 18}px`;
      effectsLayer.append(label);
      setTimeout(() => label.remove(), 900);
    }, index * 120);
  });
}

function spawnEnemySpendPop(amount) {
  if (!state.enemyBarracks && !state.enemyMine) return;
  const anchor = state.enemyBarracks || state.enemyMine;
  const label = document.createElement("div");
  label.className = "gold-pop enemy-spend-pop";
  label.textContent = `-${amount}`;
  label.style.left = `${anchor.x}px`;
  label.style.top = `${anchor.y - 96}px`;
  effectsLayer.append(label);
  setTimeout(() => label.remove(), 900);
}

function spawnHit(x, y) {
  spawnEffect("hit-flash", x, y);
}

function spawnMeleeHit(x, y) {
  spawnEffect("melee-slash", x, y);
}

function spawnRepairSpark(x, y) {
  spawnEffect("repair-spark", x, y);
}

function spawnAttackRing(x, y) {
  spawnEffect("attack-ring", x, y);
}

function spawnArrow(from, to, options = {}) {
  playBowShot(options.tower || from.type === "towerShot" ? "towerShot" : "bow");
  const startX = from.x;
  const startY = from.type === "towerShot" ? from.y : from.y - (from.type === "base" || from.type === "tower" ? 64 : 14);
  const endX = to.x;
  const endY = to.y - (to.type === "base" || to.type === "enemyBase" ? 48 : 8);
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx) || 0;
  const projectile = document.createElement("div");
  projectile.className = "arrow-projectile";
  if (options.tower || from.type === "towerShot") projectile.classList.add("tower-arrow");
  if (from.type === "archer" || from.enemyArcher) projectile.classList.add("fast-arrow");
  projectile.style.left = `${startX}px`;
  projectile.style.top = `${startY}px`;
  projectile.style.setProperty("--dx", `${dx}px`);
  projectile.style.setProperty("--dy", `${dy}px`);
  projectile.style.setProperty("--angle", `${angle}rad`);
  const arrow = document.createElement("div");
  arrow.className = "arrow-shot";
  projectile.append(arrow);
  effectsLayer.append(projectile);
  setTimeout(() => projectile.remove(), from.type === "archer" || from.enemyArcher ? 320 : 460);
}

function playBowShot(soundKey = "bow") {
  playSound(soundKey);
}

function distributeMove(point) {
  const movable = selectedMovables();
  if (!movable.length) return;
  movable.forEach((entity, index) => {
    if (entity.type === "worker") removeWorkerFromMine(entity);
    entity.attackTarget = null;
    entity.targetEntity = null;
    entity.forceMoveUntil = performance.now() + 4500;
    const angle = (Math.PI * 2 * index) / Math.max(1, movable.length);
    const radius = movable.length > 1 ? 26 : 0;
    entity.target = clampToWorld({ x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius });
  });
  setMessage(`Отряд идёт к точке. Выбрано: ${movable.length}.`);
  if (movable.length === 1 && movable[0].type === "worker") openWorkerMenu(movable[0]);
}

function rectFromPoints(a, b) {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function updateSelectionBox(rect) {
  selectionBox.style.left = `${rect.left}px`;
  selectionBox.style.top = `${rect.top}px`;
  selectionBox.style.width = `${rect.width}px`;
  selectionBox.style.height = `${rect.height}px`;
}

function selectWorkersInViewRect(viewRect) {
  const topLeft = viewToWorld(viewRect.left, viewRect.top);
  const bottomRight = viewToWorld(viewRect.left + viewRect.width, viewRect.top + viewRect.height);
  const rect = {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
  const units = [...state.workers, ...state.soldiers, ...state.archers].filter(worker =>
    worker.x >= rect.left &&
    worker.x <= rect.left + rect.width &&
    worker.y >= rect.top &&
    worker.y <= rect.top + rect.height
  );
  if (units.length) {
    selectMany(units);
    setMessage(`Выделено юнитов: ${units.length}.`);
  } else {
    clearSelection();
  }
}

function gameLoop(time) {
  if (screens.game.classList.contains("hidden")) {
    requestAnimationFrame(gameLoop);
    return;
  }
  const rawDt = (time - state.lastTime) / 1000 || 0;
  const dt = Math.min(0.05, rawDt);
  state.lastTime = time;
  state.mineIncomeTimer += rawDt;

  if (state.mineIncomeTimer >= state.bestiary.mine.interval) {
    state.mineIncomeTimer = 0;
    const miners = state.mine?.assignedWorkers?.length || 0;
    if (miners > 0) {
      state.money += state.bestiary.mine.income * miners;
      updateMoney();
      spawnMineSpark();
    }
  }
  if (state.enemyMine) {
    state.enemyIncomeTimer += rawDt;
    if (state.enemyIncomeTimer >= state.bestiary.mine.interval) {
      state.enemyIncomeTimer = 0;
      state.enemyMoney += state.bestiary.mine.income * state.enemyWorkers.length;
      state.enemyMine.el.dataset.workers = String(state.enemyWorkers.length);
      if (state.enemyMine.goldTotalEl) state.enemyMine.goldTotalEl.textContent = String(Math.floor(state.enemyMoney));
      spawnEnemyMineSpark();
      if (state.enemyBarracks && state.enemyMoney >= state.bestiary.soldier.cost) {
        state.enemyMoney -= state.bestiary.soldier.cost;
        spawnEnemyFromBarracks();
        spawnEnemySpendPop(state.bestiary.soldier.cost);
        if (state.enemyMine.goldTotalEl) state.enemyMine.goldTotalEl.textContent = String(Math.floor(state.enemyMoney));
        setMessage(`Враг потратил 100 золота и выпустил воина. Золото врага: ${Math.floor(state.enemyMoney)}.`);
      }
    }
  }

  if (!state.waveStarted) {
    state.waveStartAt -= rawDt;
    waveTimer.textContent = `Атака через ${Math.max(0, Math.ceil(state.waveStartAt))}с`;
    if (state.waveStartAt <= 0) spawnEnemies();
  } else {
    waveTimer.textContent = state.enemies.length ? `Врагов: ${state.enemies.length}` : "Волна отбита";
  }
  if (state.firstWaveCleared && state.enemyBase) {
    state.enemySpawnTimer -= rawDt;
    if (state.enemySpawnTimer <= 0) {
      spawnEnemyFromBase();
      state.enemySpawnTimer = 10;
    }
  }

  state.entities.forEach(entity => updateMovement(entity, dt));
  applySeparation();
  state.entities.forEach(entity => positionEntity(entity));
  updateConstructionStarts();
  updateJobs(rawDt);
  updateProduction(rawDt);
  updateRepairs(rawDt);
  updateRadialButtons();
  updateCombat(dt);
  removeDead();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  state.money = 200;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.baseLevel = 1;
  state.baseTowerCount = 1;
  state.baseTowers = [true, false, false];
  state.selected = [];
  state.selectedTowerIndex = null;
  state.buildMode = null;
  state.nextId = 1;
  state.entities = [];
  state.enemies = [];
  state.workers = [];
  state.soldiers = [];
  state.archers = [];
  state.barracks = [];
  state.towers = [];
  state.enemyBase = null;
  state.enemyMine = null;
  state.enemyMoney = 0;
  state.enemyBarracks = null;
  state.enemyWorkers = [];
  state.enemyIncomeTimer = 0;
  state.enemySpawnTimer = 0;
  state.firstWaveCleared = false;
  state.victoryPending = false;
  state.buildWorker = null;
  state.mine = null;
  state.waveStarted = false;
  state.waveStartAt = 60;
  state.mineIncomeTimer = 0;
  state.drag = null;
  state.rightDrag = null;
  state.suppressContext = false;
  state.jobs = [];
  state.productionJobs = [];
  state.rallyPoints = new Map();
  state.radialButtons = [];
  state.hasStarted = true;
  state.isPaused = false;
  state.lastTime = performance.now();
  entitiesLayer.innerHTML = "";
  effectsLayer.innerHTML = "";
  roadsLayer.innerHTML = "";
  rangeLayer.innerHTML = "";
  document.querySelector(".victory-menu")?.remove();
  closeRadial();
  closeBuildMode();
  selectionBox.classList.add("hidden");
  updateMoney();
  applyZoom();
  continueBtn.classList.remove("hidden");
  const base = makeBase();
  makeMine(base.x - 250, base.y + 120);
  const enemyBase = makeEnemyBase(base.x + 1320, base.y - 80);
  const enemyMine = makeEnemyMine(enemyBase.x + 230, enemyBase.y + 130);
  const enemyWorkerCount = state.level >= 3 ? 5 : 3;
  for (let i = 0; i < enemyWorkerCount; i += 1) spawnEnemyWorker(enemyMine, i);
  if (state.level >= 2) makeEnemyBarracks(enemyBase.x + 30, enemyBase.y - 220);
  spawnLevelGuards(enemyBase);
  drawRoad(base, state.enemyBase);
  setMessage("ЛКМ выделяет, рамка выделяет рабочих, ПКМ отдаёт команды. Доход только от рудника.");
}

function drawRoad(from, to) {
  const road = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const left = Math.min(from.x, to.x) - 120;
  const top = Math.min(from.y, to.y) - 120;
  const width = Math.abs(dx) + 240;
  const height = Math.abs(dy) + 240;
  const startX = from.x - left;
  const startY = from.y + 48 - top;
  const endX = to.x - left;
  const endY = to.y + 48 - top;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  road.classList.add("road");
  road.style.left = `${left}px`;
  road.style.top = `${top}px`;
  road.setAttribute("width", width);
  road.setAttribute("height", height);
  road.setAttribute("viewBox", `0 0 ${width} ${height}`);
  path.setAttribute("d", `M ${startX} ${startY} C ${midX - 300} ${midY + 190}, ${midX + 260} ${midY - 210}, ${endX} ${endY}`);
  path.setAttribute("pathLength", "1");
  road.append(path);
  roadsLayer.append(road);
}

world.addEventListener("mousemove", event => {
  const pos = clampToWorld(eventToWorld(event));
  if (state.rightDrag) {
    const view = eventToView(event);
    const dx = view.x - state.rightDrag.last.x;
    const dy = view.y - state.rightDrag.last.y;
    if (Math.abs(view.x - state.rightDrag.start.x) > 5 || Math.abs(view.y - state.rightDrag.start.y) > 5) {
      state.rightDrag.moved = true;
    }
    if (state.rightDrag.moved) {
      state.panX += dx;
      state.panY += dy;
      applyZoom();
    }
    state.rightDrag.last = view;
    return;
  }
  if (state.buildMode) {
    const view = worldToView(pos);
    ghost.style.left = `${view.x - 66 * state.zoom}px`;
    ghost.style.top = `${view.y - 46 * state.zoom}px`;
    ghost.style.transform = `scale(${state.zoom})`;
  }
  if (state.drag) {
    const rect = rectFromPoints(state.drag.start, eventToView(event));
    state.drag.moved = rect.width > 8 || rect.height > 8;
    updateSelectionBox(rect);
    selectionBox.classList.toggle("hidden", !state.drag.moved);
  }
});

world.addEventListener("mousedown", event => {
  if (event.button === 2 && !event.target.closest(".radial-option")) {
    const view = eventToView(event);
    state.rightDrag = { start: view, last: view, moved: false };
    return;
  }
  if (event.button !== 0 || event.target.closest(".radial-option")) return;
  state.drag = { start: eventToView(event), moved: false };
});

world.addEventListener("mouseup", event => {
  if (event.button === 2 && state.rightDrag) {
    state.suppressContext = state.rightDrag.moved;
    state.rightDrag = null;
    return;
  }
  if (!state.drag) return;
  const rect = rectFromPoints(state.drag.start, eventToView(event));
  selectionBox.classList.add("hidden");
  const wasDrag = state.drag.moved;
  state.drag = null;
  if (wasDrag) {
    selectWorkersInViewRect(rect);
    return;
  }
  if (state.buildMode) {
    placeBuilding(eventToWorld(event));
    return;
  }
  closeRadial();
  clearSelection();
});

world.addEventListener("contextmenu", event => {
  event.preventDefault();
  if (state.suppressContext) {
    state.suppressContext = false;
    return;
  }
  const point = clampToWorld(eventToWorld(event));
  const mineByPoint = state.mine && distance(point, state.mine) < 90;
  if (mineByPoint && selectedWorkers().length) {
    assignWorkersToMine(selectedWorkers());
    return;
  }
  const base = state.entities.find(entity => entity.type === "base");
  const repairTarget = base && distance(point, base) < 90 ? base : null;
  if (repairTarget && selectedWorkers().length && repairTarget.hp < repairTarget.maxHp) {
    selectedWorkers().forEach(worker => {
      removeWorkerFromMine(worker);
      worker.busy = true;
      worker.el.classList.add("busy");
      worker.target = { x: repairTarget.x - 70 + (worker.id % 4) * 28, y: repairTarget.y + 76 };
      worker.repairTarget = repairTarget;
    });
    setMessage("Рабочие ремонтируют главное здание.");
    return;
  }
  const enemy = state.enemies.find(item => distance(point, item) < 78)
    || state.enemyWorkers.find(item => distance(point, item) < 54)
    || (state.enemyBarracks && distance(point, state.enemyBarracks) < 150 ? state.enemyBarracks : null)
    || (state.enemyBase && distance(point, state.enemyBase) < 170 ? state.enemyBase : null);
  if (enemy) {
    selectedMovables().forEach(unit => {
      if (unit.type === "worker") removeWorkerFromMine(unit);
      unit.forceMoveUntil = 0;
      unit.attackTarget = enemy;
      unit.targetEntity = enemy;
      const angle = Math.atan2(unit.y - enemy.y, unit.x - enemy.x) || 0;
      const range = enemy.type === "enemyBase" || enemy.type === "barracks" ? 76 : meleeRange(unit) - 8;
      unit.target = {
        x: enemy.x + Math.cos(angle) * range,
        y: enemy.y + Math.sin(angle) * range,
      };
    });
    spawnAttackRing(enemy.x, enemy.y);
    setMessage("Приказ атаковать врага.");
    return;
  }
  const selectedBuildings = state.selected.filter(entity => entity.type === "base" || entity.type === "barracks");
  if (selectedBuildings.length) {
    setRallyPointForBuildings(selectedBuildings, point);
    return;
  }
  distributeMove(point);
});

world.addEventListener("wheel", event => {
  event.preventDefault();
  setZoom(state.zoom + (event.deltaY < 0 ? 0.06 : -0.06));
}, { passive: false });

document.getElementById("startBtn").addEventListener("click", () => {
  state.level = 1;
  showScreen("game");
  resetGame();
});

continueBtn.addEventListener("click", () => {
  if (!state.hasStarted) return;
  state.isPaused = false;
  state.lastTime = performance.now();
  showScreen("game");
});

document.getElementById("bestiaryBtn").addEventListener("click", () => showScreen("bestiary"));
document.getElementById("backMenuBtn").addEventListener("click", () => showScreen("menu"));
document.getElementById("gameMenuBtn").addEventListener("click", () => {
  state.isPaused = true;
  showScreen("menu");
});
document.getElementById("exitBtn").addEventListener("click", () => {
  document.body.innerHTML = '<main class="screen menu-screen"><h1>Игра закрыта</h1><button class="primary-btn" onclick="location.reload()">Вернуться</button></main>';
});

document.getElementById("resetBestiaryBtn").addEventListener("click", async () => {
  state.bestiary = structuredClone(BESTIARY_DEFAULTS);
  await Promise.all(Object.keys(SOUND_DEFS).map(key => resetCustomSound(key)));
  saveBestiary();
  renderBestiary();
});

document.getElementById("zoomInBtn").addEventListener("click", () => {
  setZoom(state.zoom + 0.1);
});

document.getElementById("zoomOutBtn").addEventListener("click", () => {
  setZoom(state.zoom - 0.1);
});

requestAnimationFrame(gameLoop);
