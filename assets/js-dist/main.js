/* ============================================================================
   Elite Fit Bali — homepage v2.0 — assets/js/main.js (integrator, Step 3)
   Version: v2.0 — 2026-10-01 · classic deferred script, one IIFE, loads last
   (CONTRACT §6 order: api, shop, schedule, hero, motion, main). Never throws,
   never logs, never animates: it only sets the state attributes the lanes and
   the motion layer read.

   1. Checkout gate. MOCK: the checkout in v2.0 is a labelled concept
      (CONTRACT §1). It must never run on a public domain (WP-MAPPING §1 hard
      gate). Mode, from window.EF_CONFIG.checkout and the host:
        'concept'  – the concept checkout opens (default on localhost,
                     127.0.0.1, file:, *.local, *.test, and on hosts listed in
                     EF_CONFIG.previewHosts, e.g. a noindexed staging site)
        'whatsapp' – every [data-open-checkout] opens a pre-filled WhatsApp
                     chat instead and #checkout is hidden (default on every
                     other host, and whenever #checkout is not on the page)
        'live'     – EFApi runs in live mode (phase 2; not wired in v2.0)
      The mode is written to <html data-checkout="…">.
   2. Header menu (#hdr-menu[data-state], .hdr__toggle[aria-expanded]):
      toggle; close on Escape (focus back to the toggle), on a link or button
      tap inside the menu, on a tap outside the header, when focus leaves the
      header, and when the viewport reaches 1024 px. Not modal: no focus trap.
   3. Coaches "Show all five" (.team__more[aria-expanded][data-state]).
   4. Motion failsafe: if html.motion-ok is set and motion.js is missing, or
      html.motion-live has not appeared 3 s after `load`, remove motion-ok so
      the complete static layout shows (lane L4: Recharge rooms 2–4).
   5. Skip link: moves focus to the Today heading, not only the scroll.
   ============================================================================ */
