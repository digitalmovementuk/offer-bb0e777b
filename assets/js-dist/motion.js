(function () {
'use strict';
var w = window, d = document, root = d.documentElement;
if (!root || (w.EFMotion && w.EFMotion.version)) { return; }
var VERSION = '2.0.0';
var DEBUG = /[?&]motiondebug\b/.test(String(w.location && w.location.search));
function log() {
if (!DEBUG || !w.console || !w.console.info) { return; }
try { w.console.info.apply(w.console, ['[EFMotion]'].concat([].slice.call(arguments))); } catch (e) { }
}
function guard(fn) {
return function () {
try { return fn.apply(this, arguments); } catch (e) { log('guarded error', e && e.message); }
return undefined;
};
}
function mq(q) { try { return w.matchMedia ? w.matchMedia(q) : null; } catch (e) { return null; } }
var mqReduce = mq('(prefers-reduced-motion: reduce)');
var mqDesk = mq('(min-width: 1024px)');
var mqFine = mq('(hover: hover) and (pointer: fine)');
function on(m) { return !!(m && m.matches); }
function saveData() { try { var c = navigator.connection; return !!(c && c.saveData); } catch (e) { return false; } }
var MOTION = root.classList.contains('motion-ok') && !on(mqReduce) && !saveData();
if (!MOTION) { root.classList.remove('motion-ok'); }
var HAS_IO = 'IntersectionObserver' in w;
var HAS_WAAPI = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
var CAN_TRANSLATE = (function () { try { return 'translate' in d.createElement('div').style; } catch (e) { return false; } })();
var slice = Array.prototype.slice;
var raf = w.requestAnimationFrame ? function (f) { return w.requestAnimationFrame(f); } : function (f) { return w.setTimeout(function () { f(Date.now()); }, 16); };
function now() { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); }
function qsa(sel, ctx) { try { return slice.call((ctx || d).querySelectorAll(sel)); } catch (e) { return []; } }
function qs(sel, ctx) { try { return (ctx || d).querySelector(sel); } catch (e) { return null; } }
function attr(el, n) { return el && el.getAttribute ? el.getAttribute(n) : null; }
function hasTok(el, t) {
var v = attr(el, 'data-motion');
return !!v && (' ' + v + ' ').indexOf(' ' + t + ' ') > -1;
}
function isEl(n) { return !!n && n.nodeType === 1; }
function rendered(el) { return !!(el && el.getClientRects && el.getClientRects().length); }
function vh() { return w.innerHeight || root.clientHeight || 800; }
function scrollY() { return w.pageYOffset || root.scrollTop || 0; }
function cssVar(el, name, fallback) {
try { var v = w.getComputedStyle(el).getPropertyValue(name); v = v && v.trim(); return v || fallback; } catch (e) { return fallback; }
}
function cssMs(el, name, fallback) {
var v = cssVar(el, name, '');
if (!v) { return fallback; }
var n = parseFloat(v);
if (!isFinite(n)) { return fallback; }
return /ms$/.test(v) ? n : (/s$/.test(v) ? n * 1000 : n);
}
function emit(name, detail) {
try { d.dispatchEvent(new w.CustomEvent(name, { detail: detail })); } catch (e) { }
}
function later(fn, ms) { return w.setTimeout(guard(fn), ms); }
function docOrder(a, b) {
if (a === b || !a.compareDocumentPosition) { return 0; }
return (a.compareDocumentPosition(b) & 4) ? -1 : 1;
}
function isOurs(n) {
return isEl(n) && n.classList && (n.classList.contains('m-odo') || n.classList.contains('m-ind') ||
!!(n.closest && n.closest('.m-odo')));
}
var frameQueued = false;
function requestFrame() {
if (frameQueued || d.hidden) { return; }
frameQueued = true;
raf(onFrame);
}
var onFrame = guard(function () {
frameQueued = false;
var y = scrollY();
updateHeader(y);
if (pxActive) { updateParallax(y); }
});
var hdrEl = null, hdrState = null;
function updateHeader(y) {
if (!hdrEl || !hdrEl.isConnected) { hdrEl = d.getElementById('site-header'); }
if (!hdrEl) { return; }
var scrolled = hdrState ? y > 2 : y > 8;
if (scrolled !== hdrState) {
hdrState = scrolled;
hdrEl.setAttribute('data-scrolled', scrolled ? 'true' : 'false');
}
}
var pxItems = [], pxIO = null, pxActive = false;
function pxAllowed() { return MOTION && on(mqDesk) && on(mqFine); }
function collectParallax(ctx) {
if (!MOTION) { return; }
var list = qsa('[data-motion~="parallax"]', ctx || d);
if (isEl(ctx) && hasTok(ctx, 'parallax')) { list.unshift(ctx); }
list.forEach(function (el) {
if (el.__mPx) { return; }
var depth = parseFloat(attr(el, 'data-motion-depth'));
if (!(depth > 0 && depth < 0.5)) { depth = 0.05; }
var it = { el: el, depth: depth, top: 0, h: 0, cur: 0, vis: false, max: el.closest && el.closest('#hero') ? 60 : 18 };
el.__mPx = it;
pxItems.push(it);
if (HAS_IO) {
if (!pxIO) {
pxIO = new IntersectionObserver(guard(function (entries) {
entries.forEach(function (e) { if (e.target.__mPx) { e.target.__mPx.vis = e.isIntersecting; } });
requestFrame();
}), { rootMargin: '25% 0px 25% 0px' });
}
pxIO.observe(el);
} else { it.vis = true; }
});
measureParallax();
}
function measureParallax() {
pxActive = pxAllowed() && pxItems.length > 0;
var y = scrollY();
pxItems.forEach(function (it) {
if (!it.el.isConnected) { return; }
if (!pxActive) { setPx(it, 0); return; }
var r = it.el.getBoundingClientRect();
it.top = r.top + y - it.cur;
it.h = r.height;
});
if (pxActive) { requestFrame(); }
}
function setPx(it, off) {
if (Math.abs(off - it.cur) < 0.1 && off !== 0) { return; }
it.cur = off;
var v = off === 0 ? '' : '0 ' + off.toFixed(1) + 'px';
if (CAN_TRANSLATE) { it.el.style.translate = v; }
else { it.el.style.transform = off === 0 ? '' : 'translateY(' + off.toFixed(1) + 'px)'; }
}
function updateParallax(y) {
var H = vh();
for (var i = 0; i < pxItems.length; i++) {
var it = pxItems[i];
if (!it.vis || !it.el.isConnected) { continue; }
var delta = (it.top + it.h / 2) - (y + H / 2);
var off = -delta * it.depth;
if (off > it.max) { off = it.max; } else if (off < -it.max) { off = -it.max; }
setPx(it, off);
}
}
var NUM_RE = /\d(?:[\d.,]*\d)?/g;
var DIGIT = /\d/;
function realText(el) {
var s = '';
for (var n = el.firstChild; n; n = n.nextSibling) {
if (n.nodeType === 3) { s += n.nodeValue; }
else if (isEl(n) && !(n.classList && n.classList.contains('m-odo'))) { s += n.textContent; }
}
return s;
}
function numTokens(s) {
var out = [], m;
NUM_RE.lastIndex = 0;
while ((m = NUM_RE.exec(s))) { out.push({ i: m.index, t: m[0] }); }
return out;
}
function planCells(fromText, toText, carry) {
var ft = numTokens(fromText), tt = numTokens(toText), cells = [];
for (var i = 0; i < toText.length; i++) { cells.push({ ch: toText.charAt(i), digit: DIGIT.test(toText.charAt(i)), from: null, tok: -1, pos: -1 }); }
tt.forEach(function (tok, k) {
var fd = ft[k] ? ft[k].t.replace(/\D/g, '') : '';
var count = 0;
for (var j = tok.t.length - 1; j >= 0; j--) {
if (!DIGIT.test(tok.t.charAt(j))) { continue; }
var c = cells[tok.i + j], fi = fd.length - 1 - count;
c.tok = k; c.pos = count;
c.from = fi >= 0 ? +fd.charAt(fi) : null;
if (carry && carry[k + ':' + count] !== undefined) { c.from = carry[k + ':' + count]; }
count++;
}
});
return cells;
}
function pct(i, n) { return (-(i / n) * 100).toFixed(4); }
function stopOdo(host, keep) {
var st = host.__mOdo;
if (!st) { return null; }
var carry = null;
if (keep) {
carry = {};
st.anims.forEach(function (a) {
try {
var p = a.anim.effect.getComputedTiming().progress;
if (p === null || p === undefined) { p = 1; }
var v = a.from + (a.to - a.from) * p;
carry[a.key] = ((v % 10) + 10) % 10;
} catch (e) { }
});
}
w.clearTimeout(st.timer);
st.anims.forEach(function (a) { try { a.anim.cancel(); } catch (e) { } });
if (st.ov && st.ov.parentNode) { st.ov.parentNode.removeChild(st.ov); }
host.removeAttribute('data-m-morph');
host.__mOdo = null;
return carry;
}
function odometer(host, fromText, toText, o) {
if (!MOTION || !HAS_WAAPI || !host || !host.isConnected) { return false; }
o = o || {};
var carry = stopOdo(host, true);
if (!fromText || fromText === toText && o.spin !== 'all') { return false; }
var cells = planCells(fromText, toText, carry);
if (o.spin === 'last' || o.spin === 'all') {
var lastByTok = {};
cells.forEach(function (c) { if (c.digit && c.pos === 0) { lastByTok[c.tok] = c; } });
cells.forEach(function (c) { if (c.digit && (o.spin === 'all' || lastByTok[c.tok] === c)) { c.spin = true; } });
}
var ov = d.createElement('span');
ov.className = 'm-odo';
ov.setAttribute('aria-hidden', 'true');
var run = '', moving = [];
function flush() {
if (!run) { return; }
var t = d.createElement('span');
t.className = 'm-odo__t';
t.setAttribute('data-ch', run);
ov.appendChild(t);
run = '';
}
cells.forEach(function (c) {
var still = !c.digit || (!c.spin && c.from !== null && Math.abs(c.from - (+c.ch)) < 0.001);
if (still) { run += c.ch; return; }
flush();
var cell = d.createElement('span');
cell.className = 'm-odo__c';
cell.setAttribute('data-ch', c.ch);
var strip = d.createElement('span');
strip.className = 'm-odo__s';
if (c.spin) { strip.setAttribute('data-n', '20'); }
cell.appendChild(strip);
ov.appendChild(cell);
c.strip = strip;
moving.push(c);
});
flush();
if (!moving.length) { return false; }
host.insertBefore(ov, host.firstChild);
host.setAttribute('data-m-morph', '');
var dur = o.duration || 440, stag = o.stagger || 0, base = o.delay || 0, maxEnd = 0, anims = [];
moving.forEach(function (c, k) {
var n = c.spin ? 20 : 10;
var to = +c.ch + (c.spin ? 10 : 0);
var from = c.from === null ? to - 1 : c.from;
var order = o.order === 'ltr' ? k : (moving.length - 1 - k);
var delay = base + order * stag;
var kf = c.from === null
? [{ transform: 'translateY(' + pct(from, n) + '%)', opacity: 0 }, { transform: 'translateY(' + pct(to, n) + '%)', opacity: 1 }]
: [{ transform: 'translateY(' + pct(from, n) + '%)' }, { transform: 'translateY(' + pct(to, n) + '%)' }];
var a = c.strip.animate(kf, { duration: dur, delay: delay, easing: o.easing || 'ease-out', fill: 'both' });
if (o.paused) { a.pause(); }
anims.push({ anim: a, from: from, to: to, key: c.tok + ':' + c.pos });
maxEnd = Math.max(maxEnd, delay + dur);
});
var st = { ov: ov, anims: anims, timer: 0, end: maxEnd };
host.__mOdo = st;
if (!o.paused) { st.timer = w.setTimeout(guard(function () { if (host.__mOdo === st) { stopOdo(host, false); } }), maxEnd + 50); }
return true;
}
function playOdo(host) {
var st = host && host.__mOdo;
if (!st) { return; }
st.anims.forEach(function (a) { try { a.anim.play(); } catch (e) { } });
w.clearTimeout(st.timer);
st.timer = w.setTimeout(guard(function () { if (host.__mOdo === st) { stopOdo(host, false); } }), st.end + 50);
}
function odoDetached(host, node) {
var st = host && host.__mOdo;
if (st && st.ov === node) {
w.clearTimeout(st.timer);
st.anims.forEach(function (a) { try { a.anim.cancel(); } catch (e) { } });
host.removeAttribute('data-m-morph');
host.__mOdo = null;
}
}
function groupedLike(value, sample, fmt) {
var n = Math.round(+value);
if (!isFinite(n)) { return String(value); }
var s = String(Math.abs(n));
if (fmt === 'idr' || /\d\.\d{3}/.test(sample)) { s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
return (n < 0 ? '-' : '') + s;
}
function visibleNow(el) {
if (!rendered(el)) { return false; }
var r = el.getBoundingClientRect();
if (r.bottom < 0 || r.top > vh() || r.width === 0) { return false; }
try { if (w.getComputedStyle(el).visibility === 'hidden') { return false; } } catch (e) { }
return true;
}
function morphPrice(el, oldVal) {
if (!MOTION || !hasTok(el, 'price-morph')) { return; }
var nv = attr(el, 'data-value');
if (oldVal === null || oldVal === undefined || oldVal === '' || oldVal === nv) { return; }
if (!visibleNow(el)) { stopOdo(el, false); return; }
var text = realText(el);
if (!DIGIT.test(text)) { return; }
var fromText = text.replace(/\d(?:[\d.,]*\d)?/, groupedLike(oldVal, text, attr(el, 'data-format')));
odometer(el, fromText, text, {
duration: cssMs(el, '--m-z-morph', 440),
easing: cssVar(el, '--m-z-morph-ease', 'ease-out'),
stagger: cssMs(el, '--m-z-morph-step', 20),
order: 'rtl'
});
}
function morphClock(el, oldText) {
if (!MOTION) { return; }
var text = realText(el);
if (!oldText || oldText === text || !DIGIT.test(text) || !visibleNow(el)) { return; }
odometer(el, oldText, text, { duration: cssMs(el, '--m-dur-clock', 360), easing: cssVar(el, '--m-ease-crisp', 'ease-out'), stagger: 30, order: 'rtl' });
}
function primeCounter(el) {
var text = realText(el);
if (!DIGIT.test(text)) { return false; }
var zero = text.replace(/\d/g, '0');
var ok = odometer(el, zero, text, { duration: cssMs(el, '--m-dur-count', 900), easing: cssVar(el, '--m-ease-out', 'ease-out'), stagger: 90, order: 'ltr', spin: 'last', paused: true });
if (ok) { el.__mCounter = true; }
return ok;
}
var revealIO = null;
var REVEAL_SEL = '[data-motion~="reveal"],[data-motion~="reveal-words"],[data-motion~="tile"],[data-motion~="counter"],[data-motion-item]';
var REC_LAYER_SEL = '.rec__stage [data-motion-layer="temp"], .rec__stage [data-motion-layer="label"]';
function revealKinds(el) {
var k = [];
if (hasTok(el, 'reveal-words')) { k.push('words'); }
if (hasTok(el, 'tile')) { k.push('tile'); }
if (hasTok(el, 'counter')) { k.push('counter'); }
if (hasTok(el, 'reveal') || el.hasAttribute('data-motion-item')) { k.push('fade'); }
var layer = attr(el, 'data-motion-layer');
if ((layer === 'temp' || layer === 'label') && el.closest && el.closest('.rec__stage')) { k.push(layer === 'temp' ? 'rtemp' : 'fade'); }
return k;
}
function splitWords(el) {
if (el.__mSplit) { return; }
var walker = d.createTreeWalker(el, 4, null, false), texts = [], n, wi = 0;
while ((n = walker.nextNode())) { if (!(n.parentNode && n.parentNode.closest && n.parentNode.closest('.m-odo'))) { texts.push(n); } }
texts.forEach(function (t) {
var parts = t.nodeValue.split(/(\s+)/), frag = d.createDocumentFragment();
parts.forEach(function (p) {
if (!p) { return; }
if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
var s = d.createElement('span');
s.setAttribute('data-m-word', '');
s.style.setProperty('--m-wi', String(Math.min(wi++, 9)));
s.textContent = p;
frag.appendChild(s);
});
t.parentNode.replaceChild(frag, t);
});
el.__mSplit = true;
}
function setPre(el, kinds) {
kinds.forEach(function (k) {
if (k === 'words') { splitWords(el); el.setAttribute('data-m-words', 'pre'); }
else if (k === 'tile') { el.setAttribute('data-m-tile', 'pre'); }
else if (k === 'counter') { primeCounter(el); }
else if (k === 'rtemp') { el.setAttribute('data-m', 'pre'); el.__mRtemp = true; }
else if (k === 'fade') { el.setAttribute('data-m', 'pre'); }
});
var delay = parseInt(attr(el, 'data-motion-delay'), 10);
if (delay > 0 && delay < 3000) { el.style.setProperty('--m-delay', delay + 'ms'); }
}
var primeIO = null;
function primeAll(ctx) {
if (!MOTION || !revealIO) { return; }
ctx = ctx || d;
var cands = qsa(REVEAL_SEL, ctx);
if (!on(mqDesk)) { cands = cands.concat(qsa(REC_LAYER_SEL, ctx)); }
if (isEl(ctx) && ctx.matches && ctx.matches(REVEAL_SEL)) { cands.unshift(ctx); }
if (!primeIO) { primeIO = new IntersectionObserver(onPrimeEntries, { threshold: 0 }); }
cands.forEach(function (el) {
if (el.__mR || isOurs(el)) { return; }
el.__mR = true;
if (el.closest && el.closest('#hero')) { return; }
primeIO.observe(el);
});
}
var onPrimeEntries = guard(function (entries) {
entries.forEach(function (e) {
var el = e.target;
primeIO.unobserve(el);
if (e.isIntersecting || e.boundingClientRect.bottom < 0) { return; }
var kinds = revealKinds(el);
if (!kinds.length) { return; }
setPre(el, kinds);
revealIO.observe(el);
});
});
function cleanupReveal(el) {
if (attr(el, 'data-m') === 'in') { el.removeAttribute('data-m'); }
el.style.removeProperty('--m-i');
el.style.removeProperty('--m-delay');
}
function reveal(el) {
if (revealIO) { revealIO.unobserve(el); }
if (attr(el, 'data-m-words') === 'pre') {
el.setAttribute('data-m-words', 'in');
}
if (attr(el, 'data-m-tile') === 'pre') { revealTile(el); }
if (el.__mCounter) { el.__mCounter = false; playOdo(el); }
if (el.__mRtemp) { el.__mRtemp = false; rollStageTempMobile(el); }
if (attr(el, 'data-m') === 'pre') {
el.setAttribute('data-m', 'in');
later(function () { cleanupReveal(el); }, 3000);
}
}
function revealTile(el) {
var img = el.tagName === 'IMG' ? el : qs('img', el);
var go = function () {
if (attr(el, 'data-m-tile') !== 'pre') { return; }
el.setAttribute('data-m-tile', 'in');
later(function () { if (attr(el, 'data-m-tile') === 'in') { el.removeAttribute('data-m-tile'); } }, 2600);
};
if (!img || (img.complete && img.naturalWidth > 0)) { go(); return; }
var done = false;
var fire = function () { if (!done) { done = true; go(); } };
img.addEventListener('load', fire, { once: true });
img.addEventListener('error', fire, { once: true });
later(fire, 900);
}
var onRevealEntries = guard(function (entries) {
var batch = [];
entries.forEach(function (e) { if (e.isIntersecting) { batch.push(e.target); } });
if (!batch.length) { return; }
batch.sort(docOrder);
revealBatch(batch);
});
function revealBatch(batch) {
var counts = [];
batch.forEach(function (el) {
if (el.hasAttribute('data-motion-item')) {
var g = (el.closest && el.closest('[data-motion~="stagger"]')) || el.parentNode, idx = 0, found = false;
for (var i = 0; i < counts.length; i++) { if (counts[i][0] === g) { idx = counts[i][1]++; found = true; break; } }
if (!found) { counts.push([g, 1]); }
el.style.setProperty('--m-i', String(Math.min(idx, 6)));
}
reveal(el);
});
}
function revealInside(target) {
if (!MOTION || !target) { return; }
var pre = qsa('[data-m="pre"],[data-m-tile="pre"],[data-m-words="pre"]', target).filter(rendered);
if (!pre.length) { return; }
pre.sort(docOrder);
revealBatch(pre);
}
function toggleTarget(el) {
if (!isEl(el)) { return null; }
if (qs('[data-motion-item]', el)) { return el; }
var id = attr(el, 'aria-controls');
return id ? d.getElementById(id) : null;
}
function entrance(items, ctxEl) {
if (!MOTION || !HAS_WAAPI || !items.length) { return; }
var dur = cssMs(ctxEl, '--m-z-dur', 180), ease = cssVar(ctxEl, '--m-z-ease', 'ease-out'),
dist = cssVar(ctxEl, '--m-z-dist', '10px'), stag = cssMs(ctxEl, '--m-z-stagger', 40);
items.forEach(function (el, i) {
el.__mR = true;
var op = '1';
try { op = w.getComputedStyle(el).opacity || '1'; } catch (e) { }
el.animate([{ opacity: 0, transform: 'translateY(' + dist + ')' }, { opacity: op, transform: 'none' }],
{ duration: dur, delay: Math.min(i, 6) * stag, easing: ease, fill: 'backwards' });
});
}
var ro = null;
function selectedChild(c, st) {
for (var k = c.firstElementChild; k; k = k.nextElementSibling) {
if (k === st.el) { continue; }
if (attr(k, 'data-selected') === 'true' || attr(k, 'aria-selected') === 'true') { return k; }
}
return null;
}
function offsetWithin(el, container) {
var x = 0, y = 0, n = el;
while (n && n !== container) {
x += n.offsetLeft; y += n.offsetTop;
var p = n.offsetParent;
if (p && p !== container) { x += p.clientLeft || 0; y += p.clientTop || 0; }
if (!p) { return null; }
n = p;
}
return n === container ? { x: x, y: y } : null;
}
var IND_FONT = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'letterSpacing', 'fontVariantNumeric', 'fontFeatureSettings', 'textTransform'];
function ensureInd(c) {
if (!MOTION || !isEl(c)) { return false; }
var st = c.__mInd;
if (!st) { st = c.__mInd = { el: null, box: null, mode: c.classList.contains('rec__dots') ? 'dot' : 'on' }; }
if (st.el && st.el.parentNode === c) { return false; }
var s = d.createElement('span');
s.className = 'm-ind';
s.setAttribute('aria-hidden', 'true');
c.insertBefore(s, c.firstChild);
st.el = s;
st.box = null;
if (attr(c, 'data-m-ind') !== st.mode) { c.setAttribute('data-m-ind', st.mode); }
if (ro) { ro.observe(c); }
buildInd(c);
return true;
}
function buildInd(c) {
var st = c && c.__mInd;
if (!st || !st.el) { return; }
var s = st.el;
while (s.firstChild) { s.removeChild(s.firstChild); }
var bg = d.createElement('span');
bg.className = 'm-ind__bg';
s.appendChild(bg);
if (st.mode !== 'dot') {
s.style.width = c.scrollWidth + 'px';
s.style.height = c.scrollHeight + 'px';
}
if (st.mode === 'on' && rendered(c)) {
for (var k = c.firstElementChild; k; k = k.nextElementSibling) {
if (k === s || !rendered(k)) { continue; }
var label = (k.textContent || '').replace(/\s+/g, ' ').trim();
var pos = offsetWithin(k, c);
if (!label || !pos) { continue; }
var range = d.createRange();
range.selectNodeContents(k);
var tr = range.getBoundingClientRect(), kr = k.getBoundingClientRect();
var sc = k.offsetWidth ? kr.width / k.offsetWidth : 1;
if (!sc) { sc = 1; }
var l = d.createElement('span');
l.className = 'm-ind__l';
l.setAttribute('data-l', label);
var cs = w.getComputedStyle(k);
IND_FONT.forEach(function (prop) { l.style[prop] = cs[prop]; });
l.style.left = (pos.x + (tr.left - kr.left) / sc).toFixed(2) + 'px';
l.style.top = (pos.y + (tr.top - kr.top) / sc).toFixed(2) + 'px';
l.style.lineHeight = (tr.height / sc).toFixed(2) + 'px';
s.appendChild(l);
}
}
st.box = null;
placeInd(c, false);
}
function clipFor(st, box) {
var W = st.el.offsetWidth, H = st.el.offsetHeight;
return 'inset(' + box.y + 'px ' + (W - box.x - box.w) + 'px ' + (H - box.y - box.h) + 'px ' + box.x + 'px round 999px)';
}
function placeInd(c, animate) {
var st = c && c.__mInd;
if (!st || !st.el) { return; }
var sel = selectedChild(c, st);
var target = sel && st.mode === 'dot' ? (qs('.rec__dot-mark', sel) || sel) : sel;
var pos = target && rendered(c) && rendered(target) ? offsetWithin(target, c) : null;
if (!pos || !target.offsetWidth) { st.el.style.visibility = 'hidden'; st.box = null; return; }
st.el.style.visibility = '';
if (st.mode !== 'dot' && (st.el.offsetWidth !== c.scrollWidth || st.el.offsetHeight !== c.scrollHeight)) {
st.el.style.width = c.scrollWidth + 'px';
st.el.style.height = c.scrollHeight + 'px';
}
var box = { x: pos.x, y: pos.y, w: target.offsetWidth, h: target.offsetHeight }, prev = st.box;
if (st.mode === 'dot') {
st.el.style.width = box.w + 'px';
st.el.style.height = box.h + 'px';
st.el.style.transform = 'translate(' + box.x + 'px,' + box.y + 'px)';
if (animate && prev && HAS_WAAPI && (prev.x !== box.x || prev.y !== box.y)) {
st.el.animate([{ transform: 'translate(' + prev.x + 'px,' + prev.y + 'px)' }, { transform: 'translate(' + box.x + 'px,' + box.y + 'px)' }],
{ duration: cssMs(c, '--m-z-ind', 600), easing: cssVar(c, '--m-z-ind-ease', 'ease-out') });
}
st.box = box;
return;
}
var clip = clipFor(st, box);
st.el.style.webkitClipPath = clip;
st.el.style.clipPath = clip;
if (animate && prev && HAS_WAAPI && (prev.x !== box.x || prev.y !== box.y || prev.w !== box.w)) {
try {
st.el.animate([{ clipPath: clipFor(st, prev), webkitClipPath: clipFor(st, prev) }, { clipPath: clip, webkitClipPath: clip }],
{ duration: cssMs(c, '--m-z-ind', 260), easing: cssVar(c, '--m-z-ind-ease', 'ease-out') });
} catch (e) { }
}
st.box = box;
}
function setupIndicators(ctx) {
if (!MOTION) { return; }
var list = qsa('[data-motion~="tab-indicator"]', ctx || d);
if (isEl(ctx) && hasTok(ctx, 'tab-indicator')) { list.unshift(ctx); }
list.forEach(ensureInd);
}
function placeAllInd() { qsa('[data-m-ind]').forEach(function (c) { buildInd(c); }); }
var rec = null;
function setupRecovery() {
var el = qs('.rec[data-motion~="recovery"]') || qs('[data-motion~="recovery"]');
if (!el || el.__mRec) { return; }
var stages = qsa('.rec__stage', el);
if (!stages.length) { stages = qsa('[data-stage-key]', el); }
if (!stages.length) { return; }
el.__mRec = true;
rec = { el: el, stages: stages, dots: qsa('.rec__dot', el), cur: -1, lockTo: -1, lockUntil: 0, io: null, targets: [] };
rec.targets = stages.map(function (s) { return qs('[data-motion-layer="image"]', s) || qs('.rec__img', s) || s; });
var start = parseInt(attr(el, 'data-stage'), 10);
setStage(isFinite(start) ? start : 0, 'init');
if (HAS_IO) {
rec.io = new IntersectionObserver(guard(function (entries) {
var pick = -1;
entries.forEach(function (e) { if (e.isIntersecting) { var i = rec.targets.indexOf(e.target); if (i > -1) { pick = i; } } });
if (pick < 0) { return; }
if (now() < rec.lockUntil && pick !== rec.lockTo) { return; }
setStage(pick, 'scroll');
}), { rootMargin: '-49% 0px -49% 0px', threshold: 0 });
rec.targets.forEach(function (t) { rec.io.observe(t); });
}
rec.dots.forEach(function (b) {
b.addEventListener('click', guard(function () {
var i = parseInt(attr(b, 'data-stage-to'), 10);
if (isFinite(i)) { goStage(i); }
}));
});
}
function clampStage(i) { return Math.max(0, Math.min(rec.stages.length - 1, i | 0)); }
function setStage(i, src) {
if (!rec) { return; }
i = clampStage(i);
if (i === rec.cur) { return; }
var prev = rec.cur;
rec.cur = i;
rec.el.setAttribute('data-stage', String(i));
rec.stages.forEach(function (s, k) {
s.setAttribute('data-stage-active', k === i ? 'true' : 'false');
if (k === prev && prev !== i) { s.setAttribute('data-m-prev', 'true'); } else { s.removeAttribute('data-m-prev'); }
});
rec.dots.forEach(function (b) {
var sel = parseInt(attr(b, 'data-stage-to'), 10) === i;
b.setAttribute('data-selected', sel ? 'true' : 'false');
if (sel) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
});
if (MOTION && prev > -1 && src !== 'init' && on(mqDesk)) { rollStageTempDesktop(prev, i); }
if (src !== 'init') { emit('ef:recovery:stage', { index: i, key: attr(rec.stages[i], 'data-stage-key') }); }
}
function goStage(i) {
if (!rec) { return; }
i = clampStage(i);
var t = rec.targets[i];
rec.lockTo = i;
rec.lockUntil = now() + 1200;
if (t && t.scrollIntoView) {
try { t.scrollIntoView({ block: 'center', behavior: MOTION ? 'smooth' : 'auto' }); } catch (e) { t.scrollIntoView(); }
}
setStage(i, 'dot');
}
function tempOf(stage) { return qs('[data-motion-layer="temp"]', stage) || qs('.rec__temp', stage); }
function rollStageTempDesktop(prev, i) {
var a = tempOf(rec.stages[prev]), b = tempOf(rec.stages[i]);
if (!a || !b) { return; }
odometer(b, realText(a), realText(b), {
duration: cssMs(b, '--m-temp-dur', 900), easing: cssVar(b, '--m-temp-ease', 'ease-out'), stagger: 60, order: 'ltr', delay: cssMs(b, '--m-delay-rec-num', 280)
});
}
function rollStageTempMobile(el) {
if (on(mqDesk) || !rec) { return; }
var stage = el.closest && el.closest('.rec__stage');
var k = rec.stages.indexOf(stage);
if (k <= 0) { return; }
var a = tempOf(rec.stages[k - 1]);
if (!a) { return; }
odometer(el, realText(a), realText(el), {
duration: cssMs(el, '--m-temp-dur', 900), easing: cssVar(el, '--m-temp-ease', 'ease-out'), stagger: 60, order: 'ltr'
});
}
var STEP_ORDER = ['choose', 'details', 'pay', 'done'];
var onCheckoutStep = guard(function (e) {
var det = (e && e.detail) || {}, co = d.getElementById('checkout');
if (!co) { return; }
if (!det.from) { co.removeAttribute('data-m-dir'); return; }
var dir = STEP_ORDER.indexOf(det.to) >= STEP_ORDER.indexOf(det.from) ? 'fwd' : 'back';
co.setAttribute('data-m-dir', dir);
if (!MOTION || !HAS_WAAPI) { return; }
var title = d.getElementById('co-title');
if (title) {
title.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
{ duration: cssMs(co, '--m-dur-step', 260), easing: cssVar(co, '--m-ease-out', 'ease-out') });
}
if (det.to === 'done') {
later(function () {
var ref = qs('[data-co="ref"]', co) || qs('.co__ref .num', co);
if (!ref) { return; }
var t = realText(ref);
odometer(ref, t.replace(/\d/g, '0'), t, { duration: 700, easing: cssVar(co, '--m-ease-out', 'ease-out'), stagger: 70, order: 'ltr', spin: 'all', delay: 120 });
}, 30);
}
});
var schedTouched = -1e9;
function markSchedTouch(e) {
var t = e.target;
if (t && t.closest && t.closest('.sched__days')) { schedTouched = now(); }
}
var onSchedRender = guard(function () {
if (!MOTION || now() - schedTouched > 1200) { return; }
var list = d.getElementById('sched-list') || qs('.sched__list');
if (!list) { return; }
var H = vh();
var items = qsa('.sched__item', list).filter(function (li) {
if (!rendered(li)) { return false; }
var r = li.getBoundingClientRect();
return r.top < H && r.bottom > 0;
});
entrance(items, list);
});
function flashNow(li) {
if (!MOTION || !HAS_WAAPI || !rendered(li)) { return; }
var s = qs('.sched__status', li) || li;
s.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
{ duration: 240, easing: cssVar(li, '--m-ease-crisp', 'ease-out') });
}
function phaseDot(dot) {
var period = 2 * cssMs(dot, '--m-dur-breathe', 2200);
dot.style.animationDelay = (-(now() % period)).toFixed(0) + 'ms';
}
var ATTRS = ['data-value', 'data-state', 'aria-expanded', 'data-selected', 'aria-selected', 'data-now'];
function clockHost(n) {
var el = isEl(n) ? n : (n && n.parentNode);
if (!el || !el.closest) { return null; }
return el.closest('[data-motion~="clock"]');
}
function textOfNodes(list) {
var s = '';
for (var i = 0; i < list.length; i++) { if (list[i].nodeType === 3) { s += list[i].nodeValue; } }
return s;
}
var onMutations = guard(function (records) {
var added = [], values = [], indC = [], indKids = [], toggles = [], clocks = [], nows = [];
function pushUnique(arr, el) { if (arr.indexOf(el) < 0) { arr.push(el); } }
records.forEach(function (r) {
var t = r.target;
if (r.type === 'childList') {
if (isOurs(t)) { return; }
var ch = clockHost(t);
if (ch && !clocks.some(function (c) { return c[0] === ch; })) {
var old = textOfNodes(r.removedNodes);
if (old) { clocks.push([ch, old]); }
}
for (var i = 0; i < r.removedNodes.length; i++) {
var rn = r.removedNodes[i];
if (isEl(rn) && rn.classList.contains('m-odo')) { odoDetached(t, rn); }
if (isEl(rn) && rn.classList.contains('m-ind') && t.__mInd) { pushUnique(indKids, t); }
}
for (var j = 0; j < r.addedNodes.length; j++) {
var an = r.addedNodes[j];
if (isEl(an) && !isOurs(an)) { added.push(an); }
}
if (t.__mInd && (slice.call(r.addedNodes).some(function (x) { return !isOurs(x); }) || slice.call(r.removedNodes).some(function (x) { return isEl(x) && !x.classList.contains('m-ind'); }))) { pushUnique(indKids, t); }
} else if (r.type === 'characterData') {
var h = clockHost(t);
if (h && !clocks.some(function (c) { return c[0] === h; })) { clocks.push([h, r.oldValue]); }
} else if (r.type === 'attributes') {
var n = r.attributeName;
if (n === 'data-value') {
if (!values.some(function (v) { return v[0] === t; })) { values.push([t, r.oldValue]); }
} else if (n === 'data-selected' || n === 'aria-selected') {
if (t.parentNode && t.parentNode.__mInd) { pushUnique(indC, t.parentNode); }
} else if (n === 'data-state' || n === 'aria-expanded') {
pushUnique(toggles, t);
} else if (n === 'data-now') {
if (attr(t, 'data-now') === 'true' && r.oldValue !== 'true') { pushUnique(nows, t); }
}
}
});
if (added.length) {
added.forEach(function (n) {
if (!n.isConnected) { return; }
if (MOTION) {
primeAll(n);
setupIndicators(n);
collectParallax(n);
if (n.classList && n.classList.contains('sched__dot')) { phaseDot(n); }
qsa('.sched__dot', n).forEach(phaseDot);
}
if (!rec && (hasTok(n, 'recovery') || qs('[data-motion~="recovery"]', n))) { setupRecovery(); }
});
}
if (MOTION) {
indC.forEach(function (c) { if (c.isConnected && !ensureInd(c)) { placeInd(c, true); } });
indKids.forEach(function (c) { if (c.isConnected && !ensureInd(c)) { buildInd(c); } });
values.forEach(function (v) { morphPrice(v[0], v[1]); });
clocks.forEach(function (c) { morphClock(c[0], c[1]); });
toggles.forEach(function (el) {
if (attr(el, 'data-state') === 'open' || attr(el, 'aria-expanded') === 'true') { revealInside(toggleTarget(el)); }
});
nows.forEach(function (li) {
if (added.some(function (a) { return a === li || (a.contains && a.contains(li)); })) { return; }
flashNow(li);
});
}
});
var resizeQueued = false;
function onResize() {
if (resizeQueued) { return; }
resizeQueued = true;
raf(guard(function () {
resizeQueued = false;
measureParallax();
placeAllInd();
requestFrame();
}));
}
function disableMotion() {
if (!MOTION) { return; }
MOTION = false;
root.classList.remove('motion-ok');
qsa('[data-m-morph]').forEach(function (el) { stopOdo(el, false); });
qsa('.m-ind').forEach(function (s) { if (s.parentNode) { s.parentNode.removeAttribute('data-m-ind'); s.parentNode.removeChild(s); } });
pxItems.forEach(function (it) { setPx(it, 0); });
pxActive = false;
}
function listenMq(m, fn) {
if (!m) { return; }
if (m.addEventListener) { m.addEventListener('change', fn); } else if (m.addListener) { m.addListener(fn); }
}
function idle(fn) {
if (w.requestIdleCallback) { w.requestIdleCallback(fn, { timeout: 400 }); } else { w.setTimeout(fn, 16); }
}
function runChunks(queue) {
var next = function () {
var f = queue.shift();
if (!f) { return; }
guard(f)();
if (queue.length) { idle(next); }
};
idle(next);
}
var init = guard(function () {
if (root.__mInit) { return; }
root.__mInit = true;
updateHeader(scrollY());
try { setupRecovery(); } catch (e) { log('recovery start-up failed', e && e.message); disableMotion(); }
root.classList.add('motion-live');
if (MOTION) {
if (HAS_IO) { revealIO = new IntersectionObserver(onRevealEntries, { rootMargin: '0px 0px -7% 0px', threshold: 0 }); }
if ('ResizeObserver' in w) { ro = new w.ResizeObserver(guard(function (list) { list.forEach(function (e) { buildInd(e.target); }); })); }
runChunks([
function () { primeAll(d); },
function () { setupIndicators(d); },
function () { collectParallax(d); qsa('.sched__dot').forEach(phaseDot); }
]);
var nn = qs('[data-motion~="now-next"]');
if (nn && HAS_IO) {
new IntersectionObserver(guard(function (es) {
es.forEach(function (e) { if (e.isIntersecting) { e.target.removeAttribute('data-m-offscreen'); } else { e.target.setAttribute('data-m-offscreen', ''); } });
})).observe(nn);
}
d.addEventListener('touchstart', function () {}, { passive: true });
}
if ('MutationObserver' in w) {
new MutationObserver(onMutations).observe(d.body || root, {
subtree: true, childList: true, characterData: true, characterDataOldValue: true,
attributes: true, attributeOldValue: true, attributeFilter: ATTRS
});
}
d.addEventListener('ef:checkout:step', onCheckoutStep);
d.addEventListener('ef:schedule:render', onSchedRender);
d.addEventListener('pointerdown', markSchedTouch, { passive: true, capture: true });
d.addEventListener('keydown', markSchedTouch, { passive: true, capture: true });
d.addEventListener('click', markSchedTouch, { passive: true, capture: true });
w.addEventListener('scroll', requestFrame, { passive: true });
w.addEventListener('resize', onResize, { passive: true });
w.addEventListener('load', onResize, { passive: true });
if (d.fonts && d.fonts.ready && d.fonts.ready.then) { d.fonts.ready.then(guard(onResize)); }
d.addEventListener('visibilitychange', guard(function () {
if (d.hidden) { root.setAttribute('data-m-paused', ''); }
else { root.removeAttribute('data-m-paused'); requestFrame(); }
}));
listenMq(mqReduce, guard(function () { if (on(mqReduce)) { disableMotion(); } }));
listenMq(mqDesk, guard(onResize));
listenMq(mqFine, guard(onResize));
requestFrame();
log('ready', { motion: MOTION, version: VERSION });
});
w.EFMotion = {
version: VERSION,
get enabled() { return MOTION; },
get live() { return root.classList.contains('motion-live'); },
refresh: guard(function (ctx) {
var c = isEl(ctx) ? ctx : d;
if (!rec) { setupRecovery(); }
if (MOTION) { primeAll(c); setupIndicators(c); collectParallax(c); }
onResize();
}),
setStage: guard(function (i) { if (rec) { setStage(parseInt(i, 10) || 0, 'api'); } }),
morph: guard(function (el, fromText, toText) {
if (!isEl(el)) { return false; }
return odometer(el, String(fromText), String(toText === undefined ? realText(el) : toText),
{ duration: cssMs(el, '--m-z-morph', 440), easing: cssVar(el, '--m-z-morph-ease', 'ease-out'), stagger: cssMs(el, '--m-z-morph-step', 20), order: 'rtl' });
})
};
if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
