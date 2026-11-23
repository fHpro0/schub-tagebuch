// Schub-Tagebuch: a flare diary as a custom space on window.phone (data, haptics, widget, share, faceid).
// No build step, no inline script, no external requests.
const $ = (id) => document.getElementById(id);
const view = $("view");
let toastTimer = 0, chartTab = "energie", symList = [], renderToken = 0;

// ---- dates (local, YYYY-MM-DD in SQLite)
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const diff = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const de = (s) => { const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; };
const deShort = (s) => { const [, m, d] = s.split("-"); return `${d}.${m}.`; };
const rel = (s) => { const n = diff(s, today()); return n === 0 ? "Heute" : n === 1 ? "Gestern" : de(s); };
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const days = (n) => `${n} ${n === 1 ? "Tag" : "Tagen"}`;
const dayCount = (n) => `${n} ${n === 1 ? "Tag" : "Tage"}`;
const hex16 = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

// ---- tiny DOM helper
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const kid of kids) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  clearTimeout(toastTimer);
  if (text) toastTimer = setTimeout(() => { el.textContent = ""; }, 4000);
}
const buzz = (kind) => { try { phone.haptic(kind).catch(() => {}); } catch {} };
const widget = () => { try { phone.widget.reload().catch(() => {}); } catch {} };
const quiet = (e) => { if (e && e.code !== "Cancelled") toast(e.message || "Das hat nicht geklappt."); };
const q = (sql, p = []) => phone.data.query(sql, p);

// ---- data
const FLARES = "SELECT s.id, s.start, s.ende, s.staerke, s.ausloeser, s.kortison, s.mrt, s.arzt, s.notiz, s.beschreibung, max(s.staerke, coalesce((SELECT max(v.staerke) FROM verlauf v WHERE v.schub = s.id), 0)) AS maxst FROM schuebe s ORDER BY s.start DESC, s.rowid DESC";
async function loadFlares() {
  const [flares, syms] = await Promise.all([
    q(FLARES),
    q("SELECT y.schub, y.name, coalesce(l.emoji, '') AS emoji FROM symptome y LEFT JOIN symptom_liste l ON l.name = y.name ORDER BY coalesce(l.ord, 99), y.name"),
  ]);
  const by = new Map(flares.map((f) => [f.id, Object.assign(f, { syms: [] })]));
  for (const y of syms) by.get(y.schub)?.syms.push(y);
  return flares;
}
const len = (f) => diff(f.start, f.ende || today()) + 1;
const symLine = (f) => f.syms.length ? f.syms.map((y) => y.name.replace(/,.*$/, "").replace(/ \(.*\)$/, "")).join(", ") : "Keine Symptome gewählt";
async function loadSymList(force) { if (force || !symList.length) symList = await q("SELECT name, emoji, eigen FROM symptom_liste ORDER BY ord, name"); return symList; }

// ---- charts
function emptyChart(text) { return h("p", { class: "muted small empty" }, text); }
let gid = 0;
const stopS = (o, c, a) => s("stop", { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` });
// a smooth curve through the points (Catmull-Rom as cubic Bezier), kept inside [lo, hi]
function smooth(pts, lo, hi) {
  const c = (v) => Math.min(hi, Math.max(lo, v));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${c(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function lineChart(points, labels, { min = 0, max = 10, label }) {
  const W = 320, H = 150, L = 24, R = 10, T = 12, B = 24, id = ++gid;
  const n = points.length, x = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label });
  svg.append(s("defs", {},
    s("linearGradient", { id: `ga${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, stopS("0%", "--pink", 0.4), stopS("100%", "--violet", 0)),
    s("linearGradient", { id: `gl${id}`, x1: 0, y1: 0, x2: 1, y2: 0 }, stopS("0%", "--pink", 1), stopS("100%", "--violet", 1))));
  for (const g of [0, 5, 10]) svg.append(s("line", { class: "grid", x1: L, x2: W - R, y1: y(g), y2: y(g) }), s("text", { x: L - 5, y: y(g) + 3, "text-anchor": "end" }, String(g)));
  const pts = points.map((v, i) => (v == null ? null : [x(i), y(v), i])).filter(Boolean);
  if (pts.length >= 2) {
    const d = smooth(pts, y(max), y(min));
    svg.append(s("path", { d: `${d} L${pts[pts.length - 1][0]},${y(min)} L${pts[0][0]},${y(min)} Z`, fill: `url(#ga${id})` }));
    svg.append(s("path", { class: "line", d, stroke: `url(#gl${id})` }));
  }
  const last = pts[pts.length - 1];
  if (last) svg.append(s("circle", { class: "halo", cx: last[0], cy: last[1], r: 8 }), s("circle", { class: "dot", cx: last[0], cy: last[1], r: 4 }));
  const step = Math.max(1, Math.ceil(n / 6));
  labels.forEach((t, i) => { if (i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.8)) svg.append(s("text", { x: x(i), y: H - 7, "text-anchor": i === n - 1 && n > 1 ? "end" : i === 0 && n > 1 ? "start" : "middle" }, t)); });
  return svg;
}
function barChart(values, labels, label) {
  const W = 320, H = 150, L = 8, R = 8, T = 18, B = 24, n = values.length, mx = Math.max(1, ...values), id = ++gid;
  const slot = (W - L - R) / n, bw = slot * 0.58;
  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label });
  svg.append(s("defs", {}, s("linearGradient", { id: `gb${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, stopS("0%", "--pink", 1), stopS("100%", "--violet", 0.85))));
  svg.append(s("line", { class: "grid", x1: L, x2: W - R, y1: H - B, y2: H - B }));
  values.forEach((v, i) => {
    const bh = Math.max(6, (v / mx) * (H - T - B)), bx = L + i * slot + (slot - bw) / 2;
    if (v > 0) {
      svg.append(s("rect", { x: bx, y: H - B - bh, width: bw, height: bh, rx: Math.min(8, bw / 2), fill: `url(#gb${id})` }));
      svg.append(s("text", { x: bx + bw / 2, y: H - B - bh - 4, "text-anchor": "middle" }, String(v)));
    }
    svg.append(s("text", { x: bx + bw / 2, y: H - 8, "text-anchor": "middle" }, labels[i]));
  });
  return svg;
}
async function energyChart(n) {
  const from = addDays(today(), -(n - 1));
  const rows = await q("SELECT tag, energie FROM tagesform WHERE tag >= ? ORDER BY tag", [from]);
  const map = new Map(rows.map((r) => [r.tag, r.energie]));
  const ds = Array.from({ length: n }, (_, i) => addDays(from, i));
  return { count: rows.length, svg: () => lineChart(ds.map((d) => map.get(d) ?? null), ds.map(deShort), { label: `Energie der letzten ${n} Tage` }) };
}
async function monthChart() {
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS[d.getMonth()] }); }
  const rows = await q("SELECT substr(start, 1, 7) AS m, count(*) AS n FROM schuebe WHERE start >= ? GROUP BY m", [months[0].key + "-01"]);
  const map = new Map(rows.map((r) => [r.m, r.n]));
  return barChart(months.map((m) => map.get(m.key) || 0), months.map((m) => m.label), "Schübe pro Monat der letzten 12 Monate");
}

