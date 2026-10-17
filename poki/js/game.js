(window.__STORE_READY || Promise.resolve()).then(() => {
  const $ = id => document.getElementById(id);
  const Store = window.Store || (() => { const m = {}; return { get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); }, del: k => { delete m[k]; }, flush: () => Promise.resolve(false), status: () => ({ backend: 'memory', persistent: false }) }; })();
  const playBtn = $('playBtn'), fadeEl = $('fade'), logo = $('logo');
  if (typeof THREE === 'undefined') {
    fadeEl.classList.add('out'); logo.style.opacity = 1;
    $('titleScreen').classList.add('revealed');
    playBtn.textContent = 'Refresh to load';
    return;
  }

  // ================= graphics quality =================
  // Low / Medium / High: texture sharpness, render resolution, scenery density and particle counts
  const QUALITY = (() => { try { const q = Store.get('poki_ignore_shrinkrun-quality') || Store.get('shrinkrun-quality'); return ['low', 'medium', 'high'].includes(q) ? q : 'medium'; } catch (e) { return 'medium'; } })();
  const Q = {
    low:    { tex: 1, aniso: 2,  pr: () => Math.min(window.devicePixelRatio || 1, 1),   scenery: 0.55, weather: 0.5, body: 0.028, aa: false },
    medium: { tex: 2, aniso: 8,  pr: () => Math.min(window.devicePixelRatio || 1, 1.75), scenery: 1,    weather: 1,   body: 0.022, aa: true },
    high:   { tex: 3, aniso: 16, pr: () => Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2.5), scenery: 1.35, weather: 1.4, body: 0.017, aa: true },
  }[QUALITY];
  // every texture the game paints is drawn on a canvas; this gives those canvases more real pixels while the
  // drawing code keeps working in the same units, so textures come out crisp instead of blurry
  const baseCreateCanvas = Document.prototype.createElement.bind(document);
  const rawCanvas = () => baseCreateCanvas('canvas');
  if (Q.tex > 1) {
    const wDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), hDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
    const baseGetContext = HTMLCanvasElement.prototype.getContext, baseCreate = document.createElement.bind(document);
    document.createElement = function (tag, opts) {
      const el = baseCreate(tag, opts);
      if (String(tag).toLowerCase() !== 'canvas') return el;
      let lw = 300, lh = 150;
      Object.defineProperty(el, 'width', { configurable: true, get: () => lw, set: v => { lw = v; wDesc.set.call(el, Math.round(v * Q.tex)); } });
      Object.defineProperty(el, 'height', { configurable: true, get: () => lh, set: v => { lh = v; hDesc.set.call(el, Math.round(v * Q.tex)); } });
      el.getContext = function (type, o) { const ctx = baseGetContext.call(el, type, o); if (type === '2d' && ctx) ctx.setTransform(Q.tex, 0, 0, Q.tex, 0, 0); return ctx; };
      return el;
    };
  }

  // ================= content =================
  const RUNNERS = [
    { id: 'classic',  name: 'Classic',  rarity: 'starter',   color: '#FF6A00', shape: [1, 1, 1],          power: 'No special power. A steady all-rounder.' },
    { id: 'springy',  name: 'Springy',  rarity: 'common',    color: '#7BD63A', shape: [0.88, 1.07, 0.9],  power: 'Double jump: press jump again in the air.' },
    { id: 'anchor',   name: 'Anchor',   rarity: 'common',    color: '#B5361E', shape: [1.22, 0.94, 1.15], power: 'Wind pushes you half as hard, but you steer a bit slower.' },
    { id: 'magnet',   name: 'Magnet',   rarity: 'rare',      color: '#E83E8C', shape: [1, 1, 1],          power: 'Pulls orbs in from much farther away.' },
    { id: 'guardian', name: 'Guardian', rarity: 'epic',      color: '#2BB3C0', shape: [1.08, 1, 1.05],    power: 'A shield blocks one hit, then recharges after 20 seconds.' },
    { id: 'comet',    name: 'Comet',    rarity: 'legendary', color: '#8FD3FF', glow: '#2A6FB0', shape: [0.95, 1.04, 0.95], power: 'Blazing speed: every run scores 30% more points.' },
    { id: 'titan',    name: 'Titan',    rarity: 'legendary', color: '#B08C5A', glow: '#6E5633', shape: [1.18, 0.98, 1.14], power: 'Shrugs off every other hit: you only lose a size on odd-numbered hits.' },
    { id: 'wisp',     name: 'Wisp',     rarity: 'legendary', color: '#CFEFFF', glow: '#6FB8E0', shape: [0.88, 1.08, 0.88], power: 'Featherlight: wind and hurricanes can never blow you off the track.' },
    { id: 'echo',     name: 'Echo',     rarity: 'legendary', color: '#8CFFD9', glow: '#1E8C6E', shape: [1, 1.03, 1],       power: 'Every Growth Surge or Shrink Crystal you use triggers twice.' },
    { id: 'nebula',   name: 'Nebula',   rarity: 'mythic',    color: '#9B5CFF', glow: '#3B1A80', shape: [1.05, 1, 1.05],    power: 'Every orb grows you two sizes instead of one.' },
    { id: 'aurora',   name: 'Aurora',   rarity: 'mythic',    color: '#7CFFC2', glow: '#C86FFF', shape: [0.97, 1.05, 0.97], power: 'Every wind rescue is won instantly, no mashing needed.' },
    { id: 'specter',  name: 'Specter',  rarity: 'mythic',    color: '#D8D4FF', glow: '#4A3F8C', shape: [0.93, 1.06, 0.93], power: 'Every 15 seconds, you phase through danger for 2 seconds, untouchable.' },
    { id: 'lunar',    name: 'Lunar',    rarity: 'celestial', color: '#E8ECF8', glow: '#5A6AA8', shape: [0.95, 1.05, 0.95], power: 'Moon gravity: floaty jumps that go 15% higher and hang in the air.' },
    { id: 'nova',     name: 'Nova',     rarity: 'celestial', color: '#FFC83D', glow: '#B85A00', shape: [1, 1, 1],          power: 'Supernova: once per run, a hit or fall that would end it blasts you back to full size.' },
    { id: 'eclipse',  name: 'Eclipse',  rarity: 'celestial', color: '#2A2350', glow: '#6A3FD0', shape: [1.05, 1.02, 1.05], power: 'Disasters barely touch you: wind and hurricanes 70% weaker, tsunamis pass through you.' },
    { id: 'hopper',   name: 'Hopper',   rarity: 'rare',      color: '#FFD23F', shape: [0.92, 1.03, 0.92], power: 'Spring-loaded legs: every jump goes 20% higher.' },
    { id: 'zipper',   name: 'Zipper',   rarity: 'rare',      color: '#3DDC97', shape: [0.9, 1.0, 0.9],    power: 'Quick feet: steers 25% faster.' },
    { id: 'saver',    name: 'Saver',    rarity: 'rare',      color: '#F2B544', shape: [1.08, 0.97, 1.05], power: 'Earns 15% more coins every run.' },
    { id: 'phantom',  name: 'Phantom',  rarity: 'epic',      color: '#C8D3E8', glow: '#3A4A6A', shape: [0.95, 1.03, 0.95], power: 'After a hit you stay untouchable three times as long.' },
    { id: 'lucky',    name: 'Lucky',    rarity: 'epic',      color: '#4CD964', shape: [1, 1, 1],          power: '30% chance to shrug off a hit completely.' },
    { id: 'booster',  name: 'Booster',  rarity: 'epic',      color: '#FF5A36', shape: [1, 1.02, 1],       power: 'Turbo and Super Spring last twice as long.' },
    { id: 'breezer',  name: 'Breezer',  rarity: 'epic',      color: '#9FE7FF', shape: [0.94, 1.02, 0.94], power: 'Wind rescues need half the presses and give you more time.' },
    { id: 'tidal',    name: 'Tidal',    rarity: 'epic',      color: '#1E88E5', shape: [1.05, 1, 1.05],    power: 'Tsunamis and lava bombs can’t shrink you.' },
    { id: 'galaxy',   name: 'Galaxy',   rarity: 'celestial', color: '#3B1E8C', glow: '#E040FB', shape: [1.04, 1.04, 1.04], power: 'Starts every run one size bigger, and grows one size by itself every 25 seconds.' },
    { id: 'photon',   name: 'Photon',   rarity: 'celestial', color: '#FFF7C2', glow: '#FFD23F', shape: [0.93, 1.04, 0.93], power: 'Naturally fast: runs 15% quicker at all times. Speed pads appear twice as often for you, and hitting 3 in a row triggers LIGHTSPEED: 5 seconds of blinding speed that smashes everything for triple points. Chain 5 Lightspeeds and it needs 30 seconds to cool down.' },
    { id: 'seraph',   name: 'Seraph',   rarity: 'divine',    color: '#FFFDF2', glow: '#FFC94A', shape: [1, 1.05, 1],       power: 'A holy shield that blocks a hit and recharges every 10 seconds, plus a double jump.' },
    { id: 'infinity', name: 'Infinity', rarity: 'divine',    color: '#14142A', glow: '#7CF7FF', shape: [1.04, 1.04, 1.04], power: 'Never collapses at Otherworldly, and every orb grows you two sizes.' },
    { id: 'ascendant', name: 'Ascendant', rarity: 'divine',   color: '#FFFFFF', glow: '#FFD95C', shape: [1, 1, 1],          power: 'Untouched by every disaster, and always scores at the Normal-size multiplier no matter how big or small you are.' },
    { id: 'omega',    name: 'Omega',    rarity: 'eternal',   color: '#FFFFFF', glow: '#FFFFFF', swatch: 'conic-gradient(#FF5C5C, #FFD25C, #5CFF8A, #5CC8FF, #C85CFF, #FF5C5C)', shape: [1.02, 1.04, 1.02], powers: ['springy', 'magnet', 'guardian', 'comet', 'titan', 'wisp', 'echo', 'nebula', 'aurora', 'specter', 'lunar', 'nova', 'eclipse', 'photon', 'hopper', 'zipper', 'saver', 'phantom', 'lucky', 'booster', 'breezer', 'tidal', 'seraph', 'infinity'], power: 'The last runner. Holds almost every other runner\'s power at once: double jump, a rechargeable shield, moon gravity, Lightspeed, wind and tsunami immunity, a revive, instant wind rescues, and more.' },
  ];
  const RARITY = {
    starter:   { label: 'Starter',   color: '#FFE2B8', chance: 0 },
    common:    { label: 'Common',    color: '#C9D0D8', chance: 0.4,     refund: 200 },   // whatever is left after every other tier, so the total is exactly 100%
    rare:      { label: 'Rare',      color: '#7FB2FF', chance: 0.27,  refund: 300 },
    epic:      { label: 'Epic',      color: '#C99BFF', chance: 0.18,  refund: 500 },
    legendary: { label: 'Legendary', color: '#FFC94A', chance: 0.07,   refund: 1000 },
    mythic:    { label: 'Mythic',    color: '#FF6FD8', chance: 0.045,  refund: 1800 },
    celestial: { label: 'Celestial', color: '#8FF3FF', chance: 0.015,  refund: 2500 },
    divine:    { label: 'Divine',    color: '#FFE8A3', chance: 0.015,  refund: 5000 },
    eternal:   { label: 'Eternal',   color: '#FFFFFF', bg: 'linear-gradient(90deg,#FF5C5C,#FFD25C,#5CFF8A,#5CC8FF,#C85CFF)', chance: 0.005, refund: 20000 }, // 0.5%
  };
  const rarityBg = k => RARITY[k].bg || RARITY[k].color;
  // the stated odds (45/29/20/7/5/1.5/1.5) add up to 109%, so they're scaled down to fit 100% while keeping the same ratios
  const SPIN_COST = 800, PITY = 60;        // a Celestial is guaranteed at least once every 60 spins
  const DIVINE_PITY = 220;                 // a Divine is guaranteed at least once every 220 spins, tracked separately from the Celestial pity
  const MAPS = [
    { id: 'meadow', name: 'Meadow', price: 0, desc: 'Soft grass under a clear sunrise.', pro: 'Balanced, no surprises', con: '',
      surface: 'grass', weather: 'none',
      sky: [[0, '#62B8FF'], [0.3, '#FFA9C9'], [0.48, '#FFB25E'], [0.6, '#FFE59A'], [1, '#FFE59A']], fog: '#FFDDA0', sun: '#FFF2B8',
      track: '#5DB33E', line: '#86D35A', curbA: '#FFFFFF', curbB: '#F3E7B8', side: '#7A5230',
      obstacle: '#D2691E', trim: '#8A4210', gate: '#D9621A', cloud: '#FFF1E6', light: 1, fx: {} },
    { id: 'desert', name: 'Desert Dusk', price: 8000, desc: 'Rippled sand and drifting dust at sunset.', pro: 'Dunes block the wind (45% weaker)', con: 'Sand slows your steering and jumps',
      surface: 'sand', weather: 'dust',
      sky: [[0, '#5A4FCF'], [0.32, '#FF7A6B'], [0.5, '#FFAA5B'], [0.62, '#FFD58A'], [1, '#FFD58A']], fog: '#FFC98A', sun: '#FFE59A',
      track: '#E9B877', line: '#C98F4E', curbA: '#C8452B', curbB: '#FFF0D6', side: '#B97A3E',
      obstacle: '#B5652E', trim: '#7E4019', gate: '#A85A26', cloud: '#FFD9C2', light: 1, fx: { steer: 0.82, jump: 0.9, wind: 0.55 } },
    { id: 'glacier', name: 'Glacier', price: 15000, desc: 'Glassy ice under falling snow.', pro: '×1.25 points', con: 'Slippery: you slide when you steer',
      surface: 'ice', weather: 'snow',
      sky: [[0, '#7FB6E8'], [0.42, '#B9DDF5'], [0.6, '#EAF6FF'], [1, '#EAF6FF']], fog: '#E3F2FC', sun: '#FFFFFF',
      track: '#BFE6FA', line: '#FFFFFF', curbA: '#3E8EDB', curbB: '#FFFFFF', side: '#8CC7EA',
      obstacle: '#4D9BD1', trim: '#2B6A99', gate: '#3C86C0', cloud: '#FFFFFF', light: 1, fx: { traction: 0.18, score: 1.25 } },
    { id: 'marsh', name: 'Stormy Marsh', price: 25000, desc: 'Muddy ground in a thundery downpour.', pro: 'Mud slows the run by 15%', con: 'Storm winds hit 35% harder',
      surface: 'mud', weather: 'rain',
      sky: [[0, '#4E5A78'], [0.42, '#7F8DA8'], [0.6, '#AEB8CB'], [1, '#AEB8CB']], fog: '#A5B0C4', sun: '#E6ECF5',
      track: '#6E5236', line: '#8A6A48', curbA: '#3F4A5E', curbB: '#C9D2E0', side: '#4A3522',
      obstacle: '#8C5A2E', trim: '#4F3018', gate: '#7A4E28', cloud: '#8E98AE', light: 0.8, fx: { speed: 0.85, wind: 1.35 } },
    { id: 'neon', name: 'Neon Night', price: 42000, desc: 'A glowing metal grid racing through the night.', pro: '×1.4 points', con: 'You can’t see as far ahead',
      surface: 'grid', weather: 'motes',
      sky: [[0, '#0E0630'], [0.38, '#2B0F5C'], [0.55, '#7A2A8C'], [0.62, '#FF5FA2'], [1, '#3A1666']], fog: '#3A1666', sun: '#FF9AD5',
      track: '#24124A', line: '#FF4FD8', curbA: '#22E1FF', curbB: '#FF4FD8', side: '#160A30',
      obstacle: '#6A35D6', trim: '#3A1A86', gate: '#7B3FE4', cloud: '#3A2470', light: 0.65, fx: { score: 1.4, fogNear: 22, fogFar: 68 } },
    { id: 'clouds', name: 'Cloud Kingdom', price: 20000, desc: 'A royal cloud road past towering sky castles at golden hour.', pro: 'Floaty air: jumps go 25% higher', con: 'Winds blow 40% harder and come more often',
      surface: 'cloud', weather: 'sparkle',
      sky: [[0, '#24307E'], [0.28, '#5B4FCF'], [0.46, '#B98AF0'], [0.57, '#FFB98A'], [0.64, '#FFE2B0'], [1, '#FFE2B0']], fog: '#D9C2F0', sun: '#FFE9B8',
      track: '#EDE6FF', line: '#C8B6FF', curbA: '#E8B04A', curbB: '#6A3FD0', side: '#8C7AD8',
      obstacle: '#5E3BB8', trim: '#E8B04A', gate: '#7A4FE0', cloud: '#F3E6FF', light: 1, fx: { jump: 1.25, wind: 1.4, gustW: 1.8 } },
    { id: 'reef', name: 'Coral Reef', price: 30000, desc: 'Under the sea, across sand and coral with rising bubbles.', pro: 'Water slows the run by 20%', con: 'Tsunamis roll in far more often',
      surface: 'coral', weather: 'bubbles',
      sky: [[0, '#05334F'], [0.4, '#0A6C8C'], [0.58, '#1BA7B5'], [0.64, '#5FD6CF'], [1, '#0A6C8C']], fog: '#1A8EA3', sun: '#BFF6FF',
      track: '#E7D3A1', line: '#C9B07A', curbA: '#FF6F91', curbB: '#FFE0A3', side: '#B8935C',
      obstacle: '#FF7A59', trim: '#B5452B', gate: '#FF5E7E', cloud: '#7FD6E8', light: 0.9, fx: { speed: 0.8, tsunamiW: 2.6, fogNear: 30, fogFar: 95 } },
    { id: 'haunted', name: 'Haunted Hollow', price: 36000, desc: 'Cobblestones through a misty, moonlit graveyard.', pro: '×1.3 points, and orbs appear 40% more often', con: 'Thick mist: you see much less',
      surface: 'cobble', weather: 'wisps',
      sky: [[0, '#0B0A1E'], [0.4, '#251A45'], [0.58, '#4B3A6E'], [0.64, '#7FA88A'], [1, '#251A45']], fog: '#3B3358', sun: '#E8F5D0',
      track: '#4A4060', line: '#2C2540', curbA: '#9BFFB0', curbB: '#5A4E78', side: '#2A2238',
      obstacle: '#6E5A8C', trim: '#3A2C55', gate: '#7E5FB0', cloud: '#5A5078', light: 0.7, fx: { score: 1.3, orbW: 1.4, fogNear: 16, fogFar: 58 } },
    { id: 'volcanic', name: 'Volcanic Core', price: 50000, desc: 'Black basalt split by glowing lava, with embers in the air.', pro: '×1.5 points', con: 'Volcanoes erupt twice as often',
      surface: 'lava', weather: 'embers',
      sky: [[0, '#1A0505'], [0.38, '#4A0E0A'], [0.55, '#A3240E'], [0.63, '#FF7A1F'], [1, '#4A0E0A']], fog: '#5A1608', sun: '#FFB347',
      track: '#2A2020', line: '#FF6A1F', curbA: '#FF3B1F', curbB: '#3A2A2A', side: '#1A1212',
      obstacle: '#4A3A36', trim: '#FF5A1F', gate: '#6A2A1A', cloud: '#5A2A20', light: 0.8, fx: { score: 1.5, volcanoW: 2.2 } },
    // ---- level rewards (not sold in the shop) ----
    { id: 'autumn', name: 'Autumn Path', level: 7, desc: 'A leafy trail under a golden afternoon.', pro: 'Orbs appear 15% more often', con: 'Fallen leaves are a little slippery',
      surface: 'leaves', weather: 'leaves',
      sky: [[0, '#6FA8DC'], [0.35, '#F6B26B'], [0.55, '#FFD08A'], [0.62, '#FFE9B8'], [1, '#FFE9B8']], fog: '#FFDDA8', sun: '#FFF0C0',
      track: '#8A9A3E', line: '#C76A1E', curbA: '#C0392B', curbB: '#F5DEB3', side: '#6B4A2A',
      obstacle: '#A0522D', trim: '#5E2F12', gate: '#B5651D', cloud: '#FFF1E0', light: 1, fx: { orbW: 1.15, traction: 0.75 } },
    { id: 'blossom', name: 'Cherry Blossom', level: 15, desc: 'Soft grass beneath drifting pink petals.', pro: '×1.1 points', con: 'Petals hide some of the track ahead',
      surface: 'grass', weather: 'petals',
      sky: [[0, '#9FC8FF'], [0.35, '#FFC6DD'], [0.55, '#FFE1EC'], [0.62, '#FFF4F8'], [1, '#FFF4F8']], fog: '#FFE4EE', sun: '#FFFFFF',
      track: '#7CC46A', line: '#FFB7D2', curbA: '#FF8FB8', curbB: '#FFFFFF', side: '#6B4A3A',
      obstacle: '#D96A9A', trim: '#8E3A62', gate: '#E07AA8', cloud: '#FFFFFF', light: 1, fx: { score: 1.1, fogNear: 34, fogFar: 96 } },
    { id: 'aurora', name: 'Aurora Tundra', level: 25, desc: 'Frozen ground under a dancing aurora.', pro: 'Winds are 20% weaker', con: 'Icy patches: you slide a bit',
      surface: 'ice', weather: 'snow',
      sky: [[0, '#081430'], [0.28, '#123E5A'], [0.42, '#2DE3A0'], [0.52, '#7A5BFF'], [0.62, '#C9E8FF'], [1, '#C9E8FF']], fog: '#B9D8F0', sun: '#E8FFF6',
      track: '#D8F0FF', line: '#FFFFFF', curbA: '#2DE3A0', curbB: '#7A5BFF', side: '#8CB8D8',
      obstacle: '#5A7FB0', trim: '#2B4A78', gate: '#4A6FA8', cloud: '#E8F4FF', light: 0.9, fx: { wind: 0.8, traction: 0.55 } },
    { id: 'rainbow', name: 'Rainbow Road', level: 35, desc: 'A glowing rainbow highway through the stars.', pro: '×1.2 points', con: 'The run is 10% faster',
      surface: 'rainbow', weather: 'sparkle',
      sky: [[0, '#05031A'], [0.4, '#1B0B4A'], [0.58, '#5A1E8C'], [0.64, '#FF7AD9'], [1, '#1B0B4A']], fog: '#2A1260', sun: '#FFE8FF',
      track: '#222244', line: '#FFFFFF', curbA: '#FFFFFF', curbB: '#FF4FD8', side: '#120A30',
      obstacle: '#7B5CFF', trim: '#3A1A86', gate: '#5A3FE4', cloud: '#3A2470', light: 0.8, fx: { score: 1.2, speed: 1.1 } },
  ];
  const mapFx = m => Object.assign({ traction: 1, steer: 1, jump: 1, wind: 1, speed: 1, score: 1, fogNear: 60, fogFar: 185, gustW: 1, tsunamiW: 1, volcanoW: 1, orbW: 1 }, m.fx || {});
  const runnerById = id => RUNNERS.find(r => r.id === id) || RUNNERS[0];
  const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];

  // ================= save data =================
  // Every player has their own save. A save made while signed out is a "guest" save that stays on this device (the poki_ignore prefix keeps it
  // out of Poki's cloud sync). A save made while signed in to a portal belongs to that account and is never loaded for anyone else.
  const PROFILES_KEY = 'shrinkrun-profiles-v1', LEGACY_SAVE_KEY = 'shrinkrun-save-v2';
  const lsGet = k => Store.get(k);
  const lsSet = (k, v) => Store.set(k, v);
  const lsDel = k => Store.del(k);
  const saveKeyFor = pr => (pr.account ? 'shrinkrun-save-v2:' : 'poki_ignore_shrinkrun-save-v2:') + pr.id;
  let profiles = (() => {
    let ix = null; try { ix = JSON.parse(lsGet(PROFILES_KEY)); } catch (e) {}
    if (!ix || !Array.isArray(ix.list) || !ix.list.length) {
      ix = { v: 1, active: 'p1', next: 2, list: [{ id: 'p1', name: 'Player 1', account: null }] };
      const old = lsGet(LEGACY_SAVE_KEY); // progress made before players existed becomes this device's first guest player
      if (old) { lsSet(saveKeyFor(ix.list[0]), old); lsDel(LEGACY_SAVE_KEY); }
      lsSet(PROFILES_KEY, JSON.stringify(ix));
    }
    if (!ix.list.some(pr => pr.id === ix.active)) ix.active = ix.list[0].id;
    return ix;
  })();
  const activeProfile = profiles.list.find(pr => pr.id === profiles.active);
  const SAVE_KEY = saveKeyFor(activeProfile);
  const saveProfiles = () => lsSet(PROFILES_KEY, JSON.stringify(profiles));
  const readSaveOf = pr => { try { return JSON.parse(lsGet(saveKeyFor(pr)) || '{}'); } catch (e) { return {}; } };
  function addProfile(name, account) {
    const pr = { id: 'p' + (profiles.next++), name: String(name || 'Player').replace(/[<>]/g, '').trim().slice(0, 14) || 'Player', account: account || null };
    profiles.list.push(pr); saveProfiles(); return pr;
  }
  const switchProfile = id => { if (id === profiles.active) return false; profiles.active = id; saveProfiles(); return true; }; // true = reload to load that player's save
  let currentAccount = null; // 'poki:name' or 'cg:name' while signed in to a portal
  // Works out which saved player should be playing. Anyone signed in gets their own account's player (a brand-new, empty one the first time),
  // and signing out goes back to the guest players. Returns true when the page must reload to load a different save.
  function applyAccount(id) {
    if (id === undefined) return false; // unknown (the portal was slow): leave things as they are
    const act = profiles.list.find(pr => pr.id === profiles.active);
    if (id ? (act && act.account === id) : (act && !act.account)) { try { sessionStorage.removeItem('shrinkrun-sw'); } catch (e) {} return false; }
    try { const n = +sessionStorage.getItem('shrinkrun-sw') || 0; if (n >= 3) return false; sessionStorage.setItem('shrinkrun-sw', String(n + 1)); } catch (e) {} // never loop
    const target = id ? (profiles.list.find(pr => pr.account === id) || addProfile(id.slice(id.indexOf(':') + 1), id)) : (profiles.list.find(pr => !pr.account) || addProfile('Player ' + profiles.next, null));
    return switchProfile(target.id);
  }
  const reloadGame = () => { Promise.race([Store.flush(), new Promise(r => setTimeout(r, 1500))]).then(() => { if (window.__reload) window.__reload(); else location.reload(); }); };
  const save = { coins: 0, best: 0, runners: ['classic'], maps: ['meadow'], runner: 'classic', map: 'meadow' };
  try { Object.assign(save, JSON.parse(lsGet(SAVE_KEY) || '{}')); } catch (e) {}
  if (!save.maps.includes('meadow')) save.maps.push('meadow');
  if (!MAPS.some(m => m.id === save.map)) save.map = 'meadow';
  if (!save.gear) save.gear = { owned: [], hat: null, shoes: null, top: null, neck: null, back: null, legs: null };
  if (!save.level) { save.level = 1; save.xp = 0; save.quests = []; save.luckySpins = save.luckySpins || 0; }
  if (save.ultraSpins === undefined) save.ultraSpins = 0;
  if (!save.audio) save.audio = { music: 0.6, sfx: 0.8, muted: false };
  if (save.tutorialDone === undefined) save.tutorialDone = save.best > 0; // players who already played skip the tutorial
  // coins saved under the old rate (1 per 20 points) are scaled up so they keep their value
  if (!save.coinScale) { save.coins = Math.round(save.coins * 8); save.coinScale = 8; }
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const persist = () => lsSet(SAVE_KEY, JSON.stringify(save));

  // ================= audio =================
  // sounds are FLAC files in audio/, fetched and decoded after the first click or tap
  const SFX_FILES = { jump: 'sfx_jump', land: 'sfx_land', coin: 'sfx_coin_collect', shrink: 'sfx_shrink', grow: 'sfx_grow', hit: 'sfx_obstacle_hit', power: 'sfx_power_up', fail: 'sfx_fail', click: 'sfx_menu_click', hover: 'sfx_button_hover', press: 'sfx_button_press', pause: 'sfx_pause_resume' };
  const MUSIC_FILES = { menu: 'bgm_main_menu', game: 'bgm_gameplay_loop', shop: 'bgm_shop_rewards', win: 'bgm_level_complete' };
  const Snd = (() => {
    let ctx = null, master = null, musicBus = null, sfxBus = null, loaded = false, adMuted = false, ducked = false, wantTrack = null, wantOpts = {}, cur = null;
    const buf = {}, lastPlay = {};
    const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
    function applyVolumes(tc = 0.04) {
      if (!ctx) return;
      const t = ctx.currentTime, a = save.audio;
      master.gain.setTargetAtTime(a.muted || adMuted ? 0 : 1, t, tc);
      musicBus.gain.setTargetAtTime(clamp01(a.music) * 0.55 * (ducked ? 0.35 : 1), t, tc); // music sits under the effects
      sfxBus.gain.setTargetAtTime(clamp01(a.sfx), t, tc);
    }
    function decode(name) {
      return new Promise(res => {
        if (!ctx) return res();
        fetch('audio/' + name + '.flac').then(r => r.ok ? r.arrayBuffer() : Promise.reject())
          .then(ab => ctx.decodeAudioData(ab, b => { buf[name] = b; res(); }, () => res()))
          .catch(() => res());
      });
    }
    function loadAll() {
      const names = [...Object.values(SFX_FILES), ...Object.values(MUSIC_FILES)];
      Promise.all(names.map(decode)).then(() => { loaded = true; if (wantTrack) music(wantTrack, wantOpts); });
    }
    function unlock() {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { return; }
        master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
        musicBus.connect(master); sfxBus.connect(master); master.connect(ctx.destination);
        applyVolumes(0);
        try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) {} // wakes audio on iOS
        loadAll();
      }
      if (ctx.state === 'suspended' && !document.hidden) { try { ctx.resume(); } catch (e) {} }
    }
    function sfx(name, vol = 1, rate = 1) {
      if (!ctx || !loaded) return;
      const b = buf[SFX_FILES[name]]; if (!b) return;
      const now = ctx.currentTime; if (now - (lastPlay[name] === undefined ? -9 : lastPlay[name]) < (name === 'hover' ? 0.08 : 0.035)) return;
      lastPlay[name] = now;
      const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 0.06);
      const g = ctx.createGain(); g.gain.value = vol; src.connect(g); g.connect(sfxBus); src.start(0);
    }
    function music(key, opts = {}) {
      wantTrack = key; wantOpts = opts;
      if (!ctx || !loaded) return;
      if (cur && cur.key === key && cur.alive) return;
      const b = buf[MUSIC_FILES[key]]; if (!b) return;
      const fade = opts.fade === undefined ? 0.8 : opts.fade, t = ctx.currentTime;
      if (cur) { const o = cur; o.alive = false; o.gain.gain.cancelScheduledValues(t); o.gain.gain.setValueAtTime(o.gain.gain.value, t); o.gain.gain.linearRampToValueAtTime(0, t + fade); try { o.src.stop(t + fade + 0.05); } catch (e) {} }
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = opts.loop !== false;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade);
      src.connect(g); g.connect(musicBus); src.start(t);
      const me = cur = { key, src, gain: g, alive: true };
      if (!src.loop) src.onended = () => { if (cur === me) { cur = null; if (opts.then) music(opts.then); } };
    }
    return {
      unlock, sfx, music,
      duck(on) { ducked = on; applyVolumes(0.15); },
      adMute(on) { adMuted = on; applyVolumes(0.02); },
      setMusic(v) { save.audio.music = clamp01(v); persist(); applyVolumes(0.03); },
      setSfx(v) { save.audio.sfx = clamp01(v); persist(); applyVolumes(0.03); },
      setMuted(m) { save.audio.muted = !!m; persist(); applyVolumes(0.03); },
      suspend() { if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} } },
      resume() { if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } },
      get ready() { return loaded; },
    };
  })();
  const sfx = (n, v, r) => Snd.sfx(n, v, r);
  ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, () => Snd.unlock(), { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) Snd.suspend(); else Snd.resume(); });
  // a click sound on every menu button (not the on-screen game controls), and a soft tick when the mouse moves over one
  let lastHoverBtn = null;
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('button');
    if (!b || b.disabled || b.closest('.touch') || b.id === 'pauseBtn') return;
    sfx(b.classList.contains('primary') ? 'press' : 'click');
  }, true);
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target && e.target.closest && e.target.closest('button');
    if (!b || b.disabled || b === lastHoverBtn || b.closest('.touch')) { if (!b) lastHoverBtn = null; return; }
    lastHoverBtn = b; sfx('hover', 0.45);
  });

  // ================= portal: Poki / CrazyGames + ads =================
  // window.__PORTAL is set by each build ('poki' or 'crazygames'); with neither, ads are simulated so the flow can be tried
  const PORTAL = window.__PORTAL || 'demo';
  const DEMO_MID_MS = window.__DEMO_MID_MS || 1800, DEMO_REWARD_MS = window.__DEMO_REWARD_MS || 3500;
  let adBusy = false;
  function demoAd(ms, rewardedAd) {
    return new Promise(res => {
      const ov = $('adOverlay');
      $('adTitle').textContent = rewardedAd ? 'Demo reward ad' : 'Demo ad break';
      $('adText').textContent = 'A simulated ad. On Poki or CrazyGames a real video plays here.';
      $('adSkip').hidden = !rewardedAd; ov.classList.remove('ghost'); ov.hidden = false;
      const t0 = Date.now();
      const tick = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); $('adBar').style.width = (k * 100) + '%'; if (k >= 1) end(true); }, 40);
      function end(ok) { clearInterval(tick); ov.hidden = true; $('adSkip').onclick = null; $('adBar').style.width = '0'; res(ok); }
      $('adSkip').onclick = () => end(false);
    });
  }
  const Portal = (() => {
    const pokiSdk = () => window.PokiSDK || null, cgSdk = () => (window.CrazyGames && window.CrazyGames.SDK) || null;
    let pokiReady = null, cgReady = null, accountP = null;
    function init() {
      if (PORTAL === 'poki' && pokiSdk() && typeof pokiSdk().init === 'function') { try { pokiReady = window.__POKI_INIT || Promise.resolve(pokiSdk().init()).then(() => true, () => true); } catch (e) { pokiReady = Promise.resolve(true); } }
      if (PORTAL === 'crazygames' && cgSdk() && typeof cgSdk().init === 'function') { try { cgReady = window.__CG_INIT || Promise.resolve(cgSdk().init()).then(() => true, () => false); } catch (e) { cgReady = Promise.resolve(false); } }
    }
    const poki = fn => { if (pokiReady) pokiReady.then(() => { try { fn(pokiSdk()); } catch (e) {} }); };
    const cg = fn => { if (cgReady) cgReady.then(ok => { if (ok) { try { fn(cgSdk()); } catch (e) {} } }); };
    init();
    return {
      name: PORTAL,
      loadingStart() { if (PORTAL === 'crazygames') cg(sdk => sdk.game.loadingStart()); },
      loadingFinished() { if (PORTAL === 'poki') poki(sdk => sdk.gameLoadingFinished()); else if (PORTAL === 'crazygames') cg(sdk => sdk.game.loadingStop()); },
      gameplayStart() { if (PORTAL === 'poki') poki(sdk => sdk.gameplayStart()); else if (PORTAL === 'crazygames') cg(sdk => sdk.game.gameplayStart()); },
      gameplayStop() { if (PORTAL === 'poki') poki(sdk => sdk.gameplayStop()); else if (PORTAL === 'crazygames') cg(sdk => sdk.game.gameplayStop()); },
      // who is playing? 'poki:name' / 'cg:name' when signed in, null for a guest, undefined if the portal didn't answer in time
      account() {
        if (!accountP) accountP = new Promise(resolve => {
          const t = setTimeout(() => resolve(undefined), 2500), done = id => { clearTimeout(t); resolve(id); };
          if (PORTAL === 'poki' && pokiReady) pokiReady.then(() => { try { Promise.resolve(pokiSdk().getUser()).then(u => done(u && u.username ? 'poki:' + u.username : null), () => done(null)); } catch (e) { done(null); } });
          else if (PORTAL === 'crazygames' && cgReady) cgReady.then(ok => {
            if (!ok) return done(null);
            try {
              const usr = cgSdk().user;
              if (!usr || usr.isUserAccountAvailable === false) return done(null);
              Promise.resolve(usr.getUser()).then(u => done(u && u.username ? 'cg:' + u.username : null), () => done(null));
              if (typeof usr.addAuthListener === 'function') usr.addAuthListener(u => { currentAccount = u && u.username ? 'cg:' + u.username : null; if (applyAccount(currentAccount)) reloadGame(); }); // somebody signed in or out
            } catch (e) { done(null); }
          });
          else done(null);
        });
        return accountP;
      },
      rewardedAvailable() { return PORTAL === 'demo' || (PORTAL === 'poki' && !!pokiReady) || (PORTAL === 'crazygames' && !!cgReady); },
      // a full-screen ad at a natural break. Always resolves (even with no ad or an ad blocker) so the game never gets stuck
      midgame() {
        return new Promise(resolve => {
          let done = false; const end = () => { if (done) return; done = true; clearTimeout(safety); Snd.adMute(false); resolve(); };
          const safety = setTimeout(end, 60000);
          if (PORTAL === 'poki' && pokiReady) pokiReady.then(() => { try { Promise.resolve(pokiSdk().commercialBreak(() => Snd.adMute(true))).then(end, end); } catch (e) { end(); } });
          else if (PORTAL === 'crazygames' && cgReady) cgReady.then(ok => { if (!ok || !cgSdk().ad) return end(); try { cgSdk().ad.requestAd('midgame', { adStarted: () => Snd.adMute(true), adFinished: end, adError: end }); } catch (e) { end(); } });
          else if (PORTAL === 'demo') demoAd(DEMO_MID_MS, false).then(end);
          else end();
        });
      },
      // an ad the player chose to watch. Resolves true only once the ad has finished, so the reward is given after it ends
      rewarded() {
        return new Promise(resolve => {
          let done = false; const end = ok => { if (done) return; done = true; clearTimeout(safety); Snd.adMute(false); resolve(!!ok); };
          const safety = setTimeout(() => end(false), 120000);
          if (PORTAL === 'poki' && pokiReady) pokiReady.then(() => { try { Promise.resolve(pokiSdk().rewardedBreak({ size: 'medium', onStart: () => Snd.adMute(true) })).then(ok => end(ok), () => end(false)); } catch (e) { end(false); } });
          else if (PORTAL === 'crazygames' && cgReady) cgReady.then(ok => { if (!ok || !cgSdk().ad) return end(false); try { cgSdk().ad.requestAd('rewarded', { adStarted: () => Snd.adMute(true), adFinished: () => end(true), adError: () => end(false) }); } catch (e) { end(false); } });
          else if (PORTAL === 'demo') demoAd(DEMO_REWARD_MS, true).then(end);
          else end(false);
        });
      },
    };
  })();
  Portal.loadingStart();
  // an ad after every run: when the player taps Run again or Main menu on the results screen. The portal decides whether each break shows an ad
  function afterRun(next) {
    if (adBusy) return;
    if (!save.tutorialDone || tut) { next(); return; }
    adBusy = true;
    const ov = $('adOverlay'); let wait = null;
    if (PORTAL !== 'demo') { $('adTitle').textContent = 'Ad break'; $('adText').textContent = 'Loading…'; $('adSkip').hidden = true; ov.classList.add('ghost'); ov.hidden = false; wait = setTimeout(() => ov.classList.remove('ghost'), 500); }
    Portal.midgame().then(() => { clearTimeout(wait); ov.hidden = true; ov.classList.remove('ghost'); adBusy = false; next(); });
  }
  // a "watch an ad for a reward" popup, every few runs: coins most of the time, sometimes a free Lucky Spin
  const AD_COINS = 3000, AD_EVERY_RUNS = window.__AD_EVERY_RUNS || 3, AD_MIN_GAP_MS = window.__AD_GAP_MS === undefined ? 120000 : window.__AD_GAP_MS;
  const adOffer = { runs: 0, last: 0, reward: null, claimed: false };
  function maybeOfferReward() {
    adOffer.runs++;
    if (!save.tutorialDone || tut || !Portal.rewardedAvailable()) return;
    if (adOffer.runs < AD_EVERY_RUNS || Date.now() - adOffer.last < AD_MIN_GAP_MS) return;
    setTimeout(() => { if (state === 'over' && !adBusy && $('rewardPop').hidden) showRewardPop(); }, 1400);
  }
  function showRewardPop() {
    adOffer.runs = 0; adOffer.last = Date.now(); adOffer.claimed = false;
    const r = adOffer.reward = Math.random() < 0.7 ? { kind: 'coins', amt: AD_COINS } : { kind: 'lucky', amt: 1 };
    const big = $('rewardBig'); big.innerHTML = '';
    if (r.kind === 'coins') { const c = document.createElement('span'); c.className = 'coin-ico'; big.append(c, document.createTextNode('+' + fmt(r.amt) + ' coins')); }
    else big.textContent = '1 free Lucky Spin';
    $('rewardText').textContent = 'Watch a short ad to claim it. It only plays if you tap the button.';
    $('rewardStatus').textContent = '';
    $('rewardWatch').hidden = false; $('rewardWatch').disabled = false; $('rewardNo').textContent = 'No thanks'; $('rewardNo').disabled = false;
    $('rewardPop').hidden = false; $('rewardWatch').focus();
  }
  function grantAdReward(r) {
    if (r.kind === 'coins') save.coins += r.amt; else save.luckySpins = (save.luckySpins || 0) + r.amt;
    persist(); updateWallet(); sfx('coin');
  }
  $('rewardWatch').addEventListener('click', () => {
    if (adBusy || adOffer.claimed) return;
    adBusy = true; const r = adOffer.reward;
    $('rewardWatch').disabled = true; $('rewardNo').disabled = true; $('rewardStatus').textContent = 'Loading ad…';
    Portal.rewarded().then(ok => {
      adBusy = false; $('rewardNo').disabled = false;
      if (ok && !adOffer.claimed) { // the ad finished: now give the reward
        adOffer.claimed = true; grantAdReward(r);
        $('rewardStatus').textContent = r.kind === 'coins' ? 'Thanks! +' + fmt(r.amt) + ' coins added.' : 'Thanks! A Lucky Spin was added. Use it on the Spin screen.';
        $('rewardWatch').hidden = true; $('rewardNo').textContent = 'Close';
      } else {
        $('rewardStatus').textContent = 'No ad was available, so no reward this time. Try again later.';
        $('rewardWatch').disabled = false;
      }
    });
  });
  $('rewardNo').addEventListener('click', () => { if (!adBusy) $('rewardPop').hidden = true; });
  // keep the page from scrolling or jumping when playing inside a portal page
  addEventListener('keydown', ev => {
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code) || (ev.code === 'Space' && tag !== 'BUTTON')) ev.preventDefault();
  }, { passive: false });
  addEventListener('wheel', ev => { if (!(ev.target && ev.target.closest && ev.target.closest('.list, .panel, .card'))) ev.preventDefault(); }, { passive: false });
  addEventListener('contextmenu', ev => { if (!(ev.target && ev.target.tagName === 'INPUT')) ev.preventDefault(); });
  // tell the portal when real gameplay starts and stops, and pick the music for each screen
  let lastSyncState = null, gpActive = false;
  function syncState() {
    if (state === lastSyncState) return;
    lastSyncState = state;
    const playing = state === 'play';
    if (playing !== gpActive) { gpActive = playing; if (playing) Portal.gameplayStart(); else Portal.gameplayStop(); }
    Snd.duck(state === 'pause');
    if (state === 'over') return; // showOver chooses the music for the results screen
    Snd.music(['countdown', 'play', 'pause', 'tutpause', 'dying', 'falling'].includes(state) ? 'game' : (state === 'shop' || state === 'gacha') ? 'shop' : 'menu');
  }

  // ================= tuning =================
  const TRACK_HALF = 4;
  const BODY_H = 2.0;
  // 17 sizes: 0 = quark, 1 = atomic, 2-3 = tiny, 10 = normal, 11 = big, 12 = giant,
  // then the mega stages: 13 = colossal, 14 = skyscraper, 15 = earthquake, 16 = otherworldly
  const S = [0.02, 0.05, 0.13, 0.2, 0.3, 0.4, 0.5, 0.62, 0.75, 0.88, 1.0, 1.18, 1.36, 2.4, 4, 6.5, 10];
  const START_LEVEL = 10, MAX_LEVEL = 16, ATOMIC = 1, MEGA = 13; // 0..ATOMIC = atomic realm, MEGA.. = mega stages
  const MULT = [8, 7, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 1, 1.5, 2, 3];
  const JUMP_H = [0.12, 0.2, 1.2, 1.3, 1.45, 1.55, 1.65, 1.78, 1.9, 2.0, 2.1, 2.6, 3.45, 5, 8, 13, 20]; // only giants clear a gate wall
  const SIZE_NAMES = { 11: 'Big', 12: 'Giant', 13: 'Colossal', 14: 'Skyscraper', 15: 'Earthquake', 16: 'Otherworldly' };
  const megaK = (lvl = player ? player.level : START_LEVEL) => lvl >= MEGA ? S[lvl] / S[MEGA - 1] : 1;
  const COINS_PER_POINT = 0.4;                                          // 80 coins per 200 points
  const TUNNEL_FIT = [4, 5, 6, 7];                                      // size each wall-tunnel height is built for
  const BOX_HOLE = [0.3, 0.45];                                         // crate tunnels: fit tiny sizes and smaller
  const GATE_TOP = 3.1;
  const GATE_CLEAR = [1.05, 1.28, 1.52, 1.76];                          // fits sizes 4, 5, 6, 7 and smaller
  const TUNNEL_CLEAR = [0.66, 0.86, 1.05, 1.28];                        // fits sizes 2, 3, 4, 5 and smaller
  const WALL_H = 3.7;
  const SPAWN_Z = -120;
  const GRAV = 30;
  const heightAt = lvl => BODY_H * S[lvl] * 0.95;

  // ================= DOM =================
  const wrap = $('wrap'), canvas = $('c');
  const screens = { title: $('titleScreen'), avatars: $('avatarScreen'), shop: $('shopScreen'), gacha: $('gachaScreen'), quests: $('questScreen'), settings: $('settingsScreen'), players: $('playersScreen') };
  const pausedEl = $('paused'), overEl = $('over'), hudEl = $('hud'), toastEl = $('toast');
  const sizeEl = $('size');
  const dots = S.map((s, i) => {
    const d = document.createElement('span');
    d.style.height = Math.round(8 + Math.min(s, 1.9) * 16) + 'px';
    if (i > START_LEVEL) d.classList.add('big');
    if (i <= ATOMIC) d.classList.add('atomic');
    if (i >= MEGA) d.classList.add('mega');
    sizeEl.appendChild(d);
    return d;
  });
  const multEl = document.createElement('span');
  multEl.className = 'mult';
  sizeEl.appendChild(multEl);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ================= three setup =================
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa });
  renderer.setPixelRatio(Q.pr());
  // sharper textures at glancing angles (the track, cliffs and buildings seen edge-on)
  const ANISO = Math.min(Q.aniso, renderer.capabilities.getMaxAnisotropy());
  try { const BaseCT = THREE.CanvasTexture; THREE.CanvasTexture = class extends BaseCT { constructor(...a) { super(...a); this.anisotropy = ANISO; } }; } catch (e) {}
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 45, 118);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.02, 1400);
  const hemi = new THREE.HemisphereLight(0xfff6e0, 0x8a5a3a, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.75);
  sunLight.position.set(-5, 10, 6);
  scene.add(sunLight);
  const rim = new THREE.DirectionalLight(0xffe0b0, 0.35);
  rim.position.set(4, 3, -8);
  scene.add(rim);
  const lambert = c => new THREE.MeshLambertMaterial({ color: c });

  // sky gradient
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 512;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  scene.background = skyTex;
  // sun glow
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 128;
  (() => {
    const g = sunCanvas.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.22, 'rgba(255,255,255,1)');
    rg.addColorStop(0.3, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  })();
  const glowTex = new THREE.CanvasTexture(sunCanvas);
  const glowMats = {};
  function glow(color, size, opacity = 0.9) {
    const key = color + '|' + opacity;
    if (!glowMats[key]) glowMats[key] = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
    const sp = new THREE.Sprite(glowMats[key]);
    sp.scale.set(size, size, 1);
    return sp;
  }
  // ---------- Photon's lightspeed: bright light streaks sweeping in from both sides and crossing around you, plus twinkling sparkles ----------
  const sparkleTex = (() => { // a four-point star with a soft glow, the classic sparkle shape
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,255,255,0.75)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    for (const [w, h] of [[3, 30], [30, 3]]) { // the long cross rays
      const lg = g.createLinearGradient(32 - w, 32 - h, 32 + w, 32 + h);
      g.save(); g.translate(32, 32);
      const r2 = g.createRadialGradient(0, 0, 0, 0, 0, 31); r2.addColorStop(0, 'rgba(255,255,255,1)'); r2.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r2; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, 7); g.fill(); g.restore();
    }
    return new THREE.CanvasTexture(c);
  })();
  const lsGroup = new THREE.Group(); scene.add(lsGroup);
  const LS_COLS = [0xFFFFFF, 0xFFF4C0, 0xFFE07A, 0xBFF6FF, 0xFFFFFF];
  const lsStreakGeo = new THREE.BoxGeometry(1, 1, 1);
  const lsStreaks = [], lsSparks = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(lsStreakGeo, new THREE.MeshBasicMaterial({ color: LS_COLS[i % LS_COLS.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; lsGroup.add(m); lsStreaks.push({ m, alive: false });
  }
  for (let i = 0; i < 90; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTex, color: LS_COLS[i % LS_COLS.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.visible = false; lsGroup.add(sp); lsSparks.push({ sp, life: 0 });
  }
  let lsK = 0, lsSparkAcc = 0;
  function resetStreak(q, s) {
    const side = Math.random() < 0.5 ? -1 : 1;
    q.off = side * (0.8 + Math.random() * 3.4) * s;           // starts out to one side of you
    q.y = (0.15 + Math.random() * 2.4) * s;
    q.z0 = q.z = -(18 + Math.random() * 40) * s;
    q.zc = (-4 + Math.random() * 5) * s;                      // where it crosses your line, just around you
    q.len = (5 + Math.random() * 9) * s; q.th = (0.03 + Math.random() * 0.05) * s;
    q.bright = 0.65 + Math.random() * 0.35;
    q.m.scale.set(q.th, q.th, q.len); q.alive = true; q.m.visible = true;
  }
  // speed lines on the screen itself: streaks pour out from the centre toward the edges, like wind rushing over the camera
  const slCanvas = document.getElementById('speedlines'), slCtx = slCanvas.getContext('2d');
  const speedLines = [];
  function drawSpeedLines(dt, k) {
    const r = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (slCanvas.width !== W || slCanvas.height !== H) { slCanvas.width = W; slCanvas.height = H; }
    slCtx.clearRect(0, 0, W, H);
    if (k < 0.02) { speedLines.length = 0; return; }
    const cx = W / 2, cy = H * 0.52, R = Math.hypot(W, H) * 0.55;
    // keep a steady stream of fresh lines
    const want = Math.round(90 * k);
    while (speedLines.length < want) {
      speedLines.push({ a: Math.random() * Math.PI * 2, r: 0.28 + Math.random() * 0.4, sp: 1.6 + Math.random() * 2.2, len: 0.12 + Math.random() * 0.22,
        w: (1.5 + Math.random() * 4) * dpr, col: Math.random() < 0.6 ? '255,255,255' : Math.random() < 0.5 ? '255,236,170' : '200,245,255' });
    }
    slCtx.globalCompositeOperation = 'lighter';
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const l = speedLines[i];
      l.r += l.sp * dt;                                   // rushing outward, off the face of the screen
      if (l.r > 1.25) { speedLines.splice(i, 1); continue; }
      const r0 = l.r * R, r1 = (l.r + l.len * (0.6 + l.r)) * R; // lines stretch as they near the edge
      const ca = Math.cos(l.a), sa = Math.sin(l.a), na = -sa, nb = ca;
      const fade = Math.min(1, (l.r - 0.28) * 4) * Math.min(1, (1.25 - l.r) * 3) * k;
      const w0 = l.w * 0.15, w1 = l.w * (0.5 + l.r);      // thin near the centre, wider at the edge: a wedge into the wind
      const g = slCtx.createLinearGradient(cx + ca * r0, cy + sa * r0, cx + ca * r1, cy + sa * r1);
      g.addColorStop(0, `rgba(${l.col},0)`); g.addColorStop(0.5, `rgba(${l.col},${0.85 * fade})`); g.addColorStop(1, `rgba(${l.col},${0.35 * fade})`);
      slCtx.fillStyle = g;
      slCtx.beginPath();
      slCtx.moveTo(cx + ca * r0 + na * w0, cy + sa * r0 + nb * w0);
      slCtx.lineTo(cx + ca * r1 + na * w1, cy + sa * r1 + nb * w1);
      slCtx.lineTo(cx + ca * r1 - na * w1, cy + sa * r1 - nb * w1);
      slCtx.lineTo(cx + ca * r0 - na * w0, cy + sa * r0 - nb * w0);
      slCtx.closePath(); slCtx.fill();
    }
    slCtx.globalCompositeOperation = 'source-over';
  }
  function clearLightspeedFX() {
    speedLines.length = 0; slCtx.clearRect(0, 0, slCanvas.width, slCanvas.height);
    lsK = 0; wrap.classList.remove('lightspeed');
    for (const q of lsStreaks) { q.alive = false; q.m.visible = false; }
    for (const q of lsSparks) { q.life = 0; q.sp.visible = false; }
  }
  function updateLightspeedFX(dt, active, dz) {
    lsK = lerp(lsK, active ? 1 : 0, Math.min(1, dt * (active ? 8 : 4)));
    wrap.classList.toggle('lightspeed', lsK > 0.04);
    const p = player; if (!p) return;
    const s = Math.max(0.15, p.s), on = lsK > 0.02, camZ = camera.position.z;
    for (const q of lsStreaks) { q.alive = false; q.m.visible = false; } // (old world-space streaks, now unused)
    drawSpeedLines(dt, lsK);
    if (on) { // a steady shower of fresh sparkles all around you
      lsSparkAcc += dt * 110 * lsK;
      while (lsSparkAcc >= 1) {
        lsSparkAcc -= 1;
        const q = lsSparks.find(x => x.life <= 0); if (!q) break;
        q.max = q.life = 0.35 + Math.random() * 0.5; q.size = (0.25 + Math.random() * 0.55) * s;
        q.sp.position.set(p.x + (Math.random() - 0.5) * 3.2 * s, p.y + Math.random() * 2.8 * s, (Math.random() - 0.6) * 3.5 * s);
        q.sp.material.rotation = Math.random() * 6.3; q.spin = (Math.random() - 0.5) * 6; q.sp.visible = true;
      }
    }
    for (const q of lsSparks) {
      if (q.life <= 0) continue;
      q.life -= dt;
      const f = Math.max(0, q.life / q.max), tw = Math.sin(f * Math.PI); // swells in, then twinkles out
      q.sp.position.z += (dz || 0) * 0.6;
      q.sp.scale.setScalar(q.size * (0.3 + tw));
      q.sp.material.rotation += q.spin * dt;
      q.sp.material.opacity = Math.min(1, lsK * 1.4) * tw;
      if (q.life <= 0) q.sp.visible = false;
    }
  }
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, fog: false, depthWrite: false, transparent: true }));
  sun.scale.set(60, 60, 1);
  sun.position.set(-14, 8, -210);
  scene.add(sun);

  // track
  const trackCanvas = document.createElement('canvas');
  trackCanvas.width = 256; trackCanvas.height = 256;
  const trackTex = new THREE.CanvasTexture(trackCanvas);
  trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
  trackTex.repeat.set(1, 24);
  trackTex.anisotropy = ANISO;
  const TRACK_LEN = 240;
  const track = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF * 2, TRACK_LEN), new THREE.MeshLambertMaterial({ map: trackTex }));
  track.rotation.x = -Math.PI / 2;
  track.position.z = 20 - TRACK_LEN / 2;
  scene.add(track);
  const sideMat = lambert(0xffffff);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF * 2, 0.9, TRACK_LEN), sideMat);
  slab.position.set(0, -0.46, 20 - TRACK_LEN / 2);
  scene.add(slab);

  function drawTrack(m) {
    const N = 256, g = trackCanvas.getContext('2d');
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.globalAlpha = 1; g.shadowBlur = 0;
    g.fillStyle = m.track; g.fillRect(0, 0, N, N);
    if (m.surface === 'grass') {
      g.globalAlpha = 0.14; g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N / 2); // mowed stripes
      g.lineWidth = 1.6;
      for (let i = 0; i < 1100; i++) {
        const x = rnd() * N, y = rnd() * N, l = 3 + rnd() * 6;
        g.globalAlpha = 0.85; g.strokeStyle = rnd() < 0.5 ? m.line : '#3E8E2A';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); g.stroke();
      }
      g.globalAlpha = 0.8; g.fillStyle = '#FFF4B0';
      for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(24 + rnd() * (N - 48), rnd() * N, 2.4, 0, 7); g.fill(); }
    } else if (m.surface === 'sand') {
      for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.28; g.fillStyle = rnd() < 0.5 ? '#ffffff' : '#9A6A35'; g.fillRect(rnd() * N, rnd() * N, 1.6, 1.6); }
      g.globalAlpha = 0.55; g.strokeStyle = m.line; g.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        for (let x = 0; x <= N; x += 4) g.lineTo(x, k * N / 6 + 20 + Math.sin(x / N * Math.PI * 4 + k) * 7);
        g.stroke();
      }
    } else if (m.surface === 'ice') {
      const lg = g.createLinearGradient(0, 0, N, N);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.5)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(0, 0, N, N);
      g.globalAlpha = 0.6; g.strokeStyle = '#7FB8DA'; g.lineWidth = 1.2;
      for (let c = 0; c < 10; c++) {
        let x = rnd() * N, y = rnd() * N;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 0.75; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const x = rnd() * N, y = rnd() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y - 26); g.stroke(); }
    } else if (m.surface === 'mud') {
      for (let i = 0; i < 44; i++) {
        g.globalAlpha = 0.35; g.fillStyle = rnd() < 0.5 ? '#4E3823' : m.line;
        g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 6 + rnd() * 16, 4 + rnd() * 8, rnd() * 3, 0, 7); g.fill();
      }
      for (let i = 0; i < 6; i++) {
        const x = 30 + rnd() * (N - 60), y = rnd() * N, rx = 14 + rnd() * 16;
        g.globalAlpha = 0.85; g.fillStyle = '#7C8DA3'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.5, 0, 0, 7); g.fill();
        g.globalAlpha = 0.6; g.fillStyle = '#D5DEEA'; g.beginPath(); g.ellipse(x - rx * 0.3, y - rx * 0.15, rx * 0.35, rx * 0.12, 0, 0, 7); g.fill();
      }
    } else if (m.surface === 'leaves') {
      g.lineWidth = 1.5;
      for (let i = 0; i < 600; i++) { const x = rnd() * N, y = rnd() * N; g.globalAlpha = 0.6; g.strokeStyle = rnd() < 0.5 ? '#6E8A2E' : '#A3B04A'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4); g.stroke(); }
      const lc = ['#E67E22', '#C0392B', '#F1C40F', '#D35400'];
      for (let i = 0; i < 70; i++) { g.globalAlpha = 0.9; g.fillStyle = lc[i % 4]; g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 5, 2.6, rnd() * 3, 0, 7); g.fill(); }
    } else if (m.surface === 'rainbow') {
      const rc = ['#FF4D4D', '#FF9F1C', '#FFE14D', '#4DDB6A', '#3DA5FF', '#8F5CFF'];
      const bw = (N - 32) / rc.length;
      rc.forEach((c, k) => { g.globalAlpha = 0.95; g.fillStyle = c; g.fillRect(16 + k * bw, 0, bw, N); });
      g.globalAlpha = 0.35; g.fillStyle = '#FFFFFF';
      for (let y = 0; y < N; y += 32) g.fillRect(16, y, N - 32, 4);
    } else if (m.surface === 'cloud') {
      for (let i = 0; i < 60; i++) {
        const x = rnd() * N, y = rnd() * N, r = 10 + rnd() * 22;
        g.globalAlpha = 0.22; g.fillStyle = '#B9C6FF'; g.beginPath(); g.arc(x + 4, y + 5, r, 0, 7); g.fill();
        g.globalAlpha = 0.9; g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    } else if (m.surface === 'coral') {
      for (let i = 0; i < 1800; i++) { g.globalAlpha = 0.25; g.fillStyle = rnd() < 0.5 ? '#FFFFFF' : '#A88550'; g.fillRect(rnd() * N, rnd() * N, 1.6, 1.6); }
      const cols = ['#FF6F91', '#FFA552', '#B57BFF', '#4FD1C5'];
      for (let i = 0; i < 26; i++) {
        const x = 24 + rnd() * (N - 48), y = rnd() * N, c = cols[i % 4];
        g.globalAlpha = 0.95; g.strokeStyle = c; g.lineWidth = 3;
        for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 16, y - 6 - rnd() * 10); g.stroke(); }
      }
    } else if (m.surface === 'cobble') {
      g.strokeStyle = m.line; g.lineWidth = 3; g.globalAlpha = 1;
      for (let row = 0; row < 8; row++) for (let col = -1; col < 8; col++) {
        const x = col * 32 + (row % 2) * 16, y = row * 32;
        g.fillStyle = rnd() < 0.5 ? '#54496E' : '#433A5A';
        g.beginPath(); g.ellipse(x + 16, y + 16, 14, 13, 0, 0, 7); g.fill(); g.stroke();
      }
      g.globalAlpha = 0.55; g.fillStyle = '#6FAF7A';
      for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd() * N, rnd() * N, 2 + rnd() * 3, 0, 7); g.fill(); }
    } else if (m.surface === 'lava') {
      for (let i = 0; i < 40; i++) { g.globalAlpha = 0.5; g.fillStyle = rnd() < 0.5 ? '#1A1414' : '#3A2C2A'; g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 8 + rnd() * 18, 6 + rnd() * 10, rnd() * 3, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.strokeStyle = '#FF7A1F'; g.lineWidth = 2.5; g.shadowColor = '#FF5A1F'; g.shadowBlur = 10;
      for (let c = 0; c < 9; c++) {
        let x = rnd() * N, y = rnd() * N;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
    } else if (m.surface === 'grid') {
      g.strokeStyle = m.line; g.lineWidth = 3; g.shadowColor = m.line; g.shadowBlur = 10;
      for (let q = 0; q <= N; q += 64) { g.beginPath(); g.moveTo(q, 0); g.lineTo(q, N); g.stroke(); g.beginPath(); g.moveTo(0, q); g.lineTo(N, q); g.stroke(); }
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
    g.fillStyle = m.curbA; g.fillRect(0, 0, 16, N / 2); g.fillRect(N - 16, 0, 16, N / 2);
    g.fillStyle = m.curbB; g.fillRect(0, N / 2, 16, N / 2); g.fillRect(N - 16, N / 2, 16, N / 2);
    trackTex.needsUpdate = true;
  }
  function drawSky(m) {
    const g = skyCanvas.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 512);
    for (const [t, c] of m.sky) lg.addColorStop(t, c);
    g.fillStyle = lg; g.fillRect(0, 0, 4, 512);
    skyTex.needsUpdate = true;
  }

  // clouds
  const cloudTex = (() => { // soft, wispy cloud sprite
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = 50 + Math.random() * 156, y = 90 + Math.random() * 70 - (Math.abs(x - 128) / 128) * 30, r = 26 + Math.random() * 44;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.32)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const shade = g.createLinearGradient(0, 70, 0, 200); // slightly darker undersides
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(70,80,110,0.18)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = shade; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.95 });
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 2; j++) {
      const sp = new THREE.Sprite(cloudMat), w = 26 + Math.random() * 30;
      sp.scale.set(w, w * 0.5, 1); sp.position.set(j * w * 0.45, Math.random() * 3, Math.random() * 4);
      g.add(sp);
    }
    const side = i % 2 ? 1 : -1;
    g.position.set(side * (40 + Math.random() * 120), 18 + Math.random() * 40, -380 + Math.random() * 400);
    scene.add(g);
    clouds.push(g);
  }

  // ---------- valley scenery: towering cliffs, far mountain ranges and bridge pylons ----------
  // everything reaches far below the track, so nothing looks like it is floating
  const DEEP = 320;
  const valley = new THREE.Group(); scene.add(valley);
  let valleyItems = [];
  const VALLEY = {
    grass:   { rock: '#7A6A58', cap: '#5DB33E', top: 'trees', far: '#8A9CC4', snow: true, forest: '#3F6B3A', leafCols: ['#3E7A2E', '#4F8F3A', '#2F6B2A', '#5E9E3E'], grassCols: ['#4E9A3A', '#6BB548', '#3E8A2E', '#7CC04E'], flowerCols: ['#FFFFFF', '#FFE14D', '#FF8FB8', '#B57BFF'], bark: '#5A3E28', conifers: true },
    leaves:  { rock: '#7A5A3E', cap: '#9A8A3A', top: 'trees', tree: '#D9772E', far: '#A493B5', forest: '#8A5A2A', leafCols: ['#D9772E', '#C0392B', '#E8A33A', '#B5651D', '#F1C40F'], grassCols: ['#8A9A3E', '#A3A04A', '#B58A3A', '#9A8A3A'], flowerCols: ['#E8A33A', '#C0392B', '#F1C40F'], bark: '#4A3020' },
    sand:    { rock: '#C2703D', cap: '#E3A15E', top: 'mesa', far: '#D29573' },
    ice:     { rock: '#A9D4F0', cap: '#F4FBFF', top: 'spire', far: '#BFDAF2', snow: true },
    mud:     { rock: '#4E4234', cap: '#5A6B3E', top: 'dead', far: '#717B90' },
    grid:    { rock: '#1A0F3A', cap: '#FF4FD8', top: 'neon', far: '#2B1660' },
    cloud:   { rock: '#F6F0FF', cap: '#FFFFFF', top: 'castle', far: '#C9B6EE', cloudy: true },
    coral:   { rock: '#2E8C8C', cap: '#FF6F91', top: 'coral', far: '#1F7590' },
    cobble:  { rock: '#3A3348', cap: '#4A5E44', top: 'spooky', far: '#3E3660' },
    lava:    { rock: '#241A1A', cap: '#FF5A1F', top: 'lava', far: '#3E1C16' },
    rainbow: { rock: '#2A1A5A', cap: '#FF7AD9', top: 'crystal', far: '#3A2470' },
  };
  // some maps share a track surface but deserve their own scenery
  const VALLEY_MAP = {
    blossom: { rock: '#8A7468', cap: '#8FCB72', top: 'trees', far: '#C9A6C9', forest: '#A87A9A', leafCols: ['#FFB7D2', '#FF9AC4', '#FFD1E3', '#F48FB1', '#FFFFFF'], grassCols: ['#7CC46A', '#93D07A', '#6AB45A', '#A8DA8A'], flowerCols: ['#FFFFFF', '#FFB7D2', '#FF9AC4'], bark: '#5E3A32' },
  };
  // procedural rock texture: smooth layered noise with soft strata, greyscale so each map can tint it
  // rock surface: many layers of noise down to fine grain, crisp fissures and soft strata.
  // High builds it at 1024 pixels with a matching normal map so light catches every bump and crack.
  const ROCK_N = QUALITY === 'high' ? 1024 : QUALITY === 'medium' ? 512 : 256;
  const ROCK_DENSITY = QUALITY === 'high' ? 3 : QUALITY === 'medium' ? 1.6 : 1; // how tightly the rock texture tiles: more = more pixels per metre
  let rockNormalTex = null;
  const rockCanvas = (() => {
    const N = ROCK_N, c = rawCanvas(); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    const mk = n => ({ n, v: Float32Array.from({ length: n * n }, Math.random) });
    const octs = [[4, 0.3], [8, 0.22], [16, 0.16], [32, 0.11], [64, 0.08], [128, 0.06], [256, 0.04], [512, 0.025]]
      .filter(([n]) => n <= N / 2).map(([n, w]) => Object.assign(mk(n), { w }));
    const wsum = octs.reduce((a, o) => a + o.w, 0), crackA = mk(9), crackB = mk(21);
    const smp = (o, x, y) => {
      const fx = x / N * o.n, fy = y / N * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, n = o.n, v = o.v;
      const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, xa = x0 % n, ya = y0 % n;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (v[ya * n + xa] * (1 - sx) + v[ya * n + x1] * sx) * (1 - sy) + (v[y1 * n + xa] * (1 - sx) + v[y1 * n + x1] * sx) * sy;
    };
    const Hh = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0; for (const o of octs) v += smp(o, x, y) * o.w; v /= wsum;
      const ridge = 1 - Math.abs(2 * (smp(crackA, x, y) * 0.65 + smp(crackB, x, y) * 0.35) - 1);
      const crack = Math.max(0, (ridge - 0.9) / 0.1), c2 = crack * crack;       // thin dark fissures
      const strata = Math.sin(y * (Math.PI * 2 * 9 / N) + v * 6) * 0.5 + 0.5;  // soft sediment layers
      Hh[y * N + x] = v - c2 * 0.3 + strata * 0.03;
      const grain = QUALITY === 'low' ? 0 : (Math.random() - 0.5) * 0.07;    // fine mineral grain
      const val = Math.max(0, Math.min(255, (0.6 + (v - 0.5) * 1.15 + (strata - 0.5) * 0.08 - c2 * 0.45 + grain) * 255));
      const k = (y * N + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = val; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (QUALITY !== 'low') { // a normal map from the same height field: real relief under the lighting
      const nc = rawCanvas(); nc.width = nc.height = N;
      const ng = nc.getContext('2d'), nimg = ng.createImageData(N, N), str = 5 * N / 256;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = (Hh[y * N + (x + 1) % N] - Hh[y * N + (x - 1 + N) % N]) * str, dy = (Hh[((y + 1) % N) * N + x] - Hh[((y - 1 + N) % N) * N + x]) * str;
        const l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
        nimg.data[k] = (-dx / l * 0.5 + 0.5) * 255; nimg.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; nimg.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; nimg.data[k + 3] = 255;
      }
      ng.putImageData(nimg, 0, 0);
      rockNormalTex = new THREE.CanvasTexture(nc); rockNormalTex.wrapS = rockNormalTex.wrapT = THREE.RepeatWrapping;
    }
    return c;
  })();
  function realMat(color, rx, ry, extra, density = ROCK_DENSITY) {
    const t = new THREE.CanvasTexture(rockCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx * density, ry * density);
    t.anisotropy = ANISO;
    const opts = { color, map: t, roughness: 0.95, metalness: 0 };
    if (rockNormalTex) { opts.normalMap = rockNormalTex; opts.normalScale = new THREE.Vector2(QUALITY === 'high' ? 1.25 : 0.8, QUALITY === 'high' ? 1.25 : 0.8); }
    return new THREE.MeshStandardMaterial(Object.assign(opts, extra || {}));
  }
  function sculpt(geo, amt, freq) { // smooth, natural bulges and grooves
    const pos = geo.attributes.position, v = new THREE.Vector3(), sd = Math.random() * 100;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = Math.atan2(v.z, v.x);
      const n = Math.sin(a * 3 + sd) * 0.45 + Math.sin(a * 6 - v.y * freq + sd) * 0.3 + Math.sin(v.y * freq * 0.6 + a * 2 + sd) * 0.35 + Math.sin(a * 13 + v.y * freq * 2.2) * 0.1;
      const k = 1 + n * amt;
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }
  // a realistic mountain: ridged slopes, a ragged snowline, darker rock lower down
  function mountain(Rb, H, apexY, rockCol, baseCol, snowy) {
    const geo = new THREE.ConeGeometry(Rb, H, 56, 48);
    const pos = geo.attributes.position, v = new THREE.Vector3(), sd = Math.random() * 50;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.y + H / 2) / H, a = Math.atan2(v.z, v.x);
      const ridge = Math.abs(Math.sin(a * 4 + sd)) * 0.32 + Math.sin(a * 9 + t * 8 + sd) * 0.12 + Math.sin(a * 21 - t * 15) * 0.05;
      const k = 1 + ridge * (0.5 + 0.5 * t);
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    geo.computeVertexNormals();
    const col = new Float32Array(pos.count * 3), c = new THREE.Color(), rc = new THREE.Color(rockCol), bc = new THREE.Color(baseCol), sn = new THREE.Color('#F2F5FA'), nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const wy = v.y + apexY - H / 2, a = Math.atan2(v.z, v.x);
      const line = apexY * (0.6 + Math.sin(a * 7 + sd) * 0.06);
      if (snowy && wy > line && Math.abs(nrm.getY(i)) > 0.25) c.copy(sn);
      else c.copy(rc).lerp(bc, Math.max(0, Math.min(1, (apexY * 0.5 - wy) / (apexY * 0.5 + 120))));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
    if (QUALITY !== 'low') {
      const t = new THREE.CanvasTexture(rockCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(18 * ROCK_DENSITY, Math.max(4, Math.round(H / 30)) * ROCK_DENSITY); t.anisotropy = ANISO;
      mmat.map = t; if (rockNormalTex) { mmat.normalMap = rockNormalTex; mmat.normalScale = new THREE.Vector2(0.9, 0.9); }
    }
    const m = new THREE.Mesh(geo, mmat);
    m.position.y = apexY - H / 2;
    return m;
  }
  const mistCanvas = (() => { // a soft sea of mist far below the bridge
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 20 + Math.random() * 50;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        const rg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    return c;
  })();
  let mistTexs = [], seabedTexs = [];
  // neon skyscraper facade: dark glass, a grid of glowing windows in neon colours, and bright neon bands between floors
  const neonFacadeCanvas = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#0A0618'; g.fillRect(0, 0, 64, 128);
    const lit = ['#22E1FF', '#FF4FD8', '#B06BFF', '#FFFFFF', '#7AF0FF'];
    for (let y = 2; y < 128; y += 8) for (let x = 2; x < 64; x += 8) {
      if (y % 32 > 26) continue;
      const on = Math.random() < 0.45;
      g.fillStyle = on ? lit[Math.floor(Math.random() * lit.length)] : 'rgba(60,40,110,0.55)';
      g.globalAlpha = on ? 0.55 + Math.random() * 0.45 : 1;
      g.fillRect(x, y, 5, 5);
    }
    g.globalAlpha = 1;
    for (let y = 28; y < 128; y += 32) { g.fillStyle = y % 64 === 28 ? '#FF4FD8' : '#22E1FF'; g.fillRect(0, y, 64, 3); }
    return c;
  })();
  function neonMat(rx, ry) {
    const t = new THREE.CanvasTexture(neonFacadeCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: t, emissive: '#FFFFFF', emissiveMap: t, emissiveIntensity: 0.95, roughness: 0.3, metalness: 0.5 });
  }
  // glowing magma cracks: branching veins that tile seamlessly down a tall rock face (used as the glow map)
  const magmaCrackCanvas = (() => {
    const W = 128, Hh = 256, c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const g = c.getContext('2d'); g.fillStyle = '#000000'; g.fillRect(0, 0, W, Hh);
    const paths = [];
    for (let k = 0; k < 3; k++) { // just a few clean cracks
      const x0 = Math.random() * W; let x = x0, y = -12; const pts = [[x, y]];
      while (y < Hh + 12) {
        y += 8 + Math.random() * 14; x += (Math.random() - 0.5) * 22; pts.push([x, y]);
        if (Math.random() < 0.07) { let bx = x, by = y; const br = [[bx, by]]; for (let j = 0; j < 4; j++) { by += 6 + Math.random() * 10; bx += (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 10); br.push([bx, by]); } paths.push({ pts: br, w: 1.4 }); }
      }
      const drift = pts[pts.length - 1][0] - x0, span = pts[pts.length - 1][1] - pts[0][1];
      for (const q of pts) q[0] -= drift * (q[1] - pts[0][1]) / span; // the crack ends where it began, so the tiles join up
      paths.push({ pts, w: 3 + Math.random() * 2 });
    }
    const stroke = (pts, w, col, blur) => {
      for (const ox of [-W, 0, W]) for (const oy of [-Hh, 0, Hh]) {
        g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy));
        g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = blur; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
      }
    };
    for (const p of paths) stroke(p.pts, p.w * 2.4, '#A8300A', 12); // deep red heat around each crack
    for (const p of paths) stroke(p.pts, p.w, '#FF7A22', 6);        // molten orange
    for (const p of paths) stroke(p.pts, Math.max(1, p.w * 0.4), '#FFE08A', 2); // white-hot core
    g.shadowBlur = 0;
    return c;
  })();
  let lavaFlowMats = [];
  // flowing lava: a bright molten core with dark cooling crust drifting down it, soft at the edges
  const lavaFlowTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(160,30,0,0)'); side.addColorStop(0.18, 'rgba(220,60,10,0.95)'); side.addColorStop(0.5, 'rgba(255,190,70,1)');
    side.addColorStop(0.82, 'rgba(220,60,10,0.95)'); side.addColorStop(1, 'rgba(160,30,0,0)');
    g.fillStyle = side; g.fillRect(0, 0, 64, 256);
    g.fillStyle = 'rgba(255,240,170,0.9)'; g.fillRect(28, 0, 8, 256); // white-hot core
    for (let i = 0; i < 22; i++) { // dark crust drifting down the flow (drawn twice so it tiles top to bottom)
      const x = 14 + Math.random() * 36, y = Math.random() * 256, w = 4 + Math.random() * 10, h = 10 + Math.random() * 30;
      for (const oy of [0, -256, 256]) { g.fillStyle = 'rgba(60,15,5,0.55)'; g.beginPath(); g.ellipse(x, y + oy, w / 2, h / 2, 0, 0, 7); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return t;
  })();
  const lavaFlowMat = new THREE.MeshBasicMaterial({ map: lavaFlowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // a stream of lava pouring out of a crack and down a rock face, until it disappears into the depths
  function lavaStream(g, x, z, yTop, len, w, faceAng) {
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(w, len), lavaFlowMat);
    s2.position.set(x, yTop - len / 2, z);
    s2.rotation.y = -faceAng + Math.PI / 2; // face outward from the rock
    g.add(s2);
    const src = glow(0xFF7A22, w * 4, 0.9); src.position.set(x, yTop, z); g.add(src); // the glowing crack it pours from
  }
  function crackedRock(rx, ry) { // dark basalt with magma glowing through the cracks
    const et = new THREE.CanvasTexture(magmaCrackCanvas); et.wrapS = et.wrapT = THREE.RepeatWrapping; et.repeat.set(rx, ry);
    const m = realMat('#2E2420', rx, ry, { emissive: '#FFFFFF', emissiveMap: et, emissiveIntensity: 1.2, roughness: 0.92 }, 1);
    m.userData.ph = Math.random() * 6; lavaFlowMats.push(m);
    return m;
  }
  const NEON_EDGE = ['#FF4FD8', '#22E1FF', '#B06BFF'];
  // a whole neon tower, glowing from the roof all the way down until it fades out of sight
  function buildNeonTower(g, roofY, w, dpt, R) {
    const Ht = roofY + DEEP;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, Ht, dpt), neonMat(Math.max(1, Math.round(w / 4)), Math.round(Ht / 8)));
    tower.position.y = roofY - Ht / 2; g.add(tower);
    const edgeCol = NEON_EDGE[Math.floor(R(0, NEON_EDGE.length))];
    const edgeM = new THREE.MeshStandardMaterial({ color: edgeCol, emissive: edgeCol, emissiveIntensity: 1.4 });
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // neon strips down every corner, top to bottom
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.35, Ht, 0.35), edgeM); e.position.set(ex * w / 2, roofY - Ht / 2, ez * dpt / 2); g.add(e);
    }
    for (const [ex, ez, sx, sz] of [[0, -1, w, 0.35], [0, 1, w, 0.35], [-1, 0, 0.35, dpt], [1, 0, 0.35, dpt]]) { // a glowing rim around the roof
      const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), edgeM); r.position.set(ex * w / 2, roofY, ez * dpt / 2); g.add(r);
    }
    const roofGlow = glow(new THREE.Color(edgeCol).getHex(), Math.max(w, dpt) * 1.6, 0.55); roofGlow.position.y = roofY + 1; g.add(roofGlow);
    if (R(0, 1) < 0.6) { // a neon sign on the roof
      const signCol = NEON_EDGE[Math.floor(R(0, NEON_EDGE.length))];
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, w * 0.22, 0.2), new THREE.MeshStandardMaterial({ color: signCol, emissive: signCol, emissiveIntensity: 1.6 }));
      sign.position.set(0, roofY + w * 0.2, -dpt * 0.3); g.add(sign);
    }
    if (R(0, 1) < 0.5) { // an antenna with a red beacon
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, w * 0.7, 8), new THREE.MeshStandardMaterial({ color: '#2A2440', metalness: 0.7, roughness: 0.3 }));
      ant.position.y = roofY + w * 0.35; g.add(ant);
      const bc = glow(0xFF3B3B, 2.6, 0.95); bc.position.y = roofY + w * 0.72; g.add(bc);
    }
  }
  // a cluster of real 3D coral: branching staghorn arms, flat fan coral, and round brain coral
  // bake a group of small meshes into one mesh per material, so big coral fields stay fast to draw
  function mergeGroup(g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), buckets = new Map();
    g.traverse(o => {
      if (!o.isMesh) return;
      const gm = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      gm.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(gm);
      o.geometry.dispose();
    });
    const out = new THREE.Group();
    for (const [mat, list] of buckets) {
      let n = 0; for (const gm of list) n += gm.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let at = 0;
      for (const gm of list) { pos.set(gm.attributes.position.array, at * 3); nor.set(gm.attributes.normal.array, at * 3); at += gm.attributes.position.count; gm.dispose(); }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.add(new THREE.Mesh(mg, mat));
    }
    return out;
  }
  // ---------- living clifftops: grass, trees, bushes, rocks, flowers and waterfalls ----------
  function grassTopTexture(cols, flowers) { // grass drawn blade by blade, with little flowers
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = cols[0]; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { g.globalAlpha = 0.25; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 30, 10 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); }
    g.lineWidth = 1.2; g.lineCap = 'round';
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, l = 3 + Math.random() * 5, lean = (Math.random() - 0.5) * 3;
      g.globalAlpha = 0.55 + Math.random() * 0.45; g.strokeStyle = cols[Math.floor(Math.random() * cols.length)];
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.4, y - l * 0.6, x + lean, y - l); g.stroke();
    }
    if (flowers) for (let i = 0; i < 90; i++) { g.globalAlpha = 1; g.fillStyle = flowers[i % flowers.length]; const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); g.fillStyle = '#FFE14D'; g.beginPath(); g.arc(x, y, 0.6, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const waterfallTex = (() => { // white water falling in streaks, soft at the sides
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d'), side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(190,225,255,0)'); side.addColorStop(0.2, 'rgba(200,232,255,0.75)'); side.addColorStop(0.5, 'rgba(235,248,255,0.9)'); side.addColorStop(0.8, 'rgba(200,232,255,0.75)'); side.addColorStop(1, 'rgba(190,225,255,0)');
    g.fillStyle = side; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 60; i++) { const x = 10 + Math.random() * 44, y = Math.random() * 256, h = 20 + Math.random() * 60; for (const oy of [0, -256, 256]) { g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.45})`; g.fillRect(x, y + oy, 1.5 + Math.random() * 2, h); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4);
    return t;
  })();
  const waterfallMat = new THREE.MeshBasicMaterial({ map: waterfallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  function greenMats(th) {
    const grassTex = grassTopTexture(th.grassCols, th.flowerCols); grassTex.repeat.set(3, 3);
    const leaf = th.leafCols.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    return {
      grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
      skirt: new THREE.MeshStandardMaterial({ color: th.grassCols[2], roughness: 1 }),
      leaf, bark: new THREE.MeshStandardMaterial({ color: th.bark, roughness: 1 }),
      pine: new THREE.MeshStandardMaterial({ color: '#2B5A2E', roughness: 0.9 }),
      stone: new THREE.MeshStandardMaterial({ color: '#8A8478', roughness: 0.95 }),
      flower: (th.flowerCols || ['#FFFFFF']).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
    };
  }
  function leafyTree(tmp, x, y, z, s, mats, R) {
    const trunkH = R(1.6, 2.4) * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.22 * s, trunkH, 8), mats.bark); trunk.position.set(x, y + trunkH / 2, z); tmp.add(trunk);
    for (let b = 0; b < 2; b++) { // a couple of limbs reaching out
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.09 * s, 0.9 * s, 6), mats.bark);
      const a = R(0, 6.3); br.position.set(x + Math.cos(a) * 0.25 * s, y + trunkH * 0.75, z + Math.sin(a) * 0.25 * s); br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); tmp.add(br);
    }
    const detail = Q.tex >= 3 ? 2 : 1, n = 5 + Math.floor(R(0, 3));
    for (let k = 0; k < n; k++) { // the crown: overlapping clumps of leaves in a few shades
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.55, 0.95) * s, detail), mats.leaf[Math.floor(R(0, mats.leaf.length))]);
      blob.position.set(x + R(-0.75, 0.75) * s, y + trunkH + R(-0.25, 0.9) * s, z + R(-0.75, 0.75) * s); blob.scale.y = 0.85; tmp.add(blob);
    }
  }
  function pineTree(tmp, x, y, z, s, mats) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.15 * s, 1.1 * s, 8), mats.bark); t.position.set(x, y + 0.55 * s, z); tmp.add(t);
    for (let l = 0; l < 4; l++) { const c1 = new THREE.Mesh(new THREE.ConeGeometry((1.05 - l * 0.22) * s, 1.3 * s, 14), mats.pine); c1.position.set(x, y + (1.2 + l * 0.6) * s, z); tmp.add(c1); }
  }
  function buildGreenTop(g, top, r, th, mats, R, side) {
    // a grassy edge hanging over the rock, then the textured lawn on top
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.9, 1.4, 40, 1, true), mats.skirt); skirt.position.y = top - 0.5; g.add(skirt);
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 48), mats.grass); lawn.rotation.x = -Math.PI / 2; lawn.position.y = top + 0.18; g.add(lawn);
    const tmp = new THREE.Group(), spot = (m2) => { const a = R(0, 6.3), d = Math.sqrt(R(0, 1)) * r * m2; return [Math.cos(a) * d, Math.sin(a) * d]; };
    const trees = 5 + Math.floor(R(0, 5));
    for (let k = 0; k < trees; k++) { const [x, z] = spot(0.72); if (th.conifers && R(0, 1) < 0.35) pineTree(tmp, x, top + 0.15, z, R(0.9, 1.6), mats); else leafyTree(tmp, x, top + 0.15, z, R(0.8, 1.5), mats, R); }
    for (let k = 0; k < 6; k++) { const [x, z] = spot(0.85); for (let b = 0; b < 3; b++) { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.25, 0.45), 1), mats.leaf[Math.floor(R(0, mats.leaf.length))]); bush.position.set(x + R(-0.3, 0.3), top + 0.3, z + R(-0.3, 0.3)); bush.scale.y = 0.7; tmp.add(bush); } }
    for (let k = 0; k < 4; k++) { const [x, z] = spot(0.9); const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.25, 0.7)), mats.stone); rock.position.set(x, top + 0.2, z); rock.rotation.set(R(0, 3), R(0, 3), 0); rock.scale.y = 0.6; tmp.add(rock); }
    for (let k = 0; k < 26; k++) { const [x, z] = spot(0.9); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mats.flower[k % mats.flower.length]); fl.position.set(x, top + 0.28, z); tmp.add(fl); }
    g.add(mergeGroup(tmp));
    if (R(0, 1) < 0.35) { // a waterfall spilling off the edge, facing the track
      const a = side > 0 ? Math.PI : 0, rad = r * 1.02 + 0.35, len = R(70, 110), w = R(1.4, 2.6);
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(w, len), waterfallMat);
      wf.position.set(Math.cos(a) * rad, top - len / 2 + 0.2, Math.sin(a) * rad); wf.rotation.y = -a + Math.PI / 2; g.add(wf);
      const spray = glow(0xEAF6FF, w * 3, 0.5); spray.position.set(Math.cos(a) * rad, top + 0.2, Math.sin(a) * rad); g.add(spray);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(w * 0.9, 24), new THREE.MeshStandardMaterial({ color: '#4FA8D8', roughness: 0.15, metalness: 0.3 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(Math.cos(a) * (rad - w), top + 0.22, Math.sin(a) * (rad - w)); g.add(pool);
    }
  }
  function buildCoralCluster(g, baseY, spread, R, cm) {
    const pick = () => cm[Math.floor(R(0, cm.length))];
    for (let n = 0; n < 5; n++) {
      const x = R(-spread, spread), z = R(-spread * 0.6, spread * 0.6), kind = R(0, 3) | 0;
      if (kind === 0) { // branching staghorn coral
        const mat = pick(), scl = R(0.6, 1.4);
        const branch = (px, py, pz, len, rad, depth) => {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 7), mat);
          const tiltX = R(-0.5, 0.5), tiltZ = R(-0.5, 0.5);
          seg.position.set(px, py + len / 2, pz); seg.rotation.set(tiltX, 0, tiltZ); g.add(seg);
          const ex = px + Math.sin(tiltZ) * len, ey = py + Math.cos(tiltX) * Math.cos(tiltZ) * len, ez = pz - Math.sin(tiltX) * len;
          if (depth > 0) for (let b = 0; b < 2; b++) branch(ex, ey, ez, len * 0.7, rad * 0.7, depth - 1);
        };
        branch(x, baseY, z, 0.6 * scl, 0.09 * scl, 2);
      } else if (kind === 1) { // flat fan coral
        const mat = pick(), fan = new THREE.Mesh(new THREE.CircleGeometry(R(0.5, 1.1), 16, 0, Math.PI), mat);
        fan.position.set(x, baseY + R(0.3, 0.7), z); fan.rotation.set(Math.PI / 2 - 0.3, R(0, 6.28), 0); fan.material.side = THREE.DoubleSide;
        g.add(fan);
      } else { // round brain coral
        const mat = pick(), dome = new THREE.Mesh(new THREE.SphereGeometry(R(0.3, 0.6), 14, 10, 0, 6.3, 0, Math.PI / 2), mat);
        dome.position.set(x, baseY, z); g.add(dome);
      }
    }
  }
  function buildCastle(g, top, C, R, cloudM) {
    const stone = realMat('#EFE6D6', 2, 2), stoneDark = realMat('#DCCFB9', 2, 2);
    const roofM = new THREE.MeshStandardMaterial({ color: '#3D4FD0', roughness: 0.45, metalness: 0.2 }), goldM = new THREE.MeshStandardMaterial({ color: '#E8B04A', roughness: 0.3, metalness: 0.7 });
    const flagM = new THREE.MeshStandardMaterial({ color: '#C2185B', side: THREE.DoubleSide, roughness: 0.8 }), winM = new THREE.MeshStandardMaterial({ color: '#FFD98A', emissive: '#FFB347', emissiveIntensity: 0.9 });
    for (let k = 0; k < 8; k++) { const sR = C * R(3.4, 4.6), sp = new THREE.Mesh(new THREE.SphereGeometry(sR, 32, 24), cloudM); sp.position.set(R(-C, C), top - 1.2 * C - k * sR * 1.1, R(-C, C)); g.add(sp); } // the cloud bank it sits on, sinking out of sight
    const half = 4 * C, wallH = 2.2 * C, wt = 0.6 * C;
    for (const [wx, wz, rot] of [[0, -half, 0], [0, half, 0], [-half, 0, 1], [half, 0, 1]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(half * 2, wallH, wt), stone); wall.position.set(wx, top + wallH / 2, wz); if (rot) wall.rotation.y = Math.PI / 2; g.add(wall);
      for (let b = -half + 0.5 * C; b < half; b += 1.6 * C) { const bt = new THREE.Mesh(new THREE.BoxGeometry(0.6 * C, 0.5 * C, wt * 1.05), stone); bt.position.set(rot ? wx : b, top + wallH + 0.25 * C, rot ? b : wz); g.add(bt); } // battlements
    }
    for (const [tx, tz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) { // corner towers
      const tH = R(4, 5.2) * C;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * C, 1.05 * C, tH, 28), stoneDark); tw.position.set(tx, top + tH / 2, tz); g.add(tw);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(1.25 * C, 2.4 * C, 28), roofM); rf.position.set(tx, top + tH + 1.2 * C, tz); g.add(rf);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * C, 0.04 * C, 1.2 * C, 8), goldM); pole.position.set(tx, top + tH + 2.9 * C, tz); g.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * C, 0.5 * C), flagM); fl.position.set(tx + 0.45 * C, top + tH + 3.2 * C, tz); g.add(fl);
      const wn = new THREE.Mesh(new THREE.BoxGeometry(0.24 * C, 0.42 * C, 0.1 * C), winM); wn.position.set(tx * 1.24, top + tH * 0.6, tz * 1.24); wn.lookAt(tx * 3, wn.position.y, tz * 3); g.add(wn);
    }
    const kH = R(8, 11) * C; // the great keep
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * C, 1.9 * C, kH, 36), stone); keep.position.y = top + kH / 2; g.add(keep);
    const kr = new THREE.Mesh(new THREE.ConeGeometry(2.2 * C, 4.2 * C, 36), roofM); kr.position.y = top + kH + 2.1 * C; g.add(kr);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12 * C, 2 * C, 8), goldM); spire.position.y = top + kH + 5.2 * C; g.add(spire);
    for (let w = 0; w < 6; w++) { const a = w / 6 * Math.PI * 2, wn = new THREE.Mesh(new THREE.BoxGeometry(0.32 * C, 0.6 * C, 0.1 * C), winM); wn.position.set(Math.cos(a) * 1.76 * C, top + kH * (0.55 + (w % 2) * 0.2), Math.sin(a) * 1.76 * C); wn.lookAt(Math.cos(a) * 9 * C, wn.position.y, Math.sin(a) * 9 * C); g.add(wn); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, sp = new THREE.Sprite(cloudMat), w = C * R(6, 9); sp.scale.set(w, w * 0.45, 1); sp.position.set(Math.cos(a) * half * 1.3, top + R(-1, 1.5) * C, Math.sin(a) * half * 1.3); g.add(sp); } // clouds drifting around it
  }
  function buildValley(m) {
    valley.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && !c.isSprite) { if (c.material.map && c.material.map.image === rockCanvas) c.material.map.dispose(); if (c.material.emissiveMap) c.material.emissiveMap.dispose(); c.material.dispose(); } });
    while (valley.children.length) valley.remove(valley.children[0]);
    valleyItems = []; mistTexs = []; lavaFlowMats = []; seabedTexs = [];
    const th = VALLEY_MAP[m.id] || VALLEY[m.surface] || VALLEY.grass, R = (a, b) => a + Math.random() * (b - a);
    const green = th.top === 'trees' ? greenMats(th) : null;
    const glowCap = ['neon', 'lava', 'crystal'].includes(th.top);
    const add = (obj, par, wrapAt, span) => { valley.add(obj); valleyItems.push({ obj, par, wrapAt, span }); };
    const baseCol = new THREE.Color(th.rock).lerp(new THREE.Color(m.fog), 0.25).multiplyScalar(0.7).getStyle();
    // near cliffs and rock pillars: smooth, sculpted, textured stone
    for (let i = 0; i < Math.round(24 * Q.scenery); i++) {
      const side = i % 2 ? 1 : -1, g = new THREE.Group(), top = R(-8, 16), r = R(5, 10), H = top + DEEP;
      let xMin = 16, xMax = 50;
      if (th.top === 'spire' || th.top === 'spooky') {
        const tip = top + R(12, 28);
        const cone = new THREE.Mesh(sculpt(new THREE.ConeGeometry(r * 1.7, tip + DEEP, 32, 40), 0.12, 0.05), realMat(th.rock, 2, (tip + DEEP) / 16, th.top === 'spire' ? { roughness: 0.4, metalness: 0.1 } : {}));
        cone.position.y = tip - (tip + DEEP) / 2; g.add(cone);
        if (th.top === 'spooky') for (let k = 0; k < 3; k++) { const w = glow(0x9BFFB0, 2.4, 0.8); w.position.set(R(-1, 1), top + R(-6, 4), r * 0.75); g.add(w); }
        if (th.top === 'spooky') { // crooked dead branches jutting from the spire, with old lanterns hanging off them
          const tmp = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: '#241C14', roughness: 1 }), ironM = new THREE.MeshStandardMaterial({ color: '#2A2A30', roughness: 0.6, metalness: 0.6 });
          for (let k = 0; k < 4; k++) {
            const yy = tip - R(4, 18), rad = r * 1.7 * (tip - yy) / (tip + DEEP), a = R(0, 6.3), len = R(2.5, 5);
            const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, len, 7), bm); br.position.set(Math.cos(a) * (rad + len * 0.4), yy, Math.sin(a) * (rad + len * 0.4)); br.rotation.set(-Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1); tmp.add(br);
            const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, len * 0.5, 5), bm); tw.position.set(Math.cos(a) * (rad + len * 0.8), yy + len * 0.25, Math.sin(a) * (rad + len * 0.8)); tw.rotation.set(-Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4); tmp.add(tw);
            if (k < 2) { const lx = Math.cos(a) * (rad + len * 0.75), lz = Math.sin(a) * (rad + len * 0.75); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), ironM); lamp.position.set(lx, yy - 0.7, lz); tmp.add(lamp); const lg = glow(0xFFB347, 2.4, 0.9); lg.position.set(lx, yy - 0.7, lz); g.add(lg); }
          }
          g.add(mergeGroup(tmp));
        }
        if (th.top === 'spire') { // a snowcap, and ice crystals growing from the slope
          const capH = (tip + DEEP) * 0.05, capR = r * 1.7 * capH / (tip + DEEP) * 1.08;
          const snowcap = new THREE.Mesh(new THREE.ConeGeometry(capR, capH, 32), new THREE.MeshStandardMaterial({ color: '#F7FBFF', roughness: 0.6 })); snowcap.position.y = tip - capH / 2 + 0.05; g.add(snowcap);
          const tmp = new THREE.Group(), iceM = new THREE.MeshStandardMaterial({ color: '#BFE8FF', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
          for (let k = 0; k < 6; k++) { const yy = tip - R(6, 20), rad = r * 1.7 * (tip - yy) / (tip + DEEP) * 1.1, a = R(0, 6.3); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(R(0.5, 1.2)), iceM); cr.scale.y = 2.4; cr.position.set(Math.cos(a) * rad, yy, Math.sin(a) * rad); cr.rotation.z = Math.cos(a) * 0.5; cr.rotation.x = -Math.sin(a) * 0.5; tmp.add(cr); }
          g.add(mergeGroup(tmp));
        }
      } else if (th.top === 'lava') { // a towering basalt formation split by glowing magma cracks
        xMin = r * 1.9 + 9; xMax = xMin + 40; // spires flare wide, so keep them well clear of the track
        if (R(0, 1) < 0.45) { // a jagged spire
          const tip = top + R(14, 34), Ht = tip + DEEP;
          const sp = new THREE.Mesh(sculpt(new THREE.ConeGeometry(r * 1.5, Ht, 28, 48), 0.18, 0.05), crackedRock(2, Math.round(Ht / 20)));
          sp.position.y = tip - Ht / 2; g.add(sp);
          const gl = glow(0xFF5A1F, r * 2, 0.6); gl.position.y = tip; g.add(gl);
          for (let f = 0; f < 2; f++) { // lava pouring down the spire's face
            const a = R(0, Math.PI * 2), yT = tip - R(4, 12), rad = 1.5 * r * (tip - (yT - 25)) / Ht * 1.28 + 0.4;
            lavaStream(g, Math.cos(a) * rad, Math.sin(a) * rad, yT, R(45, 80), R(0.9, 1.6), a);
          }
        } else { // a cluster of hexagonal basalt columns
          for (let k = 0; k < 3; k++) {
            const cr = r * R(0.45, 0.7), cTop = top + R(-4, 14), cH = cTop + DEEP;
            const col = new THREE.Mesh(sculpt(new THREE.CylinderGeometry(cr, cr * 1.15, cH, 6, 40), 0.03, 0.05), crackedRock(1, Math.round(cH / 16)));
            col.position.set(R(-r * 0.5, r * 0.5), cTop - cH / 2, R(-r * 0.5, r * 0.5)); g.add(col);
            const pool = new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.82, cr * 0.82, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#FF6A1F', emissive: '#FF5A1F', emissiveIntensity: 1.5 }));
            pool.position.set(col.position.x, cTop + 0.1, col.position.z); g.add(pool); // a molten pool on top
            const gl = glow(0xFF5A1F, cr * 3, 0.7); gl.position.set(col.position.x, cTop + 1, col.position.z); g.add(gl);
            if (R(0, 1) < 0.7) { // lava spilling over the edge of the pool and down one face
              const a = Math.floor(R(0, 6)) * Math.PI / 3 + Math.PI / 6, rad = cr * 0.9 + 0.12;
              lavaStream(g, col.position.x + Math.cos(a) * rad, col.position.z + Math.sin(a) * rad, cTop - 0.1, R(35, 60), Math.min(cr * 0.7, 1.4), a);
            }
          }
        }
      } else if (th.top === 'neon') { // a neon skyscraper instead of a rock pillar
        const w = R(6, 12), dpt = R(6, 12);
        buildNeonTower(g, top + R(4, 30), w, dpt, R);
        xMin = Math.max(w, dpt) / 2 + 10; xMax = xMin + 42;
      } else if (th.top === 'castle' && i % 3 === 0) { // a huge sky castle on its own cloud bank
        const C = R(1.6, 3.0);
        buildCastle(g, top, C, R, new THREE.MeshStandardMaterial({ color: th.rock, roughness: 1 }));
        xMin = 5.6 * C + 8; xMax = xMin + 50;
      } else if (th.top === 'puff' || th.top === 'castle') {
        for (let k = 0; k < 10; k++) { const sR = r * R(1, 1.5), sp = new THREE.Mesh(new THREE.SphereGeometry(sR, 32, 24), new THREE.MeshStandardMaterial({ color: th.rock, roughness: 1 })); sp.position.set(R(-2, 2), top - k * sR * 1.05, R(-2, 2)); g.add(sp); }
      } else {
        const segs = th.top === 'lava' ? 6 : 32;
        const col = new THREE.Mesh(sculpt(new THREE.CylinderGeometry(r * 0.85, r * 1.35, H, segs, 48), th.top === 'lava' ? 0.02 : 0.16, 0.06), realMat(th.rock, 2, H / 14));
        col.position.y = top - H / 2; g.add(col);
        if (th.top !== 'trees') {
          const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), realMat(th.cap, 2, 1, glowCap ? { emissive: th.cap, emissiveIntensity: 0.8 } : {}));
          lid.scale.y = 0.18; lid.position.y = top - 0.1; g.add(lid);
        }
        if (th.top === 'trees') { // a living clifftop: lawn, trees, bushes, rocks, flowers, sometimes a waterfall
          buildGreenTop(g, top, r, th, green, R, side);
        } else if (th.top === 'mesa') { // desert mesa: layered rock bands, cacti and boulders
          const tmp = new THREE.Group();
          const bandCols = ['#B5602E', '#D9884A', '#A04E28'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
          for (let k = 0; k < 4; k++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(r * (0.9 + k * 0.03), r * (0.92 + k * 0.03), R(0.8, 1.6), 36, 1, true), bandCols[k % 3]); band.position.y = top - 2.5 - k * 4.5; tmp.add(band); }
          const cactusM = new THREE.MeshStandardMaterial({ color: '#4E7A3A', roughness: 0.8 }), rockM = new THREE.MeshStandardMaterial({ color: '#9A6A44', roughness: 1 });
          for (let k = 0; k < 4; k++) {
            const a = R(0, 6.3), d = Math.sqrt(R(0, 1)) * r * 0.7, x = Math.cos(a) * d, z = Math.sin(a) * d, h2 = R(1.6, 3);
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, h2, 12), cactusM); body.position.set(x, top + h2 / 2, z); tmp.add(body);
            const cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, 6.3, 0, Math.PI / 2), cactusM); cap2.position.set(x, top + h2, z); tmp.add(cap2);
            for (const sx of [-1, 1]) if (R(0, 1) < 0.7) { const up = R(0.5, 0.9); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, up, 10), cactusM); arm.position.set(x + sx * 0.45, top + h2 * 0.55 + up / 2, z); tmp.add(arm); const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 10), cactusM); elbow.position.set(x + sx * 0.25, top + h2 * 0.55, z); elbow.rotation.z = Math.PI / 2; tmp.add(elbow); }
          }
          for (let k = 0; k < 5; k++) { const a = R(0, 6.3), d = Math.sqrt(R(0, 1)) * r * 0.85, rk = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.3, 0.9)), rockM); rk.position.set(Math.cos(a) * d, top + 0.25, Math.sin(a) * d); rk.scale.y = 0.6; tmp.add(rk); }
          g.add(mergeGroup(tmp));
        } else if (th.top === 'dead') { // marsh crag: dead trees, moss and hanging vines
          const tmp = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: '#3A2E22', roughness: 1 }), moss = new THREE.MeshStandardMaterial({ color: '#4E6B32', roughness: 1 }), vine = new THREE.MeshStandardMaterial({ color: '#3E5A2A', roughness: 1 });
          for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, R(3, 6), 10), bm); b.position.set(R(-r / 2, r / 2), top + 2, R(-r / 2, r / 2)); b.rotation.set(R(-0.4, 0.4), 0, R(-0.4, 0.4)); tmp.add(b); }
          for (let k = 0; k < 6; k++) { const a = R(0, 6.3), d = R(0, 1) * r * 0.8, ms = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.4, 0.9), 1), moss); ms.position.set(Math.cos(a) * d, top + 0.1, Math.sin(a) * d); ms.scale.y = 0.35; tmp.add(ms); }
          for (let k = 0; k < 8; k++) { const a = R(0, 6.3), len = R(3, 9), vn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, len, 5), vine); vn.position.set(Math.cos(a) * r * 0.95, top - len / 2, Math.sin(a) * r * 0.95); tmp.add(vn); }
          g.add(mergeGroup(tmp));
        } else if (th.top === 'neon') {
          const sm = new THREE.MeshStandardMaterial({ color: th.cap, emissive: th.cap, emissiveIntensity: 1 });
          for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, st = new THREE.Mesh(new THREE.BoxGeometry(0.35, 70, 0.35), sm); st.position.set(Math.cos(a) * r * 0.95, top - 35, Math.sin(a) * r * 0.95); g.add(st); }
          const gl = glow(0xFF4FD8, r * 2.2, 0.7); gl.position.y = top + 1; g.add(gl);
        } else if (th.top === 'coral') {
          const cm = ['#FF6F91', '#FFA552', '#B57BFF', '#4FD1C5', '#FFE14D'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
          for (let k = 0; k < 5; k++) { const h2 = R(3, 8), b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h2, 12), cm[k % cm.length]); b.position.set(R(-r / 2, r / 2), top + h2 / 2, R(-r / 2, r / 2)); b.rotation.set(R(-0.5, 0.5), 0, R(-0.5, 0.5)); g.add(b); }
          buildCoralCluster(g, top, Math.min(r * 0.85, 4), R, cm);
        } else if (th.top === 'lava') {
          const gl = glow(0xFF5A1F, r * 2.6, 0.85); gl.position.y = top + 1; g.add(gl);
        } else if (th.top === 'crystal') {
          const cm = new THREE.MeshStandardMaterial({ color: th.cap, emissive: th.cap, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3 });
          for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(R(1.4, 2.8)), cm); c.scale.y = 2.2; c.position.set(R(-r / 2, r / 2), top + 3.5, R(-r / 2, r / 2)); g.add(c); }
          const gl = glow(0xFF7AD9, r * 2.4, 0.6); gl.position.y = top + 4; g.add(gl);
        }
      }
      g.position.set(side * R(xMin, xMax), 0, R(-270, 40));
      add(g, 1, 50, 320);
    }
    // far mountain ranges with real snowlines
    for (let i = 0; i < Math.round(14 * Q.scenery); i++) {
      const side = i % 2 ? 1 : -1, apex = R(40, 140), Rr = R(45, 95), g = new THREE.Group();
      if (th.top === 'lava') { // distant peaks cracked with magma
        const H = apex + DEEP, Rb = Rr * 0.55 * H / apex;
        const mt = new THREE.Mesh(sculpt(new THREE.ConeGeometry(Rb, H, 40, 48), 0.14, 0.02), crackedRock(4, Math.round(H / 30)));
        mt.position.y = apex - H / 2; g.add(mt);
        const gl = glow(0xFF5A1F, Rr * 0.8, 0.6); gl.position.y = apex; g.add(gl);
        for (let f = 0; f < 2; f++) { const a = R(0, Math.PI * 2), rad = Rb * 30 / H * 1.3 + 2; lavaStream(g, Math.cos(a) * rad, Math.sin(a) * rad, apex - 6, 140, R(3, 5), a); } // lava rivers down the peak
      } else if (th.top === 'neon') { // a distant neon skyline
        buildNeonTower(g, apex, R(22, 46), R(22, 46), R);
      } else if (th.cloudy) {
        for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(Rr * 0.6, 32, 24), new THREE.MeshStandardMaterial({ color: th.far, roughness: 1 })); sp.position.set(R(-Rr * 0.4, Rr * 0.4), apex - k * Rr * 0.5, 0); g.add(sp); }
        if (th.top === 'castle' && i % 3 === 0) buildCastle(g, apex - Rr * 0.15, Rr * 0.1, R, new THREE.MeshStandardMaterial({ color: th.far, roughness: 1 })); // distant giant castles
      } else {
        const H = apex + DEEP, Rb = Rr * 0.55 * H / apex;
        g.add(mountain(Rb, H, apex, th.far, th.forest || baseCol, th.snow)); // forested lower slopes on the green maps
      }
      g.position.set(side * R(110, 280), 0, R(-480, -90));
      add(g, 0.12, 90, 560);
    }
    // concrete pylons holding up the bridge, vanishing into the mist
    const conc = realMat(new THREE.Color(m.side).lerp(new THREE.Color('#B8B4AC'), 0.45).getStyle(), 1, DEEP / 10);
    for (let z = 20; z > -230; z -= 30) {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, DEEP, 20), conc); leg.position.set(sx * 3.1, -0.9 - DEEP / 2, 0); g.add(leg); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF * 2, 1.2, 1.4), conc); beam.position.y = -1.6; g.add(beam);
      g.position.z = z;
      add(g, 1, 30, 270);
    }
    if (m.surface === 'coral') { // the track runs across a real seabed, covered in 3D coral right beside you
      for (const sx of [-1, 1]) {
        const bed = new THREE.Mesh(new THREE.PlaneGeometry(90, 600), realMat('#D9C08A', 12, 80));
        bed.rotation.x = -Math.PI / 2; bed.position.set(sx * (TRACK_HALF + 45.05), -0.18, -250);
        valley.add(bed); seabedTexs.push(bed.material.map);
      }
      const cm = ['#FF6F91', '#FFA552', '#B57BFF', '#4FD1C5', '#FFE14D', '#FF5E7E'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, emissive: c, emissiveIntensity: 0.15, side: THREE.DoubleSide }));
      const kelpM = new THREE.MeshStandardMaterial({ color: '#2E8C5A', roughness: 0.7, side: THREE.DoubleSide });
      const reefCluster = (spread, scl, x, y, z) => {
        const tmp = new THREE.Group(); buildCoralCluster(tmp, 0, spread, R, cm);
        if (Math.random() < 0.4) for (let k = 0; k < 3; k++) { // swaying kelp ribbons rising between the coral
          const h2 = R(1.2, 2.6), kp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, h2, 1, 6), kelpM);
          kp.position.set(R(-spread, spread), h2 / 2, R(-spread, spread)); kp.rotation.y = R(0, 6.3); tmp.add(kp);
        }
        const g = mergeGroup(tmp); g.scale.setScalar(scl); g.position.set(x, y, z);
        add(g, 1, 35, 290);
      };
      for (let i = 0; i < 22; i++) { const sx = i % 2 ? 1 : -1; reefCluster(0.8, R(1.2, 1.9), sx * R(TRACK_HALF + 0.7, TRACK_HALF + 3.5), -0.18, R(-260, 30)); }  // right next to the track
      for (let i = 0; i < 30; i++) { const sx = i % 2 ? 1 : -1; reefCluster(1.5, R(2, 3.6), sx * R(TRACK_HALF + 4, 36), -0.18, R(-260, 30)); }            // further out across the seabed
      for (let i = 0; i < 18; i++) { const sx = i % 2 ? 1 : -1; reefCluster(0.15, R(0.4, 0.6), sx * (TRACK_HALF - 0.1), 0, R(-260, 30)); }               // little tufts growing on the track's edges
    }
    // two layers of drifting mist far below, so the depths fade away softly
    for (const [y, op] of [[-34, 0.75], [-70, 0.9]]) {
      const t = new THREE.CanvasTexture(mistCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: t, color: m.fog, transparent: true, opacity: op, depthWrite: false }));
      mist.rotation.x = -Math.PI / 2; mist.position.set(0, y, -200);
      valley.add(mist); mistTexs.push(t);
    }
  }
  function scrollValley(dz) {
    if (!valley.visible) return;
    for (const t of mistTexs) t.offset.y += dz / 200;
    for (const t of seabedTexs) t.offset.y += dz / 7.5; // the seabed slides past with the track
    for (const it of valleyItems) { it.obj.position.z += dz * it.par; if (it.obj.position.z > it.wrapAt) it.obj.position.z -= it.span; }
  }

  // weather particles: rain, snow, dust, glowing motes
  let weather = null, scrollAcc = 0;
  function buildWeather(kind) {
    if (weather && weather.kind === kind) return;
    if (weather) { scene.remove(weather.obj); weather.obj.geometry.dispose(); weather.obj.material.dispose(); weather = null; }
    if (!kind || kind === 'none') return;
    const cfg = {
      rain:  { n: 900, fall: 26,   drift: -2,  color: 0xD8E2F2, len: 0.7, opacity: 0.55 },
      snow:  { n: 700, fall: 1.6,  drift: 0.6, color: 0xFFFFFF, size: 0.16, opacity: 0.95 },
      dust:  { n: 500, fall: 0.2,  drift: 5,   color: 0xF3D3A0, size: 0.1,  opacity: 0.7 },
      motes: { n: 300, fall: -0.6, drift: 0.2, color: 0xFF7AD9, size: 0.14, opacity: 0.85 },
      sparkle: { n: 320, fall: 0.3, drift: 0.4, color: 0xFFFFFF, size: 0.12, opacity: 0.9 },
      bubbles: { n: 420, fall: -1.6, drift: 0.2, color: 0xBFF6FF, size: 0.2, opacity: 0.6 },
      wisps: { n: 220, fall: -0.25, drift: 1.2, color: 0x9BFFB0, size: 0.35, opacity: 0.35 },
      embers: { n: 420, fall: -2.4, drift: 0.5, color: 0xFF7A1F, size: 0.13, opacity: 0.95 },
      leaves: { n: 260, fall: 1.2, drift: 1.1, color: 0xE67E22, size: 0.22, opacity: 0.95 },
      petals: { n: 380, fall: 0.8, drift: 0.9, color: 0xFFB7D2, size: 0.17, opacity: 0.95 },
    }[kind];
    cfg.n = Math.round(cfg.n * Q.weather);
    const r = (a, b) => a + Math.random() * (b - a);
    const line = kind === 'rain', st = line ? 6 : 3;
    const pos = new Float32Array(cfg.n * st), seeds = new Float32Array(cfg.n);
    for (let i = 0; i < cfg.n; i++) {
      const x = r(-16, 16), y = r(-2, 14), z = r(-70, 12);
      seeds[i] = Math.random() * 6.28;
      if (line) pos.set([x, y, z, x + 0.08, y + cfg.len, z], i * 6); else pos.set([x, y, z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = line
      ? new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity })
      : new THREE.PointsMaterial({ color: cfg.color, size: cfg.size, transparent: true, opacity: cfg.opacity, depthWrite: false });
    const obj = line ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
    obj.frustumCulled = false;
    scene.add(obj);
    weather = { obj, cfg, line, seeds, kind };
  }
  function updateWeather(dt, dz) {
    if (!weather) return;
    const { cfg, line, seeds, kind } = weather;
    const attr = weather.obj.geometry.attributes.position, a = attr.array, st = line ? 6 : 3;
    for (let i = 0; i < cfg.n; i++) {
      const o = i * st;
      const sway = kind === 'snow' ? Math.sin(clock * 1.5 + seeds[i]) * 0.6 : 0;
      const dx = (cfg.drift + sway) * dt, dy = -cfg.fall * dt;
      a[o] += dx; a[o + 1] += dy; a[o + 2] += dz;
      if (line) { a[o + 3] += dx; a[o + 4] += dy; a[o + 5] += dz; }
      const wx = a[o] > 16 ? -32 : a[o] < -16 ? 32 : 0;
      const wy = a[o + 1] < -2 ? 16 : a[o + 1] > 14 ? -16 : 0;
      const wz = a[o + 2] > 12 ? -82 : 0;
      if (wx || wy || wz) {
        a[o] += wx; a[o + 1] += wy; a[o + 2] += wz;
        if (line) { a[o + 3] += wx; a[o + 4] += wy; a[o + 5] += wz; }
      }
    }
    attr.needsUpdate = true;
  }

  // obstacle resources
  const crateCanvas = document.createElement('canvas');
  crateCanvas.width = crateCanvas.height = 64;
  (() => {
    const g = crateCanvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(70,30,0,.4)'; g.lineWidth = 5; g.strokeRect(3, 3, 58, 58);
    g.lineWidth = 3;
    for (let y = 18; y < 60; y += 15) { g.beginPath(); g.moveTo(4, y); g.lineTo(60, y); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(6, 6); g.lineTo(58, 58); g.stroke();
  })();
  const crateTex = new THREE.CanvasTexture(crateCanvas);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const stripeCanvas = document.createElement('canvas');
  stripeCanvas.width = 128; stripeCanvas.height = 32;
  (() => {
    const g = stripeCanvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 32);
    g.fillStyle = 'rgba(70,30,0,.38)';
    for (let x = -32; x < 160; x += 24) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 12, 32); g.lineTo(x + 44, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
  })();
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(4, 2);
  const trimMat = lambert(0x000000);

  const orbGeo = new THREE.SphereGeometry(0.38, 18, 14);
  const orbMat = new THREE.MeshLambertMaterial({ color: 0x16D9A0, emissive: 0x0a5c44 });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x16D9A0, transparent: true, opacity: 0.25, depthWrite: false });
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 22);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xFFC928, emissive: 0x6a4a00, roughness: 0.35, metalness: 0.35 });

  const streakGeo = new THREE.BoxGeometry(1.5, 0.05, 0.05);
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });
  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(-0.6, -0.7); chevronShape.lineTo(0.3, 0); chevronShape.lineTo(-0.6, 0.7);
  chevronShape.lineTo(-0.2, 0.7); chevronShape.lineTo(0.7, 0); chevronShape.lineTo(-0.2, -0.7); chevronShape.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevronShape);
  const chevronMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });

  // ================= runner =================
  const avatarMat = new THREE.MeshPhysicalMaterial({ color: 0xFF6A00, roughness: 0.36, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.28, skinning: true });
  function capsuleGeo(len, r1, r2, seg = 18) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, r1 * Math.sin(a)), r1 * Math.cos(a))); }
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, r2 * Math.sin(a)), -len + r2 * Math.cos(a))); }
    return new THREE.LatheGeometry(pts, seg);
  }
  function torsoGeo() {
    const prof = [[0.0, 0.80], [0.17, 0.83], [0.24, 0.92], [0.26, 1.02], [0.23, 1.14], [0.215, 1.22],
                  [0.24, 1.34], [0.265, 1.44], [0.25, 1.53], [0.2, 1.6], [0.12, 1.65], [0.0, 1.67]];
    const curve = new THREE.SplineCurve(prof.map(p => new THREE.Vector2(p[0], p[1])));
    const pts = curve.getPoints(40).map(p => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
    pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
    return new THREE.LatheGeometry(pts, 28);
  }
  // builds a smooth surface from a distance field (naive surface nets), with normals from the field itself
  function surfaceNets(f, min, max, step) {
    const nx = Math.ceil((max.x - min.x) / step) + 1, ny = Math.ceil((max.y - min.y) / step) + 1, nz = Math.ceil((max.z - min.z) / step) + 1;
    const F = new Float32Array(nx * ny * nz), I = (x, y, z) => x + nx * (y + ny * z);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) F[I(x, y, z)] = f(min.x + x * step, min.y + y * step, min.z + z * step);
    const cx = nx - 1, cy = ny - 1, cz = nz - 1, C = (x, y, z) => x + cx * (y + cy * z);
    const vid = new Int32Array(cx * cy * cz).fill(-1), P = [];
    const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const v = new Float32Array(8);
    for (let z = 0; z < cz; z++) for (let y = 0; y < cy; y++) for (let x = 0; x < cx; x++) {
      let mask = 0;
      for (let k = 0; k < 8; k++) { const c = corners[k]; v[k] = F[I(x + c[0], y + c[1], z + c[2])]; if (v[k] < 0) mask |= 1 << k; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (const [a, b] of edges) {
        if ((v[a] < 0) === (v[b] < 0)) continue;
        const t = v[a] / (v[a] - v[b]), ca = corners[a], cb = corners[b];
        sx += ca[0] + (cb[0] - ca[0]) * t; sy += ca[1] + (cb[1] - ca[1]) * t; sz += ca[2] + (cb[2] - ca[2]) * t; cnt++;
      }
      vid[C(x, y, z)] = P.length / 3;
      P.push(min.x + (x + sx / cnt) * step, min.y + (y + sy / cnt) * step, min.z + (z + sz / cnt) * step);
    }
    const idx = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d); };
    for (let z = 1; z < cz; z++) for (let y = 1; y < cy; y++) for (let x = 0; x < cx; x++) {
      const s0 = F[I(x, y, z)] < 0; if (s0 === (F[I(x + 1, y, z)] < 0)) continue;
      quad(vid[C(x, y, z)], vid[C(x, y - 1, z)], vid[C(x, y - 1, z - 1)], vid[C(x, y, z - 1)], s0);
    }
    for (let z = 1; z < cz; z++) for (let y = 0; y < cy; y++) for (let x = 1; x < cx; x++) {
      const s0 = F[I(x, y, z)] < 0; if (s0 === (F[I(x, y + 1, z)] < 0)) continue;
      quad(vid[C(x, y, z)], vid[C(x, y, z - 1)], vid[C(x - 1, y, z - 1)], vid[C(x - 1, y, z)], s0);
    }
    for (let z = 0; z < cz; z++) for (let y = 1; y < cy; y++) for (let x = 1; x < cx; x++) {
      const s0 = F[I(x, y, z)] < 0; if (s0 === (F[I(x, y, z + 1)] < 0)) continue;
      quad(vid[C(x, y, z)], vid[C(x - 1, y, z)], vid[C(x - 1, y - 1, z)], vid[C(x, y - 1, z)], s0);
    }
    const N = new Float32Array(P.length), h = step * 0.25;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      const gx = f(x + h, y, z) - f(x - h, y, z), gy = f(x, y + h, z) - f(x, y - h, z), gz = f(x, y, z + h) - f(x, y, z - h), l = Math.hypot(gx, gy, gz) || 1;
      N[i] = gx / l; N[i + 1] = gy / l; N[i + 2] = gz / l;
    }
    // make sure triangles face outward
    let score = 0;
    for (let t = 0; t < Math.min(idx.length, 3000); t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      score += (uy * wz - uz * wy) * N[a] + (uz * wx - ux * wz) * N[a + 1] + (ux * wy - uy * wx) * N[a + 2];
    }
    if (score < 0) for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setIndex(idx);
    return geo;
  }
  function makeRunner() {
    const root = new THREE.Group(), style = new THREE.Group(), body = new THREE.Group();
    root.add(style); style.add(body);
    // skeleton: the same joints the animation already drives
    const spine = new THREE.Bone(); body.add(spine);
    const arms = [], legs = [], bones = [spine];
    for (const side of [-1, 1]) {
      const sh = new THREE.Bone(); sh.position.set(side * 0.29, 1.53, 0); spine.add(sh);
      const el = new THREE.Bone(); el.position.y = -0.3; sh.add(el);
      const hip = new THREE.Bone(); hip.position.set(side * 0.13, 0.9, 0); spine.add(hip);
      const knee = new THREE.Bone(); knee.position.y = -0.42; hip.add(knee);
      const foot = new THREE.Object3D(); foot.position.set(0, -0.44, -0.06); knee.add(foot);
      arms.push({ sh, el, side }); legs.push({ hip, knee, foot });
      bones.push(sh, el, hip, knee);
    }
    // sculpt in a relaxed pose (arms out, legs apart) so the limbs never melt into the body
    for (const a of arms) a.sh.rotation.z = a.side * 0.62;
    legs[0].hip.rotation.z = -0.14; legs[1].hip.rotation.z = 0.14;
    body.updateMatrixWorld(true);
    const V = (x, y, z) => new THREE.Vector3(x, y, z), wp = (o, x = 0, y = 0, z = 0) => o.localToWorld(V(x, y, z));
    const AR = arms.map(a => ({ S: wp(a.sh), E: wp(a.el), H: wp(a.el, 0, -0.29, 0) }));
    const LG = legs.map(l => ({ P: wp(l.hip), K: wp(l.knee), A: wp(l.knee, 0, -0.38, 0), F: wp(l.knee, 0, -0.44, -0.07) }));
    const ell = (px, py, pz, c, r) => {
      const x = (px - c.x) / r.x, y = (py - c.y) / r.y, z = (pz - c.z) / r.z, k0 = Math.sqrt(x * x + y * y + z * z);
      const x2 = x / r.x, y2 = y / r.y, z2 = z / r.z, k1 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
      return k0 * (k0 - 1) / Math.max(k1, 1e-6);
    };
    const cap = (px, py, pz, a, b, ra, rb) => {
      const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, qx = px - a.x, qy = py - a.y, qz = pz - a.z;
      const t = Math.max(0, Math.min(1, (qx * bx + qy * by + qz * bz) / (bx * bx + by * by + bz * bz)));
      return Math.hypot(qx - bx * t, qy - by * t, qz - bz * t) - (ra + (rb - ra) * t);
    };
    const smin = (a, b, k) => { const hh = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - hh * hh * k * 0.25; };
    const hipC = V(0, 0.97, 0), hipR = V(0.25, 0.17, 0.19), wC = V(0, 1.17, 0), wR = V(0.215, 0.17, 0.165), cC = V(0, 1.39, 0), cR = V(0.262, 0.2, 0.192);
    const s0 = V(-0.21, 1.53, 0), s1 = V(0.21, 1.53, 0), n0 = V(0, 1.58, 0), n1 = V(0, 1.78, 0), hdC = V(0, 1.87, 0), hdR = V(0.205, 0.232, 0.212);
    const handR = V(0.068, 0.088, 0.062), footR = V(0.088, 0.066, 0.152);
    // bounding spheres let far-away parts be skipped, which keeps the sculpt fast
    const bsph = (a, b, pad) => { const c = a.clone().add(b).multiplyScalar(0.5); return { c, r: a.distanceTo(b) / 2 + pad }; };
    const armB = AR.map(l => bsph(l.S, l.H, 0.12)), legB = LG.map(g => bsph(g.P, g.F, 0.2)), torsoB = { c: V(0, 1.42, 0), r: 0.78 };
    const far = (x, y, z, B) => Math.hypot(x - B.c.x, y - B.c.y, z - B.c.z) - B.r;
    const torsoD = (x, y, z) => {
      const f0 = far(x, y, z, torsoB); if (f0 > 0.12) return f0;
      let d = ell(x, y, z, hipC, hipR);
      d = smin(d, ell(x, y, z, wC, wR), 0.1);
      d = smin(d, ell(x, y, z, cC, cR), 0.1);
      d = smin(d, cap(x, y, z, s0, s1, 0.095, 0.095), 0.08);
      d = smin(d, cap(x, y, z, n0, n1, 0.082, 0.078), 0.07);
      return smin(d, ell(x, y, z, hdC, hdR), 0.08);
    };
    const armD = (i, x, y, z) => {
      const l = AR[i], fa = far(x, y, z, armB[i]); if (fa > 0.12) return fa;
      let a = cap(x, y, z, l.S, l.E, 0.085, 0.07);
      a = smin(a, cap(x, y, z, l.E, l.H, 0.068, 0.058), 0.05);
      return smin(a, ell(x, y, z, l.H, handR), 0.05);
    };
    const legD = (i, x, y, z) => {
      const g = LG[i], fl = far(x, y, z, legB[i]); if (fl > 0.12) return fl;
      let a = cap(x, y, z, g.P, g.K, 0.112, 0.086);
      a = smin(a, cap(x, y, z, g.K, g.A, 0.084, 0.068), 0.05);
      return smin(a, ell(x, y, z, g.F, footR), 0.06);
    };
    const sdf = (x, y, z) => {
      let d = torsoD(x, y, z);
      for (let i = 0; i < 2; i++) d = smin(d, armD(i, x, y, z), 0.07);
      for (let i = 0; i < 2; i++) d = smin(d, legD(i, x, y, z), 0.08);
      return d;
    };
    // how far along a limb a point is: 0 at the shoulder/hip, 1 at the hand/foot
    const along = (a, b, x, y, z) => { const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z; return ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / (bx * bx + by * by + bz * bz); };
    const geo = surfaceNets(sdf, V(-0.8, -0.08, -0.3), V(0.8, 2.14, 0.3), Q.body);
    // skin weights: each point follows the nearest bones, blending smoothly across the joints
    const segs = [[V(0, 0.8, 0), V(0, 2.0, 0)]], rads = [0.21];
    for (let i = 0; i < 2; i++) { segs.push([AR[i].S, AR[i].E], [AR[i].E, AR[i].H], [LG[i].P, LG[i].K], [LG[i].K, LG[i].F]); rads.push(0.08, 0.065, 0.1, 0.078); }
    const weigh = gm => {
      const pos = gm.attributes.position, n = pos.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const q = V(0, 0, 0), cl = V(0, 0, 0), ab = V(0, 0, 0);
      for (let i = 0; i < n; i++) {
        q.fromBufferAttribute(pos, i);
        const ws = segs.map(([a, b], k) => {
          ab.copy(b).sub(a);
          const t = Math.max(0, Math.min(1, cl.copy(q).sub(a).dot(ab) / ab.lengthSq()));
          cl.copy(a).addScaledVector(ab, t);
          return [k, 1 / Math.pow(Math.max(0.004, q.distanceTo(cl) - rads[k] * 0.6), 5)];
        }).sort((x, y) => y[1] - x[1]).slice(0, 4);
        const tot = ws.reduce((acc, w) => acc + w[1], 0);
        ws.forEach(([k, w], j) => { si[i * 4 + j] = k; sw[i * 4 + j] = w / tot; });
      }
      gm.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      gm.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    };
    weigh(geo);
    // clothes: the body's own surface pushed out a little, cut to the garment's shape, and skinned to the same bones,
    // so it bends exactly with the body and can never sink into it
    const armLen = AR[0].S.distanceTo(AR[0].H), legLen = LG[0].P.distanceTo(LG[0].F);
    function garmentGeo(spec, thick) {
      // pick the body's own triangles inside the garment area, push them out along the surface normal,
      // and keep their exact skin weights: the cloth follows every bend of the body and can never sink into it
      const P = geo.attributes.position, Nn = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, idx = geo.index.array;
      const inside = new Uint8Array(P.count);
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        const tD = torsoD(x, y, z), a0 = armD(0, x, y, z), a1 = armD(1, x, y, z), l0 = legD(0, x, y, z), l1 = legD(1, x, y, z);
        const m = Math.min(tD, a0, a1, l0, l1);
        let ok;
        if (m === tD) ok = !!spec.torso && y >= spec.torso[0] && y <= spec.torso[1];
        else if (m === a0 || m === a1) { const l = AR[m === a0 ? 0 : 1], t = along(l.S, l.H, x, y, z); ok = !!spec.arm && t >= spec.arm[0] && t <= spec.arm[1]; }
        else { const g = LG[m === l0 ? 0 : 1], t = along(g.P, g.F, x, y, z); ok = !!spec.leg && t >= spec.leg[0] && t <= spec.leg[1]; }
        inside[i] = ok ? 1 : 0;
      }
      const map = new Int32Array(P.count).fill(-1), tris = [], src = [];
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2];
        if (!(inside[a] && inside[b] && inside[c])) continue;
        for (const v of [a, b, c]) if (map[v] < 0) { map[v] = src.length; src.push(v); }
        tris.push(map[a], map[b], map[c]);
      }
      const n = src.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      src.forEach((v, k) => {
        const nx = Nn.getX(v), ny = Nn.getY(v), nz = Nn.getZ(v);
        pos[k * 3] = P.getX(v) + nx * thick; pos[k * 3 + 1] = P.getY(v) + ny * thick; pos[k * 3 + 2] = P.getZ(v) + nz * thick;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        for (let j = 0; j < 4; j++) { si[k * 4 + j] = SI.array[v * 4 + j]; sw[k * 4 + j] = SW.array[v * 4 + j]; }
      });
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      gm.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      gm.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      gm.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      gm.setIndex(tris);
      return gm;
    }
    const skin = new THREE.SkinnedMesh(geo, avatarMat);
    skin.frustumCulled = false;
    body.add(skin);
    body.updateMatrixWorld(true);
    skin.bind(new THREE.Skeleton(bones));
    for (const a of arms) a.sh.rotation.z = 0;   // back to neutral; animation takes over
    for (const l of legs) l.hip.rotation.z = 0;
    const head = new THREE.Object3D(); head.position.y = 1.86; spine.add(head);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 20), new THREE.MeshBasicMaterial({ color: 0x7FE9F2, transparent: true, opacity: 0.22, depthWrite: false }));
    bubble.position.y = 1.0; bubble.scale.set(0.85, 1, 0.85); bubble.visible = false;
    root.add(bubble);
    scene.add(root);
    return { root, style, body, arms, legs, bubble, head, torso: skin, garmentGeo };
  }
  const rig = makeRunner();

  // ---------- cosmetics ----------
  const COSMETICS = [
    { id: 'beanie',    slot: 'hat',   name: 'Beanie',           price: 900,  color: '#FF4F8B', desc: 'A cosy knit beanie with a pompom.' },
    { id: 'cap',       slot: 'hat',   name: 'Ball Cap',         price: 1200, color: '#2F6BFF', desc: 'A classic cap with a front brim.' },
    { id: 'party',     slot: 'hat',   name: 'Party Hat',        price: 1500, color: '#9B5CFF', desc: 'Every run is a celebration.' },
    { id: 'tophat',    slot: 'hat',   name: 'Top Hat',          price: 2500, color: '#1E1B24', accent: '#E83E3E', desc: 'Very fancy. Very tall.' },
    { id: 'crown',     slot: 'hat',   name: 'Royal Crown',      price: 5000, color: '#FFC928', glow: true, perk: '+10% points', desc: 'A glowing golden crown for the best runners.' },
    { id: 'sneakers',  slot: 'shoes', name: 'Classic Sneakers', price: 800,  color: '#FFFFFF', accent: '#FF4F4F', desc: 'Clean white kicks with red soles.' },
    { id: 'boots',     slot: 'shoes', name: 'Hiking Boots',     price: 1400, color: '#7A4A2A', accent: '#2A1A10', desc: 'Chunky, rugged and ready for mud.' },
    { id: 'hightops',  slot: 'shoes', name: 'High-Tops',        price: 1800, color: '#E83E3E', accent: '#FFFFFF', desc: 'Retro basketball high-tops.' },
    { id: 'neonkicks', slot: 'shoes', name: 'Neon Kicks',       price: 4000, color: '#22E1FF', accent: '#FF4FD8', glow: true, perk: 'Speed pads last 50% longer', desc: 'Glowing kicks that light up the track.' },
    { id: 'shorts',    slot: 'legs',  name: 'Gym Shorts',       price: 700,  color: '#2F3A8C', desc: 'Light and sporty.' },
    { id: 'tee',       slot: 'top',   name: 'T-Shirt',          price: 1000, color: '#FFFFFF', desc: 'A plain tee with short sleeves.' },
    { id: 'scarf',     slot: 'neck',  name: 'Cozy Scarf',       price: 1100, color: '#E83E3E', desc: 'A warm scarf that trails as you run.' },
    { id: 'jersey',    slot: 'top',   name: 'Sports Jersey',    price: 2000, color: '#2BB3C0', accent: '#FFFFFF', desc: 'Sleeveless, with a racing stripe.' },
    { id: 'hoodie',    slot: 'top',   name: 'Hoodie',           price: 2200, color: '#3A3F55', desc: 'Long sleeves and a hood.' },
    { id: 'cape',      slot: 'back',  name: 'Hero Cape',        price: 3500, color: '#C0142B', accent: '#FFC928', perk: 'Wind pushes you 20% less', desc: 'A flared hero cape with a gold lining and star, rippling behind you.' },
    // ---- level rewards (not sold in the shop) ----
    { id: 'headband',    slot: 'hat',   name: 'Sweatband',      level: 3,  color: '#FF4F4F', desc: 'Level 3 reward. Serious runner energy.' },
    { id: 'sandals',     slot: 'shoes', name: 'Beach Sandals',  level: 5,  color: '#E9C38B', accent: '#2BB3C0', desc: 'Level 5 reward. Breezy.' },
    { id: 'varsity',     slot: 'top',   name: 'Varsity Jacket', level: 10, color: '#1E3A8A', accent: '#F4F4F4', desc: 'Level 10 reward. Two-tone with white sleeves.' },
    { id: 'wizard',      slot: 'hat',   name: 'Wizard Hat',     level: 12, color: '#4B2A9E', accent: '#FFD447', desc: 'Level 12 reward. Tall, pointy and magical.' },
    { id: 'rocketboots', slot: 'shoes', name: 'Rocket Boots',   level: 18, color: '#9AA3B5', accent: '#FF5A1F', glow: true, perk: 'Jumps 10% higher', desc: 'Level 18 reward. Leaves a fiery trail.' },
    { id: 'viking',      slot: 'hat',   name: 'Viking Helmet',  level: 20, color: '#8C96A8', accent: '#F4EBD0', desc: 'Level 20 reward. Horns included.' },
    { id: 'wings',       slot: 'back',  name: 'Angel Wings',    level: 23, color: '#FFFFFF', glow: true, perk: 'Hold jump while falling to glide', desc: 'Level 23 reward. Gently flapping, softly glowing.' },
    { id: 'goldkicks',   slot: 'shoes', name: 'Golden Kicks',   level: 28, color: '#FFC928', accent: '#FFF3B0', glow: true, perk: '+15% coins', desc: 'Level 28 reward. Solid gold, with a gold trail.' },
    { id: 'halo',        slot: 'hat',   name: 'Halo',           level: 30, color: '#FFE27A', glow: true, perk: 'Blocks the first hit of every run', desc: 'Level 30 reward. A glowing ring above your head.' },
    { id: 'jetpack',     slot: 'back',  name: 'Jetpack',        level: 33, color: '#7A8396', accent: '#FF8A3D', perk: 'Double jump', desc: 'Level 33 reward. Twin flames out the back.' },
    { id: 'legendcape',  slot: 'back',  name: 'Legend Cape',    level: 40, color: '#4B1E8C', accent: '#FFC928', perk: 'Wind rescues need 30% fewer presses, and orbs drift toward you', desc: 'Level 40 reward. Royal purple, lined with gold.' },
    { id: 'champcrown',  slot: 'hat',   name: 'Champion Crown', level: 45, color: '#FFD447', glow: true, perk: '+20% points and +10% coins', desc: 'Level 45 reward. Only true champions wear this.' },
  ];
  const GEAR_SLOTS = ['hat', 'shoes', 'top', 'neck', 'back', 'legs'];
  const TAB_SLOTS = { hats: ['hat'], kicks: ['shoes'], clothes: ['top', 'neck', 'back', 'legs'] };
  let gearMeshes = [], previewGear = {};
  const gearMat = (c, glowing) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide, emissive: glowing ? c : 0x000000, emissiveIntensity: glowing ? 0.6 : 0 });
  function shellGeo(y0, y1, grow) {
    const prof = [[0.0, 0.80], [0.17, 0.83], [0.24, 0.92], [0.26, 1.02], [0.23, 1.14], [0.215, 1.22], [0.24, 1.34], [0.265, 1.44], [0.25, 1.53], [0.2, 1.6], [0.12, 1.65], [0.0, 1.67]];
    const curve = new THREE.SplineCurve(prof.map(q => new THREE.Vector2(q[0], q[1])));
    const pts = curve.getPoints(80).filter(q => q.y >= y0 && q.y <= y1).map(q => new THREE.Vector2(Math.max(0.0001, q.x * grow), q.y));
    return new THREE.LatheGeometry(pts, 28);
  }
  function addGear(parent, mesh, pos, rot, scl) {
    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) mesh.scale.set(scl[0], scl[1], scl[2]);
    parent.add(mesh); gearMeshes.push(mesh);
    return mesh;
  }
  function buildGear(it) {
    const M = gearMat(it.color, it.glow), A = it.accent ? gearMat(it.accent, it.glow) : M, b = rig.body;
    if (it.id === 'cap') {
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M), [0, 1.88, 0]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20), M), [0, 1.9, -0.17], null, [1, 1, 1.3]);
    } else if (it.id === 'beanie') {
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M), [0, 1.87, 0], null, [1, 1.2, 1]);
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.045, 10, 28), M), [0, 1.9, 0], [Math.PI / 2, 0, 0]);
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), M), [0, 2.18, 0]);
    } else if (it.id === 'party') {
      addGear(b, new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 20), M), [0.03, 2.2, 0], [0, 0, -0.15]);
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gearMat('#FFE14D')), [0.06, 2.39, 0]);
    } else if (it.id === 'tophat') {
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 24), M), [0, 2.19, 0]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 28), M), [0, 2.03, 0]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 24), A), [0, 2.08, 0]);
    } else if (it.id === 'crown' || it.id === 'champcrown') {
      if (it.id === 'champcrown') addGear(b, glow(0xFFD447, 0.9, 0.5), [0, 2.12, 0]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.12, 12, 1, true), M), [0, 2.07, 0]);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; addGear(b, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), M), [Math.cos(a) * 0.18, 2.18, Math.sin(a) * 0.18]); }
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gearMat('#FF3B6B', true)), [0, 2.07, -0.19]);
      trailAnchors.push({ obj: addGear(b, new THREE.Object3D(), [0, 2.22, 0.06]), colors: [0xFFD447, 0xFFF3B0, 0xFFB347], size: 0.24, life: 0.75, rise: 0.35 }); // golden sparkle trail
    } else if (it.id === 'headband') {
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.218, 0.032, 8, 28), M), [0, 1.93, 0], [Math.PI / 2, 0, 0]);
    } else if (it.id === 'wizard') {
      addGear(b, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.56, 22), M), [0.02, 2.24, 0.02], [0.12, 0, -0.1]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 28), M), [0, 1.98, 0]);
      addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 22), A), [0, 2.02, 0]);
    } else if (it.id === 'viking') {
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.3, metalness: 0.6 })), [0, 1.88, 0]);
      for (const sx of [-1, 1]) addGear(b, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 12), A), [sx * 0.24, 2.02, 0], [0, 0, -sx * 0.95]);
    } else if (it.id === 'halo') {
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 10, 32), M), [0, 2.24, 0], [Math.PI / 2, 0, 0]);
      addGear(b, glow(0xFFE27A, 0.7, 0.55), [0, 2.24, 0]);
    } else if (it.id === 'wings') {
      const wing = new THREE.Shape();
      wing.moveTo(0, 0); wing.bezierCurveTo(0.25, 0.3, 0.6, 0.35, 0.72, 0.18); wing.bezierCurveTo(0.6, 0.05, 0.55, -0.15, 0.4, -0.35); wing.bezierCurveTo(0.25, -0.3, 0.1, -0.2, 0, 0);
      const wg = new THREE.ShapeGeometry(wing);
      rig.wings = [];
      for (const sx of [-1, 1]) {
        const w = addGear(b, new THREE.Mesh(wg, M), [sx * 0.06, 1.45, 0.2], null, [sx, 1, 1]);
        rig.wings.push({ m: w, sx });
      }
      addGear(b, glow(0xFFFFFF, 1.1, 0.25), [0, 1.4, 0.3]);
    } else if (it.id === 'jetpack') {
      for (const sx of [-1, 1]) {
        addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 16), M), [sx * 0.095, 1.32, 0.26]);
        addGear(b, new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.1, 16), A), [sx * 0.095, 1.58, 0.26]);
        addGear(b, glow(0xFF8A3D, 0.3, 0.9), [sx * 0.095, 1.06, 0.26]);
        trailAnchors.push({ obj: addGear(b, new THREE.Object3D(), [sx * 0.095, 1.05, 0.26]), colors: [0xFF8A3D, 0xFFD23F, 0xFF5A1F], size: 0.2, life: 0.4, rise: -0.6 });
      }
      addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), M), [0, 1.35, 0.2]);
    } else if (it.id === 'sandals') {
      for (const leg of rig.legs) {
        addGear(leg.knee, new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.035, 0.37), M), [0, -0.5, -0.07]);
        addGear(leg.knee, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), A), [0, -0.455, -0.13]);
        addGear(leg.knee, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), A), [0, -0.455, 0.0]);
      }
    } else if (it.slot === 'shoes') {
      for (const leg of rig.legs) {
        const k = leg.knee;
        addGear(k, new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), M), [0, -0.44, -0.07], null, [1.12, 0.82, 1.7]);
        addGear(k, new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.035, 0.37), A), [0, -0.5, -0.07]);
        if (it.id === 'hightops' || it.id === 'boots' || it.id === 'rocketboots') addGear(k, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.095, it.id !== 'hightops' ? 0.2 : 0.15, 14), M), [0, -0.36, -0.01]);
        const tc = { neonkicks: [0x22E1FF, 0xFF4FD8], goldkicks: [0xFFD447, 0xFFF3B0], rocketboots: [0xFF7A1F, 0xFFD23F, 0xFF3B1F] }[it.id];
        if (tc) { // glowing kicks leave a trail
          addGear(k, glow(tc[0], 0.5, 0.6), [0, -0.48, -0.07]);
          trailAnchors.push({ obj: addGear(k, new THREE.Object3D(), [0, -0.5, 0.02]), colors: tc, size: 0.2, life: it.id === 'rocketboots' ? 0.35 : 0.45, rise: 0 });
        }
      }
    } else if (it.id === 'varsity') {
      addGear(b, garment({ torso: [0.95, 1.66] }, 0.022, it.color));
      addGear(b, garment({ arm: [0.0, 0.93] }, 0.024, it.accent));
      addGear(b, garment({ torso: [0.94, 0.99] }, 0.032, it.accent));
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), A), [0, 1.66, 0], [Math.PI / 2, 0, 0]);
    } else if (it.id === 'tee' || it.id === 'hoodie' || it.id === 'jersey') {
      const spec = { tee: { torso: [1.0, 1.66], arm: [-1, 0.36] }, hoodie: { torso: [0.88, 1.68], arm: [-1, 0.93] }, jersey: { torso: [1.0, 1.64] } }[it.id];
      const top = addGear(b, garment(spec, 0.022, it.color));
      if (it.id === 'jersey') addGear(b, garment({ torso: [1.36, 1.44] }, 0.032, it.accent));
      if (it.id === 'hoodie') addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M), [0, 1.72, 0.12], [1.9, 0, 0], [1, 0.8, 1]); // hood hangs behind the neck, opening toward the head
      return top;
    } else if (it.id === 'shorts') {
      addGear(b, garment({ torso: [0.8, 1.12], leg: [-1, 0.36] }, 0.022, it.color));
    } else if (it.id === 'scarf') {
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 10, 24), M), [0, 1.69, 0], [Math.PI / 2, 0, 0]);
      rig.scarfTail = addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.03), M), [0.08, 1.55, 0.14]);
    } else if (it.id === 'cape' || it.id === 'legendcape') {
      // flared shape with a scalloped hem, red outside and gold lining inside
      const g = new THREE.PlaneGeometry(0.6, 1.0, 6, 12); g.translate(0, -0.5, 0);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), t = -y;
        let ny = y;
        if (t > 0.99) ny -= Math.abs(Math.sin((x / 0.3) * Math.PI * 1.5)) * 0.09;
        pos.setXYZ(i, x * (0.62 + 0.58 * t), ny, 0);
      }
      g.computeVertexNormals();
      g.userData.base = Float32Array.from(pos.array);
      const cape = addGear(b, new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.5, side: THREE.FrontSide })), [0, 1.6, 0.2]);
      const lining = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: it.accent, roughness: 0.4, metalness: 0.2, side: THREE.BackSide }));
      cape.add(lining); gearMeshes.push(lining);
      const star = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.04 : 0.095, a = Math.PI / 2 + k * Math.PI / 5; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const emblem = new THREE.Mesh(new THREE.ShapeGeometry(star), gearMat(it.accent));
      emblem.position.set(0, -0.3, 0.012); cape.add(emblem); gearMeshes.push(emblem);
      addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.05), M), [0, 1.61, 0.18]);
      for (const sx of [-1, 1]) addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), gearMat(it.accent)), [sx * 0.2, 1.61, 0.15]);
      rig.cape = cape;
    }
  }
  // ---------- cosmetic trails: continuous glowing ribbons ----------
  let trailAnchors = [], ribbons = [];
  const trailV = new THREE.Vector3();
  const ribbonTex = (() => { // soft at the edges, bright in the middle, so the ribbon reads as a beam of light
    const c = document.createElement('canvas'); c.width = 64; c.height = 4;
    const g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 64, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 64, 4);
    return new THREE.CanvasTexture(c);
  })();
  function makeRibbon(an) {
    const N = Math.max(16, Math.round(an.life * 80));
    const pos = new Float32Array(N * 6), col = new Float32Array(N * 6), uv = new Float32Array(N * 4), idx = [];
    for (let i = 0; i < N; i++) { uv.set([0, i / N, 1, i / N], i * 4); if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ribbonTex, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; scene.add(mesh);
    return { an, N, pts: [], mesh, geo, cols: an.colors.map(c => new THREE.Color(c)) };
  }
  function clearRibbons() { for (const r of ribbons) { scene.remove(r.mesh); r.geo.dispose(); r.mesh.material.dispose(); } ribbons = []; }
  function updateTrails(dt, dz) {
    if (ribbons.length !== trailAnchors.length || ribbons.some((r, i) => r.an !== trailAnchors[i])) { clearRibbons(); ribbons = trailAnchors.map(makeRibbon); }
    const sz = player ? player.s : 1, drift = dz > 0 ? dz : dt * 1.6 * sz, cam = camera.position;
    for (const r of ribbons) {
      r.mesh.visible = rig.root.visible && rigScaleMul > 0.05;
      for (const q of r.pts) { q.z += drift; q.y += r.an.rise * sz * dt; }
      r.an.obj.getWorldPosition(trailV);
      if (r.pts[0] && r.pts[0].distanceTo(trailV) > 6 * Math.max(1, sz)) r.pts.length = 0; // jumped somewhere new: start fresh
      r.pts.unshift(trailV.clone());
      if (r.pts.length > r.N) r.pts.length = r.N;
      const pos = r.geo.attributes.position.array, col = r.geo.attributes.color.array, n = r.pts.length, w = r.an.size * 0.6 * sz;
      for (let i = 0; i < r.N; i++) {
        const pt = r.pts[Math.min(i, n - 1)], pn = r.pts[Math.min(i + 1, n - 1)], pp = r.pts[Math.min(Math.max(i - 1, 0), n - 1)];
        const tx = pn.x - pp.x, ty = pn.y - pp.y, tz = pn.z - pp.z, vx = cam.x - pt.x, vy = cam.y - pt.y, vz = cam.z - pt.z;
        let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
        const f = i < n ? 1 - i / (r.N - 1) : 0, nl = (Math.hypot(nx, ny, nz) || 1) / (w * (0.3 + 0.7 * f));
        nx /= nl; ny /= nl; nz /= nl;
        const o = i * 6;
        pos[o] = pt.x + nx; pos[o + 1] = pt.y + ny; pos[o + 2] = pt.z + nz;
        pos[o + 3] = pt.x - nx; pos[o + 4] = pt.y - ny; pos[o + 5] = pt.z - nz;
        const c = r.cols[Math.min(r.cols.length - 1, Math.floor(i / r.N * r.cols.length))], k = f * f;
        col[o] = col[o + 3] = c.r * k; col[o + 1] = col[o + 4] = c.g * k; col[o + 2] = col[o + 5] = c.b * k;
      }
      r.geo.attributes.position.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
    }
  }
  const garmentCache = {};
  function garment(spec, thick, color, glowing) {
    const key = JSON.stringify(spec) + '|' + thick;
    if (!garmentCache[key]) garmentCache[key] = rig.garmentGeo(spec, thick);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, skinning: true, side: THREE.DoubleSide, emissive: glowing ? color : 0x000000, emissiveIntensity: glowing ? 0.5 : 0 });
    const m = new THREE.SkinnedMesh(garmentCache[key], mat);
    m.frustumCulled = false; m.userData.keepGeo = true;
    m.bind(rig.torso.skeleton, rig.torso.bindMatrix);
    return m;
  }
  const darkCol = c => new THREE.Color(c).multiplyScalar(0.62).getStyle();
  function decalMat(text, fg, bg, size = 128) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, 7); g.fill(); }
    g.fillStyle = fg; g.font = `bold ${Math.floor(size * 0.6)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, size / 2, size / 2 + size * 0.04);
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, roughness: 0.6, side: THREE.DoubleSide });
  }
  // little details that make each item look made, not just shaped
  function gearDetails(it) {
    const b = rig.body, dark = c => gearMat(new THREE.Color(c).multiplyScalar(0.62).getStyle()), white = () => gearMat('#F4F4F6');
    const acc = it.accent ? gearMat(it.accent, it.glow) : white();
    const shoes = ['sneakers', 'hightops', 'boots', 'neonkicks', 'goldkicks', 'rocketboots'];
    if (it.id === 'cap') {
      addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), dark(it.color)), [0, 2.115, 0]);
      addGear(b, new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), decalMat('★', '#FFFFFF', '#E83E3E')), [0, 1.995, -0.205], [0.32, Math.PI, 0]);
    } else if (it.id === 'beanie') {
      for (let k = 0; k < 2; k++) addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 8, 32), dark(it.color)), [0, 1.875 + k * 0.05, 0], [Math.PI / 2, 0, 0]);
    } else if (it.id === 'tophat') {
      addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.02), gearMat('#FFD447', true)), [0, 2.08, -0.168]);
    } else if (it.id === 'headband') {
      addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.015), white()), [0, 1.93, -0.24]);
    } else if (it.id === 'viking') {
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 36), dark(it.color)), [0, 1.9, 0], [Math.PI / 2, 0, 0]);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), gearMat('#D9DEE6')), [Math.cos(a) * 0.255, 1.9, Math.sin(a) * 0.255]); }
    } else if (it.id === 'wizard') {
      for (let k = 0; k < 5; k++) { const a = k * 1.4, y = 2.06 + k * 0.07, r = 0.19 - k * 0.025; addGear(b, glow(0xFFD447, 0.09, 0.9), [Math.cos(a) * r, y, Math.sin(a) * r]); }
    } else if (shoes.includes(it.id)) {
      const lace = it.id === 'boots' ? dark('#7A4A2A') : white();
      for (const leg of rig.legs) {
        const k = leg.knee;
        for (let l = 0; l < 3; l++) addGear(k, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.016), lace), [0, -0.366 - l * 0.004, -0.05 - l * 0.045], [0.25, 0, 0]);
        addGear(k, new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), acc), [0, -0.455, -0.205], null, [1.25, 0.8, 0.8]); // toe cap
        for (const sx of [-1, 1]) addGear(k, new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.028, 0.15), acc), [sx * 0.112, -0.44, -0.08]); // side stripes
        if (it.id === 'boots' || it.id === 'rocketboots') for (let t = 0; t < 4; t++) addGear(k, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.03), dark('#2A1A10')), [0, -0.522, -0.2 + t * 0.09]); // treads
        if (it.id === 'hightops') addGear(k, new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), decalMat('★', '#FFFFFF', '#2F3A8C', 64)), [0.098, -0.33, -0.01], [0, Math.PI / 2, 0]);
      }
    } else if (it.id === 'tee') {
      addGear(b, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24), dark(it.color)), [0, 1.645, 0], [Math.PI / 2, 0, 0]);
      addGear(b, garment({ torso: [1.0, 1.05] }, 0.032, darkCol(it.color)));
      addGear(b, garment({ arm: [0.3, 0.36] }, 0.032, darkCol(it.color)));
    } else if (it.id === 'hoodie') {
      addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.02), dark(it.color)), [0, 1.12, -0.205], [0.12, 0, 0]); // pocket
      for (const sx of [-1, 1]) addGear(b, new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6), white()), [sx * 0.045, 1.53, -0.232], [0.15, 0, 0]); // drawstrings
      addGear(b, garment({ torso: [0.88, 0.94] }, 0.032, darkCol(it.color)));
      addGear(b, garment({ arm: [0.86, 0.93] }, 0.032, darkCol(it.color)));
    } else if (it.id === 'jersey') {
      addGear(b, new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), decalMat('10', it.accent || '#FFFFFF', null)), [0, 1.33, 0.228]);
      for (const sx of [-1, 1]) addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.46, 0.06), acc), [sx * 0.29, 1.3, 0]);
    } else if (it.id === 'varsity') {
      addGear(b, new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), decalMat('S', it.color, it.accent || '#FFFFFF', 96)), [0.11, 1.43, -0.232], [0, Math.PI, 0]);
      for (let k = 0; k < 4; k++) addGear(b, new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), white()), [0, 1.52 - k * 0.12, -0.228]); // snaps
    } else if (it.id === 'shorts') {
      addGear(b, garment({ torso: [1.06, 1.12] }, 0.032, darkCol(it.color)));
      addGear(b, garment({ leg: [0.31, 0.36] }, 0.032, '#F4F4F6'));
    } else if (it.id === 'scarf' && rig.scarfTail) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.04, 0.034), white()); st.position.y = -0.06; rig.scarfTail.add(st); gearMeshes.push(st);
      for (let k = 0; k < 4; k++) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.02), gearMat(it.color)); fr.position.set(-0.033 + k * 0.022, -0.17, 0); rig.scarfTail.add(fr); gearMeshes.push(fr); }
    } else if (it.id === 'wings' && rig.wings) {
      for (const w of rig.wings) { const inner = new THREE.Mesh(w.m.geometry, gearMat('#E6EEFF', true)); inner.scale.set(0.72, 0.72, 1); inner.position.z = 0.012; w.m.add(inner); gearMeshes.push(inner); }
    } else if (it.id === 'jetpack') {
      for (const sx of [-1, 1]) addGear(b, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.015), dark('#3A3F4E')), [sx * 0.12, 1.42, -0.228], [0.1, 0, 0]); // straps
    }
  }
  function applyGear() {
    for (const m of gearMeshes) {
      if (m.parent) m.parent.remove(m);
      if (m.geometry && !m.isSprite && !m.userData.keepGeo) m.geometry.dispose();
      if (m.material && !m.isSprite) m.material.dispose();
    }
    gearMeshes = []; rig.cape = null; rig.scarfTail = null; rig.wings = null; trailAnchors = [];
    for (const slot of GEAR_SLOTS) {
      const id = slot in previewGear ? previewGear[slot] : save.gear[slot];
      const it = COSMETICS.find(c => c.id === id);
      if (it) { buildGear(it); gearDetails(it); }
    }
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x3a1f0b, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // ================= skins =================
  let activeMap = mapById(save.map), activeRunner = runnerById(save.runner);
  // light, mood and little living effects for each map
  const ATMO = {
    meadow:   { sky: '#FFF1D6', ground: '#6E8A4A', hemi: 0.8,  sun: '#FFE2A8', sunI: 0.95, sunPos: [-6, 8, 5],  rim: '#FFC28A', rimI: 0.45 },
    desert:   { sky: '#FFD9A8', ground: '#B5703A', hemi: 0.75, sun: '#FFB46B', sunI: 1.1,  sunPos: [-8, 5, -4], rim: '#FF7A4A', rimI: 0.6, fx: 'heat' },
    glacier:  { sky: '#E6F4FF', ground: '#9CC4E0', hemi: 0.95, sun: '#FFFFFF', sunI: 0.85, sunPos: [4, 12, 6],  rim: '#BFE4FF', rimI: 0.5 },
    marsh:    { sky: '#9AA8C0', ground: '#3A3428', hemi: 0.6,  sun: '#C8D2E2', sunI: 0.45, sunPos: [-3, 10, 4], rim: '#8EA0C0', rimI: 0.3, fx: 'lightning' },
    neon:     { sky: '#5A3A9A', ground: '#1A0A30', hemi: 0.55, sun: '#FF8AE6', sunI: 0.5,  sunPos: [3, 6, 6],   rim: '#22E1FF', rimI: 0.9, stars: true, fx: 'neon' },
    clouds:   { sky: '#FFE9D0', ground: '#8C7AD8', hemi: 0.85, sun: '#FFD9A0', sunI: 0.95, sunPos: [-6, 7, 5],  rim: '#B98AF0', rimI: 0.6 },
    reef:     { sky: '#7FE0E8', ground: '#0A4A5A', hemi: 0.7,  sun: '#BFFBFF', sunI: 0.7,  sunPos: [0, 14, 2],  rim: '#4FD1C5', rimI: 0.4, fx: 'caustics' },
    haunted:  { sky: '#6A7A9A', ground: '#1A1428', hemi: 0.5,  sun: '#B8FFC8', sunI: 0.5,  sunPos: [5, 9, -3],  rim: '#7A5BD6', rimI: 0.5, stars: true, fx: 'lightning' },
    volcanic: { sky: '#5A2A20', ground: '#FF5A1F', hemi: 0.6,  sun: '#FF9A5A', sunI: 0.75, sunPos: [-5, 6, -6], rim: '#FF3B1F', rimI: 0.8, fx: 'pulse' },
    autumn:   { sky: '#FFE2B8', ground: '#7A5A2A', hemi: 0.8,  sun: '#FFC27A', sunI: 1.0,  sunPos: [-7, 6, 4],  rim: '#FF9A4A', rimI: 0.5 },
    blossom:  { sky: '#FFE6F0', ground: '#7CA05A', hemi: 0.9,  sun: '#FFF0F6', sunI: 0.8,  sunPos: [-5, 10, 5], rim: '#FFB7D2', rimI: 0.5 },
    aurora:   { sky: '#6AF0C0', ground: '#2B3A5A', hemi: 0.65, sun: '#DDF4FF', sunI: 0.55, sunPos: [3, 10, -5], rim: '#7A5BFF', rimI: 0.7, stars: true, fx: 'aurora' },
    rainbow:  { sky: '#C9A6FF', ground: '#1B0B4A', hemi: 0.6,  sun: '#FFFFFF', sunI: 0.6,  sunPos: [0, 10, 6],  rim: '#FF7AD9', rimI: 0.9, stars: true, fx: 'rainbow' },
  };
  const nightStars = (() => {
    const pos = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) { const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.85 + 0.12), R = 1000; pos.set([Math.cos(u) * Math.sin(v) * R, Math.cos(v) * R, Math.sin(u) * Math.sin(v) * R], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
    pts.visible = false; scene.add(pts);
    return pts;
  })();
  let atmoT = 0, boltT = 5, boltFlash = 0;
  function updateAtmo(dt) {
    const a = ATMO[activeMap.id] || ATMO.meadow;
    atmoT += dt;
    lavaFlowTex.offset.y += dt * 0.45; // the lava streams flow downward
    waterfallTex.offset.y += dt * 1.4; // waterfalls pour
    for (const m of lavaFlowMats) m.emissiveIntensity = 1.05 + 0.45 * Math.sin(atmoT * 1.8 + m.userData.ph); // the magma cracks throb with heat
    if (stageId) return; // the mega stages keep their own look
    if (a.fx === 'lightning') { // distant storm flashes
      boltT -= dt;
      if (boltT <= 0) {
        boltT = 5 + Math.random() * 8; boltFlash = 0.35;
        if (!reduceMotion) { const f = $('flash'); f.classList.add('soft'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); setTimeout(() => f.classList.remove('soft'), 600); }
      }
      boltFlash = Math.max(0, boltFlash - dt);
      sunLight.intensity = a.sunI + boltFlash * 6;
    } else if (a.fx === 'caustics') { // shimmering underwater light
      sunLight.intensity = a.sunI * (0.82 + 0.14 * Math.sin(atmoT * 3.1) + 0.08 * Math.sin(atmoT * 7.3));
      sunLight.position.x = a.sunPos[0] + Math.sin(atmoT * 0.7) * 4;
    } else if (a.fx === 'pulse') { // the lava glow breathes
      hemi.groundColor.set(a.ground).multiplyScalar(0.75 + 0.3 * Math.sin(atmoT * 2.2));
    } else if (a.fx === 'aurora') { // the sky light drifts between green and violet
      hemi.color.setHSL(0.42 + 0.14 * Math.sin(atmoT * 0.35), 0.7, 0.66);
    } else if (a.fx === 'rainbow') {
      rim.color.setHSL((atmoT * 0.08) % 1, 1, 0.6);
    } else if (a.fx === 'neon') {
      rim.intensity = a.rimI * (0.85 + 0.15 * Math.sin(atmoT * 9));
    } else if (a.fx === 'heat') { // shimmering midday heat
      sunLight.intensity = a.sunI * (0.95 + 0.05 * Math.sin(atmoT * 5));
    }
  }
  function applyMap(m) {
    activeMap = m;
    drawSky(m); drawTrack(m); buildValley(m);
    scene.fog.color.set(m.fog);
    const fx = mapFx(m);
    scene.fog.near = fx.fogNear; scene.fog.far = fx.fogFar;
    buildWeather(m.weather);
    sun.material.color.set(m.sun);
    sideMat.color.set(m.side);
    cloudMat.color.set(m.cloud);
    trimMat.color.set(m.trim);
    const a = ATMO[m.id] || ATMO.meadow;
    hemi.color.set(a.sky); hemi.groundColor.set(a.ground); hemi.intensity = a.hemi;
    sunLight.color.set(a.sun); sunLight.intensity = a.sunI; sunLight.position.set(a.sunPos[0], a.sunPos[1], a.sunPos[2]);
    rim.color.set(a.rim); rim.intensity = a.rimI;
    nightStars.visible = !!a.stars;
  }
  function runnerHas(id) { return activeRunner.id === id || !!(activeRunner.powers && activeRunner.powers.includes(id)); }
  function applyRunner(r) {
    activeRunner = r;
    avatarMat.color.set(r.color);
    avatarMat.emissive.set(r.glow || '#000000');
    avatarMat.emissiveIntensity = r.glow ? 0.55 : 0;
    rig.style.scale.set(r.shape[0], r.shape[1], r.shape[2]);
    rig.bubble.visible = false;
  }
  applyMap(activeMap);
  applyRunner(activeRunner);
  applyGear();

  // ================= particles =================
  const partGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const partMats = { avatar: avatarMat, green: orbMat, coin: coinMat, block: lambert(0xE0701A), shield: new THREE.MeshBasicMaterial({ color: 0x7FE9F2 }),
    water: lambert(0x7CC4FF), gold: new THREE.MeshBasicMaterial({ color: 0xFFD447 }), zap: new THREE.MeshBasicMaterial({ color: 0xFFF27A }), lava: new THREE.MeshBasicMaterial({ color: 0xFF5A1F }), nova: new THREE.MeshBasicMaterial({ color: 0xFFD966 }) };
  const parts = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(partGeo, avatarMat); m.visible = false; scene.add(m);
    parts.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  function burst(x, y, z, kind, n, power = 6) {
    if (kind === 'block') partMats.block.color.set(activeMap.obstacle);
    let made = 0;
    for (const q of parts) {
      if (made >= n) break;
      if (q.life > 0) continue;
      q.m.material = partMats[kind]; q.m.position.set(x, y, z); q.m.visible = true;
      const a = Math.random() * Math.PI * 2;
      const sc = player ? (player.s < 1 ? Math.max(0.06, player.s * 1.2) : Math.max(1, player.s / 1.36)) : 1;
      q.sc = sc; q.m.scale.setScalar(sc);
      q.vx = Math.cos(a) * power * Math.random() * sc; q.vz = Math.sin(a) * power * Math.random() * sc; q.vy = (2 + Math.random() * power) * sc;
      q.life = 0.5 + Math.random() * 0.4; made++;
    }
  }
  // ---------- break physics: solid debris that tumbles, falls and bounces once ----------
  const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
  const debrisPool = [];
  for (let i = 0; i < 48; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, transparent: true });
    const m = new THREE.Mesh(debrisGeo, mat); m.visible = false; scene.add(m);
    debrisPool.push({ m, mat, life: 0 });
  }
  function shatter(x, y, z, color, n, power, big) {
    const sc = player ? Math.max(0.3, Math.min(2.5, player.s)) : 1;
    let made = 0;
    for (const q of debrisPool) {
      if (made >= n) break;
      if (q.life > 0) continue;
      q.mat.color.set(color); q.mat.opacity = 1;
      const sx = (0.06 + Math.random() * 0.12) * sc * (big ? 1.8 : 1), sy = sx * (0.5 + Math.random()), sz = sx * (0.5 + Math.random());
      q.m.scale.set(sx, sy, sz);
      q.m.position.set(x + (Math.random() - 0.5) * 0.5 * sc, y + (Math.random() - 0.5) * 0.5 * sc, z + (Math.random() - 0.5) * 0.5 * sc);
      q.m.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      q.m.visible = true;
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random() * 0.7, spd = power * (big ? 1.6 : 1) * sc;
      q.vx = Math.cos(a) * spd * (0.4 + Math.random()); q.vz = Math.sin(a) * spd * (0.4 + Math.random()); q.vy = spd * up + Math.random() * 2;
      q.rvx = (Math.random() - 0.5) * 16; q.rvy = (Math.random() - 0.5) * 16; q.rvz = (Math.random() - 0.5) * 16;
      q.life = (big ? 1.1 : 0.75) + Math.random() * 0.5; q.max = q.life; q.bounced = false; q.floorY = y - sy;
      made++;
    }
  }
  function updateDebris(dt) {
    for (const q of debrisPool) {
      if (q.life <= 0) continue;
      q.life -= dt; q.vy -= 28 * dt;
      q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.position.z += q.vz * dt;
      q.m.rotation.x += q.rvx * dt; q.m.rotation.y += q.rvy * dt; q.m.rotation.z += q.rvz * dt;
      if (!q.bounced && q.vy < 0 && q.m.position.y <= q.floorY) { q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; q.rvx *= 0.5; q.rvz *= 0.5; q.bounced = true; }
      q.mat.opacity = Math.max(0, q.life / q.max);
      if (q.life <= 0) q.m.visible = false;
    }
  }
  // which colour a broken obstacle shatters into
  function breakColor(o) {
    if (o.type === 'gate' || o.type === 'hurdle') return activeMap.gate;
    if (o.type === 'tsunami') return 0x4FA8E8;
    if (o.type === 'bomb') return 0xFF5A1F;
    if (o.type === 'lightning') return 0xFFE14D;
    if (o.type === 'meteor') return 0xFF8A3D;
    if (o.type === 'rift') return 0xFF6A1F;
    if (o.type === 'blackhole') return 0xB06BFF;
    return activeMap.obstacle;
  }
  function updateParticles(dt) {
    for (const q of parts) {
      if (q.life <= 0) continue;
      q.life -= dt; q.vy -= 22 * (q.sc || 1) * dt;
      q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.position.z += q.vz * dt;
      if (q.life <= 0) q.m.visible = false;
    }
  }
  const clearParticles = () => { for (const q of parts) { q.life = 0; q.m.visible = false; } };

  // ================= state =================
  // title | avatars | shop | countdown | play | pause | dying | falling | over | transition
  let state = 'title';
  let player, obs = [], speed = 15, elapsed = 0, score = 0, distSince = 0, nextGap = 30, lastType = '';
  let shake = 0, dieT = 0, cause = '', clock = 0, countT = 0, countStep = 0, toastLater = null, runCoins = 0;
  const input = { left: false, right: false, down: false, jumpHeld: false };
  let lastHud = '';

  function reset() {
    for (const o of obs) removeObs(o);
    obs = [];
    clearParticles();
    player = { x: 0, y: 0, vy: 0, vx: 0, level: START_LEVEL, s: 1, inv: 0, onGround: true, buffer: 0, coyote: 0, jumps: 0,
               phase: 0, air: 0, idle: 1, squash: 0, tumble: 0, turn: 0, shield: ['guardian', 'seraph'].some(runnerHas), shieldT: 0, novaUsed: false, lastPush: 'wind', turbo: 0, spring: 0, surge: 0, surgeT: 0, galaxyT: 0, shrinkTo: -1, shrinkT: 0, boost: 0, boostSpecial: false, photon: 0, photonT: 0, light: 0, lsStreak: 0, lsCooldown: 0, cfx: {}, diffSeen: 0 };
    if (runnerHas('galaxy')) { player.level = START_LEVEL + 1; player.s = S[START_LEVEL + 1]; }
    speed = 15; elapsed = 0; score = 0; distSince = 0; nextGap = 30; lastType = ''; shake = 0; toastLater = null; runCoins = 0; warnQueue = []; padIn = 3; for (const k in disasterSeen) delete disasterSeen[k]; lastDisasterWarn = -99; if (typeof clearChaos === 'function') clearChaos(); if (typeof clearLightspeedFX === 'function') clearLightspeedFX(); $('warnings').innerHTML = '';
    if (typeof endQte === 'function' && qte) { qte = null; qteEl.hidden = true; wrap.classList.remove('slowmo'); }
    if (typeof setStage === 'function') { trackHalf = TRACK_HALF; track.scale.x = slab.scale.x = 1; setStage(0); }
    rig.root.visible = true; rig.root.rotation.set(0, 0, 0);
    if (typeof clearVolcano === 'function') clearVolcano();
    lastHud = '';
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  // every hazard warns in its own colour, and warnings stack instead of replacing each other
  const WARN = {
    wind: '#7CC8FF', hurricane: '#C9C3F0', tsunami: '#2F86FF', volcano: '#FF3B1F',
    sound: '#FF5FD2', zap: '#D4FF3D', lightning: '#FFE14D', meteor: '#FF8A3D',
    quake: '#C68A55', blackhole: '#B06BFF', power: '#FFC928',
  };
  let warnQueue = [];
  function warn(text, color, ms = 2000, cls = '') {
    const box = $('warnings');
    while (box.children.length >= 4) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'warn' + (cls ? ' ' + cls : ''); el.style.setProperty('--wc', color);
    const dot = document.createElement('i');
    el.append(dot, text);
    box.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  // disaster announcements are kept rare: only the big, dangerous ones get a pill, never two at once,
  // each kind at most once every 18 seconds, and never within 8 seconds of any other one
  const disasterSeen = {}; let lastDisasterWarn = -99;
  function warnDisaster(kind, text, color) {
    if (clock - (disasterSeen[kind] === undefined ? -99 : disasterSeen[kind]) < 18 || clock - lastDisasterWarn < 8) return;
    disasterSeen[kind] = lastDisasterWarn = clock;
    document.querySelectorAll('#warnings .warn.disaster').forEach(e => e.remove());
    warn(text, color, 1500, 'disaster');
  }
  const queueWarn = (text, color, at, kind) => warnQueue.push({ text, color, at, kind });
  function toast(text, big) {
    toastEl.textContent = text;
    toastEl.classList.toggle('count', !!big);
    toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  }

  // ================= obstacles =================
  function obstacleMat(color, map) {
    return new THREE.MeshLambertMaterial({ color, map: map || null, transparent: true, opacity: 1 });
  }
  function addCrate(x, w, zOff = 0) {
    const hs = [0.6, 0.85, 1.1, 1.4];
    const maxIdx = Math.min(3, Math.floor(elapsed / 12) + diffTier());
    const h = hs[Math.floor(Math.random() * (maxIdx + 1))];
    const d = rand(1.0, 1.5);
    const mat = obstacleMat(activeMap.obstacle, crateTex);
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    const z = SPAWN_Z - zOff;
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    obs.push({ type: 'crate', x, z, w, h, d, obj: mesh, mats: [mat], hit: false });
  }
  function addGate() {
    const c = GATE_CLEAR[Math.floor(Math.random() * GATE_CLEAR.length)];
    const group = new THREE.Group();
    const mat = obstacleMat(activeMap.gate, stripeTex);
    mat.opacity = 0.9;
    const panelH = GATE_TOP - c;
    const panel = new THREE.Mesh(boxGeo, mat);
    panel.scale.set(TRACK_HALF * 2 + 1.2, panelH, 0.35);
    panel.position.y = c + panelH / 2;
    group.add(panel);
    const lip = new THREE.Mesh(boxGeo, trimMat);
    lip.scale.set(TRACK_HALF * 2 + 1.2, 0.14, 0.45); lip.position.y = c + 0.07; group.add(lip);
    const cap = new THREE.Mesh(boxGeo, trimMat);
    cap.scale.set(TRACK_HALF * 2 + 1.2, 0.12, 0.45); cap.position.y = GATE_TOP - 0.06; group.add(cap);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(boxGeo, trimMat);
      post.scale.set(0.35, GATE_TOP + 0.2, 0.45);
      post.position.set(side * (TRACK_HALF + 0.6), (GATE_TOP + 0.2) / 2, 0);
      group.add(post);
    }
    group.position.z = SPAWN_Z;
    scene.add(group);
    obs.push({ type: 'gate', z: SPAWN_Z, c, d: 0.4, obj: group, mats: [mat], mat, hit: false });
  }
  function addTunnel() {
    const d = rand(1.6, 3.0);
    const nHoles = Math.random() < 0.45 ? 2 : 1;
    const holes = [];
    for (let i = 0; i < nHoles; i++) {
      const k = Math.floor(Math.random() * TUNNEL_CLEAR.length);
      const h = TUNNEL_CLEAR[k];
      const w = 0.9 + 0.6 * S[TUNNEL_FIT[k]];
      let x, tries = 0;
      do { x = rand(-TRACK_HALF + w / 2 + 0.2, TRACK_HALF - w / 2 - 0.2); tries++; }
      while (holes.some(o => Math.abs(o.x - x) < (o.w + w) / 2 + 1.2) && tries < 20);
      if (tries < 20) holes.push({ x, w, h, k });
    }
    holes.sort((a, b) => a.x - b.x);
    const solids = [];
    let cursor = -TRACK_HALF - 0.6;
    for (const ho of holes) {
      solids.push({ x0: cursor, x1: ho.x - ho.w / 2, y0: 0, y1: WALL_H });
      solids.push({ x0: ho.x - ho.w / 2, x1: ho.x + ho.w / 2, y0: ho.h, y1: WALL_H });
      cursor = ho.x + ho.w / 2;
    }
    solids.push({ x0: cursor, x1: TRACK_HALF + 0.6, y0: 0, y1: WALL_H });
    const group = new THREE.Group();
    const wallMat = obstacleMat(activeMap.obstacle);
    for (const sd of solids) {
      const m = new THREE.Mesh(boxGeo, wallMat);
      m.scale.set(sd.x1 - sd.x0, sd.y1 - sd.y0, d);
      m.position.set((sd.x0 + sd.x1) / 2, (sd.y0 + sd.y1) / 2, 0);
      group.add(m);
    }
    const capM = new THREE.Mesh(boxGeo, trimMat);
    capM.scale.set(TRACK_HALF * 2 + 1.4, 0.18, d + 0.1); capM.position.y = WALL_H; group.add(capM);
    for (const ho of holes) {
      ho.mat = new THREE.MeshBasicMaterial({ color: activeMap.trim });
      const t = 0.12, fz = d / 2 + 0.04;
      const parts3 = [[ho.x - ho.w / 2 - t / 2, ho.h / 2, t, ho.h + t], [ho.x + ho.w / 2 + t / 2, ho.h / 2, t, ho.h + t], [ho.x, ho.h + t / 2, ho.w + t * 2, t]];
      for (const [px, py, sx, sy] of parts3) {
        const f = new THREE.Mesh(boxGeo, ho.mat);
        f.scale.set(sx, sy, 0.06); f.position.set(px, py, fz); group.add(f);
      }
      // a dark mouth so the hole reads as a tunnel
      const mouth = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2a1406, transparent: true, opacity: 0.35, depthWrite: false }));
      mouth.scale.set(ho.w, ho.h, d); mouth.position.set(ho.x, ho.h / 2, 0); group.add(mouth);
      ho.mouth = mouth;
    }
    group.position.z = SPAWN_Z;
    scene.add(group);
    const o = { type: 'tunnel', z: SPAWN_Z, d, holes, solids, obj: group, mats: [wallMat, ...holes.map(h => h.mat)], hit: false };
    obs.push(o);
    return o;
  }
  // a wide crate with a tiny tunnel through it: only the two smallest sizes fit
  function addBoxTunnel() {
    const k = Math.random() < 0.5 ? 0 : 1;
    const hh = BOX_HOLE[k], hwid = 0.42 + 0.08 * k;
    const w = rand(2.4, 3.6), h = [1.0, 1.25, 1.4][Math.floor(Math.random() * 3)], d = rand(1.6, 2.4);
    const x = rand(-TRACK_HALF + w / 2, TRACK_HALF - w / 2);
    const hx = x + rand(-(w / 2 - hwid / 2 - 0.25), w / 2 - hwid / 2 - 0.25);
    const x0 = x - w / 2, x1 = x + w / 2;
    const solids = [
      { x0, x1: hx - hwid / 2, y0: 0, y1: h },
      { x0: hx - hwid / 2, x1: hx + hwid / 2, y0: hh, y1: h },
      { x0: hx + hwid / 2, x1, y0: 0, y1: h },
    ];
    const group = new THREE.Group();
    const mat = obstacleMat(activeMap.obstacle, crateTex);
    for (const sd of solids) {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(sd.x1 - sd.x0, sd.y1 - sd.y0, d);
      m.position.set((sd.x0 + sd.x1) / 2, (sd.y0 + sd.y1) / 2, 0);
      group.add(m);
    }
    const ho = { x: hx, w: hwid, h: hh, mat: new THREE.MeshBasicMaterial({ color: activeMap.trim }) };
    const t = 0.07, fz = d / 2 + 0.03;
    for (const [px, py, sx, sy] of [[hx - hwid / 2 - t / 2, hh / 2, t, hh + t], [hx + hwid / 2 + t / 2, hh / 2, t, hh + t], [hx, hh + t / 2, hwid + t * 2, t]]) {
      const f = new THREE.Mesh(boxGeo, ho.mat);
      f.scale.set(sx, sy, 0.05); f.position.set(px, py, fz); group.add(f);
    }
    ho.mouth = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2a1406, transparent: true, opacity: 0.45, depthWrite: false }));
    ho.mouth.scale.set(hwid, hh, d); ho.mouth.position.set(hx, hh / 2, 0); group.add(ho.mouth);
    group.position.z = SPAWN_Z;
    scene.add(group);
    obs.push({ type: 'boxTunnel', x, w, h, z: SPAWN_Z, d, holes: [ho], solids, obj: group, mats: [mat, ho.mat], hit: false });
    return d;
  }
  // ---------- disasters, each tied to a size band ----------
  // Crosswind  -> tiny & small   (pushes harder the lighter you are)
  // Tsunami    -> tiny to medium (wade through only if you're taller than the wave)
  // Volcano    -> normal & up    (lava bombs aim at bigger runners)
  // Hurricane  -> big & giant    (its winds blow high up, so only tall runners get caught)
  const TSUNAMI_H = 1.55, HURRICANE_MIN_H = 2.0;
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2E8BE0, transparent: true, opacity: 0.82 });
  const foamMat = new THREE.MeshLambertMaterial({ color: 0xF4FBFF });
  const funnelMat = new THREE.MeshLambertMaterial({ color: 0xB9C2D0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xFF5A1F });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4A2A1A, emissive: 0x7A1E00 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF3B1F, transparent: true, opacity: 0.6, depthWrite: false });
  const bombGeo = new THREE.IcosahedronGeometry(0.42, 0);
  const ringGeo = new THREE.RingGeometry(0.55, 0.85, 28); ringGeo.rotateX(-Math.PI / 2);
  let volcano = null;

  function addTsunami() {
    const d = 1.8, group = new THREE.Group();
    const body = new THREE.Mesh(boxGeo, waterMat);
    body.scale.set(TRACK_HALF * 2 + 1.6, TSUNAMI_H, d); body.position.y = TSUNAMI_H / 2; group.add(body);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, TRACK_HALF * 2 + 1.8, 16), foamMat);
    crest.rotation.z = Math.PI / 2; crest.position.set(0, TSUNAMI_H, 0.3); group.add(crest);
    group.position.z = SPAWN_Z;
    scene.add(group);
    obs.push({ type: 'tsunami', z: SPAWN_Z, d, obj: group, crest, extra: 6, hit: false });
    queueWarn('Tsunami!', WARN.tsunami, elapsed + 1.0, 'tsunami');
    return d + 10;
  }
  const hurricaneZoneMat = new THREE.MeshBasicMaterial({ color: 0xC9C3F0, transparent: true, opacity: 0.25, depthWrite: false });
  function addHurricane() {
    const len = rand(22, 30), group = new THREE.Group();
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF * 2, len), hurricaneZoneMat);
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, 0.02, -len / 2); group.add(zone);
    const funnel = new THREE.Group(), geos = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(1.7 - i * 0.35, 7.5, 20, 1, true); geos.push(g);
      const c = new THREE.Mesh(g, funnelMat); c.rotation.x = Math.PI; c.position.y = 3.75; funnel.add(c);
    }
    const debris = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(boxGeo, trimMat); m.scale.setScalar(rand(0.12, 0.26)); funnel.add(m);
      debris.push({ m, a: rand(0, 6.28), r: rand(0.7, 2.1), y: rand(0.3, 6), sp: rand(2.5, 4.5) });
    }
    funnel.position.z = -len / 2; group.add(funnel);
    group.position.z = SPAWN_Z;
    scene.add(group);
    obs.push({ type: 'hurricane', z: SPAWN_Z, len, obj: group, funnel, debris, geos, ph: rand(0, 6.28), hit: false });
    queueWarn('Hurricane!', WARN.hurricane, elapsed + (Math.abs(SPAWN_Z) - 30) / speed, 'hurricane');
    return len;
  }
  // a huge volcano locked to one spot on screen, far off to one side. It rises up when the eruption starts,
  // stays alive with smoke, lava and sparks, and shrinks away when it ends
  function startVolcano() {
    const side = Math.random() < 0.5 ? -1 : 1, g = new THREE.Group(), spin = new THREE.Group();
    g.add(spin);
    const apex = 70, H = apex + 140, Rb = 95;
    const mt = mountain(Rb, H, apex, '#4A3A32', '#1A1210', false);
    mt.material.fog = false; spin.add(mt);
    const streams = [];
    for (let k = 0; k < 6; k++) { // glowing lava streams running down the slopes
      const a = k / 6 * Math.PI * 2 + Math.random() * 0.5;
      for (let j = 0; j < 9; j++) {
        const y = apex - 3 - j * 7, r = Rb * (apex - y) / H * 1.3 + 1.5;
        const sp = glow(0xFF6A26, 9 - j * 0.5, 0.85); sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r); spin.add(sp); streams.push(sp);
      }
    }
    const craterGlow = glow(0xFF8A3D, 34, 1); craterGlow.position.y = apex + 3; spin.add(craterGlow);
    const smoke = [];
    for (let k = 0; k < 10; k++) {
      const m = new THREE.SpriteMaterial({ map: cloudTex, color: 0x4A4048, transparent: true, depthWrite: false, opacity: 0, fog: false });
      const sp = new THREE.Sprite(m); sp.userData.ph = k / 10; sp.userData.dx = (Math.random() - 0.5) * 30; g.add(sp); smoke.push(sp);
    }
    scene.add(g);
    volcano = { obj: g, spin, side, apex, streams, craterGlow, smoke, sparks: [], t: 0, dur: 8, next: 1.4 };
    warnDisaster('volcano', 'Volcano!', WARN.volcano);
  }
  function tickVolcano(dt) {
    const v = volcano, g = v.obj;
    const rise = Math.min(1, v.t / 1.4), c1 = 1.70158, c3 = c1 + 1;
    let sc = rise >= 1 ? 1 : 1 + c3 * Math.pow(rise - 1, 3) + c1 * Math.pow(rise - 1, 2);
    const endK = Math.max(0, Math.min(1, (v.t - v.dur - 0.5) / 1.6));
    sc *= 1 - endK * endK;
    g.scale.setScalar(Math.max(0.001, sc));
    // always the same spot on screen: it follows the camera instead of the track
    g.position.set(camera.position.x + v.side * 130, camera.position.y - 28 - (1 - rise) * 60 - endK * 60, camera.position.z - 200);
    v.spin.rotation.y += dt * 0.05; // the slow turn makes the ridges shift, so it feels alive
    const active = v.t < v.dur;
    v.craterGlow.scale.setScalar(30 + Math.sin(clock * 7) * 6);
    v.streams.forEach((sp, i) => sp.scale.setScalar((7 + Math.sin(clock * 5 + i) * 1.5) * (active ? 1 : 0.6)));
    for (const sp of v.smoke) { // smoke billows up and spreads out
      sp.userData.ph += dt * 0.12; if (sp.userData.ph > 1) sp.userData.ph -= 1;
      const ph = sp.userData.ph;
      sp.position.set(sp.userData.dx * ph, v.apex + 6 + ph * 80, 0);
      sp.scale.set(20 + ph * 70, (20 + ph * 70) * 0.6, 1);
      sp.material.opacity = (1 - ph) * 0.75 * Math.min(1, v.t / 1.2) * (1 - endK);
    }
    if (active && Math.random() < 0.5) { // sparks and lava flung from the crater
      const sp = glow(0xFFB347, 3 + Math.random() * 3, 1);
      sp.position.set(0, v.apex + 2, 0); g.add(sp);
      const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 18;
      v.sparks.push({ sp, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 25 + Math.random() * 30 });
    }
    v.sparks = v.sparks.filter(q => {
      q.vy -= 30 * dt; q.sp.position.x += q.vx * dt; q.sp.position.y += q.vy * dt; q.sp.position.z += q.vz * dt;
      if (q.sp.position.y < v.apex - 40) { g.remove(q.sp); return false; }
      return true;
    });
    if (active) shake = Math.max(shake, 0.05);
  }
  function clearVolcano() {
    if (!volcano) return;
    scene.remove(volcano.obj);
    volcano.obj.traverse(c => { if (c.isSprite) { if (volcano.smoke.includes(c)) c.material.dispose(); return; } if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    volcano = null;
  }
  // ---------- CHAOS MODE: every 10,000 points, 60 seconds of mayhem at any size ----------
  let chaos = null, nextChaos = 10000, darkT = 0;
  const CHAOS_DUR = 60;
  const inRunNow = () => ['play', 'countdown', 'pause', 'tutpause'].includes(state);
  const CHAOS_PICKUPS = ['moon', 'frenzy', 'slowmo', 'hyper', 'butter', 'swap', 'anvil', 'fogbomb'];
  function startChaos() {
    chaos = { t: 0, next: 1.2 };
    nextChaos += 10000;
    wrap.classList.add('chaos'); $('chaosBar').hidden = false;
    warn('CHAOS MODE!', '#FF4FD8'); toast('CHAOS!'); sfx('power', 0.9, 0.7);
    shake = Math.max(shake, 0.4);
  }
  function endChaos() {
    chaos = null;
    wrap.classList.remove('chaos'); $('chaosBar').hidden = true;
    score += 300;
    warn('Chaos survived! +300', '#7CFF8A');
  }
  function shiftNew(before, dz) { for (let i = before; i < obs.length; i++) { obs[i].z -= dz; obs[i].obj.position.z = obs[i].z; } }
  function fireChaosPickup() { // works at any size: addOrb already places and scales pickups for tiny/normal/mega
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) { const b = obs.length; addOrb(Math.random() < 0.3 ? 'mystery' : CHAOS_PICKUPS[Math.floor(Math.random() * CHAOS_PICKUPS.length)]); shiftNew(b, i * 6); }
  }
  function fireChaosEvent() {
    const lvl = player.level;
    if (lvl <= ATOMIC) { // atomic realm: its own hazards, plus a chance of a chaos pickup
      if (Math.random() < 0.35) fireChaosPickup(); else spawnAtomic();
      return;
    }
    if (lvl >= MEGA) { // mega stages: their own hazards, plus a chance of a chaos pickup
      if (Math.random() < 0.35) fireChaosPickup(); else spawnMega();
      return;
    }
    const ev = weighted([['boosts', 28], ['barrage', 10], ['crates', 8], ['gust', 6], ['tsunami', 5], ['bombs', 8], ['sweepers', 6], ['hurdles', 6], ['orbs', 6], ['lights', 5], ['quake', 5]]);
    const C = '#FF4FD8';
    if (ev === 'boosts') fireChaosPickup();
    else if (ev === 'barrage') { for (let i = 0; i < 3; i++) { const b = obs.length; addBarrel(); shiftNew(b, i * 5); } }
    else if (ev === 'crates') { addCrateField(); }
    else if (ev === 'gust') addGust();
    else if (ev === 'tsunami') addTsunami();
    else if (ev === 'bombs') { for (let i = 0; i < 4; i++) { const b = obs.length; addBomb(); shiftNew(b, i * 7); } }
    else if (ev === 'sweepers') { for (let i = 0; i < 2; i++) { const b = obs.length; addSweeper(); shiftNew(b, i * 9); } }
    else if (ev === 'hurdles') { for (let i = 0; i < 3; i++) { const b = obs.length; addHurdle(); shiftNew(b, i * 7); } }
    else if (ev === 'orbs') { for (let i = 0; i < 4; i++) { const b = obs.length; addOrb(); shiftNew(b, i * 4); } }
    else if (ev === 'lights') { darkT = 4; }
    else if (ev === 'quake') { chaos.quake = 3; }
  }
  function tickChaos(dt) {
    if (tut) return;
    if (!chaos && score >= nextChaos) startChaos();
    if (chaos) {
      chaos.t += dt;
      chaos.next -= dt;
      if (chaos.next <= 0) { chaos.next = rand(2.2, 3.6); fireChaosEvent(); }
      if (chaos.quake > 0) { chaos.quake -= dt; shake = Math.max(shake, 0.35); }
      $('chaosFill').style.width = Math.min(100, chaos.t / CHAOS_DUR * 100) + '%';
      if (chaos.t >= CHAOS_DUR) endChaos();
    }
    if (darkT > 0) darkT -= dt;
    $('dark').classList.toggle('on', darkT > 0);
  }
  function clearChaos() {
    chaos = null; nextChaos = 10000; darkT = 0;
    wrap.classList.remove('chaos'); $('chaosBar').hidden = true; $('dark').classList.remove('on');
  }
  function addBomb() {
    const z0 = -28, y0 = 16;
    const aimed = player.level >= START_LEVEL; // normal size and up are the volcano's targets
    const x = aimed ? Math.max(-TRACK_HALF + 0.5, Math.min(TRACK_HALF - 0.5, player.x + rand(-0.5, 0.5))) : rand(-TRACK_HALF + 0.5, TRACK_HALF - 0.5);
    const group = new THREE.Group();
    const rock = new THREE.Mesh(bombGeo, rockMat); rock.position.set(x, y0, 0); group.add(rock);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.set(x, 0.03, 0); group.add(ring);
    group.position.z = z0;
    scene.add(group);
    const marks = markSpot(group, x, 0.9, 0xFF3B1F, 14);
    obs.push({ type: 'bomb', z: z0, d: 1, x, rock, ring, obj: group, vy: y0 / (-z0 / speed), landed: false, hit: false, marks, mats: marks.mats });
  }

  // ---------- extra normal-stage obstacles ----------
  const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18); barrelGeo.rotateX(Math.PI / 2);
  // rolling barrel: crosses the track side to side; jump it or time your pass
  function addBarrel() {
    const dir = Math.random() < 0.5 ? -1 : 1, r = 0.55, mat = obstacleMat(activeMap.obstacle, stripeTex);
    const mesh = new THREE.Mesh(barrelGeo, mat), x = -dir * (TRACK_HALF - r);
    mesh.position.set(x, r, SPAWN_Z); scene.add(mesh);
    obs.push({ type: 'barrel', x, r, z: SPAWN_Z, d: 1.1, vx: dir * rand(3, 5), obj: mesh, mats: [mat], hit: false });
  }
  // sweeper: a low bar spinning around a post; jump as it swings round
  function addSweeper() {
    const L = 2.6, group = new THREE.Group(), cx = rand(-1.5, 1.5);
    const postM = obstacleMat(activeMap.trim), barM = obstacleMat(activeMap.obstacle, stripeTex);
    const post = new THREE.Mesh(boxGeo, postM); post.scale.set(0.3, 1.0, 0.3); post.position.set(cx, 0.5, 0); group.add(post);
    const arm = new THREE.Group(); arm.position.set(cx, 0.45, 0);
    const bar = new THREE.Mesh(boxGeo, barM); bar.scale.set(L * 2, 0.18, 0.22); arm.add(bar); group.add(arm);
    group.position.z = SPAWN_Z; scene.add(group);
    obs.push({ type: 'sweeper', x: cx, L, z: SPAWN_Z, d: L * 2, arm, ang: rand(0, 6.28), spin: (Math.random() < 0.5 ? -1 : 1) * rand(1.8, 2.6), obj: group, mats: [postM, barM], hit: false });
  }
  // slider: a tall block sliding back and forth across the lanes; too tall to jump
  function addSlider() {
    const w = rand(1.5, 2.2), h = 2.5, d = 1.1, mat = obstacleMat(activeMap.obstacle, crateTex);
    const mesh = new THREE.Mesh(boxGeo, mat); mesh.scale.set(w, h, d);
    mesh.position.set(0, h / 2, SPAWN_Z); scene.add(mesh);
    obs.push({ type: 'slider', x: 0, w, h, d, z: SPAWN_Z, amp: TRACK_HALF - w / 2, ph: rand(0, 6.28), sp: rand(1.3, 2), obj: mesh, mats: [mat], hit: false });
  }
  // hurdle: a low fence across the whole track; jump it
  function addHurdle() {
    const h = rand(0.45, 0.65), group = new THREE.Group(), mat = obstacleMat(activeMap.gate, stripeTex);
    const bar = new THREE.Mesh(boxGeo, mat); bar.scale.set(TRACK_HALF * 2, 0.16, 0.18); bar.position.y = h; group.add(bar);
    for (let x = -TRACK_HALF + 0.4; x <= TRACK_HALF; x += 2.4) { const leg = new THREE.Mesh(boxGeo, trimMat); leg.scale.set(0.12, h, 0.12); leg.position.set(x, h / 2, 0); group.add(leg); }
    group.position.z = SPAWN_Z; scene.add(group);
    obs.push({ type: 'hurdle', h: h + 0.08, z: SPAWN_Z, d: 0.2, obj: group, mats: [mat], hit: false });
  }
  // crate field: rows of boxes all across the track, each row leaving one way through
  function addCrateField() {
    const rows = 2 + Math.floor(Math.random() * 2);
    for (let r = 0; r < rows; r++) {
      const gap = Math.floor(Math.random() * 4);
      for (let l = 0; l < 4; l++) if (l !== gap) addCrate(-TRACK_HALF + 1 + l * 2, rand(1.3, 1.8), r * 6 + rand(-0.6, 0.6));
    }
    return rows * 6;
  }

  // ---------- boost pads on the floor ----------
  // blue = normal boost (just speed), gold-magenta = special boost (speed + smash through obstacles)
  function padTexture(special) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 128);
    if (special) { lg.addColorStop(0, '#FFC928'); lg.addColorStop(0.5, '#FF4FD8'); lg.addColorStop(1, '#FFC928'); }
    else { lg.addColorStop(0, '#1E6BFF'); lg.addColorStop(1, '#38B6FF'); }
    g.fillStyle = lg; g.fillRect(0, 0, 64, 128);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const y of [36, 100]) { g.beginPath(); g.moveTo(12, y + 14); g.lineTo(32, y - 10); g.lineTo(52, y + 14); g.stroke(); }
    if (special) { g.fillStyle = '#FFFFFF'; for (let i = 0; i < 10; i++) g.fillRect(Math.random() * 60, Math.random() * 124, 3, 3); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(2, -2, 60, 132);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
    return t;
  }
  const padTex = { n: padTexture(false), s: padTexture(true) };
  const padMat = { n: new THREE.MeshBasicMaterial({ map: padTex.n }), s: new THREE.MeshBasicMaterial({ map: padTex.s }) };
  let padIn = 3;
  function addPad(special) {
    const tiny = player && player.level <= ATOMIC, K = tiny ? 1 : megaK();
    const w = (tiny ? 0.5 : 2.2) * K, d = (tiny ? 0.7 : 3.2) * K, group = new THREE.Group();
    const x = tiny
      ? Math.max(-TRACK_HALF + 0.3, Math.min(TRACK_HALF - 0.3, player.x + rand(-0.3, 0.3)))
      : Math.max(-trackHalf + w / 2 + 0.2, Math.min(trackHalf - w / 2 - 0.2, rand(-1, 1) * trackHalf));
    const pad = new THREE.Mesh(boxGeo, special ? padMat.s : padMat.n);
    pad.scale.set(w, 0.04, d); pad.position.set(x, 0.03, 0); group.add(pad);
    const gl = glow(special ? 0xFF7AE0 : 0x38B6FF, (tiny ? 0.5 : 3.4) * K, special ? 0.7 : 0.5); gl.position.set(x, (tiny ? 0.08 : 0.3) * K, 0); group.add(gl);
    const z = tiny ? ATOM_Z : lastSpawnZ();
    group.position.z = z;
    if (tiny) group.scale.setScalar(0.12);
    scene.add(group);
    obs.push({ type: 'pad', x, w, d, z, K, special, tiny, obj: group, used: false });
  }
  const lastSpawnZ = () => player && player.level >= MEGA ? -70 * megaK() : SPAWN_Z;
  // one speed-pad check shared by every size realm, so pads show up everywhere
  function trySpawnPad() {
    if (--padIn > 0 || (chaos && Math.random() >= 0.2)) return false; // far fewer pads during chaos
    const photon = runnerHas('photon');
    padIn = photon ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3);
    addPad(Math.random() < (photon ? 0.35 : 0.22));
    lastType = 'pad'; distSince = 0; nextGap = (rand(0.5, 0.8) * speed + 4) * Math.max(0.2, megaK()) / diffStack(0.07, 2.6);
    return true;
  }
  function addGust() {
    const len = rand(14, 24);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const group = new THREE.Group();
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF * 2, len), zoneMat);
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, 0.02, -len / 2); group.add(zone);
    for (let z = -2; z > -len + 1; z -= 4.5) {
      const ch = new THREE.Mesh(chevronGeo, chevronMat);
      ch.rotation.x = -Math.PI / 2; if (dir < 0) ch.rotation.z = Math.PI;
      ch.position.set(0, 0.03, z); group.add(ch);
    }
    const streaks = [];
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Mesh(streakGeo, streakMat);
      s.position.set(rand(-6, 6), rand(0.2, 3.4), -rand(0, len)); s.userData.sp = rand(10, 18);
      group.add(s); streaks.push(s);
    }
    group.position.z = SPAWN_Z;
    scene.add(group);
    obs.push({ type: 'gust', z: SPAWN_Z, len, dir, s: 2.2 + Math.min(2.0, elapsed * 0.04), obj: group, streaks });
    // (no popup for crosswinds: the arrows on the track already show the direction)
    return len;
  }
  // ---------- atomic-realm hazards (only spawn, and only matter, at atomic sizes) ----------
  const ATOM_Z = -14;
  const soundMat = new THREE.MeshBasicMaterial({ color: 0xFF5FD2, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const soundGlowMat = new THREE.MeshBasicMaterial({ color: 0xFF8AE6, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const zapRingMat = new THREE.MeshBasicMaterial({ color: 0xD4FF3D, transparent: true, opacity: 0.8, depthWrite: false });
  const zapGeo = new THREE.RingGeometry(0.05, 0.08, 20); zapGeo.rotateX(-Math.PI / 2);
  const nucleusMat = new THREE.MeshLambertMaterial({ color: 0xFF4F8B, emissive: 0x5A0A2A });
  const electronMat = new THREE.MeshBasicMaterial({ color: 0x5FE3FF });
  const nucGeo = new THREE.SphereGeometry(0.07, 14, 10), eGeo = new THREE.SphereGeometry(0.025, 10, 8);
  function spawnAtomic() {
    if (trySpawnPad()) return;
    const type = weighted([['sound', 5], ['zap', 9], ['atom', 10], ['orb', lastType === 'orb' ? 0 : 9], ['surge', 4], ['spring', 4]]);
    if (type === 'sound') {
      const n = Math.random() < 0.25 ? 2 : 1;
      for (let i = 0; i < n; i++) addSoundWave(ATOM_Z - i * 5);
    } else if (type === 'zap') {
      for (let i = 0; i < 3; i++) addZap(ATOM_Z - i * 0.9);
    } else if (type === 'atom') addAtom();
    else if (type === 'surge' || type === 'spring') addOrb(type);
    else addOrb();
    lastType = type;
    distSince = 0;
    nextGap = rand(3, 5) / diffStack(0.07, 2.6);
  }
  // a booming sound wave: a low wall across the whole track, jump it
  function addSoundWave(z) {
    const h = 0.05, group = new THREE.Group();
    const mesh = new THREE.Mesh(boxGeo, soundMat);
    mesh.scale.set(TRACK_HALF * 2, h, 0.03); mesh.position.y = h / 2; group.add(mesh);
    const halo = new THREE.Mesh(boxGeo, soundGlowMat); // soft glow around the wave
    halo.scale.set(TRACK_HALF * 2, h * 3.2, 0.12); halo.position.y = h * 1.1; group.add(halo);
    for (let gx = -TRACK_HALF + 0.4; gx < TRACK_HALF; gx += 0.8) { const g = glow(0xFF7AE0, 0.32, 0.55); g.position.set(gx, h * 0.8, 0); group.add(g); }
    group.position.z = z;
    scene.add(group);
    obs.push({ type: 'sound', z, d: 0.03, h, obj: group, wave: mesh, extra: 0.4, hit: false });
  }
  // static electricity: a ring marks where a tiny lightning bolt will strike
  function addZap(z) {
    const x = Math.max(-TRACK_HALF + 0.2, Math.min(TRACK_HALF - 0.2, player.x + rand(-0.25, 0.25)));
    const group = new THREE.Group();
    const ring = new THREE.Mesh(zapGeo, zapRingMat); ring.position.set(x, 0.004, 0); group.add(ring);
    const rg = glow(0xD4FF3D, 0.3, 0.8); rg.position.set(x, 0.02, 0); ring.add(rg); rg.position.set(0, 0.02, 0);
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(x + (i === 6 ? 0 : i % 2 ? 0.04 : -0.04), 0.9 - i * 0.15, 0));
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xFFF27A }));
    bolt.visible = false; group.add(bolt);
    group.position.z = z;
    scene.add(group);
    obs.push({ type: 'zap', x, z, d: 0.1, obj: group, ring, bolt, struck: false, flash: 0, hit: false, geos: [bolt.geometry], mats: [bolt.material] });
  }
  // a whole atom: dodge the nucleus and its whizzing electrons
  function addAtom() {
    const cx = rand(-TRACK_HALF + 1, TRACK_HALF - 1), group = new THREE.Group();
    const nuc = new THREE.Mesh(nucGeo, nucleusMat); nuc.position.set(cx, 0.07, 0); group.add(nuc);
    nuc.add(glow(0xFF4F8B, 0.42, 0.9));
    const electrons = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(eGeo, electronMat); group.add(m);
      m.add(glow(0x5FE3FF, 0.2, 1)); const tr = glow(0x5FE3FF, 0.11, 0.45); m.add(tr); m.userData.trail = tr;
      electrons.push({ m, a: i * 2.09, r: 0.35 + i * 0.22, sp: 2.6 - i * 0.55 });
    }
    group.position.z = ATOM_Z;
    scene.add(group);
    obs.push({ type: 'atom', x: cx, z: ATOM_Z, d: 1.0, obj: group, nuc, electrons, hit: false });
  }

  // ---------- mega stages ----------
  let trackHalf = TRACK_HALF, stageId = 0, stageGroup = null;
  const STAGE_INFO = {
    13: { name: 'Colossal', tint: '#FFFFFF', disaster: 'lightning' },
    14: { name: 'Skyscraper', tint: '#DCE2EE', disaster: 'meteor' },
    15: { name: 'Earthquake', tint: '#D9B28C', disaster: 'rift' },
    16: { name: 'Otherworldly', tint: '#B9A6FF', disaster: 'blackhole', space: true },
  };
  const spaceCanvas = document.createElement('canvas');
  spaceCanvas.width = 4; spaceCanvas.height = 512;
  (() => {
    const g = spaceCanvas.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 512);
    lg.addColorStop(0, '#03020F'); lg.addColorStop(0.45, '#120A35'); lg.addColorStop(0.62, '#3A1A66'); lg.addColorStop(1, '#1A0E3A');
    g.fillStyle = lg; g.fillRect(0, 0, 4, 512);
  })();
  const spaceTex = new THREE.CanvasTexture(spaceCanvas);
  const windowCanvas = document.createElement('canvas');
  windowCanvas.width = 32; windowCanvas.height = 64;
  (() => {
    const g = windowCanvas.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 64);
    for (let y = 4; y < 64; y += 10) for (let x = 4; x < 32; x += 9) { g.fillStyle = Math.random() < 0.6 ? '#FFE9A8' : '#55607A'; g.fillRect(x, y, 5, 6); }
  })();
  const windowTex = new THREE.CanvasTexture(windowCanvas);
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;

  // scenery that makes you feel huge: tiny farms, a city, mountain ranges, then planets
  function buildStage(st) {
    const K = megaK(st), half = TRACK_HALF * K, group = new THREE.Group();
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const span = 130 * K;
    const place = (m, minOut, maxOut) => { m.position.x = side() * (half + rand(minOut, maxOut)); m.position.z = rand(-span + 20 * K, 20 * K); group.add(m); };
    group.userData = { span, K };
    if (st === 13) {
      // the village takes on the colour and weather of whichever map you're actually playing, not always a meadow
      const VILLAGE_THEME = {
        grass:  { patch: ['#7DBA4A', '#9ACD5A', '#C9B458', '#5E9E3E', '#B8D77A', '#A57A45'], grid: '#4E7A30', hill: '#6E9A4A', wall: '#EFE3CC', roof: '#9C3B2A', leaf: '#3F7F35', trunk: '#5A3E28', kind: 'round' },
        leaves: { patch: ['#C76A1E', '#D98A2E', '#8A9A3E', '#B5651D', '#E0A24A', '#9C7A2A'], grid: '#6B4A2A', hill: '#8A9A3E', wall: '#D9C49A', roof: '#8A3A1A', leaf: '#D9772E', trunk: '#5A3E28', kind: 'round' },
        sand:   { patch: ['#E3C27A', '#D9B06A', '#C79A52', '#EAD08E', '#B8854A', '#F0DDA8'], grid: '#8A6A3E', hill: '#C79A52', wall: '#D9BC8A', roof: '#8A5A2E', leaf: '#5E8A3A', trunk: '#6E5A3A', kind: 'cactus' },
        ice:    { patch: ['#E8F4FF', '#D0E8FF', '#F7FBFF', '#C9E6FF', '#E0F0FF', '#BFE0F5'], grid: '#9CC4E0', hill: '#D8EAF8', wall: '#C9D8E6', roof: '#6A4A3A', leaf: '#EAF6FF', trunk: '#5A4A3A', kind: 'pine' },
        mud:    { patch: ['#5A4A32', '#4A3E28', '#6E5A3E', '#3A3024', '#5E4A30', '#443820'], grid: '#2A2218', hill: '#4A4030', wall: '#4A3E2E', roof: '#2A2018', leaf: '#3A3024', trunk: '#2E2418', kind: 'dead' },
        grid:   { patch: ['#2A1A4A', '#3A2066', '#241752', '#4A2A7A', '#1E1340', '#33205E'], grid: '#FF4FD8', hill: '#2A1A4A', wall: '#241752', roof: '#5A3FD6', leaf: '#6A35D6', trunk: '#1A1030', kind: 'tech', glow: true },
        coral:  { patch: ['#E7D3A1', '#D9C28C', '#F0E0B0', '#C9B47A', '#E0CB92', '#F5E8C0'], grid: '#8A6A3E', hill: '#C9B47A', wall: '#C9A878', roof: '#7A5234', leaf: '#3F7F6A', trunk: '#6E5A3A', kind: 'palm' },
        cobble: { patch: ['#4A4060', '#3A3250', '#544A6E', '#2E2844', '#463C5C', '#352E4A'], grid: '#2A2238', hill: '#3A3250', wall: '#4A4258', roof: '#2A1E38', leaf: '#2E2A1C', trunk: '#241C14', kind: 'dead' },
        lava:   { patch: ['#3A2C2A', '#2E201E', '#4A3630', '#241816', '#403028', '#1E1412'], grid: '#5A1608', hill: '#3A2420', wall: '#4A3A34', roof: '#2A1A14', leaf: '#3A2824', trunk: '#241612', kind: 'charred', crackedHill: true },
        rainbow:{ patch: ['#FFB7D2', '#B7E8FF', '#FFF2B0', '#C6FFD0', '#E0B7FF', '#FFD6A0'], grid: '#FF7AD9', hill: '#C9A6FF', wall: '#FFE8F5', roof: '#7A4FE0', leaf: '#FF9AD5', trunk: '#7A5BD6', kind: 'round' },
        cloud:  { patch: ['#F3E6FF', '#E8D6FF', '#FFF0F8', '#D6C2F0', '#F0E0FF', '#FFE2F0'], grid: '#B98AF0', hill: '#D9C2F0', wall: '#FFFFFF', roof: '#7A4FE0', leaf: '#FFFFFF', trunk: '#C9A878', kind: 'poof' },
      };
      const theme = VILLAGE_THEME[activeMap.surface] || VILLAGE_THEME.grass;
      const std = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, emissive: theme.glow ? c : 0x000000, emissiveIntensity: theme.glow ? 0.4 : 0 });
      const trunk = new THREE.CylinderGeometry(0.1, 0.14, 0.6, 12), leaves = new THREE.SphereGeometry(0.5, 20, 14), pineLeaf = new THREE.ConeGeometry(0.42, 1.1, 10);
      const house = new THREE.BoxGeometry(1, 0.8, 1.1), roof = new THREE.ConeGeometry(0.85, 0.6, 4);
      const tMat = std(theme.trunk), lMat = std(theme.leaf), hMat = std(theme.wall), rMat = std(theme.roof);
      for (let i = 0; i < 90; i++) {
        const g = new THREE.Group();
        if (Math.random() < 0.7) {
          if (theme.kind === 'cactus') {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 1.3, 10), lMat); body.position.y = 0.65; g.add(body);
            for (const sx of [-1, 1]) if (Math.random() < 0.7) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.55, 8), lMat); arm.position.set(sx * 0.2, 0.95, 0); arm.rotation.z = sx * 1.0; g.add(arm); }
          } else if (theme.kind === 'pine') {
            const t = new THREE.Mesh(trunk, tMat); t.position.y = 0.3; g.add(t);
            for (let k = 0; k < 2; k++) { const l = new THREE.Mesh(pineLeaf, lMat); l.position.y = 0.75 + k * 0.5; l.scale.setScalar(1 - k * 0.2); g.add(l); }
          } else if (theme.kind === 'palm') {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.3, 8), tMat); t.position.y = 0.65; t.rotation.z = 0.1; g.add(t);
            for (let f = 0; f < 6; f++) { const fr = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 4), lMat); fr.position.y = 1.3; fr.rotation.set(1.15, f / 6 * Math.PI * 2, 0); g.add(fr); }
          } else if (theme.kind === 'tech') {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), tMat); pole.position.y = 0.55; g.add(pole);
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), lMat); panel.position.y = 1.0; g.add(panel);
          } else if (theme.kind === 'charred') {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.1, 8), tMat); t.position.y = 0.55; g.add(t);
            for (let b = 0; b < 3; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 6), tMat); br.position.set((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3); br.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); g.add(br); }
            const e = glow(0xFF5A1F, 0.3, 0.6); e.position.y = 0.3; g.add(e);
          } else if (theme.kind === 'dead') {
            const t = new THREE.Mesh(trunk, tMat); t.position.y = 0.3; g.add(t);
            for (let b = 0; b < 2; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.5, 6), tMat); br.position.set((Math.random() - 0.5) * 0.2, 0.65, (Math.random() - 0.5) * 0.2); br.rotation.z = Math.random() - 0.5; g.add(br); }
          } else if (theme.kind === 'poof') {
            for (let k = 0; k < 3; k++) { const p2 = new THREE.Mesh(leaves, lMat); p2.position.set((Math.random() - 0.5) * 0.4, 0.5 + k * 0.28, (Math.random() - 0.5) * 0.4); p2.scale.setScalar(0.55 + Math.random() * 0.3); g.add(p2); }
          } else {
            const t = new THREE.Mesh(trunk, tMat); t.position.y = 0.3; g.add(t);
            const l = new THREE.Mesh(leaves, lMat); l.position.y = 0.95; l.scale.set(1, 1.15, 1); g.add(l);
          }
        } else {
          const h = new THREE.Mesh(house, hMat); h.position.y = 0.4; g.add(h);
          const r = new THREE.Mesh(roof, rMat); r.position.y = 1.1; r.rotation.y = Math.PI / 4; g.add(r);
          if (theme.glow) { const win = glow(theme.roof, 0.3, 0.6); win.position.set(0, 0.4, 0.56); g.add(win); }
        }
        g.scale.setScalar(rand(0.8, 1.6));
        place(g, 1, 45);
      }
      // patchwork ground in the map's own palette, stretching to the horizon
      const fc = document.createElement('canvas'); fc.width = fc.height = 256;
      const fg = fc.getContext('2d');
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) { fg.fillStyle = theme.patch[Math.floor(Math.random() * theme.patch.length)]; fg.fillRect(x, y, 64, 64); fg.strokeStyle = 'rgba(0,0,0,.2)'; fg.lineWidth = 2; for (let k = 8; k < 64; k += 10) { fg.beginPath(); fg.moveTo(x, y + k); fg.lineTo(x + 64, y + k); fg.stroke(); } }
      fg.strokeStyle = theme.grid; fg.lineWidth = 4; for (let k = 0; k <= 256; k += 64) { fg.beginPath(); fg.moveTo(k, 0); fg.lineTo(k, 256); fg.stroke(); fg.beginPath(); fg.moveTo(0, k); fg.lineTo(256, k); fg.stroke(); }
      const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(60, 60);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ map: ft }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.userData.fixed = true;
      group.add(ground); group.userData.groundTex = ft;
      const hillM = theme.crackedHill ? crackedRock(6, 3) : realMat(theme.hill, 6, 3);
      for (let i = 0; i < 26; i++) { // soft rolling hills toward the horizon
        const hr = rand(40, 120), hill = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), hillM);
        hill.scale.set(hr, rand(8, 30), hr * rand(0.6, 1.2)); hill.position.y = -0.1;
        place(hill, hr + 15, hr + 450); // keep the whole hill clear of the track
      }
    } else if (st === 14) {
      const box = new THREE.BoxGeometry(1, 1, 1);
      // glass facade texture: tinted glass, steel mullions, a scatter of lit offices
      const fc = document.createElement('canvas'); fc.width = 64; fc.height = 128;
      const fg = fc.getContext('2d');
      const glass = fg.createLinearGradient(0, 0, 64, 128); glass.addColorStop(0, '#5D7A99'); glass.addColorStop(1, '#2E3F57');
      fg.fillStyle = glass; fg.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 128; y += 8) for (let x = 0; x < 64; x += 8) {
        const lit = Math.random() < 0.18;
        fg.fillStyle = lit ? 'rgba(255,226,160,0.9)' : `rgba(150,180,215,${0.15 + Math.random() * 0.25})`;
        fg.fillRect(x + 1, y + 1, 6, 6);
      }
      fg.fillStyle = 'rgba(30,36,46,0.9)';
      for (let y = 0; y < 128; y += 8) fg.fillRect(0, y, 64, 1);
      for (let x = 0; x < 64; x += 8) fg.fillRect(x, 0, 1, 128);
      const facade = new THREE.CanvasTexture(fc); facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
      const tones = [0xD8E2EE, 0xBFCAD8, 0xE8EDF2, 0xA9B8CC, 0xC9D6E6];
      for (let i = 0; i < 110; i++) {
        // huge towers rising out of a deep city canyon, far below where you can see
        const w = rand(6, 13), dpt = rand(6, 13), h = rand(5, 24), tall = h + 220 * K;
        const tex = facade.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.round(tall / 3));
        const g = new THREE.Group();
        const b = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: tones[i % tones.length], map: tex, roughness: 0.25, metalness: 0.55 }));
        b.scale.set(w, tall, dpt); b.position.y = h - tall / 2; g.add(b);
        const roof = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x8A929E, roughness: 0.8 }));
        roof.scale.set(w * 0.7, 0.8, dpt * 0.7); roof.position.y = h + 0.4; g.add(roof);
        if (Math.random() < 0.35) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, rand(2, 5), 8), new THREE.MeshStandardMaterial({ color: 0xC0C6CE, metalness: 0.7, roughness: 0.3 })); ant.position.y = h + 2; g.add(ant); }
        place(g, 4 + w / 2, 170);
      }
    } else if (st === 15) {
      const rocks = ['#7D6650', '#8E8C86', '#6B5A48'];
      for (let i = 0; i < 46; i++) {
        const g = new THREE.Group(), r = rand(5, 13), h = rand(6, 14);
        const tot = h + 220 * K, Rb = r * tot / h; // mountains plunge far below the track
        g.add(mountain(Rb, tot, h, rocks[i % 3], '#3A3026', true));
        place(g, r * 1.6 + 4, r * 1.6 + 160); // ridges bulge out, so leave room
      }
    } else if (st === 16) {
      const starPos = new Float32Array(2500 * 3);
      for (let i = 0; i < 2500; i++) {
        const u = Math.random() * Math.PI * 2, v = Math.acos(rand(-0.2, 1)), R = 1100;
        starPos.set([Math.cos(u) * Math.sin(v) * R, Math.cos(v) * R, Math.sin(u) * Math.sin(v) * R], i * 3);
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
      stars.userData.fixed = true; group.add(stars);
      const planetCols = [0xFF8A5B, 0x5FB8FF, 0xC7A6FF, 0x7EE0A0, 0xFFD166];
      for (let i = 0; i < 9; i++) {
        const R = rand(12, 45), pl = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 18), new THREE.MeshLambertMaterial({ color: planetCols[i % 5], emissive: planetCols[i % 5], emissiveIntensity: 0.25, fog: false }));
        pl.position.set(side() * (half + rand(60, 260)), rand(-40, 120), rand(-900, -50));
        if (i % 3 === 0) { const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.4, R * 2, 40), new THREE.MeshBasicMaterial({ color: 0xFFE2B8, side: THREE.DoubleSide, transparent: true, opacity: 0.6, fog: false })); ring.rotation.x = 1.2; pl.add(ring); }
        pl.userData.parallax = 0.08;
        group.add(pl);
      }
    }
    return group;
  }
  function setStage(st) {
    if (st === stageId) return;
    const wasSpace = stageId && STAGE_INFO[stageId].space;
    if (stageGroup) {
      scene.remove(stageGroup);
      stageGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
      stageGroup = null;
    }
    stageId = st;
    track.material.color.set(st ? STAGE_INFO[st].tint : '#FFFFFF');
    const space = st && STAGE_INFO[st].space;
    if (wasSpace && !space) applyMap(activeMap);
    clouds.forEach(c => { c.visible = !st; }); // no sky clouds in the mega stages
    valley.visible = !st; // the mega stages bring their own scenery
    if (weather) weather.obj.visible = !space;
    if (!st) return;
    stageGroup = buildStage(st);
    scene.add(stageGroup);
    if (space) { scene.background = spaceTex; scene.fog.color.set('#1A0E3A'); }
  }
  function scrollStage(dz) {
    if (!stageGroup) return;
    const { span, K } = stageGroup.userData;
    if (stageGroup.userData.groundTex) stageGroup.userData.groundTex.offset.y += dz / 100;
    for (const c of stageGroup.children) {
      if (c.userData.fixed) continue;
      c.position.z += dz * (c.userData.parallax || 1);
      if (c.position.z > 25 * K) c.position.z -= span + (c.userData.parallax ? 900 : 0);
      if (c.userData.spin) { c.rotation.x += c.userData.spin * dz * 0.05; c.rotation.y += c.userData.spin * dz * 0.035; } // tumbles as it drifts past
    }
  }
  const clampX = (x, margin) => Math.max(-trackHalf + margin, Math.min(trackHalf - margin, x));

  // Colossal: lightning hunts the tallest thing around (you)
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xFFF6B0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const warnRingGeo = new THREE.RingGeometry(0.75, 1, 36); warnRingGeo.rotateX(-Math.PI / 2);
  // a dark outline, a tinted disc and a glowing beam mark where something will land, even on bright tracks
  const darkRingMat = new THREE.MeshBasicMaterial({ color: 0x120820, transparent: true, opacity: 0.6, depthWrite: false });
  const spotDiscGeo = new THREE.CircleGeometry(1, 40); spotDiscGeo.rotateX(-Math.PI / 2);
  const spotBeamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
  function markSpot(group, x, r, color, h) {
    const outline = new THREE.Mesh(warnRingGeo, darkRingMat); outline.scale.setScalar(r * 1.22); outline.position.set(x, 0.035, 0); group.add(outline);
    const discM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false });
    const disc = new THREE.Mesh(spotDiscGeo, discM); disc.scale.setScalar(r * 0.78); disc.position.set(x, 0.03, 0); group.add(disc);
    const beamM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(spotBeamGeo, beamM); beam.scale.set(r * 0.16, h, r * 0.16); beam.position.set(x, h / 2, 0); group.add(beam);
    return { mats: [discM, beamM], hide() { outline.visible = disc.visible = beam.visible = false; },
      pulse() { const k = 0.5 + 0.5 * Math.sin(clock * 12); beamM.opacity = 0.2 + 0.25 * k; discM.opacity = 0.18 + 0.22 * k; } };
  }
  const warnYellow = new THREE.MeshBasicMaterial({ color: 0xFFE14D, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const warnOrange = new THREE.MeshBasicMaterial({ color: 0xFF8A3D, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const warnRed = new THREE.MeshBasicMaterial({ color: 0xFF3B1F, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  function addLightning(z) {
    const K = megaK(), x = clampX(player.x + rand(-1.2, 1.2) * K, 1.2 * K), group = new THREE.Group();
    const ring = new THREE.Mesh(warnRingGeo, warnYellow); ring.scale.setScalar(1.3 * K); ring.position.set(x, 0.05, 0); group.add(ring);
    const bolt = new THREE.Group();
    let y = 0, bx = 0;
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(boxGeo, boltMat), ny = y + 5 * K, nx = rand(-1, 1) * K;
      seg.scale.set(0.35 * K, Math.hypot(ny - y, nx - bx), 0.35 * K);
      seg.position.set((bx + nx) / 2, (y + ny) / 2, 0); seg.rotation.z = -Math.atan2(nx - bx, ny - y);
      bolt.add(seg); y = ny; bx = nx;
    }
    bolt.add(glow(0xFFF27A, 9 * K, 1));
    bolt.position.x = x; bolt.visible = false; group.add(bolt);
    group.position.z = z; scene.add(group);
    const marks = markSpot(group, x, 1.3 * K, 0xFFE14D, 26 * K);
    obs.push({ type: 'lightning', x, z, d: 1, K, obj: group, ring, bolt, struck: false, flash: 0, hit: false, marks, mats: marks.mats });
  }
  // Skyscraper: a meteor shower with fiery trails
  const meteorMat = new THREE.MeshLambertMaterial({ color: 0x5A2A14, emissive: 0xFF5A1F, emissiveIntensity: 0.8 });
  const meteorGeo = new THREE.IcosahedronGeometry(1, 0);
  function addMeteor(z) {
    const K = megaK(), x = clampX(player.x + rand(-2, 2) * K, 2 * K), group = new THREE.Group();
    const ring = new THREE.Mesh(warnRingGeo, warnOrange); ring.scale.setScalar(2 * K); ring.position.set(x, 0.05, 0); group.add(ring);
    const rock = new THREE.Group();
    const core = new THREE.Mesh(meteorGeo, meteorMat); core.scale.setScalar(1.2 * K); rock.add(core);
    rock.add(glow(0xFF8A3D, 6 * K, 1));
    for (let i = 1; i <= 5; i++) { const t = glow(0xFF5A1F, (5 - i * 0.7) * K, 0.6); t.position.set(i * 1.4 * K, i * 2.4 * K, 0); rock.add(t); }
    const from = new THREE.Vector3(x + 22 * K, 45 * K, 0);
    rock.position.copy(from); group.add(rock);
    const wave = new THREE.Mesh(warnRingGeo, warnOrange.clone()); wave.position.set(x, 0.1, 0); wave.visible = false; group.add(wave);
    group.position.z = z; scene.add(group);
    const marks = markSpot(group, x, 2 * K, 0xFF8A3D, 40 * K);
    obs.push({ type: 'meteor', x, z, z0: z, d: 2, K, obj: group, ring, rock, from, wave, landed: false, hit: false, marks, mats: [wave.material, ...marks.mats] });
  }
  // Earthquake: rifts tear open across the track; jump them
  const riftMat = new THREE.MeshBasicMaterial({ color: 0x1A0D06 });
  const magmaMat = new THREE.MeshBasicMaterial({ color: 0xFF6A1F, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  function addRift(z) {
    const K = megaK(), d = 3.5 * K, w = trackHalf * 2 + 4 * K, group = new THREE.Group();
    const pit = new THREE.Mesh(boxGeo, riftMat); pit.scale.set(w, 0.1, d); pit.position.y = 0.04; group.add(pit);
    const lava = new THREE.Mesh(boxGeo, magmaMat); lava.scale.set(w, 0.12, d * 0.45); lava.position.y = 0.08; group.add(lava);
    for (let gx = -w / 2; gx < w / 2; gx += 6 * K) { const g = glow(0xFF6A1F, 7 * K, 0.6); g.position.set(gx, 0.6 * K, 0); group.add(g); }
    group.position.z = z; scene.add(group);
    obs.push({ type: 'rift', z, d, K, obj: group, lava, hit: false });
  }
  // Otherworldly: black holes drag you in
  const diskMat = new THREE.MeshBasicMaterial({ color: 0xB06BFF, side: THREE.DoubleSide, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const diskGeo = new THREE.RingGeometry(1.1, 3.2, 48, 1); diskGeo.rotateX(-Math.PI / 2);
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  function addBlackHole(z) {
    const K = megaK(), x = clampX(rand(-1, 1) * trackHalf, 4 * K), group = new THREE.Group();
    const hole = new THREE.Group(); hole.position.set(x, 1.2 * K, 0);
    const disk = new THREE.Mesh(diskGeo, diskMat); disk.scale.setScalar(K); disk.rotation.z = 0.25; hole.add(disk);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.05 * K, 24, 16), voidMat); hole.add(core);
    hole.add(glow(0xB06BFF, 14 * K, 0.9));
    group.add(hole);
    group.position.z = z; scene.add(group);
    obs.push({ type: 'blackhole', x, z, d: 4 * K, K, obj: group, disk, hit: false, geos: [core.geometry] });
  }
  function spawnMega() {
    if (trySpawnPad()) return;
    const st = player.level, K = megaK();
    const top = st === MAX_LEVEL;
    const pool = [['orb', lastType === 'orb' ? 0 : top ? 8 : 4], ['stomp', 7], ['turbo', 3], ['spring', 3], ['surge', top ? 0 : 1], ['shrinkorb', top ? 5 : 3], ['shrinksurge', top ? 3 : 2]];
    for (let l = MEGA; l <= st; l++) pool.push([STAGE_INFO[l].disaster, l === st ? 14 : 5]); // your stage's disaster, plus the ones below
    const type = weighted(pool), z0 = -70 * K;
    if (type === 'lightning') { for (let i = 0; i < 4; i++) addLightning(z0 - i * 7 * K); queueWarn('Lightning storm!', WARN.lightning, elapsed + 0.3, 'lightning'); }
    else if (type === 'meteor') { const n = 3 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) addMeteor(z0 - i * 9 * K); queueWarn('Meteor shower!', WARN.meteor, elapsed + 0.3, 'meteor'); }
    else if (type === 'rift') { const n = 2 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) addRift(z0 - i * 18 * K); queueWarn('Earthquake!', WARN.quake, elapsed + 0.3, 'quake'); }
    else if (type === 'blackhole') { addBlackHole(z0); if (st === MAX_LEVEL && Math.random() < 0.5) addBlackHole(z0 - 25 * K); queueWarn('Black hole!', WARN.blackhole, elapsed + 0.3, 'blackhole'); }
    else if (['turbo', 'spring', 'surge', 'shrinkorb', 'shrinksurge'].includes(type)) addOrb(type);
    else if (type === 'stomp') { for (let i = 0; i < 6; i++) addCrate(rand(-trackHalf + 1, trackHalf - 1), rand(1.2, 3), SPAWN_Z - (z0 - i * 4 * K)); }
    else addOrb();
    lastType = type;
    distSince = 0;
    nextGap = (rand(0.9, 1.5) * speed + 30 * K) * (st === MAX_LEVEL ? 0.65 : 1) / diffStack(0.07, 2.6); // Otherworldly throws hazards faster
  }
  function smash(o) {
    markHit(o); questStat('smash', 1);
    const bx = o.x !== undefined ? o.x : player.x;
    burst(bx, 0.6, o.z, 'block', 8, 5);
    shatter(bx, 0.7, o.z, breakColor(o), 10, 7, true);
    score += 25;
  }

  // ---------- power-ups ----------
  const POWERS = {
    turbo:  { name: 'Turbo',  color: 0xFF5A36, css: '#FF7A5C', secs: 5 },  // speed boost, smash through anything
    surge:  { name: 'Growth Surge', color: 0xFFC928, css: '#FFC928' },      // grows you until you're about twice as big
    spring: { name: 'Super Spring', color: 0x3DE8FF, css: '#5FEFFF', secs: 9 }, // jumps high enough to clear walls
    shrinkorb:   { name: 'Shrink Orb',     color: 0x8F7BFF, css: '#B3A6FF' }, // one size smaller, +30 points
    shrinksurge: { name: 'Shrink Crystal', color: 0xC04DFF, css: '#D98BFF' }, // shrinks you to about half your size, +100 points
    // chaos-mode pickups: some help, some hurt, the mystery box could be anything
    moon:    { name: 'Moon Boots',  color: 0xBFF6FF, css: '#BFF6FF', secs: 6, good: true },  // jumps 80% higher
    frenzy:  { name: 'Score Frenzy', color: 0xFF9F1C, css: '#FFB54D', secs: 6, good: true }, // triple points
    slowmo:  { name: 'Slow-Mo',     color: 0x4F7BFF, css: '#8FA8FF', secs: 5, good: true },  // world slows down
    hyper:   { name: 'Hyper Rush',  color: 0xF4FF3D, css: '#F4FF7A', secs: 5, good: true, mixed: true }, // very fast, but no smashing
    butter:  { name: 'Butter Feet', color: 0xFFE68A, css: '#FF8A8A', secs: 6, bad: true },   // super slippery
    swap:    { name: 'Mixed Up',    color: 0xFF3B5C, css: '#FF8A8A', secs: 5, bad: true },   // left and right swap
    anvil:   { name: 'Anvil',       color: 0x4A4A58, css: '#FF8A8A', secs: 6, bad: true },   // tiny jumps
    fogbomb: { name: 'Fog Bomb',    color: 0x9AA0A8, css: '#FF8A8A', secs: 6, bad: true },   // fog rolls in
    mystery: { name: 'Mystery Box', color: 0xFF4FD8, css: '#FF9AE6' },
  };
  const powerGeo = {
    turbo: (() => { const g = new THREE.ConeGeometry(0.3, 0.8, 4); g.rotateX(-Math.PI / 2); return g; })(),
    surge: new THREE.OctahedronGeometry(0.42),
    spring: new THREE.TorusGeometry(0.26, 0.07, 10, 24),
  };
  const powerMat = {};
  for (const k in POWERS) powerMat[k] = new THREE.MeshLambertMaterial({ color: POWERS[k].color, emissive: POWERS[k].color, emissiveIntensity: 0.55 });
  const CHAOS_GEO = {
    moon: () => new THREE.SphereGeometry(0.3, 18, 14), frenzy: () => new THREE.DodecahedronGeometry(0.36),
    slowmo: () => new THREE.TorusGeometry(0.27, 0.08, 10, 24), hyper: () => new THREE.ConeGeometry(0.26, 0.72, 3),
    butter: () => new THREE.BoxGeometry(0.55, 0.24, 0.34), swap: () => new THREE.TorusKnotGeometry(0.2, 0.06, 48, 8),
    anvil: () => new THREE.BoxGeometry(0.42, 0.26, 0.3), fogbomb: () => new THREE.SphereGeometry(0.34, 16, 12),
    mystery: () => new THREE.BoxGeometry(0.55, 0.55, 0.55),
  };
  const mysteryMat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 64, 64);
    ['#FF4D4D', '#FFB54D', '#FFE14D', '#4DDB6A', '#3DA5FF', '#B57BFF'].forEach((col, i) => lg.addColorStop(i / 5, col));
    g.fillStyle = lg; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(3, 3, 58, 58);
    g.fillStyle = '#ffffff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 35);
    return new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x552255 });
  })();
  function powerModel(kind) {
    const g = new THREE.Group();
    if (kind === 'spring') {
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(powerGeo.spring, powerMat.spring); t.rotation.x = Math.PI / 2; t.position.y = (i - 1) * 0.16; g.add(t); }
    } else if (kind === 'shrinkorb') { // a violet orb with a white minus sign
      g.add(new THREE.Mesh(orbGeo, powerMat.shrinkorb));
      for (const zz of [-0.36, 0.36]) { const bar = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); bar.scale.set(0.34, 0.08, 0.06); bar.position.z = zz; g.add(bar); }
    } else if (kind === 'shrinksurge') { // a tall, sharp violet crystal
      const c = new THREE.Mesh(powerGeo.surge, powerMat.shrinksurge); c.scale.set(0.75, 1.5, 0.75); g.add(c);
    } else if (CHAOS_GEO[kind]) {
      g.add(new THREE.Mesh(CHAOS_GEO[kind](), kind === 'mystery' ? mysteryMat : powerMat[kind]));
      if (kind === 'anvil') { const top = new THREE.Mesh(boxGeo, powerMat.anvil); top.scale.set(0.7, 0.12, 0.34); top.position.y = 0.2; g.add(top); }
    } else g.add(new THREE.Mesh(powerGeo[kind], powerMat[kind]));
    return g;
  }
  function activatePower(kind) {
    const p = player;
    sfx(kind.startsWith('shrink') ? 'shrink' : 'power');
    burst(p.x, p.y + BODY_H * p.s * 0.5, 0, 'gold', 18, 6);
    const twice = runnerHas('booster') ? 2 : 1;
    if (kind === 'turbo') p.turbo = POWERS.turbo.secs * twice;
    else if (kind === 'spring') p.spring = POWERS.spring.secs * twice;
    else if (kind === 'surge') {
      const echo = runnerHas('echo');
      let target = p.level;
      while (target < MAX_LEVEL && S[target] < S[p.level] * (echo ? 2.2 * 2.2 : 2.2)) target++;  // exponential: about double your size (Echo: double again)
      p.surge = Math.min(MAX_LEVEL, Math.max(target, p.level + (echo ? 4 : 2))); p.surgeT = 0; p.shrinkTo = -1;
    } else if (kind === 'shrinkorb') {
      p.surge = 0; p.shrinkTo = -1;
      if (p.level > 0) { p.level--; toast(p.level === ATOMIC ? 'Atomic size!' : p.level === 0 ? 'Quark size!' : 'Shrink!'); }
      score += 30;
    } else if (kind === 'shrinksurge') {
      const echo = runnerHas('echo');
      let target = p.level;
      while (target > 0 && S[target] > S[p.level] * (echo ? 0.45 * 0.45 : 0.45)) target--;      // about half your size (Echo: half again)
      p.shrinkTo = Math.max(0, Math.min(target, p.level - (echo ? 4 : 2))); p.shrinkT = 0; p.surge = 0;
      score += 100;
    } else if (kind === 'mystery') { // could be anything
      const outcomes = ['moon', 'frenzy', 'slowmo', 'hyper', 'butter', 'swap', 'anvil', 'fogbomb', 'grow', 'shrink', 'points'];
      const pick = outcomes[Math.floor(Math.random() * outcomes.length)];
      if (pick === 'grow') { p.level = Math.min(MAX_LEVEL, p.level + 2); warn('Mystery: you grew!', '#7CFF8A'); }
      else if (pick === 'shrink') { p.level = Math.max(0, p.level - 2); warn('Mystery: you shrank!', '#FF8A8A'); }
      else if (pick === 'points') { score += 500; warn('Mystery: +500 points!', '#7CFF8A'); }
      else { p.cfx[pick] = POWERS[pick].secs; warn('Mystery: ' + POWERS[pick].name + '!', POWERS[pick].bad ? '#FF8A8A' : '#7CFF8A'); }
      return;
    } else if (POWERS[kind].secs && (POWERS[kind].good || POWERS[kind].bad)) {
      p.cfx[kind] = POWERS[kind].secs;
    }
    warn(POWERS[kind].name + '!', kind.startsWith('shrink') ? '#B79BFF' : POWERS[kind].bad ? '#FF8A8A' : POWERS[kind].good ? '#7CFF8A' : WARN.power);
  }
  function stepShrinkSurge(dt) {
    const p = player;
    if (!(p.shrinkTo >= 0) || p.level <= p.shrinkTo) { p.shrinkTo = -1; return; }
    p.shrinkT -= dt;
    if (p.shrinkT <= 0) {
      p.level--; p.shrinkT = 0.35;
      burst(p.x, p.y + BODY_H * p.s * 0.5, 0, 'shield', 8, 3);
      toast(p.level === ATOMIC ? 'Atomic size!' : p.level === 0 ? 'Quark size!' : 'Shrink!');
    }
    if (p.level <= p.shrinkTo) p.shrinkTo = -1;
  }

  function addOrb(power) {
    const group = new THREE.Group();
    let halo;
    if (power) { group.add(powerModel(power)); halo = glow(POWERS[power].color, 1.8, 0.85); }
    else { group.add(new THREE.Mesh(orbGeo, orbMat)); halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), haloMat); }
    group.add(halo);
    const small = player.level < START_LEVEL, tiny = player.level <= ATOMIC, mega = player.level >= MEGA, K = megaK();
    const x = tiny ? Math.max(-TRACK_HALF + 0.3, Math.min(TRACK_HALF - 0.3, player.x + rand(-0.3, 0.3)))
      : small ? Math.max(-TRACK_HALF + 0.8, Math.min(TRACK_HALF - 0.8, player.x + rand(-1.6, 1.6))) : rand(-TRACK_HALF + 0.8, TRACK_HALF - 0.8);
    const y = tiny ? 0.035 : small ? rand(0.35, 1.0) : rand(0.6, 2.2);
    let z = tiny ? ATOM_Z : SPAWN_Z;
    if (tiny) group.scale.setScalar(0.12);
    let ox = x, oy = y;
    if (mega) { ox = rand(-trackHalf + 2 * K, trackHalf - 2 * K); oy = rand(1, 2.4) * K; z = -70 * K; group.scale.setScalar(1.6 * K); }
    group.position.set(ox, oy, z);
    scene.add(group);
    const ob = { type: 'orb', x: ox, y: oy, z, d: 0.8, K: mega ? K : 1, obj: group, halo, tiny, power, ph: Math.random() * 6, got: false };
    obs.push(ob);
    return ob;
  }
  function addCoin(x, y, z) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    obs.push({ type: 'coin', x, y, z, d: 0.4, obj: mesh, got: false });
  }
  function addCoinLine() {
    const n = 5 + Math.floor(Math.random() * 4);
    const x = rand(-TRACK_HALF + 0.7, TRACK_HALF - 0.7);
    const arc = Math.random() < 0.4;
    for (let i = 0; i < n; i++) {
      const y = arc ? 0.7 + Math.sin(i / (n - 1) * Math.PI) * 1.3 : 0.7;
      addCoin(x, y, SPAWN_Z - i * 2.0);
    }
    return n * 2;
  }
  function removeObs(o) {
    scene.remove(o.obj);
    if (o.mats) o.mats.forEach(m => m.dispose());
    if (o.type === 'gust' || o.type === 'hurricane') o.obj.children[0].geometry.dispose();
    if (o.geos) o.geos.forEach(g => g.dispose());
    if (o.crest) o.crest.geometry.dispose();
    if (o.type === 'orb' && !o.power) o.halo.geometry.dispose();
    if (o.holes) o.holes.forEach(h => h.mouth.material.dispose());
  }
  function weighted(pool) {
    const total = pool.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    for (const p of pool) if ((r -= p[1]) <= 0) return p[0];
    return pool[0][0];
  }
  function spawn() {
    const lvl = player.level, mfx = mapFx(activeMap);
    if (lvl <= ATOMIC) { spawnAtomic(); return; }
    if (lvl >= MEGA) { spawnMega(); return; }
    if (trySpawnPad()) return; // every few obstacles, a boost pad
    let pool = [['crate', 30], ['orb', (lvl > START_LEVEL ? 2 : lvl === START_LEVEL ? 4 : 9 + Math.max(0, START_LEVEL - lvl) * 3.5) * mfx.orbW]];
    const bigNow = lvl > START_LEVEL; // above normal size, growth gets rarer and shrink-walls more common
    if (elapsed > 6) pool.push(['boxTunnel', lvl <= 5 ? 22 : 10]);
    pool.push(['crateField', elapsed > 6 ? 14 : 4]);
    if (elapsed > 6) pool.push(['hurdle', 9]);
    if (elapsed > 10) pool.push(['barrel', 9]);
    if (elapsed > 12) pool.push(['slider', 8]);
    if (elapsed > 14) pool.push(['sweeper', 8]);
    if (elapsed > 5) pool.push(['gate', bigNow ? 18 : 12]);
    if (elapsed > 8) pool.push(['tunnel', bigNow ? 18 : 12]);
    pool.push(['orbTrail', lvl < START_LEVEL ? 6 : 1], ['spring', bigNow ? 3 : 6], ['turbo', 4], ['surge', lvl < START_LEVEL ? 6 : 1]);
    pool.push(['shrinkorb', lvl > 4 ? 5 : 2], ['shrinksurge', lvl > 6 ? 3 : 1]); // optional: shrink on purpose for tunnels and bigger multipliers
    if (!['gust', 'tsunami', 'hurricane', 'volcano'].includes(lastType)) {
      if (elapsed > 12) pool.push(['gust', (lvl <= 6 ? 16 : 5) * mfx.gustW]);                          // tiny & small
      if (elapsed > 16) pool.push(['tsunami', (lvl <= 8 ? 12 : 4) * mfx.tsunamiW]);                      // tiny to medium
      if (elapsed > 20 && !volcano) pool.push(['volcano', (lvl >= START_LEVEL ? 10 : 3) * mfx.volcanoW]); // normal and up
      if (elapsed > 16) pool.push(['hurricane', lvl > START_LEVEL ? 16 : 3]);           // big & giant
    }
    if (lastType === 'orb') pool = pool.filter(p => p[0] !== 'orb');
    const type = weighted(pool);
    let extra = 0;
    if (type === 'crate') {
      const r = Math.random();
      if (elapsed > 10 && r < 0.35) {
        // three crates with one gap
        const gapLane = Math.floor(Math.random() * 3);
        for (let l = 0; l < 3; l++) if (l !== gapLane) addCrate(-TRACK_HALF + 1.33 + l * 2.67, 2.2);
      } else if (elapsed > 8 && r < 0.65) {
        const w1 = rand(1.2, 2.4), w2 = rand(1.2, 2.4), gap = rand(1.3, 2.2);
        const left = rand(-TRACK_HALF, TRACK_HALF - (w1 + w2 + gap));
        addCrate(left + w1 / 2, w1);
        addCrate(left + w1 + gap + w2 / 2, w2, rand(0, 4));
      } else {
        const w = rand(1.2, 3.0);
        addCrate(rand(-TRACK_HALF + w / 2, TRACK_HALF - w / 2), w);
      }
    } else if (type === 'gate') {
      addGate();
    } else if (type === 'tunnel') extra = addTunnel().d;
    else if (type === 'gust') extra = addGust();
    else if (type === 'tsunami') extra = addTsunami();
    else if (type === 'hurricane') extra = addHurricane();
    else if (type === 'volcano') startVolcano();
    else if (type === 'boxTunnel') extra = addBoxTunnel();
    else if (type === 'crateField') extra = addCrateField();
    else if (type === 'barrel') addBarrel();
    else if (type === 'sweeper') { addSweeper(); extra = 4; }
    else if (type === 'slider') addSlider();
    else if (type === 'hurdle') addHurdle();
    else if (['turbo', 'surge', 'spring', 'shrinkorb', 'shrinksurge'].includes(type)) addOrb(type);
    else if (type === 'orbTrail') { // a line of orbs right in one lane: an easy way to grow
      const first = addOrb();
      for (let i = 1; i < 4; i++) { const o = addOrb(); o.x = first.x; o.y = first.y; o.z = first.z - i * 3 * first.K; o.obj.position.set(o.x, o.y, o.z); }
      extra = 9;
    }
    else addOrb();
    // boxes all around: scatter a couple of extra crates around lighter obstacles
    if (elapsed > 8 && ['gate', 'orb', 'spring', 'turbo', 'surge', 'hurdle', 'barrel', 'shrinkorb'].includes(type) && Math.random() < 0.5) {
      const n = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) { const w = rand(1.1, 1.8); addCrate(rand(-TRACK_HALF + w / 2, TRACK_HALF - w / 2), w, rand(6, 11)); }
    }
    lastType = type;
    distSince = 0;
    nextGap = (rand(0.55, 0.95) * speed + 4 + extra) * (lvl > START_LEVEL ? 0.85 : 1) / diffStack(0.07, 2.6); // obstacles come faster when you're big, and as difficulty stacks
  }

  // ================= gameplay events =================
  function markHit(o) {
    o.hit = true;
    if (o.mats) o.mats.forEach(m => { m.transparent = true; m.opacity = 0.3; });
    if (o.holes) o.holes.forEach(h => { h.mouth.visible = false; });
  }
  function hit(o) {
    const p = player;
    markHit(o);
    if (runnerHas('tidal') && (o.type === 'tsunami' || o.type === 'bomb')) { if (!(p.inv > 0)) toast('Splash!'); return; }
    if (p.turbo > 0 || p.light > 0 || (p.boost > 0 && p.boostSpecial)) { if (!o.counted) { o.counted = true; questStat('smash', 1); } burst(p.x, p.y + BODY_H * p.s * 0.5, o.z, 'block', 10, 6); shatter(p.x, p.y + BODY_H * p.s * 0.5, o.z, breakColor(o), p.light > 0 ? 16 : 11, p.light > 0 ? 10 : 8, true); sfx('hit', 0.6, 0.85); score += 25; return; } // turbo and lightspeed smash through with extra-forceful debris
    if (runnerHas('titan')) { p.titanToggle = !p.titanToggle; if (p.titanToggle) { toast('Shrugged off!'); return; } }
    if (p.inv > 0) return;
    if (p.halo) { p.halo = false; p.inv = 1; shake = 0.2; burst(p.x, p.y + 1, 0, 'gold', 16, 5); toast('Halo saved you!'); return; }
    if (p.specterOn) return; // Specter: untouchable during its phase window
    if (runnerHas('ascendant') && ['hurricane', 'tsunami', 'bomb', 'lightning', 'meteor', 'rift', 'blackhole'].includes(o.type)) { markHit(o); return; }
    if (['guardian', 'seraph'].some(runnerHas) && p.shield) {
      p.shield = false; p.shieldT = runnerHas('seraph') ? 10 : 20; p.inv = 0.9; shake = 0.2;
      burst(p.x, p.y + 1, 0, 'shield', 16);
      sfx('hit', 0.5, 1.4); toast('Blocked!');
      return;
    }
    if (runnerHas('lucky') && Math.random() < 0.3) { p.inv = 0.8; burst(p.x, p.y + 1, 0, 'green', 12, 5); toast('Lucky!'); return; }
    if (p.level === 0) {
      if (runnerHas('nova') && !p.novaUsed) { supernova(); return; }
      die('squash'); return;
    }
    p.level--; p.surge = 0; p.inv = runnerHas('phantom') ? 3.3 : 1.1; shake = 0.35; // a hit cancels any growth surge in progress
    burst(p.x, p.y + BODY_H * p.s * 0.6, 0, o.type === 'avatar' ? 'avatar' : 'block', 14);
    shatter(p.x, p.y + BODY_H * p.s * 0.5, o.z || 0, breakColor(o), 7, 5, false);
    sfx('hit'); sfx('shrink', 0.9);
    toast(p.level === 0 ? 'Quark size!' : p.level === ATOMIC ? 'Atomic size!' : 'Shrink!');
  }
  function supernova() {
    const p = player;
    p.novaUsed = true; p.level = START_LEVEL; p.surge = 0; p.inv = 2; shake = 0.5;
    burst(p.x, p.y + 1, 0, 'nova', 40, 9);
    toast('Supernova!');
  }
  function collect(o) {
    const p = player;
    o.got = true; o.obj.visible = false;
    if (o.type === 'coin') {
      runCoins++;
      burst(o.obj.position.x, o.obj.position.y, o.obj.position.z, 'coin', 4, 3);
      return;
    }
    if (o.power) { activatePower(o.power); return; }
    burst(o.obj.position.x, o.obj.position.y, o.z, 'green', 14, 5);
    sfx('grow');
    if (p.level < MAX_LEVEL) {
      p.level = Math.min(MAX_LEVEL, p.level + (['nebula', 'infinity'].some(runnerHas) ? 2 : 1));
      questStat('orbs', 1);
      toast(SIZE_NAMES[p.level] ? SIZE_NAMES[p.level] + '!' : 'Grow!');
    } else { score += 60; if (p.level === MAX_LEVEL) { p.unstable = 25; toast('Stabilized!'); } else toast('+60'); }
  }
  // slow-motion rescue: mash the key against the wind before the timer runs out
  let qte = null;
  const qteEl = $('qte');
  function startQte(o, kind) {
    const p = player;
    o.qteDone = true;
    const side = Math.sign(p.x) || 1;
    p.x = side * (TRACK_HALF - 0.02); p.vx = 0;
    const breezer = runnerHas('breezer');
    const need = Math.ceil((10 + (p.level <= ATOMIC + 2 ? 8 : p.level <= ATOMIC + 5 ? 4 : 0)) * (breezer ? 0.5 : 1) * (perks.has('legendcape') ? 0.7 : 1));
    const time = breezer ? 3.6 : 2.6;
    qte = { o, kind, side, need, count: 0, t: time, max: time };
    if (runnerHas('aurora')) { toast('Rescued instantly!'); endQte(true); return; } // Aurora wins every wind rescue on the spot
    $('qteKey').textContent = side > 0 ? '←' : '→';
    $('qteBtn').setAttribute('aria-label', 'Push ' + (side > 0 ? 'left' : 'right'));
    $('qteText').textContent = kind === 'wind' ? 'The wind is blowing you off!' : 'The hurricane is throwing you off!';
    qteEl.hidden = false; wrap.classList.add('slowmo');
    updateQteUi();
  }
  function updateQteUi() {
    if (!qte) return;
    $('qteFill').style.width = Math.min(100, qte.count / qte.need * 100) + '%';
    $('qteTime').style.width = Math.max(0, qte.t / qte.max * 100) + '%';
  }
  function qtePress(dir) {
    if (!qte || state !== 'play' || dir !== -qte.side) return;
    qte.count++; updateQteUi();
    if (qte.count >= qte.need) endQte(true);
  }
  function endQte(won) {
    const p = player, q = qte;
    qte = null; qteEl.hidden = true; wrap.classList.remove('slowmo');
    if (!q) return;
    if (won) { questStat('rescues', 1); q.o.beaten = true; p.x = q.side * (TRACK_HALF - 1.8); p.vx = 0; p.inv = Math.max(p.inv, 0.6); shake = 0.2; toast('Saved!'); }
    else p.x = q.side * (TRACK_HALF + 0.8); // pushed over the edge
  }
  function die(c) {
    if (tut) { // you can't lose the tutorial: pop back in and try again
      const p = player;
      if (qte) endQte(false);
      p.x = 0; p.y = 2; p.vy = 0; p.vx = 0; p.level = Math.max(p.level, START_LEVEL - 2); p.inv = 1.5;
      toast('Try again!');
      return;
    }
    if (qte) endQte(false);
    sfx('fail');
    cause = c;
    const p = player;
    if (c === 'squash' || c === 'collapse') {
      state = 'dying'; dieT = 0.85;
      burst(p.x, p.y + 0.5, 0, 'avatar', 30, 8);
      rig.root.visible = false; shadow.visible = false; shake = 0.5;
    } else state = 'falling';
  }
  function showOver() {
    state = 'over';
    clearChaos(); clearLightspeedFX();
    const s = Math.floor(score);
    const earned = Math.floor(s * COINS_PER_POINT * (runnerHas('saver') ? 1.15 : 1) * coinPerk());
    save.coins += earned;
    const isBest = s > save.best;
    if (isBest) save.best = s;
    persist();
    $('overTitle').textContent = cause === 'collapse' ? 'Collapsed' : cause === 'fell' ? 'Blown off' : 'Squashed';
    $('overWhy').textContent = cause === 'collapse'
      ? 'You stayed Otherworldly too long without stabilising. Grab an orb within 5 seconds, or shrink back down.'
      : cause === 'fell'
      ? (player.lastPush === 'hurricane'
        ? 'The hurricane threw you off the track. Its winds only catch Big and Giant runners, so a smaller size slips under them.'
        : 'The crosswind pushed you off the track. Steer into it, or stay bigger so it can’t move you as much.')
      : 'You were already at the smallest size when you got hit.';
    $('overScore').textContent = s;
    $('overCoins').textContent = '+' + fmt(earned) + ' coins';
    $('overBest').textContent = isBest ? 'New best score!' : 'Best: ' + save.best;
    const prog = finishRunProgress(s);
    persist();
    const box = $('overXp'); box.innerHTML = '';
    const xpLine = document.createElement('span');
    xpLine.textContent = save.level >= MAX_PLAYER_LEVEL ? `+${fmt(prog.xpGain)} XP. Max level!` : `+${fmt(prog.xpGain)} XP. Level ${save.level}, ${Math.floor(save.xp / xpNeed(save.level) * 100)}% to level ${save.level + 1}.`;
    box.appendChild(xpLine);
    for (const n of prog.notes) { const e = document.createElement('span'); e.className = 'qdone'; e.textContent = n.text; box.appendChild(e); }
    for (const l of prog.lv) { const e = document.createElement('span'); e.className = 'lvup'; e.textContent = l; box.appendChild(e); }
    if (prog.lv.length) toast('LEVEL UP!');
    Snd.music(prog.lv.length || (isBest && s > 0) ? 'win' : 'menu', prog.lv.length || (isBest && s > 0) ? { loop: false, fade: 0.4, then: 'menu' } : {});
    maybeOfferReward();
    overEl.hidden = false;
    wrap.classList.remove('playing');
    $('againBtn').focus();
    updateWallet();
  }

  // ================= levels + quests =================
  const MAX_PLAYER_LEVEL = 50;
  const xpNeed = L => 300 + 120 * L + 6 * L * L; // gets steeper every level
  const LEVEL_REWARDS = {
    3: { gear: 'headband' }, 5: { gear: 'sandals' }, 7: { map: 'autumn' }, 10: { lucky: 1, gear: 'varsity' },
    12: { gear: 'wizard' }, 15: { map: 'blossom' }, 18: { gear: 'rocketboots' }, 20: { lucky: 1, gear: 'viking' },
    23: { gear: 'wings' }, 25: { map: 'aurora' }, 28: { gear: 'goldkicks' }, 30: { lucky: 1, gear: 'halo' },
    33: { gear: 'jetpack' }, 35: { map: 'rainbow' }, 40: { lucky: 1, gear: 'legendcape' }, 45: { gear: 'champcrown' },
    50: { lucky: 2, coins: 25000 },
  };
  const levelCoins = L => 400 + 100 * L;
  function rewardText(L) {
    const r = LEVEL_REWARDS[L] || {}, bits = [fmt(levelCoins(L) + (r.coins || 0)) + ' coins'];
    if (r.gear) bits.push(COSMETICS.find(c => c.id === r.gear).name);
    if (r.map) bits.push(MAPS.find(m => m.id === r.map).name + ' map');
    if (r.lucky) bits.push(r.lucky > 1 ? r.lucky + ' Lucky Spins' : 'Lucky Spin');
    return bits.join(', ');
  }
  const QUEST_KINDS = ['score1', 'survive1', 'size1', 'orbs', 'pads', 'rescues', 'smash', 'dist', 'atomic1'];
  function makeQuest(L, exclude) {
    const pool = QUEST_KINDS.filter(k => !exclude.includes(k) && !(k === 'atomic1' && L < 3));
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const target = {
      score1: Math.round((1500 + 180 * L) / 50) * 50,
      survive1: Math.round(45 + 2.5 * L),
      size1: L < 8 ? 11 : L < 16 ? 12 : L < 26 ? 13 : L < 36 ? 14 : L < 46 ? 15 : 16,
      orbs: 12 + 2 * L, pads: 4 + Math.floor(L / 3), rescues: 2 + Math.floor(L / 8), smash: 8 + L,
      dist: Math.round((1500 + 160 * L) / 100) * 100, atomic1: 1,
    }[kind];
    return { kind, target, progress: 0, done: false, coins: Math.round((200 + 50 * L) / 10) * 10, xp: 120 + 25 * L };
  }
  function questText(q) {
    return {
      score1: `Score ${fmt(q.target)} points in one run`, survive1: `Survive ${q.target} seconds in one run`,
      size1: `Reach ${SIZE_NAMES[q.target]} size in a run`, orbs: `Collect ${q.target} green orbs`,
      pads: `Hit ${q.target} speed pads`, rescues: `Win ${q.target} wind rescues`, smash: `Smash ${q.target} obstacles`,
      dist: `Run ${fmt(q.target)} meters in total`, atomic1: 'Shrink down to Atomic size',
    }[q.kind];
  }
  function ensureQuests() {
    if (!save.quests) save.quests = [];
    while (save.quests.length < 3) save.quests.push(makeQuest(save.level, save.quests.map(q => q.kind)));
  }
  ensureQuests();
  let tut = null;
  function questStat(kind, amount, perRun) { // perRun: best single-run value; otherwise a running total
    if (tut) return;
    for (const q of save.quests) {
      if (q.done || q.kind !== kind) continue;
      q.progress = perRun ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress >= q.target) { q.done = true; warn('Quest complete!', '#3EE07A'); sfx('coin'); }
    }
  }
  function addXp(amount, notes) {
    if (save.level >= MAX_PLAYER_LEVEL) return;
    save.xp += amount;
    while (save.level < MAX_PLAYER_LEVEL && save.xp >= xpNeed(save.level)) {
      save.xp -= xpNeed(save.level);
      save.level++;
      const L = save.level, r = LEVEL_REWARDS[L] || {};
      save.coins += levelCoins(L) + (r.coins || 0);
      if (r.gear && !save.gear.owned.includes(r.gear)) save.gear.owned.push(r.gear);
      if (r.map && !save.maps.includes(r.map)) save.maps.push(r.map);
      if (r.lucky) save.luckySpins = (save.luckySpins || 0) + r.lucky;
      notes.push(`Level ${L}! ${rewardText(L)}`);
    }
    if (save.level >= MAX_PLAYER_LEVEL) save.xp = 0;
  }
  function updateLevelBadge() {
    $('badgeLevel').textContent = save.level;
    $('badgeXp').style.width = (save.level >= MAX_PLAYER_LEVEL ? 100 : save.xp / xpNeed(save.level) * 100) + '%';
  }
  function openQuests() {
    state = 'quests'; showScreen('quests');
    $('qLevel').textContent = save.level;
    const max = save.level >= MAX_PLAYER_LEVEL;
    $('qXpFill').style.width = (max ? 100 : save.xp / xpNeed(save.level) * 100) + '%';
    $('qXpText').textContent = max ? 'Max level reached!' : `${fmt(save.xp)} / ${fmt(xpNeed(save.level))} XP to level ${save.level + 1}`;
    const list = $('questList'); list.innerHTML = '';
    const lab = document.createElement('div'); lab.className = 'section-label'; lab.textContent = 'Active quests'; list.appendChild(lab);
    for (const q of save.quests) {
      const el = document.createElement('div'); el.className = 'quest' + (q.done ? ' done' : '');
      const t = document.createElement('strong'); t.textContent = questText(q);
      const bar = document.createElement('div'); bar.className = 'qbar';
      const fill = document.createElement('i'); fill.style.width = Math.min(100, (q.kind === 'size1' || q.kind === 'atomic1' ? (q.done ? 1 : 0) : q.progress / q.target) * 100) + '%'; bar.appendChild(fill);
      const sm = document.createElement('small');
      const left = document.createElement('span'); left.textContent = q.done ? 'Complete! Claimed after your next run' : (q.kind === 'size1' || q.kind === 'atomic1' ? 'Not yet' : `${fmt(Math.floor(q.progress))} / ${fmt(q.target)}`);
      const right = document.createElement('span'); right.textContent = `+${fmt(q.coins)} coins, +${q.xp} XP`;
      sm.append(left, right); el.append(t, bar, sm); list.appendChild(el);
    }
    const lab2 = document.createElement('div'); lab2.className = 'section-label'; lab2.textContent = 'Coming up'; list.appendChild(lab2);
    let shown = 0;
    for (let L = save.level + 1; L <= MAX_PLAYER_LEVEL && shown < 5; L++) {
      if (!LEVEL_REWARDS[L] && shown > 1) continue;
      const row = document.createElement('div'); row.className = 'reward-row';
      const b = document.createElement('b'); b.textContent = 'Lv ' + L;
      const sp = document.createElement('span'); sp.textContent = rewardText(L);
      row.append(b, sp); list.appendChild(row); shown++;
    }
    $('questBack').focus();
  }
  // at the end of a run: per-run quests, claim finished quests, award XP
  function finishRunProgress(s) {
    const p = player, notes = [];
    questStat('score1', s, true); questStat('survive1', Math.floor(elapsed), true); questStat('dist', Math.floor(p.dist || 0));
    for (const q of save.quests) if (!q.done && q.kind === 'size1' && (p.maxLvl || 0) >= q.target) { q.done = true; q.progress = q.target; }
    for (const q of save.quests) if (!q.done && q.kind === 'atomic1' && (p.minLvl ?? 99) <= ATOMIC) { q.done = true; q.progress = 1; }
    let qxp = 0;
    const done = save.quests.filter(q => q.done);
    for (const q of done) { save.coins += q.coins; qxp += q.xp; notes.push({ q: true, text: `Quest done: ${questText(q)} (+${fmt(q.coins)} coins)` }); }
    save.quests = save.quests.filter(q => !q.done);
    const xpGain = Math.floor(s / 2) + qxp, lv = [];   // 1 XP for every 2 points, plus quest XP
    addXp(xpGain, lv);
    ensureQuests();
    return { xpGain, notes, lv };
  }

  // ================= screens =================
  let shopTab = 'maps', previewRunner = null, previewMap = null;
  function updateWallet() { $('coinTotal').textContent = fmt(save.coins); }
  function showScreen(name) {
    for (const k in screens) screens[k].hidden = k !== name;
    hudEl.hidden = name !== null;
    $('wallet').hidden = name === null;
    $('levelBadge').hidden = !(name === 'title' || name === 'quests');
    wrap.classList.toggle('in-shop', name === 'shop');
  }
  function revertPreviews() {
    previewRunner = previewMap = null;
    if (Object.keys(previewGear).length) { previewGear = {}; applyGear(); }
    applyRunner(runnerById(save.runner));
    applyMap(mapById(save.map));
  }
  function goTitle(fromGame) {
    const doIt = () => {
      reset(); revertPreviews(); tut = null; $('tutSkipBtn').hidden = true;
      state = 'title';
      pausedEl.hidden = true; overEl.hidden = true;
      wrap.classList.remove('playing');
      showScreen('title');
      screens.title.classList.add('revealed');
      logo.style.opacity = 1;
      playBtn.focus();
    };
    if (fromGame) {
      state = 'transition';
      pausedEl.hidden = true; overEl.hidden = true;
      fadeEl.classList.add('quick'); fadeEl.classList.remove('out');
      setTimeout(() => { doIt(); snapCamera(); fadeEl.classList.add('out'); }, 360);
    } else doIt();
  }
  function backToTitle() { clearGachaFx(); revertPreviews(); state = 'title'; showScreen('title'); updateLevelBadge(); playBtn.focus(); }

  function swatchFor(kind, item) {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (kind === 'maps' ? ' map' : '');
    if (kind === 'maps') sw.style.background = `linear-gradient(${item.sky[1][1]}, ${item.sky[item.sky.length - 2][1]} 55%, ${item.track} 56%)`;
    else sw.style.background = item.swatch || item.color;
    return sw;
  }
  function renderList(container, kind, mode) {
    container.innerHTML = '';
    const items = kind === 'maps' ? MAPS : RUNNERS.filter(r => mode === 'shop' || save.runners.includes(r.id));
    const owned = kind === 'maps' ? save.maps : save.runners;
    const equippedId = kind === 'maps' ? save.map : save.runner;
    const selectedId = kind === 'maps' ? (previewMap || save.map) : (previewRunner || save.runner);
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'item' + (it.id === selectedId ? ' selected' : '');
      const main = document.createElement('button');
      main.className = 'item-main';
      main.setAttribute('aria-label', 'Preview ' + it.name);
      main.appendChild(swatchFor(kind, it));
      const txt = document.createElement('div');
      txt.className = 'item-text';
      txt.innerHTML = `<strong></strong><span></span>`;
      txt.querySelector('strong').textContent = it.name;
      txt.querySelector('span').textContent = kind === 'maps' ? it.desc : it.power;
      if (kind === 'maps') {
        const pc = document.createElement('span'); pc.className = 'pro'; pc.textContent = '+ ' + it.pro; txt.appendChild(pc);
        if (it.con) { const cc = document.createElement('span'); cc.className = 'con'; cc.textContent = '− ' + it.con; txt.appendChild(cc); }
      } else {
        const rp = document.createElement('span'); rp.className = 'rarity';
        rp.style.background = rarityBg(it.rarity); rp.textContent = RARITY[it.rarity].label; txt.appendChild(rp);
      }
      main.appendChild(txt);
      main.addEventListener('click', () => {
        if (kind === 'maps') { previewMap = it.id; applyMap(it); setPreview(it.name, '+ ' + it.pro + (it.con ? '   − ' + it.con : '')); }
        else { previewRunner = it.id; applyRunner(it); }
        renderList(container, kind, mode);
      });
      row.appendChild(main);
      const act = document.createElement('button');
      act.className = 'act';
      if (it.id === equippedId) { act.textContent = 'Equipped'; act.classList.add('equipped'); act.disabled = true; }
      else if (owned.includes(it.id)) {
        act.textContent = 'Equip'; act.classList.add('equip');
        act.addEventListener('click', () => {
          if (kind === 'maps') { save.map = it.id; previewMap = null; applyMap(it); }
          else { save.runner = it.id; previewRunner = null; applyRunner(it); }
          persist(); renderList(container, kind, mode);
        });
      } else if (it.level) { // level reward: can't be bought
        act.textContent = 'Lv ' + it.level; act.disabled = true; act.title = 'Unlocks at level ' + it.level;
      } else {
        act.innerHTML = '<span class="coin-ico"></span>' + fmt(it.price);
        act.setAttribute('aria-label', `Buy ${it.name} for ${fmt(it.price)} coins`);
        if (save.coins < it.price) { act.disabled = true; act.title = `You need ${fmt(it.price - save.coins)} more coins`; }
        act.addEventListener('click', () => {
          if (save.coins < it.price) return;
          save.coins -= it.price;
          owned.push(it.id);
          if (kind === 'maps') { save.map = it.id; previewMap = null; applyMap(it); }
          else { save.runner = it.id; previewRunner = null; applyRunner(it); }
          persist(); updateWallet(); renderList(container, kind, mode);
          toast('Unlocked!'); sfx('coin');
        });
      }
      row.appendChild(act);
      container.appendChild(row);
    }
  }
  let avatarTab = 'runners';
  const SLOT_NAMES = { hat: 'Hat', shoes: 'Kicks', top: 'Top', neck: 'Scarf', back: 'Back', legs: 'Shorts' };
  function renderOutfit(container) {
    container.innerHTML = '';
    const g = save.gear, mine = COSMETICS.filter(c => g.owned.includes(c.id));
    if (!mine.length) {
      const e = document.createElement('p'); e.className = 'sub';
      e.textContent = 'You don’t own any hats, kicks or clothes yet. Buy them in the Shop or earn them by levelling up.';
      container.appendChild(e); return;
    }
    for (const it of mine) {
      const equipped = g[it.slot] === it.id;
      const shown = it.slot in previewGear ? previewGear[it.slot] : g[it.slot];
      const row = document.createElement('div'); row.className = 'item' + (shown === it.id ? ' selected' : '');
      const main = document.createElement('button'); main.className = 'item-main'; main.setAttribute('aria-label', 'Try on ' + it.name);
      const sw = document.createElement('div'); sw.className = 'swatch map';
      sw.style.background = it.accent ? `linear-gradient(135deg, ${it.color} 60%, ${it.accent} 60%)` : it.color;
      if (it.glow) sw.style.boxShadow = `0 0 12px ${it.color}`;
      const txt = document.createElement('div'); txt.className = 'item-text';
      const nm = document.createElement('strong'); nm.textContent = it.name;
      const ds = document.createElement('span'); ds.textContent = SLOT_NAMES[it.slot] + (equipped ? ', wearing now' : '');
      txt.append(nm, ds);
      if (it.perk) { const pk = document.createElement('span'); pk.className = 'perk'; pk.textContent = '★ ' + it.perk; txt.appendChild(pk); }
      main.append(sw, txt);
      main.addEventListener('click', () => { previewGear[it.slot] = it.id; applyGear(); renderOutfit(container); });
      const act = document.createElement('button'); act.className = 'act equip';
      act.textContent = equipped ? 'Remove' : 'Equip';
      act.addEventListener('click', () => { g[it.slot] = equipped ? null : it.id; delete previewGear[it.slot]; applyGear(); persist(); renderOutfit(container); });
      row.append(main, act); container.appendChild(row);
    }
  }
  function setAvatarTab(tab) {
    avatarTab = tab;
    document.querySelectorAll('[data-atab]').forEach(b => b.setAttribute('aria-selected', b.dataset.atab === tab));
    if (tab === 'outfit') renderOutfit($('avatarList')); else renderList($('avatarList'), 'runners', 'avatars');
  }
  document.querySelectorAll('[data-atab]').forEach(b => b.addEventListener('click', () => setAvatarTab(b.dataset.atab)));
  function openAvatars() {
    state = 'avatars'; showScreen('avatars');
    setAvatarTab(avatarTab);
    $('avatarBack').focus();
  }
  function renderGear(container, tab) {
    container.innerHTML = '';
    const g = save.gear;
    for (const it of COSMETICS.filter(c => TAB_SLOTS[tab].includes(c.slot))) {
      const equipped = g[it.slot] === it.id, owned = g.owned.includes(it.id);
      const shown = it.slot in previewGear ? previewGear[it.slot] : g[it.slot];
      const row = document.createElement('div');
      row.className = 'item' + (shown === it.id ? ' selected' : '');
      const main = document.createElement('button');
      main.className = 'item-main';
      main.setAttribute('aria-label', 'Try on ' + it.name);
      const sw = document.createElement('div');
      sw.className = 'swatch map';
      sw.style.background = it.accent ? `linear-gradient(135deg, ${it.color} 60%, ${it.accent} 60%)` : it.color;
      if (it.glow) sw.style.boxShadow = `0 0 12px ${it.color}`;
      const txt = document.createElement('div');
      txt.className = 'item-text';
      const nm = document.createElement('strong'); nm.textContent = it.name;
      const ds = document.createElement('span'); ds.textContent = it.desc;
      txt.append(nm, ds);
      if (it.perk) { const pk = document.createElement('span'); pk.className = 'perk'; pk.textContent = '★ Ability: ' + it.perk; txt.appendChild(pk); }
      main.append(sw, txt);
      main.addEventListener('click', () => {
        previewGear[it.slot] = it.id; applyGear(); renderGear(container, tab);
        setPreview(it.name, equipped ? 'You’re wearing this.' : owned ? 'You own this. Equip it to wear it in runs.' : (it.level ? `Trying it on. Unlocks at level ${it.level}.` : `Trying it on. Costs ${fmt(it.price)} coins.`));
      });
      const act = document.createElement('button');
      act.className = 'act';
      if (equipped) {
        act.textContent = 'Remove'; act.classList.add('equip');
        act.addEventListener('click', () => { g[it.slot] = null; delete previewGear[it.slot]; applyGear(); persist(); renderGear(container, tab); });
      } else if (owned) {
        act.textContent = 'Equip'; act.classList.add('equip');
        act.addEventListener('click', () => { g[it.slot] = it.id; delete previewGear[it.slot]; applyGear(); persist(); renderGear(container, tab); });
      } else if (it.level) { // level reward: can't be bought
        act.textContent = 'Lv ' + it.level; act.disabled = true; act.title = 'Unlocks at level ' + it.level;
      } else {
        act.innerHTML = '<span class="coin-ico"></span>' + fmt(it.price);
        act.setAttribute('aria-label', `Buy ${it.name} for ${fmt(it.price)} coins`);
        if (save.coins < it.price) { act.disabled = true; act.title = `You need ${fmt(it.price - save.coins)} more coins`; }
        act.addEventListener('click', () => {
          if (save.coins < it.price) return;
          save.coins -= it.price; g.owned.push(it.id); g[it.slot] = it.id; delete previewGear[it.slot];
          applyGear(); persist(); updateWallet(); renderGear(container, tab); toast('Unlocked!'); sfx('coin');
        });
      }
      row.append(main, act);
      container.appendChild(row);
    }
  }
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => setShopTab(b.dataset.tab)));
  const SPIN_PRODUCTS = [
    { id: 'lucky', name: 'Lucky Spin', price: 30000, key: 'luckySpins', swatch: 'linear-gradient(135deg,#FFE8A3,#FFC94A,#FF9AD5)', desc: 'A spin with far better odds. No Commons, and Legendary, Mythic, Celestial and Divine come up much more often.' },
    { id: 'ultra', name: 'Ultra Lucky Spin', price: 75000, key: 'ultraSpins', swatch: 'conic-gradient(#FF5C5C,#FFD25C,#5CFF8A,#5CC8FF,#C85CFF,#FF5C5C)', desc: 'Guaranteed Celestial or better, above Mythic. Divine is likely, and Eternal is possible.' },
  ];
  function renderSpinShop(container) {
    container.innerHTML = '';
    for (const it of SPIN_PRODUCTS) {
      const row = document.createElement('div'); row.className = 'item';
      const main = document.createElement('div'); main.className = 'item-main'; main.style.cursor = 'default';
      const sw = document.createElement('div'); sw.className = 'swatch map'; sw.style.background = it.swatch;
      const txt = document.createElement('div'); txt.className = 'item-text';
      const nm = document.createElement('strong'); nm.textContent = it.name;
      const ds = document.createElement('span'); ds.textContent = it.desc;
      const own = document.createElement('span'); own.className = 'perk'; own.textContent = 'You have ' + fmt(save[it.key] || 0);
      txt.append(nm, ds, own); main.append(sw, txt);
      const act = document.createElement('button'); act.className = 'act';
      act.innerHTML = '<span class="coin-ico"></span>' + fmt(it.price);
      act.setAttribute('aria-label', `Buy a ${it.name} for ${fmt(it.price)} coins`);
      if (save.coins < it.price) { act.disabled = true; act.title = `You need ${fmt(it.price - save.coins)} more coins`; }
      act.addEventListener('click', () => {
        if (save.coins < it.price) return;
        save.coins -= it.price; save[it.key] = (save[it.key] || 0) + 1;
        persist(); updateWallet(); renderSpinShop(container); sfx('coin'); toast(it.name + ' added!');
      });
      row.append(main, act); container.appendChild(row);
    }
  }
  function setShopTab(tab) {
    shopTab = tab;
    document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    if (tab === 'maps') renderList($('shopList'), 'maps', 'shop'); else if (tab === 'spins') renderSpinShop($('shopList')); else renderGear($('shopList'), tab);
    if (tab === 'maps') setPreview('Maps', 'Tap a map to preview its track and weather.');
    else if (tab === 'spins') setPreview('Spins', 'Buy spins here, then use them on the Spin screen.');
    else setPreview('Your runner', 'Tap an item to try it on.');
  }
  function setPreview(name, note) {
    $('previewName').textContent = name;
    $('previewNote').textContent = note;
  }
  function openShop() {
    state = 'shop'; showScreen('shop');
    setShopTab(shopTab);
    $('shopBack').focus();
  }

  // ================= runner spin (gacha) =================
  const SPIN_POOL = RUNNERS.filter(r => r.rarity !== 'starter');
  const RARITY_ORDER = ['eternal', 'divine', 'celestial', 'mythic', 'legendary', 'epic', 'rare', 'common'];
  let spinning = false;
  // ---------- spin animation on your avatar: spin up, shrink away, new runner pops back in ----------
  let gachaFx = null, rigScaleMul = 1, rigLift = 0;
  const gachaGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const gachaGlow = new THREE.Sprite(gachaGlowMat); gachaGlow.visible = false; scene.add(gachaGlow);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 14, 32, 1, true), beamMat); beam.visible = false; scene.add(beam);
  function clearGachaFx() {
    gachaFx = null; rigScaleMul = 1; rigLift = 0;
    gachaGlow.visible = false; beam.visible = false;
  }
  function updateGachaFx(dt) {
    const p = player, g = gachaFx;
    if (!g) { p.turn += dt * 0.7; return; }
    g.t += dt;
    const spinEnd = g.dur * 0.68, shrinkEnd = g.dur * 0.88;
    if (g.phase === 'spin') { // spin faster and faster, lifting off the ground
      const k = Math.min(1, g.t / spinEnd);
      p.turn += dt * (0.7 + k * k * 30);
      rigLift = Math.sin(k * Math.PI / 2) * 0.35;
      gachaGlow.visible = true; gachaGlowMat.color.set('#FFFFFF');
      gachaGlowMat.opacity = 0.2 + k * 0.55; gachaGlow.scale.setScalar(1.4 + k * 2.6);
      if (Math.random() < 0.6) { const a = Math.random() * 6.28; burst(Math.cos(a) * 0.7, 0.4 + Math.random() * 1.6, Math.sin(a) * 0.7, 'shield', 1, 2); }
      if (g.t >= spinEnd) g.phase = 'shrink';
    } else if (g.phase === 'shrink') { // shrink away to nothing; the glow hints at the rarity
      const k = Math.min(1, (g.t - spinEnd) / Math.max(0.01, shrinkEnd - spinEnd));
      p.turn += dt * 32;
      rigScaleMul = Math.max(0.0001, 1 - k * k);
      rigLift = 0.35 + k * 0.45;
      gachaGlowMat.color.set(g.color); gachaGlowMat.opacity = 0.8; gachaGlow.scale.setScalar(4 - k * 2.2);
      if (k >= 1) { g.phase = 'hidden'; rigScaleMul = 0.0001; burst(0, 1.2, 0, 'nova', 26, 6); }
    } else if (g.phase === 'hidden') { // a pulsing orb of light while the reel settles
      rigScaleMul = 0.0001;
      gachaGlowMat.opacity = 0.7 + Math.sin(clock * 18) * 0.2; gachaGlow.scale.setScalar(1.8 + Math.sin(clock * 9) * 0.3);
    } else if (g.phase === 'grow') { // the new runner pops out with a little overshoot
      g.gt += dt;
      const k = Math.min(1, g.gt / 0.75), c1 = 1.70158, c3 = c1 + 1;
      rigScaleMul = Math.max(0.0001, 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2));
      rigLift = 0.8 * (1 - k);
      p.turn += dt * (10 * (1 - k) + 0.7);
      beamMat.opacity = (g.big ? 0.75 : 0.45) * (1 - k);
      gachaGlowMat.opacity = 0.9 * (1 - k); gachaGlow.scale.setScalar(2 + k * 4);
      if (k >= 1) clearGachaFx();
    }
    gachaGlow.position.set(0, 1.1 + rigLift, 0);
    beam.position.set(0, 6.5, 0);
  }
  const LUCKY_ODDS = { eternal: 0.005, divine: 0.03, celestial: 0.10, mythic: 0.15, legendary: 0.32, epic: 0.30, rare: 0.095, common: 0 };
  const ULTRA_ODDS = { eternal: 0.0167, divine: 0.12, celestial: 0.8633 };   // an Ultra Lucky Spin is always above Mythic
  function rollRarity(usePity, mode) {
    if (mode === true) mode = 'lucky';
    if (usePity && (save.divinePity || 0) >= DIVINE_PITY - 1) return 'divine';
    if (usePity && mode !== 'ultra' && (save.pity || 0) >= PITY - 1) return 'celestial';
    const table = mode === 'ultra' ? ULTRA_ODDS : mode === 'lucky' ? LUCKY_ODDS : null;
    let r = Math.random(), acc = 0;
    for (const k of RARITY_ORDER) { acc += table ? (table[k] || 0) : RARITY[k].chance; if (r < acc) return k; }
    return mode === 'ultra' ? 'celestial' : 'common';
  }
  function rollRunner(usePity, mode) {
    const rar = rollRarity(usePity, mode), opts = SPIN_POOL.filter(r => r.rarity === rar);
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : SPIN_POOL[0];
  }
  function tileFor(r) {
    const t = document.createElement('div');
    t.className = 'tile'; t.style.borderColor = RARITY[r.rarity].color;
    const i = document.createElement('i'); i.style.background = r.swatch || r.color;
    t.appendChild(i);
    return t;
  }
  function renderGacha() {
    const odds = $('odds');
    odds.innerHTML = '';
    for (const k of RARITY_ORDER.slice().reverse()) {
      const d = document.createElement('div');
      d.style.background = rarityBg(k);
      const b = document.createElement('b');
      const pct = RARITY[k].chance * 100;
      b.textContent = (pct >= 1 ? +pct.toFixed(1) : +pct.toFixed(3)) + '%'; // 0.005% needs its decimals
      d.append(b, RARITY[k].label);
      odds.appendChild(d);
    }
    const left = PITY - (save.pity || 0), dleft = DIVINE_PITY - (save.divinePity || 0);
    $('pity').textContent = (left <= 1 ? 'Your next spin is a guaranteed Celestial!' : `A Celestial is guaranteed within ${left} spins.`)
      + ' ' + (dleft <= 1 ? 'Your next spin is also a guaranteed Divine!' : `A Divine is guaranteed within ${dleft} spins.`);
    const go = $('spinGo');
    go.disabled = spinning || save.coins < SPIN_COST;
    const lk = $('luckyGo');
    lk.hidden = !(save.luckySpins > 0);
    lk.textContent = `Lucky Spin (${save.luckySpins || 0})`;
    lk.disabled = spinning;
    if (save.luckySpins > 0) $('pity').textContent += ' Lucky Spins boost Legendary, Mythic, Celestial and Divine odds.';
    const uk = $('ultraGo');
    uk.hidden = !(save.ultraSpins > 0);
    uk.textContent = `Ultra Lucky Spin (${save.ultraSpins || 0})`;
    uk.disabled = spinning;
    if (save.ultraSpins > 0) $('pity').textContent += ' Ultra Lucky Spins are always Celestial or better.';
    go.title = save.coins < SPIN_COST ? `You need ${fmt(SPIN_COST - save.coins)} more coins` : '';
  }
  function openGacha() {
    state = 'gacha'; showScreen('gacha');
    const strip = $('strip');
    if (!strip.children.length) for (let i = 0; i < 8; i++) strip.appendChild(tileFor(rollRunner(false)));
    renderGacha();
    $('spinGo').focus();
  }
  function spin(mode) {
    mode = mode === 'lucky' || mode === 'ultra' ? mode : 'normal';
    if (spinning || (mode === 'ultra' ? !(save.ultraSpins > 0) : mode === 'lucky' ? !(save.luckySpins > 0) : save.coins < SPIN_COST)) return;
    spinning = true;
    const won = rollRunner(true, mode);
    if (mode === 'ultra') save.ultraSpins--; else if (mode === 'lucky') save.luckySpins--; else save.coins -= SPIN_COST;
    save.pity = (won.rarity === 'celestial' || won.rarity === 'divine' || won.rarity === 'eternal') ? 0 : (save.pity || 0) + 1;
    save.divinePity = (won.rarity === 'divine' || won.rarity === 'eternal') ? 0 : (save.divinePity || 0) + 1;
    const isNew = !save.runners.includes(won.id);
    const refund = isNew ? 0 : RARITY[won.rarity].refund;
    if (isNew) save.runners.push(won.id); else save.coins += refund;
    persist(); // the result is saved right away, even if the player leaves mid-spin
    $('coinTotal').textContent = fmt(save.coins - refund);

    const strip = $('strip'), WIN = 34;
    strip.style.transition = 'none'; strip.style.transform = 'translateX(0px)';
    strip.innerHTML = '';
    for (let i = 0; i < 40; i++) strip.appendChild(tileFor(i === WIN ? won : rollRunner(false)));
    void strip.offsetWidth;
    const reelW = strip.parentElement.clientWidth;
    const target = 10 + WIN * 80 + 36 - reelW / 2 + rand(-22, 22);
    const dur = reduceMotion ? 0.35 : 3.4;
    gachaFx = reduceMotion ? null : { t: 0, dur, phase: 'spin', color: RARITY[won.rarity].color };
    strip.style.transition = `transform ${dur}s cubic-bezier(.08,.62,.1,1)`;
    strip.style.transform = `translateX(${-target}px)`;
    const card = $('revealCard');
    card.className = 'reveal-card empty'; card.textContent = 'Spinning…';
    { let tm = 0; for (let i = 0; i < 26; i++) { tm += 0.045 + 0.2 * Math.pow(i / 26, 3); if (tm < dur) setTimeout(() => { if (state === 'gacha') sfx('click', 0.45, 1 + i * 0.012); }, tm * 1000); } } // the reel clicks, slowing as it stops
    renderGacha();
    setTimeout(() => {
      spinning = false;
      updateWallet();
      if (state !== 'gacha') return;
      revealRunner(won, isNew, refund);
      renderGacha();
    }, dur * 1000 + 150);
  }
  function revealRunner(won, isNew, refund) {
    sfx('power', 1, 0.8 + RARITY_ORDER.slice().reverse().indexOf(won.rarity) * 0.07);
    if (['mythic', 'celestial', 'divine', 'eternal'].includes(won.rarity)) Snd.music('win', { loop: false, fade: 0.3, then: 'shop' });
    if (gachaFx) {
      gachaFx.phase = 'grow'; gachaFx.gt = 0;
      gachaFx.big = ['eternal', 'divine', 'celestial', 'legendary'].includes(won.rarity);
      beam.visible = true; beamMat.color.set(RARITY[won.rarity].color);
      if (gachaFx.big) shake = Math.max(shake, 0.25);
    }
    const card = $('revealCard');
    card.className = 'reveal-card'; card.innerHTML = '';
    card.style.setProperty('--glow', RARITY[won.rarity].color);
    void card.offsetWidth; card.classList.add('flash');
    card.appendChild(swatchFor('runners', won));
    const box = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = won.name;
    const rp = document.createElement('span'); rp.className = 'rarity';
    rp.style.background = rarityBg(won.rarity); rp.textContent = RARITY[won.rarity].label;
    const note = document.createElement('span'); note.className = 'note'; note.textContent = won.power;
    const status = document.createElement('span'); status.className = 'status';
    status.textContent = isNew ? 'New runner unlocked!' : `Already owned, +${fmt(refund)} coins back`;
    box.append(name, rp, note, status);
    card.appendChild(box);
    if (save.runner !== won.id) {
      const eq = document.createElement('button');
      eq.className = 'act equip'; eq.textContent = 'Equip'; eq.style.marginLeft = 'auto';
      eq.addEventListener('click', () => { save.runner = won.id; previewRunner = null; persist(); eq.remove(); toast('Equipped!'); });
      card.appendChild(eq);
    }
    previewRunner = won.id; applyRunner(won);
    const big = ['eternal', 'divine', 'celestial', 'legendary'].includes(won.rarity);
    burst(0, 1.1, 0, ['celestial', 'divine', 'eternal'].includes(won.rarity) ? 'nova' : 'shield', won.rarity === 'eternal' ? 70 : big ? 40 : 14, big ? 8 : 5);
    toast(won.rarity === 'eternal' ? 'ETERNAL!!!' : won.rarity === 'divine' ? 'DIVINE!!' : won.rarity === 'celestial' ? 'CELESTIAL!' : RARITY[won.rarity].label + '!');
  }

  let pauseFrom = 'play';
  let perks = new Set();
  const coinPerk = () => (perks.has('goldkicks') ? 1.15 : 1) * (perks.has('champcrown') ? 1.1 : 1);
  // guided first run: short tips, paused at each key rule
  const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const TUT_STEPS = [
    { wait: 0.4, text: () => isTouch ? 'Steer with ◀ ▶ and tap Jump.' : 'Steer with ← → and jump with Space.' },
    { wait: 1.2, spawn: () => addCrate(Math.max(-2.5, Math.min(2.5, player.x)), 2.4), text: () => 'Hitting things shrinks you. Dodge or jump this crate!' },
    { wait: 2.2, spawn: () => { const o = addOrb(); o.x = player.x; o.y = 0.9; o.obj.position.set(o.x, o.y, o.z); }, text: () => 'Green orbs grow you back.' },
    { wait: 2.2, spawn: () => addGate(), text: () => 'Gates glow green if you fit. Too big? You shrink to squeeze under.' },
    { wait: 2.4, spawn: () => { addPad(false); const o = obs[obs.length - 1]; o.x = player.x; o.obj.children.forEach(c => { c.position.x = o.x; }); }, text: () => 'Speed pads boost you. Gold ones smash through anything!' },
    { wait: 2.4, spawn: () => addGust(), text: () => isTouch ? 'Wind blows you sideways. If it catches you, tap the button against it!' : 'Wind blows you sideways. If it catches you, mash the key against it!' },
    { wait: 4.5, text: () => 'Small means more points. Big means safer. Have fun!', end: true },
  ];
  function tutSpawn(fn) {
    const before = obs.length;
    fn();
    const made = obs.slice(before);
    for (const o of made) { o.z += 75; o.obj.position.z = o.z; } // bring it close
    return made;
  }
  function tutTick(dt) {
    const st = TUT_STEPS[tut.i];
    if (!st) return;
    tut.t += dt;
    if (!tut.made && tut.t >= st.wait) {
      if (st.spawn) tut.made = tutSpawn(st.spawn);
      else { pauseTut(st); return; }
    }
    if (tut.made && tut.made[0] && tut.made[0].z > -22) pauseTut(st);
  }
  function pauseTut(st) {
    state = 'tutpause';
    $('tutText').textContent = st.text();
    $('tutGo').textContent = st.end ? 'Finish' : 'Got it';
    $('tutCard').hidden = false;
    $('tutGo').focus();
  }
  function resumeTut() {
    if (state !== 'tutpause') return;
    $('tutCard').hidden = true;
    const st = TUT_STEPS[tut.i];
    if (st && st.end) { endTutorial(false); return; }
    tut.i++; tut.t = 0; tut.made = null;
    state = 'play';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function endTutorial(skipped) {
    const first = !save.tutorialDone;
    tut = null;
    if (qte) { qte = null; qteEl.hidden = true; wrap.classList.remove('slowmo'); } // drop any wind-rescue prompt quietly, it must not count as a fall
    $('tutCard').hidden = true; $('tutSkipBtn').hidden = true; $('skipTutTitle').hidden = true; pausedEl.hidden = true;
    input.left = input.right = input.down = input.jumpHeld = false;
    save.tutorialDone = true;
    if (first && !skipped) { save.coins += 500; toast('+500 coins'); }
    persist(); updateWallet();
    state = 'transition';
    wrap.classList.remove('playing');
    hudEl.hidden = true;
    $('welcome').hidden = false;
    $('welcomeGo').focus();
  }
  function startRun(tutorial) {
    revertPreviews();
    reset();
    perks = new Set(GEAR_SLOTS.map(sl => save.gear[sl]).filter(Boolean));
    player.halo = perks.has('halo');
    tut = tutorial === true || !save.tutorialDone ? { i: 0, t: 0, made: null } : null;
    $('tutSkipBtn').hidden = !tut;
    showScreen(null);
    pausedEl.hidden = true; overEl.hidden = true;
    wrap.classList.add('playing');
    $('shieldPip').hidden = !['guardian', 'seraph'].some(runnerHas);
    state = 'countdown'; countT = 0; countStep = 0;
    toast('3', true); sfx('click', 1, 0.8);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    pauseFrom = state; state = 'pause'; sfx('pause');
    pausedEl.hidden = false; $('resumeBtn').focus();
  }
  function resume() {
    if (state !== 'pause') return;
    state = pauseFrom; pausedEl.hidden = true; sfx('pause', 1, 1.15);
    input.left = input.right = input.down = input.jumpHeld = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // ================= update =================
  function scrollWorld(dz) {
    scrollAcc += dz;
    trackTex.offset.y += dz / 10;
    for (const c of clouds) { c.position.z += dz * 0.2; if (c.position.z > 40) c.position.z -= 420; }
    scrollStage(dz); scrollValley(dz);
  }

  // ---------- difficulty: every 15,000 points, the game permanently ramps up, and each step stacks on the last ----------
  const DIFF_STEP = 15000;
  const diffTier = () => Math.floor(score / DIFF_STEP);
  const diffStack = (perTier, cap) => Math.min(cap, Math.pow(1 + perTier, diffTier())); // compounds each tier, with a soft ceiling so it never turns unplayable
  function update(dt) {
    const p = player;
    elapsed += dt;
    if (p.diffSeen === undefined) p.diffSeen = 0;
    const dTier = diffTier();
    if (dTier > p.diffSeen) { p.diffSeen = dTier; warn('Difficulty up!', '#FF6A6A'); toast('Getting harder!'); }
    const fx = mapFx(activeMap);
    const diffSpd = diffStack(0.09, 2.4), diffGap = diffStack(0.07, 2.6), diffForce = diffStack(0.08, 2.0);
    speed = Math.min(34 * diffSpd, (15 + elapsed * 0.35) * diffSpd) * fx.speed * (p.level <= ATOMIC ? 0.25 : 1) * Math.pow(megaK(), 0.8) * (p.turbo > 0 ? 1.6 : 1) * (p.boost > 0 ? (p.boostSpecial ? 1.6 : 1.4) : 1) * (p.light > 0 ? 2.2 : 1) * (p.cfx.slowmo ? 0.6 : 1) * (p.cfx.hyper ? 1.7 : 1) * (runnerHas('photon') ? 1.15 : 1);
    const dz = speed * dt;
    distSince += dz;
    p.dist = (p.dist || 0) + dz / megaK(); p.maxLvl = Math.max(p.maxLvl || 0, p.level); p.minLvl = Math.min(p.minLvl ?? 99, p.level);
    updateLightspeedFX(dt, p.light > 0, dz);
    score += dz / megaK() * 0.9 * (p.turbo > 0 ? 2 : 1) * (p.light > 0 ? 3 : 1) * (p.cfx.frenzy ? 3 : 1) * (perks.has('champcrown') ? 1.2 : perks.has('crown') ? 1.1 : 1) * (runnerHas('ascendant') ? MULT[START_LEVEL] : MULT[p.level]) * fx.score * (runnerHas('comet') ? 1.3 : 1);
    tickChaos(dt);
    runCoins = Math.floor(score * COINS_PER_POINT * (runnerHas('saver') ? 1.15 : 1) * coinPerk());
    scrollWorld(dz);
    if (tut) { speed = Math.min(speed, 15); tutTick(dt); if (state !== 'play') return; }
    else if (distSince >= nextGap) spawn();
    if (warnQueue.length) warnQueue = warnQueue.filter(w => { if (elapsed >= w.at) { if (w.kind) warnDisaster(w.kind, w.text, w.color); else warn(w.text, w.color); return false; } return true; });

    for (const o of obs) { o.pz = o.z; o.z += dz + (o.extra || 0) * dt; o.obj.position.z = o.z; }
    soundMat.color.setHSL(0.87 + 0.05 * Math.sin(clock * 3), 1, 0.64); // waves shimmer, but stay pink so they read as 'sound'
    soundGlowMat.opacity = 0.28 + 0.18 * Math.sin(clock * 12);
    electronMat.color.setHSL(0.52, 1, 0.6 + 0.15 * Math.sin(clock * 10));
    padTex.n.offset.y -= dt * 1.5; padTex.s.offset.y -= dt * 2.4; // chevrons race forward
    if (volcano) {
      volcano.t += dt; volcano.next -= dt;
      if (volcano.t < volcano.dur && volcano.next <= 0) { volcano.next = rand(0.5, 0.85) / diffStack(0.06, 2.2); addBomb(); }
      tickVolcano(dt);
      if (volcano.t > volcano.dur + 2.2) clearVolcano();
    }
    obs = obs.filter(o => {
      const back = o.len ? o.z - o.len : o.z - (o.d || 1);
      if (back > 14 * (o.K || 1)) { removeObs(o); return false; }
      return true;
    });

    p.buffer -= dt; p.coyote -= dt; p.inv -= dt;
    if (p.turbo > 0) p.turbo -= dt;
    if (p.boost > 0) p.boost -= dt;
    if (runnerHas('specter')) { // phases through danger for 2s every 15s
      p.specterT = (p.specterT || 0) + dt;
      p.specterOn = (p.specterT % 15) >= 13;
      if (p.specterOn) p.inv = Math.max(p.inv, 0.1);
    }
    if (p.light > 0) p.light -= dt;
    if (p.lsCooldown > 0) p.lsCooldown -= dt;
    for (const k in p.cfx) { p.cfx[k] -= dt; if (p.cfx[k] <= 0) delete p.cfx[k]; }
    if (runnerHas('photon')) {
      p.photonT += dt; if (p.photonT > 12) p.photon = 0; // the streak fades if you miss pads for too long
      avatarMat.emissiveIntensity = p.light > 0 ? 1.4 + Math.sin(clock * 30) * 0.4 : 0.55;
      if (p.light > 0 && Math.random() < 0.6) burst(p.x, p.y + BODY_H * p.s * 0.6, 0, 'nova', 1, 2);
    }
    if (p.spring > 0) p.spring -= dt;
    if (runnerHas('galaxy')) { // grows on its own
      p.galaxyT += dt;
      if (p.galaxyT >= 25) { p.galaxyT = 0; if (p.level < MAX_LEVEL) { p.level++; burst(p.x, p.y + BODY_H * p.s, 0, 'nova', 14, 5); toast(SIZE_NAMES[p.level] ? SIZE_NAMES[p.level] + '!' : 'Grow!'); } }
    }
    stepShrinkSurge(dt);
    if (p.surge > p.level) {
      p.surgeT -= dt;
      if (p.surgeT <= 0) { p.level++; p.surgeT = 0.35; burst(p.x, p.y + BODY_H * p.s, 0, 'gold', 8, 4); if (SIZE_NAMES[p.level]) toast(SIZE_NAMES[p.level] + '!'); }
      if (p.level >= p.surge) p.surge = 0; // surge finished
    }
    // Otherworldly is unstable: you collapse a size every 12 seconds unless an orb steadies you
    if (p.level === MAX_LEVEL && !runnerHas('infinity')) {
      if (p.unstable === undefined) { p.unstable = 25; warn('Unstable! Grab an orb or shrink', WARN.blackhole); }
      p.unstable -= dt;
      if (p.unstable <= 0) { // 5 seconds without stabilising: total collapse
        p.unstable = undefined;
        if (runnerHas('nova') && !p.novaUsed) supernova();
        else { die('collapse'); return; }
      }
    } else p.unstable = undefined;
    {
    }
    p.s += (S[p.level] - p.s) * Math.min(1, dt * 10);
    const thTarget = TRACK_HALF * megaK();       // the track widens with you in the mega stages
    trackHalf += (thTarget - trackHalf) * Math.min(1, dt * 4);
    if (Math.abs(trackHalf - thTarget) < 0.001) trackHalf = thTarget;
    track.scale.x = slab.scale.x = trackHalf / TRACK_HALF;
    setStage(p.level >= MEGA ? p.level : 0);
    if (p.lastLvl !== undefined && p.level < p.lastLvl) { // you shrank: giant hazards built for a bigger size no longer fit, so they vanish
      const kNow = megaK() * 1.01;
      obs = obs.filter(o => { if (['rift', 'lightning', 'meteor', 'blackhole'].includes(o.type) && o.K > kNow) { removeObs(o); return false; } return true; });
    }
    p.lastLvl = p.level;
    p.squash += (0 - p.squash) * Math.min(1, dt * 10);
    if (['guardian', 'seraph'].some(runnerHas) && !p.shield) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) { p.shield = true; toast('Shield ready'); }
    }
    const hw = 0.3 * p.s, hd = 0.2 * p.s, ht = BODY_H * p.s * 0.95;

    // smaller runners steer slower; giants are a bit sluggish too
    const sizeSteer = p.level >= MEGA ? 0.85 * trackHalf / TRACK_HALF : p.s <= 1 ? 0.5 + 0.5 * p.s : Math.max(0.6, 1 - (p.s - 1) * 0.45);
    const steerSpeed = 7.5 * sizeSteer * (runnerHas('anchor') ? 0.88 : 1) * (runnerHas('zipper') ? 1.25 : 1) * fx.steer;
    const steer = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * (p.cfx.swap ? -1 : 1); // Mixed Up swaps left and right
    p.vx += (steer * steerSpeed - p.vx) * Math.min(1, dt * 12 * fx.traction * (p.cfx.butter ? 0.12 : 1)); // ice = low traction, you slide
    let nx = p.x + p.vx * dt;
    const lim = trackHalf - hw;
    if (nx > lim && nx > p.x) nx = Math.max(p.x, lim);
    if (nx < -lim && nx < p.x) nx = Math.min(p.x, -lim);
    p.x = nx;
    if (trackHalf > TRACK_HALF + 0.01) p.x = Math.max(-lim, Math.min(lim, p.x)); // keep you on while the track narrows back

    for (const o of obs) {
      if (o.type !== 'gust') continue;
      for (const s of o.streaks) {
        s.position.x += o.dir * s.userData.sp * dt;
        if (s.position.x > 6) s.position.x = -6;
        if (s.position.x < -6) s.position.x = 6;
      }
      if (o.z >= 0 && o.z - o.len <= 0 && p.level > ATOMIC && p.level < MEGA && !(p.turbo > 0 || p.light > 0) && !o.beaten && !qte) {
        const f = o.s * Math.pow(1 / p.s, 1.4) * (p.onGround ? 0.6 : 1) * (runnerHas('anchor') ? 0.5 : 1) * fx.wind * diffForce
          * (p.level <= ATOMIC + 2 ? 1.6 : 1) // the two tiniest sizes get blown away almost instantly
          * (runnerHas('eclipse') ? 0.3 : 1) * (perks.has('cape') ? 0.8 : 1);
        p.x += o.dir * f * dt;
        p.lastPush = 'wind';
        if (Math.abs(p.x) > TRACK_HALF - 0.02 && !o.qteDone) startQte(o, 'wind');
      }
    }
    for (const o of obs) {
      if (o.type !== 'hurricane') continue;
      const fz = o.z - o.len / 2;
      o.funnel.position.x = Math.sin(clock * 0.9 + o.ph) * 2.6;
      o.funnel.rotation.y += dt * 4;
      for (const db of o.debris) { db.a += db.sp * dt; db.m.position.set(Math.cos(db.a) * db.r, db.y, Math.sin(db.a) * db.r); db.m.rotation.x += dt * 3; }
      const tall = heightAt(p.level) > HURRICANE_MIN_H && p.level < MEGA;
      if (tall && o.z >= 0 && o.z - o.len <= 0 && !(p.turbo > 0 || p.light > 0) && !o.beaten && !qte) {
        const dir = Math.sin(clock * 1.7 + o.ph) >= 0 ? 1 : -1; // gusts flip back and forth
        const f = 5.4 * diffForce * (p.onGround ? 0.75 : 1) * (runnerHas('anchor') ? 0.5 : 1) * (runnerHas('eclipse') ? 0.3 : 1);
        p.x += dir * f * dt;
        p.lastPush = 'hurricane';
        if (Math.abs(p.x) > TRACK_HALF - 0.02 && !o.qteDone) startQte(o, 'hurricane');
        if (!o.hit && Math.abs(fz) < 1.0 && Math.abs(p.x - o.funnel.position.x) < 0.9 + hw) hit(o);
      }
    }

    // jump (springy gets one extra jump in the air, lunar floats)
    const lunar = runnerHas('lunar'), grav = (lunar ? 0.6 : 1) * (p.level <= ATOMIC ? 0.3 : 1) * Math.sqrt(megaK());
    if (p.buffer > 0) {
      const v = Math.sqrt(2 * GRAV * grav * JUMP_H[p.level] * fx.jump * (lunar ? 1.15 : 1) * (p.spring > 0 ? 2.2 : 1) * (runnerHas('hopper') ? 1.2 : 1) * (p.cfx.moon ? 1.8 : 1) * (p.cfx.anvil ? 0.5 : 1) * (perks.has('rocketboots') ? 1.1 : 1));
      if (p.onGround || p.coyote > 0) {
        p.vy = v; p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumps = 1; p.squash = -0.12; sfx('jump', 0.85);
      } else if ((['springy', 'seraph'].some(runnerHas) || perks.has('jetpack')) && p.jumps < 2) {
        p.vy = v * 0.82; p.buffer = 0; p.jumps = 2; sfx('jump', 0.85, 1.3);
        burst(p.x, p.y, 0, 'avatar', 6, 3);
      }
    }
    const prevY = p.y;
    const glide = perks.has('wings') && input.jumpHeld && p.vy < 0 && !p.onGround; // Angel Wings: hold jump to glide down
    p.vy -= (GRAV * grav * (glide ? 0.5 : 1) + (input.down && !p.onGround ? 40 : 0)) * dt;
    p.y += p.vy * dt;

    const onTrack = Math.abs(p.x) <= trackHalf + 0.05;
    let floor = onTrack ? 0 : -1000;
    for (const o of obs) {
      if ((o.type !== 'crate' && o.type !== 'boxTunnel') || o.hit || p.level >= MEGA) continue; // you can land on top of both
      if (Math.abs(p.x - o.x) < o.w / 2 + hw * 0.8 && Math.abs(o.z) < o.d / 2 + hd && prevY >= o.h - 0.06 && p.y <= o.h && p.vy <= 0) floor = Math.max(floor, o.h);
    }
    if (p.y <= floor) {
      if (!p.onGround && p.vy < -4) sfx('land', Math.min(1, -p.vy / 18));
      if (!p.onGround && p.vy < -8) p.squash = Math.min(0.25, -p.vy / 70);
      p.y = floor; p.vy = 0; p.onGround = true; p.coyote = 0.09; p.jumps = 0;
    } else p.onGround = false;
    if (!onTrack && p.y < -0.4 && !['wisp', 'ascendant'].some(runnerHas)) {
      if (runnerHas('nova') && !p.novaUsed) { p.x = 0; p.vx = 0; p.y = 2.5; p.vy = 0; supernova(); }
      else { die('fell'); return; }
    }

    const magnet = runnerHas('magnet');
    const pcy = p.y + BODY_H * p.s * 0.5;
    const mega = p.level >= MEGA;
    for (const o of obs) {
      if (o.type === 'pad') {
        if (!o.used && Math.abs(p.x - o.x) < o.w / 2 + hw * 0.5 && Math.abs(o.z) < o.d / 2 && p.y < (o.tiny ? 0.15 : 0.6 * o.K)) {
          o.used = true;
          p.boost = (o.special ? 3.5 : 2.5) * (perks.has('neonkicks') ? 1.5 : 1); p.boostSpecial = o.special; questStat('pads', 1); sfx('power', 0.8, o.special ? 1.3 : 1);
          burst(p.x, 0.2 * o.K, 0, o.special ? 'nova' : 'water', 14, 5);
          toast(o.special ? 'Super Boost!' : 'Boost!');
          if (runnerHas('photon')) {
            p.photon += o.special ? 2 : 1; p.photonT = 0;
            if (p.photon >= 3) {
              p.photon = 0;
              if (p.lsCooldown > 0) { toast('Lightspeed recharging!'); }
              else {
                p.light = 5; p.lsStreak++;
                if (p.lsStreak >= 5) { p.lsCooldown = 30; p.lsStreak = 0; warn('Lightspeed overheated!', '#FF6A6A'); toast('Needs 30s to cool down!'); }
                else { warn('LIGHTSPEED!', '#FFF27A'); toast('LIGHTSPEED!'); sfx('power', 1, 1.5); if (!reduceMotion) { const f = $('flash'); f.classList.remove('soft', 'on'); void f.offsetWidth; f.classList.add('on'); } }
              }
            }
          }
        }
        continue;
      }
      if (mega && !o.hit && ['crate', 'boxTunnel', 'gate', 'tunnel', 'tsunami', 'bomb', 'barrel', 'sweeper', 'slider', 'hurdle'].includes(o.type)) {
        // normal-sized obstacles can't hurt you up here; you flatten them for points
        if (Math.abs(o.z) < (o.d || 1) / 2 + hd && (o.w === undefined || Math.abs(p.x - o.x) < o.w / 2 + hw)) smash(o);
        continue;
      }
      if (o.type === 'lightning') {
        o.ring.scale.setScalar(1.3 * o.K * (1 + Math.sin(clock * 14) * 0.12)); if (!o.struck) o.marks.pulse();
        if (o.flash > 0) { o.flash -= dt; if (o.flash <= 0) o.bolt.visible = false; }
        if (!o.struck && o.z >= 0) {
          o.struck = true; o.bolt.visible = true; o.flash = 0.22; o.ring.visible = false; o.marks.hide(); shake = Math.max(shake, 0.3);
          if (!reduceMotion) { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
          if (mega && !o.hit && Math.abs(p.x - o.x) < 1.3 * o.K + hw && p.y < 3 * o.K) hit(o);
        }
        continue;
      }
      if (o.type === 'meteor') {
        if (!o.landed) {
          const f = Math.min(1, 1 - o.z / o.z0);
          o.rock.position.set(o.from.x + (o.x - o.from.x) * f, o.from.y * (1 - f), 0);
          o.rock.rotation.x += dt * 3; o.ring.scale.setScalar(2 * o.K * (1 + Math.sin(clock * 12) * 0.1)); o.marks.pulse();
          if (f >= 1 || o.z >= 0) {
            o.landed = true; o.rock.visible = false; o.ring.visible = false; o.marks.hide(); o.wave.visible = true; o.waveT = 0;
            burst(o.x, 0.5 * o.K, o.z, 'lava', 16, 9); shake = Math.max(shake, 0.35);
            if (mega && !o.hit && Math.abs(p.x - o.x) < 2 * o.K + hw && p.y < 2 * o.K) hit(o);
          }
        } else if (o.wave.visible) {
          o.waveT += dt; o.wave.scale.setScalar(o.K * (2 + o.waveT * 14)); o.wave.material.opacity = Math.max(0, 0.7 - o.waveT * 1.4);
          if (o.waveT > 0.5) o.wave.visible = false;
        }
        continue;
      }
      if (o.type === 'rift') {
        o.lava.material.opacity = 0.7 + 0.25 * Math.sin(clock * 8);
        if (Math.abs(o.z) < 30 * o.K) shake = Math.max(shake, 0.12); // the ground rumbles as it nears
        if (mega && !o.hit && o.pz <= hd + o.d / 2 && o.z >= -hd - o.d / 2 && p.y < 0.3 * o.K) hit(o);
        continue;
      }
      if (o.type === 'blackhole') {
        o.disk.rotation.y += dt * 3;
        const dx = o.x - p.x, dzz = o.z, dist = Math.hypot(dx, dzz);
        if (mega && !o.hit && dist < 12 * o.K) {
          p.x += Math.sign(dx) * 5.2 * o.K * (1 - dist / (12 * o.K) * 0.5) * dt; // gravity pulls you sideways toward it
          if (Math.hypot(dx, dzz) < 1.3 * o.K + hw && p.y < 3 * o.K) hit(o);
        }
        continue;
      }
      if (o.type === 'barrel') {
        if (!o.hit) { o.x += o.vx * dt; if (Math.abs(o.x) > TRACK_HALF - o.r) { o.x = Math.sign(o.x) * (TRACK_HALF - o.r); o.vx *= -1; } }
        o.obj.position.x = o.x; o.obj.rotation.z -= o.vx / o.r * dt;
        if (!o.hit && Math.abs(p.x - o.x) < o.r + hw * 0.85 && Math.abs(o.z) < 0.55 + hd && p.y < o.r * 2 - 0.1) hit(o);
        continue;
      }
      if (o.type === 'sweeper') {
        o.ang += o.spin * dt; o.arm.rotation.y = o.ang;
        if (!o.hit && Math.abs(o.z) < o.L + 0.6) {
          const ux = Math.cos(o.ang), uz = -Math.sin(o.ang), dx = p.x - o.x, dzp = -o.z;
          const t = Math.max(-o.L, Math.min(o.L, dx * ux + dzp * uz));
          const bar = Math.hypot(dx - t * ux, dzp - t * uz), post = Math.hypot(dx, dzp);
          if ((bar < 0.12 + hw && p.y < 0.55) || (post < 0.16 + hw && p.y < 1.0)) hit(o);
        }
        continue;
      }
      if (o.type === 'slider') {
        o.x = Math.sin(clock * o.sp + o.ph) * o.amp; o.obj.position.x = o.x;
        if (!o.hit && Math.abs(p.x - o.x) < o.w / 2 + hw * 0.85 && Math.abs(o.z) < o.d / 2 + hd * 0.85 && p.y < o.h - 0.08) hit(o);
        continue;
      }
      if (o.type === 'hurdle') {
        if (!o.hit && o.pz <= hd + o.d && o.z >= -hd - o.d && p.y < o.h) hit(o);
        continue;
      }
      if (o.type === 'crate' && !o.hit) {
        if (Math.abs(p.x - o.x) < o.w / 2 + hw * 0.85 && Math.abs(o.z) < o.d / 2 + hd * 0.85 && p.y < o.h - 0.08) hit(o);
      } else if (o.type === 'gate') {
        if (!o.hit) o.mat.color.set(heightAt(p.level) < o.c ? '#22C55E' : activeMap.gate);
        if (!o.hit && Math.abs(o.z) < 0.22 + hd && p.y + ht > o.c && p.y < GATE_TOP) hit(o);
      } else if (o.type === 'tunnel' || o.type === 'boxTunnel') {
        if (!o.hit) for (const ho of o.holes) ho.mat.color.set(heightAt(p.level) < ho.h && 0.6 * S[p.level] < ho.w ? '#22C55E' : activeMap.trim);
        if (!o.hit && Math.abs(o.z) < o.d / 2 + hd * 0.85) {
          for (const sd of o.solids) {
            if (p.x + hw * 0.8 > sd.x0 && p.x - hw * 0.8 < sd.x1 && p.y < sd.y1 && p.y + ht > sd.y0 + 0.02) { hit(o); break; }
          }
        }
      } else if (o.type === 'sound') {
        o.wave.scale.y = o.h * (1 + 0.35 * Math.sin(clock * 22 + o.z * 3));
        if (!o.hit && p.level <= ATOMIC && o.pz <= hd + o.d && o.z >= -hd - o.d && p.y < o.h) hit(o);
      } else if (o.type === 'zap') {
        o.ring.scale.setScalar(1 + Math.sin(clock * 14) * 0.15);
        if (o.flash > 0) { o.flash -= dt; if (o.flash <= 0) o.bolt.visible = false; }
        if (!o.struck && o.z >= -0.01) {
          o.struck = true; o.bolt.visible = true; o.flash = 0.18; o.ring.visible = false;
          burst(o.x, 0.02, o.z, 'zap', 8, 2);
          if (p.level <= ATOMIC && Math.abs(p.x - o.x) < 0.09 + hw && p.y < 0.15) hit(o);
        }
      } else if (o.type === 'atom') {
        const pcy0 = p.y + BODY_H * p.s * 0.5, pr = 0.3 * p.s;
        for (const e of o.electrons) {
          e.a += e.sp * dt;
          e.m.position.set(o.x + Math.cos(e.a) * e.r, 0.035, Math.sin(e.a) * e.r);
          e.m.userData.trail.position.set(Math.sin(e.a) * 0.05, 0, -Math.cos(e.a) * 0.05); // a short glowing tail
          if (!o.hit && p.level <= ATOMIC && Math.hypot(p.x - e.m.position.x, pcy0 - 0.035, -(o.z + e.m.position.z)) < 0.03 + pr) hit(o);
        }
        if (!o.hit && p.level <= ATOMIC && Math.hypot(p.x - o.x, pcy0 - 0.07, -o.z) < 0.07 + pr) hit(o);
      } else if (o.type === 'tsunami') {
        o.crest.position.y = TSUNAMI_H + Math.sin(clock * 6) * 0.08;
        if (!o.hit && !o.waded && p.level > ATOMIC && Math.abs(o.z) < o.d / 2 + hd) {
          if (heightAt(p.level) > TSUNAMI_H || runnerHas('eclipse')) {
            o.waded = true; burst(p.x, 0.8, 0, 'water', 12, 4); toast('Waded through!');
          } else if (p.y < TSUNAMI_H - 0.05) { burst(p.x, 0.8, 0, 'water', 18, 6); hit(o); }
        }
      } else if (o.type === 'bomb') {
        if (!o.landed) {
          o.rock.position.y -= o.vy * dt;
          o.rock.rotation.x += dt * 5; o.rock.rotation.y += dt * 4;
          o.ring.scale.setScalar(1 + Math.sin(clock * 12) * 0.12); o.marks.pulse();
          if (o.rock.position.y <= 0.4) {
            o.landed = true; o.rock.visible = false; o.marks.hide();
            burst(o.x, 0.3, o.z, 'lava', 12, 5);
            if (!o.hit && p.level > ATOMIC && Math.abs(o.z) < 0.9 + hd && Math.abs(p.x - o.x) < 0.85 + hw && p.y < 1.0) hit(o);
          }
        }
      } else if ((o.type === 'orb' || o.type === 'coin') && !o.got) {
        if (o.type === 'orb') {
          o.obj.position.y = o.y + Math.sin(clock * 3.5 + o.ph) * (o.tiny ? 0.012 : 0.18 * (o.K || 1));
          o.halo.scale.setScalar((o.power ? 1.8 : 1) * (1 + Math.sin(clock * 6 + o.ph) * 0.12));
          if (o.power) o.obj.children[0].rotation.y += dt * 3;
        } else o.obj.rotation.y += dt * 4;
        const oy = o.obj.position.y;
        let dx = p.x - o.x, dy = pcy - oy, dzz = -o.z;
        const assist = o.type === 'orb' && (p.level < START_LEVEL - 2 || perks.has('legendcape')); // small runners get a gentle pull toward orbs
        if ((magnet || assist) && !(o.power && (o.power.startsWith('shrink') || POWERS[o.power].bad || o.power === 'mystery'))) { // never pull shrink pickups toward you
          const dist = Math.hypot(dx, dy, dzz);
          const range = o.tiny ? (magnet ? 1.2 : 0.7) : magnet ? (o.type === 'orb' ? 7.5 : 4.5) : 2.6;
          if (dist < range && dist > 0.01) {
            const pull = Math.min(dist, (o.tiny ? 1.4 : magnet ? 16 : 9) * dt) / dist;
            o.x += dx * pull; o.y += dy * pull; o.z += dzz * pull;
            o.obj.position.set(o.x, o.type === 'orb' ? o.obj.position.y + dy * pull : o.y, o.z);
            dx = p.x - o.x; dy = pcy - o.obj.position.y; dzz = -o.z;
          }
        }
        // pickups touch your whole body, head to toe, not just your middle
        const oyy = o.obj.position.y, nearY = Math.max(p.y, Math.min(p.y + BODY_H * p.s * 0.95, oyy)), dyc = nearY - oyy;
        const r = o.tiny ? 0.12 : o.type === 'coin' ? 0.35 + 0.5 * p.s : Math.max(0.95, 0.38 * (o.K > 1 ? 1.6 * o.K : 1) + 0.35 * p.s + 0.25);
        if (dx * dx + dyc * dyc + dzz * dzz < r * r) collect(o);
      }
      if (state !== 'play') return;
    }

    rig.bubble.visible = ['guardian', 'seraph'].some(runnerHas) && p.shield;
    animateRunner(dt, speed, 'run');
    updateParticles(dt);
    updateDebris(dt);
    updateHud();
  }

  function animateRunner(dt, spd, mode) {
    const p = player;
    const running = mode === 'run';
    p.idle += ((running ? 0 : 1) - p.idle) * Math.min(1, dt * 8);
    if (running && p.onGround) p.phase += dt * (5.5 + spd * 0.32) / Math.max(0.6, Math.sqrt(p.s));
    p.air += ((running && !p.onGround ? 1 : 0) - p.air) * Math.min(1, dt * 12);
    const a = p.air, id = p.idle, ph = p.phase, sn = Math.sin(ph), cs = Math.cos(ph);
    const breathe = Math.sin(clock * 2.2);
    const runHip = [sn * 0.85, -sn * 0.85];
    const runKnee = [-(0.15 + 1.15 * Math.max(0, cs)), -(0.15 + 1.15 * Math.max(0, -cs))];
    const runArm = [-sn * 0.8, sn * 0.8];
    const jumpHip = [1.0, -0.25], jumpKnee = [-1.4, -0.45], jumpArm = [-0.6, 1.6];
    for (let i = 0; i < 2; i++) {
      let hip = lerp(runHip[i], jumpHip[i], a), knee = lerp(runKnee[i], jumpKnee[i], a);
      let arm = lerp(runArm[i], jumpArm[i], a), elbow = lerp(1.25, 0.6, a);
      hip = lerp(hip, 0, id); knee = lerp(knee, -0.04, id);
      arm = lerp(arm, 0.08 + breathe * 0.03, id); elbow = lerp(elbow, 0.22, id);
      rig.legs[i].hip.rotation.x = hip; rig.legs[i].knee.rotation.x = knee;
      rig.arms[i].sh.rotation.x = arm;
      rig.arms[i].sh.rotation.z = rig.arms[i].side * lerp(0.1, 0.16 + breathe * 0.02, id);
      rig.arms[i].el.rotation.x = elbow;
    }
    rig.body.position.y = (1 - a) * (1 - id) * Math.abs(Math.sin(ph)) * 0.08;
    rig.body.rotation.x = lerp(-0.14, 0, id);
    rig.body.scale.set(1, 1 + id * breathe * 0.012, 1);
    if (rig.cape) { // the cape streams out behind you and ripples; it hangs loosely when you stand still
      const run = 1 - id;
      rig.cape.rotation.x = -lerp(0.12 + breathe * 0.02, 0.95 + Math.sin(clock * 7) * 0.08 + a * 0.3, run);
      const cg = rig.cape.geometry, cpos = cg.attributes.position, base = cg.userData.base;
      const amp = 0.025 + run * 0.07, spd = 4 + run * 10;
      for (let i = 0; i < cpos.count; i++) {
        const t = -base[i * 3 + 1];
        cpos.setZ(i, Math.sin(t * 6 - clock * spd + base[i * 3] * 3) * amp * t);
      }
      cpos.needsUpdate = true; cg.computeVertexNormals();
    }
    if (rig.wings) for (const w of rig.wings) w.m.rotation.y = w.sx * (0.5 + Math.sin(clock * (running ? 9 : 2.5)) * (running ? 0.35 : 0.15)); // flap
    if (rig.scarfTail) rig.scarfTail.rotation.x = -lerp(0.1, 0.9 + Math.sin(clock * 16) * 0.15, 1 - id);
    const root = rig.root;
    root.position.set(p.x, p.y + rigLift, 0);
    const sq = p.squash;
    const lean = Math.max(-1, Math.min(1, p.vx / (7.5 * (trackHalf / TRACK_HALF))));
    root.scale.set(p.s * (1 + sq * 0.5) * rigScaleMul, p.s * (1 - sq) * rigScaleMul, p.s * (1 + sq * 0.5) * rigScaleMul);
    root.rotation.z = -lean * 0.06; // gentle lean into turns, the same at every size
    root.rotation.y = mode === 'turntable' ? p.turn : lerp(root.rotation.y, -lean * 0.05, Math.min(1, dt * 8));
    root.visible = !(p.inv > 0 && state === 'play' && Math.floor(clock * 14) % 2 === 0);
    if (!running) rig.bubble.visible = ['guardian', 'seraph'].some(runnerHas);

    let ground = Math.abs(p.x) <= trackHalf ? 0 : null;
    for (const o of obs) if ((o.type === 'crate' || o.type === 'boxTunnel') && !o.hit && Math.abs(p.x - o.x) < o.w / 2 && Math.abs(o.z) < o.d / 2 && p.y >= o.h - 0.05) ground = Math.max(ground || 0, o.h);
    if (ground === null) shadow.visible = false;
    else {
      shadow.visible = true;
      const k = Math.max(0.35, 1 - (p.y - ground) / 4);
      shadow.position.set(p.x, ground + 0.015, 0);
      shadow.scale.setScalar(p.s * k * Math.max(0.001, rigScaleMul));
      shadow.material.opacity = 0.25 * k;
    }
  }

  // ================= camera =================
  let camAspect = 1, baseFov = 58;
  const cam = { ang: Math.PI - 0.45, dist: 4.6, h: 1.7, look: new THREE.Vector3(0, 1.1, 0) };
  function camTarget() {
    const portrait = Math.max(0, 1 - camAspect);
    const wide = camAspect > 1.15;
    const px = player ? player.x : 0;
    if (state === 'title' || state === 'transition' || state === 'settings' || state === 'players') {
      return { ang: Math.PI - 0.45 + Math.sin(clock * 0.25) * 0.18, dist: 4.8 + portrait * 2.5, h: 1.6, look: new THREE.Vector3(wide ? 1.5 : 0, wide ? 1.05 : 0.75, 0), k: 2.5 };
    }
    if (state === 'shop' && shopTab !== 'maps') { // runner fills the left half, shop on the right
      return { ang: Math.PI - 0.12, dist: 3.2 + portrait * 2.6, h: 1.3, look: new THREE.Vector3(wide ? -1.15 : 0, wide ? 1.0 : 0.25, 0), k: 3 };
    }
    if (state === 'avatars' || state === 'gacha' || state === 'quests') {
      return { ang: Math.PI - 0.1, dist: 3.6 + portrait * 2.2, h: 1.35, look: new THREE.Vector3(wide ? 1.1 : 0, wide ? 1.0 : 0.5, 0), k: 3 };
    }
    if (state === 'shop') { // maps: look down the track toward the sky
      return { ang: 0.32, dist: 6.5 + portrait * 3, h: 3.2, look: new THREE.Vector3(wide ? 2.6 : 0, wide ? 1.4 : -0.6, -14), k: 2.5 };
    }
    const ps = player ? player.s : 1;
    const zs = ps < 1 ? Math.max(0.09, Math.pow(ps, 0.75)) : Math.pow(ps, 0.6); // zoom in as you shrink
    return { ang: 0, dist: (7 + portrait * 4.5) * zs, h: (4.0 + portrait * 2.2) * zs, look: new THREE.Vector3(px * (1 - 0.3 * zs), 1.0 * zs, -9 * zs), zs, k: state === 'countdown' ? 3.2 : 6 };
  }
  function snapCamera() { const t = camTarget(); cam.ang = t.ang; cam.dist = t.dist; cam.h = t.h; cam.look.copy(t.look); }
  function updateCamera(dt) {
    const t = camTarget();
    const k = Math.min(1, dt * t.k);
    cam.ang = lerp(cam.ang, t.ang, k); cam.dist = lerp(cam.dist, t.dist, k); cam.h = lerp(cam.h, t.h, k); cam.look.lerp(t.look, k);
    const px = player ? player.x : 0;
    const inRun = ['play', 'countdown', 'pause', 'dying', 'falling', 'over'].includes(state);
    camera.position.set((inRun ? px * 0.55 : 0) + Math.sin(cam.ang) * cam.dist, cam.h, Math.cos(cam.ang) * cam.dist);
    cam.zs = lerp(cam.zs || 1, t.zs || 1, k);
    { const want = baseFov + (player && player.light > 0 && state === 'play' ? 26 : 0) + (player && !(player.light > 0) && (player.turbo > 0 || player.boost > 0) && state === 'play' ? (player.boostSpecial && player.boost > 0 ? 16 : player.turbo > 0 ? 14 : 9) : 0);
      if (Math.abs(camera.fov - want) > 0.05) { camera.fov = lerp(camera.fov, want, Math.min(1, dt * 5)); camera.updateProjectionMatrix(); } }
    { const fxm = mapFx(activeMap), fz = Math.max(1, cam.zs); scene.fog.near = fxm.fogNear * fz; scene.fog.far = fxm.fogFar * fz;
      if (player && player.cfx && player.cfx.fogbomb && inRunNow()) { scene.fog.near = 4 * fz; scene.fog.far = 26 * fz; } }
    if (inRun) camera.position.x += px * 0.45 * (1 - cam.zs); // follow closely when zoomed in
    const sk = shake * cam.zs;
    if (shake > 0 && !reduceMotion) { camera.position.x += (Math.random() - 0.5) * sk; camera.position.y += (Math.random() - 0.5) * sk; }
    camera.lookAt(cam.look);
  }
  function resize() {
    const r = wrap.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camAspect = r.width / Math.max(1, r.height);
    camera.aspect = camAspect;
    baseFov = camAspect >= 1.2 ? 58 : Math.min(92, 58 + (1.2 - camAspect) * 42);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }

  // ================= HUD =================
  function updateHud() {
    const s = Math.floor(score || 0);
    const lvl = player ? player.level : START_LEVEL;
    const sh = player && player.shield ? 1 : 0;
    const pw = player ? [player.turbo > 0 ? 'turbo:' + Math.ceil(player.turbo) : '', player.spring > 0 ? 'spring:' + Math.ceil(player.spring) : '', player.surge > player.level ? 'surge' : '', player.shrinkTo >= 0 ? 'shrinking' : '', player.boost > 0 ? 'b:' + Math.ceil(player.boost) : '', 'ph:' + player.photon + ':' + Math.ceil(player.light) + ':' + Math.ceil(player.lsCooldown || 0), Object.keys(player.cfx || {}).map(k => k + Math.ceil(player.cfx[k])).join('.'), player.unstable !== undefined ? 'u:' + Math.ceil(player.unstable) : ''].join(',') : '';
    const key = s + '|' + lvl + '|' + runCoins + '|' + sh + '|' + pw;
    if (key === lastHud) return;
    lastHud = key;
    $('score').textContent = s;
    $('runCoins').textContent = fmt(runCoins);
    dots.forEach((d, i) => d.classList.toggle('on', i <= lvl));
    multEl.textContent = '×' + MULT[lvl];
    const pip = $('shieldPip');
    pip.textContent = sh ? 'Shield' : 'Charging';
    pip.classList.toggle('off', !sh);
    const box = $('powers'); box.innerHTML = '';
    if (player) {
      const chip = (kind, label) => { const c = document.createElement('span'); c.className = 'power-chip'; c.style.background = POWERS[kind].css; c.textContent = label; box.appendChild(c); };
      if (player.turbo > 0) chip('turbo', 'Turbo ' + Math.ceil(player.turbo) + 's');
      if (player.spring > 0) chip('spring', 'Spring ' + Math.ceil(player.spring) + 's');
      if (player.surge > player.level) chip('surge', 'Growing');
      for (const k in player.cfx || {}) { const c = document.createElement('span'); c.className = 'power-chip'; c.style.background = POWERS[k].bad ? '#FF8A8A' : '#9CFFB0'; c.textContent = POWERS[k].name + ' ' + Math.ceil(player.cfx[k]) + 's'; box.appendChild(c); }
      if (player.shrinkTo >= 0) chip('shrinksurge', 'Shrinking');
      if (player.light > 0 || player.photon > 0 || player.lsCooldown > 0) { const c = document.createElement('span'); c.className = 'power-chip'; c.style.background = player.lsCooldown > 0 ? '#9AA0A8' : '#FFF27A'; c.textContent = player.light > 0 ? 'LIGHTSPEED ' + Math.ceil(player.light) + 's' : player.lsCooldown > 0 ? 'Cooling ' + Math.ceil(player.lsCooldown) + 's' : 'Light ' + player.photon + '/3'; box.appendChild(c); }
      if (player.boost > 0) { const c = document.createElement('span'); c.className = 'power-chip'; c.style.background = player.boostSpecial ? 'linear-gradient(90deg,#FFC928,#FF7AE0)' : '#6FC3FF'; c.textContent = (player.boostSpecial ? 'Super Boost ' : 'Boost ') + Math.ceil(player.boost) + 's'; box.appendChild(c); }
      if (player.unstable !== undefined) { const c = document.createElement('span'); c.className = 'power-chip'; c.style.background = player.unstable <= 2 ? '#FF5A5A' : '#C79BFF'; c.textContent = 'Unstable ' + Math.max(0, Math.ceil(player.unstable)) + 's'; box.appendChild(c); }
    }
  }

  // ================= loop =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now; clock += dt;
    syncState();
    if (activeRunner.id === 'omega') { const h = (clock * 0.12) % 1; avatarMat.color.setHSL(h, 0.85, 0.64); avatarMat.emissive.setHSL((h + 0.5) % 1, 0.9, 0.45); }
    if (state === 'play') {
      if (qte) { qte.t -= dt; updateQteUi(); if (qte.t <= 0) endQte(false); update(dt * 0.06); }
      else update(dt);
    }
    else if (state === 'title' || state === 'shop' || state === 'transition' || state === 'settings' || state === 'players') {
      if (state === 'shop' && shopTab === 'maps') scrollWorld(6 * dt);
      if (state === 'shop' && shopTab !== 'maps') { player.turn += dt * 0.7; animateRunner(dt, 0, 'turntable'); }
      else { player.turn = 0; animateRunner(dt, 0, 'idle'); }
    } else if (state === 'avatars' || state === 'gacha') {
      if (state === 'gacha') updateGachaFx(dt); else player.turn += dt * 0.7;
      animateRunner(dt, 0, 'turntable'); updateParticles(dt);
    } else if (state === 'countdown') {
      countT += dt; player.turn = 0;
      animateRunner(dt, 0, 'idle');
      const step = Math.floor(countT / 0.6);
      if (step !== countStep) {
        countStep = step;
        if (step === 1) { toast('2', true); sfx('click', 1, 0.9); }
        else if (step === 2) { toast('1', true); sfx('click', 1, 1.0); }
        else if (step === 3) { toast('Go!', true); state = 'play'; sfx('power', 0.9, 1.2); }
      }
    } else if (state === 'tutpause') {
      animateRunner(dt, 0, 'run');
    } else if (state === 'dying') {
      dieT -= dt; updateParticles(dt); updateDebris(dt);
      if (dieT <= 0) showOver();
    } else if (state === 'falling') {
      const p = player;
      p.vy -= GRAV * dt; p.y += p.vy * dt; p.tumble += dt * 4;
      rig.root.position.set(p.x, p.y, 0);
      rig.root.rotation.z = Math.sign(p.x) * -p.tumble;
      shadow.visible = false; rig.bubble.visible = false;
      updateParticles(dt); updateDebris(dt);
      if (p.y < -14) showOver();
    }
    updateAtmo(dt);
    updateTrails(dt, scrollAcc);
    updateWeather(dt, scrollAcc); scrollAcc = 0;
    if (shake > 0) shake = Math.max(0, shake - dt * 1.2);
    updateCamera(dt);
    sun.position.x = camera.position.x - 14;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ================= input =================
  const JUMP = ['Space', 'ArrowUp', 'KeyW'], LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], DOWN = ['ArrowDown', 'KeyS'];
  function pressJump() { if (state !== 'play') return; player.buffer = 0.12; input.jumpHeld = true; }
  function releaseJump() {
    if (!input.jumpHeld) return;
    input.jumpHeld = false;
    if (state === 'play' && player.vy > 5) player.vy = 5;
  }
  addEventListener('keydown', e => {
    const gameKey = [...JUMP, ...LEFT, ...RIGHT, ...DOWN].includes(e.code);
    if (state === 'avatars' || state === 'shop' || state === 'gacha' || state === 'quests' || state === 'settings' || state === 'players') { if (e.code === 'Escape') backToTitle(); return; }
    if (state === 'tutpause') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); resumeTut(); } return; }
    if (state === 'title' || state === 'over' || state === 'transition' || state === 'quests') return;
    if (gameKey) e.preventDefault();
    if (state === 'pause') { if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); resume(); } return; }
    if (state !== 'play' && state !== 'countdown') return;
    if (e.code === 'KeyP' || e.code === 'Escape') { pause(); return; }
    if (LEFT.includes(e.code)) input.left = true;
    if (RIGHT.includes(e.code)) input.right = true;
    if (DOWN.includes(e.code)) input.down = true;
    if (qte && !e.repeat) { if (LEFT.includes(e.code)) qtePress(-1); if (RIGHT.includes(e.code)) qtePress(1); }
    if (JUMP.includes(e.code) && !e.repeat) pressJump();
  });
  addEventListener('keyup', e => {
    if (LEFT.includes(e.code)) input.left = false;
    if (RIGHT.includes(e.code)) input.right = false;
    if (DOWN.includes(e.code)) input.down = false;
    if (JUMP.includes(e.code)) releaseJump();
  });
  function hold(id, on, off) {
    const b = $(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('held'); on(); });
    const end = () => { b.classList.remove('held'); off(); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    b.addEventListener('lostpointercapture', end);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  hold('tLeft', () => { input.left = true; qtePress(-1); }, () => { input.left = false; });
  hold('tRight', () => { input.right = true; qtePress(1); }, () => { input.right = false; });
  $('qteBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (qte) qtePress(-qte.side); });
  hold('tJump', pressJump, releaseJump);
  addEventListener('blur', () => { input.left = input.right = input.down = false; releaseJump(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  playBtn.addEventListener('click', () => startRun(false));
  $('avatarsBtn').addEventListener('click', openAvatars);
  $('shopBtn').addEventListener('click', openShop);
  $('avatarBack').addEventListener('click', backToTitle);
  $('shopBack').addEventListener('click', backToTitle);
  $('spinBtn').addEventListener('click', openGacha);
  $('luckyGo').addEventListener('click', () => spin('lucky'));
  $('ultraGo').addEventListener('click', () => spin('ultra'));
  $('questsBtn').addEventListener('click', openQuests);
  function openSettings() {
    state = 'settings'; showScreen('settings');
    document.querySelectorAll('#qualityList .q-opt').forEach(b => b.setAttribute('aria-checked', b.dataset.q === QUALITY));
    syncSoundSettings();
    $('settingsBack').focus();
  }
  function saveStatusText() {
    const st = Store.status();
    if (st.backend === 'portal') return 'Your progress is saved to your CrazyGames account after every change, so it follows you to other devices.';
    if (st.persistent) return 'Your progress is saved on this device after every change. In a private or incognito window it is kept until that window closes.';
    return 'This browser is blocking storage, so your progress cannot be saved here. The game still works and keeps everything until you close this tab.';
  }
  function syncSoundSettings() {
    $('saveStatus').textContent = saveStatusText();
    const a = save.audio;
    $('musicVol').value = Math.round(a.music * 100); $('musicVolOut').textContent = Math.round(a.music * 100) + '%';
    $('sfxVol').value = Math.round(a.sfx * 100); $('sfxVolOut').textContent = Math.round(a.sfx * 100) + '%';
    $('muteBtn').setAttribute('aria-checked', a.muted ? 'true' : 'false');
  }
  $('musicVol').addEventListener('input', e => { Snd.setMusic(e.target.value / 100); $('musicVolOut').textContent = e.target.value + '%'; });
  $('sfxVol').addEventListener('input', e => { Snd.setSfx(e.target.value / 100); $('sfxVolOut').textContent = e.target.value + '%'; });
  $('sfxVol').addEventListener('change', () => sfx('coin', 0.7)); // a sample at the new volume
  $('muteBtn').addEventListener('click', () => { Snd.setMuted(!save.audio.muted); syncSoundSettings(); });
  $('settingsBtn').addEventListener('click', openSettings);
  const visibleProfiles = () => profiles.list.filter(pr => currentAccount ? pr.account === currentAccount : !pr.account);
  $('tutSkipBtn').addEventListener('click', () => { if (tut) endTutorial(true); });
  $('skipTutTitle').addEventListener('click', () => { save.tutorialDone = true; persist(); $('skipTutTitle').hidden = true; toast('Tutorial skipped'); });
  function renderPlayerChip() {
    $('skipTutTitle').hidden = !!save.tutorialDone; $('playerBtn').textContent = 'Player: ' + activeProfile.name + (currentAccount ? ' (signed in)' : '') + ' · switch'; }
  function openPlayers() { state = 'players'; showScreen('players'); renderPlayers(); $('playersBack').focus(); }
  function renderPlayers() {
    const box = $('playersList'); box.innerHTML = '';
    $('playersSub').textContent = currentAccount
      ? 'You are signed in, so this progress belongs to your ' + (PORTAL === 'poki' ? 'Poki' : 'CrazyGames') + ' account. Nobody else can use it, and other players start from scratch.'
      : 'Each player keeps their own progress. Pick a player, or start a new one: new players always begin from scratch.';
    $('newPlayerBox').hidden = !!currentAccount;
    for (const pr of visibleProfiles()) {
      const d = readSaveOf(pr), mine = pr.id === profiles.active, row = document.createElement('div'); row.className = 'item' + (mine ? ' selected' : '');
      const main = document.createElement('div'); main.className = 'item-main'; main.style.cursor = 'default';
      const txt = document.createElement('div'); txt.className = 'item-text';
      const nm = document.createElement('strong'); nm.textContent = pr.name + (mine ? ' (playing)' : '');
      const ds = document.createElement('span'); ds.textContent = 'Level ' + (d.level || 1) + ' · ' + fmt(d.coins || 0) + ' coins';
      txt.append(nm, ds); main.append(txt); row.append(main);
      if (!mine) { const go = document.createElement('button'); go.className = 'act equip'; go.textContent = 'Play'; go.addEventListener('click', () => { if (switchProfile(pr.id)) reloadGame(); }); row.append(go); }
      if (!pr.account) {
        const del = document.createElement('button'); del.className = 'act danger'; del.textContent = 'Delete'; let armed = 0;
        del.addEventListener('click', () => {
          if (!armed) { armed = 1; del.textContent = 'Tap again to delete'; setTimeout(() => { armed = 0; del.textContent = 'Delete'; }, 3000); return; }
          removeProfile(pr.id);
        });
        row.append(del);
      }
      box.appendChild(row);
    }
  }
  function removeProfile(id) {
    const pr = profiles.list.find(x => x.id === id); if (!pr) return;
    lsDel(saveKeyFor(pr)); profiles.list = profiles.list.filter(x => x.id !== id);
    if (!profiles.list.some(x => !x.account)) addProfile('Player ' + profiles.next, null); // always keep one guest player
    if (profiles.active === id) { profiles.active = (profiles.list.find(x => !x.account) || profiles.list[0]).id; saveProfiles(); reloadGame(); return; }
    saveProfiles(); renderPlayers();
  }
  function startNewPlayer() {
    if (currentAccount) return;
    const name = $('newPlayerName').value.trim() || ('Player ' + profiles.next), pr = addProfile(name, null);
    switchProfile(pr.id); reloadGame(); // the new player's save does not exist yet, so they begin with nothing
  }
  $('playerBtn').addEventListener('click', openPlayers);
  $('playersBack').addEventListener('click', backToTitle);
  $('newPlayerBtn').addEventListener('click', startNewPlayer);
  $('newPlayerName').addEventListener('keydown', e => { if (e.key === 'Enter') startNewPlayer(); });
  $('settingsBack').addEventListener('click', backToTitle);
  document.querySelectorAll('#qualityList .q-opt').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.q === QUALITY) return;
    Store.set('poki_ignore_shrinkrun-quality', b.dataset.q);
    persist();
    reloadGame(); // textures and scenery are built at load, so a fresh start applies the new quality
  }));
  $('questBack').addEventListener('click', backToTitle);
  $('tutBtn').addEventListener('click', () => startRun(true));
  $('tutGo').addEventListener('click', resumeTut);
  $('tutSkip').addEventListener('click', () => endTutorial(true));
  $('welcomeGo').addEventListener('click', () => { $('welcome').hidden = true; goTitle(true); });
  $('spinGo').addEventListener('click', () => spin('normal'));
  $('gachaBack').addEventListener('click', backToTitle);
  $('againBtn').addEventListener('click', () => afterRun(() => startRun()));
  $('overMenuBtn').addEventListener('click', () => afterRun(() => goTitle(true)));
  $('pauseMenuBtn').addEventListener('click', () => goTitle(true));
  $('resumeBtn').addEventListener('click', resume);
  $('pauseBtn').addEventListener('click', () => { state === 'pause' ? resume() : pause(); });
  addEventListener('resize', resize);

  // ================= opening =================
  resize();
  reset();
  state = 'title';
  showScreen('title');
  updateWallet();
  snapCamera();
  cam.dist += 2.5; cam.h += 0.6;
  playBtn.disabled = PORTAL !== 'demo'; // portal builds wait to learn who is playing first
  requestAnimationFrame(frame);
  setInterval(syncState, 300); // keeps portal gameplay events and music right even if the tab stops drawing
  Portal.loadingFinished();

  function introTitle() {
    if (reduceMotion) {
      logo.style.opacity = 1;
      fadeEl.classList.add('out');
      screens.title.classList.add('revealed');
      updateLevelBadge();
      setTimeout(() => { if (state === 'title' && !save.tutorialDone) startRun(true); }, 1200);
      return;
    }
    // start with the title big and centred, then glide it to its place above the buttons
    const wr = wrap.getBoundingClientRect();
    const r = logo.getBoundingClientRect();
    const dx = wr.left + wr.width / 2 - (r.left + r.width / 2);
    const dy = wr.top + wr.height / 2 - (r.top + r.height / 2);
    const sc = Math.max(1, Math.min(1.9, (wr.width * 0.9) / r.width, (wr.height * 0.6) / r.height));
    logo.style.transition = 'none';
    logo.style.transform = `translate(${dx}px, ${dy}px) scale(${sc * 1.15})`;
    void logo.offsetWidth;
    fadeEl.classList.add('out');
    logo.style.transition = 'opacity .9s ease, transform 1.4s cubic-bezier(.2,.8,.3,1)';
    logo.style.opacity = 1;
    logo.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
    setTimeout(() => {
      logo.style.transition = 'transform 1s cubic-bezier(.7,0,.2,1)';
      logo.style.transform = 'translate(0px, 0px) scale(1)';
    }, 1700);
    setTimeout(() => { screens.title.classList.add('revealed'); updateLevelBadge(); }, 2450);
    setTimeout(() => { if (state === 'title' && !save.tutorialDone) startRun(true); }, 4200);
    setTimeout(() => { if (state === 'title') playBtn.focus({ preventScroll: true }); }, 3000);
  }
  const begin = () => requestAnimationFrame(introTitle);
  const startIntro = () => {
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 800))]).then(begin);
    else begin();
  };
  Portal.account().then(id => {
    currentAccount = id || null;
    if (applyAccount(id)) { reloadGame(); return; } // a different player: load their own save, never the previous player's
    playBtn.disabled = false; renderPlayerChip(); startIntro();
    if (!Store.status().persistent) setTimeout(() => warn('Can’t save in this browser mode', '#FFB347', 6000), 2600);
  });
});
