// Site motion. Pages stay fully readable without this file.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saved = null;
  try { saved = localStorage.getItem('motion'); } catch (e) { /* storage unavailable */ }
  var motionOn = saved ? saved === 'on' : !reduced;
  var listeners = [];
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function setMotion(on, remember) {
    motionOn = on;
    root.setAttribute('data-motion', on ? 'on' : 'off');
    var button = document.querySelector('.motion-toggle');
    if (button) {
      button.textContent = on ? 'Pause motion' : 'Play motion';
      button.setAttribute('aria-pressed', String(!on));
    }
    if (remember) { try { localStorage.setItem('motion', on ? 'on' : 'off'); } catch (e) { /* ignore */ } }
    listeners.forEach(function (fn) { fn(on); });
  }

  function sizeCanvas(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    return { w: rect.width, h: rect.height, dpr: dpr };
  }

  // Home banner: microbe shapes drift, pass through a data pipeline, and reach a small model.
  // Illustration only: every position is random, and nothing here represents data or results.
  function pipeline(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var host = canvas.parentElement;
    var GATE = 0.65, INPUT = 0.74;
    var COLORS = ['94,234,212', '125,180,240', '220,232,245'];
    var layers = [{ u: INPUT, n: 5 }, { u: 0.82, n: 6 }, { u: 0.89, n: 4 }, { u: 0.96, n: 2 }];
    var nodes = [], edges = [];
    layers.forEach(function (layer, l) {
      layer.ids = [];
      for (var j = 0; j < layer.n; j++) {
        layer.ids.push(nodes.length);
        nodes.push({ l: l, u: layer.u, v: 0.5 + (j - (layer.n - 1) / 2) * 0.125, glow: 0 });
      }
    });
    layers.slice(0, -1).forEach(function (layer, l) {
      layer.ids.forEach(function (a) {
        layers[l + 1].ids.forEach(function (b) { edges.push([a, b]); });
      });
    });

    var dims, wide = true, visible = true, raf = 0, last = 0, time = 0, nextSample = 0;
    var pointer = { x: -9999, y: -9999 };
    var floaters = [], samples = [], pulses = [];
    var rand = function (a, b) { return a + Math.random() * (b - a); };

    function makeMicrobe() {
      var kind = Math.random();
      return {
        kind: kind < 0.5 ? 'rod' : (kind < 0.78 ? 'round' : 'pair'),
        size: rand(3.2, 6.6), len: rand(8, 17), tail: Math.random() < 0.4,
        angle: rand(0, 6.28), spin: rand(-0.14, 0.14), ph: rand(0, 6.28),
        color: COLORS[Math.floor(Math.random() * 3)]
      };
    }
    function floater() {
      var m = makeMicrobe();
      m.u = rand(0, GATE); m.v = rand(0.02, 0.98); m.du = rand(-0.004, 0.006); m.dv = rand(-0.006, 0.006);
      m.alpha = rand(0.4, 0.8);
      return m;
    }
    function P(u, v) { return wide ? { x: u * dims.w, y: v * dims.h } : { x: v * dims.w, y: u * dims.h }; }
    function drawMicrobe(m, x, y, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(m.angle);
      ctx.fillStyle = 'rgba(' + m.color + ',' + alpha * 0.28 + ')';
      ctx.strokeStyle = 'rgba(' + m.color + ',' + alpha + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (m.kind === 'rod') {
        var half = m.len / 2;
        ctx.arc(half, 0, m.size, -1.571, 1.571);
        ctx.arc(-half, 0, m.size, 1.571, 4.712);
        ctx.closePath();
      } else if (m.kind === 'pair') {
        ctx.arc(-m.size * 0.92, 0, m.size, 0, 6.29);
        ctx.moveTo(m.size * 1.92, 0);
        ctx.arc(m.size * 0.92, 0, m.size, 0, 6.29);
      } else {
        ctx.arc(0, 0, m.size * 1.2, 0, 6.29);
      }
      ctx.fill();
      ctx.stroke();
      if (m.tail && m.kind === 'rod') {
        ctx.beginPath();
        var start = -m.len / 2 - m.size;
        ctx.moveTo(start, 0);
        for (var i = 1; i <= 8; i++) ctx.lineTo(start - i * 2.3, Math.sin(time * 3 + m.ph + i * 0.9) * 2.4);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
    function newSample() {
      var m = makeMicrobe();
      m.node = layers[0].ids[Math.floor(Math.random() * layers[0].n)];
      m.u0 = rand(-0.04, 0.3); m.v0 = rand(0.04, 0.96); m.t = 0; m.dur = rand(7, 10);
      m.gateV = 0.5 + (nodes[m.node].v - 0.5) * 0.62;
      samples.push(m);
    }
    function firePulse(from) {
      var next = layers[nodes[from].l + 1];
      if (!next || pulses.length > 44) return;
      pulses.push({ a: from, b: next.ids[Math.floor(Math.random() * next.n)], t: 0, dur: rand(0.55, 0.9) });
    }
    function advance(dt) {
      time += dt;
      nextSample -= dt;
      if (nextSample <= 0 && samples.length < 34) { newSample(); nextSample = rand(0.28, 0.62); }
      floaters.forEach(function (m) {
        m.u += m.du * dt; m.v += m.dv * dt; m.angle += m.spin * dt;
        if (m.u < -0.03) m.u = GATE; else if (m.u > GATE) m.u = -0.03;
        if (m.v < -0.03) m.v = 1.03; else if (m.v > 1.03) m.v = -0.03;
      });
      for (var i = samples.length - 1; i >= 0; i--) {
        var s = samples[i];
        s.t += dt / s.dur;
        s.angle += s.spin * dt;
        if (s.t >= 1) {
          nodes[s.node].glow = 1;
          firePulse(s.node); firePulse(s.node);
          samples.splice(i, 1);
        }
      }
      for (var k = pulses.length - 1; k >= 0; k--) {
        var p = pulses[k];
        p.t += dt / p.dur;
        if (p.t >= 1) {
          nodes[p.b].glow = 1;
          firePulse(p.b);
          pulses.splice(k, 1);
        }
      }
      nodes.forEach(function (n) { n.glow = Math.max(0, n.glow - dt * 1.3); });
    }
    function tube(node) {
      var gateV = 0.5 + (node.v - 0.5) * 0.62, a = P(GATE, gateV), b = P(node.u, node.v);
      var span = node.u - GATE, c1 = P(GATE + span / 3, gateV), c2 = P(GATE + span * 2 / 3, node.v);
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    }
    function draw() {
      ctx.clearRect(0, 0, dims.w, dims.h);
      floaters.forEach(function (m) {
        var q = P(m.u, m.v);
        var dx = q.x - pointer.x, dy = q.y - pointer.y, d2 = dx * dx + dy * dy, push = 0;
        if (d2 < 26000) push = (1 - d2 / 26000) * 26;
        var d = Math.sqrt(d2) || 1;
        drawMicrobe(m, q.x + dx / d * push + Math.sin(time * 0.6 + m.ph) * 3, q.y + dy / d * push + Math.cos(time * 0.5 + m.ph) * 3, m.alpha);
      });

      // The pipeline: a gate that tidies samples, then one lane into each input of the model.
      // On smaller screens it runs behind the text, so it drops the gate and stays faint.
      if (wide) {
        var g1 = P(GATE, 0.27), g2 = P(GATE, 0.73);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(94,234,212,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      ctx.strokeStyle = wide ? 'rgba(94,234,212,0.26)' : 'rgba(94,234,212,0.13)';
      ctx.lineWidth = wide ? 7 : 5;
      ctx.beginPath();
      layers[0].ids.forEach(function (id) { tube(nodes[id]); });
      ctx.stroke();

      // The model.
      ctx.strokeStyle = 'rgba(150,190,235,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      edges.forEach(function (e) {
        var a = P(nodes[e[0]].u, nodes[e[0]].v), b = P(nodes[e[1]].u, nodes[e[1]].v);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      });
      ctx.stroke();
      pulses.forEach(function (p) {
        var a = nodes[p.a], b = nodes[p.b];
        var q0 = P(a.u, a.v), q1 = P(b.u, b.v);
        var head = p.t, tail = Math.max(0, p.t - 0.28);
        ctx.strokeStyle = 'rgba(94,234,212,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(q0.x + (q1.x - q0.x) * tail, q0.y + (q1.y - q0.y) * tail);
        ctx.lineTo(q0.x + (q1.x - q0.x) * head, q0.y + (q1.y - q0.y) * head);
        ctx.stroke();
      });
      nodes.forEach(function (n) {
        var q = P(n.u, n.v), r = 6.5;
        if (n.glow > 0) {
          ctx.fillStyle = 'rgba(94,234,212,' + n.glow * 0.3 + ')';
          ctx.beginPath(); ctx.arc(q.x, q.y, r + 6 + n.glow * 9, 0, 6.29); ctx.fill();
        }
        ctx.fillStyle = 'rgb(' + Math.round(13 + 81 * n.glow) + ',' + Math.round(35 + 199 * n.glow) + ',' + Math.round(66 + 146 * n.glow) + ')';
        ctx.strokeStyle = 'rgba(167,243,228,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 6.29); ctx.fill(); ctx.stroke();
      });

      // Samples: organic microbes before the gate, tidy data points after it.
      samples.forEach(function (s) {
        var q;
        if (s.t < 0.62) {
          var f = s.t / 0.62, e = f * f * (3 - 2 * f);
          q = P(s.u0 + (GATE - s.u0) * e, s.v0 + (s.gateV - s.v0) * e + Math.sin(f * 6 + s.ph) * 0.012 * (1 - f));
          drawMicrobe(s, q.x, q.y, 0.9);
        } else {
          var n = nodes[s.node], g = (s.t - 0.62) / 0.38, eg = g * g * (3 - 2 * g);
          // Stay on the lane's curve: it runs flat from the gate, then flat into the node.
          q = P(GATE + (n.u - GATE) * g, s.gateV + (n.v - s.gateV) * eg);
          ctx.fillStyle = '#d9fff7';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.8, 0, 6.29); ctx.fill();
        }
      });
    }
    function setup() {
      dims = sizeCanvas(canvas);
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      wide = dims.w >= 1280; // below this the name would overlap the model, so the scene runs top to bottom
    }
    function populate(count) {
      floaters = [];
      for (var i = 0; i < count; i++) floaters.push(floater());
    }
    var slowFrames = 0;
    function loop(now) {
      raf = 0;
      if (!motionOn || !visible) { last = 0; return; }
      var gap = last ? now - last : 16;
      last = now;
      slowFrames = gap > 34 && gap < 200 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 40 && floaters.length > 10) { floaters.length = Math.floor(floaters.length * 0.65); slowFrames = 0; }
      advance(Math.min(gap / 1000, 0.1));
      draw();
      raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (motionOn && visible && !raf) raf = requestAnimationFrame(loop);
      if (!motionOn) draw();
    }

    setup();
    populate(wide ? 34 : 20);
    for (var n = 0; n < 150; n++) advance(0.1); // start mid-flow, never on an empty scene
    draw();
    kick();

    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; kick(); }).observe(canvas);
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (Math.abs(canvas.getBoundingClientRect().width - dims.w) < 2) return; // ignore phone toolbar changes
        setup(); draw();
      }, 200);
    });
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () { pointer.x = pointer.y = -9999; });
    listeners.push(kick);
  }

  // Contact band: points drift and connect, signals pass between them, and the visitor's
  // pointer joins as one more point. Purely decorative.
  function network(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var host = canvas.parentElement;
    var dims, reach, nodes = [], pulses = [], visible = true, raf = 0, last = 0, nextPulse = 0, slowFrames = 0;
    var pointer = { x: 0, y: 0, on: false };

    function linked(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
      return d < reach ? 1 - d / reach : 0;
    }
    function neighbours(i) {
      var out = [];
      nodes.forEach(function (n, j) { if (j !== i && linked(nodes[i], n) > 0.08) out.push(j); });
      return out;
    }
    function setup() {
      var old = dims;
      dims = sizeCanvas(canvas);
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      reach = clamp(dims.w * 0.15, 110, 190);
      if (old && nodes.length) {
        nodes.forEach(function (n) { n.x *= dims.w / old.w; n.y *= dims.h / old.h; });
        return;
      }
      var count = Math.round(clamp(dims.w * dims.h / 11000, 24, 64));
      for (var i = 0; i < count; i++) {
        // Wide screens keep more points to the right, clear of the heading.
        var along = dims.w >= 900 ? Math.pow(Math.random(), 0.62) : Math.random();
        nodes.push({
          x: along * dims.w, y: Math.random() * dims.h,
          vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14,
          r: 2.2 + Math.random() * 3, glow: 0, major: Math.random() < 0.22
        });
      }
    }
    function send(from, hops) {
      if (pulses.length > 26) return;
      var options = neighbours(from);
      if (!options.length) return;
      pulses.push({ a: from, b: options[Math.floor(Math.random() * options.length)], t: 0, hops: hops });
    }
    function advance(dt) {
      nodes.forEach(function (n) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < 0 || n.x > dims.w) { n.vx *= -1; n.x = clamp(n.x, 0, dims.w); }
        if (n.y < 0 || n.y > dims.h) { n.vy *= -1; n.y = clamp(n.y, 0, dims.h); }
        n.glow = Math.max(0, n.glow - dt * 1.1);
      });
      nextPulse -= dt;
      if (nextPulse <= 0) { send(Math.floor(Math.random() * nodes.length), 3); nextPulse = 0.35 + Math.random() * 0.5; }
      for (var i = pulses.length - 1; i >= 0; i--) {
        var p = pulses[i];
        p.t += dt / 0.8;
        if (p.t >= 1) {
          nodes[p.b].glow = 1;
          if (p.hops > 0) send(p.b, p.hops - 1);
          pulses.splice(i, 1);
        }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, dims.w, dims.h);
      ctx.lineWidth = 1;
      var i, j, s;
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          s = linked(nodes[i], nodes[j]);
          if (s <= 0) continue;
          ctx.strokeStyle = 'rgba(150,200,235,' + s * 0.42 + ')';
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
        }
      }
      if (pointer.on) {
        nodes.forEach(function (n) {
          var dx = n.x - pointer.x, dy = n.y - pointer.y, d = Math.sqrt(dx * dx + dy * dy), range = reach * 1.25;
          if (d >= range) return;
          ctx.strokeStyle = 'rgba(94,234,212,' + (1 - d / range) * 0.75 + ')';
          ctx.beginPath(); ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(n.x, n.y); ctx.stroke();
        });
      }
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(94,234,212,0.9)';
      pulses.forEach(function (p) {
        var a = nodes[p.a], b = nodes[p.b], tail = Math.max(0, p.t - 0.3);
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
        ctx.lineTo(a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t);
        ctx.stroke();
      });
      nodes.forEach(function (n) {
        if (n.glow > 0) {
          ctx.fillStyle = 'rgba(94,234,212,' + n.glow * 0.28 + ')';
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 5 + n.glow * 9, 0, 6.29); ctx.fill();
        }
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = 'rgba(167,243,228,0.85)';
        ctx.fillStyle = n.glow > 0.05 ? '#5eead4' : (n.major ? '#a7f3e4' : '#0d2342');
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.29); ctx.fill(); ctx.stroke();
      });
      if (pointer.on) {
        ctx.fillStyle = '#5eead4';
        ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 4, 0, 6.29); ctx.fill();
      }
    }
    function loop(now) {
      raf = 0;
      if (!motionOn || !visible) { last = 0; return; }
      var gap = last ? now - last : 16;
      last = now;
      slowFrames = gap > 34 && gap < 200 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 40 && nodes.length > 18) {
        nodes.length = Math.floor(nodes.length * 0.75);
        pulses = [];
        slowFrames = 0;
      }
      advance(Math.min(gap / 1000, 0.1));
      draw();
      raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (motionOn && visible && !raf) raf = requestAnimationFrame(loop);
      if (!motionOn) draw();
    }

    setup();
    for (var n = 0; n < 60; n++) advance(0.1); // start with signals already moving
    draw();
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; kick(); }).observe(canvas);
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (Math.abs(canvas.getBoundingClientRect().width - dims.w) < 2) return; // ignore phone toolbar changes
        setup(); draw();
      }, 200);
    });
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true;
      if (!motionOn) draw();
    });
    host.addEventListener('pointerleave', function () { pointer.on = false; if (!motionOn) draw(); });
    listeners.push(kick);
  }

  // Illustration that follows the story text. It uses made-up dot positions and shows no data.
  function story() {
    var canvas = document.querySelector('.story-canvas');
    var steps = [].slice.call(document.querySelectorAll('.story-step'));
    if (!canvas || !steps.length) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function dots(n, cx, spreadX) {
      var out = [];
      for (var i = 0; i < n; i++) out.push({
        x: clamp(cx + (rnd() - 0.5) * spreadX, 0.05, 0.95), y: 0.08 + rnd() * 0.84,
        ph: rnd() * 6.28, r: 3 + rnd() * 2.6,
        sx: 0.1 + rnd() * 0.8, sy: 0.08 + rnd() * 0.84
      });
      return out;
    }
    var control = dots(34, 0.25, 0.4), cancer = dots(34, 0.75, 0.4), rings = dots(16, 0.5, 0.52);
    var target = { sort: 0, line: 0, rings: 0, drift: 0 };
    var cur = { sort: 0, line: 0, rings: 0, drift: 0 };
    var stages = [
      { sort: 1, line: 0, rings: 0, drift: 0 },
      { sort: 1, line: 1, rings: 0, drift: 0 },
      { sort: 1, line: 1, rings: 1, drift: 0 },
      { sort: 1, line: 1, rings: 1, drift: 1 }
    ];
    var dims, time = 0, raf = 0, visible = false, current = 0, hold = 0;
    // One column: the illustration scrolls away with the page, so it plays the steps by itself.
    var oneColumn = window.matchMedia('(max-width: 900px)');
    var nowLabel = document.querySelector('.story-now');

    function resize() {
      dims = sizeCanvas(canvas);
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    }
    function ease(v) { return v * v * (3 - 2 * v); }
    function boundary(y) { return 0.5 + 0.035 * Math.sin(y * 5.4 + 0.6); }

    function draw() {
      var w = dims.w, h = dims.h, y, i, d, x, py, wob;
      ctx.clearRect(0, 0, w, h);
      var line = ease(cur.line), sort = ease(cur.sort);

      if (line > 0) {
        ctx.beginPath();
        ctx.moveTo(w, 0); ctx.lineTo(w, h);
        for (y = 1; y >= 0; y -= 0.02) ctx.lineTo(boundary(y) * w, y * h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(94,234,212,' + 0.075 * line + ')';
        ctx.fill();
      }
      function plot(list, color) {
        ctx.fillStyle = color;
        for (i = 0; i < list.length; i++) {
          d = list[i];
          wob = 0.006;
          x = d.sx + (d.x - d.sx) * sort + Math.sin(time * 0.9 + d.ph) * wob;
          py = d.sy + (d.y - d.sy) * sort + Math.cos(time * 0.7 + d.ph) * wob;
          ctx.beginPath(); ctx.arc(x * w, py * h, d.r, 0, 6.29); ctx.fill();
        }
      }
      plot(control, '#a9bdd2');
      plot(cancer, '#5eead4');

      if (line > 0) {
        ctx.beginPath();
        var limit = line;
        for (y = 0; y <= limit; y += 0.012) {
          if (y === 0) ctx.moveTo(boundary(y) * w, 0); else ctx.lineTo(boundary(y) * w, y * h);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      var ringAmount = cur.rings, drift = ease(cur.drift);
      if (ringAmount > 0.01) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.8;
        for (i = 0; i < rings.length; i++) {
          d = rings[i];
          var arrive = ease(clamp(ringAmount * 1.7 - (i / rings.length) * 0.7, 0, 1));
          if (arrive <= 0) continue;
          x = d.x + Math.sin(time * 0.75 + d.ph * 3) * (0.008 + 0.12 * drift);
          py = 1.12 + (d.y - 1.12) * arrive + Math.cos(time * 0.55 + d.ph) * 0.012;
          ctx.globalAlpha = arrive;
          ctx.beginPath(); ctx.arc(x * w, py * h, 5.6, 0, 6.29); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    function settle() { Object.keys(cur).forEach(function (k) { cur[k] = target[k]; }); }
    // Based on elapsed time, so the illustration keeps pace even at a low frame rate.
    var lastFrame = 0;
    function loop(now) {
      raf = 0;
      if (!motionOn || !visible) { lastFrame = 0; return; }
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 1) : 0.016;
      lastFrame = now;
      time += Math.min(dt, 0.1);
      if (oneColumn.matches) {
        hold += dt;
        if (hold >= (current === stages.length - 1 ? 6 : 3.6)) { hold = 0; activate((current + 1) % stages.length); }
      }
      var k = 1 - Math.exp(-dt * 2.4);
      Object.keys(cur).forEach(function (key) { cur[key] += (target[key] - cur[key]) * k; });
      draw();
      raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (motionOn && visible && !raf) raf = requestAnimationFrame(loop);
      if (!motionOn) {
        // Paused in one column: no scrolling drives the steps, so show the whole picture.
        if (oneColumn.matches && current !== stages.length - 1) { activate(stages.length - 1); return; }
        settle(); draw();
      }
    }
    function activate(n) {
      current = n;
      steps.forEach(function (s, i) { s.classList.toggle('is-active', i === n); });
      if (nowLabel) nowLabel.textContent = 'Showing step ' + (n + 1) + ' of ' + stages.length;
      target = stages[n] || stages[0];
      kick();
    }

    resize();
    activate(0);
    settle();
    draw();
    var io = new IntersectionObserver(function (entries) {
      if (oneColumn.matches) return;
      entries.forEach(function (e) { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
    }, { rootMargin: '-46% 0px -46% 0px' });
    steps.forEach(function (s) { io.observe(s); });
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; kick(); }).observe(canvas);
    window.addEventListener('resize', function () { resize(); draw(); });
    listeners.push(kick);
  }

  // Scroll-linked touches: reading line, question text, and timeline fill.
  function scrollEffects() {
    var bar = document.querySelector('.progress-line');
    var lit = document.querySelector('.lit');
    var words = [];
    if (lit) {
      var parts = lit.textContent.trim().split(/\s+/);
      lit.textContent = '';
      parts.forEach(function (word, i) {
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = word;
        lit.appendChild(span);
        if (i < parts.length - 1) lit.appendChild(document.createTextNode(' '));
        words.push(span);
      });
    }
    var stagesEl = document.querySelector('.stages');
    var ticking = false;

    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var doc = root.scrollHeight - vh;
      if (bar) bar.style.setProperty('--scroll', doc > 0 ? clamp(window.scrollY / doc, 0, 1) : 0);
      if (lit) {
        var r = lit.getBoundingClientRect();
        var progress = motionOn ? clamp((vh * 0.88 - r.top) / (r.height + vh * 0.42), 0, 1) : 1;
        words.forEach(function (w, i) {
          var at = (i + 1) / words.length;
          w.style.setProperty('--o', clamp(0.2 + (progress - at + 0.12) / 0.12 * 0.8, 0.2, 1));
        });
      }
      if (stagesEl) {
        var s = stagesEl.getBoundingClientRect();
        // The filled line stops at the current stage, so it never overstates progress.
        var nowEl = stagesEl.querySelector('.stage-progress');
        var max = nowEl ? (nowEl.getBoundingClientRect().top - s.top + 18) / (s.height || 1) : 1;
        var fill = motionOn ? clamp((vh * 0.75 - s.top) / (s.height || 1), 0, max) : max;
        stagesEl.style.setProperty('--fill', fill);
      }
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    listeners.push(request);
    update();
  }

  function reveals() {
    var items = [].slice.call(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function init() {
    setMotion(motionOn, false);
    var button = document.querySelector('.motion-toggle');
    if (button) button.addEventListener('click', function () {
      root.classList.add('intro-done'); // the opening animation must not replay on Play
      setMotion(!motionOn, true);
    });
    [].forEach.call(document.querySelectorAll('.network'), network);
    [].forEach.call(document.querySelectorAll('.pipeline'), pipeline);
    story();
    scrollEffects();
    reveals();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