// ---- shared pieces
const route = () => { const m = location.hash.replace(/^#\/?/, "").split("/"); return { name: m[0] || "home", id: m[1] }; };
const go = (hash) => { location.hash = hash; };
function setHeader(title, back) { $("title").textContent = title; $("back").hidden = !back; document.title = title; }
function flareRow(f) {
  const t = f.ende ? dayCount(len(f)) : `läuft seit ${days(len(f))}`;
  return h("button", { type: "button", class: "row-btn", onclick: () => go(`#/schub/${f.id}`) },
    h("span", {}, h("b", {}, de(f.start)), h("span", { class: "small muted" }, `${t} · ${symLine(f)}`)),
    h("span", { class: "score", "aria-label": `Stärke ${f.maxst} von 10` }, `${f.maxst}/10`));
}
function stat(v, l, icon) { return h("div", { class: "stat" }, h("i", { class: "ico", "aria-hidden": "true" }, icon || "💗"), h("b", {}, String(v)), h("span", {}, l)); }
const avgDur = (fl) => { const e = fl.filter((f) => f.ende); return e.length ? Math.round(e.reduce((a, f) => a + len(f), 0) / e.length) : 0; };
const last12 = (fl) => fl.filter((f) => f.start >= addDays(today(), -365));

// ---- home
const MOODS = [["gut", "😊", "Gut"], ["okay", "🙂", "Okay"], ["mau", "😕", "Mau"], ["schlecht", "😣", "Schlecht"]];
const RING = 100; // the ring fills toward 100 flare-free days
function ring(n) {
  const r = 40, c = 2 * Math.PI * r, f = Math.min(n, RING) / RING;
  return s("svg", { class: "ring", viewBox: "0 0 100 100", role: "img", "aria-label": `${days(n)} schubfrei, Ring bis ${RING} Tage` },
    s("circle", { class: "rt", cx: 50, cy: 50, r }), s("circle", { class: "rp", cx: 50, cy: 50, r, "stroke-dasharray": `${c * f} ${c}`, transform: "rotate(-90 50 50)" }),
    s("text", { x: 50, y: 52, "text-anchor": "middle", class: "rn" }, String(n)), s("text", { x: 50, y: 68, "text-anchor": "middle", class: "rl" }, n === 1 ? "Tag" : "Tage"));
}
async function renderHome() {
  setHeader("Schub-Tagebuch", false);
  const [flares, tf, en, months, openQ] = await Promise.all([loadFlares(), q("SELECT energie, gefuehl FROM tagesform WHERE tag = ?", [today()]), energyChart(14), monthChart(), q("SELECT count(*) AS n FROM fragen WHERE erledigt = 0")]);
  const running = flares.find((f) => !f.ende);
  const ended = flares.filter((f) => f.ende).sort((a, b) => (a.ende < b.ende ? 1 : -1))[0];
  let title, text, eyebrow = null, aside = h("img", { src: "hero.svg", alt: "" }), foot = null;
  if (running) { title = `Tag ${len(running)} im Schub`; text = "Ruh dich aus, du machst das gut."; eyebrow = h("span", { class: "eyebrow" }, h("span", { class: "pulse", "aria-hidden": "true" }), "Gerade läuft ein Schub"); }
  else if (!flares.length) { title = "Dein Schub-Tagebuch"; text = "Halte Schübe, Symptome und deine Tagesform fest. Alles bleibt auf diesem iPhone und hilft dir beim Termin."; }
  else {
    const n = diff(ended.ende, today());
    text = `Letzter Schub endete am ${de(ended.ende)}.`;
    if (n <= 0) title = "Schub vorbei 💗";
    else { title = `Seit ${days(n)} schubfrei`; eyebrow = h("span", { class: "eyebrow" }, "Schubfrei"); aside = ring(n); foot = h("p", { class: "ringnote" }, `Der Ring füllt sich bis ${RING} schubfreie Tage.`); }
  }
  const hero = h("section", { class: "card hero" }, h("div", {}, eyebrow, h("h2", {}, title), h("p", {}, text), foot), aside);
  const primary = h("button", { type: "button", class: "main", onclick: () => (running ? go(`#/schub/${running.id}`) : openSheet()) }, running ? "Heute zum Schub eintragen" : "Schub eintragen");

  // today's form
  let mood = tf[0]?.gefuehl || null, energy = tf[0]?.energie ?? 5;
  const range = h("input", { type: "range", id: "energie", min: 1, max: 10, step: 1, value: energy });
  const out = h("output", { for: "energie" }, `${energy}/10`);
  range.addEventListener("input", () => { energy = Number(range.value); out.textContent = `${energy}/10`; });
  const moodBtns = MOODS.map(([k, e, l]) => h("button", { type: "button", "aria-pressed": String(mood === k), onclick: () => { mood = k; moodBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(MOODS[i][0] === k))); } }, h("span", { class: "bubble", "aria-hidden": "true" }, e), l));
  const saved = h("p", { class: "small muted", role: "status" }, tf.length ? `Heute gespeichert: Energie ${tf[0].energie}/10${tf[0].gefuehl ? ", " + MOODS.find((m) => m[0] === tf[0].gefuehl)?.[2] : ""}.` : "Heute noch nicht eingetragen.");
  const form = h("section", { class: "card", id: "mood-card" }, h("h3", {}, "Wie geht’s dir heute?"), h("div", { class: "mood", role: "group", "aria-label": "Stimmung" }, moodBtns),
    h("label", { for: "energie", style: "margin-top:0" }, "Energie ", out), range,
    h("button", { type: "button", class: "main", style: "margin-top:.4rem", onclick: async () => {
      try {
        await phone.data.exec("INSERT INTO tagesform (tag, energie, gefuehl) VALUES (?, ?, ?) ON CONFLICT(tag) DO UPDATE SET energie = excluded.energie, gefuehl = excluded.gefuehl", [today(), energy, mood]);
        buzz("success"); widget(); toast("Gespeichert 💗");
        saved.textContent = `Heute gespeichert: Energie ${energy}/10${mood ? ", " + MOODS.find((m) => m[0] === mood)[2] : ""}.`;
      } catch (e) { quiet(e); }
    } }, "Tagesform speichern"), h("div", { style: "height:.6rem" }), saved);

  const parts = [hero, primary, form];
  if (flares.length) {
    const l12 = last12(flares), d = avgDur(flares);
    parts.push(h("section", { class: "stats", "aria-label": "Zahlen" }, stat(l12.length, "Schübe in 12 Monaten", "🌸"), stat(d ? dayCount(d) : "–", "Ø Dauer", "⏳"), stat(flares.filter((f) => f.kortison).length, "Kortison-Behandlungen", "💊"), stat(flares.length, "Schübe insgesamt", "📖")));
  }
  // charts
  const chartBox = h("div", { "aria-live": "polite" });
  const drawChart = () => {
    chartBox.replaceChildren(chartTab === "energie" ? (en.count < 2 ? emptyChart("Trag deine Tagesform an ein paar Tagen ein, dann siehst du hier den Verlauf.") : en.svg()) : (flares.length ? months : emptyChart("Sobald ein Schub eingetragen ist, siehst du ihn hier pro Monat.")));
  };
  const tabs = [["energie", "Energie, 14 Tage"], ["monate", "Schübe pro Monat"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": String(chartTab === k), onclick: () => { chartTab = k; tabs.forEach((b, i) => b.setAttribute("aria-pressed", String(["energie", "monate"][i] === k))); drawChart(); } }, l));
  drawChart();
  parts.push(h("section", { class: "card" }, h("div", { class: "seg", role: "group", "aria-label": "Diagramm" }, tabs), chartBox));
  // last flares
  parts.push(h("section", {}, h("h3", { class: "sec" }, "Letzte Schübe"),
    flares.length ? h("div", { class: "rows" }, flares.slice(0, 5).map(flareRow)) : h("div", { class: "card empty" }, "Noch kein Schub eingetragen. Das ist völlig in Ordnung. Wenn doch einer kommt, kannst du ihn hier festhalten.")));
  const oq = openQ[0].n;
  parts.push(h("div", { class: "links" }, h("button", { type: "button", onclick: () => go("#/arzt") }, h("span", {}, "Übersicht für den Arzttermin", oq ? h("small", {}, `${oq} offene ${oq === 1 ? "Frage" : "Fragen"}`) : null), h("span", { "aria-hidden": "true" }, "›")), h("button", { type: "button", onclick: () => go("#/alle") }, "Alle Schübe", h("span", { "aria-hidden": "true" }, "›"))));
  // settings
  const lockSw = h("input", { type: "checkbox", id: "lock-sw", role: "switch" });
  lockSw.checked = lockOn();
  lockSw.addEventListener("change", async () => {
    if (lockSw.checked) {
      try { await phone.auth.check("Schub-Tagebuch schützen"); localStorage.setItem("lock", "1"); toast("Face ID ist an."); buzz("success"); }
      catch (e) { lockSw.checked = false; toast(e.code === "NotAllowed" || e.code === "Unavailable" || e.code === "NotDeclared" ? "Face ID ist hier nicht verfügbar oder für dieses Tagebuch ausgeschaltet. Du kannst es in den Einstellungen des Spaces erlauben." : e.code === "Cancelled" ? "" : e.message); }
    } else { localStorage.removeItem("lock"); toast("Face ID ist aus."); }
  });
  parts.push(h("section", { class: "card" }, h("h3", {}, "Einstellungen"), h("label", { class: "switch", for: "lock-sw", style: "margin:0" }, "Mit Face ID schützen", lockSw), h("p", { class: "small muted", style: "margin-top:.4rem" }, "Das Tagebuch fragt beim Öffnen nach Face ID.")));
  view.replaceChildren(...parts);
}

// ---- all flares
async function renderAll() {
  setHeader("Alle Schübe", true);
  const flares = await loadFlares();
  view.replaceChildren(flares.length ? h("div", { class: "rows" }, flares.map(flareRow)) : h("div", { class: "card empty" }, "Noch kein Schub eingetragen."));
}

// ---- detail
const AUS = ["Unbekannt", "Infekt", "Stress", "Hitze", "Wenig Schlaf", "Zyklus", "Anderes"];
const PROMPT = "Was genau? Wo im Körper? Wie fühlt es sich an? Wie hat es angefangen?";
const grow = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };

// symptom chips with "+ Eigenes Symptom"; own symptoms carry a small × (only removable while no flare uses them)
function symPicker(selected, onToggle) {
  const box = h("div", { class: "chips", style: "margin:0" });
  const adder = () => {
    const open = h("button", { type: "button", class: "chip add" }, "+ Eigenes Symptom");
    open.addEventListener("click", () => {
      const input = h("input", { type: "text", maxlength: 40, placeholder: "Wie nennst du es?", "aria-label": "Eigenes Symptom", enterkeyhint: "done", autocomplete: "off" });
      const add = async () => {
        const name = input.value.trim().slice(0, 40);
        if (!name) { input.focus(); return; }
        try {
          await phone.data.exec("INSERT OR IGNORE INTO symptom_liste (name, emoji, ord, eigen) VALUES (?, '✏️', (SELECT max(100, coalesce(max(ord), 0) + 1) FROM symptom_liste), 1)", [name]);
          await loadSymList(true);
          if (!selected.has(name)) { await onToggle(name, true); selected.add(name); }
          buzz("success"); draw();
        } catch (e) { quiet(e); }
      };
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); add(); } });
      const row = h("div", { class: "own-row" }, input, h("button", { type: "button", class: "main", onclick: add }, "Hinzufügen"), h("button", { type: "button", class: "quiet", onclick: draw }, "Abbrechen"));
      open.replaceWith(row);
      input.focus();
    });
    return open;
  };
  function draw() {
    const kids = symList.map((y) => {
      const b = h("button", { type: "button", class: "chip", "aria-pressed": String(selected.has(y.name)) }, `${y.emoji} ${y.name}`);
      b.addEventListener("click", async () => {
        const on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(on));
        try { await onToggle(y.name, on); on ? selected.add(y.name) : selected.delete(y.name); } catch (e) { b.setAttribute("aria-pressed", String(!on)); quiet(e); }
      });
      if (!y.eigen) return b;
      const x = h("button", { type: "button", class: "chip-x", "aria-label": `Eigenes Symptom ${y.name} entfernen`, onclick: async () => {
        try {
          const u = await q("SELECT count(*) AS n FROM symptome WHERE name = ?", [y.name]);
          if (u[0].n > 0) { toast(`„${y.name}“ wird in einem Schub verwendet und bleibt deshalb in der Liste.`); return; }
          await phone.data.exec("DELETE FROM symptom_liste WHERE name = ? AND eigen = 1", [y.name]);
          selected.delete(y.name); await loadSymList(true); buzz("selection"); draw();
        } catch (e) { quiet(e); }
      } }, "×");
      return h("span", { class: "chip-own" }, b, x);
    });
    kids.push(adder());
    box.replaceChildren(...kids);
  }
  draw();
  return box;
}

