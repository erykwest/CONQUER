'use strict';
// Read-only 3D cartographic preview. The World Lab iframe remains the authoritative editor.
(function() {
  const frame = document.getElementById('regionalSource');
  const surface = document.getElementById('preview3d');
  const canvas = document.getElementById('terrain3d');
  const spritesCanvas = document.getElementById('treeBillboards');
  const notes = document.getElementById('perfNotes');
  const status = document.getElementById('sceneStatus');
  const quality = document.getElementById('detail');
  const yaw = document.getElementById('yaw');
  const pitch = document.getElementById('pitch');
  const zoom = document.getElementById('zoom');
  const showTrees = document.getElementById('showTrees');
  const showBorders = document.getElementById('showBorders');
  const geometry = window.ConquerRegion3DGeometry;
  // Recolor only the canopy fill of the seven Builder SVG trees; their silhouettes and trunks stay intact.
  const treeImages = Array.from({ length: 7 }, (_, i) => {
    const image = new Image();
    const path = '../src/assets/forest/tree_0' + (i + 1) + '_' +
      ['tonda','affusolata','conica','ombrello','goccia','stratificata','asimmetrica'][i] + '.svg';
    image.onload = () => { if (scene) draw(); };
    const canopy = ['#567649','#476a46','#648153','#517245','#587744','#476d59','#657b4b'][i];
    fetch(path).then(r => {
      if (!r.ok) throw Error('sprite ' + r.status);
      return r.text();
    }).then(svg => {
      const blob = new Blob([svg.replace(/#3B5174/gi, canopy)], { type:'image/svg+xml' });
      const objectUrl = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(objectUrl); if (scene) draw(); };
      image.src = objectUrl;
    }).catch(() => { image.src = path; });
    return image;
  });
  let gl, program, vertexBuffer, locations, scene = null, snapshot = null, seenRevision = -1;
  let lastFrameMs = 0, lastUploadMs = 0, lastSyncMs = 0, rebuilding = false, needsRedraw = false;

  const vertexShader = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 aPosition; in vec3 aColor;',
    'uniform vec2 uCenter; uniform vec2 uScreen; uniform vec2 uYaw;',
    'uniform float uPitch; uniform float uScale;',
    'out vec3 vColor;',
    'void main() {',
    ' vec2 p=aPosition.xy-uCenter;',
    ' float x=p.x*uYaw.x-p.y*uYaw.y;',
    ' float y=p.x*uYaw.y+p.y*uYaw.x;',
    ' float sy=y*sin(uPitch)-aPosition.z*cos(uPitch);',
    ' float depth=y*cos(uPitch)+aPosition.z*sin(uPitch);',
    ' gl_Position=vec4(2.0*x*uScale/uScreen.x, -2.0*sy*uScale/uScreen.y, -depth/7000.0, 1.0);',
    ' vColor=aColor;',
    '}'
  ].join('\n');
  const fragmentShader = [
    '#version 300 es',
    'precision mediump float;',
    'in vec3 vColor; out vec4 outputColor;',
    'void main() { outputColor=vec4(pow(vColor,vec3(0.92)),1.0); }'
  ].join('\n');
  function makeShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initialize() {
    gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: false });
    if (!gl) throw Error('WebGL2 non disponibile: resta utilizzabile la mappa 2D.');
    program = gl.createProgram();
    gl.attachShader(program, makeShader(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const attrs = ['aPosition', 'aColor'], uniforms = ['uCenter', 'uScreen', 'uYaw', 'uPitch', 'uScale'];
    locations = Object.fromEntries([...attrs, ...uniforms].map(name => [
      name, attrs.includes(name) ? gl.getAttribLocation(program, name) : gl.getUniformLocation(program, name)
    ]));
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(locations.aPosition);
    gl.vertexAttribPointer(locations.aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(locations.aColor);
    gl.vertexAttribPointer(locations.aColor, 3, gl.FLOAT, false, 24, 12);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clearColor(.075, .105, .114, 1);
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      status.textContent = 'Contesto WebGL perso. Ricaricare questa anteprima.';
      gl = null;
    });
  }
  function resize() {
    const rect = surface.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * ratio));
    const h = Math.max(1, Math.round(rect.height * ratio));
    for (const c of [canvas, spritesCanvas]) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
    if (scene) draw();
  }
  function camera() {
    const rad = Math.PI / 180;
    const angle = Number(yaw.value) * rad;
    const p = Number(pitch.value) * rad;
    const width = canvas.width, height = canvas.height;
    const spanX = Math.abs(snapshot.width * Math.cos(angle)) + Math.abs(snapshot.height * Math.sin(angle));
    const spanY = Math.abs(snapshot.width * Math.sin(angle)) + Math.abs(snapshot.height * Math.cos(angle));
    const fit = Math.min(width / (spanX + 70), height / (spanY * Math.sin(p) + 85));
    return {
      width, height, angle, pitch: p,
      cos: Math.cos(angle), sin: Math.sin(angle),
      scale: fit * Number(zoom.value),
      cx: snapshot.width / 2, cy: snapshot.height / 2
    };
  }
  function project(point, c) {
    const dx = point.x - c.cx, dy = point.y - c.cy;
    const x = dx * c.cos - dy * c.sin, y = dx * c.sin + dy * c.cos;
    return {
      x: c.width / 2 + x * c.scale,
      y: c.height / 2 + (y * Math.sin(c.pitch) - (point.z || 0) * Math.cos(c.pitch)) * c.scale,
      depth: y * Math.cos(c.pitch) + (point.z || 0) * Math.sin(c.pitch)
    };
  }
  function overlay(c) {
    const ctx = spritesCanvas.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (showBorders.checked || snapshot.rivers?.length) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const rivers = new Set(snapshot.rivers || []);
      const automatic = new Set(snapshot.generatedRiverEdges || []);
      for (const edge of snapshot.edges || []) {
        const ids = edge.macroIds || [];
        const river = (ids.length === 2 && rivers.has(ids.slice().sort((a, b) => a - b).join('-'))) ||
          automatic.has(geometryKey(edge.start, edge.end));
        if (!river && (!showBorders.checked || ids.length !== 2)) continue;
        const a = project({ ...edge.start, z: .15 }, c), b = project({ ...edge.end, z: .15 }, c);
        ctx.strokeStyle = river ? '#76c9d4' : 'rgba(37,40,33,.44)';
        ctx.lineWidth = river ? Math.max(1.4, c.scale * 2.2) : .8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    if (showTrees.checked) {
      const trees = scene.trees.map(t => ({ t, p: project(t, c) }))
        .sort((a, b) => a.p.depth - b.p.depth);
      for (const { t, p } of trees) {
        const image = treeImages[t.variant];
        if (!image.complete || !image.naturalWidth) continue;
        const size = Math.max(3, t.size * c.scale);
        if (p.x < -size || p.y < -size || p.x > c.width + size || p.y > c.height + size) continue;
        ctx.globalAlpha = .94;
        ctx.drawImage(image, p.x - size / 2, p.y - size * .86, size, size);
      }
      ctx.globalAlpha = 1;
    }
  }
  function geometryKey(a, b) {
    const one = a.x.toFixed(3) + ',' + a.y.toFixed(3);
    const two = b.x.toFixed(3) + ',' + b.y.toFixed(3);
    return one < two ? one + '|' + two : two + '|' + one;
  }
  function draw() {
    if (!gl || !scene || !snapshot) return;
    const begin = performance.now();
    const c = camera();
    gl.viewport(0, 0, c.width, c.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.uniform2f(locations.uCenter, c.cx, c.cy);
    gl.uniform2f(locations.uScreen, c.width, c.height);
    gl.uniform2f(locations.uYaw, c.cos, c.sin);
    gl.uniform1f(locations.uPitch, c.pitch);
    gl.uniform1f(locations.uScale, c.scale);
    gl.drawArrays(gl.TRIANGLES, 0, scene.vertices.length / 6);
    overlay(c);
    lastFrameMs = performance.now() - begin;
    notes.textContent = scene.stats.territories + ' territori · ' + scene.stats.subcells + ' sottocelle · ' +
      scene.stats.triangles.toLocaleString('it-IT') + ' triangoli · ' +
      scene.stats.mountains + ' montagne · ' + scene.stats.trees + ' alberi · ' +
      scene.stats.generationMs.toFixed(0) + ' ms mesh CPU · ' + lastUploadMs.toFixed(1) +
      ' ms upload GPU · ' + lastFrameMs.toFixed(1) + ' ms draw CPU';
  }
  function rebuild() {
    if (!snapshot || !gl || rebuilding) return;
    rebuilding = true;
    try {
      status.textContent = 'Genero mesh locale (i territori originali restano invariati)…';
      const next = geometry.buildScene(snapshot, Number(quality.value));
      const uploadBegin = performance.now();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, next.vertices, gl.STATIC_DRAW);
      lastUploadMs = performance.now() - uploadBegin;
      scene = next;
      status.textContent = 'WebGL2 attivo · dettaglio visivo ' + quality.value + '× · biomi originali, nessuna modifica al gameplay';
      draw();
    } catch (error) {
      status.textContent = 'Errore anteprima: ' + error.message;
      console.error(error);
    } finally {
      rebuilding = false;
    }
  }
  function syncFromSource() {
    try {
      const w = frame.contentWindow;
      const revision = w?.ConquerRegion3DRevision;
      if (!revision || revision === seenRevision) return;
      const source = w.ConquerRegion3DSnapshot?.();
      if (!source) return;
      snapshot = source;
      seenRevision = revision;
      lastSyncMs = performance.now();
      rebuild();
    } catch (e) {
      status.textContent = 'La mappa sorgente deve essere aperta sullo stesso dominio: ' + e.message;
    }
  }
  function benchmark() {
    if (!snapshot || rebuilding) return;
    const actual = Number(quality.value), variants = [1, 20];
    const results = [];
    try {
      for (const count of variants) {
        const t = performance.now(), sceneTest = geometry.buildScene(snapshot, count);
        results.push(count + '×: ' + (performance.now() - t).toFixed(0) + ' ms · ' +
          sceneTest.stats.triangles.toLocaleString('it-IT') + ' triangoli');
      }
      document.getElementById('benchmarkResult').textContent = results.join(' | ') +
        ' — CPU locale, non FPS né test GPU cross-device.';
    } catch (e) {
      document.getElementById('benchmarkResult').textContent = e.message;
    }
    quality.value = String(actual);
  }

  for (const input of [yaw, pitch, zoom, showTrees, showBorders]) input.addEventListener('input', draw);
  quality.addEventListener('change', rebuild);
  document.getElementById('refresh').addEventListener('click', () => {
    seenRevision = -1; syncFromSource();
  });
  document.getElementById('benchmark').addEventListener('click', benchmark);
  frame.addEventListener('load', () => { seenRevision = -1; syncFromSource(); });
  try {
    initialize();
    resize();
    new ResizeObserver(resize).observe(surface);
    window.setInterval(syncFromSource, 700);
    status.textContent = 'Attendo la generazione della mappa originale…';
  } catch (e) {
    status.textContent = e.message;
  }
})();
