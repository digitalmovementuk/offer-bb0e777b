(function (win, doc) {
'use strict';
try {
var hero = doc.getElementById('hero');
if (!hero) { return; }
var OPEN_MIN = 6 * 60;
var CLOSE_MIN = 22 * 60;
var BALI_OFFSET_MS = 8 * 3600000;
var STORE_KEY = 'ef-hero-paused';
function api() {
var a = win.EFApi;
return a && typeof a.now === 'function' ? a : null;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowDate() {
var a = api();
try {
if (a) {
var d = a.now();
if (d instanceof Date && isFinite(d.getTime())) { return d; }
}
} catch (e) { }
return new Date();
}
function baliHHMM(d) {
var a = api();
try {
if (a && typeof a.baliParts === 'function') {
var p = a.baliParts(d);
if (p && /^\d{2}:\d{2}$/.test(p.hhmm)) { return p.hhmm; }
}
} catch (e) { }
var b = new Date(d.getTime() + BALI_OFFSET_MS);
return pad2(b.getUTCHours()) + ':' + pad2(b.getUTCMinutes());
}
function each(list, fn) {
for (var i = 0; i < list.length; i++) { fn(list[i]); }
}
function formatIDR(n) {
return 'IDR ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
var clocks = hero.querySelectorAll('[data-clock]');
var hoursEls = hero.querySelectorAll('[data-hours]');
var clockTimer = null;
var shown = '';
function renderClock() {
var d = nowDate();
var t = baliHHMM(d);
if (t !== shown) {
shown = t;
each(clocks, function (el) {
if (el.textContent !== t) { el.textContent = t; }
el.setAttribute('datetime', t);
});
var mins = parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
var label = (mins >= OPEN_MIN && mins < CLOSE_MIN) ? 'open till 22:00' : 'opens 6:00';
each(hoursEls, function (el) {
if (el.textContent !== label) { el.textContent = label; }
});
}
return d;
}
function runClock() {
win.clearTimeout(clockTimer);
var d = renderClock();
var ms = 60000 - (d.getTime() % 60000);
if (!(ms > 0 && ms <= 60000)) { ms = 60000; }
clockTimer = win.setTimeout(runClock, ms + 40);
}
if (clocks.length || hoursEls.length) { runClock(); }
var video = hero.querySelector('.hero__video');
var source = video ? video.querySelector('source') : null;
var btn = hero.querySelector('.hero__pause');
var reduce = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
var armed = false;
var userPaused = false;
var inView = true;
function setState(s) { hero.setAttribute('data-video', s); }
function readPaused() {
try { return win.sessionStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
}
function writePaused(v) {
try {
if (v) { win.sessionStorage.setItem(STORE_KEY, '1'); } else { win.sessionStorage.removeItem(STORE_KEY); }
} catch (e) { }
}
function connectionSaysNo() {
var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (!c) { return false; }
if (c.saveData === true) { return true; }
return /(^|-)2g$/.test(String(c.effectiveType || ''));
}
function allowed() {
if (!video || typeof video.play !== 'function') { return false; }
if (reduce && reduce.matches) { return false; }
if (connectionSaysNo()) { return false; }
return true;
}
function syncButton() {
if (btn) { btn.setAttribute('aria-pressed', userPaused ? 'true' : 'false'); }
}
function update() {
if (!armed) { return; }
if (!userPaused && inView && !doc.hidden) {
if (video.paused) {
var pr = null;
try { pr = video.play(); } catch (e) { pr = null; }
if (pr && typeof pr.then === 'function') {
pr.then(null, function (err) {
if (err && err.name === 'NotAllowedError') {
userPaused = true;
syncButton();
setState('paused');
}
});
}
}
} else if (!video.paused) {
video.pause();
}
}
function disarm() {
if (!video) { return; }
armed = false;
try { video.pause(); video.currentTime = 0; } catch (e) { }
video.setAttribute('data-started', 'false');
if (btn) { btn.hidden = true; }
setState('off');
}
function arm() {
if (armed || !allowed()) { return; }
armed = true;
userPaused = readPaused();
video.muted = true;
if (btn) { btn.hidden = false; syncButton(); }
setState(userPaused ? 'paused' : 'ready');
if ('IntersectionObserver' in win) {
inView = false;
new win.IntersectionObserver(function (entries) {
inView = entries[entries.length - 1].isIntersecting;
update();
}, { threshold: 0.01 }).observe(hero);
} else {
update();
}
}
if (video) {
video.addEventListener('playing', function () {
if (!armed) { try { video.pause(); } catch (e) { } return; }
video.setAttribute('data-started', 'true');
video.setAttribute('data-playing', 'true');
setState('playing');
});
video.addEventListener('pause', function () {
video.setAttribute('data-playing', 'false');
setState(armed ? 'paused' : 'off');
});
if (source) { source.addEventListener('error', disarm); }
if (btn) {
btn.addEventListener('click', function () {
userPaused = !userPaused;
writePaused(userPaused);
syncButton();
update();
});
}
if (reduce) {
var onReduce = function () { if (reduce.matches) { disarm(); } };
if (typeof reduce.addEventListener === 'function') { reduce.addEventListener('change', onReduce); }
else if (typeof reduce.addListener === 'function') { reduce.addListener(onReduce); }
}
}
doc.addEventListener('visibilitychange', function () {
if (!doc.hidden) { runClock(); }
update();
});
function syncPrices() {
var a = api();
if (!a || typeof a.getPasses !== 'function') { return; }
var p = null;
try { p = a.getPasses(); } catch (e) { return; }
if (!p || typeof p.then !== 'function') { return; }
p.then(function (data) {
var tiers = data && data.tiers;
if (!tiers || !tiers.length) { return; }
var perform = null;
var min = Infinity;
each(tiers, function (t) {
var v = t && t.prices ? t.prices.day : null;
if (typeof v === 'number' && isFinite(v)) {
if (v < min) { min = v; }
if (t.id === 'perform') { perform = v; }
}
});
var price = hero.querySelector('.hero__price[data-value]');
if (price && perform !== null && String(perform) !== price.getAttribute('data-value')) {
price.textContent = formatIDR(perform);
price.setAttribute('data-value', String(perform));
}
var from = hero.querySelector('[data-price-from]');
if (from && isFinite(min)) {
var txt = 'Day passes from ' + formatIDR(min);
if (from.textContent !== txt) { from.textContent = txt; }
}
}, function () { });
}
function whenIdle(fn) {
if (typeof win.requestIdleCallback === 'function') { win.requestIdleCallback(fn, { timeout: 2500 }); }
else { win.setTimeout(fn, 400); }
}
function onLoad() {
whenIdle(function () {
try { arm(); } catch (e) { }
try { syncPrices(); } catch (e) { }
});
}
if (doc.readyState === 'complete') { onLoad(); }
else { win.addEventListener('load', onLoad, { once: true }); }
} catch (e) {
}
}(window, document));