async function renderDetail(id) {
  const [flares, vl, list] = await Promise.all([loadFlares(), q("SELECT tag, staerke, notiz FROM verlauf WHERE schub = ? ORDER BY tag DESC", [id]), loadSymList(true)]);
  const f = flares.find((x) => x.id === id);
  if (!f) { setHeader("Schub", true); view.replaceChildren(h("div", { class: "card empty" }, "Diesen Schub gibt es nicht mehr.")); return; }
  setHeader("Schub", true);
  const run = !f.ende, n = len(f);
  const own = new Set(f.syms.map((y) => y.name));
  const parts = [];
  const pills = [h("span", { class: "pill" }, `Am stärksten ${f.maxst}/10`)];
  if (f.ausloeser) pills.push(h("span", { class: "pill" }, `Auslöser: ${f.ausloeser}`));
  parts.push(h("section", { class: "card hero" }, h("div", {}, run ? h("span", { class: "eyebrow" }, h("span", { class: "pulse", "aria-hidden": "true" }), "Läuft noch") : null, h("h2", {}, `Seit ${de(f.start)}`), h("p", {}, run ? `Läuft seit ${days(n)}` : `${dayCount(n)}, endete am ${de(f.ende)}`)), h("img", { src: "hero.svg", alt: "" })));
  parts.push(h("div", { class: "pills" }, pills));

  // description: shown prominently, editable any time
  const descBody = h("div");
  const showDesc = () => {
    descBody.replaceChildren(
      f.beschreibung ? h("p", { class: "notes desc" }, f.beschreibung) : h("p", { class: "muted" }, "Noch nichts beschrieben. " + PROMPT),
      h("button", { type: "button", onclick: editDesc }, f.beschreibung ? "Bearbeiten" : "Beschreiben"));
  };
  const editDesc = () => {
    const ta = h("textarea", { id: "d-desc", class: "grow", rows: 5, placeholder: PROMPT, "aria-label": "Beschreibung" });
    ta.value = f.beschreibung || "";
    ta.addEventListener("input", () => grow(ta));
    descBody.replaceChildren(ta, h("div", { class: "row", style: "margin-top:.6rem" }, h("button", { type: "button", onclick: showDesc }, "Abbrechen"),
      h("button", { type: "button", class: "main", onclick: async () => {
        const v = ta.value.trim() || null;
        try { await phone.data.exec("UPDATE schuebe SET beschreibung = ? WHERE id = ?", [v, id]); f.beschreibung = v; buzz("success"); toast("Beschreibung gespeichert."); showDesc(); } catch (e) { quiet(e); }
      } }, "Speichern")));
    requestAnimationFrame(() => { grow(ta); ta.focus(); });
  };
  showDesc();
  parts.push(h("section", { class: "card", id: "desc-card" }, h("h3", {}, "Beschreibung"), descBody));

  if (run) {
    const todayRow = vl.find((v) => v.tag === today());
    let st = todayRow?.staerke ?? vl[0]?.staerke ?? f.staerke;
    const r = h("input", { type: "range", id: "d-st", min: 1, max: 10, step: 1, value: st });
    const o = h("output", { for: "d-st" }, `${st}/10`);
    r.addEventListener("input", () => { st = Number(r.value); o.textContent = `${st}/10`; });
    const ta = h("textarea", { id: "d-note", rows: 2, placeholder: "Notiz zum heutigen Tag (optional)" });
    parts.push(h("section", { class: "card", id: "today-card" }, h("h3", {}, "Heute eintragen"), h("label", { for: "d-st", style: "margin-top:0" }, "Stärke ", o), r, h("label", { for: "d-note" }, "Notiz"), ta,
      h("button", { type: "button", class: "main", style: "margin-top:.8rem", onclick: async () => {
        try {
          const note = ta.value.trim() || null;
          await phone.data.exec("INSERT INTO verlauf (schub, tag, staerke, notiz) VALUES (?, ?, ?, ?) ON CONFLICT(schub, tag) DO UPDATE SET staerke = excluded.staerke, notiz = coalesce(excluded.notiz, verlauf.notiz)", [id, today(), st, note]);
          buzz("success"); widget(); toast("Für heute eingetragen 💗"); ta.value = ""; await render(true);
        } catch (e) { quiet(e); }
      } }, todayRow ? "Heute aktualisieren" : "Heute speichern")));
  }

  // symptoms
  parts.push(h("section", { class: "card" }, h("h3", {}, "Symptome"), symPicker(own, (name, on) => (on
    ? phone.data.exec("INSERT OR IGNORE INTO symptome (schub, name) VALUES (?, ?)", [id, name])
    : phone.data.exec("DELETE FROM symptome WHERE schub = ? AND name = ?", [id, name])).then(() => buzz("selection")))));

  // course
  if (vl.length >= 2) {
    const asc = [...vl].reverse(), first = asc[0].tag, total = diff(first, asc[asc.length - 1].tag) + 1, ds = Array.from({ length: total }, (_, i) => addDays(first, i)), map = new Map(asc.map((v) => [v.tag, v.staerke]));
    parts.push(h("section", { class: "card" }, h("h3", {}, "Verlauf"), lineChart(ds.map((d) => map.get(d) ?? null), ds.map(deShort), { label: "Stärke pro Tag" })));
  }

  // treatment
  const tog = (label, col, id2) => {
    const c = h("input", { type: "checkbox", id: id2, role: "switch" }); c.checked = !!f[col];
    c.addEventListener("change", async () => { try { await phone.data.exec(`UPDATE schuebe SET ${col} = ? WHERE id = ?`, [c.checked ? 1 : 0, id]); buzz("selection"); } catch (e) { c.checked = !c.checked; quiet(e); } });
    return h("label", { class: "tog", for: id2 }, label, c);
  };
  parts.push(h("section", { class: "card" }, h("h3", {}, "Behandlung"), tog("Neurologin informiert", "arzt", "t-arzt"), tog("Kortison-Stoßtherapie", "kortison", "t-kort"), tog("MRT gemacht", "mrt", "t-mrt")));

  // days
  if (vl.length) parts.push(h("section", { class: "card" }, h("h3", {}, "Tage"), vl.map((v) => h("div", { class: "day" }, h("div", { class: "head" }, h("span", {}, rel(v.tag)), h("span", { class: "pill" }, `${v.staerke}/10`)), v.notiz ? h("p", { class: "small muted notes", style: "margin:.2rem 0 0" }, v.notiz) : null))));

  // dated notes
  const ta2 = h("textarea", { id: "add-note", rows: 2, placeholder: "Was möchtest du ergänzen?", "aria-label": "Notiz ergänzen" });
  parts.push(h("section", { class: "card" }, h("h3", {}, "Verlauf-Notizen"), f.notiz ? h("p", { class: "notes small" }, f.notiz) : h("p", { class: "muted small" }, "Noch keine Notizen."), ta2,
    h("button", { type: "button", style: "margin-top:.6rem", onclick: async () => {
      const t = ta2.value.trim(); if (!t) return;
      try { await phone.data.exec("UPDATE schuebe SET notiz = CASE WHEN notiz IS NULL OR notiz = '' THEN ? ELSE notiz || char(10) || ? END WHERE id = ?", [`${deShort(today())} ${t}`, `${deShort(today())} ${t}`, id]); buzz("success"); ta2.value = ""; await render(true); } catch (e) { quiet(e); }
    } }, "Notiz ergänzen")));

  // end / reopen
  if (run) {
    const end = h("input", { type: "date", id: "d-end", value: today(), min: f.start });
    parts.push(h("section", { class: "card", id: "end-card" }, h("h3", {}, "Ist der Schub vorbei?"), h("label", { for: "d-end", style: "margin-top:0" }, "Ende am"), end,
      h("button", { type: "button", class: "main", style: "margin-top:.8rem", onclick: async () => {
        const e = end.value || today();
        if (e < f.start) { toast("Das Ende kann nicht vor dem Beginn liegen."); return; }
        try { await phone.data.exec("UPDATE schuebe SET ende = ? WHERE id = ?", [e, id]); buzz("success"); widget(); confetti(); toast("Schön, dass es vorbei ist 💗"); await render(true); } catch (er) { quiet(er); }
      } }, "Schub ist vorbei 💗")));
  } else {
    parts.push(h("button", { type: "button", class: "quiet", onclick: async () => { try { await phone.data.exec("UPDATE schuebe SET ende = NULL WHERE id = ?", [id]); widget(); buzz("selection"); await render(true); } catch (e) { quiet(e); } } }, "Doch noch nicht vorbei"));
  }
  parts.push(h("button", { type: "button", class: "linkdel", onclick: () => askDelete(id) }, "Schub löschen"));
  view.replaceChildren(...parts);
}
function askDelete(id) {
  const dlg = $("confirm");
  $("confirm-no").onclick = () => dlg.close();
  $("confirm-yes").onclick = async () => {
    try {
      await phone.data.batch([{ sql: "DELETE FROM symptome WHERE schub = ?", params: [id] }, { sql: "DELETE FROM verlauf WHERE schub = ?", params: [id] }, { sql: "DELETE FROM schuebe WHERE id = ?", params: [id] }]);
      dlg.close(); widget(); buzz("success"); toast("Schub gelöscht."); history.length > 1 ? history.back() : go("#/");
    } catch (e) { dlg.close(); quiet(e); }
  };
  dlg.showModal();
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fx = $("fx"), glyphs = ["💗", "💖", "🌸", "✨", "💕"];
  for (let i = 0; i < 18; i++) fx.append(h("i", { style: `left:${Math.random() * 95}%;font-size:${1 + Math.random() * 1.2}rem;animation-delay:${Math.random() * 0.5}s` }, glyphs[i % glyphs.length]));
  setTimeout(() => fx.replaceChildren(), 3200);
}

