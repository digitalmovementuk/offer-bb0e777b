/* ============================================================================
   Elite Fit Bali homepage v2.0 — assets/js/shop.js — lane L2
   Version v1.0 — 2026-10-01

   Pass shop (#passes), sticky buy bar (#buybar) and checkout panel (#checkout).
   Classic deferred script, one IIFE, no dependencies. Attaches window.EFShop.
   Needs window.EFApi (assets/js/api.js, loaded before this file).

   MOCK: the whole purchase flow is a labelled concept. This file collects
   nothing and stores nothing (no localStorage, sessionStorage, cookies,
   no field value survives closing the sheet), and contacts no provider. The
   only API calls are EFApi.getPasses, EFApi.createCheckout,
   EFApi.getCheckoutStatus and, in mock mode only, EFApi._simulatePayment, all
   answered by the mock adapter in api.js. Prices come only from
   EFApi.getPasses() (assets/data/passes.json); the numbers in the partials are
   the no-JS fallback and are never rewritten when they already match.

   This file never animates. It sets state attributes (CONTRACT §4) and emits
   events (CONTRACT §6); presentation belongs to motion.css / motion.js:
     - #checkout[data-state=open|closed], [data-checkout-step], .co__panel
       [data-active=true|false], .co__steps li[aria-current=step][data-done]
     - [data-selected=true|false] on length chips, tier cards, payment methods
     - .num[data-value] price elements: textContent and aria-label are written
       first, data-value last (the trigger for price-morph)
     - body[data-buybar=open|closed], #buybar[data-state], body/html
       [data-scroll-lock=true] while the sheet is open
   Events on document: ef:passselect {tierId, lengthId, price, duo, total,
   source}, ef:checkout:step {from, to} (from is null when the sheet opens; the
   sheet closing is data-state="closed", not a step event).

   Openers: any element with [data-open-checkout] (optionally data-tier,
   data-length, data-duo) opens the checkout by delegation on document.
   ============================================================================ */
