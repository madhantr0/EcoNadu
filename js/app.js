/* EcoNadu client app. Static site, no server.
   Data stays in the browser. Posts can sync through Gun.js when GUN_PEERS is set.
   Checks run in the browser, so a determined user can bypass them. Real enforcement needs a server. */
(() => {
  'use strict';

  const CFG = window.ECONADU_CONFIG || {};
  const DISTRICTS = CFG.DISTRICTS || [];
  const STORE_KEY = 'econadu.v3';
  const GUN_KEY = 'econadu-posts-v3';
  const REQUIRE_MOTION = CFG.REQUIRE_MOTION !== false;

  const LIMITS = {
    postsPerDay: 5,
    minGapMs: 3000,
    maxGapMs: 5 * 60000,
    minGreen: 0.10,      // share of pixels that are clearly green
    minLuma: 35,
    maxLuma: 230,
    minShotDiff: 8,      // Hamming distance between shots (different angle)
    dupDist: 5,          // closer than this to an old post = reused photo
    maxShotMeters: 40,
    maxAccuracy: 30,     // GPS accuracy in metres
    motionVar: 0.4,      // variance of accelerometer readings between shots
  };

  // Short starter list. Add more words for your community.
  const BLOCKED = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'slut', 'whore', 'faggot', 'nigger', 'retard', 'rape', 'killyourself'];
  const RESERVED = /(econadu|admin|official|moderator|support|google)/i;

  const BADGES = [
    { icon: '🌱', name: 'First Sprout', hint: 'Plant your first sapling', test: (s) => s.posts >= 1 },
    { icon: '🔗', name: 'SHA-256 Keeper', hint: 'Seal 3 ledger blocks', test: (s) => s.ledger >= 3 },
    { icon: '🌊', name: 'Cauvery Guard', hint: 'Plant 5 saplings', test: (s) => s.posts >= 5 },
    { icon: '🌙', name: 'Night Watcher', hint: 'Plant after 8 PM', test: (s) => s.night >= 1 },
    { icon: '🤝', name: 'Community Voice', hint: 'Comment on 5 posts', test: (s) => s.commented >= 5 },
    { icon: '🌳', name: 'Banyan Legend', hint: 'Plant 10 saplings', test: (s) => s.posts >= 10 },
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeImg = (u) => (typeof u === 'string' && /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/.test(u) ? u : '');

  /* ---------- state ---------- */
  const defaults = () => ({
    session: null,                 // { mode: 'warrior'|'guest', name, picture }  (no email stored)
    district: 'Chennai',
    profile: { name: '', bio: 'Eco-warrior 🌱', avatar: '' },
    posts: [], likes: {}, saved: {}, hidden: {},
    ledger: [], commented: 0, postTimes: [],
  });
  const load = () => {
    try { return { ...defaults(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
    catch { return defaults(); }
  };
  let state = load();
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { toast('Device storage is full. Export your ledger and clear old data.'); }
  };

  let shots = [null, null];        // { dataUrl, green, luma, dh, loc, at }
  let motionSamples = [], motionOn = false;
  let map = null, layerRef = null, pinLayer = null, gun = null, tokenClient = null, pendingAvatar = null;

  /* ---------- on-demand libraries (keeps first load fast) ---------- */
  const loadScript = (src) => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src; sc.onload = res; sc.onerror = rej;
    document.head.appendChild(sc);
  });
  let leafletReady = null;
  function ensureLeaflet() {
    if (!leafletReady) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      leafletReady = loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }
    return leafletReady;
  }

  /* ---------- small helpers ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  function timeAgo(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }
  const districtObj = (name) => DISTRICTS.find((d) => d.name === name) || DISTRICTS[0];
  const inTamilNadu = (lat, lng) => {
    const b = CFG.TN_BOUNDS;
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  };
  const isWarrior = () => !!state.session && state.session.mode === 'warrior';
  const displayName = () => state.profile.name || (state.session && state.session.name) || 'Eco Warrior';
  const coarse = (x) => Math.round(x * 100) / 100;   // about 1 km, the only location shown publicly
  const cleanText = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function haversine(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const hamming = (a, b) => { let d = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++; return d; };

  /* Re-encodes the image through a canvas, which removes EXIF/GPS metadata. */
  function compressImage(file, max = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a valid image.')); };
      img.src = url;
    });
  }

  /* Checks a photo: how green it is, how bright, and a perceptual fingerprint (dHash). */
  const gray = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  function analyseImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 120;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, 160, 120);
        const px = cx.getImageData(0, 0, 160, 120).data;
        let green = 0, luma = 0;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          if (g > 60 && g > r * 1.12 && g > b * 1.12) green++;
          luma += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        const n = px.length / 4;
        const s = document.createElement('canvas');
        s.width = 9; s.height = 8;
        const sx = s.getContext('2d');
        sx.drawImage(img, 0, 0, 9, 8);
        const sp = sx.getImageData(0, 0, 9, 8).data;
        let dh = '';
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          dh += gray(sp, (y * 9 + x) * 4) > gray(sp, (y * 9 + x + 1) * 4) ? '1' : '0';
        }
        resolve({ green: green / n, luma: luma / n, dh });
      };
      img.onerror = () => reject(new Error('Image could not be read.'));
      img.src = dataUrl;
    });
  }

  /* GPS: returns lat, lng and accuracy in metres. */
  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('This device has no GPS.'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        () => reject(new Error('Allow location access to plant a sapling.')),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  /* Motion sensor: records movement between Shot 1 and Shot 2. */
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    motionSamples.push([a.x, a.y, a.z]);
    if (motionSamples.length > 3000) motionSamples.shift();
  }
  function startMotion() {
    motionSamples = [];
    if (!motionOn && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', onMotion);
      motionOn = true;
    }
  }
  function stopMotion() {
    if (motionOn) { window.removeEventListener('devicemotion', onMotion); motionOn = false; }
  }
  function motionVariance() {
    const n = motionSamples.length;
    if (n < 5) return 0;
    let mx = 0, my = 0, mz = 0;
    for (const s of motionSamples) { mx += s[0]; my += s[1]; mz += s[2]; }
    mx /= n; my /= n; mz /= n;
    let v = 0;
    for (const s of motionSamples) v += (s[0] - mx) ** 2 + (s[1] - my) ** 2 + (s[2] - mz) ** 2;
    return v / n;
  }

  /* ---------- community rules ---------- */
  const normalize = (t) => t.toLowerCase()
    .replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's')
    .replace(/[^\p{L}]/gu, '');
  const containsBlocked = (s) => { const n = normalize(s); return BLOCKED.some((w) => n.includes(w)); };
  function moderateCaption(t) {
    const s = cleanText(t);
    if (!s) return '';
    if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|in|io|xyz|ru|info)\b)/i.test(s)) return 'Links are not allowed in captions.';
    if (containsBlocked(s)) return 'This wording is not allowed.';
    return '';
  }
  function moderateName(n) {
    const s = cleanText(n);
    if (s.length < 2) return 'Name must be at least 2 characters.';
    if (!/^[\p{L}\p{N} .'-]+$/u.test(s)) return "Names can use letters, numbers, spaces and . ' - only.";
    if (RESERVED.test(normalize(s))) return 'That name is reserved.';
    if (containsBlocked(s)) return 'This name is not allowed.';
    return '';
  }

  /* ---------- verification (all checks must pass) ---------- */
  const recentPosts = () => state.postTimes.filter((t) => Date.now() - t < 864e5);
  function verifyAll() {
    const [a, b] = shots;
    const items = [];
    const add = (label, pass, note = '') => items.push({ label, pass: !!pass, note });
    const plantOk = (s) => s && s.green >= LIMITS.minGreen && s.luma >= LIMITS.minLuma && s.luma <= LIMITS.maxLuma;

    add('Shot 1 shows a real plant', plantOk(a));
    add('Shot 2 shows a real plant', plantOk(b));

    const diff = a && b ? hamming(a.dh, b.dh) : 0;
    add('Shot 2 is from a different angle', diff >= LIMITS.minShotDiff, a && b ? `(${diff})` : '');

    const reused = !!(a && b) && state.posts.some((p) => Array.isArray(p.dh) && p.dh.some((h) => hamming(h, a.dh) <= LIMITS.dupDist || hamming(h, b.dh) <= LIMITS.dupDist));
    add('Photos are new, not reused', !!(a && b) && !reused);

    const gpsOk = !!(a && b && a.loc && b.loc && a.loc.acc <= LIMITS.maxAccuracy && b.loc.acc <= LIMITS.maxAccuracy);
    add(`GPS locked on both shots (±${LIMITS.maxAccuracy} m)`, gpsOk);

    const apart = gpsOk ? haversine(a.loc, b.loc) : Infinity;
    add('Both shots taken at the same spot', apart <= LIMITS.maxShotMeters, gpsOk ? `(${Math.round(apart)} m apart)` : '');

    add('Inside Tamil Nadu', gpsOk && inTamilNadu(a.loc.lat, a.loc.lng) && inTamilNadu(b.loc.lat, b.loc.lng));

    const gap = a && b ? b.at - a.at : 0;
    add('Shots taken 3 seconds to 5 minutes apart', gap >= LIMITS.minGapMs && gap <= LIMITS.maxGapMs);

    if (REQUIRE_MOTION) {
      const v = motionVariance();
      add('Phone moved between shots (liveness)', v >= LIMITS.motionVar, v ? '' : '(no motion sensor)');
    }

    add('Daily limit (5 posts per day)', recentPosts().length < LIMITS.postsPerDay);

    const capErr = moderateCaption($('camCaption').value);
    add('Caption follows community rules', !capErr, capErr);
    const nameErr = moderateName(displayName());
    add('Name follows community rules', !nameErr, nameErr);

    return { ok: items.every((i) => i.pass), items };
  }
  function renderChecks() {
    const v = verifyAll();
    $('checkList').innerHTML = v.items.map((i) =>
      `<li class="${i.pass ? 'pass' : 'fail'}">${i.pass ? '✅' : '❌'} ${esc(i.label)} ${esc(i.note)}</li>`).join('');
    return v;
  }

  /* ---------- automatic sun-based colours (day only, never dark) ---------- */
  const PHASE_LABEL = { dawn: 'Dawn', sunrise: 'Sunrise', morning: 'Morning', afternoon: 'Afternoon', sunset: 'Sunset', dusk: 'Dusk' };
  const PHASE_ICON = { dawn: '🌄', sunrise: '🌅', morning: '🌤️', afternoon: '☀️', sunset: '🌇', dusk: '🌆' };
  // Standard solar altitude formula (no network needed).
  function solarElevation(date, lat, lng) {
    const rad = Math.PI / 180;
    const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const g = ((357.529 + 0.98560028 * d) % 360) * rad;
    const q = (280.459 + 0.98564736 * d) % 360;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    const e = (23.439 - 0.00000036 * d) * rad;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    const lst = (((gmst + lng / 15) % 24) + 24) % 24 * 15 * rad;
    const ha = lst - ra;
    const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha));
    return alt / rad;
  }
  function sunTimes(date, lat, lng) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    let rise = null, set = null, prev = solarElevation(start, lat, lng);
    for (let t = 10 * 60000; t <= 24 * 3600000; t += 10 * 60000) {
      const at = new Date(start.getTime() + t);
      const e = solarElevation(at, lat, lng);
      if (!rise && prev <= -0.833 && e > -0.833) rise = at;
      if (!set && prev > -0.833 && e <= -0.833) set = at;
      prev = e;
    }
    return { rise, set };
  }
  const fmt = (d) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  function currentPhase() {
    const d = districtObj(state.district);
    const now = new Date();
    const elev = solarElevation(now, d.lat, d.lng);
    const st = sunTimes(now, d.lat, d.lng);
    const noon = st.rise && st.set ? new Date((st.rise.getTime() + st.set.getTime()) / 2) : null;
    const morning = noon ? now < noon : now.getHours() < 12;
    let phase;
    if (elev > 12) phase = morning ? 'morning' : 'afternoon';
    else if (elev > 0) phase = morning ? 'sunrise' : 'sunset';
    else phase = morning ? 'dawn' : 'dusk';
    return { phase, st, d, now };
  }
  function updateTheme() {
    const { phase, st, d, now } = currentPhase();
    if (document.body.dataset.phase !== phase) document.body.dataset.phase = phase;
    const lbl = $('phaseLabel');
    if (lbl) lbl.textContent = `${PHASE_ICON[phase]} ${PHASE_LABEL[phase]}`;
    const sunG = document.getElementById('sunGroup');
    if (sunG && st.rise && st.set) {
      const f = (now - st.rise) / (st.set - st.rise);
      const up = f >= 0 && f <= 1;
      sunG.style.opacity = up ? 1 : 0;
      if (up) {
        const x = 120 + f * 960, y = 470 - Math.sin(f * Math.PI) * 360;
        sunG.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      }
    }
    const info = $('sunInfo');
    if (info) info.textContent = `${d.name} · sunrise ${fmt(st.rise)} · sunset ${fmt(st.set)}`;
  }

  /* ---------- districts, stories ---------- */
  function fillDistricts(sel) {
    sel.innerHTML = DISTRICTS.map((d) => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
    sel.value = state.district;
  }
  function setDistrict(name) {
    if (!DISTRICTS.some((d) => d.name === name)) return;
    state.district = name;
    save();
    $('hdrDistrict').value = name;
    $('loginDistrict').value = name;
    renderStories();
    updateTheme();
    if (!$('tab-explore').classList.contains('hidden')) flyDistrict();
    toast('📍 ' + name);
  }
  function renderStories() {
    $('stories').innerHTML = DISTRICTS.map((d) => `
      <button class="story ${d.name === state.district ? 'active' : ''}" data-d="${esc(d.name)}" type="button">
        <span class="ring"><span class="ring-in">${esc(d.name.slice(0, 2).toUpperCase())}</span></span>
        <small>${esc(d.name)}</small>
      </button>`).join('');
  }

  /* ---------- feed ---------- */
  function renderFeed() {
    const posts = state.posts.filter((p) => !state.hidden[p.id]).sort((a, b) => b.time - a.time);
    $('feed').innerHTML = posts.length
      ? posts.map(postCard).join('')
      : '<div class="empty">No posts yet. Tap ＋ to plant and share your first sapling 🌱</div>';
  }
  function postCard(p) {
    const liked = !!state.likes[p.id];
    const saved = !!state.saved[p.id];
    const img = safeImg(p.image);
    const av = safeImg(p.author.avatar);
    const who = esc(p.author.name || 'Eco Warrior');
    return `
    <article class="card post" data-id="${esc(p.id)}">
      <header class="post-head">
        <div class="avatar sm">${av ? `<img src="${esc(av)}" alt="">` : esc(((p.author.name || 'E')[0] || 'E').toUpperCase())}</div>
        <div class="who"><b>${who}</b><small>${esc(p.district)} · ${timeAgo(p.time)}${p.hash ? ' · 🔗 ' + esc(p.hash.slice(0, 8)) : ''}</small></div>
      </header>
      ${img ? `<img class="post-img" src="${esc(img)}" alt="Sapling photo" loading="lazy">` : ''}
      <div class="post-actions">
        <button data-act="like" type="button">${liked ? '❤️' : '🤍'} <span>${p.likes || 0}</span></button>
        <button data-act="comment" type="button">💬 <span>${p.comments.length}</span></button>
        <button data-act="share" type="button">✈️</button>
        <button data-act="save" type="button">${saved ? '🔖' : '📑'}</button>
        <button data-act="report" class="right" type="button" title="Report">⚑</button>
      </div>
      <p class="caption"><b>${who}</b> ${esc(p.caption)}</p>
      <div class="comments">${p.comments.slice(-2).map((c) => `<p><b>${esc(c.who)}</b> ${esc(c.text)}</p>`).join('')}</div>
      <form class="comment-form hidden">
        <input name="c" maxlength="140" placeholder="Add a comment…" autocomplete="off">
        <button type="submit">Post</button>
      </form>
    </article>`;
  }
  const findPost = (el) => {
    const card = el.closest('.post');
    return card ? state.posts.find((x) => x.id === card.dataset.id) : null;
  };
  function toggleLike(p) {
    state.likes[p.id] = !state.likes[p.id];
    p.likes = Math.max(0, (p.likes || 0) + (state.likes[p.id] ? 1 : -1));
    save();
    renderFeed();
  }
  async function shareLink(p) {
    try {
      if (navigator.share) await navigator.share({ title: 'EcoNadu', text: p.caption, url: location.origin + location.pathname });
      else { await navigator.clipboard.writeText(location.origin + location.pathname); toast('Link copied 🔗'); }
    } catch { /* cancelled */ }
  }

  /* ---------- weather ---------- */
  async function loadWeather() {
    const d = districtObj(state.district);
    $('wDistrict').textContent = d.name;
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`);
      const c = (await r.json()).current;
      $('wTemp').textContent = Math.round(c.temperature_2m) + '°C';
      $('wHum').textContent = Math.round(c.relative_humidity_2m) + '%';
      $('wWind').textContent = Math.round(c.wind_speed_10m) + ' km/h';
      $('wNote').textContent = c.temperature_2m >= 34 ? '🔥 Heat stress here. Planting priority.' : '🌿 Conditions are stable.';
    } catch {
      $('wNote').textContent = 'Weather is unavailable right now.';
    }
  }

  /* ---------- map (NASA GIBS) ---------- */
  const LAYERS = {
    satellite: { url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/DATE/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', maxNative: 9, opacity: 1 },
    heat: { url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2024-06-15/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png', maxNative: 7, opacity: 0.8 },
  };
  async function initMap() {
    if (map) return;
    try { await ensureLeaflet(); } catch { return; }
    if (map || typeof L === 'undefined') return;
    const d = districtObj(state.district);
    map = L.map('radarMap').setView([d.lat, d.lng], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    setLayer('satellite');
  }
  function setLayer(name) {
    const def = LAYERS[name];
    if (!def || !map) return;
    if (layerRef) map.removeLayer(layerRef);
    layerRef = L.tileLayer(def.url.replace('DATE', daysAgo(4)), { maxZoom: 12, maxNativeZoom: def.maxNative, opacity: def.opacity, attribution: 'NASA GIBS' }).addTo(map);
    document.querySelectorAll('[data-layer]').forEach((b) => b.classList.toggle('on', b.dataset.layer === name));
  }
  function flyDistrict() {
    if (!map) return;
    const d = districtObj(state.district);
    map.setView([d.lat, d.lng], 9);
    renderMapPins();
  }
  function renderMapPins() {
    if (!pinLayer) return;
    pinLayer.clearLayers();
    state.posts
      .filter((p) => p.district === state.district && Number.isFinite(p.lat) && !state.hidden[p.id])
      .forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#7296C3', fillOpacity: 0.95 })
          .bindPopup(`<b>${esc(p.author.name)}</b><br>${esc(p.caption)}`)
          .addTo(pinLayer);
      });
  }

  /* ---------- camera: two-shot planting ---------- */
  function resetShots() {
    shots = [null, null];
    stopMotion();
    $('previews').classList.add('hidden');
    $('prev1').src = ''; $('prev2').src = '';
    $('pick1').querySelector('span').innerHTML = '📸 Shot 1<br><small>close-up</small>';
    $('pick2').querySelector('span').innerHTML = '📸 Shot 2<br><small>step sideways</small>';
    $('camCaption').value = '';
    $('checkList').innerHTML = '';
  }
  async function takeShot(idx, file) {
    if (!file) return;
    if (!isWarrior()) { toast('Sign in with Google to plant and share.'); return; }
    if (idx === 1 && !shots[0]) { toast('Take Shot 1 first.'); return; }
    try {
      const dataUrl = await compressImage(file);
      const a = await analyseImage(dataUrl);
      let loc = null;
      try { loc = await getLocation(); } catch (e) { toast(e.message); }
      if (idx === 0) { shots[1] = null; startMotion(); }
      else stopMotion();
      shots[idx] = { dataUrl, ...a, loc, at: Date.now() };
      $(idx === 0 ? 'prev1' : 'prev2').src = dataUrl;
      $('previews').classList.remove('hidden');
      $(idx === 0 ? 'pick1' : 'pick2').querySelector('span').innerHTML = `✓ Shot ${idx + 1} taken`;
      renderChecks();
    } catch (e) { toast(e.message); }
  }

  async function publishPost() {
    if (!isWarrior()) return toast('Sign in with Google to plant and share.');
    const v = renderChecks();
    if (!v.ok) return toast('Some checks failed. See the list below.');
    const btn = $('publishBtn');
    btn.disabled = true; btn.textContent = 'Sealing…';
    try {
      const [a, b] = shots;
      const imageDigest = await sha256Hex(a.dataUrl + '|' + b.dataUrl);
      // Exact coordinates go only into the private ledger on this device.
      const block = await addBlock({
        district: state.district,
        lat: +a.loc.lat.toFixed(5), lng: +a.loc.lng.toFixed(5),
        time: Date.now(), imageDigest,
      });
      const post = {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        author: { name: displayName(), avatar: safeImg(state.profile.avatar) || '' },
        district: state.district,
        caption: cleanText($('camCaption').value) || 'Planted a new sapling 🌳',
        image: a.dataUrl,
        lat: coarse(a.loc.lat), lng: coarse(a.loc.lng),   // public location is rounded
        time: block.time, hash: block.hash,
        dh: [a.dh, b.dh], likes: 0, comments: [], mine: true,
      };
      state.posts.unshift(post);
      state.postTimes.push(Date.now());
      state.posts = state.posts.slice(0, 200);
      save();
      publishToMesh(post);
      resetShots();
      renderStories();
      renderMapPins();
      showTab('home');
      toast('🌳 Verified and shared!');
    } catch (e) {
      toast('⚠️ ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Verify & Share';
    }
  }

  /* ---------- ledger (SHA-256 hash chain) ---------- */
  const blockHash = (b) => sha256Hex([b.index, b.prevHash, b.district, b.lat, b.lng, b.time, b.imageDigest].join('|'));
  async function addBlock(data) {
    const prev = state.ledger.length ? state.ledger[state.ledger.length - 1].hash : 'GENESIS';
    const b = { index: state.ledger.length, prevHash: prev, ...data };
    b.hash = await blockHash(b);
    state.ledger.push(b);
    return b;
  }
  async function verifyLedger() {
    let prev = 'GENESIS';
    for (let i = 0; i < state.ledger.length; i++) {
      const b = state.ledger[i];
      if (b.index !== i || b.prevHash !== prev) return false;
      if ((await blockHash(b)) !== b.hash) return false;
      prev = b.hash;
    }
    return true;
  }

  /* ---------- optional Gun.js sync ---------- */
  async function initGun() {
    if (gun || !CFG.GUN_PEERS || !CFG.GUN_PEERS.length) return;
    try {
      if (typeof Gun === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/gun/gun.js');
      gun = Gun({ peers: CFG.GUN_PEERS });
      gun.get(GUN_KEY).map().on((data) => {
        if (!data || typeof data.json !== 'string' || data.json.length > 8e6) return;
        try { mergeRemotePost(JSON.parse(data.json)); } catch { /* ignore */ }
      });
    } catch { gun = null; }
  }
  function validRemote(p) {
    return !!p && typeof p.id === 'string' && p.id.length < 80
      && !!safeImg(p.image) && typeof p.caption === 'string' && p.caption.length <= 200
      && !!p.author && typeof p.author.name === 'string'
      && !moderateCaption(p.caption) && !moderateName(p.author.name)
      && Array.isArray(p.dh) && p.dh.length === 2 && p.dh.every((h) => /^[01]{64}$/.test(h))
      && Number.isFinite(p.lat) && Number.isFinite(p.lng) && inTamilNadu(p.lat, p.lng)
      && DISTRICTS.some((d) => d.name === p.district);
  }
  function mergeRemotePost(p) {
    if (!validRemote(p) || state.posts.some((x) => x.id === p.id)) return;
    state.posts.unshift({
      id: p.id, author: { name: cleanText(p.author.name), avatar: '' }, district: p.district,
      caption: cleanText(p.caption), image: p.image, lat: p.lat, lng: p.lng, time: +p.time || Date.now(),
      hash: typeof p.hash === 'string' ? p.hash.slice(0, 64) : '', dh: p.dh,
      likes: +p.likes || 0, comments: [], mine: false,
    });
    state.posts = state.posts.slice(0, 200);
    save();
    renderFeed();
  }
  function publishToMesh(post) {
    if (!gun) return;
    const { mine, ...copy } = post;
    gun.get(GUN_KEY).get(post.id).put({ json: JSON.stringify(copy) });
  }

  /* ---------- profile, badges ---------- */
  const myPosts = () => state.posts.filter((p) => p.mine);
  function stats() {
    const mine = myPosts();
    const night = mine.filter((p) => { const h = new Date(p.time).getHours(); return h >= 20 || h < 5; }).length;
    const xp = mine.length * 50 + state.commented * 5 + state.ledger.length * 10;
    return { posts: mine.length, xp, level: Math.floor(xp / 200) + 1, ledger: state.ledger.length, night, commented: state.commented };
  }
  function renderBadges() {
    const s = stats();
    const got = BADGES.filter((b) => b.test(s)).length;
    $('xpLine').textContent = `Level ${s.level} · ${s.xp} XP · ${got}/${BADGES.length} badges`;
    $('xpFill').style.width = (s.xp % 200) / 2 + '%';
    $('badgeGrid').innerHTML = BADGES.map((b) => {
      const ok = b.test(s);
      return `<div class="card badge ${ok ? '' : 'locked'}"><div class="b-ic">${b.icon}</div><b>${esc(b.name)}</b><small>${ok ? 'Unlocked' : esc(b.hint)}</small></div>`;
    }).join('');
  }
  async function renderProfile() {
    const s = stats();
    const name = displayName();
    $('pName').textContent = name;
    $('pBio').textContent = state.profile.bio || '';
    $('pDistrict').textContent = '📍 ' + state.district + ', Tamil Nadu';
    setAvatar($('pAvatar'), state.profile.avatar, name);
    $('sPosts').textContent = s.posts;
    $('sXp').textContent = s.xp;
    $('sLevel').textContent = s.level;
    const imgs = myPosts().map((p) => safeImg(p.image)).filter(Boolean).map((src) => `<img src="${esc(src)}" alt="">`).join('');
    $('pGrid').innerHTML = imgs || '<p class="muted small">Your plantings will appear here.</p>';
    $('ledgerStatus').textContent = 'Checking ledger…';
    const ok = await verifyLedger();
    $('ledgerStatus').textContent = ok
      ? `🔗 Ledger verified · ${state.ledger.length} sealed blocks`
      : '⚠️ Ledger does not match. Data was changed outside the app.';
  }
  function setAvatar(el, src, name) {
    const s = safeImg(src);
    el.innerHTML = s ? `<img src="${esc(s)}" alt="">` : esc(((name || 'E').trim()[0] || 'E').toUpperCase());
  }
  function openEdit() {
    $('editName').value = state.profile.name || '';
    $('editBio').value = state.profile.bio || '';
    pendingAvatar = null;
    $('editModal').classList.remove('hidden');
  }
  function saveEdit() {
    const name = cleanText($('editName').value);
    if (name) {
      const err = moderateName(name);
      if (err) return toast(err);
      state.profile.name = name;
    }
    const bioErr = moderateCaption($('editBio').value);
    if (bioErr) return toast('Bio: ' + bioErr);
    state.profile.bio = cleanText($('editBio').value).slice(0, 90);
    if (pendingAvatar) state.profile.avatar = pendingAvatar;
    save();
    $('editModal').classList.add('hidden');
    renderAll();
    renderProfile();
    toast('Profile saved ✨');
  }
  function exportLedger() {
    const data = {
      exported: new Date().toISOString(),
      note: 'Contains your exact planting coordinates. Keep this file private.',
      ledger: state.ledger,
      posts: myPosts().map(({ image, ...rest }) => rest),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'econadu-ledger.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- sign in (no email stored) ---------- */
  function signInGoogle() {
    if (!CFG.GOOGLE_CLIENT_ID) {
      $('loginMsg').textContent = 'Add your Google Client ID in js/config.js (see README).';
      return;
    }
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      toast('Google sign-in is still loading. Try again in a moment.');
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.GOOGLE_CLIENT_ID,
      scope: 'openid profile',
      callback: async (resp) => {
        if (!resp || !resp.access_token) { toast('Google sign-in was cancelled.'); return; }
        let u = {};
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } });
          if (r.ok) u = await r.json();
        } catch { /* keep defaults */ }
        const name = cleanText(u.name || 'Eco Warrior').slice(0, 22) || 'Eco Warrior';
        state.session = { mode: 'warrior', name, picture: safeImg(u.picture || '') };
        if (!state.profile.name) state.profile.name = moderateName(name) ? '' : name;
        save();
        enterApp();
        toast('Signed in with Google ✅');
      },
    });
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  }
  function enterGuest() {
    state.session = { mode: 'guest', name: 'Guest' };
    save();
    enterApp();
  }
  function signOut() {
    state.session = null;
    save();
    stopMotion();
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    toast('Signed out');
  }

  /* ---------- screens and tabs ---------- */
  function enterApp() {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    setTimeout(initGun, 1200);
    renderAll();
    showTab('home');
  }
  function renderAll() {
    renderStories();
    renderFeed();
    setAvatar($('hdrAvatar'), state.profile.avatar, displayName());
    updateTheme();
  }
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== 'tab-' + name));
    document.querySelectorAll('.bottom-nav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'home') renderFeed();
    if (name === 'explore') {
      loadWeather();
      initMap().then(() => { if (map) { map.invalidateSize(); flyDistrict(); } });
    }
    if (name === 'badges') renderBadges();
    if (name === 'profile') renderProfile();
    if (name === 'cam') {
      if (!isWarrior()) toast('Sign in with Google to plant and share.');
      renderChecks();
    }
    window.scrollTo({ top: 0 });
  }

  /* ---------- bees dodge the cursor or finger ---------- */
  function setupBeeDodge() {
    const bees = [...document.querySelectorAll('.bee-in')];
    if (!bees.length) return;
    let px = 0, py = 0, last = 0;
    const seen = (e) => { px = e.clientX; py = e.clientY; last = Date.now(); };
    document.addEventListener('pointermove', seen, { passive: true });
    document.addEventListener('pointerdown', seen, { passive: true });
    setInterval(() => {
      const active = Date.now() - last < 2000;
      bees.forEach((bee) => {
        if (!active) { bee.style.transform = ''; return; }
        const r = bee.getBoundingClientRect();
        const dx = r.left + r.width / 2 - px, dy = r.top + r.height / 2 - py;
        const d = Math.hypot(dx, dy) || 1, R = 110;
        if (d < R) {
          const push = (R - d) * 0.9;
          bee.style.transform = `translate(${(dx / d * push).toFixed(1)}px,${(dy / d * push).toFixed(1)}px)`;
        } else {
          bee.style.transform = '';
        }
      });
    }, 60);
  }

  /* ---------- init ---------- */
  function init() {
    fillDistricts($('loginDistrict'));
    fillDistricts($('hdrDistrict'));
    updateTheme();
    setInterval(updateTheme, 30000);


    $('loginDistrict').addEventListener('change', (e) => setDistrict(e.target.value));
    $('hdrDistrict').addEventListener('change', (e) => setDistrict(e.target.value));
    $('googleBtn').addEventListener('click', signInGoogle);
    $('guestBtn').addEventListener('click', enterGuest);
    $('bellBtn').addEventListener('click', () => toast('No new notifications 🔔'));

    $('stories').addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (b) setDistrict(b.dataset.d);
    });

    $('feed').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      const p = findPost(e.target);
      if (!act || !p) return;
      switch (act.dataset.act) {
        case 'like': toggleLike(p); break;
        case 'comment': {
          const f = act.closest('.post').querySelector('.comment-form');
          f.classList.toggle('hidden');
          f.querySelector('input').focus();
          break;
        }
        case 'share': shareLink(p); break;
        case 'save':
          state.saved[p.id] = !state.saved[p.id];
          save(); renderFeed();
          toast(state.saved[p.id] ? 'Saved 🔖' : 'Removed from saved');
          break;
        case 'report':
          state.hidden[p.id] = true;
          save(); renderFeed(); renderMapPins();
          toast('Hidden on your device. Thanks for reporting.');
          break;
      }
    });
    $('feed').addEventListener('dblclick', (e) => {
      if (!e.target.classList.contains('post-img')) return;
      const p = findPost(e.target);
      if (p && !state.likes[p.id]) toggleLike(p);
    });
    $('feed').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = findPost(e.target);
      const text = cleanText(e.target.querySelector('input').value);
      if (!p || !text) return;
      const err = moderateCaption(text);
      if (err) return toast(err);
      p.comments = [...p.comments, { who: displayName(), text: text.slice(0, 140) }].slice(-50);
      state.commented++;
      save(); renderFeed();
    });

    document.querySelectorAll('.bottom-nav [data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer)));

    $('pick1').addEventListener('click', async () => {
      // iOS asks for motion permission from a tap
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try { await DeviceMotionEvent.requestPermission(); } catch { /* user declined */ }
      }
    });
    $('shot1Input').addEventListener('change', (e) => takeShot(0, e.target.files[0]));
    $('shot2Input').addEventListener('change', (e) => takeShot(1, e.target.files[0]));
    $('camCaption').addEventListener('input', renderChecks);
    $('publishBtn').addEventListener('click', publishPost);

    $('editBtn').addEventListener('click', openEdit);
    $('editCancel').addEventListener('click', () => $('editModal').classList.add('hidden'));
    $('editSave').addEventListener('click', saveEdit);
    $('editPhoto').addEventListener('change', async (e) => {
      try { pendingAvatar = await compressImage(e.target.files[0], 256, 0.85); toast('Photo ready. Tap Save.'); }
      catch (err) { toast(err.message); }
    });
    $('exportBtn').addEventListener('click', exportLedger);
    $('logoutBtn').addEventListener('click', signOut);
    $('editModal').addEventListener('click', (e) => { if (e.target.id === 'editModal') $('editModal').classList.add('hidden'); });

    setupBeeDodge();
    if (state.session) enterApp();
    else $('login').classList.remove('hidden');
  }


  document.addEventListener('DOMContentLoaded', init);
})();