(function (win, doc) {
'use strict';
var root = doc.documentElement;
var WA = 'https://wa.me/6285195520220';
function guard(fn) {
return function () {
try { return fn.apply(this, arguments); } catch (e) { }
};
}
function closest(node, sel) {
while (node && node.nodeType !== 1) { node = node.parentNode; }
return node && node.closest ? node.closest(sel) : null;
}
function cfg() { return win.EF_CONFIG && typeof win.EF_CONFIG === 'object' ? win.EF_CONFIG : {}; }
var TIER = { perform: 'Perform', elite: 'Elite', recharge: 'Recharge' };
var LENGTH = { day: 'day pass', week: '1-week pass', w4: '4-week membership', w12: '12-week membership', w26: '26-week membership', w52: '52-week membership' };
function isLocalHost() {
var p = win.location.protocol, h = win.location.hostname;
return p === 'file:' || h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || /\.(local|test|localhost)$/i.test(h);
}
function checkoutMode() {
var c = cfg();
var api = win.EFApi;
if (!doc.getElementById('checkout')) { return 'whatsapp'; }
if (api && api.mode === 'live') { return 'live'; }
if (c.checkout === 'whatsapp') { return 'whatsapp'; }
var hosts = Array.isArray(c.previewHosts) ? c.previewHosts : [];
if (isLocalHost() || hosts.indexOf(win.location.hostname) > -1) { return 'concept'; }
return 'whatsapp'; // MOCK must not reach a public domain
}
function waText(el) {
var tier = TIER[el.getAttribute('data-tier')] || '';
var len = LENGTH[el.getAttribute('data-length')] || '';
var what = tier && len ? ' (' + tier + ', ' + len + ')' : '';
return 'Hello Elite Fit Bali! I would like to buy a pass' + what + '.';
}
function openWhatsApp(el) {
var a = doc.createElement('a');
a.href = WA + '?text=' + encodeURIComponent(waText(el));
a.target = '_blank';
a.rel = 'noopener';
a.style.display = 'none';
doc.body.appendChild(a);
a.click();
doc.body.removeChild(a);
}
var MODE = 'concept';
guard(function () {
MODE = checkoutMode();
root.setAttribute('data-checkout', MODE);
if (MODE !== 'whatsapp') { return; }
var co = doc.getElementById('checkout');
if (co) { co.hidden = true; co.setAttribute('aria-hidden', 'true'); }
win.addEventListener('click', guard(function (e) {
var el = closest(e.target, '[data-open-checkout]');
if (!el) { return; }
e.preventDefault();
openWhatsApp(el);
}), true);
})();
guard(function () {
var header = doc.getElementById('site-header');
var toggle = doc.querySelector('.hdr__toggle');
var menu = doc.getElementById('hdr-menu');
if (!header || !toggle || !menu) { return; }
var mqDesk = win.matchMedia ? win.matchMedia('(min-width: 1024px)') : null;
var reopenFromBuy = false;
function isOpen() { return menu.getAttribute('data-state') === 'open'; }
function set(open, focusToggle) {
if (open === isOpen()) { return; }
toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
menu.setAttribute('data-state', open ? 'open' : 'closed');
if (!open && focusToggle) { try { toggle.focus({ preventScroll: true }); } catch (e) { toggle.focus(); } }
}
if (menu.getAttribute('data-state') !== 'open') { toggle.setAttribute('aria-expanded', 'false'); }
toggle.addEventListener('click', guard(function () { set(!isOpen(), false); }));
menu.addEventListener('click', guard(function (e) {
var hit = closest(e.target, 'a, button');
if (!hit || !menu.contains(hit)) { return; }
if (hit.hasAttribute('data-open-checkout')) { reopenFromBuy = true; }
set(false, false);
}));
doc.addEventListener('keydown', guard(function (e) {
if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) { set(false, true); }
}));
doc.addEventListener('pointerdown', guard(function (e) {
if (isOpen() && !header.contains(e.target)) { set(false, false); }
}), { passive: true });
header.addEventListener('focusout', guard(function (e) {
var to = e.relatedTarget;
if (isOpen() && to && !header.contains(to)) { set(false, false); }
}));
if (mqDesk) {
var onDesk = guard(function () { if (mqDesk.matches) { set(false, false); } });
if (mqDesk.addEventListener) { mqDesk.addEventListener('change', onDesk); } else if (mqDesk.addListener) { mqDesk.addListener(onDesk); }
}
var co = doc.getElementById('checkout');
if (co && 'MutationObserver' in win) {
new win.MutationObserver(guard(function () {
if (!reopenFromBuy || co.getAttribute('data-state') !== 'closed') { return; }
reopenFromBuy = false;
win.setTimeout(guard(function () {
var a = doc.activeElement;
if (!a || a === doc.body || menu.contains(a)) { try { toggle.focus({ preventScroll: true }); } catch (e) { toggle.focus(); } }
}), 320);
})).observe(co, { attributes: true, attributeFilter: ['data-state'] });
}
})();
doc.addEventListener('click', guard(function (e) {
var btn = closest(e.target, '.team__more');
if (!btn) { return; }
var open = btn.getAttribute('data-state') === 'open';
btn.setAttribute('data-state', open ? 'closed' : 'open');
btn.setAttribute('aria-expanded', open ? 'false' : 'true');
}));
guard(function () {
if (!root.classList.contains('motion-ok')) { return; }
if (!win.EFMotion) { root.classList.remove('motion-ok'); return; }
var check = guard(function () {
if (!root.classList.contains('motion-live')) { root.classList.remove('motion-ok'); }
});
var arm = function () { win.setTimeout(check, 3000); };
if (doc.readyState === 'complete') { arm(); } else { win.addEventListener('load', arm, { once: true }); }
})();
doc.addEventListener('click', guard(function (e) {
var link = closest(e.target, '.skip-link');
if (!link) { return; }
var id = (link.getAttribute('href') || '').replace(/^#/, '');
var target = id && doc.getElementById(id);
if (!target) { return; }
var focusEl = target.querySelector('h2, h1') || target;
if (!focusEl.hasAttribute('tabindex')) { focusEl.setAttribute('tabindex', '-1'); }
e.preventDefault();
target.scrollIntoView({ block: 'start' });
try { focusEl.focus({ preventScroll: true }); } catch (err) { focusEl.focus(); }
if (win.history && win.history.replaceState) { try { win.history.replaceState(win.history.state, '', '#' + id); } catch (err) { } }
}));
win.EFMain = { version: '2.0', checkout: function () { return MODE; } };
}(window, document));