(function (win, doc) {
'use strict';
if (win.EFShop) { return; }
var root = doc.documentElement;
var body = doc.body;
var LENGTH_IDS = ['day', 'week', 'w4', 'w12', 'w26', 'w52'];
var STEPS = ['choose', 'details', 'pay', 'done'];
var TITLES = { choose: 'Choose your pass', details: 'Who is the pass for?', done: 'You\'re in.' };
var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MAX_AHEAD_DAYS = 90;
var WA_HELP = 'https://wa.me/6285195520220?text=Hello%20Elite%20Fit%20Bali!%20I%20have%20a%20question';
function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
function isNum(n) { return typeof n === 'number' && isFinite(n); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmtIdr(n) { return 'IDR ' + fmtNum(n); }
function emit(name, detail) {
try { doc.dispatchEvent(new win.CustomEvent(name, { detail: detail })); } catch (e) { }
}
function elOf(node) { return node && node.nodeType === 1 ? node : (node && node.parentElement) || null; }
function closest(node, sel, within) {
var el = elOf(node), f = el && el.closest ? el.closest(sel) : null;
return f && (!within || within.contains(f)) ? f : null;
}
function setAttrIf(el, name, value) { if (el && el.getAttribute(name) !== value) { el.setAttribute(name, value); } }
function setTextIf(el, text) { if (el && el.textContent !== text) { el.textContent = text; } }
function setPrice(el, n) {
if (!el || !isNum(n)) { return; }
setTextIf(el, el.hasAttribute('data-bare') ? fmtNum(n) : fmtIdr(n));
setAttrIf(el, 'aria-label', fmtIdr(n));
setAttrIf(el, 'data-value', String(Math.round(n)));
}
function ymdParts(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? [+m[1], +m[2], +m[3]] : null; }
function addDaysYmd(ymd, n) {
var p = ymdParts(ymd); if (!p) { return ymd; }
var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + n * 86400000);
return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function fmtDate(ymd) {
var p = ymdParts(ymd); if (!p) { return ''; }
var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
return DOW[d.getUTCDay()] + ' ' + p[2] + ' ' + MON[p[1] - 1] + ' ' + p[0];
}
function baliToday() {
try {
var api = win.EFApi;
if (api && typeof api.now === 'function' && typeof api.baliParts === 'function') { return api.baliParts(api.now()).ymd; }
} catch (e) { }
var d = new Date(Date.now() + 8 * 3600 * 1000);
return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function callApi(name, arg) {
try {
var api = win.EFApi;
if (!api || typeof api[name] !== 'function') { return Promise.reject(new Error('EFApi.' + name + ' is not available')); }
return Promise.resolve(api[name](arg));
} catch (e) { return Promise.reject(e); }
}
var data = null;
var dataSettled = false;
var dataPromise = callApi('getPasses').then(function (d) {
if (d && Array.isArray(d.tiers) && Array.isArray(d.lengths)) { data = d; }
dataSettled = true;
return data;
}, function () { dataSettled = true; return null; });
function tierData(id) { var t = (data && data.tiers) || []; for (var i = 0; i < t.length; i++) { if (t[i].id === id) { return t[i]; } } return null; }
function lengthData(id) { var l = (data && data.lengths) || []; for (var i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i]; } } return null; }
function isTierId(id) { return !!tierData(id) || id === 'perform' || id === 'elite' || id === 'recharge'; }
function isLengthId(id) { return LENGTH_IDS.indexOf(id) !== -1; }
function duoAllowed(lengthId, tierId) {
var d = data && data.duo; if (!d) { return false; }
var lens = Array.isArray(d.lengths) ? d.lengths : ['day', 'w4'];
if (lens.indexOf(lengthId) === -1) { return false; }
if (lengthId === 'day') {
return isNum(d.dayPassEach) && (!Array.isArray(d.dayPassTiers) || !tierId || d.dayPassTiers.indexOf(tierId) !== -1);
}
if (lengthId === 'w4') { return !!d.fourWeek && (!tierId || isNum(d.fourWeek[tierId])); }
return false;
}
function duoPeople() { return (data && data.duo && isNum(data.duo.people)) ? data.duo.people : 2; }
function priceFor(tierId, lengthId, duo) {
var t = tierData(tierId); if (!t) { return null; }
if (duo) {
if (!duoAllowed(lengthId, tierId)) { return null; }
return lengthId === 'day' ? data.duo.dayPassEach : data.duo.fourWeek[tierId];
}
return isNum(t.prices && t.prices[lengthId]) ? t.prices[lengthId] : null;
}
function totalFor(tierId, lengthId, duo) {
var p = priceFor(tierId, lengthId, duo); if (p === null) { return null; }
return (duo && lengthId === 'day') ? p * duoPeople() : p;
}
function perLabel(lengthId, duo) {
var base = lengthId === 'day' ? 'day pass' : lengthId === 'week' ? '7 days' : ((lengthData(lengthId) || {}).label || lengthId).toLowerCase();
if (duo) { return base + (lengthId === 'day' ? ', each' : ', for two'); }
return base;
}
function lengthLabel(lengthId) { return (lengthData(lengthId) || {}).label || lengthId; }
function tierName(tierId) { return (tierData(tierId) || {}).name || (tierId ? tierId.charAt(0).toUpperCase() + tierId.slice(1) : ''); }
function lowestDayPrice() {
var min = null;
((data && data.tiers) || []).forEach(function (t) { var p = t.prices && t.prices.day; if (isNum(p) && (min === null || p < min)) { min = p; } });
return min;
}
function bindRadios(group, attr, onPick) {
if (!group) { return; }
group.addEventListener('click', function (e) {
var it = closest(e.target, '[role="radio"]', group);
if (it) { onPick(it.getAttribute(attr), it); }
});
group.addEventListener('keydown', function (e) {
var k = e.key;
if (k !== 'ArrowRight' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') { return; }
var items = $$('[role="radio"]', group);
var i = items.indexOf(closest(doc.activeElement, '[role="radio"]', group));
if (i < 0) { i = 0; }
if (k === 'Home') { i = 0; } else if (k === 'End') { i = items.length - 1; }
else { i = (i + ((k === 'ArrowRight' || k === 'ArrowDown') ? 1 : -1) + items.length) % items.length; }
e.preventDefault();
try { items[i].focus({ preventScroll: true }); } catch (err) { items[i].focus(); }
onPick(items[i].getAttribute(attr), items[i]);
});
}
function markRadios(group, attr, value) {
if (!group) { return; }
$$('[role="radio"]', group).forEach(function (it) {
var on = it.getAttribute(attr) === value;
setAttrIf(it, 'aria-checked', on ? 'true' : 'false');
setAttrIf(it, 'data-selected', on ? 'true' : 'false');
it.tabIndex = on ? 0 : -1;
});
}
function centerChip(group) {
if (!group || group.scrollWidth <= group.clientWidth + 1) { return; }
var chip = $('[role="radio"][aria-checked="true"]', group); if (!chip) { return; }
var g = group.getBoundingClientRect(), c = chip.getBoundingClientRect();
group.scrollLeft += (c.left - g.left) - (g.width - c.width) / 2;
}
var shop = { lengthId: 'day', duo: false, tierId: 'perform' };
var shopEl = $('#passes');
var shopLengths = shopEl && $('.shop__lengths', shopEl);
var shopDuo = shopEl && $('.shop__duo', shopEl);
var shopDuoHelp = shopEl && $('.shop__duo-help', shopEl);
var shopError = shopEl && $('.shop__error', shopEl);
function renderShop() {
if (!shopEl) { return; }
if (!data) { if (shopError) { shopError.hidden = false; } return; }
if (shopError) { shopError.hidden = true; }
if (shop.duo && !duoAllowed(shop.lengthId)) { shop.duo = false; }
markRadios(shopLengths, 'data-length', shop.lengthId);
var allowed = duoAllowed(shop.lengthId);
if (shopDuo) {
setAttrIf(shopDuo, 'aria-checked', shop.duo ? 'true' : 'false');
setAttrIf(shopDuo, 'aria-disabled', allowed ? 'false' : 'true');
if (allowed && shopDuoHelp) { shopDuoHelp.removeAttribute('data-nudge'); }
}
$$('.shop__tier', shopEl).forEach(function (card) {
var id = card.getAttribute('data-tier');
var p = priceFor(id, shop.lengthId, shop.duo);
setPrice($('.shop__price .num', card), p);
setTextIf($('.shop__per', card), 'IDR · ' + perLabel(shop.lengthId, shop.duo));
});
((data && data.classPasses) || []).forEach(function (c) {
var el = $('[data-class-price="' + c.id + '"]', shopEl);
if (el && isNum(c.price)) { setTextIf(el, fmtIdr(c.price)); }
});
}
function announce(source) {
var tid = source === 'shop' ? shop.tierId : co.tierId;
var lid = source === 'shop' ? shop.lengthId : co.lengthId;
var duo = source === 'shop' ? shop.duo : co.duo;
emit('ef:passselect', { tierId: tid, lengthId: lid, price: priceFor(tid, lid, duo), duo: !!duo, total: totalFor(tid, lid, duo), source: source });
}
function pickShopLength(id) {
if (!isLengthId(id)) { return; }
if (!data) { renderShop(); return; }
if (id === shop.lengthId) { return; }
shop.lengthId = id;
renderShop();
centerChip(shopLengths);
announce('shop');
}
function toggleShopDuo() {
if (!data) { renderShop(); return; }
if (!duoAllowed(shop.lengthId)) { if (shopDuoHelp) { shopDuoHelp.setAttribute('data-nudge', 'true'); } return; }
shop.duo = !shop.duo;
renderShop();
announce('shop');
}
if (shopEl) {
bindRadios(shopLengths, 'data-length', pickShopLength);
if (shopDuo) { shopDuo.addEventListener('click', toggleShopDuo); }
}
var co = {
root: $('#checkout'), open: false, step: null, busy: false,
tierId: 'perform', lengthId: 'day', duo: false, start: '', method: 'card',
session: null, opener: null, pushed: false, afterClose: null, inerted: [], seq: 0
};
if (co.root) {
co.sheet = $('.co__sheet', co.root);
co.body = $('.co__body', co.root);
co.title = $('#co-title', co.root);
co.stepItems = $$('.co__steps li', co.root);
co.panels = $$('.co__panel', co.root);
co.lengths = $('.co__lengths', co.root);
co.tiers = $$('.co__tier', co.root);
co.duoBtn = $('.co__duo', co.root);
co.duoHelp = $('.co__duo-help', co.root);
co.dateInput = $('#co-date', co.root);
co.dateErr = $('#co-date-err', co.root);
co.methods = $('.co__methods', co.root);
co.form = $('[data-co="form"]', co.root);
co.fields = {
name: { input: $('#co-name', co.root), err: $('#co-name-err', co.root) },
email: { input: $('#co-email', co.root), err: $('#co-email-err', co.root) },
whatsapp: { input: $('#co-whatsapp', co.root), err: $('#co-whatsapp-err', co.root) }
};
}
function slot(name) { return co.root ? $('[data-co="' + name + '"]', co.root) : null; }
function renderChoose() {
if (!co.root) { return; }
var errEl = slot('choose-error');
if (!data) {
if (errEl) { errEl.textContent = 'Prices are unavailable right now. Message us on WhatsApp and we will help you buy a pass.'; errEl.hidden = false; }
return;
}
if (errEl) { errEl.hidden = true; }
if (co.duo && !duoAllowed(co.lengthId, co.tierId)) { co.duo = false; }
markRadios(co.lengths, 'data-length', co.lengthId);
co.tiers.forEach(function (lab) {
var id = lab.getAttribute('data-tier');
var on = id === co.tierId;
var input = $('input', lab);
if (input && input.checked !== on) { input.checked = on; }
setAttrIf(lab, 'data-selected', on ? 'true' : 'false');
setPrice($('.num', lab), priceFor(id, co.lengthId, co.duo));
var per = $('.co__per', lab);
if (per) {
var txt = co.duo ? (co.lengthId === 'day' ? 'each' : 'for two') : '';
setTextIf(per, txt);
per.hidden = !txt;
}
});
var allowed = duoAllowed(co.lengthId, co.tierId);
if (co.duoBtn) {
setAttrIf(co.duoBtn, 'aria-checked', co.duo ? 'true' : 'false');
setAttrIf(co.duoBtn, 'aria-disabled', allowed ? 'false' : 'true');
if (allowed && co.duoHelp) { co.duoHelp.removeAttribute('data-nudge'); }
}
var total = totalFor(co.tierId, co.lengthId, co.duo);
setTextIf(slot('sum-text'), tierName(co.tierId) + ' · ' + lengthLabel(co.lengthId) + (co.duo ? ' · For two' : '') + ' ·');
setPrice(slot('sum-price'), total);
}
function pickCoLength(id) {
if (!isLengthId(id) || !data || id === co.lengthId) { return; }
co.lengthId = id; renderChoose(); centerChip(co.lengths); announce('checkout');
}
function pickCoTier(id) {
if (!isTierId(id) || !data || id === co.tierId) { return; }
co.tierId = id; renderChoose(); announce('checkout');
}
function toggleCoDuo() {
if (!data) { return; }
if (!duoAllowed(co.lengthId, co.tierId)) { if (co.duoHelp) { co.duoHelp.setAttribute('data-nudge', 'true'); } return; }
co.duo = !co.duo; renderChoose(); announce('checkout');
}
if (co.root) {
bindRadios(co.lengths, 'data-length', pickCoLength);
co.tiers.forEach(function (lab) {
var input = $('input', lab);
if (input) { input.addEventListener('change', function () { if (input.checked) { pickCoTier(lab.getAttribute('data-tier')); } }); }
});
if (co.duoBtn) { co.duoBtn.addEventListener('click', toggleCoDuo); }
bindRadios(co.methods, 'data-method', function (m) { co.method = m; markRadios(co.methods, 'data-method', m); }); // MOCK: the method is not sent anywhere
if (co.dateInput) {
co.dateInput.addEventListener('input', function () { co.start = co.dateInput.value; showFieldMsg(co.dateInput, co.dateErr, ''); });
co.dateInput.addEventListener('change', function () { co.start = co.dateInput.value; showFieldMsg(co.dateInput, co.dateErr, ''); });
}
}
function showFieldMsg(input, errEl, msg) {
if (!errEl) { return; }
errEl.textContent = '';
if (msg) {
var sr = doc.createElement('span'); sr.className = 'visually-hidden'; sr.textContent = 'Error: ';
errEl.appendChild(sr); errEl.appendChild(doc.createTextNode(msg));
}
errEl.hidden = !msg;
if (input) { setAttrIf(input, 'aria-invalid', msg ? 'true' : 'false'); }
}
function showPanelMsg(name, msg) {
var el = slot(name); if (!el) { return; }
el.textContent = msg || ''; el.hidden = !msg;
if (msg && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest' }); }
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function normalisePhone(v) {
var n = String(v || '').replace(/[\s\-().]/g, '');
if (n.indexOf('00') === 0) { n = '+' + n.slice(2); }
return n;
}
var RULES = {
name: function (v) {
v = v.trim();
if (!v) { return 'Enter the name for the pass.'; }
if (v.length < 2 || !/\p{L}/u.test(v)) { return 'Enter the name as it should appear on the pass.'; }
return '';
},
email: function (v) {
v = v.trim();
if (!v) { return 'Enter your email address.'; }
if (v.length > 254 || !EMAIL_RE.test(v) || /\.\./.test(v)) { return 'That email address does not look right. Check for a missing @ or dot.'; }
return '';
},
whatsapp: function (v) {
v = v.trim();
if (!v) { return 'Enter your WhatsApp number.'; }
var n = normalisePhone(v);
if (!(/^\+\d{8,15}$/.test(n) || /^0\d{8,12}$/.test(n))) { return 'Use the full number with country code, for example +62 812 3456 7890.'; }
return '';
}
};
function validateField(key, showEmpty) {
var f = co.fields[key]; if (!f || !f.input) { return ''; }
var v = f.input.value;
var msg = (v.trim() === '' && !showEmpty) ? '' : RULES[key](v);
showFieldMsg(f.input, f.err, msg);
return msg;
}
function validateDetails() {
var first = null;
['name', 'email', 'whatsapp'].forEach(function (k) { if (validateField(k, true) && !first) { first = co.fields[k].input; } });
if (first) { first.focus(); }
return !first;
}
function validateDate() {
var today = baliToday(), max = addDaysYmd(today, MAX_AHEAD_DAYS), v = co.dateInput ? co.dateInput.value : co.start;
var msg = '';
if (!v || !ymdParts(v)) { msg = 'Pick the day of your first visit.'; }
else if (v < today) { msg = 'Pick today or a later day.'; }
else if (v > max) { msg = 'Pick a day within the next ' + MAX_AHEAD_DAYS + ' days.'; }
showFieldMsg(co.dateInput, co.dateErr, msg);
if (msg && co.dateInput) { co.dateInput.focus(); }
return !msg;
}
if (co.root && co.fields) {
Object.keys(co.fields).forEach(function (k) {
var f = co.fields[k]; if (!f.input) { return; }
f.input.addEventListener('blur', function () { validateField(k, false); });
f.input.addEventListener('input', function () { if (f.input.getAttribute('aria-invalid') === 'true') { validateField(k, true); } });
});
}
function renderTitle(step) {
if (!co.title) { return; }
if (step === 'pay') {
co.title.textContent = '';
co.title.appendChild(doc.createTextNode('Pay '));
var s = doc.createElement('span');
s.className = 'num'; s.setAttribute('data-format', 'idr'); s.setAttribute('data-motion', 'price-morph');
setPrice(s, totalFor(co.tierId, co.lengthId, co.duo));
co.title.appendChild(s);
} else { co.title.textContent = TITLES[step]; }
}
function renderPay() {
var total = totalFor(co.tierId, co.lengthId, co.duo);
setTextIf(slot('pay-tier'), tierName(co.tierId));
setTextIf(slot('pay-length'), lengthLabel(co.lengthId));
setTextIf(slot('pay-date'), fmtDate(co.start));
setTextIf(slot('pay-duo'), co.duo ? 'Yes, for two' : 'No');
setPrice(slot('pay-total'), total);
markRadios(co.methods, 'data-method', co.method);
showPanelMsg('pay-error', '');
}
function setStep(to, opts) {
if (!co.root || STEPS.indexOf(to) === -1) { return; }
var from = co.step;
if (from === to) { return; }
co.step = to;
if (to === 'pay') { renderPay(); }
renderTitle(to);
co.root.setAttribute('data-checkout-step', to);
co.panels.forEach(function (p) { setAttrIf(p, 'data-active', p.getAttribute('data-step') === to ? 'true' : 'false'); });
var idx = STEPS.indexOf(to);
co.stepItems.forEach(function (li) {
var i = STEPS.indexOf(li.getAttribute('data-co-step'));
if (i === idx) { li.setAttribute('aria-current', 'step'); } else { li.removeAttribute('aria-current'); }
li.setAttribute('data-done', i < idx ? 'true' : 'false');
});
if (co.body) { co.body.scrollTop = 0; }
if (!(opts && opts.silentFocus)) { focusLater(co.title); }
emit('ef:checkout:step', { from: from, to: to });
}
function focusLater(el, tries) {
if (!el) { return; }
tries = tries === undefined ? 6 : tries;
var ok = false;
try { el.focus({ preventScroll: true }); ok = doc.activeElement === el; } catch (e) { }
if (!ok && tries > 0) { win.setTimeout(function () { focusLater(el, tries - 1); }, 40); }
}
function lockScroll() {
var sbw = Math.max(0, win.innerWidth - root.clientWidth);
root.style.setProperty('--ef-sbw', sbw + 'px');
root.setAttribute('data-scroll-lock', 'true');
body.setAttribute('data-scroll-lock', 'true');
}
function unlockScroll() {
root.removeAttribute('data-scroll-lock');
body.removeAttribute('data-scroll-lock');
root.style.removeProperty('--ef-sbw');
}
var HAS_INERT = 'inert' in win.HTMLElement.prototype;
function pageBehind(on) {
if (on) {
co.inerted = [];
Array.prototype.forEach.call(body.children, function (el) {
if (el === co.root || /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) { return; }
if (HAS_INERT) { if (!el.inert) { el.inert = true; co.inerted.push(el); } }
else if (el.getAttribute('aria-hidden') !== 'true') { el.setAttribute('aria-hidden', 'true'); co.inerted.push(el); }
});
} else {
co.inerted.forEach(function (el) { if (HAS_INERT) { el.inert = false; } else { el.removeAttribute('aria-hidden'); } });
co.inerted = [];
}
}
function visible(el) {
if (!el.getClientRects().length) { return false; }
var cs = win.getComputedStyle(el);
return cs.visibility !== 'hidden' && cs.display !== 'none';
}
function tabbables() {
if (!co.sheet) { return []; }
return $$('a[href], button, input, select, textarea, [tabindex]', co.sheet).filter(function (el) {
return !el.disabled && el.tabIndex >= 0 && visible(el);
});
}
doc.addEventListener('keydown', function (e) {
if (!co.open) { return; }
if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); requestClose(); return; }
if (e.key !== 'Tab') { return; }
var list = tabbables(); if (!list.length) { e.preventDefault(); return; }
var first = list[0], last = list[list.length - 1], a = doc.activeElement;
if (!co.sheet.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
});
doc.addEventListener('focusin', function (e) {
if (co.open && co.sheet && !co.sheet.contains(e.target)) { focusLater(co.title, 2); }
});
win.addEventListener('popstate', function () { if (co.open) { closeSheet(); } });
var restoreTimer = 0, prevRestoration = null;
function holdScroll() {
try { if (prevRestoration === null) { prevRestoration = win.history.scrollRestoration; } win.history.scrollRestoration = 'manual'; } catch (e) { }
win.clearTimeout(restoreTimer);
}
function releaseScroll() {
win.clearTimeout(restoreTimer);
restoreTimer = win.setTimeout(function () {
try { if (prevRestoration !== null) { win.history.scrollRestoration = prevRestoration; } } catch (e) { }
prevRestoration = null;
}, 600);
}
function openCheckout(opts) {
if (!co.root || co.open) { return; }
if (!dataSettled) { dataPromise.then(function () { openCheckout(opts); }); return; }
opts = opts || {};
co.open = true; co.seq++;
co.opener = opts.opener || elOf(doc.activeElement);
co.tierId = isTierId(opts.tier) ? opts.tier : 'perform';
co.lengthId = isLengthId(opts.length) ? opts.length : shop.lengthId;
co.duo = typeof opts.duo === 'boolean' ? opts.duo : shop.duo;
if (data && co.duo && !duoAllowed(co.lengthId, co.tierId)) { co.duo = false; }
co.session = null; co.method = 'card'; co.busy = false; co.step = null;
var today = baliToday();
co.start = today;
if (co.dateInput) {
co.dateInput.min = today; co.dateInput.max = addDaysYmd(today, MAX_AHEAD_DAYS); co.dateInput.value = today;
showFieldMsg(co.dateInput, co.dateErr, '');
}
resetDetails();
showPanelMsg('details-error', ''); showPanelMsg('pay-error', '');
renderChoose();
holdScroll();
lockScroll();
pageBehind(true);
co.root.setAttribute('data-state', 'open');
try { win.history.pushState({ efCheckout: true }, '', win.location.href); co.pushed = true; } catch (e) { co.pushed = false; }
updateBuybar();
setStep('choose');
if (data) { announce('checkout'); }
}
function requestClose(after) {
if (!co.open) { return; }
if (typeof after === 'function') { co.afterClose = after; }
if (co.pushed && win.history.state && win.history.state.efCheckout) {
var seq = co.seq;
win.history.back();
win.setTimeout(function () { if (co.open && co.seq === seq) { closeSheet(); } }, 500);
} else { closeSheet(); }
}
function closeSheet() {
if (!co.open) { return; }
co.open = false; co.pushed = false;
co.root.setAttribute('data-state', 'closed');
unlockScroll();
releaseScroll();
pageBehind(false);
clearSensitive();
updateBuybar();
var opener = co.opener; co.opener = null;
if (opener && doc.contains(opener)) { focusLater(opener); }
var cb = co.afterClose; co.afterClose = null;
if (typeof cb === 'function') { cb(); }
}
function resetDetails() {
if (!co.fields) { return; }
Object.keys(co.fields).forEach(function (k) {
var f = co.fields[k];
if (f.input) { f.input.value = ''; setAttrIf(f.input, 'aria-invalid', 'false'); }
if (f.err) { f.err.textContent = ''; f.err.hidden = true; }
});
}
function clearSensitive() { resetDetails(); co.session = null; } // MOCK: nothing is kept; the form is wiped on close
function setBusy(on) {
co.busy = on;
if (co.sheet) { if (on) { co.sheet.setAttribute('aria-busy', 'true'); } else { co.sheet.removeAttribute('aria-busy'); } }
}
function goDetails() {
if (!data) { renderChoose(); return; }
if (!validateDate()) { return; }
co.start = co.dateInput ? co.dateInput.value : co.start;
showPanelMsg('details-error', '');
setStep('details');
}
function buildOrder() {
var wa = normalisePhone(co.fields.whatsapp.input.value);
return {
items: [{ tierId: co.tierId, lengthId: co.lengthId, qty: 1, startDate: co.start }],
duo: !!co.duo,
customer: { name: co.fields.name.input.value.trim(), email: co.fields.email.input.value.trim(), whatsapp: wa }
};
}
function friendly(err, fallback) {
var code = err && err.code;
if (code === 'network_error' || code === 'timeout' || code === 'upstream_unavailable' || code === 'unavailable' || code === 'rate_limited' || code === 'server_error') {
return 'We could not reach the booking service. Please try again in a moment, or message us on WhatsApp.';
}
return fallback;
}
function submitDetails() {
if (co.busy) { return; }
showPanelMsg('details-error', '');
if (!validateDetails()) { return; }
var order = buildOrder();
setBusy(true);
// MOCK: EFApi.createCheckout in mock mode validates the order against passes.json and returns a mock Session. Nothing is sent.
callApi('createCheckout', order).then(function (session) {
setBusy(false);
if (!co.open) { return; }
if (!session || !session.id) { throw new Error('no session'); }
co.session = session;
if (win.EFApi && win.EFApi.mode === 'live' && typeof session.paymentUrl === 'string' && /^https:\/\//.test(session.paymentUrl)) {
win.location.assign(session.paymentUrl);
return;
}
setStep('pay');
}).catch(function (err) {
setBusy(false);
if (!co.open) { return; }
var f = err && err.field;
if (f === 'customer.name' || f === 'customer.email' || f === 'customer.whatsapp') {
var key = f.split('.')[1];
showFieldMsg(co.fields[key].input, co.fields[key].err, err.message || 'Check this field.');
co.fields[key].input.focus();
} else if (err && err.code === 'invalid_start_date') {
setStep('choose', { silentFocus: true });
showFieldMsg(co.dateInput, co.dateErr, 'Pick a day from today up to ' + MAX_AHEAD_DAYS + ' days ahead.');
if (co.dateInput) { co.dateInput.focus(); }
} else {
showPanelMsg('details-error', friendly(err, 'We could not set up the order just now. Please try again, or message us on WhatsApp.'));
}
});
}
function simulatePayment() {
if (co.busy) { return; }
var id = co.session && co.session.id;
if (!id) { showPanelMsg('pay-error', 'This order is no longer active. Go back and continue again.'); return; }
showPanelMsg('pay-error', '');
setBusy(true);
var api = win.EFApi;
// MOCK: EFApi._simulatePayment flips the mock session to "paid"; the page then reads it back with getCheckoutStatus.
var flip = new Promise(function (resolve) { resolve((api && typeof api._simulatePayment === 'function') ? api._simulatePayment(id) : null); });
flip.then(function () { return callApi('getCheckoutStatus', id); }).then(function (st) {
setBusy(false);
if (!co.open) { return; }
var status = st && st.status;
if (status === 'expired' || status === 'failed') { showPanelMsg('pay-error', 'This order expired. Go back and continue again.'); return; }
setTextIf(slot('ref'), String((st && st.reference) || ('EF-' + String(co.session.id || 'MOCK-0001').toUpperCase())));
setStep('done');
}).catch(function (err) {
setBusy(false);
if (!co.open) { return; }
showPanelMsg('pay-error', friendly(err, (err && err.code === 'session_expired') ? 'This order expired. Go back and continue again.' : 'Something went wrong with the simulation. Please try again.'));
});
}
function goToday() {
requestClose(function () {
var t = $('#today'); if (!t) { return; }
t.scrollIntoView({ block: 'start' });
var h = $('#today-title') || t;
if (!h.hasAttribute('tabindex')) { h.setAttribute('tabindex', '-1'); }
try { h.focus({ preventScroll: true }); } catch (e) { }
});
}
if (co.root) {
co.root.addEventListener('click', function (e) {
var a = closest(e.target, '[data-co-action]', co.root); if (!a) { return; }
var act = a.getAttribute('data-co-action');
if (act === 'close' || act === 'done') { e.preventDefault(); requestClose(); }
else if (act === 'next') { e.preventDefault(); goDetails(); }
else if (act === 'back') { e.preventDefault(); setStep(co.step === 'pay' ? 'details' : 'choose'); }
else if (act === 'simulate') { e.preventDefault(); simulatePayment(); }
else if (act === 'today') { e.preventDefault(); goToday(); }
else if (act === 'paynow') { e.preventDefault(); /* MOCK: Pay now is deliberately inert, "Concept preview, nothing is charged" */ }
});
if (co.form) {
co.form.addEventListener('submit', function (e) { e.preventDefault(); submitDetails(); });
}
}
function parseBool(v) {
if (v === null || v === undefined) { return undefined; }
v = String(v).toLowerCase();
return (v === '' || v === 'true' || v === '1' || v === 'yes') ? true : (v === 'false' || v === '0' || v === 'no' ? false : undefined);
}
doc.addEventListener('click', function (e) {
var el = closest(e.target, '[data-open-checkout]');
if (!el || e.defaultPrevented) { return; }
e.preventDefault();
var tier = el.getAttribute('data-tier'), length = el.getAttribute('data-length');
if (el.classList && el.classList.contains('shop__choose')) {
shop.tierId = tier || shop.tierId;
}
openCheckout({ opener: el, tier: tier, length: length, duo: parseBool(el.getAttribute('data-duo')) });
});
var bb = { el: $('#buybar'), heroOut: false, footerIn: false, mq: win.matchMedia ? win.matchMedia('(max-width: 759.98px)') : null };
function updateBuybar() {
if (!bb.el) { return; }
var narrow = bb.mq ? bb.mq.matches : true;
var v = (narrow && bb.heroOut && !bb.footerIn && !co.open) ? 'open' : 'closed';
setAttrIf(bb.el, 'data-state', v);
setAttrIf(body, 'data-buybar', v);
}
function renderBuybar() {
var p = lowestDayPrice();
if (bb.el && p !== null) { setPrice($('.buybar__text .num', bb.el), p); }
}
function initBuybar() {
if (!bb.el) { return; }
updateBuybar();
if (bb.mq) {
if (bb.mq.addEventListener) { bb.mq.addEventListener('change', updateBuybar); } else if (bb.mq.addListener) { bb.mq.addListener(updateBuybar); }
}
var heroCta = $('#hero-cta') || $('#hero');
var footer = $('#site-footer');
if (!('IntersectionObserver' in win)) { bb.heroOut = true; updateBuybar(); return; }
if (heroCta) {
new win.IntersectionObserver(function (entries) {
var last = entries[entries.length - 1];
bb.heroOut = !last.isIntersecting; updateBuybar();
}).observe(heroCta);
} else { bb.heroOut = true; updateBuybar(); }
if (footer) {
new win.IntersectionObserver(function (entries) {
var last = entries[entries.length - 1];
bb.footerIn = last.isIntersecting; updateBuybar();
}).observe(footer);
}
}
function init() {
initBuybar();
dataPromise.then(function () { renderShop(); renderBuybar(); });
}
if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
win.EFShop = {
version: '1.0',
open: function (opts) { openCheckout(opts || {}); },
close: function () { requestClose(); },
isOpen: function () { return co.open; },
state: function () {
return {
shop: { lengthId: shop.lengthId, duo: shop.duo },
checkout: { open: co.open, step: co.step, tierId: co.tierId, lengthId: co.lengthId, duo: co.duo, start: co.start, method: co.method }
};
},
ready: dataPromise,
priceFor: priceFor,
totalFor: totalFor,
formatIdr: fmtIdr
};
}(window, document));
