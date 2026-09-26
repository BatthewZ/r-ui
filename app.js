/* Dashboard mockup: seeded fake data plus plain-DOM rendering. No framework.
   Charts are drawn at their real pixel size and redrawn by a ResizeObserver,
   so a density switch (which changes --CHART-H) or a container change
   redraws them without any extra wiring. All colour comes from CSS classes
   that read tokens, so a scheme switch never needs a redraw. */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- DOM utils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const slot = (n) => $(`[data-slot="${n}"]`);
  const SVGNS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  /* Text always goes in via textContent: labels are data, never markup. */
  function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  }
  function icon(name, attrs = {}) {
    const s = svgEl("svg", { class: "icon", "aria-hidden": "true", ...attrs });
    svgEl("use", { href: `#i-${name}` }, s);
    return s;
  }

  /* ---------------------------------------------------------------- formatting */
  const fmtCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const fmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = (d) => String(d.getHours()).padStart(2, "0") + ":00";
  const md = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const ago = (min) => (min < 60 ? `${min}m ago` : min < 1440 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`);

  /* Canvas text measurement, so axis margins fit their labels exactly. */
  const mctx = document.createElement("canvas").getContext("2d");
  function measure(text, px) {
    mctx.font = `${px}px ${getComputedStyle(document.body).fontFamily}`;
    return mctx.measureText(text).width;
  }

  /* ---------------------------------------------------------------- seeded RNG */
  function rngFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- state */
  const VIEW_KEY = "rd-view";
  const view = { density: "comfortable", scheme: "auto", input: "auto" };
  try {
    Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || "{}"));
  } catch {}
  const state = { range: "7d", region: "all", env: "production", sort: { key: "status", dir: "desc" } };

  /* ---------------------------------------------------------------- data */
  const NOW = new Date(2026, 8, 26, 14, 0, 0);
  const REGIONS = ["us-east", "eu-west", "ap-south", "sa-east"];
  const REGION_BASE = [1850, 1320, 880, 410];
  const ERROR_CLASSES = ["5xx server", "4xx client", "Timeouts"];

  const RANGES = {
    "24h": { n: 24, stepH: 1, label: (d) => `${DAYS[d.getDay()]} ${hh(d)}`, tick: (d) => hh(d), err: "hour" },
    "7d": { n: 42, stepH: 4, label: (d) => `${DAYS[d.getDay()]} ${md(d)}, ${hh(d)}`, tick: (d) => (d.getHours() === 0 ? DAYS[d.getDay()] : ""), err: "day" },
    "30d": { n: 30, stepH: 24, label: (d) => `${DAYS[d.getDay()]} ${md(d)}`, tick: (d) => md(d), err: "day" },
    "90d": { n: 90, stepH: 24, label: (d) => `${DAYS[d.getDay()]} ${md(d)}`, tick: (d) => (d.getDay() === 1 ? md(d) : ""), err: "week" },
  };

  function buckets(n, stepH) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(NOW);
      if (stepH >= 24) d.setHours(0);
      else d.setHours(Math.floor(d.getHours() / stepH) * stepH); // align 4h buckets to midnight
      d.setHours(d.getHours() - i * stepH);
      out.push(d);
    }
    return out;
  }

  function generate() {
    const r = rngFrom(`${state.range}|${state.env}`);
    const cfg = RANGES[state.range];
    const envScale = state.env === "staging" ? 0.06 : 1;
    const regionIdx = state.region === "all" ? null : Number(state.region);
    const share = regionIdx == null ? 1 : REGION_BASE[regionIdx] / REGION_BASE.reduce((a, b) => a + b, 0);

    // Traffic: daily and weekly seasonality, a slow trend, and noise.
    const dates = buckets(cfg.n, cfg.stepH);
    const traffic = REGIONS.map((name, ri) => {
      const phase = ri * 2.2; // regions peak at different local times
      const values = dates.map((d, i) => {
        const hour = d.getHours() + (cfg.stepH >= 24 ? 12 : 0);
        const daily = cfg.stepH >= 24 ? 1 : 1 + 0.38 * Math.sin(((hour - 8 + phase) / 24) * Math.PI * 2);
        const weekly = d.getDay() === 0 || d.getDay() === 6 ? 0.78 : 1;
        const trend = 0.9 + 0.12 * (i / cfg.n);
        const noise = 0.94 + r() * 0.12;
        return Math.round(REGION_BASE[ri] * daily * weekly * trend * noise * envScale);
      });
      return { name, slot: ri + 1, values };
    });
    const shownTraffic = regionIdx == null ? traffic : [traffic[regionIdx]];

    // Error responses, bucketed coarser than traffic for long ranges.
    let eDates;
    if (cfg.err === "hour") eDates = buckets(24, 1);
    else if (cfg.err === "day") eDates = buckets(state.range === "7d" ? 7 : 30, 24);
    else eDates = buckets(13, 24 * 7);
    const perBucketH = cfg.err === "hour" ? 1 : cfg.err === "day" ? 24 : 168;
    const errors = ERROR_CLASSES.map((name, ci) => {
      const base = [38, 120, 11][ci];
      const values = eDates.map((_, i) => {
        const spike = ci === 0 && i >= eDates.length - 2 ? 2.8 + r() : 1; // the open checkout incident
        return Math.round(base * perBucketH * share * envScale * spike * (0.75 + r() * 0.5));
      });
      return { name, slot: ci + 1, values };
    });
    const errLabel = (d) => (cfg.err === "hour" ? `${DAYS[d.getDay()]} ${hh(d)}` : cfg.err === "day" ? `${DAYS[d.getDay()]} ${md(d)}` : `Week of ${md(d)}`);
    const errTick = (d) => (cfg.err === "hour" ? hh(d) : cfg.err === "day" ? (state.range === "7d" ? DAYS[d.getDay()] : md(d)) : md(d));

    // Heatmap: 5xx by weekday x hour (always the last 7 days).
    const heat = [1, 2, 3, 4, 5, 6, 0].map((dow) =>
      Array.from({ length: 24 }, (_, h) => {
        const busy = Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2)) * (dow === 0 || dow === 6 ? 0.55 : 1);
        const incident = dow === 5 && h >= 12 && h <= 14 ? 5 : 1; // Friday afternoon
        return Math.round((6 + busy * 40 + r() * 10) * incident * share * envScale + r() * 2);
      })
    );

    // KPI tiles: value, delta, the sentiment of that delta, and a 12-point trend.
    const walk = (start, drift, vol) => {
      const out = [start];
      for (let i = 1; i < 12; i++) out.push(Math.max(0, out[i - 1] * (1 + drift + (r() - 0.5) * vol)));
      return out;
    };
    const totalReq = shownTraffic.reduce((sum, s) => sum + s.values.reduce((a, v) => a + v * cfg.stepH * 3600, 0), 0);
    const kpis = [
      { label: "Requests", value: fmtCompact.format(totalReq), delta: 4.2 + r() * 2, unitD: "%", dir: "up", sentiment: "good", spark: walk(100, 0.01, 0.08) },
      { label: "Error rate", value: fmt2.format(0.38 + r() * 0.1), unit: "%", delta: -(0.05 + r() * 0.06), unitD: " pp", dir: "down", sentiment: "good", spark: walk(100, -0.02, 0.12) },
      { label: "p95 latency", value: fmtInt.format(176 + r() * 20), unit: "ms", delta: 9 + r() * 6, unitD: "%", dir: "up", sentiment: "bad", spark: walk(100, 0.015, 0.06) },
      { label: "Availability", value: "99.97", unit: "%", delta: 0, unitD: " pp", dir: "flat", sentiment: "flat", spark: walk(100, 0, 0.004) },
      { label: "Active users", value: fmtCompact.format((48200 + r() * 3000) * share * envScale), delta: 6.1 + r() * 2, unitD: "%", dir: "up", sentiment: "good", spark: walk(100, 0.012, 0.07) },
      { label: "CPU saturation", value: fmtInt.format(58 + r() * 10), unit: "%", delta: 3 + r() * 2, unitD: " pp", dir: "up", sentiment: "bad", spark: walk(100, 0.01, 0.05) },
    ];

    const services = [
      ["api-gateway", "Edge", 3120, 142, 0.21, 71, 180],
      ["auth", "Identity", 1480, 96, 0.08, 44, 2900],
      ["billing", "Payments", 212, 310, 0.34, 52, 12],
      ["checkout", "Payments", 388, 1240, 3.42, 77, 95],
      ["search", "Discovery", 940, 912, 0.62, 68, 40],
      ["inventory", "Commerce", 610, 188, 0.12, 39, 5200],
      ["notifications", "Messaging", 455, 230, 0.27, 33, 800],
      ["media-transcoder", "Media", 64, 640, 0.44, 91, 260],
      ["recommendations", "Discovery", 720, 410, 0.18, 62, 1500],
      ["ledger", "Payments", 180, 280, 0.09, 86, 3400],
      ["webhooks", "Platform", 305, 520, 1.12, 48, 610],
      ["analytics-ingest", "Data", 2240, 74, 0.05, 81, 7200],
      ["feature-flags", "Platform", null, null, null, null, 9800],
      ["geo-router", "Edge", 1990, 38, 0.02, 27, 11000],
    ].map(([name, owner, rps, p95, err, cpu, deploy]) => {
      const j = 0.9 + r() * 0.2;
      const s = { name, owner, rps: rps == null ? null : Math.round(rps * j * share * envScale), p95: p95 == null ? null : Math.round(p95 * j), err, cpu: cpu == null ? null : Math.round(cpu * j), deploy };
      s.status = rps == null ? "stale" : err > 2 ? "critical" : err > 1 || p95 > 800 ? "serious" : s.cpu > 80 || p95 > 500 ? "warning" : "good";
      return s;
    });

    const endpoints = [
      ["POST /v2/checkout", 1240],
      ["GET /search", 912],
      ["POST /media/transcode", 780],
      ["GET /v1/ledger/entries", 640],
      ["POST /webhooks/dispatch", 520],
      ["GET /recommendations", 410],
      ["POST /auth/token", 260],
      ["GET /inventory/:sku", 190],
    ].map(([name, ms]) => ({ name, ms: Math.round(ms * (0.92 + r() * 0.16)), calls: Math.round((20000 + r() * 400000) * share * envScale) }));

    return { dates, cfg, traffic: shownTraffic, eDates, errors, errLabel, errTick, heat, kpis, services, endpoints };
  }

  const INCIDENTS = [
    { status: "critical", title: "Elevated 5xx on checkout", service: "checkout", region: "eu-west", age: 14, who: "MR" },
    { status: "serious", title: "p95 regression in search after deploy 4f2a91c", service: "search", region: "all regions", age: 52, who: "JT" },
    { status: "warning", title: "Disk at 85% on ledger-db-2", service: "ledger", region: "us-east", age: 190, who: "AK" },
    { status: "warning", title: "TLS cert expires in 9 days: hooks.kestrel.dev", service: "webhooks", region: "global", age: 1440, who: "SP" },
  ];
  const SLOS = [
    { name: "checkout", target: "99.95%", left: 18 },
    { name: "search", target: "99.9%", left: 41 },
    { name: "api-gateway", target: "99.99%", left: 64 },
    { name: "billing", target: "99.95%", left: 77 },
    { name: "auth", target: "99.99%", left: 92 },
  ];
  const DEPLOYS = [
    { status: "progress", service: "search", ver: "4f2a91c", who: "@jt", age: 6 },
    { status: "good", service: "billing", ver: "v2.14.0", who: "@mia", age: 12 },
    { status: "critical", service: "checkout", ver: "v5.3.1", who: "@raf", age: 95, note: "rolled back" },
    { status: "good", service: "api-gateway", ver: "v9.0.2", who: "@devon", age: 180 },
    { status: "good", service: "media-transcoder", ver: "a81c02e", who: "@kim", age: 260 },
    { status: "good", service: "webhooks", ver: "v1.8.7", who: "@sp", age: 610 },
  ];
  const STATUS_LABEL = { good: "Healthy", warning: "Warning", serious: "Degraded", critical: "Critical", stale: "Stale" };
  const STATUS_RANK = { critical: 4, serious: 3, warning: 2, stale: 1, good: 0 };

  function statusBadge(status, label = STATUS_LABEL[status]) {
    return el("span", { class: "status", "data-status": status }, [icon(status), el("span", { text: label })]);
  }

  /* ---------------------------------------------------------------- tooltip */
  const tip = $(".tooltip");
  function showTip(title, rows, x, y) {
    tip.replaceChildren(
      el("div", { class: "tt-title", text: title }),
      ...rows.map((row) =>
        el("div", { class: "tt-row" }, [
          row.slot ? el("span", { class: `key key--${row.key || "line"} c${row.slot}` }) : el("span"),
          el("b", { text: row.value }),
          el("span", { text: row.name }),
        ])
      )
    );
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14;
    let top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }
  const hideTip = () => (tip.hidden = true);

  /* ---------------------------------------------------------------- sizing */
  const drawers = new Map();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) drawers.get(e.target)?.();
  });
  function mount(node, draw) {
    drawers.set(node, draw);
    ro.observe(node);
    draw();
  }

  function niceScale(max, count) {
    const raw = Math.max(max, 1) / count;
    const p = 10 ** Math.floor(Math.log10(raw));
    const f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(v);
    return { ticks, top };
  }

  /* Keep the labels that fit, always keeping the most recent one. */
  function pickTicks(n, tickAt, fs, plotW) {
    const cands = [];
    for (let i = 0; i < n; i++) if (tickAt(i)) cands.push(i);
    if (!cands.length) return [];
    const w = Math.max(...cands.map((i) => measure(tickAt(i), fs))) + fs * 1.5;
    const fit = Math.max(1, Math.floor(plotW / w));
    const k = Math.ceil(cands.length / fit);
    const out = [];
    for (let j = cands.length - 1; j >= 0; j -= k) out.push(cands[j]);
    return out.reverse();
  }

  function drawYAxis(svg, yTicks, y, l, r, W, fmt) {
    for (const v of yTicks) {
      const yy = Math.round(y(v)) + 0.5;
      svgEl("line", { class: v === 0 ? "baseline" : "gridline", x1: l, x2: W - r, y1: yy, y2: yy }, svg);
      svgEl("text", { class: "tick", x: l - 8, y: yy, "text-anchor": "end", dy: "0.32em" }, svg).textContent = fmt(v);
    }
  }
  function drawXAxis(svg, idxs, xAt, labelAt, yBase, l, W, fs) {
    for (const i of idxs) {
      const text = labelAt(i);
      const w = measure(text, fs);
      const x = Math.min(Math.max(xAt(i), l + w / 2), W - w / 2);
      svgEl("text", { class: "tick", x, y: yBase + fs * 1.45, "text-anchor": "middle" }, svg).textContent = text;
    }
  }

  /* Arrow keys move the readout: the same details as hover, per the a11y rule. */
  function keyboardReadout(host, n, show, hide) {
    let idx = null;
    host.onkeydown = (e) => {
      const map = { ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in map) idx = Math.min(n - 1, Math.max(0, (idx ?? n - 1) + map[e.key]));
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = n - 1;
      else if (e.key === "Escape") return hide();
      else return;
      e.preventDefault();
      show(idx, null);
    };
    host.onfocus = () => {
      if (host.matches(":focus-visible")) show((idx = idx ?? n - 1), null);
    };
    host.onblur = hide;
  }

  /* ---------------------------------------------------------------- line chart */
  function lineChart(host, { dates, label, tick, series, fmt }) {
    const n = dates.length;
    let hover = null;
    mount(host, () => {
      host.replaceChildren();
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (!W || !H) return;
      const fs = parseFloat(getComputedStyle(host).fontSize);
      const max = Math.max(...series.flatMap((s) => s.values));
      const { ticks, top } = niceScale(max, Math.max(2, Math.min(5, Math.floor(H / (fs * 4)))));
      const t = fs * 0.75;
      const b = fs * 2;
      const plotH = H - t - b;
      const y = (v) => t + plotH - (v / top) * plotH;

      // Direct end labels only when they will not collide; else the legend carries it.
      const ends = series.map((s) => ({ s, y: y(s.values[n - 1]) })).sort((a, c) => a.y - c.y);
      const clear = ends.every((e, i) => i === 0 || e.y - ends[i - 1].y >= fs * 1.25);
      const showEnd = series.length > 1 && series.length <= 4 && clear && W > 380;
      const l = Math.max(...ticks.map((v) => measure(fmt(v), fs))) + 10;
      const r = showEnd ? Math.max(...series.map((s) => measure(s.name, fs))) + 16 : 10;
      const plotW = W - l - r;
      const x = (i) => l + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));

      const svg = svgEl("svg", { width: W, height: H, "aria-hidden": "true" }, host);
      drawYAxis(svg, ticks, y, l, r, W, fmt);
      drawXAxis(svg, pickTicks(n, (i) => tick(dates[i]), fs, plotW), x, (i) => tick(dates[i]), t + plotH, l, W - r + (showEnd ? r - 10 : 0), fs);

      for (const s of series) {
        const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
        svgEl("path", { class: `line c${s.slot}`, d }, svg);
      }
      if (showEnd) {
        for (const { s, y: yy } of ends) {
          svgEl("circle", { class: `dot c${s.slot}`, cx: x(n - 1), cy: yy, r: 4 }, svg);
          svgEl("text", { class: "end-label", x: x(n - 1) + 9, y: yy, dy: "0.32em" }, svg).textContent = s.name;
        }
      }

      // Hover layer: crosshair snaps to the nearest X; one tooltip lists every series.
      const layer = svgEl("g", { visibility: "hidden" }, svg);
      const cross = svgEl("line", { class: "crosshair", y1: t, y2: t + plotH }, layer);
      const dots = series.map((s) => svgEl("circle", { class: `dot c${s.slot}`, r: 4 }, layer));
      const show = (i, ev) => {
        hover = i;
        const cx = Math.round(x(i)) + 0.5;
        cross.setAttribute("x1", cx);
        cross.setAttribute("x2", cx);
        series.forEach((s, k) => {
          dots[k].setAttribute("cx", x(i));
          dots[k].setAttribute("cy", y(s.values[i]));
        });
        layer.setAttribute("visibility", "visible");
        const box = host.getBoundingClientRect();
        const px = ev ? ev.clientX : box.left + x(i);
        const py = ev ? ev.clientY : box.top + t;
        showTip(label(dates[i]), series.map((s) => ({ slot: s.slot, value: fmt(s.values[i]), name: s.name })), px, py);
      };
      const hide = () => {
        hover = null;
        layer.setAttribute("visibility", "hidden");
        hideTip();
      };
      const hit = svgEl("rect", { class: "hit", x: l, y: t, width: plotW, height: plotH }, svg);
      hit.addEventListener("pointermove", (ev) => {
        const px = ev.clientX - host.getBoundingClientRect().left;
        show(Math.min(n - 1, Math.max(0, Math.round(((px - l) / plotW) * (n - 1)))), ev);
      });
      hit.addEventListener("pointerleave", hide);
      keyboardReadout(host, n, show, hide);
      if (hover != null && document.activeElement === host) show(hover, null);
    });
  }

  /* ---------------------------------------------------------------- stacked columns */
  function roundedTop(x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function stackedChart(host, { dates, label, tick, series, fmt }) {
    const n = dates.length;
    mount(host, () => {
      host.replaceChildren();
      host.classList.remove("is-hovering");
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (!W || !H) return;
      const fs = parseFloat(getComputedStyle(host).fontSize);
      const totals = dates.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
      const { ticks, top } = niceScale(Math.max(...totals), Math.max(2, Math.min(5, Math.floor(H / (fs * 4)))));
      const t = fs * 0.75;
      const b = fs * 2;
      const l = Math.max(...ticks.map((v) => measure(fmt(v), fs))) + 10;
      const r = 4;
      const plotW = W - l - r;
      const plotH = H - t - b;
      const y = (v) => t + plotH - (v / top) * plotH;
      const band = plotW / n;
      const colW = Math.min(24, Math.max(2, band * 0.64));
      const cx = (i) => l + band * i + band / 2;
      const base = t + plotH;

      const svg = svgEl("svg", { width: W, height: H, "aria-hidden": "true" }, host);
      drawYAxis(svg, ticks, y, l, r, W, fmt);
      drawXAxis(svg, pickTicks(n, (i) => tick(dates[i]), fs, plotW), cx, (i) => tick(dates[i]), base, l, W, fs);

      const cols = [];
      for (let i = 0; i < n; i++) {
        const g = svgEl("g", { class: "column" }, svg);
        cols.push(g);
        const x0 = cx(i) - colW / 2;
        let cursor = base;
        const drawn = series.filter((s) => s.values[i] > 0);
        drawn.forEach((s, k) => {
          const h = (s.values[i] / top) * plotH;
          const isTop = k === drawn.length - 1;
          const gap = isTop || h < 3 ? 0 : 2; // 2px surface gap between segments
          const segH = Math.max(0.5, h - gap);
          if (isTop) svgEl("path", { class: `seg-rect c${s.slot}`, d: roundedTop(x0, cursor - h, colW, segH, 4) }, g);
          else svgEl("rect", { class: `seg-rect c${s.slot}`, x: x0, y: cursor - segH, width: colW, height: segH }, g);
          cursor -= h;
        });
      }

      const show = (i, ev) => {
        cols.forEach((g, k) => g.classList.toggle("is-hot", k === i));
        host.classList.add("is-hovering");
        const box = host.getBoundingClientRect();
        const rows = [...series].reverse().map((s) => ({ slot: s.slot, key: "rect", value: fmt(s.values[i]), name: s.name }));
        rows.push({ value: fmt(totals[i]), name: "Total" });
        showTip(label(dates[i]), rows, ev ? ev.clientX : box.left + cx(i), ev ? ev.clientY : box.top + t);
      };
      const hide = () => {
        host.classList.remove("is-hovering");
        cols.forEach((g) => g.classList.remove("is-hot"));
        hideTip();
      };
      // Each band is the hit target: wider than the mark.
      for (let i = 0; i < n; i++) {
        const hit = svgEl("rect", { class: "hit", x: l + band * i, y: t, width: band, height: plotH }, svg);
        hit.addEventListener("pointermove", (ev) => show(i, ev));
        hit.addEventListener("pointerleave", hide);
      }
      keyboardReadout(host, n, show, hide);
    });
  }

  /* ---------------------------------------------------------------- sparkline */
  function sparkline(svg, values) {
    mount(svg, () => {
      svg.replaceChildren();
      const { width: W, height: H } = svg.getBoundingClientRect();
      if (!W || !H) return;
      const pad = 4;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const x = (i) => pad + (i * (W - pad * 2)) / (values.length - 1);
      const y = (v) => pad + (H - pad * 2) * (1 - (v - min) / (max - min || 1));
      const pts = values.map((v, i) => [x(i), y(v)]);
      const path = (p) => p.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
      svgEl("path", { class: "line", d: path(pts.slice(0, -1)) }, svg);
      svgEl("path", { class: "line line--now", d: path(pts.slice(-2)) }, svg);
      const [lx, ly] = pts[pts.length - 1];
      svgEl("circle", { class: "dot", cx: lx, cy: ly, r: 3 }, svg);
    });
  }

  /* ---------------------------------------------------------------- data table view */
  function dataTable(container, headers, rows) {
    const table = el("table", { class: "table table--plain" }, [
      el("thead", {}, el("tr", {}, headers.map((h, i) => el("th", { class: i ? "num" : null, scope: "col", text: h })))),
      el("tbody", {}, rows.map((row) => el("tr", {}, row.map((c, i) => el(i ? "td" : "th", { class: i ? "num" : null, scope: i ? null : "row", text: c }))))),
    ]);
    container.replaceChildren(table);
  }

  /* One series needs no legend: the card title already names it. */
  function legend(container, series, kind) {
    if (series.length < 2) return container.replaceChildren();
    container.replaceChildren(
      ...series.map((s) => el("span", { class: "legend-item" }, [el("span", { class: `key key--${kind} c${s.slot}` }), el("span", { text: s.name })]))
    );
  }

  /* ---------------------------------------------------------------- sections */
  function renderKpis(kpis) {
    const range = state.range;
    slot("kpis").replaceChildren(
      ...kpis.map((k) => {
        const spark = svgEl("svg", { class: "spark", "aria-hidden": "true" });
        const sign = k.delta > 0 ? "+" : k.delta < 0 ? "−" : "±";
        const deltaText = `${sign}${k.unitD === "%" ? fmt1.format(Math.abs(k.delta)) : fmt2.format(Math.abs(k.delta))}${k.unitD}`;
        const node = el("article", { class: "stat" }, [
          el("p", { class: "stat-label", text: k.label }),
          el("div", { class: "stat-main" }, [
            el("p", { class: "stat-value" }, [k.value, k.unit ? el("span", { class: "stat-unit", text: k.unit }) : null]),
            spark,
          ]),
          el("p", { class: "stat-delta", "data-sentiment": k.sentiment }, [
            icon(k.dir),
            deltaText,
            el("span", { text: `vs prior ${range}` }),
          ]),
        ]);
        queueMicrotask(() => sparkline(spark, k.spark));
        return node;
      })
    );
  }

  function renderHeat(heat) {
    const box = slot("heat");
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const max = Math.max(...heat.flat());
    const q = (v) => Math.min(7, 1 + Math.floor((v / (max + 1)) * 7));
    const cells = [];
    heat.forEach((row, d) => {
      cells.push(el("span", { class: "heat-day", text: days[d] }));
      row.forEach((v, h) => cells.push(el("span", { class: "heat-cell", "data-q": q(v), "data-d": d, "data-h": h, "data-v": v })));
    });
    cells.push(el("span"));
    for (const h of [0, 6, 12, 18]) cells.push(el("span", { class: "heat-hour", text: `${String(h).padStart(2, "0")}:00` }));
    box.replaceChildren(...cells);
    box.onpointerover = box.onpointermove = (ev) => {
      const c = ev.target.closest(".heat-cell");
      if (!c) return hideTip();
      const h = Number(c.dataset.h);
      showTip(`${days[c.dataset.d]} ${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00`, [{ value: fmtInt.format(c.dataset.v), name: "5xx errors" }], ev.clientX, ev.clientY);
    };
    box.onpointerleave = hideTip;
    dataTable(slot("heat-table"), ["Day", ...Array.from({ length: 24 }, (_, h) => `${h}h`)], heat.map((row, d) => [days[d], ...row.map((v) => fmtInt.format(v))]));
  }

  function renderSlow(endpoints) {
    const max = Math.max(...endpoints.map((e) => e.ms));
    const box = slot("slow");
    box.replaceChildren(
      ...endpoints.map((e, i) =>
        el("li", { class: "bar-row", "data-i": i }, [
          el("span", { class: "bar-name", text: e.name, title: e.name }),
          el("span", { class: "bar-track" }, [el("span", { class: "bar", style: `--p: ${e.ms / max}` }), el("span", { class: "bar-value", text: fmtInt.format(e.ms) })]),
        ])
      )
    );
    box.onpointermove = (ev) => {
      const row = ev.target.closest(".bar-row");
      if (!row) return hideTip();
      const e = endpoints[row.dataset.i];
      showTip(e.name, [{ value: `${fmtInt.format(e.ms)} ms`, name: "p95" }, { value: fmtCompact.format(e.calls), name: "calls" }], ev.clientX, ev.clientY);
    };
    box.onpointerleave = hideTip;
  }

  const COLS = [
    { key: "name", label: "Service" },
    { key: "status", label: "Status" },
    { key: "rps", label: "Req/s", num: true, cls: "col-rps" },
    { key: "p95", label: "p95 ms", num: true },
    { key: "err", label: "Errors", num: true, cls: "col-err" },
    { key: "cpu", label: "CPU", num: true, cls: "col-cpu" },
    { key: "deploy", label: "Last deploy", num: true, cls: "col-deploy" },
  ];
  function renderServices(services) {
    const { key, dir } = state.sort;
    const val = (s) => (key === "status" ? STATUS_RANK[s.status] : key === "name" ? s.name : s[key] ?? -1);
    const rows = [...services].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return (dir === "asc" ? c : -c) || a.name.localeCompare(b.name);
    });
    const dash = () => el("span", { class: "muted", text: "—" });
    const thead = el("thead", {}, el("tr", {}, COLS.map((c) => {
      const active = c.key === key;
      const btn = el("button", { class: "sort", type: "button" }, [c.label, icon(active && dir === "asc" ? "up" : "down")]);
      btn.onclick = () => {
        state.sort = { key: c.key, dir: active && dir === "desc" ? "asc" : c.num || c.key === "status" ? "desc" : "asc" };
        renderServices(services);
        $(`[data-slot="services"] th[aria-sort] .sort`)?.focus();
      };
      return el("th", { scope: "col", class: [c.num ? "num" : "", c.cls || ""].join(" ").trim() || null, "aria-sort": active ? (dir === "asc" ? "ascending" : "descending") : null }, btn);
    })));
    const tbody = el("tbody", {}, rows.map((s) => {
      const level = s.cpu >= 90 ? "critical" : s.cpu >= 80 ? "warning" : null;
      return el("tr", { "data-status": s.status }, [
        el("td", {}, [el("span", { class: "svc-name", text: s.name }), el("span", { class: "svc-owner", text: s.owner })]),
        el("td", {}, statusBadge(s.status, s.status === "stale" ? "No data" : undefined)),
        el("td", { class: "num col-rps" }, s.rps == null ? dash() : fmtInt.format(s.rps)),
        el("td", { class: "num" }, s.p95 == null ? dash() : fmtInt.format(s.p95)),
        el("td", { class: "num col-err" }, s.err == null ? dash() : `${fmt2.format(s.err)}%`),
        el("td", { class: "num col-cpu" }, s.cpu == null ? dash() : el("span", { class: "cpu" }, [el("span", { class: "meter", "data-level": level, style: `--v: ${s.cpu}%` }, el("i")), `${s.cpu}%`])),
        el("td", { class: "num col-deploy" }, ago(s.deploy)),
      ]);
    }));
    slot("services").replaceChildren(thead, tbody);

    const count = (st) => services.filter((s) => st.includes(s.status)).length;
    slot("service-counts").replaceChildren(
      ...[
        ["good", "Healthy", ["good"]],
        ["warning", "Warning", ["warning"]],
        ["critical", "Degraded", ["serious", "critical"]],
        ["stale", "Stale", ["stale"]],
      ].map(([st, labelText, set]) => el("span", { class: "mini", "data-status": st }, [icon(st), el("b", { text: String(count(set)) }), labelText]))
    );
  }

  function renderLists() {
    slot("incidents").replaceChildren(
      ...INCIDENTS.map((i) =>
        el("li", { class: "incident" }, [
          statusBadge(i.status),
          el("div", {}, [el("a", { class: "incident-title", href: "#", text: i.title }), el("p", { class: "meta", text: `${i.service} · ${i.region} · opened ${ago(i.age)}` })]),
          el("span", { class: "avatar avatar--sm", title: `Assigned to ${i.who}`, text: i.who }),
        ])
      )
    );
    $$('[data-bind="open-incidents"]').forEach((n) => (n.textContent = String(INCIDENTS.length)));

    slot("slo").replaceChildren(
      ...SLOS.map((s) => {
        const level = s.left < 25 ? "critical" : s.left < 50 ? "warning" : null;
        return el("li", { class: "slo" }, [
          el("span", { class: "slo-name" }, [s.name, el("span", { class: "slo-target", text: `target ${s.target}` })]),
          el("span", { class: "meter", "data-level": level, role: "meter", "aria-valuenow": s.left, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${s.name} error budget remaining` }, el("i", { style: `width: ${s.left}%` })),
          el("span", { class: "slo-value", text: `${s.left}%` }),
        ]);
      })
    );

    const DEPLOY_ICON = { good: ["good", "good"], critical: ["rollback", "critical"], progress: ["progress", "stale"] };
    slot("deploys").replaceChildren(
      ...DEPLOYS.map((d) => {
        const [ic, st] = DEPLOY_ICON[d.status];
        return el("li", { class: "deploy" }, [
          icon(ic, { "data-status": st }),
          el("div", {}, [
            el("span", { class: "sr-only", text: d.status === "progress" ? "In progress:" : d.status === "good" ? "Succeeded:" : "Rolled back:" }),
            el("p", { class: "deploy-what" }, [`${d.service} `, el("code", { text: d.ver })]),
            el("p", { class: "meta", text: `${d.note ? d.note + " · " : ""}${state.env} · ${d.who}` }),
          ]),
          el("time", { text: ago(d.age) }),
        ]);
      })
    );
  }

  function renderAll() {
    const data = generate();
    const { cfg } = data;
    renderKpis(data.kpis);

    legend(slot("traffic-legend"), data.traffic, "line");
    lineChart(slot("traffic"), { dates: data.dates, label: cfg.label, tick: cfg.tick, series: data.traffic, fmt: (v) => fmtCompact.format(v) });
    dataTable(slot("traffic-table"), ["Time", ...data.traffic.map((s) => s.name)], data.dates.map((d, i) => [cfg.label(d), ...data.traffic.map((s) => fmtInt.format(s.values[i]))]));

    legend(slot("errors-legend"), data.errors, "rect");
    stackedChart(slot("errors"), { dates: data.eDates, label: data.errLabel, tick: data.errTick, series: data.errors, fmt: (v) => fmtCompact.format(v) });
    dataTable(slot("errors-table"), ["Period", ...ERROR_CLASSES, "Total"], data.eDates.map((d, i) => [data.errLabel(d), ...data.errors.map((s) => fmtInt.format(s.values[i])), fmtInt.format(data.errors.reduce((a, s) => a + s.values[i], 0))]));

    renderHeat(data.heat);
    renderSlow(data.endpoints);
    renderServices(data.services);
    renderLists();

    const envPill = $('[data-bind="env-label"]');
    envPill.textContent = state.env;
    envPill.dataset.env = state.env;
    $('[data-bind="updated"]').textContent = `Updated ${hh(NOW).replace(":00", ":02")}`;
  }

  /* ---------------------------------------------------------------- view axes */
  const html = document.documentElement;
  const mq = {
    dark: matchMedia("(prefers-color-scheme: dark)"),
    coarse: matchMedia("(pointer: coarse)"),
    wide: matchMedia("(width >= 80rem)"),
    medium: matchMedia("(width >= 48rem)"),
  };

  function applyView() {
    html.dataset.density = view.density;
    if (view.scheme === "auto") delete html.dataset.scheme;
    else html.dataset.scheme = view.scheme;
    if (view.input === "auto") delete html.dataset.input;
    else html.dataset.input = view.input;
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {}
    syncControls();
    updateAxes();
  }

  function updateAxes() {
    const probe = getComputedStyle($(".probe"));
    const set = (k, v) => ($(`[data-axis="${k}"]`).textContent = v);
    set("layout", mq.wide.matches ? "wide · sidebar" : mq.medium.matches ? "medium · rail" : "narrow · bottom nav");
    set("scheme", view.scheme === "auto" ? `${mq.dark.matches ? "dark" : "light"} (OS)` : view.scheme);
    set("input", view.input === "auto" ? `${mq.coarse.matches ? "touch" : "mouse"} (device)` : `${view.input === "coarse" ? "touch" : "mouse"} (forced)`);
    set("density", view.density);
    set("row", probe.height);
    set("control", probe.width);
    set("body", probe.fontSize);
  }

  function syncControls() {
    const values = { ...view, range: state.range };
    for (const seg of $$(".seg[data-control]")) {
      const v = values[seg.dataset.control];
      for (const b of $$("button", seg)) b.setAttribute("aria-pressed", String(b.dataset.value === v));
    }
  }

  function refetch() {
    const board = $(".board");
    board.classList.add("is-loading");
    board.setAttribute("aria-busy", "true");
    setTimeout(() => {
      renderAll();
      board.classList.remove("is-loading");
      board.removeAttribute("aria-busy");
    }, 160);
  }

  for (const seg of $$(".seg[data-control]")) {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-value]");
      if (!b) return;
      const key = seg.dataset.control;
      if (key === "range") {
        if (state.range === b.dataset.value) return;
        state.range = b.dataset.value;
        syncControls();
        refetch();
      } else {
        view[key] = b.dataset.value;
        applyView();
      }
    });
  }
  for (const sel of $$("select[data-control]")) {
    sel.addEventListener("change", () => {
      state[sel.dataset.control] = sel.value;
      refetch();
    });
  }

  const viewBtn = $("#view-toggle");
  const panel = $("#view-panel");
  const setPanel = (open) => {
    panel.hidden = !open;
    viewBtn.setAttribute("aria-expanded", String(open));
    if (open) updateAxes();
  };
  viewBtn.addEventListener("click", () => setPanel(panel.hidden));
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !e.target.closest(".view-menu")) setPanel(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setPanel(false);
      viewBtn.focus();
    }
  });
  for (const m of Object.values(mq)) m.addEventListener("change", updateAxes);
  addEventListener("scroll", hideTip, { passive: true });

  applyView();
  renderAll();
})();
