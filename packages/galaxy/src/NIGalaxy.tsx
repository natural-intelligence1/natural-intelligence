// @ts-nocheck — ported 1:1 from the approved design (Main.dc.html, version 27). Type progressively; do not restyle.
/*
 * NI Living Galaxy — interactive 3D navigation of body systems and the expertise around them.
 * Client-only component (WebGL). Load with next/dynamic({ ssr: false }).
 */
import * as React from 'react';
import {
  AmbientLight, BackSide, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage,
  Euler, Float32BufferAttribute, Group, InstancedMesh, Line, LineBasicMaterial,
  LineLoop, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, NormalBlending,
  PerspectiveCamera, PlaneGeometry, PointLight, Points, Quaternion, Raycaster,
  Scene, ShaderMaterial, SphereGeometry, TorusGeometry, Vector2, Vector3,
  WebGLRenderer,
} from 'three';
// Named imports keep three.js tree-shakeable; the engine reads them through this namespace object.
const THREE = { AmbientLight, BackSide, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Euler, Float32BufferAttribute, Group, InstancedMesh, Line, LineBasicMaterial, LineLoop, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, NormalBlending, PerspectiveCamera, PlaneGeometry, PointLight, Points, Quaternion, Raycaster, Scene, ShaderMaterial, SphereGeometry, TorusGeometry, Vector2, Vector3, WebGLRenderer };
import { buildGalaxyData, PHRASES } from './data/galaxy-data';
import LOGO_POINTS from './data/logo-points.json';
import { css } from './css';

export const DEFAULT_MARK_SRC = '/galaxy/ni-mark-mask.png';

export interface NIGalaxyProps {
  /** Pixel height of the experience (min 560). Default 900. */
  height?: number;
  /** URL of the NI mark alpha mask used for the glow. Default /galaxy/ni-mark-mask.png */
  markSrc?: string;
  /** Rotating centre phrases. Default: approved list in data/galaxy-data.ts */
  phrases?: string[];
}

export default class NIGalaxy extends React.Component<NIGalaxyProps, any> {
  [k: string]: any;
  constructor(props) {
    super(props);
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    this.state = { w: 0, h: 0, ready: false, fallback: false, selected: null, discipline: null, hover: null,
      paused: reduced, reduced: reduced, speed: 1, moonsMode: 'featured', filter: 'all', perf: false, sheetOpen: false, announce: '' };
    var self = this;
    this.rootRef = function (el) { self.rootEl = el; };
    this.canvasRef = function (el) { self.canvasEl = el; };
    this.wpRef = function (el) { self.wpEl = el; };
    this.phraseRef = function (el) { self.phraseEl = el; };
    this.hudRef = function (el) { self.hudEl = el; };
    this.sigRef = function (el) { self.sigEl = el; if (el) self.drawSig(); };
    this.onKey = function (e) { if (e.key === 'Escape') { self.back(); } };
    this.back = function () {
      var s = self.state;
      if (s.discipline) self.setState({ discipline: null, hover: null, announce: 'Back to ' + self.nameOf(s.selected) });
      else if (s.selected) self.setState({ selected: null, hover: null, announce: 'Whole galaxy view' });
    };
    this.togglePause = function () { self.setState({ paused: !self.state.paused }); };
    this.onSpeed = function (e) { self.setState({ speed: Number(e.target.value) || 1 }); };
    this.onFilter = function (e) { self.setState({ filter: e.target.value }); };
    this.togglePerf = function () { self.setState({ perf: !self.state.perf }); };
    this.toggleSheet = function () {
      var s = self.state;
      if (s.selected || s.discipline) self.setState({ selected: null, discipline: null, sheetOpen: true, hover: null });
      else self.setState({ sheetOpen: !s.sheetOpen });
    };
    this.zoomIn = function () { self.engZoom(0.8); };
    this.zoomOut = function () { self.engZoom(1.25); };
    this.reset = function () { self.setState({ selected: null, discipline: null, hover: null, filter: 'all', announce: 'View reset' }); self.engReset(); };
    this.pickWhole = function () { self.select('whole'); };
    this.hoverWhole = function () { self.listHover('center', 'whole'); };
    this.unhover = function () { self.listHover(null); };
  }

