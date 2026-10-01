(function () {
'use strict';
var root = document.getElementById('today');
if (!root) return;
var DAYS = 7;
var DOW_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var DOW_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var TRAINER_ALIAS = { Tinos: 'Martijn' };
// MOCK: spotsLeft / capacity in schedule.mock.json are invented for the preview.
var SHOW_SPOTS = true;
var FULL_TIMETABLE = 'https://elitefitbali.com/class-schedule/';
var dateLine = root.querySelector('.sched__date');
var tablist = root.querySelector('.sched__days');
var panel = root.querySelector('.sched__rail');
var list = root.querySelector('.sched__list');
var emptyBox = root.querySelector('.sched__empty');
var weekendNote = root.querySelector('.sched__note:not(.sched__note--done)');
var doneNote = root.querySelector('.sched__note--done');
var moreBtn = root.querySelector('.sched__more');
var srStatus = root.querySelector('#sched-status');
if (!dateLine || !tablist || !panel || !list || !moreBtn) return;
var state = {
week: null,
today: null,
selected: null,
open: false,
nowId: null,
nextId: null,
items: [],
timer: null
};
function api() { return window.EFApi; }
function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text != null) n.textContent = text;
return n;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
function toMin(hhmm) { var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1]); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function emit(name, detail) {
document.dispatchEvent(new CustomEvent(name, { detail: detail }));
}
function baliNow() {
var a = api();
var d = a && a.now ? a.now() : new Date();
if (a && a.baliParts) {
var p = a.baliParts(d);
return { ymd: p.ymd, hhmm: p.hhmm, dow: p.dow };
}
var b = new Date(d.getTime() + 8 * 3600 * 1000);
var pad = function (n) { return (n < 10 ? '0' : '') + n; };
return {
ymd: b.getUTCFullYear() + '-' + pad(b.getUTCMonth() + 1) + '-' + pad(b.getUTCDate()),
hhmm: pad(b.getUTCHours()) + ':' + pad(b.getUTCMinutes()),
dow: b.getUTCDay() === 0 ? 7 : b.getUTCDay()
};
}
function dowOf(ymd) {
var p = ymd.split('-');
var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
return d === 0 ? 7 : d;
}
function longDate(ymd, dow) {
var p = ymd.split('-');
return DOW_LONG[dow || dowOf(ymd)] + ' ' + (+p[2]) + ' ' + MONTH[+p[1] - 1];
}
function dayByDate(ymd) {
var days = (state.week && state.week.days) || [];
for (var i = 0; i < days.length; i++) if (days[i].date === ymd) return days[i];
return null;
}
function classify(classes, isToday, nowMin) {
var out = classes.slice().sort(function (a, b) { return toMin(a.start) - toMin(b.start); }).map(function (c) {
return { c: c, s: toMin(c.start), e: toMin(c.end), state: 'later', peek: false };
});
var i, nextIdx = -1, nows = [];
if (!isToday) {
for (i = 0; i < out.length; i++) out[i].peek = i < 2;
return { rows: out, nowIdx: -1, nextIdx: -1, allDone: false };
}
for (i = 0; i < out.length; i++) {
var o = out[i];
if (o.e <= nowMin) o.state = 'past';
else if (o.s <= nowMin) { o.state = 'now'; nows.push(i); }
else if (nextIdx < 0) { nextIdx = i; o.state = 'next'; }
}
if (nows.length) {
nows.forEach(function (n) { out[n].peek = true; });
if (nextIdx >= 0) out[nextIdx].peek = true;
} else if (nextIdx >= 0) {
out[nextIdx].peek = true;
if (out[nextIdx + 1]) out[nextIdx + 1].peek = true;
} else if (out.length) {
out[out.length - 1].peek = true;
if (out[out.length - 2]) out[out.length - 2].peek = true;
}
return {
rows: out,
nowIdx: nows.length ? nows[0] : -1,
nextIdx: nextIdx,
allDone: out.length > 0 && nows.length === 0 && nextIdx < 0
};
}
function trainerName(c) { return TRAINER_ALIAS[c.trainer] || c.trainer || ''; }
function buildItem(row) {
var c = row.c;
var li = el('li', 'sched__item');
li.setAttribute('data-motion', 'lift');
li.setAttribute('data-motion-item', '');
li.setAttribute('data-id', c.id);
li.setAttribute('data-start', c.start);
li.setAttribute('data-end', c.end);
li.appendChild(el('p', 'sched__status label'));
li.appendChild(el('p', 'sched__time num num--m', c.start + '–' + c.end));
li.appendChild(el('h3', 'sched__name', c.title));
var meta = el('div', 'sched__meta');
meta.appendChild(el('p', 'sched__coach', trainerName(c) ? 'with ' + trainerName(c) : ''));
var spots = el('p', 'sched__spots');
// MOCK: spotsLeft is invented (schedule.mock.json), shown only while SHOW_SPOTS is true.
if (SHOW_SPOTS && c.bookable !== false && typeof c.spotsLeft === 'number') {
spots.textContent = c.spotsLeft > 0 ? plural(c.spotsLeft, 'spot', 'spots') + ' left' : 'Full';
} else {
spots.hidden = true;
}
meta.appendChild(spots);
li.appendChild(meta);
row.li = li;
return li;
}
function applyStates(info) {
var rows = info.rows;
rows.forEach(function (row) {
var li = row.li;
var st = row.state;
['now', 'next', 'past'].forEach(function (k) {
if (st === k) li.setAttribute('data-' + k, 'true'); else li.removeAttribute('data-' + k);
});
if (row.peek) li.setAttribute('data-peek', 'true'); else li.removeAttribute('data-peek');
if (st === 'now') li.setAttribute('aria-current', 'time'); else li.removeAttribute('aria-current');
var status = li.querySelector('.sched__status');
clear(status);
status.classList.toggle('sched__status--live', st === 'now');
if (st === 'now') {
var dot = el('span', 'sched__dot');
dot.setAttribute('aria-hidden', 'true');
status.appendChild(dot);
status.appendChild(document.createTextNode('Now'));
} else if (st === 'next') {
status.textContent = 'Next';
} else if (st === 'past') {
status.textContent = 'Done';
}
var sp = li.querySelector('.sched__spots');
if (sp) {
var has = SHOW_SPOTS && row.c.bookable !== false && typeof row.c.spotsLeft === 'number';
sp.hidden = !(has && (st === 'next' || st === 'later'));
}
});
state.items = rows;
var nowId = info.nowIdx >= 0 ? rows[info.nowIdx].c.id : null;
var nextId = info.nextIdx >= 0 ? rows[info.nextIdx].c.id : null;
var changed = nowId !== state.nowId || nextId !== state.nextId;
state.nowId = nowId;
state.nextId = nextId;
if (doneNote) doneNote.hidden = !info.allDone;
updateToggle(rows);
return changed;
}
function updateToggle(rows) {
var total = rows.length;
var peek = rows.filter(function (r) { return r.peek; }).length;
var isToday = state.selected === state.today;
moreBtn.hidden = total === 0 || peek >= total;
list.setAttribute('data-state', state.open ? 'open' : 'closed');
moreBtn.setAttribute('aria-expanded', state.open ? 'true' : 'false');
moreBtn.textContent = state.open
? (isToday ? 'Now and next only' : 'First two only')
: 'Full day (' + plural(total, 'class', 'classes') + ')';
}
function showMessage(text, withLink) {
list.hidden = true;
clear(emptyBox);
emptyBox.appendChild(el('span', null, text));
if (withLink) {
var a = el('a', null, 'Full timetable');
a.href = FULL_TIMETABLE;
a.target = '_blank';
a.rel = 'noopener';
emptyBox.appendChild(a);
}
emptyBox.hidden = false;
}
function renderDay(ymd, announce) {
var day = dayByDate(ymd);
var nowP = baliNow();
var isToday = ymd === state.today;
var dow = day ? day.dow : dowOf(ymd);
var classes = (day && day.classes) || [];
state.selected = ymd;
var p = ymd.split('-');
clear(dateLine);
var t = el('time', null, longDate(ymd, dow));
t.setAttribute('datetime', ymd);
if (isToday) dateLine.appendChild(document.createTextNode('Today · '));
dateLine.appendChild(t);
var tabs = tablist.querySelectorAll('[role="tab"]');
for (var i = 0; i < tabs.length; i++) {
var on = tabs[i].getAttribute('data-date') === ymd;
tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
tabs[i].tabIndex = on ? 0 : -1;
if (on) {
tabs[i].setAttribute('data-selected', 'true');
panel.setAttribute('aria-labelledby', tabs[i].id);
} else {
tabs[i].removeAttribute('data-selected');
}
}
if (weekendNote) weekendNote.hidden = !(dow === 6 || dow === 7);
if (!classes.length) {
state.items = [];
state.nowId = state.nextId = null;
if (doneNote) doneNote.hidden = true;
moreBtn.hidden = true;
showMessage((isToday ? 'No classes today.' : 'No classes this day.') + ' The gym floor is open 6:00–22:00.', false);
finishRender(ymd, announce, 0);
return;
}
emptyBox.hidden = true;
list.hidden = false;
var info = classify(classes, isToday, toMin(nowP.hhmm));
clear(list);
info.rows.forEach(function (row) { list.appendChild(buildItem(row)); });
state.nowId = state.nextId = undefined;
applyStates(info);
finishRender(ymd, announce, info.rows.length);
}
function finishRender(ymd, announce, count) {
root.setAttribute('data-ready', 'true');
if (announce && srStatus) {
srStatus.textContent = longDate(ymd) + ': ' + (count ? plural(count, 'class', 'classes') : 'no classes');
}
emit('ef:schedule:render', { date: ymd });
emit('ef:schedule:nownext', { nowId: state.nowId || null, nextId: state.nextId || null });
}
function select(ymd, announce) {
if (!ymd || !dayByDate(ymd)) return false;
renderDay(ymd, announce !== false);
centreSelected();
return true;
}
function centreSelected() {
if (tablist.scrollWidth <= tablist.clientWidth + 1) return;
var tab = tablist.querySelector('[aria-selected="true"]');
if (!tab) return;
tablist.scrollLeft = tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2;
}
function buildTabs(days, todayYmd) {
clear(tablist);
days.forEach(function (d) {
var b = el('button', 'chip', DOW_SHORT[d.dow] || DOW_SHORT[dowOf(d.date)]);
b.type = 'button';
b.setAttribute('role', 'tab');
b.id = 'sched-tab-' + d.date;
b.setAttribute('aria-selected', 'false');
b.setAttribute('aria-controls', 'sched-panel');
b.setAttribute('aria-label', longDate(d.date, d.dow) + (d.date === todayYmd ? ', today' : ''));
b.setAttribute('data-date', d.date);
b.tabIndex = -1;
tablist.appendChild(b);
});
tablist.hidden = false;
}
tablist.addEventListener('click', function (e) {
var b = e.target.closest ? e.target.closest('[role="tab"]') : null;
if (b && b.getAttribute('data-date')) select(b.getAttribute('data-date'));
});
tablist.addEventListener('keydown', function (e) {
var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
var i = tabs.indexOf(document.activeElement);
if (i < 0) return;
var n = null;
if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
else if (e.key === 'Home') n = 0;
else if (e.key === 'End') n = tabs.length - 1;
if (n === null) return;
e.preventDefault();
tabs[n].focus();
select(tabs[n].getAttribute('data-date'));
});
moreBtn.addEventListener('click', function () {
state.open = !state.open;
updateToggle(state.items);
});
function tick() {
var nowP = baliNow();
if (state.today && nowP.ymd !== state.today) { init(true); return; }
if (state.selected !== state.today || !state.items.length) return;
var classes = state.items.map(function (r) { return r.c; });
var info = classify(classes, true, toMin(nowP.hhmm));
var byId = {};
state.items.forEach(function (r) { byId[r.c.id] = r.li; });
info.rows.forEach(function (r) { r.li = byId[r.c.id]; });
if (applyStates(info)) {
emit('ef:schedule:nownext', { nowId: state.nowId || null, nextId: state.nextId || null });
}
}
function startTimer() {
if (state.timer) { clearTimeout(state.timer); clearInterval(state.timer); }
state.timer = setTimeout(function () {
tick();
state.timer = setInterval(tick, 60000);
}, 60000 - (Date.now() % 60000) + 50);
}
document.addEventListener('visibilitychange', function () {
if (!document.hidden) tick();
});
function fail() {
state.items = [];
tablist.hidden = true;
moreBtn.hidden = true;
if (weekendNote) weekendNote.hidden = true;
if (doneNote) doneNote.hidden = true;
var nowP = baliNow();
clear(dateLine);
var t = el('time', null, longDate(nowP.ymd, nowP.dow));
t.setAttribute('datetime', nowP.ymd);
dateLine.appendChild(document.createTextNode('Today · '));
dateLine.appendChild(t);
showMessage('Timetable unavailable right now.', true);
root.setAttribute('data-ready', 'error');
}
function init(keepState) {
var a = api();
if (!a || typeof a.getSchedule !== 'function') {
console.warn('[EFSchedule] EFApi.getSchedule is missing, showing the fallback message.');
fail();
return;
}
var nowP = baliNow();
state.today = nowP.ymd;
if (!keepState) state.open = false;
var req;
try { req = a.getSchedule({ date: nowP.ymd, days: DAYS }); } catch (e) { fail(); return; }
Promise.resolve(req).then(function (data) {
var days = data && data.days;
if (!days || !days.length) { fail(); return; }
state.week = data;
buildTabs(days, nowP.ymd);
select(dayByDate(nowP.ymd) ? nowP.ymd : days[0].date, false);
startTimer();
}).catch(function (err) {
if (window.console) console.warn('[EFSchedule] could not render the timetable:', err);
fail();
});
}
window.EFSchedule = {
version: '1.0',
select: function (ymd) { return select(ymd, true); },
refresh: tick,
state: function () {
return { today: state.today, selected: state.selected, open: state.open, nowId: state.nowId, nextId: state.nextId };
},
_classify: classify
};
init(false);
})();
