/* ============================================================================
   Elite Fit Bali homepage v2.0 — assets/js/api.js — lane L6 (data and API)
   Version v1.0 — 2026-10-01

   window.EFApi = { mode, tz, now, baliParts, getPasses, getSchedule,
                    createCheckout, getCheckoutStatus, submitLead }
   (CONTRACT §6). Classic deferred script, one IIFE, no dependencies.

   MOCK: this file ships with a MOCK ADAPTER. In v2.0 nothing real is
   collected, charged, stored or sent. The mock adapter
     - reads assets/data/passes.json and assets/data/schedule.mock.json
       (same origin, the only network traffic it ever makes),
     - expands the weekly schedule template to real dates in Bali time;
       `spotsLeft` and `capacity` are passed through from the template when it
       has them (both are INVENTED, marked MOCK there), and a class without a
       `spotsLeft` gets a hash of class id and date (never random, stable on reload),
     - validates an order against passes.json and returns a mock Session
       (paymentUrl: null, mock: true),
     - flips a session to `paid` only when EFApi._simulatePayment(id) is
       called (the "Simulate payment" button of the concept panel),
     - keeps everything in memory: no localStorage, no sessionStorage, no
       cookies, nothing is posted anywhere.

   LIVE (NOT WIRED): no provider is contacted in v2.0. The `live` object
   further down documents and implements the HTTP calls of API-CONTRACT.md
   (GET /api/passes, GET /api/schedule, POST /api/checkout,
   GET /api/checkout/:id, POST /api/lead). It is only selected when
   window.EF_CONFIG.mode === 'live', which nothing sets in v2.0.

   Config (optional, WordPress injects it): window.EF_CONFIG = {
     mode: 'mock' | 'live',         // default 'mock'
     apiBase: 'https://…',          // live only, no trailing slash needed
     assetBase: 'https://…/assets/',// default: derived from this script's URL
     assetVersion: '2.0.0',         // optional cache-buster for the two JSON files
     timeoutMs: 12000               // live only
   }
   QA: ?now=2026-10-01T09:30 (Bali local time) freezes now() in mock mode.
   ============================================================================ */