// ---- doctor overview
function questionsCard(fragen) {
  const ta = h("textarea", { id: "q-new", rows: 2, placeholder: "Was möchtest du die Neurologin fragen?", "aria-label": "Neue Frage" });
  const items = fragen.map((fr) => {
    const cb = h("input", { type: "checkbox", id: `q-${fr.id}` }); cb.checked = !!fr.erledigt;
    const txt = h("span", { class: fr.erledigt ? "done" : "" }, fr.text);
    cb.addEventListener("change", async () => { try { await phone.data.exec("UPDATE fragen SET erledigt = ? WHERE id = ?", [cb.checked ? 1 : 0, fr.id]); txt.className = cb.checked ? "done" : ""; buzz("selection"); } catch (e) { cb.checked = !cb.checked; quiet(e); } });
    return h("div", { class: "frage" }, h("label", { class: "fl", for: `q-${fr.id}` }, cb, txt),
      h("button", { type: "button", class: "icon", "aria-label": `Frage löschen: ${fr.text}`, onclick: async () => { try { await phone.data.exec("DELETE FROM fragen WHERE id = ?", [fr.id]); buzz("selection"); await render(true); } catch (e) { quiet(e); } } }, "×"));
  });
  return h("section", { class: "card", id: "fragen-card" }, h("h3", {}, "Fragen für den nächsten Termin"),
    items.length ? h("div", {}, items) : h("p", { class: "muted small" }, "Schreib auf, was dir einfällt, dann hast du es beim Termin parat."), ta,
    h("button", { type: "button", style: "margin-top:.6rem", onclick: async () => {
      const t = ta.value.trim(); if (!t) { ta.focus(); return; }
      try { await phone.data.exec("INSERT INTO fragen (text) VALUES (?)", [t]); buzz("success"); ta.value = ""; await render(true); } catch (e) { quiet(e); }
    } }, "Frage hinzufügen"));
}
async function renderDoc() {
  setHeader("Für den Arzttermin", true);
  const [flares, symStats, en30, fragen] = await Promise.all([loadFlares(), q("SELECT l.name AS name, l.emoji AS emoji, count(*) AS n FROM symptome y JOIN symptom_liste l ON l.name = y.name GROUP BY l.name ORDER BY n DESC, l.ord"), energyChart(30), q("SELECT id, text, erledigt FROM fragen ORDER BY erledigt, erstellt, rowid")]);
  const avg = await q("SELECT round(avg(energie), 1) AS a FROM tagesform WHERE tag > ?", [addDays(today(), -30)]);
  const parts = [h("p", { class: "info" }, "Alle Schübe auf einen Blick: wann, wie lange, wie stark, welche Symptome und was behandelt wurde.")];
  const d = avgDur(flares), a = avg[0]?.a;
  const first = flares.length ? flares[flares.length - 1].start : null;
  parts.push(h("section", { class: "stats" }, stat(flares.length, first ? `Schübe seit ${de(first)}` : "Schübe gesamt", "📖"), stat(last12(flares).length, "Letzte 12 Monate", "🌸"), stat(d ? dayCount(d) : "–", "Ø Dauer", "⏳"), stat(a ? `${a}/10` : "–", "Ø Energie, 30 Tage", "🔋")));
  parts.push(questionsCard(fragen));
  if (symStats.length) {
    const mx = symStats[0].n;
    parts.push(h("section", { class: "card" }, h("h3", {}, "Häufigste Symptome"), h("div", { class: "bars" }, symStats.map((y) => h("div", { class: "hbar" }, h("div", { class: "t" }, h("span", {}, `${y.emoji} ${y.name}`), h("b", {}, `${y.n}×`)), h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(y.n / mx) * 100}%` })))))));
  }
  if (flares.length) {
    parts.push(h("section", { class: "card" }, h("h3", {}, "Alle Schübe"), flares.map((f) => h("div", { class: "block" },
      h("b", {}, `${de(f.start)}${f.ende ? " bis " + de(f.ende) : ", läuft noch"}`),
      h("div", { class: "small" }, `${dayCount(len(f))} · stärkster Tag ${f.maxst}/10`),
      h("div", { class: "small" }, `Symptome: ${f.syms.length ? f.syms.map((y) => y.name).join(", ") : "keine gewählt"}`),
      h("div", { class: "small" }, `Kortison: ${f.kortison ? "ja" : "nein"} · MRT: ${f.mrt ? "ja" : "nein"} · Auslöser: ${f.ausloeser || "unbekannt"}`),
      f.beschreibung ? h("div", { class: "small notes" }, h("b", {}, "Beschreibung: "), f.beschreibung) : null,
      f.notiz ? h("div", { class: "small muted notes" }, f.notiz) : null))));
  } else parts.push(h("div", { class: "card empty" }, "Noch kein Schub eingetragen."));
  if (en30.count >= 2) parts.push(h("section", { class: "card" }, h("h3", {}, "Energie, letzte 30 Tage"), en30.svg()));
  parts.push(h("button", { type: "button", class: "main", onclick: async () => {
    try { await phone.share({ text: summary(flares, symStats, a, fragen) }); }
    catch (e) { if (!["Cancelled", "NotAllowed", "NotDeclared"].includes(e.code)) toast(e.message); else if (e.code !== "Cancelled") toast("Teilen ist für dieses Tagebuch ausgeschaltet."); }
  } }, "Als Text teilen"));
  view.replaceChildren(...parts);
}
function summary(flares, symStats, a, fragen) {
  const L = ["Schub-Tagebuch, Stand " + de(today()), ""];
  L.push(`Schübe insgesamt: ${flares.length}${flares.length ? " (seit " + de(flares[flares.length - 1].start) + ")" : ""}`, `Letzte 12 Monate: ${last12(flares).length}`);
  const d = avgDur(flares); if (d) L.push(`Durchschnittliche Dauer: ${dayCount(d)}`);
  if (a) L.push(`Durchschnittliche Energie (30 Tage): ${a}/10`);
  const open = fragen.filter((x) => !x.erledigt);
  if (open.length) { L.push("", "Meine Fragen:"); for (const x of open) L.push(`- ${x.text.replace(/\n/g, " ")}`); }
  if (symStats.length) { L.push("", "Häufigste Symptome:"); for (const y of symStats.slice(0, 6)) L.push(`- ${y.name}: ${y.n}×`); }
  for (const f of flares) {
    L.push("", `${de(f.start)}${f.ende ? " bis " + de(f.ende) : " (läuft noch)"}, ${dayCount(len(f))}, stärkster Tag ${f.maxst}/10`,
      `  Symptome: ${f.syms.length ? f.syms.map((y) => y.name).join(", ") : "keine gewählt"}`,
      `  Kortison: ${f.kortison ? "ja" : "nein"}, MRT: ${f.mrt ? "ja" : "nein"}, Auslöser: ${f.ausloeser || "unbekannt"}`);
    if (f.beschreibung) L.push("  Beschreibung: " + f.beschreibung.replace(/\n/g, "\n    "));
    if (f.notiz) L.push("  Notizen: " + f.notiz.replace(/\n/g, "; "));
  }
  return L.join("\n");
}

// ---- new flare sheet
const sheet = $("sheet");
let nAus = "Unbekannt", nSym = new Set();
async function openSheet() {
  await loadSymList(true).catch(quiet);
  $("neu").reset(); nAus = "Unbekannt"; nSym = new Set();
  $("n-start").value = today(); $("n-start").max = today(); $("n-staerke-v").textContent = "5/10"; $("n-notiz").style.height = "";
  const auts = AUS.map((a) => h("button", { type: "button", class: "chip", "aria-pressed": String(a === nAus), onclick: (e) => { nAus = a; auts.forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } }, a));
  $("n-aus").replaceChildren(...auts);
  $("n-sym").replaceChildren(symPicker(nSym, async () => {}));
  sheet.showModal();
}
$("n-notiz").addEventListener("input", (e) => grow(e.target));
$("sheet-close").addEventListener("click", () => sheet.close());
sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
$("n-staerke").addEventListener("input", () => { $("n-staerke-v").textContent = `${$("n-staerke").value}/10`; });
$("neu").addEventListener("submit", async (e) => {
  e.preventDefault();
  const start = $("n-start").value || today(), st = Number($("n-staerke").value), id = hex16(), desc = $("n-notiz").value.trim() || null;
  const batch = [{ sql: "INSERT INTO schuebe (id, start, staerke, ausloeser, beschreibung) VALUES (?, ?, ?, ?, ?)", params: [id, start, st, nAus === "Unbekannt" ? null : nAus, desc] }];
  for (const name of nSym) batch.push({ sql: "INSERT OR IGNORE INTO symptome (schub, name) VALUES (?, ?)", params: [id, name] });
  batch.push({ sql: "INSERT INTO verlauf (schub, tag, staerke) VALUES (?, ?, ?)", params: [id, start, st] });
  try { await phone.data.batch(batch); buzz("success"); widget(); sheet.close(); go(`#/schub/${id}`); render(true); } catch (er) { quiet(er); }
});

// ---- routing and render
let focusTarget = null;
function applyFocus() {
  const t = focusTarget; if (!t) return;
  focusTarget = null;
  const el = $({ mood: "mood-card", "noch-da": "today-card", vorbei: "end-card" }[t]);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  el.querySelector("input, button")?.focus({ preventScroll: true });
}
async function render(keep) {
  const token = ++renderToken, r = route(), y = scrollY;
  view.classList.remove("enter");
  if (!keep) view.classList.add("enter");
  try {
    if (r.name === "schub" && r.id) await renderDetail(r.id);
    else if (r.name === "alle") await renderAll();
    else if (r.name === "arzt") await renderDoc();
    else await renderHome();
  } catch (e) { if (token === renderToken) quiet(e); return; }
  if (token === renderToken) { Array.from(view.children).forEach((c, i) => c.style.setProperty("--i", Math.min(i, 8))); scrollTo(0, keep ? y : 0); applyFocus(); }
}
function reload() {
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.type !== "checkbox" && a.type !== "range" && a.value) return; // don't wipe what is being typed
  render(true);
}
window.addEventListener("hashchange", () => { toast(""); render(false); });
$("back").addEventListener("click", () => (history.length > 1 ? history.back() : go("#/")));

// ---- Face ID lock
const lockOn = () => localStorage.getItem("lock") === "1";
let locked = false, authing = false, quietUntil = 0;
function lock() {
  if (!lockOn() || locked) return;
  locked = true; $("lock").hidden = false; $("app").inert = true; $("lock-text").textContent = "Gesperrt. Mit Face ID öffnest du dein Tagebuch.";
  if (sheet.open) sheet.close();
}
async function unlock() {
  if (authing) return; authing = true;
  try {
    await phone.auth.check("Schub-Tagebuch öffnen");
    locked = false; $("lock").hidden = true; $("app").inert = false; quietUntil = Date.now() + 2000; reload(); if (started) runIntent();
  } catch (e) {
    $("lock-text").textContent = e.code === "NotAllowed" || e.code === "Unavailable" || e.code === "NotDeclared" ? "Face ID ist gerade nicht verfügbar. Schalte es in den Einstellungen des Spaces ein oder wähle einen anderen Weg, dein iPhone zu entsperren." : e.code === "Cancelled" ? "Abgebrochen. Tippe auf Entsperren, um es noch einmal zu versuchen." : e.message;
  } finally { authing = false; }
}
$("unlock").addEventListener("click", unlock);

// ---- widget buttons and phone actions: phone.on("notification", {page}) and phone.on("action", {id})
let started = false, intent = null;
function takeIntent(kind) { intent = kind; if (started && !locked) runIntent(); }
async function runIntent() {
  const k = intent; intent = null; if (!k) return;
  try {
    if (k === "neu") { await openSheet(); return; }
    if (k === "tagesform") { focusTarget = "mood"; if (route().name === "home") render(true); else go("#/"); return; }
    const run = await q("SELECT id FROM schuebe WHERE ende IS NULL ORDER BY start DESC LIMIT 1");
    if (!run.length) { toast("Gerade läuft kein Schub."); if (route().name !== "home") go("#/"); return; }
    focusTarget = k; // "noch-da" or "vorbei"
    const target = `#/schub/${run[0].id}`;
    if (location.hash === target) render(true); else go(target);
  } catch (e) { quiet(e); }
}
const INTENTS = { "noch-da": "noch-da", vorbei: "vorbei", neu: "neu", tagesform: "tagesform", "neuer-schub": "neu" };
phone.on("notification", (n) => { const k = INTENTS[n?.page]; if (k) takeIntent(k); });
phone.on("action", (a) => { const k = INTENTS[a?.id]; if (k) takeIntent(k); });

// ---- start
phone.on("rows", () => { if (!locked) reload(); });
phone.on("resume", () => { if (authing || Date.now() < quietUntil) return; if (lockOn()) lock(); else reload(); });
phone.ready.then(async () => { if (lockOn()) lock(); await render(false); started = true; if (!locked) runIntent(); }, quiet);
