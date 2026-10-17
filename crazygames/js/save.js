/* Saving. Uses IndexedDB (or CrazyGames' own data module for signed-in CrazyGames players) and never localStorage for saving.
   Every change lands in a live in-memory copy first, so saving can never fail; that copy is mirrored to storage a moment later,
   whenever the page is hidden or closed, and every few seconds. If the browser blocks storage (some private modes), the game still works
   and keeps everything in memory until the tab closes. */
window.__STORE_READY = (function () {
  var PORTAL = window.__PORTAL || 'demo', DBNAME = 'shrinkrun', STORE = 'kv', BLOB = 'shrinkrun-store';
  var mem = {}, dirty = {}, ver = 0, db = null, backend = 'memory', cgData = null, timer = null, flushing = null, failures = 0, loggedIn = false, legacy = [];
  var now = function () { return Date.now(); };
  function withTimeout(p, ms, fallback) {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(fallback); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); resolve(v); }, function () { clearTimeout(t); resolve(fallback); });
    });
  }
  function openDB() {
    return new Promise(function (resolve) {
      try {
        if (!window.indexedDB) return resolve(null);
        var rq = window.indexedDB.open(DBNAME, 1);
        rq.onupgradeneeded = function () { try { rq.result.createObjectStore(STORE); } catch (e) {} };
        rq.onsuccess = function () {
          var d = rq.result;
          d.onversionchange = function () { try { d.close(); } catch (e) {} if (db === d) db = null; };
          d.onclose = function () { if (db === d) db = null; };
          resolve(d);
        };
        rq.onerror = function () { resolve(null); };
        rq.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function readAll() {
    return new Promise(function (resolve) {
      try {
        var rq = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        rq.onsuccess = function (ev) {
          var c = ev.target.result;
          if (c) { var val = c.value; if (val && typeof val.v === 'string') { var cur = mem[c.key]; if (!cur || (val.t || 0) >= cur.t) mem[c.key] = { v: val.v, t: val.t || 0 }; } c.continue(); }
          else resolve(true);
        };
        rq.onerror = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }
  function writeKeys(keys) {
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE, 'readwrite'), os = tx.objectStore(STORE);
        keys.forEach(function (k) { if (mem[k]) os.put({ v: mem[k].v, t: mem[k].t }, k); else os.delete(k); });
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = tx.onabort = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }
  function probe() { // a real write and read-back, because some browsers open a database and then refuse to store anything in it
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE, 'readwrite'), os = tx.objectStore(STORE), stamp = String(now()), ok = false;
        os.put({ v: stamp, t: 0 }, '__probe__');
        var rq = os.get('__probe__');
        rq.onsuccess = function () { ok = !!(rq.result && rq.result.v === stamp); os.delete('__probe__'); };
        tx.oncomplete = function () { resolve(ok); };
        tx.onerror = tx.onabort = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }
  // One-time move of progress that older versions kept in localStorage. Only this device's guest data is moved; saves tied to a portal
  // account are left alone so they can never end up under a different account.
  function migrateLocal() {
    var moved = [];
    try {
      var ls = window.localStorage, keys = [], i;
      for (i = 0; i < ls.length; i++) keys.push(ls.key(i));
      keys.forEach(function (k) {
        if (!/^(poki_ignore_)?shrinkrun-/.test(k)) return;
        var raw = ls.getItem(k); if (raw == null) return;
        if (k === 'shrinkrun-save-v2' || k === 'shrinkrun-quality' || k.indexOf('poki_ignore_shrinkrun-') === 0) {
          if (!mem[k]) { mem[k] = { v: raw, t: 1 }; dirty[k] = ++ver; }
          moved.push(k);
        } else if (k === 'shrinkrun-profiles-v1') {
          try {
            var ix = JSON.parse(raw); ix.list = (ix.list || []).filter(function (p) { return !p.account; });
            if (ix.list.length && !mem[k]) { mem[k] = { v: JSON.stringify(ix), t: 1 }; dirty[k] = ++ver; }
          } catch (e) {}
          moved.push(k);
        }
      });
    } catch (e) {}
    return moved;
  }
  function cleanLegacy() { if (!legacy.length) return; var l = legacy; legacy = []; try { l.forEach(function (k) { window.localStorage.removeItem(k); }); } catch (e) {} }
  function schedule() { if (!timer) timer = setTimeout(function () { timer = null; flush(); }, 120); }
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (flushing) return flushing.then(function () { return Object.keys(dirty).length ? flush() : true; });
    var keys = Object.keys(dirty); if (!keys.length) return Promise.resolve(true);
    var snap = {}; keys.forEach(function (k) { snap[k] = dirty[k]; });
    var clear = function () { keys.forEach(function (k) { if (dirty[k] === snap[k]) delete dirty[k]; }); };
    flushing = (function () {
      if (backend === 'portal') {
        try { cgData.setItem(BLOB, JSON.stringify(mem)); clear(); failures = 0; return Promise.resolve(true); } catch (e) { failures++; return Promise.resolve(false); }
      }
      if (backend === 'idb') {
        return (db ? Promise.resolve(true) : openDB().then(function (d) { db = d; return !!d; })).then(function (have) {
          if (!have) { failures++; return false; }
          return writeKeys(keys).then(function (ok) {
            if (ok) { clear(); failures = 0; cleanLegacy(); } else { failures++; db = null; }
            return ok;
          });
        });
      }
      clear(); return Promise.resolve(false); // memory only: the live copy is all there is
    })().then(function (ok) { flushing = null; if (!ok && backend !== 'memory') setTimeout(schedule, 1500); return ok; });
    return flushing;
  }
  var Store = {
    get: function (k) { var e = mem[k]; return e ? e.v : null; },
    set: function (k, v) { mem[k] = { v: String(v), t: now() }; dirty[k] = ++ver; schedule(); },
    del: function (k) { delete mem[k]; dirty[k] = ++ver; schedule(); },
    flush: flush,
    status: function () { return { backend: backend, persistent: (backend === 'idb' || backend === 'portal') && failures < 3, failures: failures, signedIn: loggedIn }; }
  };
  window.Store = Store;
  setInterval(function () { if (Object.keys(dirty).length) flush(); }, 5000); // and every few seconds, just in case
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  ['pagehide', 'beforeunload', 'freeze'].forEach(function (ev) { window.addEventListener(ev, function () { flush(); }); });
  return (async function () {
    try {
      // let the portal finish first, so any cloud save it restores is already in place when we read
      if (PORTAL === 'poki' && window.PokiSDK && typeof window.PokiSDK.init === 'function') {
        try { window.__POKI_INIT = Promise.resolve(window.PokiSDK.init()).then(function () { return true; }, function () { return true; }); } catch (e) { window.__POKI_INIT = Promise.resolve(true); }
        await withTimeout(window.__POKI_INIT, 3000, true);
      }
      if (PORTAL === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK && typeof window.CrazyGames.SDK.init === 'function') {
        try { window.__CG_INIT = Promise.resolve(window.CrazyGames.SDK.init()).then(function () { return true; }, function () { return false; }); } catch (e) { window.__CG_INIT = Promise.resolve(false); }
        if (await withTimeout(window.__CG_INIT, 3000, false)) {
          try {
            var sdk = window.CrazyGames.SDK;
            if (sdk.user && sdk.user.isUserAccountAvailable !== false) { var u = await withTimeout(sdk.user.getUser(), 2000, null); loggedIn = !!(u && u.username); }
            if (loggedIn && sdk.data && typeof sdk.data.getItem === 'function') cgData = sdk.data; // a signed-in player's progress lives in their account, not on the device
          } catch (e) {}
        }
      }
      if (cgData) {
        try {
          var blob = JSON.parse(cgData.getItem(BLOB) || '{}');
          Object.keys(blob).forEach(function (k) { if (blob[k] && typeof blob[k].v === 'string') mem[k] = { v: blob[k].v, t: blob[k].t || 0 }; });
          backend = 'portal';
        } catch (e) { cgData = null; }
      }
      if (backend !== 'portal') {
        db = await withTimeout(openDB(), 2500, null);
        if (db && (await readAll()) && (await probe())) backend = 'idb'; else db = null;
        if (!loggedIn) legacy = migrateLocal();
        if (backend === 'idb' && Object.keys(dirty).length) await withTimeout(flush(), 3000, false);
      }
      try { if (backend === 'idb' && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    } catch (e) {}
    return Store.status();
  })();
})();
