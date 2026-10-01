# Fonts — sources and licences

Version: v1.0 — 2026-10-01 · owner: Step 1 (Fable lead). Both files are self-hosted here; nothing loads from fonts.googleapis.com at runtime.

| File | Family, version, axis | Subset | Size | Source URL (downloaded 2026-10-01 via the Google Fonts CSS API, Chrome user agent) | Licence |
|---|---|---|---|---|---|
| `syne-latin-var.woff2` | Syne, v2.200, variable `wght` 400–800 | latin | 33.8 KB | https://fonts.gstatic.com/s/syne/v24/8vIH7w4qzmVxm2BL9G78HEY.woff2 (from https://fonts.googleapis.com/css2?family=Syne:wght@400..800) | SIL Open Font License 1.1 — https://scripts.sil.org/OFL · Copyright 2019 The Syne Project Authors, https://gitlab.com/bonjour-monde/fonderie/syne-typeface |
| `hanken-grotesk-latin-var.woff2` | Hanken Grotesk, v3.013, variable `wght` 100–900 | latin | 34.8 KB | https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYtpd59CxCis4.woff2 (from https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@100..900) | SIL Open Font License 1.1 — https://scripts.sil.org/OFL · Copyright 2021 The Hanken Grotesk Project Authors, https://github.com/marcologous/hanken-grotesk |

Total transferred: 68.6 KB (budget ≤ 90 KB). Both files carry `tnum` (tabular figures), `pnum`, `frac`, `liga`; Syne also carries `lnum`. No italic file is shipped: the page uses no italics (`font-synthesis: none` in base.css). Fallback metrics for the size-adjusted local fonts are in `assets/css/tokens.css` (`@font-face` blocks `Syne Fallback` and `Hanken Fallback`).

OFL notes: the fonts may be bundled, embedded and redistributed with the site as long as they are not sold on their own and the copyright and licence notice stays with them. Reserved Font Names: none declared in the name tables of these builds; the family names are kept unchanged anyway.

## Change log

- v1.0 — 2026-10-01 — first version: two files, metrics read with fontTools 4.60.2.
- v1.1 — 2026-10-01 — `hanken-grotesk-latin-var.woff2` replaced: the first download was the italic cut (italicAngle −8; reported by lane L3). The upright latin file from the same CSS response is in place and verified with fontTools (italicAngle 0, wght 100–900). The wrong file is kept at `_build/_wrong-download-hanken-grotesk-ITALIC-latin-var.woff2`. (Michael)
- v1.1 note — the upright Hanken Grotesk file has no `tnum`/`pnum` features because its digits are already tabular (all ten digits 560 units wide); Syne digits are proportional, so the page needs `font-variant-numeric: tabular-nums` (tnum is present) wherever numbers must not shift. (Michael)