(function (win, doc) {
'use strict';
if (win.EFApi) { return; }
var scriptEl = doc.currentScript;
var cfg = win.EF_CONFIG || {};
var MODE = cfg.mode === 'live' ? 'live' : 'mock';
var TZ = 'Asia/Makassar';
var OFFSET_MIN = 480;
var MS_MIN = 60000;
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function pad4(n) { var s = String(n); while (s.length < 4) { s = '0' + s; } return s; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
var HTTP_STATUS = {
invalid_request: 400, empty_order: 422, invalid_tier: 422, invalid_length: 422,
invalid_quantity: 422, invalid_start_date: 422, duo_not_available: 422,
invalid_customer: 422, invalid_lead: 422, consent_required: 422,
not_found: 404, session_expired: 409, idempotency_conflict: 409,
rate_limited: 429, server_error: 500, upstream_unavailable: 503, unavailable: 503,
network_error: 0, timeout: 0, config_missing: 0
};
function apiError(code, message, extra) {
var e = new Error(message || code);
e.name = 'EFApiError';
e.code = code;
e.status = HTTP_STATUS.hasOwnProperty(code) ? HTTP_STATUS[code] : 0;
if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) { e[k] = extra[k]; } } }
return e;
}
function safe(fn) {
return function () {
try { return Promise.resolve(fn.apply(this, arguments)); }
catch (e) { return Promise.reject(e); }
};
}
var YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isYmd(s) {
var m = typeof s === 'string' && YMD_RE.exec(s);
if (!m) { return false; }
var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
}
function ymdToUtc(ymd) { var m = YMD_RE.exec(ymd); return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
function utcToYmd(ms) {
var d = new Date(ms);
return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function addDays(ymd, n) { return utcToYmd(ymdToUtc(ymd) + n * 86400000); }
function dowOfYmd(ymd) { var d = new Date(ymdToUtc(ymd)).getUTCDay(); return d === 0 ? 7 : d; }
// QA override. MOCK: only honoured in mock mode; a live page never lets a URL move the clock.
var NOW_OVERRIDE = null;
(function readNowOverride() {
if (MODE !== 'mock') { return; }
var raw;
try { raw = new URLSearchParams(win.location.search).get('now'); } catch (e) { raw = null; }
var m = raw && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
if (!m) { return; }
var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = m[6] ? +m[6] : 0;
if (!isYmd(m[1] + '-' + m[2] + '-' + m[3]) || h > 23 || mi > 59 || s > 59) { return; }
NOW_OVERRIDE = Date.UTC(y, mo - 1, d, h, mi, s) - OFFSET_MIN * MS_MIN;
}());
function now() { return NOW_OVERRIDE !== null ? new Date(NOW_OVERRIDE) : new Date(); }
function baliParts(date) {
var t = date === undefined ? now().getTime() : (date instanceof Date ? date.getTime() : (typeof date === 'number' ? date : NaN));
if (!isFinite(t)) { throw new TypeError('EFApi.baliParts expects a Date'); }
var d = new Date(t + OFFSET_MIN * MS_MIN);
var wd = d.getUTCDay();
return {
ymd: d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
hhmm: pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()),
dow: wd === 0 ? 7 : wd
};
}
function resolveAssetBase() {
var b = cfg.assetBase;
if (!b) {
var src = scriptEl && scriptEl.src;
if (!src) { var s = doc.querySelector('script[src*="api.js"]'); src = s && s.src; }
try { b = src ? new URL('../', src.split('#')[0].split('?')[0]).href : new URL('assets/', doc.baseURI).href; }
catch (e) { b = 'assets/'; }
}
return /\/$/.test(b) ? b : b + '/';
}
var ASSET_BASE = resolveAssetBase();
var VER = cfg.assetVersion ? '?ver=' + encodeURIComponent(cfg.assetVersion) : '';
/* =========================================================================
     MOCK ADAPTER
     ========================================================================= */
var mockCache = { passes: null, template: null };
var mockSessions = {};
var mockKeys = {};
var mockSessionCount = 0;
var mockLeadCount = 0;
function fetchJson(url) {
// MOCK: the only network traffic of the mock adapter, same origin, GET only.
return fetch(url, { credentials: 'same-origin' }).then(function (r) {
if (!r.ok) { throw new Error('HTTP ' + r.status); }
return r.json();
});
}
function mockLoadPasses() {
if (!mockCache.passes) {
mockCache.passes = fetchJson(ASSET_BASE + 'data/passes.json' + VER).then(function (p) {
if (!isObj(p) || !Array.isArray(p.tiers) || !Array.isArray(p.lengths)) { throw new Error('bad shape'); }
return p;
}).catch(function () {
mockCache.passes = null;
throw apiError('unavailable', 'Pass prices are unavailable right now.');
});
}
return mockCache.passes;
}
function emptyTemplate() {
var t = [];
for (var d = 1; d <= 7; d++) { t.push({ dow: d, classes: [] }); }
return { source: 'mock-of-gymmaster', tz: TZ, template: t, degraded: true };
}
function mockLoadTemplate() {
if (!mockCache.template) {
mockCache.template = fetchJson(ASSET_BASE + 'data/schedule.mock.json' + VER).then(function (j) {
if (!isObj(j) || !Array.isArray(j.template)) { throw new Error('bad shape'); }
return j;
}).catch(function () { return emptyTemplate(); });
}
return mockCache.template;
}
function hash32(str) {
var h = 0x811c9dc5;
for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
return h >>> 0;
}
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function addMinutes(hhmm, n) {
var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm); if (!m) { return hhmm; }
var t = (+m[1]) * 60 + (+m[2]) + n;
return pad2(Math.floor(t / 60) % 24) + ':' + pad2(t % 60);
}
function normHhmm(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? pad2(+m[1]) + ':' + m[2] : null; }
function indexTemplate(tpl) {
var byDow = {};
(tpl.template || []).forEach(function (day) {
var dow = +(day && day.dow);
if (!(dow >= 1 && dow <= 7)) { return; }
var list = [];
(day.classes || []).forEach(function (c) {
var start = normHhmm(c && c.start);
if (!start || !c.title) { return; }
list.push({
id: c.id ? String(c.id) : (dow + '-' + start.replace(':', '') + '-' + slug(c.title)),
start: start,
end: normHhmm(c.end) || addMinutes(start, 60),
title: String(c.title),
trainer: c.trainer ? String(c.trainer) : '',
zone: c.zone || 'workout',
capacity: (typeof c.capacity === 'number' && c.capacity > 0) ? Math.floor(c.capacity) : 12, // MOCK: invented
baseSpots: (typeof c.spotsLeft === 'number' && c.spotsLeft >= 0) ? Math.floor(c.spotsLeft) : null, // MOCK: invented, passed through when the template has it
bookable: c.bookable !== false
});
});
list.sort(function (a, b) { return a.start < b.start ? -1 : (a.start > b.start ? 1 : 0); });
byDow[dow] = list;
});
return byDow;
}
function mockGetSchedule(opts) {
opts = opts || {};
var today = baliParts(now()).ymd;
var date = opts.date === undefined || opts.date === null ? today
: (opts.date instanceof Date ? baliParts(opts.date).ymd : opts.date);
if (!isYmd(date)) { throw apiError('invalid_request', 'date must be YYYY-MM-DD.', { field: 'date' }); }
if (date < addDays(today, -7) || date > addDays(today, 28)) {
throw apiError('invalid_request', 'date is outside the window of 7 days back to 28 days ahead.', { field: 'date' });
}
var days = opts.days === undefined || opts.days === null ? 7 : opts.days;
if (typeof days !== 'number' || days % 1 !== 0 || days < 1 || days > 7) {
throw apiError('invalid_request', 'days must be a whole number from 1 to 7.', { field: 'days' });
}
return mockLoadTemplate().then(function (tpl) {
var byDow = indexTemplate(tpl);
var out = [];
for (var i = 0; i < days; i++) {
var ymd = addDays(date, i), dow = dowOfYmd(ymd);
out.push({
date: ymd,
dow: dow,
classes: (byDow[dow] || []).map(function (c) {
return {
id: c.id + '@' + ymd,
classId: c.id,
date: ymd,
start: c.start,
end: c.end,
startsAt: ymd + 'T' + c.start + ':00+08:00',
endsAt: ymd + 'T' + c.end + ':00+08:00',
title: c.title,
trainer: c.trainer,
zone: c.zone,
// MOCK: invented. The template's own value is passed through (clamped to capacity); a class
spotsLeft: c.baseSpots !== null ? Math.min(c.baseSpots, c.capacity) : hash32(c.id + '|' + ymd) % (c.capacity + 1),
capacity: c.capacity, // MOCK: invented
bookable: c.bookable
};
})
});
}
return {
source: tpl.source || 'mock-of-gymmaster',
tz: TZ,
generatedAt: now().toISOString(),
mock: true,
mockFields: ['spotsLeft', 'capacity'],
degraded: tpl.degraded === true,
days: out
};
});
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function cleanPhone(s) { return String(s).replace(/[\s\-().]/g, ''); }
function validPhone(s) { return typeof s === 'string' && /^\+?\d{7,15}$/.test(cleanPhone(s)); }
function find(arr, id) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { return arr[i]; } } return null; }
function validateOrder(order, passes) {
if (!isObj(order)) { throw apiError('invalid_request', 'The order must be an object.'); }
if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > 5) {
throw apiError('empty_order', 'An order needs one to five items.', { field: 'items' });
}
if (order.duo !== undefined && typeof order.duo !== 'boolean') {
throw apiError('invalid_request', 'duo must be true or false.', { field: 'duo' });
}
if (order.consent !== undefined && !isObj(order.consent)) {
throw apiError('invalid_request', 'consent must be an object.', { field: 'consent' });
}
if (order.idempotencyKey !== undefined && !(typeof order.idempotencyKey === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(order.idempotencyKey))) {
throw apiError('invalid_request', 'idempotencyKey must be 8 to 64 letters, digits, - or _.', { field: 'idempotencyKey' });
}
var duo = order.duo === true;
var today = baliParts(now()).ymd, lastStart = addDays(today, 90);
var lines = [], total = 0;
order.items.forEach(function (it, i) {
var at = 'items[' + i + ']';
if (!isObj(it)) { throw apiError('invalid_request', at + ' must be an object.', { field: at }); }
var qty = it.qty === undefined ? 1 : it.qty;
if (typeof qty !== 'number' || qty % 1 !== 0 || qty < 1 || qty > 10) {
throw apiError('invalid_quantity', 'qty must be a whole number from 1 to 10.', { field: at + '.qty' });
}
var unit, label, tier = null, length = null;
if (it.tierId === 'class') {
var cp = null;
(passes.classPasses || []).forEach(function (c) { if (c.lengthId === it.lengthId) { cp = c; } });
if (!cp) { throw apiError('invalid_length', 'Class passes use lengthId c1 or c10.', { field: at + '.lengthId' }); }
if (duo) { throw apiError('duo_not_available', 'Duo prices do not exist for class passes.', { field: 'duo' }); }
unit = cp.price; label = cp.name;
} else {
tier = typeof it.tierId === 'string' ? find(passes.tiers, it.tierId) : null;
if (!tier) { throw apiError('invalid_tier', 'Unknown tierId.', { field: at + '.tierId' }); }
length = typeof it.lengthId === 'string' ? find(passes.lengths, it.lengthId) : null;
if (!length || typeof tier.prices[length.id] !== 'number') {
throw apiError('invalid_length', 'Unknown lengthId.', { field: at + '.lengthId' });
}
if (!isYmd(it.startDate) || it.startDate < today || it.startDate > lastStart) {
throw apiError('invalid_start_date', 'startDate must be a real day from today up to 90 days ahead (Bali time).', { field: at + '.startDate' });
}
if (duo) {
var d = passes.duo || {}, okLen = (d.lengths || []).indexOf(length.id) !== -1;
if (!okLen) { throw apiError('duo_not_available', 'Duo prices exist for day passes and 4-week memberships only.', { field: 'duo' }); }
if (length.id === 'day') {
if ((d.dayPassTiers || []).indexOf(tier.id) === -1 || typeof d.dayPassEach !== 'number') {
throw apiError('duo_not_available', 'No Duo day price for this pass.', { field: 'duo' });
}
unit = d.dayPassEach * (d.people || 2);
} else {
if (!d.fourWeek || typeof d.fourWeek[tier.id] !== 'number') {
throw apiError('duo_not_available', 'No Duo price for this pass.', { field: 'duo' });
}
unit = d.fourWeek[tier.id];
}
} else {
unit = tier.prices[length.id];
}
label = tier.name + ' · ' + length.label;
}
lines.push({
tierId: it.tierId, lengthId: it.lengthId, qty: qty,
startDate: it.startDate || null, duo: duo, label: label,
unitPrice: unit, subtotal: unit * qty
});
total += unit * qty;
});
var c = order.customer;
if (!isObj(c)) { throw apiError('invalid_customer', 'customer is required.', { field: 'customer' }); }
if (typeof c.name !== 'string' || c.name.trim().length < 1 || c.name.trim().length > 120) {
throw apiError('invalid_customer', 'Please enter your full name.', { field: 'customer.name' });
}
if (typeof c.email !== 'string' || c.email.length > 254 || !EMAIL_RE.test(c.email)) {
throw apiError('invalid_customer', 'Please enter a valid email address.', { field: 'customer.email' });
}
if (!validPhone(c.whatsapp)) {
throw apiError('invalid_customer', 'Please enter a WhatsApp number with 7 to 15 digits.', { field: 'customer.whatsapp' });
}
return { lines: lines, total: total, duo: duo };
}
function canonOrder(order, q) {
return JSON.stringify([q.lines.map(function (l) { return [l.tierId, l.lengthId, l.qty, l.startDate, l.duo]; }), order.customer.name.trim(), order.customer.email, cleanPhone(order.customer.whatsapp)]);
}
function mockCreateCheckout(order) {
return mockLoadPasses().then(function (passes) {
var q = validateOrder(order, passes);
var canon = canonOrder(order, q), key = order.idempotencyKey;
if (key && mockKeys[key]) {
var prev = mockSessions[mockKeys[key]];
if (prev.canon !== canon) { throw apiError('idempotency_conflict', 'This idempotency key was used for a different order.'); }
return clone(prev.session);
}
var id = 'mock-' + pad4(++mockSessionCount);
var session = {
id: id,
status: 'awaiting_payment',
total: q.total,
currency: 'IDR',
paymentUrl: null,
expiresAt: new Date(now().getTime() + 30 * MS_MIN).toISOString(),
mock: true,
lines: q.lines
};
mockSessions[id] = { session: session, status: 'awaiting_payment', reference: null, canon: canon };
if (key) { mockKeys[key] = id; }
return clone(session);
});
}
function mockStatusOf(rec) {
if (rec.status === 'awaiting_payment' && now().getTime() >= Date.parse(rec.session.expiresAt)) { rec.status = 'expired'; }
return { id: rec.session.id, status: rec.status, reference: rec.reference };
}
function mockGetCheckoutStatus(id) {
if (typeof id !== 'string' || !id) { throw apiError('invalid_request', 'A session id is required.', { field: 'id' }); }
var rec = mockSessions[id];
if (!rec) { throw apiError('not_found', 'No such checkout session.'); }
return mockStatusOf(rec);
}
// MOCK: the "Simulate payment" button of the concept panel. Flips the state synchronously and returns a
function mockSimulatePayment(id) {
var rec = typeof id === 'string' ? mockSessions[id] : null;
if (!rec) { return Promise.reject(apiError('not_found', 'No such checkout session.')); }
var s = mockStatusOf(rec);
if (s.status === 'expired') { return Promise.reject(apiError('session_expired', 'This checkout session has expired.')); }
if (rec.status !== 'paid') { rec.status = 'paid'; rec.reference = 'EF-' + rec.session.id.toUpperCase(); }
var out = mockStatusOf(rec), p = Promise.resolve(out);
p.id = out.id; p.status = out.status; p.reference = out.reference;
return p;
}
var LEAD_INTERESTS = ['pass', 'membership', 'tour', 'recovery'];
function mockSubmitLead(lead) {
// MOCK: validates and discards. Nothing is stored or sent.
if (!isObj(lead)) { throw apiError('invalid_request', 'The lead must be an object.'); }
if (typeof lead.name !== 'string' || lead.name.trim().length < 1 || lead.name.trim().length > 120) {
throw apiError('invalid_lead', 'Please enter your name.', { field: 'name' });
}
if (!validPhone(lead.whatsapp)) { throw apiError('invalid_lead', 'Please enter a WhatsApp number with 7 to 15 digits.', { field: 'whatsapp' }); }
if (LEAD_INTERESTS.indexOf(lead.interest) === -1) { throw apiError('invalid_lead', 'interest must be pass, membership, tour or recovery.', { field: 'interest' }); }
if (lead.source !== undefined && !(typeof lead.source === 'string' && lead.source.length <= 64)) {
throw apiError('invalid_lead', 'source must be a short text.', { field: 'source' });
}
return { ok: true, id: 'mock-lead-' + pad4(++mockLeadCount) };
}
var mock = {
getPasses: function () { return mockLoadPasses().then(clone); },
getSchedule: mockGetSchedule,
createCheckout: mockCreateCheckout,
getCheckoutStatus: mockGetCheckoutStatus,
submitLead: mockSubmitLead
};
function liveRequest(method, path, body, headers) {
if (!cfg.apiBase) { return Promise.reject(apiError('config_missing', 'EF_CONFIG.apiBase is not set.')); }
var base = String(cfg.apiBase).replace(/\/+$/, '');
var ctl = typeof AbortController === 'function' ? new AbortController() : null;
var timer = ctl ? setTimeout(function () { ctl.abort(); }, cfg.timeoutMs || 12000) : 0;
var h = { 'Accept': 'application/json' };
if (body !== undefined) { h['Content-Type'] = 'application/json'; }
if (headers) { for (var k in headers) { if (headers.hasOwnProperty(k)) { h[k] = headers[k]; } } }
return fetch(base + path, {
method: method, headers: h, mode: 'cors', credentials: 'omit',
cache: method === 'GET' ? 'default' : 'no-store',
body: body === undefined ? undefined : JSON.stringify(body),
signal: ctl ? ctl.signal : undefined
}).then(function (res) {
clearTimeout(timer);
return res.text().then(function (txt) {
var data = null;
try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
if (res.ok) { return data; }
var er = data && data.error ? data.error : {};
var retry = parseInt(res.headers.get('Retry-After'), 10);
throw apiError(er.code || (res.status === 429 ? 'rate_limited' : (res.status >= 500 ? 'server_error' : 'invalid_request')),
er.message || 'The request failed.',
{ status: res.status, field: er.field, requestId: er.requestId, retryAfter: isNaN(retry) ? undefined : retry });
});
}, function (err) {
clearTimeout(timer);
throw apiError(err && err.name === 'AbortError' ? 'timeout' : 'network_error', 'The service could not be reached.');
});
}
function newKey() {
var c = win.crypto;
if (c && typeof c.randomUUID === 'function') { return c.randomUUID(); }
var a = new Uint8Array(16); if (c && c.getRandomValues) { c.getRandomValues(a); }
return Array.prototype.map.call(a, function (b) { return pad2(b.toString(16)); }).join('');
}
var live = {
getPasses: function () { return liveRequest('GET', '/api/passes'); },
getSchedule: function (o) {
o = o || {};
var q = [];
if (o.date) { q.push('date=' + encodeURIComponent(o.date instanceof Date ? baliParts(o.date).ymd : o.date)); }
if (o.days) { q.push('days=' + encodeURIComponent(o.days)); }
return liveRequest('GET', '/api/schedule' + (q.length ? '?' + q.join('&') : ''));
},
createCheckout: function (order) {
var body = clone(order || {}), key = body.idempotencyKey || newKey();
delete body.idempotencyKey;
return liveRequest('POST', '/api/checkout', body, { 'Idempotency-Key': key });
},
getCheckoutStatus: function (id) { return liveRequest('GET', '/api/checkout/' + encodeURIComponent(id)); },
submitLead: function (lead) { return liveRequest('POST', '/api/lead', lead, { 'Idempotency-Key': newKey() }); }
};
var impl = MODE === 'live' ? live : mock;
var api = {
mode: MODE,
tz: TZ,
now: now,
baliParts: baliParts,
getPasses: safe(impl.getPasses),
getSchedule: safe(impl.getSchedule),
createCheckout: safe(impl.createCheckout),
getCheckoutStatus: safe(impl.getCheckoutStatus),
submitLead: safe(impl.submitLead)
};
if (MODE === 'mock') {
api._simulatePayment = mockSimulatePayment; // MOCK: not part of the live API
if (win.console && win.console.info) { win.console.info('[EF mock adapter] mock data only: nothing is charged, stored or sent.'); }
}
win.EFApi = api;
}(window, document));
