'use strict';
// Read-only 3D cartographic preview. The World Lab iframe remains the authoritative editor.
(function() {
  const frame = document.getElementById('regionalSource');
  const surface = document.getElementById('preview3d');
  const canvas = document.getElementById('terrain3d');
  const spritesCanvas = document.getElementById('treeBillboards');
  const markerCanvas = document.getElementById('markerBillboards');
  const markerLegend = document.getElementById('markerLegend');
  const notes = document.getElementById('perfNotes');
  const status = document.getElementById('sceneStatus');
  const selectedTerritory = document.getElementById('selectedTerritory');
  const quality = document.getElementById('detail');
  const deformation = document.getElementById('deformation');
  const showTrees = document.getElementById('showTrees');
  const showReeds = document.getElementById('showReeds');
  const showBorders = document.getElementById('showBorders');
  const showExamples = document.getElementById('showExamples');
  const resetView = document.getElementById('resetView');
  const geometry = window.ConquerRegion3DGeometry;
  const placeholder = window.ConquerRegionalPlaceholders;
  // Reuse the Builder's real Blender scatter geometry; bake only two reed mesh sprites once.
  const scatterModels = window.ConquerScatterModel;
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
  let liveMarkers=[],exampleMarkers=[],lastMarkerDraw=0;
  const reedSprites = ['reedBed','reedClump'].map(makeReedSprite);
  function makeReedSprite(name) {
    if (!scatterModels?.assets?.[name]) return null;
    const asset=scatterModels.assets[name], palette=scatterModels.palette;
    const sprite=document.createElement('canvas');
    sprite.width=160; sprite.height=256;
    const ctx=sprite.getContext('2d');
    if (!ctx) return null;
    const vertex=i=>{
      const x=asset.v[3*i], y=asset.v[3*i+1], z=asset.v[3*i+2];
      return {x:80+(x-y)*105, y:235+(x+y)*18-z*330, d:x+y+z*.9};
    };
    const faces=[];
    for (let t=0;t<asset.i.length;t+=3){
      const a=vertex(asset.i[t]),b=vertex(asset.i[t+1]),c=vertex(asset.i[t+2]);
      faces.push({a,b,c,color:palette[asset.c[t/3]]||'#6b7a38',
                  d:(a.d+b.d+c.d)/3});
    }
    faces.sort((a,b)=>a.d-b.d);
    for (const face of faces) {
      ctx.beginPath();
      ctx.moveTo(face.a.x,face.a.y);
      ctx.lineTo(face.b.x,face.b.y);
      ctx.lineTo(face.c.x,face.c.y);
      ctx.closePath();
      ctx.fillStyle=face.color;
      ctx.fill();
    }
    return sprite;
  }
  let lastFrameMs = 0, lastUploadMs = 0, lastSyncMs = 0, rebuilding = false, needsRedraw = false;
  // Same projection and camera conventions as the Settlement Builder.
  const ISO_X = .8660254, ISO_Y = .5, ISO_Z = .9;
  const ORBIT_PX_PER_TURN = 160; // Builder: 160 px for 90 degrees.
  let panX = 0, panY = 0, viewRotation = 0, viewZoom = 1;
  let interaction = null;
  let selectedIds = new Set(), lastSelectionKey = '';

  const vertexShader = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 aPosition; in vec3 aColor;',
    'uniform vec2 uCenter; uniform vec2 uScreen; uniform vec2 uYaw; uniform vec2 uPan;',
    'uniform float uScale;',
    'out vec3 vColor;',
    'void main() {',
    ' vec2 p=aPosition.xy-uCenter;',
    ' vec2 q=vec2(p.x*uYaw.x-p.y*uYaw.y,p.x*uYaw.y+p.y*uYaw.x);',
    ' vec2 iso=vec2((q.x-q.y)*0.8660254,(q.x+q.y)*0.5-aPosition.z*0.9);',
    ' float depth=q.x+q.y+0.9*aPosition.z;',
    ' gl_Position=vec4(2.0*(iso.x*uScale+uPan.x)/uScreen.x, -2.0*(iso.y*uScale+uPan.y)/uScreen.y, -depth/7000.0, 1.0);',
    ' vColor=aColor;',
    '}'
  ].join('\n');
  const fragmentShader = [
    '#version 300 es',
    'precision mediump float;',
    'in vec3 vColor; out vec4 outputColor;',
    'void main() { outputColor=vec4(vColor,1.0); }'
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
    const attrs = ['aPosition', 'aColor'], uniforms = ['uCenter', 'uScreen', 'uYaw', 'uScale', 'uPan'];
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
    for (const c of [canvas, spritesCanvas, markerCanvas]) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
    if (scene) draw();
  }
  function camera() {
    const width = canvas.width, height = canvas.height, angle = viewRotation;
    // Fixed builder assonometric elevation. Rotation never changes scale.
    const fit = Math.min(
      width / (ISO_X * (snapshot.width + snapshot.height) + 70),
      height / (ISO_Y * (snapshot.width + snapshot.height) + 85)
    );
    return {
      width, height, angle,
      cos: Math.cos(angle), sin: Math.sin(angle),
      scale: fit * viewZoom,
      panX: panX * width / Math.max(1, surface.clientWidth),
      panY: panY * height / Math.max(1, surface.clientHeight),
      cx: snapshot.width / 2, cy: snapshot.height / 2
    };
  }
  function project(point, c) {
    const dx = point.x - c.cx, dy = point.y - c.cy;
    const qx = dx * c.cos - dy * c.sin, qy = dx * c.sin + dy * c.cos;
    return {
      x: c.width / 2 + (qx - qy) * ISO_X * c.scale + c.panX,
      y: c.height / 2 + ((qx + qy) * ISO_Y - (point.z || 0) * ISO_Z) * c.scale + c.panY,
      depth: qx + qy + (point.z || 0) * ISO_Z
    };
  }
  function groundPointAtScreenCenter() {
    // Inverse of the Builder's ground projection: stable orbit pivot after panning.
    const c = camera();
    const difference = -c.panX / (c.scale * ISO_X), sum = -c.panY / (c.scale * ISO_Y);
    const qx = (difference + sum) / 2, qy = (sum - difference) / 2;
    return { x: c.cx + qx * c.cos + qy * c.sin,
             y: c.cy - qx * c.sin + qy * c.cos, z: 0 };
  }
  function keepAnchorAtScreenCenter(anchor) {
    const c = camera(), projected = project(anchor, c);
    panX += (c.width / 2 - projected.x) * surface.clientWidth / c.width;
    panY += (c.height / 2 - projected.y) * surface.clientHeight / c.height;
  }
  function updateSelection(ids, force = false) {
    const next = [...new Set((ids || []).map(Number))].filter(Number.isInteger).sort((a,b)=>a-b);
    const key = next.join(',');
    if(!force && key===lastSelectionKey) return;
    selectedIds = new Set(next);
    lastSelectionKey = key;
    if(selectedTerritory) {
      selectedTerritory.textContent = !next.length ? 'Clic sinistro: seleziona territorio · Maiusc + clic: selezione multipla' :
        next.length===1 ? 'Territorio selezionato: '+(snapshot?.names?.[next[0]] || ('#'+next[0])) +
        ' · 8 slot (NO,N,NE,O,E,SO,S,SE): ' +
        (snapshot?.neighbors8?.[next[0]]||[]).map(id=>id===null?'—':(snapshot?.names?.[id]||('#'+id))).join(', ') :
        next.length+' territori selezionati';
    }
    draw();
  }
  function syncSelection() {
    if(!snapshot) return;
    try {
      const source = frame.contentWindow?.ConquerRegion3DSelection?.();
      if(Array.isArray(source)) updateSelection(source);
    } catch(e) {
      console.warn('Impossibile sincronizzare la selezione del World Lab:',e);
    }
  }
  function paintSelected(c, ctx, pixelRatio) {
    if(!selectedIds.size || !scene.pickRanges) return;
    const v=scene.vertices;
    ctx.beginPath();
    for(const range of scene.pickRanges) {
      if(!selectedIds.has(range.macroId))continue;
      for(let i=range.firstVertex;i<range.firstVertex+range.vertexCount;i+=3) {
        const a=project({x:v[i*6],y:v[i*6+1],z:v[i*6+2]},c);
        const b=project({x:v[(i+1)*6],y:v[(i+1)*6+1],z:v[(i+1)*6+2]},c);
        const d=project({x:v[(i+2)*6],y:v[(i+2)*6+1],z:v[(i+2)*6+2]},c);
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(d.x,d.y);ctx.closePath();
      }
    }
    ctx.fillStyle='rgba(229,168,63,.20)';
    ctx.fill();
  }
  function outlineSelected(c, ctx, pixelRatio) {
    if(!selectedIds.size)return;
    ctx.beginPath();
    for(const edge of scene.borders || []) {
      const ids=edge.macroIds||[];
      if(!ids.some(id=>selectedIds.has(id)))continue;
      // Shared edges between two selected territories are not part of the selection outline.
      if(ids.length===2 && ids.every(id=>selectedIds.has(id)))continue;
      const a=project({...edge.start,z:.4},c), b=project({...edge.end,z:.4},c);
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    }
    ctx.strokeStyle='#f2cf83';
    ctx.lineWidth=2.7*pixelRatio;
    ctx.stroke();
  }
  function refreshMarkerLegend() {
    if(!markerLegend || !placeholder)return;
    const real=placeholder.counts(liveMarkers),demo=placeholder.counts(showExamples.checked?exampleMarkers:[]);
    const actual=Object.values(real).reduce((a,b)=>a+b,0);
    const sample=Object.values(demo).reduce((a,b)=>a+b,0);
    markerLegend.textContent =
      'Cubo arancione: villaggio · Cubo grigio: castello · Striscia marrone: porto · '+
      'Rettangolo marrone: nave · 2 cilindri: truppe · '+
      actual+' simboli reali'+(sample?' · '+sample+' esempi dimostrativi':'');
  }
  function drawMarkers(now=performance.now()) {
    if(!markerCanvas)return;
    const ctx=markerCanvas.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,markerCanvas.width,markerCanvas.height);
    if(!snapshot || !scene || !placeholder)return;
    const markers=showExamples.checked?liveMarkers.concat(exampleMarkers):liveMarkers;
    if(!markers.length)return;
    const c=camera();
    placeholder.paint(ctx,markers,point=>project(point,c),c,now);
  }
  function syncLiveMarkers(){
    if(!placeholder || !frame.contentWindow)return;
    try {
      // Read changing fleet/army coordinates without regenerating 13k microcells.
      const raw=frame.contentWindow.ConquerRegion3DMarkerSnapshot?.()||[];
      liveMarkers=placeholder.normalize(raw);
      refreshMarkerLegend();
      drawMarkers();
    } catch(e) { console.warn('Regional 3D marker data bridge:',e); }
  }
  function animatePlaceholders(now){
    // Only the small upper icon canvas is redrawn while test ships sail;
    // the expensive terrain mesh and thousands of tree billboards stay cached.
    if(scene && showExamples.checked && now-lastMarkerDraw>45){
      lastMarkerDraw=now;drawMarkers(now);
    }
    window.requestAnimationFrame(animatePlaceholders);
  }
  function overlay(c) {
    const ctx = spritesCanvas.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const pixelRatio = c.width / Math.max(1, surface.clientWidth);
    paintSelected(c,ctx,pixelRatio);

    if (showBorders.checked) {
      // These are the *new* shared boundaries of microcells grouped by owner,
      // not the old straight macro Voronoi polygons. Draw after terrain.
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const edge of scene.borders || []) {
        const a=project({ ...edge.start,z:.24 },c), b=project({ ...edge.end,z:.24 },c);
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      }
      ctx.lineWidth = 1.05 * pixelRatio;
      ctx.strokeStyle = 'rgba(24,34,29,.75)';
      ctx.stroke();

      ctx.beginPath();
      for (const edge of scene.coastlines || []) {
        const a=project({ ...edge.start,z:.3 },c), b=project({ ...edge.end,z:.3 },c);
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      }
      ctx.lineWidth = 1.6 * pixelRatio;
      ctx.strokeStyle = 'rgba(221,203,160,.83)';
      ctx.stroke();
    }
    // The renderer must only draw derived ORGANIC macro seams, never source
    // 2D river segments: those straight edges no longer match warped territory borders.
    ctx.beginPath();
    for (const edge of scene.riverEdges || []) {
      const a=project({...edge.start,z:.39},c);
      const b=project({...edge.end,z:.39},c);
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(b.x,b.y);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#76c9d4';
    ctx.lineWidth = 2.2 * pixelRatio;
    ctx.stroke();

    // Sort forest trees and marsh reed beds together so camera yaw has stable overlap.
    const scatter=[];
    const collect=(items,kind)=>{
      for(const t of items||[]){
        const p=project(t,c),size=Math.max(3,t.size*c.scale);
        if(p.x < -size || p.y < -size || p.x > c.width+size || p.y > c.height+size) continue;
        scatter.push({t,p,size,kind});
      }
    };
    if(showTrees.checked)collect(scene.trees,'tree');
    if(showReeds.checked)collect(scene.reeds,'reed');
    scatter.sort((a,b)=>a.p.depth-b.p.depth);
    ctx.globalAlpha=.96;
    for(const {t,p,size,kind} of scatter){
      if(kind==='tree'){
        const image=treeImages[t.variant];
        if(!image.complete || !image.naturalWidth)continue;
        ctx.drawImage(image,p.x-size/2,p.y-size*.86,size,size);
      }else{
        const image=reedSprites[t.variant];
        if(!image)continue;
        ctx.drawImage(image,p.x-size*.3125,p.y-size*.94,size*.625,size);
      }
    }
    ctx.globalAlpha=1;
    // Highlight must remain visible above vegetation and optional borders.
    outlineSelected(c,ctx,pixelRatio);

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
    gl.uniform1f(locations.uScale, c.scale);
    gl.uniform2f(locations.uPan, c.panX, c.panY);
    gl.drawArrays(gl.TRIANGLES, 0, scene.vertices.length / 6);
    overlay(c);
    drawMarkers();
    lastFrameMs = performance.now() - begin;
    notes.textContent = scene.stats.territories + ' territori · ' + scene.stats.subcells + ' sottocelle · ' +
      scene.stats.triangles.toLocaleString('it-IT') + ' triangoli · ' +
      scene.stats.mountains + ' montagne innevate · ' + (scene.stats.hills||0) + ' colline tronco-piramidali · ' + scene.stats.trees + ' alberi · ' +
      (scene.stats.reeds||0) + ' canneti · ' +
      scene.stats.generationMs.toFixed(0) + ' ms mesh CPU · ' + lastUploadMs.toFixed(1) +
      ' ms upload GPU · ' + lastFrameMs.toFixed(1) + ' ms draw CPU · ' +
      (scene.riverStats?.visualSegments||0) + ' tratti fluviali sui confini · ' +
      scene.stats.visualFragments.toLocaleString('it-IT') + ' frammenti visuali · area max ±' +
      (scene.stats.maxVisualAreaDeviation*100).toFixed(1) + '%' +
      ((scene.riverStats?.unmatchedAutomatic||0)+(scene.riverStats?.unmatchedManual||0)
        ? ' · ⚠ ' + ((scene.riverStats?.unmatchedAutomatic||0)+(scene.riverStats?.unmatchedManual||0)) + ' tratti non mappati'
        : '');
  }
  function rebuild() {
    if (!snapshot || !gl || rebuilding) return;
    rebuilding = true;
    try {
      status.textContent = 'Genero mesh locale (i territori originali restano invariati)…';
      const next = geometry.buildScene(snapshot, Number(quality.value), Number(deformation.value) / 100);
      const uploadBegin = performance.now();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, next.vertices, gl.STATIC_DRAW);
      lastUploadMs = performance.now() - uploadBegin;
      scene = next;
      exampleMarkers = placeholder?.demo(snapshot,scene)||[];
      refreshMarkerLegend();
      status.textContent = 'WebGL2 attivo · mesh globale ' + quality.value + '× → territori organici (' + deformation.value + '%) · palette 2D originale · gameplay invariato';
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
      updateSelection(source.selectedMacros || [], true);
      rebuild();
      syncLiveMarkers();
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
        const t = performance.now(), sceneTest = geometry.buildScene(snapshot, count, Number(deformation.value) / 100);
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

  function zoomAt(factor, clientX, clientY) {
    // Settlement Builder cursor-anchored wheel zoom.
    const nextZoom = Math.min(10, Math.max(.2, viewZoom * factor));
    if (nextZoom === viewZoom) return;
    const rect = surface.getBoundingClientRect();
    const sx = clientX - rect.left - rect.width / 2;
    const sy = clientY - rect.top - rect.height / 2;
    const ratio = nextZoom / viewZoom;
    panX = sx - (sx - panX) * ratio;
    panY = sy - (sy - panY) * ratio;
    viewZoom = nextZoom;
    draw();
  }

  // Left-click picks the visible 3D mesh (not the old polygon), while selection,
  // menu and multiselect semantics remain delegated to the authoritative World Lab.
  surface.addEventListener('click', event => {
    if(event.button!==0 || !scene || !snapshot || rebuilding || interaction)return;
    const rect=surface.getBoundingClientRect();
    if(!rect.width || !rect.height)return;
    const x=(event.clientX-rect.left)*canvas.width/rect.width;
    const y=(event.clientY-rect.top)*canvas.height/rect.height;
    const macroId=geometry.pickTerritory(scene,camera(),x,y);
    if(macroId===null)return;
    try {
      const accepted=frame.contentWindow?.ConquerRegion3DSelectTerritory?.(macroId,event.shiftKey);
      if(accepted) {
        syncSelection();
        event.preventDefault();
      }
    } catch(e) {
      console.warn('Selezione 3D non disponibile nel World Lab:',e);
    }
  });

  // Builder input contract: middle drag pans, Shift+middle drag changes yaw,
  // wheel zooms. Ground projection and elevation remain locked.
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 1 || event.pointerType === 'touch') return;
    event.preventDefault();
    interaction = {
      id: event.pointerId, mode: event.shiftKey ? 'orbit' : 'pan',
      startX: event.clientX, startY: event.clientY,
      panX, panY, rotation: viewRotation,
      anchor: snapshot && event.shiftKey ? groundPointAtScreenCenter() : null
    };
    surface.setPointerCapture(event.pointerId);
    surface.classList.add('dragging');
  });
  surface.addEventListener('pointermove', event => {
    if (!interaction || interaction.id !== event.pointerId) return;
    event.preventDefault();
    if (interaction.mode === 'orbit') {
      const delta = (event.clientX - interaction.startX) / ORBIT_PX_PER_TURN;
      const rawAngle = interaction.rotation + delta * Math.PI / 2;
      viewRotation = event.ctrlKey
        ? Math.round(rawAngle / (Math.PI / 12)) * Math.PI / 12
        : rawAngle;
      if (snapshot && interaction.anchor) keepAnchorAtScreenCenter(interaction.anchor);
    } else {
      panX = interaction.panX + event.clientX - interaction.startX;
      panY = interaction.panY + event.clientY - interaction.startY;
    }
    draw();
  });
  function finishCameraInteraction(event) {
    if (!interaction || interaction.id !== event.pointerId) return;
    interaction = null;
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    surface.classList.remove('dragging');
  }
  surface.addEventListener('pointerup', finishCameraInteraction);
  surface.addEventListener('pointercancel', finishCameraInteraction);
  surface.addEventListener('lostpointercapture', event => {
    if (interaction && interaction.id === event.pointerId) {
      interaction = null;
      surface.classList.remove('dragging');
    }
  });
  surface.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  surface.addEventListener('mousedown', event => { if (event.button === 1) event.preventDefault(); });
  surface.addEventListener('contextmenu', event => event.preventDefault());
  surface.addEventListener('wheel', event => {
    event.preventDefault();
    const steps = Math.max(-3, Math.min(3, event.deltaY / 100));
    zoomAt(Math.pow(1.12, -steps), event.clientX, event.clientY);
  }, { passive: false });
  resetView.addEventListener('click', () => {
    panX = panY = viewRotation = 0;
    viewZoom = 1;
    draw();
  });

  for (const input of [showTrees, showReeds, showBorders]) input.addEventListener('input', draw);
  showExamples.addEventListener('input', () => { refreshMarkerLegend(); drawMarkers(); });
  deformation.addEventListener('change', rebuild);
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
    window.setInterval(() => { syncFromSource(); syncSelection(); syncLiveMarkers(); }, 700);
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(animatePlaceholders);
    status.textContent = 'Attendo la generazione della mappa originale…';
  } catch (e) {
    status.textContent = e.message;
  }
})();