  /* ---------------- organ & influence signatures (procedural fine-line art, drawn once per planet) ---------------- */
  drawMotif(g, id, cx, cy, s, color, lw) {
    var k = s / 2;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw / k; g.lineCap = 'round'; g.lineJoin = 'round';
    var P = Math.PI;
    var line = function (x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    var circ = function (x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, P * 2); if (fill) g.fill(); else g.stroke(); };
    var tree = function (x, y, a, len, d, spread, shrink) {
      if (d <= 0 || len < 0.02) return;
      var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = (lw / k) * (0.55 + d * 0.12); line(x, y, x2, y2);
      tree(x2, y2, a - spread, len * shrink, d - 1, spread * 0.92, shrink);
      tree(x2, y2, a + spread * 0.85, len * shrink * 0.94, d - 1, spread * 0.92, shrink);
    };
    var wave = function (y, amp, freq, x0, x1, ph) { g.beginPath(); for (var i = 0; i <= 60; i++) { var x = x0 + (x1 - x0) * i / 60; var yy = y + Math.sin(i / 60 * P * 2 * freq + (ph || 0)) * amp; if (i) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); };
    switch (id) {
      case 'cardio': // vascular tree
        tree(0, 0.95, -P / 2, 0.5, 6, 0.42, 0.7); tree(0, 0.95, P / 2 - 0.0001, 0.001, 1, 0, 0); break;
      case 'respiratory': // trachea and bronchial tree
        line(0, -0.95, 0, -0.4); tree(0, -0.4, P * 0.72, 0.36, 5, 0.42, 0.72); tree(0, -0.4, P * 0.28, 0.36, 5, 0.42, 0.72); break;
      case 'nervous': // neuron
        circ(-0.1, -0.25, 0.16);
        for (var i = 0; i < 6; i++) { var a = -P * 0.92 + i * 0.4; tree(-0.1 + Math.cos(a) * 0.16, -0.25 + Math.sin(a) * 0.16, a, 0.22, 3, 0.45, 0.7); }
        g.lineWidth = lw / k; g.beginPath(); g.moveTo(0.0, -0.12); g.bezierCurveTo(0.2, 0.1, 0.05, 0.45, 0.35, 0.68); g.stroke();
        tree(0.35, 0.68, 0.9, 0.12, 3, 0.6, 0.75); break;
      case 'endocrine': // gland cells
        var hex = function (x, y, r) { g.beginPath(); for (var j = 0; j <= 6; j++) { var a2 = P / 6 + j * P / 3; var px = x + Math.cos(a2) * r, py = y + Math.sin(a2) * r; if (j) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); };
        hex(0, 0, 0.2); for (var h = 0; h < 6; h++) { var a3 = h * P / 3; hex(Math.cos(a3) * 0.36, Math.sin(a3) * 0.36, 0.2); }
        circ(0, 0, 0.05, true); break;
      case 'digestive': // intestinal folds
        g.beginPath(); g.moveTo(-0.7, -0.75);
        for (var r = 0; r < 5; r++) { var y0 = -0.75 + r * 0.36, dir = r % 2 ? -1 : 1; g.lineTo(0.62 * dir, y0); if (r < 4) g.arc(0.62 * dir, y0 + 0.18, 0.18, -P / 2, P / 2, dir < 0); }
        g.stroke(); break;
      case 'immune': // lymph node network
        var nd = [[-0.7, -0.5], [-0.2, -0.75], [0.45, -0.55], [0.75, 0.05], [0.3, 0.6], [-0.35, 0.5], [0, 0], [-0.75, 0.15]];
        [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 7], [7, 0], [6, 1], [6, 3], [6, 5], [6, 2]].forEach(function (e) { line(nd[e[0]][0], nd[e[0]][1], nd[e[1]][0], nd[e[1]][1]); });
        nd.forEach(function (n, i2) { circ(n[0], n[1], i2 === 6 ? 0.12 : 0.07, i2 !== 6); }); break;
      case 'renal': // kidney with nephron loop
        g.beginPath(); g.moveTo(0.1, -0.8); g.bezierCurveTo(-0.75, -0.95, -0.85, 0.95, 0.1, 0.8); g.bezierCurveTo(0.45, 0.72, 0.25, 0.25, 0.05, 0.1); g.bezierCurveTo(0.25, -0.1, 0.45, -0.72, 0.1, -0.8); g.stroke();
        circ(-0.38, -0.25, 0.09); g.beginPath(); g.moveTo(-0.3, -0.2); g.lineTo(-0.3, 0.35); g.arc(-0.2, 0.35, 0.1, P, 0, true); g.lineTo(-0.1, -0.1); g.stroke(); break;
      case 'muscular': // fusiform fibre bundle
        for (var f = -3; f <= 3; f++) { g.beginPath(); g.moveTo(-0.9, f * 0.02); g.quadraticCurveTo(0, f * 0.2, 0.9, f * 0.02); g.stroke(); }
        line(-0.95, 0, -0.9, 0); break;
      case 'skeletal': // vertebral column
        for (var v = 0; v < 6; v++) { var yv = -0.85 + v * 0.32; g.beginPath(); g.moveTo(-0.22, yv); g.quadraticCurveTo(0, yv - 0.06, 0.22, yv); g.lineTo(0.22, yv + 0.2); g.quadraticCurveTo(0, yv + 0.26, -0.22, yv + 0.2); g.closePath(); g.stroke(); line(0.22, yv + 0.1, 0.48, yv + 0.04); line(-0.22, yv + 0.1, -0.48, yv + 0.04); } break;
      case 'skin': // epidermal strata and follicles
        for (var w = 0; w < 4; w++) wave(-0.55 + w * 0.3, 0.05, 3, -0.85, 0.85, w);
        [-0.5, 0, 0.5].forEach(function (x) { line(x, -0.85, x + 0.05, 0.5); circ(x + 0.05, 0.58, 0.08); }); break;
      case 'reproductive': // follicle
        circ(0, 0, 0.18); circ(0, 0, 0.36); for (var c = 0; c < 12; c++) { var ac = c * P / 6; circ(Math.cos(ac) * 0.56, Math.sin(ac) * 0.56, 0.08); } circ(0, 0, 0.05, true); break;
      case 'sensory': // eye and sound
        g.beginPath(); g.moveTo(-0.8, 0); g.quadraticCurveTo(-0.1, -0.6, 0.6, 0); g.quadraticCurveTo(-0.1, 0.6, -0.8, 0); g.stroke();
        circ(-0.1, 0, 0.24); circ(-0.1, 0, 0.09, true);
        [0.25, 0.4, 0.55].forEach(function (r2) { g.beginPath(); g.arc(0.5, 0, r2, -0.6, 0.6); g.stroke(); }); break;
      case 'metabolism': // cycle
        circ(0, 0, 0.62); circ(0, 0, 0.28);
        for (var m = 0; m < 8; m++) { var am = m * P / 4; circ(Math.cos(am) * 0.62, Math.sin(am) * 0.62, 0.07, true); var aa = am + 0.32; line(Math.cos(aa) * 0.62, Math.sin(aa) * 0.62, Math.cos(aa - 0.12) * 0.72, Math.sin(aa - 0.12) * 0.72); } break;
      case 'biotrans': // filter and flow
        for (var b = -2; b <= 2; b++) { g.beginPath(); g.moveTo(b * 0.32, -0.85); g.quadraticCurveTo(b * 0.3, -0.1, b * 0.06, 0.2); g.lineTo(b * 0.06, 0.85); g.stroke(); }
        [[-0.5, -0.55], [0.15, -0.65], [0.45, -0.4], [-0.15, -0.35]].forEach(function (d) { circ(d[0], d[1], 0.05, true); }); break;
      case 'gutbrain': // brain, vagal line, gut
        g.beginPath(); g.arc(-0.18, -0.58, 0.26, P * 0.9, P * 2.05); g.arc(0.18, -0.58, 0.26, P * 0.95, P * 2.1); g.stroke();
        wave(-0.55, 0.04, 2, -0.38, 0.38);
        g.beginPath(); g.moveTo(0, -0.3); for (var q = 0; q <= 30; q++) { g.lineTo(Math.sin(q / 30 * P * 3) * 0.08, -0.3 + q / 30 * 0.62); } g.stroke();
        g.beginPath(); g.moveTo(-0.45, 0.45); g.arc(-0.3, 0.6, 0.15, P, 0); g.arc(0, 0.6, 0.15, P, 0, true); g.arc(0.3, 0.6, 0.15, P, 0); g.stroke(); break;
      case 'inflammation': // response and repair
        for (var z = 0; z < 14; z++) { var az = z * P / 7; line(Math.cos(az) * 0.42, Math.sin(az) * 0.42, Math.cos(az) * 0.72, Math.sin(az) * 0.72); }
        g.beginPath(); for (var t = 0; t <= 6; t++) { var at = t * P / 3; var px2 = Math.cos(at) * 0.26, py2 = Math.sin(at) * 0.26; if (t) g.lineTo(px2, py2); else g.moveTo(px2, py2); } g.stroke();
        line(-0.26, 0, 0.26, 0); line(-0.13, -0.22, 0.13, 0.22); line(0.13, -0.22, -0.13, 0.22); break;
      case 'hormonal': // feedback loops
        var tri = [[0, -0.62], [0.58, 0.4], [-0.58, 0.4]];
        tri.forEach(function (a4, i3) { var b4 = tri[(i3 + 1) % 3]; g.beginPath(); g.moveTo(a4[0], a4[1]); g.quadraticCurveTo((a4[0] + b4[0]) * 0.9, (a4[1] + b4[1]) * 0.9, b4[0], b4[1]); g.stroke(); g.beginPath(); g.moveTo(a4[0], a4[1]); g.quadraticCurveTo((a4[0] + b4[0]) * 0.2, (a4[1] + b4[1]) * 0.2, b4[0], b4[1]); g.stroke(); circ(a4[0], a4[1], 0.12, true); }); break;
      case 'circadian': // 24-hour dial, sun and moon
        circ(0, 0, 0.66); for (var hh = 0; hh < 24; hh++) { var ah = hh * P / 12; var l2 = hh % 6 ? 0.06 : 0.14; line(Math.cos(ah) * 0.66, Math.sin(ah) * 0.66, Math.cos(ah) * (0.66 - l2), Math.sin(ah) * (0.66 - l2)); }
        circ(0, -0.28, 0.12); g.beginPath(); g.arc(0, 0.3, 0.14, P * 0.3, P * 1.7); g.arc(0.07, 0.3, 0.11, P * 1.6, P * 0.4, true); g.stroke(); break;
      case 'nutrition': // leaf
        g.beginPath(); g.moveTo(-0.7, 0.7); g.quadraticCurveTo(-0.75, -0.6, 0.7, -0.7); g.quadraticCurveTo(0.6, 0.65, -0.7, 0.7); g.stroke();
        line(-0.7, 0.7, 0.5, -0.5); for (var n2 = 1; n2 < 6; n2++) { var tt = n2 / 6, x3 = -0.7 + 1.2 * tt, y3 = 0.7 - 1.2 * tt; line(x3, y3, x3 - 0.22, y3 - 0.3); line(x3, y3, x3 + 0.3, y3 + 0.2); } break;
      case 'movement': // flowing spiral
        g.beginPath(); for (var sp = 0; sp <= 120; sp++) { var as = sp / 120 * P * 4.2, rs = 0.05 + sp / 120 * 0.75; var xs = Math.cos(as) * rs, ys = Math.sin(as) * rs; if (sp) g.lineTo(xs, ys); else g.moveTo(xs, ys); } g.stroke(); break;
      case 'sleep': // crescent and stars
        g.beginPath(); g.arc(-0.1, 0.05, 0.55, P * 0.35, P * 1.65); g.arc(0.12, -0.05, 0.45, P * 1.55, P * 0.45, true); g.closePath(); g.stroke();
        [[0.55, -0.55, 0.12], [0.7, 0.05, 0.08], [0.35, 0.5, 0.07]].forEach(function (st) { line(st[0] - st[2], st[1], st[0] + st[2], st[1]); line(st[0], st[1] - st[2], st[0], st[1] + st[2]); }); break;
      case 'stress': // settling waves
        for (var sw = 0; sw < 5; sw++) wave(-0.6 + sw * 0.3, 0.2 * (1 - sw / 5) + 0.01, 2, -0.85, 0.85); break;
      case 'environment': // tree and roots
        line(0, 0.15, 0, -0.2); tree(0, -0.2, -P / 2, 0.28, 5, 0.5, 0.72); tree(0, 0.15, P / 2, 0.22, 4, 0.6, 0.7); line(-0.8, 0.15, 0.8, 0.15); break;
      case 'lifestyle': // interwoven rings
        circ(0, -0.25, 0.38); circ(-0.28, 0.22, 0.38); circ(0.28, 0.22, 0.38); break;
      default: circ(0, 0, 0.5);
    }
    g.restore();
  }
  motifTexture(id) {
    var T = THREE, c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var g = c.getContext('2d');
    g.shadowColor = 'rgba(255,255,255,1)'; g.shadowBlur = 16;   // soft halo baked into the alpha
    this.drawMotif(g, id, 128, 128, 190, '#ffffff', 3); this.drawMotif(g, id, 384, 128, 190, '#ffffff', 3);
    g.shadowBlur = 6;
    this.drawMotif(g, id, 128, 128, 190, '#ffffff', 3); this.drawMotif(g, id, 384, 128, 190, '#ffffff', 3);
    var tx = new T.CanvasTexture(c); tx.anisotropy = 4; return tx;
  }
  figureTexture() {
    var T = THREE, c = document.createElement('canvas'); c.width = 512; c.height = 512;
    var g = c.getContext('2d'), cx = 256;
    var halo = g.createRadialGradient(cx, 270, 10, cx, 270, 250);
    halo.addColorStop(0, 'rgba(201,166,107,0.22)'); halo.addColorStop(0.55, 'rgba(210,178,122,0.08)'); halo.addColorStop(1, 'rgba(210,178,122,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(156,122,68,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, 286, 214, 0, Math.PI * 2); g.stroke();
    var R = [[12, 146], [48, 168], [66, 186], [86, 236], [108, 290], [118, 318], [107, 322], [92, 288], [72, 240], [56, 214], [36, 292], [42, 334], [36, 404], [27, 468], [32, 484], [11, 484], [9, 406], [3, 354], [0, 352]];
    var pts = R.map(function (p) { return [cx + p[0], p[1]]; }).concat(R.slice().reverse().map(function (p) { return [cx - p[0], p[1]]; }));
    var body = g.createLinearGradient(0, 120, 0, 480);
    body.addColorStop(0, 'rgba(201,166,107,0.98)'); body.addColorStop(0.55, 'rgba(184,147,90,0.92)'); body.addColorStop(1, 'rgba(184,147,90,0.3)');
    g.save(); g.shadowColor = 'rgba(201,166,107,0.65)'; g.shadowBlur = 28; g.fillStyle = body;
    g.beginPath(); g.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    for (var i = 1; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath(); g.fill();
    g.beginPath(); g.arc(cx, 112, 27, 0, Math.PI * 2); g.fillStyle = 'rgba(201,166,107,0.98)'; g.fill(); g.restore();
    var tx = new T.CanvasTexture(c); return tx;
  }
  drawSig() {
    var cv = this.sigEl, id = this.state.selected; if (!cv || !id || id === 'whole') return;
    var g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.save(); g.shadowColor = 'rgba(232,196,128,0.9)'; g.shadowBlur = 9; this.drawMotif(g, id, cv.width / 2, cv.height / 2, cv.width * 0.86, '#8A6A35', 1.6); g.restore();
  }

  logoPoints() { return LOGO_POINTS as number[]; }
  /* ---------------- data: systems registry, discipline taxonomy, relationships ---------------- */
  nidata() { if (!this._d) this._d = buildGalaxyData(); return this._d; }
  nameOf(id) { if (!id) return ''; if (id === 'whole') return 'Uniquely You'; var n = this.nidata().nodeById[id]; return n ? n.name : ''; }
  catOk(d) { var f = this.state.filter; return f === 'all' || d.cat === f; }

  /* ---------------- selection + hover (React side, never per-frame) ---------------- */
  select(id) {
    var D = this.nidata();
    var msg = id === 'whole' ? 'Uniquely You selected' : (this.nameOf(id) + ' selected. ' + (D.nodeById[id] ? D.nodeById[id].links.length : 0) + ' related areas of expertise.');
    this.setState({ selected: id, discipline: null, hover: null, sheetOpen: false, announce: msg });
  }
  pickDisc(id) { var d = this.nidata().discById[id]; this.setState({ discipline: id, hover: null, announce: d ? d.name + ' — linked across ' + d.systems.length + ' areas' : '' }); }
  listHover(kind, id) {
    if (!kind) { if (this.state.hover && this.state.hover.src === 'list') this.setState({ hover: null }); if (this.E) this.E.listHover = null; this.wake(); return; }
    var pt = this.engProject(kind, id);
    this.setState({ hover: { kind: kind, id: id, x: pt ? pt.x : null, y: pt ? pt.y : null, src: 'list' } });
    if (this.E) { this.E.listHover = { kind: kind, id: id }; this.wake(); }
  }
  onEngineHover(info, x, y) {
    var h = this.state.hover;
    if (!info) { if (h && h.src === 'ray') this.setState({ hover: null }); return; }
    if (h && h.src === 'ray' && h.kind === info.kind && h.id === info.id && h.planet === info.planet) return;
    this.setState({ hover: { kind: info.kind, id: info.id, planet: info.planet || null, x: x, y: y, src: 'ray' } });
  }
  onEnginePick(info) {
    if (!info) return;
    if (info.kind === 'planet') this.select(info.id);
    else if (info.kind === 'center') this.select('whole');
    else if (info.kind === 'moon') { var dd = this.nidata().discById[info.id]; this.setState({ selected: info.planet || this.state.selected, discipline: info.id, hover: null, sheetOpen: false, announce: dd.name + ' — linked across ' + dd.systems.length + ' areas' }); }
  }

  layout() {
    var s = this.state, W = s.w || 1440, H = this.hpx();
    var compact = W < 900;
    var panel = !!(s.selected || s.discipline);
    if (compact) {
      var sheetH = Math.round(H * 0.5);
      return { compact: true, top: 112, left: 0, right: 0, bottom: 72 + ((panel || s.sheetOpen) ? sheetH : 0), sheetH: sheetH };
    }
    return { compact: false, top: 160, left: 324, right: panel ? 428 : 0, bottom: 92, sheetH: 0 };
  }
  hpx() { return Math.max(560, Number(this.props.height) || 900); }

  /* ---------------- render values ---------------- */
  renderVals() {
    var self = this, D = this.nidata(), s = this.state, L = this.layout();
    var W = s.w || 1440, H = this.hpx(), compact = L.compact;
    var panel = !!(s.selected || s.discipline);
    var mono = "var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace";
    var hov = s.hover;
    var dotFor = function (o, size) {
      size = size || 10;
      if (o.kind === 1) return 'width: ' + size + 'px; height: ' + size + 'px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid ' + o.A + '; background: transparent';
      return 'width: ' + size + 'px; height: ' + size + 'px; flex: none; border-radius: 50%; background: ' + o.A + '; box-shadow: 0 0 0 3px ' + o.A + '33';
    };
    var glyphFor = function (cat) {
      var c = D.CATS[cat];
      if (cat === 'coach') return 'width: 10px; height: 10px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid ' + c.color + '; background: transparent';
      return 'width: 10px; height: 10px; flex: none; border-radius: 50%; background: ' + c.color;
    };
    var rowStyle = function (active, tall) {
      return 'display: flex; align-items: center; gap: 10px; width: 100%; min-height: ' + (compact ? 44 : (tall || 34)) + 'px; padding: 6px 10px; box-sizing: border-box; border: 0; border-radius: 10px; background: ' + (active ? 'rgba(184,147,90,0.18)' : 'transparent') + '; color: #14201A; font: 500 14px/1.25 \'DM Sans\', system-ui, sans-serif; text-align: left; cursor: pointer';
    };
    var countVisible = function (n) { return n.links.filter(function (d) { return self.catOk(d); }).length; };

    var groups = D.ORBITS.map(function (o) {
      return {
        num: o.num, name: o.name, blurb: o.blurb, count: o.nodes.length + ' nodes', aria: o.name,
        enter: function () { if (self.E) { self.E.ringHover = o.num - 1; self.wake(); } },
        leave: function () { if (self.E) { self.E.ringHover = -1; self.wake(); } },
        nodes: o.nodes.map(function (n) {
          var on = s.selected === n.id;
          var hv = hov && hov.kind === 'planet' && hov.id === n.id;
          return { name: n.name, on: on, moons: String(countVisible(n)), dot: dotFor(o), style: rowStyle(on || hv),
            pick: function () { self.select(n.id); }, enter: function () { self.listHover('planet', n.id); }, leave: function () { self.listHover(null); } };
        })
      };
    });

    var filterOpts = [{ id: 'all', label: 'All expertise' }].concat(Object.keys(D.CATS).map(function (k) { return { id: k, label: D.CATS[k].short }; }));
    var moonOpts = [['off', 'Off'], ['featured', 'Featured'], ['all', 'All']].map(function (m) {
      var on = s.moonsMode === m[0];
      return { label: m[1], on: on, pick: function () { self.setState({ moonsMode: m[0] }); },
        style: 'min-height: ' + (compact ? 40 : 32) + 'px; padding: 0 12px; border: 0; border-radius: 999px; background: ' + (on ? '#B8935A' : 'transparent') + '; color: ' + (on ? '#0E0D0B' : '#14201A') + '; font: 500 12.5px/1 \'DM Sans\', system-ui, sans-serif; cursor: pointer' };
    });

    // system detail
    var sys = null;
    if (s.selected) {
      if (s.selected === 'whole') {
        sys = { isWhole: true, hasExp: false, emptyFiltered: false, name: 'Uniquely You', eyebrow: 'The centre · six dimensions',
          desc: 'At the centre glows the NI mark: a fingerprint, because no two people are alike, growing into a tree with living roots. It holds the six dimensions of a life — physical, mental, emotional, social, spiritual and environmental — woven together, never separate. Every orbit turns around you.',
          dot: 'width: 10px; height: 10px; border-radius: 50%; background: #C9A66B',
          dims: D.DIMS.map(function (d) { return { name: d[0], dot: 'width: 8px; height: 8px; flex: none; border-radius: 50%; background: ' + d[1] }; }) };
      } else {
        var n = D.nodeById[s.selected];
        var vis = n.links.filter(function (d) { return self.catOk(d); });
        var order = ['medical', 'allied', 'nutrition', 'integrative', 'accredited', 'coach'];
        var eg = order.map(function (cat) {
          var items = vis.filter(function (d) { return d.cat === cat; });
          if (!items.length) return null;
          return { label: D.CATS[cat].label, glyph: glyphFor(cat), items: items.map(function (d) {
            var hv = hov && hov.kind === 'moon' && hov.id === d.id;
            return { name: d.name, meta: d.reg + ' · ' + d.role, style: rowStyle(hv, 52),
              pick: function () { self.pickDisc(d.id); }, enter: function () { self.listHover('moon', d.id); }, leave: function () { self.listHover(null); } };
          }) };
        }).filter(Boolean);
        sys = { isWhole: false, name: n.name, desc: n.desc, eyebrow: n.orbit.name, dot: dotFor(n.orbit, 10),
          hasSig: true, sigNote: n.orbit.kind === 2 ? 'Signature motif: an everyday influence, drawn as a botanical emblem.' : (n.orbit.kind === 1 ? 'Signature motif: a process that runs across several organs.' : 'Signature motif: drawn from the organ’s own structure.'), hasExp: vis.length > 0, emptyFiltered: vis.length === 0, expCount: vis.length + (vis.length === 1 ? ' discipline' : ' disciplines'), expGroups: eg, dims: [] };
      }
    }
    var disc = null;
    if (s.discipline) {
      var d = D.discById[s.discipline];
      disc = { name: d.name, catLabel: D.CATS[d.cat].label, glyph: glyphFor(d.cat), reg: d.reg, role: d.role, scope: d.scope, isCoach: d.coach,
        backLabel: s.selected && s.selected !== 'whole' ? self.nameOf(s.selected) : 'Back', count: d.systems.length,
        systems: d.systems.map(function (id) {
          var nn = D.nodeById[id]; var hv = hov && hov.kind === 'planet' && hov.id === id;
          return { name: nn.name, num: nn.orbit.num, dot: dotFor(nn.orbit), style: rowStyle(hv || id === s.selected),
            pick: function () { self.select(id); }, enter: function () { self.listHover('planet', id); }, leave: function () { self.listHover(null); } };
        }) };
    }

    // tooltip (stationary: placed once on hover, never follows motion)
    var tip = { show: false };
    if (hov && hov.x != null && !(compact && hov.src === 'list')) {
      var t = null;
      if (hov.kind === 'planet') { var hn = D.nodeById[hov.id]; t = { eyebrow: hn.orbit.name, name: hn.name, desc: hn.desc }; }
      else if (hov.kind === 'center') t = null; // the floating 'Uniquely You' label is the hover state for the centre
      else if (hov.kind === 'moon') { var hd = D.discById[hov.id]; t = { eyebrow: D.CATS[hd.cat].label, name: hd.name, desc: hd.reg + ' · ' + hd.role + (hov.planet ? (hd.coach ? ' · Coaching support for ' : ' · Specialist in ') + D.nodeById[hov.planet].name : '') }; }
      if (t && !(hov.src === 'list' && hov.kind === 'moon' && panel)) {
        var tw = 290, x = hov.x + 18, y = hov.y + 16;
        if (x + tw > W - 16) x = hov.x - tw - 18;
        if (x < 16) x = 16;
        if (y + 130 > H - 16) y = hov.y - 140;
        if (y < 16) y = 16;
        tip = { show: true, eyebrow: t.eyebrow, name: t.name, desc: t.desc,
          style: 'position: absolute; left: ' + Math.round(x) + 'px; top: ' + Math.round(y) + 'px; width: ' + tw + 'px; box-sizing: border-box; padding: 12px 14px; border: 1px solid rgba(184,147,90,0.4); border-radius: 12px; background: rgba(255,253,249,0.97); box-shadow: 0 12px 32px rgba(30,47,36,0.16); pointer-events: none' };
      }
    }

    var glass = 'background: rgba(255,253,249,0.86); border: 1px solid rgba(184,147,90,0.24); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-sizing: border-box';
    var navVisible = !compact || (s.sheetOpen && !panel);
    var navStyle = compact
      ? 'position: absolute; left: 0; right: 0; bottom: 72px; height: ' + L.sheetH + 'px; overflow-y: auto; padding: 14px 14px 18px; border-radius: 20px 20px 0 0; ' + glass
      : 'position: absolute; left: 32px; top: 172px; bottom: 76px; width: 276px; overflow-y: auto; padding: 16px 12px 12px; border-radius: 16px; ' + glass;
    var panelStyle = compact
      ? 'position: absolute; left: 0; right: 0; bottom: 72px; height: ' + L.sheetH + 'px; overflow-y: auto; padding: 16px 18px 22px; border-radius: 20px 20px 0 0; ' + glass
      : 'position: absolute; right: 32px; top: 32px; bottom: 32px; width: 380px; overflow-y: auto; padding: 22px 22px 24px; border-radius: 18px; ' + glass;
    var midX = compact ? W / 2 : (L.left + (W - L.right)) / 2;
    var barStyle = compact
      ? 'position: absolute; left: 0; right: 0; bottom: 0; height: 72px; display: flex; align-items: center; gap: 6px; padding: 0 12px; box-sizing: border-box; background: rgba(250,248,243,0.97); border-top: 1px solid rgba(184,147,90,0.24)'
      : 'position: absolute; left: ' + Math.round(midX) + 'px; bottom: 22px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; ' + glass;
    var iconBtn = 'min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 ' + (compact ? 0 : 12) + 'px; border: 0; border-radius: ' + (compact ? 12 : 999) + 'px; background: transparent; color: #14201A; cursor: pointer';
    var wholeOn = s.selected === 'whole';

    var posterRings = D.ORBITS.map(function (o) { return { rx: o.a * 8, ry: o.a * 8 * 0.42 }; });
    var posterDots = D.nodes.map(function (n) {
      var o = n.orbit, th = (n.k / o.nodes.length) * Math.PI * 2 + o.num * 0.7;
      return { x: Math.round(Math.cos(th) * o.a * 8), y: Math.round(Math.sin(th) * o.a * 8 * 0.42), r: 7, c: o.A };
    });

    return {
      rootRef: this.rootRef, canvasRef: this.canvasRef, phraseRef: this.phraseRef, sigRef: this.sigRef, wpRef: this.wpRef, hudRef: this.hudRef, onKey: this.onKey,
      h: H, wpSize: compact ? 18 : 23, pad: compact ? 18 : 32, h1Size: compact ? 27 : 44, subSize: compact ? 13.5 : 16,
      showPoster: !s.ready || s.fallback, canvasOpacity: s.ready && !s.fallback ? 1 : 0,
      cursor: hov && hov.src === 'ray' ? 'pointer' : 'grab',
      showHint: !compact && !panel, showFoot: !compact, compact: compact, wide: !compact,
      perf: s.perf, perfLabel: s.perf ? 'Hide performance' : 'Show performance', togglePerf: this.togglePerf,
      hudStyle: 'position: absolute; ' + (compact ? 'left: 12px; top: 96px;' : 'right: 32px; top: 112px;') + ' padding: 8px 12px; border-radius: 10px; background: rgba(255,253,249,0.92); border: 1px solid rgba(184,147,90,0.3); font-family: ' + mono + '; font-size: 11.5px; line-height: 1.6; color: #7A5A2A; white-space: pre; pointer-events: none',
      navVisible: navVisible, navStyle: navStyle, groups: groups, filterOpts: filterOpts, filter: s.filter, onFilter: this.onFilter,
      moonOpts: moonOpts, speed: s.speed, onSpeed: this.onSpeed, speedLabel: s.speed + '×',
      wholeOn: wholeOn, wholeStyle: rowStyle(wholeOn || (hov && hov.kind === 'center'), 52), pickWhole: this.pickWhole, hoverWhole: this.hoverWhole, unhover: this.unhover,
      panelOpen: panel, panelStyle: panelStyle, sysMode: !!sys && !disc, discMode: !!disc, sys: sys || { dims: [], expGroups: [] }, disc: disc || { systems: [] }, back: this.back,
      backStyle: 'align-self: flex-start; min-height: 40px; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border: 1px solid rgba(184,147,90,0.35); border-radius: 999px; background: transparent; color: #7A5A2A; font: 500 13px/1 \'DM Sans\', system-ui, sans-serif; cursor: pointer',
      filterLabel: s.filter === 'all' ? '' : D.CATS[s.filter].short.toLowerCase(),
      tip: tip, barStyle: barStyle, iconBtn: iconBtn,
      paused: s.paused, playing: !s.paused, pauseLabel: s.paused ? 'Resume animation' : 'Pause animation', pauseText: s.paused ? 'Play' : 'Pause', togglePause: this.togglePause,
      zoomIn: this.zoomIn, zoomOut: this.zoomOut, reset: this.reset,
      toggleSheet: this.toggleSheet, sheetOpenAria: !!(s.sheetOpen && !panel),
      sheetLabel: panel ? 'All systems' : (s.sheetOpen ? 'Close' : 'Explore'),
      sheetChevron: (s.sheetOpen || panel) ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6',
      moonKey: ['medical', 'allied', 'nutrition', 'integrative', 'accredited', 'coach'].map(function (k) { return { label: k === 'coach' ? 'Coach (open ring)' : D.CATS[k].short, glyph: glyphFor(k) }; }),
      posterRings: posterRings, posterDots: posterDots, announce: s.announce
    };
  }

  /* ---------------- lifecycle ---------------- */
  componentDidMount() {
    var self = this;
    this.measure();
    if (window.ResizeObserver && this.rootEl) { this._ro = new ResizeObserver(function () { self.measure(); }); this._ro.observe(this.rootEl); }
    this.initEngine();
    this.startPhrases();
    try { if (/[?&]galaxyDebug=1/.test(window.location.search)) window.__niGalaxy = this; } catch (e) {}
  }
  phrases() { return this.props.phrases || PHRASES; }
  startPhrases() {
    var self = this, P = this.phrases(), i = 0;
    if (this.state.reduced) return;
    this._phraseT = setInterval(function () {
      var el = self.phraseEl, E = self.E;
      if (!el || document.hidden || (E && (E.rayHover || E.listHover) && ((E.rayHover || E.listHover).kind === 'center'))) return;
      el.style.opacity = '0';
      setTimeout(function () { i = (i + 1) % P.length; if (self.phraseEl) { self.phraseEl.textContent = P[i]; self.phraseEl.style.opacity = '1'; } }, 1150);
    }, 5200);
  }
  componentDidUpdate(pp, ps) { this.syncEngine(); if (ps && ps.selected !== this.state.selected) this.drawSig(); }
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); if (this._phraseT) clearInterval(this._phraseT); this.disposeEngine(); }
  measure() {
    if (!this.rootEl) return;
    var w = Math.round(this.rootEl.clientWidth), h = Math.round(this.rootEl.clientHeight);
    if (w !== this.state.w || h !== this.state.h) this.setState({ w: w, h: h });
    if (this.E) this.engResize();
  }

  /* ---------------- rendering engine (Three.js, procedural, no textures) ---------------- */
  initEngine() {
    var self = this, T = THREE, cv = this.canvasEl;
    if (!cv || !T) { this.setState({ fallback: true }); return; }
    var D = this.nidata();
    var W0 = this.rootEl ? this.rootEl.clientWidth : 1440;
    var lite = W0 < 900 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: !lite, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { this.setState({ fallback: true }); return; }
    if (!renderer.getContext()) { this.setState({ fallback: true }); return; }
    renderer.setClearColor(0x000000, 0);
    var E = this.E = { T: T, renderer: renderer, lite: lite, dprCap: lite ? 1.5 : 2, raf: 0, last: 0, activeUntil: 0, visible: true,
      reduced: this.state.reduced, listHover: null, rayHover: null, ringHover: -1, speed: 1, sel: undefined, disc: undefined, moonsMode: undefined, filter: undefined,
      fpsFrames: 0, fpsT: 0, fps: 0, slowWins: 0, idleT: 0, ndc: new T.Vector2(), pointerIn: false, needPick: false,
      v1: new T.Vector3(), v2: new T.Vector3(), v3: new T.Vector3(), m1: new T.Matrix4(), q1: new T.Quaternion(), s1: new T.Vector3() };
    E.dpr = Math.min(window.devicePixelRatio || 1, E.dprCap);
    renderer.setPixelRatio(E.dpr);
    var scene = E.scene = new T.Scene();
    var camera = E.camera = new T.PerspectiveCamera(lite ? 48 : 40, 1, 0.1, 1200);
    scene.add(new T.AmbientLight(0x8a9a8c, 1.0));
    E.sun = new T.PointLight(0xfff3cf, 1.6, 0, 0); scene.add(E.sun);
    E.camLight = new T.PointLight(0xf3ead8, 0, 0, 0); scene.add(E.camLight);
    var rnd = this.seeded(20261014);
    E.ps = (lite ? 1.45 : 1.2) * 1.2; var BK = 1.2; E.BK = BK;

    var NOISE = [
      'float h3(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
      'float n3(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);',
      'return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),',
      'mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}'
    ].join('\n');
    var planetVS = 'varying vec3 vN; varying vec3 vW; varying vec3 vO; varying vec2 vUv; void main(){ vO=position; vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }';
    var planetFS = [
      'uniform vec3 uA; uniform vec3 uB; uniform float uSeed; uniform float uDim; uniform float uHi; uniform float uKind; uniform float uWarm; uniform float uFill; uniform sampler2D uMotif; uniform float uMotifK; varying vec2 vUv;',
      'varying vec3 vN; varying vec3 vW; varying vec3 vO;', NOISE,
      'void main(){',
      ' vec3 n=normalize(vN); vec3 L=normalize(-vW); vec3 V=normalize(cameraPosition-vW);',
      ' float wrap=max((dot(n,L)+0.3)/1.3,0.0);',
      ' vec3 p=normalize(vO);',
      ' float bands=n3(vec3(p.x*1.6+uSeed, p.y*6.5, p.z*1.6));',
      ' float fine=n3(p*5.0+uSeed*1.7);',
      ' vec3 base=mix(uB,uA,smoothstep(0.2,0.85,bands*0.65+fine*0.35));',
      ' if(uKind>1.5){ float lon=atan(p.z,p.x); float rib=smoothstep(0.9,1.0,abs(sin(lon*5.0+p.y*1.5))); base=mix(base,uA*1.18,rib*0.35*(1.0-abs(p.y))); }',
      ' if(uKind>0.5 && uKind<1.5){ float lat=smoothstep(0.0,0.06,abs(p.y)); base=mix(uA*1.2,base,lat*0.6+0.4); }',
      ' vec3 col=base*(0.56+0.6*wrap+uFill*0.38*max(dot(n,V),0.0));',
      ' float ma=texture2D(uMotif,vUv).a; float core=smoothstep(0.62,0.95,ma)*uMotifK;',
      ' col=mix(col,vec3(0.96,0.82,0.55)*(0.55+0.7*wrap+uFill*0.3),core*0.92);',
      ' col+=vec3(0.96,0.76,0.44)*ma*uMotifK*0.45;',
      ' float fall=1.0/(1.0+length(vW)*0.055); col+=vec3(1.0,0.92,0.60)*pow(max(dot(n,L),0.0),1.2)*fall*uWarm*0.75; col+=vec3(1.0,0.95,0.72)*pow(1.0-max(dot(n,V),0.0),2.5)*max(dot(n,L),0.0)*fall*uWarm*0.8;',
      ' float fr=pow(1.0-max(dot(n,V),0.0),3.0);',
      ' col+=uA*fr*0.45+vec3(0.85,0.68,0.42)*uHi*fr*1.1+vec3(0.06,0.05,0.03)*uHi;',
      ' col=mix(col,vec3(0.93,0.91,0.86),uDim*0.8);',
      ' gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n');
    var atmoVS = 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }';
    var atmoFS = 'uniform vec3 uA; uniform float uI; varying vec3 vN; varying vec3 vV; void main(){ float d=abs(dot(normalize(vN),normalize(vV))); float a=pow(d,2.4)*uI; gl_FragColor=vec4(uA,a*0.7); }';

    // shared geometry
    var seg = lite ? [32, 20] : [48, 32];
    E.geoPlanet = new T.SphereGeometry(1, seg[0], seg[1]);
    E.geoAtmo = new T.SphereGeometry(1, 32, 20);
    E.geoMoon = new T.SphereGeometry(1, 18, 12);
    E.geoRing = new T.TorusGeometry(1, 0.3, 8, 32);
    E.geoHalo = new T.TorusGeometry(1, 0.016, 6, 128);

    // orbits (deterministic, seeded)
    E.rings = D.ORBITS.map(function (o, ri) {
      var b = o.a * Math.sqrt(1 - o.e * o.e);
      var m = new T.Matrix4().makeRotationFromEuler(new T.Euler(o.inc * Math.PI / 180, o.node * Math.PI / 180, 0, 'YXZ'));
      var pts = [];
      for (var i = 0; i < 256; i++) { var th = i / 256 * Math.PI * 2; pts.push(new T.Vector3(o.a * Math.cos(th), 0, b * Math.sin(th)).applyMatrix4(m)); }
      var line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x9c7a44, transparent: true, opacity: 0.4, depthWrite: false }));
      scene.add(line);
      return { o: o, a: o.a, b: b, m: m, dir: o.dir, omega: Math.PI * 2 / [60, 90, 120, 150][ri], phase: 0, scale: 1, scaleT: 1, line: line, op: 0.22 };
    });

    // planets
    E.planets = []; E.planetById = {}; E.pickables = [];
    D.nodes.forEach(function (n) {
      var r = E.rings[D.ORBITS.indexOf(n.orbit)];
      var A = new T.Color(n.orbit.A), B = new T.Color(n.orbit.B);
      var j = rnd() * 0.18; A.lerp(new T.Color(0xf8f6f2), j * 0.5); B.lerp(new T.Color(0x0e0d0b), j);
      var g = new T.Group();
      var mat = new T.ShaderMaterial({ vertexShader: planetVS, fragmentShader: planetFS,
        uniforms: { uA: { value: A }, uB: { value: B }, uSeed: { value: rnd() * 40 }, uDim: { value: 0 }, uHi: { value: 0 }, uKind: { value: n.orbit.kind }, uFill: { value: 0 }, uWarm: { value: 1 }, uMotif: { value: self.motifTexture(n.id) }, uMotifK: { value: 0.5 } } });
      var mesh = new T.Mesh(E.geoPlanet, mat);
      var size = E.ps * (n.orbit.kind === 2 ? 0.95 : 1);
      mesh.scale.setScalar(size);
      mesh.rotation.set((rnd() - 0.5) * 0.8, rnd() * 6, (rnd() - 0.5) * 0.5);
      mesh.userData = { kind: 'planet', id: n.id };
      g.add(mesh);
      var atmo = null;
      if (!lite) {
        atmo = new T.Mesh(E.geoAtmo, new T.ShaderMaterial({ vertexShader: atmoVS, fragmentShader: atmoFS, uniforms: { uA: { value: A.clone() }, uI: { value: 0.5 } },
          side: T.BackSide, transparent: true, depthWrite: false, blending: T.NormalBlending }));
        atmo.scale.setScalar(size * 1.28); atmo.raycast = function () {}; g.add(atmo);
      }
      var halo = null;
      if (n.orbit.kind === 1) {
        halo = new T.Mesh(E.geoHalo, new T.MeshBasicMaterial({ color: A, transparent: true, opacity: 0.32, depthWrite: false }));
        halo.scale.setScalar(size * 1.32); halo.rotation.set(1.2 + rnd() * 0.5, rnd() * 3, 0); halo.raycast = function () {}; g.add(halo);
      }
      scene.add(g);
      var p = { n: n, id: n.id, ring: r, g: g, mesh: mesh, mat: mat, atmo: atmo, halo: halo, size: size, th0: (n.k / n.orbit.nodes.length) * Math.PI * 2 + (rnd() - 0.5) * 0.25 + ri0(n),
        spin: (0.08 + rnd() * 0.1) * (rnd() < 0.3 ? -1 : 1), dim: 0, hi: 0, fill: 0, mot: 0.5 };
      E.planets.push(p); E.planetById[n.id] = p; E.pickables.push(mesh);
    });
    function ri0(n) { return n.orbit.num * 0.7; }

    // Whole Person core
    var coreFS = ['uniform float uTime; uniform float uDim; varying vec3 vN; varying vec3 vW; varying vec3 vO;', NOISE,
      'void main(){ vec3 n=normalize(vN); vec3 V=normalize(cameraPosition-vW); float f=pow(1.0-max(dot(n,V),0.0),2.0); vec3 p=normalize(vO);',
      ' float s=n3(p*3.0+uTime*0.04)*0.6+n3(p*8.0-uTime*0.03)*0.4;',
      ' vec3 col=mix(vec3(0.97,0.94,0.87),vec3(0.80,0.63,0.38),clamp(f*0.85+s*0.3,0.0,1.0));',
      ' col*=0.88+0.22*s; col*=1.0-uDim*0.45; gl_FragColor=vec4(col,1.0); }'].join('\n');
    E.coreMat = new T.ShaderMaterial({ vertexShader: planetVS, fragmentShader: coreFS, uniforms: { uTime: { value: 0 }, uDim: { value: 0 } } });
    E.core = new T.Mesh(new T.SphereGeometry(2.4, 48, 32), E.coreMat);
    E.core.userData = { kind: 'center', id: 'whole' };
    E.core.material = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); E.core.scale.setScalar(1.45);

    // NI mark at the centre: ~4,600 particles sampled from the logo (fingerprint = uniquely you; tree and roots = growth).
    // A soft six-petal bloom behind it carries the six dimensions, opening outward instead of enclosing.
    E.logoG = new T.Group(); E.logoG.position.y = 0.1; scene.add(E.logoG);
    var LP = self.logoPoints(), lpos = [], lseed = [], lb = [], lsc = [];
    for (var li = 0; li < LP.length; li += 3) {
      lpos.push(LP[li] / 500 * 3.3, LP[li + 1] / 500 * 3.3, 0); lseed.push(rnd() * 100); lb.push(LP[li + 2] / 9);
      var sa = rnd() * Math.PI * 2, sr = 3 + rnd() * 9; lsc.push(Math.cos(sa) * sr, Math.sin(sa) * sr, (rnd() - 0.5) * 6);
    }
    var lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.Float32BufferAttribute(lpos, 3)); lg.setAttribute('aSeed', new T.Float32BufferAttribute(lseed, 1));
    lg.setAttribute('aB', new T.Float32BufferAttribute(lb, 1)); lg.setAttribute('aScatter', new T.Float32BufferAttribute(lsc, 3));
    // ~9,000 fine grains of luminous gold: drawn together like magnetised sand on load, then breathing slowly
    E.logoMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.NormalBlending,
      uniforms: { uT: { value: 0 }, uPR: { value: E.dpr }, uOp: { value: 1 }, uGather: { value: E.reduced ? 0 : 1 }, uBreath: { value: 0 } },
      vertexShader: 'attribute float aSeed; attribute float aB; attribute vec3 aScatter; uniform float uT; uniform float uPR; uniform float uGather; uniform float uBreath; varying float vA; varying float vS; varying float vG;' +
        'void main(){ float e=uGather*uGather*(3.0-2.0*uGather); vec3 p=position*(1.0+uBreath*0.045)+aScatter*e;' +
        ' p.x+=sin(uT*0.9+aSeed)*0.011; p.y+=cos(uT*0.8+aSeed*1.7)*0.011; vec4 mv=modelViewMatrix*vec4(p,1.0);' +
        ' gl_PointSize=clamp(0.4*uPR*(300.0/-mv.z)*(0.7+0.6*aB),0.9*uPR,3.2*uPR); vA=aB; vS=aSeed; vG=e; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uOp; uniform float uT; uniform float uBreath; varying float vA; varying float vS; varying float vG;' +
        'void main(){ float r=length(gl_PointCoord-0.5)*2.0; float core=smoothstep(1.0,0.0,r); float tw=0.78+0.22*sin(uT*1.6+vS*5.0);' +
        ' vec3 pine=vec3(0.12,0.24,0.17); vec3 sage=vec3(0.30,0.48,0.36); vec3 gold=vec3(0.78,0.62,0.34);' +
        ' vec3 c=mix(pine,sage,clamp(0.05+0.5*(uBreath*0.5+0.5)+0.2*(1.0-core),0.0,1.0)); c=mix(c,gold,step(0.9,fract(vS*7.31))*(0.7+0.3*sin(uT*1.3+vS)));' +
        ' float a=min(1.0,core*1.35)*(0.7+0.3*vA)*tw*uOp*(1.0-vG*0.55)*(0.86+0.14*uBreath); gl_FragColor=vec4(c,a); }' });
    // luminous glow behind the grains (shadow-only render of the mark, plus a warm halo), no petals
    var mc = document.createElement('canvas'); mc.width = 1024; mc.height = 1024;
    E.markTex = new T.CanvasTexture(mc); E.markTex.anisotropy = 4;
    E.mark = new T.Mesh(new T.PlaneGeometry(9.4, 9.4), new T.MeshBasicMaterial({ map: E.markTex, transparent: true, depthWrite: false }));
    E.mark.position.z = -0.02; E.mark.raycast = function () {}; E.logoG.add(E.mark);
    var mimg = new Image();
    mimg.onload = function () {
      if (!self.E) return;
      var g = mc.getContext('2d'), h = 1024 * 6.6 / 9.4, w = h * mimg.width / mimg.height, x = (1024 - w) / 2, y = (1024 - h) / 2;
      var halo = g.createRadialGradient(512, 512, 20, 512, 512, 470);
      halo.addColorStop(0, 'rgba(255,238,170,0.40)'); halo.addColorStop(0.55, 'rgba(252,232,160,0.12)'); halo.addColorStop(1, 'rgba(252,232,160,0)');
      g.fillStyle = halo; g.fillRect(0, 0, 1024, 1024);
      g.save(); g.shadowOffsetX = 3000;
      g.shadowColor = 'rgba(246,222,128,0.75)'; g.shadowBlur = 30; g.drawImage(mimg, x - 3000, y, w, h);
      g.shadowColor = 'rgba(110,150,118,0.45)'; g.shadowBlur = 8; g.drawImage(mimg, x - 3000, y, w, h);
      g.restore();
      var tc = document.createElement('canvas'); tc.width = 1024; tc.height = 1024; var t = tc.getContext('2d');
      t.drawImage(mimg, x, y, w, h); t.globalCompositeOperation = 'source-in'; t.fillStyle = 'rgba(46,70,54,0.16)'; t.fillRect(0, 0, 1024, 1024);
      g.drawImage(tc, 0, 0);
      E.markTex.needsUpdate = true; self.wake();
    };
    mimg.src = this.props.markSrc || DEFAULT_MARK_SRC;
    E.logo = new T.Points(lg, E.logoMat); E.logo.raycast = function () {}; E.logo.frustumCulled = false; E.logoG.add(E.logo);
    E.gather = E.reduced ? 0 : 1;

    scene.add(E.core); E.pickables.push(E.core);
    var glowFS = 'uniform float uI; varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; float a=pow(max(1.0-r,0.0),2.4)*uI; gl_FragColor=vec4(vec3(0.98,0.88,0.50),a*0.7); }';
    E.glow = new T.Mesh(new T.PlaneGeometry(18, 18), new T.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: glowFS, uniforms: { uI: { value: 0.42 } }, transparent: true, depthWrite: false, blending: T.NormalBlending }));
    E.glow.raycast = function () {}; scene.add(E.glow);
    E.radiance = new T.Mesh(new T.PlaneGeometry(52, 52), new T.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; float a=(pow(max(1.0-r,0.0),2.6)*0.8+pow(max(1.0-r*2.2,0.0),2.0)*0.5)*uI; gl_FragColor=vec4(vec3(1.0,0.93,0.60),a); }',
      uniforms: { uI: { value: 0.3 } }, transparent: true, depthWrite: false }));
    E.radiance.raycast = function () {}; E.radiance.renderOrder = -1; scene.add(E.radiance);
    E.dims = new T.Group();
    D.DIMS.forEach(function (d, k) {
      var pts = []; for (var i = 0; i < 128; i++) { var th = i / 128 * Math.PI * 2; pts.push(new T.Vector3(Math.cos(th) * 3.9, 0, Math.sin(th) * 3.9)); }
      var l = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: new T.Color(d[1]), transparent: true, opacity: 0.5, depthWrite: false }));
      l.rotation.set(1.15, k * Math.PI / 6, 0, 'YXZ'); E.dims.add(l);
    });
    scene.add(E.dims); E.dims.scale.setScalar(1.12); E.dims.visible = false; // iteration: no rings around the mark

    // stars + phyllotaxis dust (golden-angle botanical motif)
    var pointVS = 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uPR; varying float vA; varying vec3 vC; void main(){ vA=aAlpha; vC=aColor; gl_PointSize=aSize*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
    var pointFS = 'uniform float uOp; varying float vA; varying vec3 vC; void main(){ float r=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.1,r)*vA*uOp; gl_FragColor=vec4(vC,a); }';
    var mkPoints = function (pos, size, alpha, col, op) {
      var gg = new T.BufferGeometry();
      gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
      gg.setAttribute('aAlpha', new T.Float32BufferAttribute(alpha, 1)); gg.setAttribute('aColor', new T.Float32BufferAttribute(col, 3));
      var pm = new T.Points(gg, new T.ShaderMaterial({ vertexShader: pointVS, fragmentShader: pointFS, uniforms: { uPR: { value: E.dpr }, uOp: { value: op } }, transparent: true, depthWrite: false, blending: T.NormalBlending }));
      pm.raycast = function () {}; return pm;
    };
    var sp = [], ss = [], sa = [], sc = [], N = lite ? 140 : 320;
    var tints = [[0.36, 0.48, 0.40], [0.66, 0.52, 0.30], [0.28, 0.48, 0.46], [0.44, 0.40, 0.58]];
    for (var i = 0; i < N; i++) {
      var u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, rr = 260 + rnd() * 120, q = Math.sqrt(1 - u * u);
      sp.push(rr * q * Math.cos(ph), rr * u, rr * q * Math.sin(ph));
      var big = rnd() < 0.06; ss.push(big ? 2.6 + rnd() * 1.2 : 1.1 + rnd() * 1.1); sa.push(big ? 0.5 : 0.16 + rnd() * 0.22);
      var tc = tints[rnd() < 0.7 ? 0 : 1 + Math.floor(rnd() * 3)]; sc.push(tc[0], tc[1], tc[2]);
    }
    E.stars = mkPoints(sp, ss, sa, sc, 1); scene.add(E.stars);
    var dp = [], ds = [], da = [], dc = [], ND = lite ? 280 : 560, GA = Math.PI * (3 - Math.sqrt(5));
    for (var j2 = 0; j2 < ND; j2++) {
      var rad = (4.2 + 1.32 * Math.sqrt(j2 + 1)) * 1.36, th2 = j2 * GA;
      dp.push(rad * Math.cos(th2), (rnd() - 0.5) * 0.6, rad * Math.sin(th2)); ds.push(1.2 + rnd() * 0.9); da.push(0.5 + rnd() * 0.5); dc.push(0.62, 0.48, 0.26);
    }
    E.dust = mkPoints(dp, ds, da, dc, 0.26);
    E.dust.rotation.set(0.04, 0, -0.03); scene.add(E.dust);
    // electrons: one luminous point with a fading tail on each of the six dimension rings
    E.dimRings = E.dims.children.slice(); E.elecTail = 30; E.elecR = 3.9;
    var ep = [], es = [], ea = [], ec = [];
    E.elecPh = []; E.elecW = [];
    E.dimRings.forEach(function (l, k) {
      var col = new T.Color(D.DIMS[k][1]).lerp(new T.Color(0xb8935a), 0.45);
      E.elecPh.push(k * 1.05 + rnd() * 0.6); E.elecW.push((0.28 + rnd() * 0.12) * (k % 2 ? -1 : 1));
      for (var j = 0; j < E.elecTail; j++) { ep.push(0, 0, 0); es.push(j === 0 ? 10 : 7 * (1 - j / E.elecTail) + 1.2); ea.push(0); ec.push(col.r, col.g, col.b); }
    });
    E.elec = mkPoints(ep, es, ea, ec, 1); E.elec.frustumCulled = false; E.dims.add(E.elec);

    // practitioner moons (instanced: solid spheres for clinical/practitioner categories, open rings for coaches)
    var cap = E.moonCap = 320;
    E.moonSolid = new T.InstancedMesh(E.geoMoon, new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a1a14 }), cap);
    E.moonRing = new T.InstancedMesh(E.geoRing, new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a2214 }), cap);
    E.c1 = new T.Color(); E.white = new T.Color(0xffffff); E.paper = new T.Color(0xefeae0);
    var cpts = []; for (var ci = 0; ci < 96; ci++) { var ca = ci / 96 * Math.PI * 2; cpts.push(new T.Vector3(Math.cos(ca), 0, Math.sin(ca))); }
    var cgeo = new T.BufferGeometry().setFromPoints(cpts);
    E.guides = [];
    for (var gi = 0; gi < 8; gi++) { var gl = new T.LineLoop(cgeo, new T.LineBasicMaterial({ color: 0xa07a3e, transparent: true, opacity: 0, depthWrite: false })); gl.matrixAutoUpdate = false; gl.visible = false; gl.frustumCulled = false; gl.raycast = function () {}; scene.add(gl); E.guides.push(gl); }
    [E.moonSolid, E.moonRing].forEach(function (im) {
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      for (var k = 0; k < cap; k++) { im.setMatrixAt(k, E.m1.identity()); im.setColorAt(k, new T.Color(1, 1, 1)); }
      im.count = 0; im.frustumCulled = false; scene.add(im);
    });
    E.moons = []; E.catColor = {};
    Object.keys(D.CATS).forEach(function (k) { E.catColor[k] = new T.Color(D.CATS[k].color); });

    // relationship arcs for a selected discipline
    E.arcs = [];
    for (var a = 0; a < 12; a++) {
      var ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(33 * 3), 3));
      var al = new T.Line(ag, new T.LineBasicMaterial({ color: 0xa07a3e, transparent: true, opacity: 0, depthWrite: false }));
      al.frustumCulled = false; al.visible = false; scene.add(al); E.arcs.push({ line: al, to: null, op: 0 });
    }

    // camera rig
    E.target = new T.Vector3(); E.theta = 0.55; E.phi = 0.8; E.dist = 90; E.thetaD = 0.55; E.phiD = 0.98; E.distD = 90; E.offX = 0; E.offY = 0;
    E.raycaster = new T.Raycaster();

    // input
    var ptrs = {}, drag = null, pinch = 0;
    var rect = function () { return cv.getBoundingClientRect(); };
    E.on = function (el, ev, fn, opt) { el.addEventListener(ev, fn, opt); (E.listeners = E.listeners || []).push([el, ev, fn, opt]); };
    E.on(cv, 'pointerdown', function (e) {
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; E.touch = e.pointerType === 'touch';
      var ids = Object.keys(ptrs);
      if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
      if (ids.length === 2) { var a1 = ptrs[ids[0]], b1 = ptrs[ids[1]]; pinch = Math.hypot(a1.x - b1.x, a1.y - b1.y); drag = null; }
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      E.idleT = 0; self.wake();
    });
    E.on(cv, 'pointermove', function (e) {
      var r = rect();
      E.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      E.client = { x: e.clientX - r.left, y: e.clientY - r.top }; E.pointerIn = true;
      if (ptrs[e.pointerId]) {
        var prev = ptrs[e.pointerId]; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(ptrs);
        if (ids.length === 2) {
          var a1 = ptrs[ids[0]], b1 = ptrs[ids[1]], d = Math.hypot(a1.x - b1.x, a1.y - b1.y);
          if (pinch > 0) E.distD = self.clampDist(E.distD * pinch / d); pinch = d;
        } else if (drag) {
          var dx = e.clientX - prev.x, dy = e.clientY - prev.y; drag.moved += Math.abs(dx) + Math.abs(dy);
          E.thetaD -= dx * 0.005; E.phiD = Math.min(1.45, Math.max(0.25, E.phiD - dy * 0.004));
        }
        E.idleT = 0;
      } else if (e.pointerType === 'mouse') E.needPick = true;
      self.wake();
    });
    var end = function (e) {
      var wasDrag = drag; delete ptrs[e.pointerId];
      if (Object.keys(ptrs).length < 2) pinch = 0;
      if (wasDrag && wasDrag.moved < 6 && e.type === 'pointerup') {
        var r = rect(); E.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        self.onEnginePick(self.pick());
      }
      drag = null; self.wake();
    };
    E.on(cv, 'pointerup', end); E.on(cv, 'pointercancel', end);
    E.on(cv, 'pointerleave', function () { E.pointerIn = false; E.rayHover = null; self.onEngineHover(null); self.wake(); });
    E.on(cv, 'wheel', function (e) { e.preventDefault(); E.distD = self.clampDist(E.distD * Math.exp(e.deltaY * 0.0012)); E.idleT = 0; self.wake(); }, { passive: false });
    E.onVis = function () { if (!document.hidden) self.wake(); };
    E.on(document, 'visibilitychange', E.onVis);
    if (window.IntersectionObserver && this.rootEl) {
      E.io = new IntersectionObserver(function (en) { E.visible = en[0].isIntersecting; if (E.visible) self.wake(); }, { threshold: 0.01 });
      E.io.observe(this.rootEl);
    }
    E.tick = function (now) { self.frame(now); };
    this.engResize();
    this.syncEngine(true);
    E.dist = E.distD; E.theta = E.thetaD; E.phi = E.phiD;
    this.frame(performance.now());
    this.setState({ ready: true });
  }
  seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  clampDist(d) { var E = this.E; var focused = E.sel && E.sel !== 'whole' && !E.disc; return Math.min(E.fitFull * 1.8, Math.max(focused ? 7 : 10, d)); }
  fit(R, rv) {
    var E = this.E, L = E.layout, W = E.W || 1, H = E.H || 1;
    var aw = Math.max(160, W - L.left - L.right), ah = Math.max(160, H - L.top - L.bottom);
    var t = Math.tan(E.camera.fov * Math.PI / 360);
    return Math.max(R * H / (t * aw), R * (rv || 1) * H / (t * ah)) + R * 0.12;
  }
  engResize() {
    var E = this.E; if (!E || !this.rootEl) return;
    var W = this.rootEl.clientWidth, H = this.rootEl.clientHeight; if (!W || !H) return;
    E.W = W; E.H = H; E.renderer.setSize(W, H, false); E.camera.aspect = W / H; E.camera.updateProjectionMatrix();
    E.layout = this.layout(); this.focusCamera(true); this.wake();
  }
  syncEngine(first) {
    var E = this.E; if (!E) return;
    var s = this.state;
    E.speed = s.paused ? 0 : s.speed;
    var L = this.layout(), lk = [L.left, L.right, L.top, L.bottom].join(',');
    var layoutChanged = E.lk !== lk; E.layout = L; E.lk = lk;
    var selChanged = E.sel !== s.selected || E.disc !== s.discipline;
    var moonsChanged = selChanged || E.moonsMode !== s.moonsMode || E.filter !== s.filter;
    E.sel = s.selected; E.disc = s.discipline; E.moonsMode = s.moonsMode; E.filter = s.filter;
    if (moonsChanged) this.rebuildMoons();
    if (selChanged || layoutChanged || first) this.focusCamera(!selChanged);
    E.perf = s.perf;
    this.wake();
  }
  focusCamera(keepUserView) {
    var E = this.E; if (!E || !E.layout) return;
    var full = E.layout.compact ? 28 : 46;
    E.restPhi = E.layout.compact ? 0.62 : 0.8; E.fitFull = this.fit(full, E.layout.compact ? 0.86 : 0.8);
    if (E.disc) { E.distD = this.fit(50, 0.8); E.phiD = 0.8; }
    else if (E.sel === 'whole') { E.distD = this.fit(6.5, 1); E.phiD = 1.05; }
    else if (E.sel) { E.distD = this.fit(7.4, 1); E.phiD = 0.62; if (!keepUserView) { var fp = E.planetById[E.sel].g.position, th = Math.atan2(-fp.x, -fp.z) + 0.25; th += Math.round((E.thetaD - th) / (Math.PI * 2)) * Math.PI * 2; E.thetaD = th; } }
    else { E.distD = E.fitFull; if (!keepUserView) E.phiD = E.restPhi; }
    if (E.reduced) { E.dist = E.distD; E.phi = E.phiD; }
    this.wake(2200);
  }
  engZoom(f) { var E = this.E; if (!E) return; E.distD = this.clampDist(E.distD * f); this.wake(); }
  engReset() { var E = this.E; if (!E) return; E.thetaD = 0.55; E.phiD = E.restPhi || 0.98; E.distD = E.fitFull; this.wake(2200); }
  engProject(kind, id) {
    var E = this.E; if (!E || !E.W) return null;
    var v = E.v3;
    if (kind === 'planet') { var p = E.planetById[id]; if (!p) return null; v.copy(p.g.position); }
    else if (kind === 'center') v.set(0, 0, 0);
    else if (kind === 'moon') { var mm = null; E.moons.forEach(function (m) { if (m.d.id === id && !mm) mm = m; }); if (!mm) return null; v.copy(mm.pos); }
    v.project(E.camera);
    return { x: (v.x + 1) / 2 * E.W, y: (1 - v.y) / 2 * E.H };
  }
  moonParams(ctx) {
    var lite = this.E.lite;
    var K = this.E.BK || 1, sc = function (o) { return { base: o.base * K, step: o.step * K, size: o.size * K }; };
    if (ctx === 'focus') return sc(lite ? { base: 2.3, step: 0.48, size: 0.22 } : { base: 2.1, step: 0.52, size: 0.24 });
    if (ctx === 'featured') return sc(lite ? { base: 2.25, step: 0.56, size: 0.26 } : { base: 2.0, step: 0.6, size: 0.28 });
    return sc(lite ? { base: 2.1, step: 0.27, size: 0.13 } : { base: 1.75, step: 0.32, size: 0.15 });
  }
  featuredFor(n) {
    var self = this, vis = n.links.filter(function (d) { return self.catOk(d); }), pick = [];
    var take = function (fn) { for (var i = 0; i < vis.length; i++) { if (pick.indexOf(vis[i]) < 0 && fn(vis[i])) { pick.push(vis[i]); return; } } };
    take(function (d) { return d.cat === 'medical' || d.cat === 'allied'; });
    take(function (d) { return d.cat === 'nutrition' || d.cat === 'integrative' || d.cat === 'accredited'; });
    take(function (d) { return d.cat === 'coach'; });
    var used = function (c) { return pick.some(function (d) { return d.cat === c; }); };
    if (pick.length < 3) take(function (d) { return !used(d.cat); });
    while (pick.length < Math.min(3, vis.length)) take(function () { return true; });
    return pick;
  }
  rebuildMoons() {
    var E = this.E, self = this, T = E.T, D = this.nidata();
    var focusId = E.sel && E.sel !== 'whole' ? E.sel : null;
    var discD = E.disc ? D.discById[E.disc] : null;
    var want = [];
    var add = function (p, list, ctx) { var pr = self.moonParams(ctx); list.forEach(function (d, k) { want.push({ p: p, d: d, r: pr.base + pr.step * k, size: pr.size, k: k, ctx: ctx }); }); };
    if (focusId) {
      var fp = E.planetById[focusId];
      add(fp, fp.n.links.filter(function (d) { return self.catOk(d); }), 'focus');
      if (discD) discD.systems.forEach(function (id) { if (id !== focusId) add(E.planetById[id], [discD], 'featured'); });
    } else if (discD) discD.systems.forEach(function (id) { add(E.planetById[id], [discD], 'featured'); });
    else if (E.moonsMode === 'featured') E.planets.forEach(function (p) { add(p, self.featuredFor(p.n), 'featured'); });
    else if (E.moonsMode === 'all') E.planets.forEach(function (p) { add(p, p.n.links.filter(function (d) { return self.catOk(d); }), 'all'); });
    var old = {}; E.moons.forEach(function (m) { old[m.key] = m; });
    var next = [], seen = {};
    want.forEach(function (w) {
      var key = w.p.id + ':' + w.d.id; seen[key] = 1;
      var m = old[key];
      if (!m) {
        var r0 = self.seeded((w.p.n.idx + 1) * 131 + D.discs.indexOf(w.d) * 17);
        m = { key: key, p: w.p, d: w.d, mat: new T.Matrix4().makeRotationFromEuler(new T.Euler((r0() - 0.5) * 1.2, r0() * Math.PI * 2, 0, 'YXZ')),
          omega: (0.34 + r0() * 0.34) * (r0() < 0.5 ? -1 : 1), phase: r0() * Math.PI * 2, s: 0, r: w.r, size: w.size, pos: new T.Vector3(), hi: 0 };
      }
      m.rT = w.r; m.sizeT = w.size; m.sT = 1; m.focus = w.ctx === 'focus'; m.omegaK = 0.9 / Math.sqrt(1 + w.k); m.dead = false;
      next.push(m);
    });
    E.moons.forEach(function (m) { if (!seen[m.key]) { m.sT = 0; m.focus = false; next.push(m); } });
    E.moons = next; this.indexMoons();
  }
  indexMoons() {
    var E = this.E, nS = 0, nR = 0;
    E.moons.forEach(function (m) { if (m.d.coach) { m.mesh = E.moonRing; m.i = nR++; } else { m.mesh = E.moonSolid; m.i = nS++; } });
    E.moonSolid.count = Math.min(E.moonCap, nS); E.moonRing.count = Math.min(E.moonCap, nR);
  }
  pick() {
    var E = this.E; if (!E) return null;
    E.raycaster.setFromCamera(E.ndc, E.camera);
    var hits = E.raycaster.intersectObjects(E.pickables, false);
    var first = hits.length ? hits[0] : null, hitDist = first ? first.distance : Infinity;
    // moons are picked in screen space with a generous minimum target (open coach rings have no centre to hit),
    // but only when nothing solid is in front of them
    var px = (E.ndc.x + 1) / 2 * E.W, py = (1 - E.ndc.y) / 2 * E.H, best = null, bestD = 1e9, t = Math.tan(E.camera.fov * Math.PI / 360), v = E.v3;
    E.moons.forEach(function (m) {
      if (m.s < 0.5) return;
      v.copy(m.pos).project(E.camera); if (v.z > 1) return;
      var sx = (v.x + 1) / 2 * E.W, sy = (1 - v.y) / 2 * E.H, dCam = E.camera.position.distanceTo(m.pos);
      var tol = Math.max(m.size / (dCam * t) * E.H / 2 * 1.4, E.touch ? 20 : 12), d = Math.hypot(sx - px, sy - py);
      if (d < tol && d < bestD && dCam < hitDist + m.size) { best = m; bestD = d; }
    });
    if (best) return { kind: 'moon', id: best.d.id, planet: best.p.id };
    if (first && first.object.userData && first.object.userData.kind) return { kind: first.object.userData.kind, id: first.object.userData.id };
    return null;
  }

  frame(now) {
    var E = this.E; if (!E) return;
    E.raf = 0;
    var T = E.T, dt = Math.min(0.05, Math.max(0, (now - (E.last || now)) / 1000)); E.last = now;
    var sp = E.speed, k = E.reduced ? 1 : 1 - Math.exp(-dt * 3.2), kf = 1 - Math.exp(-dt * 6);
    var D = this.nidata();
    var focusId = E.sel && E.sel !== 'whole' ? E.sel : null;
    var anySel = !!(E.sel || E.disc);
    var discD = E.disc ? D.discById[E.disc] : null;
    var hv = E.listHover || E.rayHover;
    // whatever is under the pointer holds still, so it can be read and clicked comfortably
    var holdId = hv ? (hv.kind === 'planet' ? hv.id : (hv.kind === 'moon' && hv.planet ? hv.planet : null)) : null;

    // hover picking (once per frame at most, only after pointer moved)
    if (E.needPick && E.pointerIn) {
      E.needPick = false;
      var hit = this.pick();
      var key = hit ? hit.kind + ':' + hit.id + ':' + (hit.planet || '') : '';
      if (key !== (E.rayKey || '')) { E.rayKey = key; E.rayHover = hit; this.onEngineHover(hit, E.client.x, E.client.y); }
    }

    // orbits: selected ring freezes, others slow while focused
    var self = this;
    E.rings.forEach(function (r, ri) {
      var hasSel = (focusId && E.planetById[focusId].ring === r) || (holdId && E.planetById[holdId] && E.planetById[holdId].ring === r);
      r.scaleT = hasSel ? 0 : (anySel ? 0.18 : 1);
      r.scale += (r.scaleT - r.scale) * kf;
      r.phase += dt * sp * r.omega * r.scale;
      var opT = E.ringHover === ri ? 0.7 : (anySel ? 0.12 : 0.3);
      r.op += (opT - r.op) * kf; r.line.material.opacity = r.op;
    });
    var filt = E.filter && E.filter !== 'all' ? E.filter : null;
    E.planets.forEach(function (p) {
      var r = p.ring, th = p.th0 + r.phase * r.dir;
      p.g.position.set(r.a * Math.cos(th), 0, r.b * Math.sin(th)).applyMatrix4(r.m);
      if (focusId === p.id && !discD) { // turn the signature to face the viewer, then hold
        E.m1.lookAt(E.camera.position, p.g.position, E.camera.up); E.q1.setFromRotationMatrix(E.m1); p.mesh.quaternion.slerp(E.q1, kf * 0.8);
      } else p.mesh.rotation.y += dt * sp * p.spin;
      if (p.halo) p.halo.rotation.z += dt * sp * 0.12;
      var linked = discD && discD.systems.indexOf(p.id) >= 0;
      var isHv = hv && hv.kind === 'planet' && hv.id === p.id;
      var dimT = 0, hiT = 0;
      if (discD) { dimT = linked ? 0 : 0.8; hiT = linked ? 0.9 : 0; }
      else if (focusId) { dimT = focusId === p.id ? 0 : 0.72; hiT = focusId === p.id ? 0.6 : 0; }
      else if (E.sel === 'whole') { dimT = 0.35; }
      else if (filt && !p.n.links.some(function (d) { return d.cat === filt; })) dimT = 0.62;
      if (hv && !isHv && !focusId && !discD && hv.kind === 'planet') dimT = Math.max(dimT, 0.4);
      if (isHv) { hiT = 1; dimT = Math.min(dimT, 0.1); }
      p.dim += (dimT - p.dim) * kf; p.hi += (hiT - p.hi) * kf;
      p.fill += ((focusId === p.id ? 1 : 0) - p.fill) * kf; p.mat.uniforms.uFill.value = p.fill;
      var motT = focusId === p.id ? 1 : (isHv ? 0.95 : (linked ? 0.85 : 0.55)); p.mot += (motT - p.mot) * kf; p.mat.uniforms.uMotifK.value = p.mot;
      p.mat.uniforms.uDim.value = p.dim; p.mat.uniforms.uHi.value = p.hi; p.mat.uniforms.uWarm.value = (1 + 0.25 * (E.br || 0)) * (1 - p.dim * 0.6);
      if (p.atmo) p.atmo.material.uniforms.uI.value = 0.42 * (1 - p.dim) + 0.5 * p.hi;
      if (p.halo) p.halo.material.opacity = 0.32 * (1 - p.dim * 0.8);
    });

    // Whole Person
    E.coreMat.uniforms.uTime.value += dt * (sp || 0.0001);
    var cDim = (focusId || discD) ? 0.6 : 0; E.cDim = (E.cDim || 0) + (cDim - (E.cDim || 0)) * kf;
    E.coreMat.uniforms.uDim.value = E.cDim;
    var cHi = (hv && hv.kind === 'center') || E.sel === 'whole' ? 0.62 : 0.42;
    E.glow.material.uniforms.uI.value += ((cHi * (1 - E.cDim * 0.7)) - E.glow.material.uniforms.uI.value) * kf;
    E.glow.quaternion.copy(E.camera.quaternion); E.logoG.quaternion.copy(E.camera.quaternion);
    E.logoMat.uniforms.uT.value += dt * (sp > 0 ? 1 : 0); E.logoMat.uniforms.uPR.value = E.dpr;
    E.breathT = (E.breathT || 0) + dt * (sp > 0 ? 1 : 0); var br = Math.sin(E.breathT * Math.PI * 2 / 6.5);   // one slow breath every 6.5 s
    E.br = br; E.radiance.quaternion.copy(E.camera.quaternion);
    E.radiance.material.uniforms.uI.value = 0.36 * (1 + 0.38 * br) * (1 - E.cDim * 0.55); E.sun.intensity = 1.6 * (1 + 0.12 * br);
    E.gather = Math.max(0, E.gather - dt * 0.42); E.logoMat.uniforms.uGather.value = E.gather; if (E.gather > 0) E.activeUntil = Math.max(E.activeUntil, now + 300);
    E.logoMat.uniforms.uBreath.value = br; E.logoMat.uniforms.uOp.value = 1 - E.cDim * 0.5;
    E.mark.scale.setScalar(1 + br * 0.05); E.mark.material.opacity = (0.72 + 0.28 * br) * (1 - E.cDim * 0.45) * (1 - E.gather * 0.8);
    if (E.elec) {
      var ePos = E.elec.geometry.attributes.position.array, eA = E.elec.geometry.attributes.aAlpha.array, eOp = 1 - E.cDim * 0.6, ev = E.v3;
      E.dimRings.forEach(function (l, k) {
        l.updateMatrix(); E.elecPh[k] += dt * sp * E.elecW[k];
        var dir = E.elecW[k] > 0 ? 1 : -1;
        for (var j = 0; j < E.elecTail; j++) {
          var aj = E.elecPh[k] - dir * j * 0.022, idx = k * E.elecTail + j;
          ev.set(Math.cos(aj) * E.elecR, 0, Math.sin(aj) * E.elecR).applyMatrix4(l.matrix);
          ePos[idx * 3] = ev.x; ePos[idx * 3 + 1] = ev.y; ePos[idx * 3 + 2] = ev.z;
          eA[idx] = (j === 0 ? 1 : Math.pow(1 - j / E.elecTail, 1.5) * 0.85) * eOp;
        }
      });
      E.elec.geometry.attributes.position.needsUpdate = true; E.elec.geometry.attributes.aAlpha.needsUpdate = true;
    }
    E.dims.rotation.y += dt * sp * 0.022; E.dims.scale.setScalar(1.12 * (1 + 0.02 * br)); E.dims.rotation.z = Math.sin((E.breathT || 0) * 0.07) * 0.08;
    E.dims.children.forEach(function (l) { l.material.opacity = 0.62 * (1 - E.cDim * 0.6); });
    E.dust.rotation.y += dt * sp * 0.006;

    // moons — one instanced draw for solid moons, one for coach rings; no React work per frame
    var moonSlow = focusId ? 0.6 : 1, removed = false, c = E.c1, gi = 0;
    E.moons.forEach(function (m) {
      var msT = m.p.id === holdId && hv.kind === 'moon' ? 0 : moonSlow; m.ms = m.ms == null ? msT : m.ms + (msT - m.ms) * kf;
      m.phase += dt * sp * m.omega * m.omegaK * m.ms;
      m.s += (m.sT - m.s) * (E.reduced ? 1 : kf);
      if (m.sT === 0 && m.s < 0.02) { m.dead = true; removed = true; }
      m.r += (m.rT - m.r) * kf; m.size += (m.sizeT - m.size) * kf;
      var on = (hv && hv.kind === 'moon' && hv.id === m.d.id && (!hv.planet || hv.planet === m.p.id)) || (E.disc === m.d.id);
      m.hi += ((on ? 1 : 0) - m.hi) * kf;
      E.v1.set(Math.cos(m.phase) * m.r, 0, Math.sin(m.phase) * m.r).applyMatrix4(m.mat);
      m.pos.copy(m.p.g.position).add(E.v1);
      var sc = m.size * m.s * (1 + 0.08 * m.hi) * (m.d.coach ? 0.77 : 1);
      if (m.d.coach) E.q1.copy(E.camera.quaternion); else E.q1.set(0, 0, 0, 1);
      E.m1.compose(m.pos, E.q1, E.s1.set(sc, sc, sc));
      m.mesh.setMatrixAt(m.i, E.m1);
      c.copy(E.catColor[m.d.cat]); if (m.hi > 0.01) c.lerp(E.white, 0.25 * m.hi);
      c.lerp(E.paper, m.p.dim * 0.7);
      m.mesh.setColorAt(m.i, c);
      if (m.focus && gi < E.guides.length && m.s > 0.05) {
        var gl = E.guides[gi++];
        gl.matrix.makeTranslation(m.p.g.position.x, m.p.g.position.y, m.p.g.position.z).multiply(m.mat).multiply(E.m1.makeScale(m.r, m.r, m.r));
        gl.material.opacity = (0.14 + 0.3 * m.hi) * m.s; gl.visible = true;
      }
    });
    for (; gi < E.guides.length; gi++) E.guides[gi].visible = false;
    if (removed) { E.moons = E.moons.filter(function (m) { return !m.dead; }); this.indexMoons(); }
    E.moonSolid.instanceMatrix.needsUpdate = true; E.moonRing.instanceMatrix.needsUpdate = true;
    if (E.moonSolid.instanceColor) E.moonSolid.instanceColor.needsUpdate = true;
    if (E.moonRing.instanceColor) E.moonRing.instanceColor.needsUpdate = true;

    // relationship arcs (discipline -> every linked system)
    var origin = focusId ? E.planetById[focusId] : null;
    var targets = discD ? discD.systems.filter(function (id) { return !origin || id !== origin.id; }).map(function (id) { return E.planetById[id]; }) : [];
    if (discD && !origin && targets.length) { origin = targets.shift(); }
    E.arcs.forEach(function (a, i) {
      var tgt = targets[i] || null;
      var opT = tgt ? 0.75 : 0;
      a.op += (opT - a.op) * kf;
      a.line.visible = a.op > 0.01;
      if (tgt) a.to = tgt;
      if (!a.line.visible || !a.to || !origin) return;
      a.line.material.opacity = a.op;
      var A0 = origin.g.position, B0 = a.to.g.position, arr = a.line.geometry.attributes.position.array;
      var mx = (A0.x + B0.x) / 2, my = (A0.y + B0.y) / 2, mz = (A0.z + B0.z) / 2, lift = A0.distanceTo(B0) * 0.28 + 2;
      for (var q = 0; q <= 32; q++) {
        var t = q / 32, u2 = 1 - t, cx = mx * 0.55, cy = my + lift, cz = mz * 0.55;
        arr[q * 3] = u2 * u2 * A0.x + 2 * u2 * t * cx + t * t * B0.x;
        arr[q * 3 + 1] = u2 * u2 * A0.y + 2 * u2 * t * cy + t * t * B0.y;
        arr[q * 3 + 2] = u2 * u2 * A0.z + 2 * u2 * t * cz + t * t * B0.z;
      }
      a.line.geometry.attributes.position.needsUpdate = true;
    });

    // camera
    E.idleT += dt;
    if (sp > 0 && !anySel && E.idleT > 4 && !E.reduced) E.thetaD += dt * 0.018 * sp;
    var tgtV = E.v2.set(0, 0, 0);
    if (focusId && !discD) tgtV.copy(E.planetById[focusId].g.position);
    else if (E.sel === 'whole' && !discD) tgtV.set(0, 0, 0);
    E.target.lerp(tgtV, k);
    E.theta += (E.thetaD - E.theta) * kf; E.phi += (E.phiD - E.phi) * kf; E.dist += (E.distD - E.dist) * k;
    var sph = Math.sin(E.phi);
    E.camera.position.set(E.target.x + E.dist * sph * Math.sin(E.theta), E.target.y + E.dist * Math.cos(E.phi), E.target.z + E.dist * sph * Math.cos(E.theta));
    E.camera.lookAt(E.target);
    E.camLight.position.copy(E.camera.position); E.camLight.intensity += ((focusId && !discD ? 0.32 : 0) - E.camLight.intensity) * kf;
    var L = E.layout, ox = -(L.left - L.right) / 2, oy = (L.bottom - L.top) / 2;
    E.offX += (ox - E.offX) * k; E.offY += (oy - E.offY) * k;
    E.camera.setViewOffset(E.W, E.H, E.offX, E.offY, E.W, E.H);

    E.renderer.render(E.scene, E.camera);

    // floating Whole Person label (direct style write — no React state per frame)
    if (this.wpEl) {
      var v = E.v1.set(0, 0, 0).project(E.camera);
      var sx = (v.x + 1) / 2 * E.W, sy = (1 - v.y) / 2 * E.H;
      var rpx = 3.6 / (E.camera.position.length() * Math.tan(E.camera.fov * Math.PI / 360)) * E.H / 2 * (E.layout.compact ? 1.25 : 1);
      this.wpEl.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + (sy + rpx * 1.0 + 2).toFixed(1) + 'px) translateX(-50%)';
      this.wpEl.style.opacity = (!focusId && !discD) ? ((hv && hv.kind === 'center') ? '1' : '0.86') : '0';
    }

    // performance meter + adaptive resolution
    E.fpsFrames++; E.fpsT += dt;
    if (E.fpsT >= 0.5) {
      E.fps = E.fpsFrames / E.fpsT; E.fpsFrames = 0;
      if (sp > 0 && !document.hidden) {
        if (E.fps < 42 && E.dpr > 1) { E.slowWins++; if (E.slowWins >= 4) { E.dpr = Math.max(1, E.dpr - 0.25); E.renderer.setPixelRatio(E.dpr); E.renderer.setSize(E.W, E.H, false); E.stars.material.uniforms.uPR.value = E.dpr; E.dust.material.uniforms.uPR.value = E.dpr; E.slowWins = 0; } }
        else E.slowWins = 0;
      }
      if (E.perf && this.hudEl) {
        var info = E.renderer.info.render;
        this.hudEl.textContent = (sp > 0 ? Math.round(E.fps) + ' fps · ' + (1000 / Math.max(1, E.fps)).toFixed(1) + ' ms' : 'idle (paused) · loop stopped') +
          '\n' + info.calls + ' draw calls · ' + Math.round(info.triangles / 1000) + 'k tris\nDPR ' + E.dpr.toFixed(2) + ' · tier ' + (E.lite ? 'lite' : 'full') + ' · moons ' + E.moons.length;
      }
      E.fpsT = 0;
    }

    var keep = E.visible && !document.hidden && (sp > 0 || now < E.activeUntil);
    if (keep) E.raf = requestAnimationFrame(E.tick);
    else { E.fpsFrames = 0; E.fpsT = 0; if (E.perf && this.hudEl) this.hudEl.textContent = 'idle · render loop stopped\n0 frames while paused/off-screen'; }
  }
  wake(ms) {
    var E = this.E; if (!E) return;
    E.activeUntil = Math.max(E.activeUntil, performance.now() + (ms || 1600));
    if (!E.raf && E.visible && !document.hidden) { E.last = performance.now(); E.raf = requestAnimationFrame(E.tick); }
  }
  disposeEngine() {
    var E = this.E; if (!E) return;
    if (E.raf) cancelAnimationFrame(E.raf);
    (E.listeners || []).forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    if (E.io) E.io.disconnect();
    E.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    E.renderer.dispose(); try { E.renderer.forceContextLoss(); } catch (e) {}
    this.E = null;
  }

  /* ---------------- markup (ported 1:1 from the design template) ---------------- */
  render() {
    const v = this.renderVals();
    return (
      <div ref={v.rootRef} onKeyDown={v.onKey} style={css(`position: relative; width: 100%; height: ${v.h}px; overflow: hidden; background: radial-gradient(ellipse 80% 72% at 52% 48%, #FFFFFF 0%, #F8F6F2 46%, #ECE6DA 100%); color: #14201A; font-family: var(--ni-font-ui, 'DM Sans'), system-ui, sans-serif; -webkit-font-smoothing: antialiased`)}>
        {v.showPoster ? (
          <>
            <svg aria-hidden="true" viewBox="-420 -300 840 600" preserveAspectRatio="xMidYMid meet" style={css("position: absolute; inset: 0; width: 100%; height: 100%")}>
              {(v.posterRings || []).map((r, $index) => (
                <React.Fragment key={$index}>
                  <ellipse cx="0" cy="0" rx={r.rx} ry={r.ry} fill="none" stroke="rgba(184,147,90,0.32)" strokeWidth="1"></ellipse>
                </React.Fragment>
              ))}
              <circle cx="0" cy="0" r="40" fill="rgba(201,166,107,0.12)"></circle>
              <circle cx="0" cy="0" r="22" fill="#C9A66B"></circle>
              {(v.posterDots || []).map((p, $index) => (
                <React.Fragment key={$index}>
                  <circle cx={p.x} cy={p.y} r={p.r} fill={p.c}></circle>
                </React.Fragment>
              ))}
            </svg>
          </>
        ) : null}
        <canvas ref={v.canvasRef} role="img" aria-label="Interactive 3D galaxy: Uniquely You at the centre, surrounded by four orbits of body systems, functional networks and whole-person influences. Use the system list to explore by keyboard." style={css(`position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; opacity: ${v.canvasOpacity}; transition: opacity 700ms ease; cursor: ${v.cursor}`)}></canvas>
        <div ref={v.wpRef} aria-hidden="true" style={css("position: absolute; left: 0; top: 0; transform: translate(-9999px, 0); padding: 4px 14px; pointer-events: none; text-align: center; will-change: transform, opacity; transition: opacity 600ms ease")}>
          <div ref={v.phraseRef} style={css(`padding: 6px 22px; border-radius: 999px; background: radial-gradient(ellipse at center, rgba(251,249,244,0.9) 0%, rgba(251,249,244,0.75) 45%, rgba(251,249,244,0) 75%); font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: ${v.wpSize}px; font-style: italic; font-weight: 500; line-height: 1.15; color: #1E2F24; white-space: nowrap; text-shadow: 0 0 14px rgba(255,253,249,0.95), 0 0 4px rgba(255,253,249,0.9); transition: opacity 1100ms ease`)}>
            Uniquely You
          </div>
        </div>
        <header style={css(`position: absolute; left: ${v.pad}px; top: ${v.pad}px; right: ${v.pad}px; max-width: 760px; pointer-events: none`)}>
          <div style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #8A6A35")}>
            Natural Intelligence · Living Galaxy
          </div>
          <h1 style={css(`margin: 10px 0 6px; font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-weight: 500; font-size: ${v.h1Size}px; line-height: 1.04; letter-spacing: -0.01em; color: #14201A`)}>
            Different expertise. One integrated you.
          </h1>
          <p style={css(`margin: 0; font-size: ${v.subSize}px; line-height: 1.45; color: rgba(20,32,26,0.78)`)}>
            One body. Interconnected systems. Connected expertise.
          </p>
        </header>
        {v.showHint ? (
          <>
            <div style={css("position: absolute; right: 32px; top: 34px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px")}>
              <p style={css("margin: 0; max-width: 300px; text-align: right; font-size: 13px; line-height: 1.5; color: rgba(20,32,26,0.72)")}>
                Small moons are the professional expertise orbiting each system. Drag to rotate · scroll to zoom · select a system to meet all of it.
              </p>
              <button type="button" onClick={v.togglePerf} aria-pressed={v.perf} style={css("min-height: 32px; padding: 4px 12px; border: 1px solid rgba(184,147,90,0.35); border-radius: 999px; background: rgba(255,253,249,0.7); color: #7A5A2A; font: 500 11px/1 var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; letter-spacing: 0.08em; cursor: pointer")}>
                {v.perfLabel}
              </button>
            </div>
          </>
        ) : null}
        {v.perf ? (
          <>
            <div ref={v.hudRef} aria-live="off" style={css(v.hudStyle)}>
              measuring…
            </div>
          </>
        ) : null}
        {v.navVisible ? (
          <>
            <nav aria-label="Galaxy navigation" style={css(v.navStyle)}>
              {v.compact ? (
                <>
                  <div style={css("display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 4px 4px 12px; border-bottom: 1px solid rgba(184,147,90,0.18); margin-bottom: 6px")}>
                    <div role="group" aria-label="Practitioner moons" style={css("display: flex; gap: 4px; padding: 3px; border: 1px solid rgba(184,147,90,0.28); border-radius: 999px")}>
                      {(v.moonOpts || []).map((m, $index) => (
                        <React.Fragment key={$index}>
                          <button type="button" onClick={m.pick} aria-pressed={m.on} style={css(m.style)}>
                            {m.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <label style={css("display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(20,32,26,0.78)")}>
                      {"Speed "}
                      <input type="range" min="0.25" max="2" step="0.25" value={v.speed} onChange={v.onSpeed} aria-valuetext={v.speedLabel} style={css("width: 96px; accent-color: #B8935A")} />
                      <span style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 11px; color: #7A5A2A")}>
                        {v.speedLabel}
                      </span>
                    </label>
                    <button type="button" onClick={v.togglePerf} aria-pressed={v.perf} style={css("min-height: 40px; padding: 0 12px; border: 1px solid rgba(184,147,90,0.35); border-radius: 999px; background: transparent; color: #7A5A2A; font: 500 11px/1 var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; cursor: pointer")}>
                      {v.perfLabel}
                    </button>
                  </div>
                </>
              ) : null}
              <label style={css("display: flex; flex-direction: column; gap: 6px; padding: 4px 4px 10px; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A6A35")}>
                {"Filter expertise "}
                <select value={v.filter} onChange={v.onFilter} style={css("min-height: 40px; padding: 6px 10px; border: 1px solid rgba(184,147,90,0.35); border-radius: 10px; background: #FFFFFF; color: #14201A; font: 500 14px/1.2 var(--ni-font-ui, 'DM Sans'), system-ui, sans-serif; letter-spacing: 0; text-transform: none")}>
                  <option value="all">
                    All expertise
                  </option>
                  <option value="medical">
                    Medical specialists
                  </option>
                  <option value="allied">
                    Regulated & allied
                  </option>
                  <option value="nutrition">
                    Nutrition
                  </option>
                  <option value="integrative">
                    Naturopathic & functional
                  </option>
                  <option value="accredited">
                    Accredited practitioners
                  </option>
                  <option value="coach">
                    Coaching (non-clinical)
                  </option>
                </select>
              </label>
              <div aria-label="Moon key" style={css("margin: 0 4px 12px; padding: 10px 12px; border: 1px solid rgba(184,147,90,0.18); border-radius: 12px")}>
                <div style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A6A35")}>
                  Moons · expertise
                </div>
                <ul style={css("list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px")}>
                  {(v.moonKey || []).map((mk, $index) => (
                    <React.Fragment key={$index}>
                      <li style={css("display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.3; color: rgba(20,32,26,0.82)")}>
                        <span aria-hidden="true" style={css(mk.glyph)}></span>
                        {mk.label}
                      </li>
                    </React.Fragment>
                  ))}
                </ul>
              </div>
              <button type="button" onClick={v.pickWhole} onMouseEnter={v.hoverWhole} onMouseLeave={v.unhover} onFocus={v.hoverWhole} onBlur={v.unhover} aria-pressed={v.wholeOn} style={css(v.wholeStyle)}>
                <span aria-hidden="true" style={css("width: 14px; height: 14px; flex: none; border-radius: 50%; background: #C9A66B; box-shadow: 0 0 0 4px rgba(210,178,122,0.22)")}></span>
                <span style={css("display: flex; flex-direction: column; gap: 2px")}>
                  <span style={css("font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: 19px; font-weight: 600; line-height: 1.1")}>
                    Uniquely You
                  </span>
                  <span style={css("font-size: 12px; color: rgba(20,32,26,0.7)")}>
                    The centre of every orbit
                  </span>
                </span>
              </button>
              {(v.groups || []).map((g, $index) => (
                <React.Fragment key={$index}>
                  <section aria-label={g.aria} style={css("margin-top: 14px")}>
                    <div onMouseEnter={g.enter} onMouseLeave={g.leave} style={css("padding: 0 6px")}>
                      <h2 style={css("margin: 0; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: 20px; font-weight: 600; line-height: 1.15; color: #14201A")}>
                        <span>
                          {g.name}
                        </span>
                        <span style={css("flex: none; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.1em; color: rgba(20,32,26,0.6)")}>
                          {g.count}
                        </span>
                      </h2>
                      <p style={css("margin: 4px 0 6px; font-size: 12.5px; line-height: 1.45; color: rgba(20,32,26,0.7)")}>
                        {g.blurb}
                      </p>
                    </div>
                    <ul style={css("list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px")}>
                      {(g.nodes || []).map((n, $index) => (
                        <React.Fragment key={$index}>
                          <li>
                            <button type="button" onClick={n.pick} onMouseEnter={n.enter} onMouseLeave={n.leave} onFocus={n.enter} onBlur={n.leave} aria-pressed={n.on} style={css(n.style)}>
                              <span aria-hidden="true" style={css(n.dot)}></span>
                              <span style={css("flex: 1")}>
                                {n.name}
                              </span>
                              <span style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 11px; color: rgba(20,32,26,0.55)")}>
                                {n.moons}
                              </span>
                            </button>
                          </li>
                        </React.Fragment>
                      ))}
                    </ul>
                  </section>
                </React.Fragment>
              ))}
              <p style={css("margin: 18px 6px 6px; font-size: 12px; line-height: 1.5; color: rgba(20,32,26,0.66)")}>
                An NI educational navigation model — not an anatomical hierarchy or ranking of importance, and not a diagnostic or treatment tool.
              </p>
            </nav>
          </>
        ) : null}
        {v.panelOpen ? (
          <>
            <aside aria-label="Details" style={css(v.panelStyle)}>
              {v.sysMode ? (
                <>
                  <div style={css("display: flex; flex-direction: column; gap: 14px")}>
                    <button type="button" onClick={v.back} style={css(v.backStyle)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"></path>
                      </svg>
                      Whole galaxy
                    </button>
                    <div>
                      <div style={css("display: flex; align-items: center; gap: 10px; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #8A6A35")}>
                        <span aria-hidden="true" style={css(v.sys.dot)}></span>
                        {v.sys.eyebrow}
                      </div>
                      <h2 style={css("margin: 8px 0 0; font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: 36px; font-weight: 500; line-height: 1.05; color: #14201A")}>
                        {v.sys.name}
                      </h2>
                    </div>
                    {v.sys.hasSig ? (
                      <>
                        <figure style={css("margin: 0; display: flex; align-items: center; gap: 14px; padding: 10px 12px; border: 1px solid rgba(184,147,90,0.22); border-radius: 12px")}>
                          <canvas ref={v.sigRef} width="112" height="112" aria-hidden="true" style={css("width: 56px; height: 56px; flex: none")}></canvas>
                          <figcaption style={css("font-size: 12.5px; line-height: 1.5; color: rgba(20,32,26,0.74)")}>
                            {v.sys.sigNote}
                          </figcaption>
                        </figure>
                      </>
                    ) : null}
                    <p style={css("margin: 0; font-size: 15px; line-height: 1.6; color: rgba(20,32,26,0.86)")}>
                      {v.sys.desc}
                    </p>
                    {v.sys.isWhole ? (
                      <>
                        <ul style={css("list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px")}>
                          {(v.sys.dims || []).map((d, $index) => (
                            <React.Fragment key={$index}>
                              <li style={css("display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid rgba(184,147,90,0.2); border-radius: 10px; font-size: 14px")}>
                                <span aria-hidden="true" style={css(d.dot)}></span>
                                {d.name}
                              </li>
                            </React.Fragment>
                          ))}
                        </ul>
                        <p style={css("margin: 0; font-size: 14px; line-height: 1.6; color: rgba(20,32,26,0.78)")}>
                          Different professionals see different parts of the picture. NI helps them work as one care team around you — each within their own scope.
                        </p>
                      </>
                    ) : null}
                    {v.sys.hasExp ? (
                      <>
                        <div style={css("display: flex; justify-content: space-between; align-items: baseline; padding-top: 6px; border-top: 1px solid rgba(184,147,90,0.2)")}>
                          <h3 style={css("margin: 10px 0 0; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: #8A6A35")}>
                            Relevant expertise
                          </h3>
                          <span style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 11px; color: rgba(20,32,26,0.6)")}>
                            {v.sys.expCount}
                          </span>
                        </div>
                        {(v.sys.expGroups || []).map((eg, $index) => (
                          <React.Fragment key={$index}>
                            <div style={css("display: flex; flex-direction: column; gap: 4px")}>
                              <div style={css("display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(20,32,26,0.7)")}>
                                <span aria-hidden="true" style={css(eg.glyph)}></span>
                                {eg.label}
                              </div>
                              <ul style={css("list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px")}>
                                {(eg.items || []).map((it, $index) => (
                                  <React.Fragment key={$index}>
                                    <li>
                                      <button type="button" onClick={it.pick} onMouseEnter={it.enter} onMouseLeave={it.leave} onFocus={it.enter} onBlur={it.leave} style={css(it.style)}>
                                        <span style={css("display: flex; flex-direction: column; gap: 3px; flex: 1")}>
                                          <span style={css("font-size: 15px; font-weight: 500; color: #14201A")}>
                                            {it.name}
                                          </span>
                                          <span style={css("font-size: 12px; color: rgba(20,32,26,0.66)")}>
                                            {it.meta}
                                          </span>
                                        </span>
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(210,178,122,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M9 6l6 6-6 6"></path>
                                        </svg>
                                      </button>
                                    </li>
                                  </React.Fragment>
                                ))}
                              </ul>
                            </div>
                          </React.Fragment>
                        ))}
                      </>
                    ) : null}
                    {v.sys.emptyFiltered ? (
                      <>
                        <p style={css("margin: 0; padding: 12px; border: 1px dashed rgba(184,147,90,0.35); border-radius: 10px; font-size: 14px; color: rgba(20,32,26,0.8)")}>
                          {"No "}{v.filterLabel}{" expertise is linked to this system in the current model."}
                        </p>
                      </>
                    ) : null}
                    <p style={css("margin: 4px 0 0; padding: 12px 14px; border-radius: 10px; background: rgba(20,32,26,0.05); font-size: 12.5px; line-height: 1.55; color: rgba(20,32,26,0.74)")}>
                      Professionals shown may support aspects of this area within their own scope. Coaches support habits and goals; they do not diagnose or treat. For new or worsening symptoms, start with your GP or NHS 111.
                    </p>
                  </div>
                </>
              ) : null}
              {v.discMode ? (
                <>
                  <div style={css("display: flex; flex-direction: column; gap: 14px")}>
                    <button type="button" onClick={v.back} style={css(v.backStyle)}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"></path>
                      </svg>
                      {v.disc.backLabel}
                    </button>
                    <div>
                      <div style={css("display: flex; align-items: center; gap: 10px; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #8A6A35")}>
                        <span aria-hidden="true" style={css(v.disc.glyph)}></span>
                        {v.disc.catLabel}
                      </div>
                      <h2 style={css("margin: 8px 0 0; font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: 34px; font-weight: 500; line-height: 1.05; color: #14201A")}>
                        {v.disc.name}
                      </h2>
                    </div>
                    {v.disc.isCoach ? (
                      <>
                        <div style={css("align-self: flex-start; padding: 6px 12px; border: 1px solid rgba(231,214,180,0.5); border-radius: 999px; font-size: 12.5px; font-weight: 500; color: #7A5A2A")}>
                          Non-clinical role · does not diagnose or treat
                        </div>
                      </>
                    ) : null}
                    <dl style={css("margin: 0; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 8px 12px; font-size: 14px; line-height: 1.5")}>
                      <dt style={css("color: rgba(20,32,26,0.62)")}>
                        Register
                      </dt>
                      <dd style={css("margin: 0; color: #14201A")}>
                        {v.disc.reg}
                      </dd>
                      <dt style={css("color: rgba(20,32,26,0.62)")}>
                        Typical role
                      </dt>
                      <dd style={css("margin: 0; color: #14201A")}>
                        {v.disc.role}
                      </dd>
                    </dl>
                    <p style={css("margin: 0; font-size: 15px; line-height: 1.6; color: rgba(20,32,26,0.86)")}>
                      {v.disc.scope}
                    </p>
                    <div style={css("padding-top: 6px; border-top: 1px solid rgba(184,147,90,0.2)")}>
                      <h3 style={css("margin: 10px 0 8px; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: #8A6A35")}>
                        {"Linked across "}{v.disc.count}{" areas"}
                      </h3>
                      <ul style={css("list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px")}>
                        {(v.disc.systems || []).map((ls, $index) => (
                          <React.Fragment key={$index}>
                            <li>
                              <button type="button" onClick={ls.pick} onMouseEnter={ls.enter} onMouseLeave={ls.leave} onFocus={ls.enter} onBlur={ls.leave} style={css(ls.style)}>
                                <span aria-hidden="true" style={css(ls.dot)}></span>
                                <span style={css("flex: 1")}>
                                  {ls.name}
                                </span>
                              </button>
                            </li>
                          </React.Fragment>
                        ))}
                      </ul>
                    </div>
                    <div style={css("padding: 14px; border: 1px dashed rgba(184,147,90,0.35); border-radius: 12px; font-size: 13px; line-height: 1.55; color: rgba(20,32,26,0.74)")}>
                      [Verified NI practitioner profiles in this discipline appear here once the directory is connected — eligibility is checked against registration and scope.]
                    </div>
                  </div>
                </>
              ) : null}
            </aside>
          </>
        ) : null}
        {v.tip.show ? (
          <>
            <div role="tooltip" style={css(v.tip.style)}>
              <div style={css("font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A6A35")}>
                {v.tip.eyebrow}
              </div>
              <div style={css("margin-top: 4px; font-family: var(--ni-font-display, 'Cormorant Garamond'), Georgia, serif; font-size: 22px; font-weight: 600; line-height: 1.1; color: #14201A")}>
                {v.tip.name}
              </div>
              <div style={css("margin-top: 6px; font-size: 13px; line-height: 1.5; color: rgba(20,32,26,0.82)")}>
                {v.tip.desc}
              </div>
            </div>
          </>
        ) : null}
        <div role="toolbar" aria-label="Galaxy controls" style={css(v.barStyle)}>
          {v.compact ? (
            <>
              <button type="button" onClick={v.toggleSheet} aria-expanded={v.sheetOpenAria} style={css("flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid rgba(184,147,90,0.35); border-radius: 12px; background: rgba(184,147,90,0.12); color: #14201A; font: 600 14px/1.2 var(--ni-font-ui, 'DM Sans'), system-ui, sans-serif; text-align: left; cursor: pointer")}>
                <span style={css("flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap")}>
                  {v.sheetLabel}
                </span>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={v.sheetChevron}></path>
                </svg>
              </button>
            </>
          ) : null}
          <button type="button" onClick={v.togglePause} aria-label={v.pauseLabel} style={css(v.iconBtn)}>
            {v.paused ? (
              <>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 5l12 7-12 7z"></path>
                </svg>
              </>
            ) : null}
            {v.playing ? (
              <>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 5v14M16 5v14"></path>
                </svg>
              </>
            ) : null}
            {v.wide ? (
              <>
                <span style={css("font-size: 13px; font-weight: 500")}>
                  {v.pauseText}
                </span>
              </>
            ) : null}
          </button>
          {v.wide ? (
            <>
              <label style={css("display: flex; align-items: center; gap: 10px; padding: 0 6px; font-size: 13px; color: rgba(20,32,26,0.8)")}>
                {"Speed "}
                <input type="range" min="0.25" max="2" step="0.25" value={v.speed} onChange={v.onSpeed} aria-valuetext={v.speedLabel} style={css("width: 92px; accent-color: #B8935A")} />
                <span style={css("width: 38px; font-family: var(--ni-font-mono, 'JetBrains Mono'), ui-monospace, monospace; font-size: 11.5px; color: #7A5A2A")}>
                  {v.speedLabel}
                </span>
              </label>
              <div role="group" aria-label="Practitioner moons" style={css("display: flex; align-items: center; gap: 4px; padding: 3px; border: 1px solid rgba(184,147,90,0.28); border-radius: 999px")}>
                <span style={css("padding: 0 8px 0 10px; font-size: 13px; color: rgba(20,32,26,0.8)")}>
                  Moons
                </span>
                {(v.moonOpts || []).map((m, $index) => (
                  <React.Fragment key={$index}>
                    <button type="button" onClick={m.pick} aria-pressed={m.on} style={css(m.style)}>
                      {m.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          ) : null}
          <button type="button" onClick={v.zoomOut} aria-label="Zoom out" style={css(v.iconBtn)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 12h14"></path>
            </svg>
          </button>
          <button type="button" onClick={v.zoomIn} aria-label="Zoom in" style={css(v.iconBtn)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </button>
          <button type="button" onClick={v.reset} aria-label="Reset view" style={css(v.iconBtn)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 1 0 2.6-5.9"></path>
              <path d="M4 4v4h4"></path>
            </svg>
            {v.wide ? (
              <>
                <span style={css("font-size: 13px; font-weight: 500")}>
                  Reset
                </span>
              </>
            ) : null}
          </button>
        </div>
        {v.showFoot ? (
          <>
            <p style={css("position: absolute; left: 32px; bottom: 30px; margin: 0; max-width: 276px; font-size: 11.5px; line-height: 1.5; color: rgba(20,32,26,0.62)")}>
              Educational discovery, not diagnosis or treatment advice.
            </p>
          </>
        ) : null}
        <div aria-live="polite" style={css("position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap")}>
          {v.announce}
        </div>
      </div>
    );
  }
}
