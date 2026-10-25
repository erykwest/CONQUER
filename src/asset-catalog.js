/* CONQUER visual asset catalogue: native model registries + actual repository art.
 * Static art comes from the generated manifest (src/asset-manifest.js). Models are read at runtime.
 * Fortifications are built by the game itself in a sandboxed engine frame (index.html?assetlab=1).
 * Schematic entries are explicitly labelled, never passed off as game renders.
 */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const gallery=byId('assetGallery'),filters=byId('assetCategoryFilters'),details=byId('assetDetail');
  if(!gallery||!filters||!details)return;
  const STATIC_FILES=window.CONQUER_ASSET_FILES||[],ROTATION_SETS=window.CONQUER_ASSET_ROTATIONS||{};
  const CATEGORY_ORDER=['Tutti','Edifici','Fortificazioni','Produzione','Popolazione','Truppe','Fauna','Veicoli','Assedio','Natura','Scatter','Interni','Componenti','Araldica','Territorio'];
  const MODEL_SOURCES=[
    {global:'ConquerCivicModels',collection:'models',category:'Edifici',family:'Edifici civili'},
    {global:'ConquerIndustryModels',collection:'models',category:'Produzione',family:'Industrie'},
    {global:'ConquerScatterModel',collection:'assets',category:'Scatter',family:'Oggetti ambientali'},
    {global:'ConquerWagonModel',collection:'parts',category:'Veicoli',family:'Componenti dei carri'},
    {global:'ConquerSiegeModel',collection:'engines',category:'Assedio',family:'Macchine d’assedio'}
  ];
  const SUBJECTS=[
    ['villager','Popolano','Popolazione','Civili'],
    ['spearman','Fanteria','Truppe','Militari'],['archer','Arciere','Truppe','Militari'],
    ['knight','Cavaliere','Truppe','Militari'],['wagon','Carro animato 2D','Veicoli','Carri'],
    ['wagon3d','Carro animato 3D','Veicoli','Carri']
  ];
  // Work animations: the villager with each tool of settlement-work-anim.js (action -> tool as in the Lab).
  const WORK=[['dig','shovel','Scavatore (pala)'],['chop','axe','Taglialegna (ascia)'],['pick','pickaxe','Cavatore (piccone)'],
    ['build','hammer','Muratore (martello)'],['plough','hoe','Aratura (zappa)'],['sow','seeds','Semina'],['harvest','sickle','Mietitura (falce)']];
  const SCHEMATICS=[
    ['well','Pozzo','Edifici','Servizi'],
    ['house1','Abitazione L1','Edifici','Abitazioni'],
    ['house2','Abitazione L2','Edifici','Abitazioni'],
    ['house3','Abitazione L3','Edifici','Abitazioni'],
    ['house4','Abitazione L4','Edifici','Abitazioni'],
    ['field','Campo agricolo','Territorio','Agricoltura'],
    ['road','Strada','Territorio','Infrastrutture'],
    ['river','Corso d’acqua','Territorio','Acqua'],
    ['forest','Foresta procedurale','Territorio','Biomi'],
    ['terrain','Rilievo e scarpata','Territorio','Orografia']
  ];
  const fileCategory=path=>path.includes('/animals/')?'Fauna':path.includes('/architecture/')?'Componenti'
    :path.includes('/economy/')?'Produzione':path.includes('/forest/')||path.includes('/bushes/')||path.endsWith('/tree-svgrepo-com.svg')?'Natura'
    :path.includes('/interior/')?'Interni':path.includes('/heraldry/')?'Araldica':'Territorio';
  const fileFamily=path=>path.includes('/architecture/')?'Elementi architettonici':path.split('/').slice(-2,-1)[0]||'SVG';
  const prettify=key=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/(\d+)/g,' $1').trim().replace(/^./,m=>m.toUpperCase());
  const nameOverrides={church:'Chiesa',tavern:'Taverna',market:'Mercato',quarry:'Cava',mine:'Miniera',clayPit:'Cava d’argilla',
    loggingCamp:'Campo taglialegna',watermill:'Mulino ad acqua',windmill:'Mulino a vento',crate:'Cassa',barrel:'Botte',
    sheep:'Pecora',goat:'Capra',cow:'Mucca',horse:'Cavallo',deer:'Cerva',stag:'Cervo',wolf:'Lupo',bear:'Orso',boar:'Cinghiale',
    ram:'Ariete',catapult:'Mangano',trebuchet:'Trabucco',tower:'Torre d’assedio',tower2:'Torre d’assedio (variante)',
    ladder:'Scala d’assedio',mantlet:'Mantelletto',ballista:'Balista'};
  function titleFor(key){
    if(nameOverrides[key])return nameOverrides[key];
    const m=/^(church|tavern|market|windmill|watermill|quarry|mine|loggingCamp)(\d+)$/.exec(key);
    return m?(nameOverrides[m[1]]||prettify(m[1]))+' · livello '+m[2]:prettify(key);
  }
  const items=[];
  for(const path of STATIC_FILES){
    const file=path.split('/').pop().replace(/\.(svg|png)$/i,'');
    items.push({id:'file:'+path,title:prettify(file),category:fileCategory(path),family:fileFamily(path),
      kind:'file',url:'./'+path,source:path,format:path.endsWith('.png')?'PNG':'SVG'});
  }
  // Pre-rendered heading sets (name_rotations/name_000.svg ...) belong to their base sprite:
  // the inspector steps through the frames with the 15° controls.
  for(const [dir,frames] of Object.entries(ROTATION_SETS)){
    const basePath=dir.replace(/_rotations$/,'')+frames[0].file.slice(frames[0].file.lastIndexOf('.'));
    let item=items.find(x=>x.source===basePath);
    if(!item){
      const path=frames[0].file;
      item={id:'file:'+path,title:prettify(basePath.split('/').pop().replace(/\.(svg|png)$/i,'')),category:fileCategory(path),
        family:fileFamily(path),kind:'file',url:'./'+path,source:path,format:path.endsWith('.png')?'PNG':'SVG'};
      items.push(item);
    }
    item.rotations=frames;item.format+=' · '+frames.length+' rotazioni';item.source+=' + '+dir+'/';
  }
  for(const source of MODEL_SOURCES){
    const registry=window[source.global],collection=registry&&registry[source.collection];
    if(!collection)continue;
    for(const key of Object.keys(collection)){
      const isCivicProp=source.global==='ConquerCivicModels'&&key.startsWith('prop_');
      const isCivicNature=isCivicProp&&/^prop_(tree|cypress|flowerBush)/.test(key);
      const isCivicFurniture=isCivicProp&&/^prop_table/.test(key);
      // A civic shop/stable/warehouse is a building, not an interior furnishing.
      const category=isCivicNature?'Natura':isCivicFurniture?'Interni':isCivicProp?'Scatter':source.category;
      const family=source.global==='ConquerScatterModel'?prettify(collection[key].family||'Oggetti ambientali')
        :isCivicNature?'Vegetazione 3D':isCivicFurniture?'Arredi 3D':isCivicProp?'Elementi ambientali':source.family;
      items.push({id:'model:'+source.global+':'+key,title:titleFor(key),category,family,
        kind:'model',registry:source.global,collection:source.collection,key,source:'src/assets/'+
          ({ConquerCivicModels:'civic-models.js',ConquerIndustryModels:'industry-models.js',
            ConquerScatterModel:'scatter-model.js',ConquerWagonModel:'wagon-model.js',
            ConquerSiegeModel:'siege-engines-model.js'}[source.global]),
        format:'Modello 3D',subject:source.global==='ConquerSiegeModel'&&key!=='tower2'?'siege:'+key:null});
    }
  }
  const animals=window.ConquerAnimalModels||{};
  for(const key of Object.keys(animals)){
    if(!animals[key]||!animals[key].parts)continue;
    items.push({id:'animal:'+key,title:titleFor(key),category:'Fauna',family:'Animali 3D',
      kind:'animal',key,subject:key,format:'Modello 3D animato',source:'src/assets/animal-models.js'});
  }
  for(const [key,title,category,family] of SUBJECTS){
    items.push({id:'figure:'+key,title,category,family,kind:'figure',subject:key,
      format:'Animazione',source:'src/settlement-population-figures.js / src/settlement-wagons3d.js'});
  }
  for(const [action,tool,title] of WORK){
    items.push({id:'figure:work:'+action,title,category:'Popolazione',family:'Lavori',kind:'figure',subject:'villager',
      action,tool,key:tool,format:'Animazione',source:'src/settlement-work-anim.js'});
  }
  for(const [key,title,category,family] of SCHEMATICS){
    items.push({id:'procedural:'+key,title,category,family,kind:'schematic',key,format:'Parametrico',
      source:'Builder · asset generato dal motore',builder:true});
  }
  if(window.CONQUER_HERALDRY_SYMBOLS&&window.CONQUER_HERALDRY_SOURCES){
    for(const s of window.CONQUER_HERALDRY_SYMBOLS){
      items.push({id:'symbol:'+s.id,title:s.label,category:'Araldica',family:s.group||'Simboli',
        kind:'symbol',key:s.id,symbol:s,source:'src/heraldry-symbols.js',format:'Simbolo SVG'});
    }
  }

  // ---------- fortifications from the game engine ----------
  // Castle geometry needs the whole game (terrain, footprints, battlements, roofs), so the game runs in
  // a hidden sandbox frame (no saves, no cloud, no telemetry). Each entry is one structure of the
  // destruction gallery's variant list, meshed by ConquerCastle3D.worldMeshes(): the castle the player sees.
  const ENGINE_URL='./index.html?assetlab=1&renderer=canvas2d';
  const status=text=>{const el=byId('assetEngineStatus');if(el)el.textContent=text};
  let engine=null;
  const slug=s=>s.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function loadEngine(){
    const frame=document.createElement('iframe');
    frame.src=ENGINE_URL;frame.title='Motore CONQUER (sandbox Asset Lab)';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
    // 560 px is enough for the tallest tower at the stage scale; fewer pixels keep captures fast.
    frame.style.cssText='position:fixed;left:-12000px;top:0;width:560px;height:560px;border:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(frame);
    status('Fortificazioni: avvio del motore di gioco…');
    const started=performance.now();
    (function poll(){
      let w=null;try{w=frame.contentWindow}catch{}
      const core=w&&w.ConquerCastle3D&&w.ConquerSiegePreview?.assetMesh&&w.ConquerAssetStage&&w.document.readyState==='complete';
      // Footprint unions use polygon-clipping (loaded from a CDN): give it a few seconds.
      if(core&&(w.__polygonClipping||performance.now()-started>8000)){
        try{onEngine(w)}catch(error){console.warn('Asset Lab engine',error);status('Fortificazioni non disponibili: '+error.message)}
        return;
      }
      if(performance.now()-started>60000){status('Fortificazioni non disponibili: il motore non si è avviato');return}
      setTimeout(poll,250);
    })();
  }
  // Every variant of ConquerAssetStage (the gallery list): a 3D mesh when ConquerCastle3D has a volume
  // for it, and in every case the engine's own states — as drawn in the game, under construction,
  // each damage phase, cutaway — captured on demand by the stage.
  function onEngine(w){
    engine=w;
    let meshes=0;
    for(const v of w.ConquerAssetStage.variants()){
      // Wood towers, wood gates and palisades have no ConquerCastle3D volume: 2.5D captures only.
      const mesh=toLabMesh(w.ConquerSiegePreview.assetMesh(v.spec));
      // Thumbnails are fitted to the card: the height tells L1 from L3.
      let top=0;if(mesh)for(let i=2;i<mesh.pos.length;i+=3)top=Math.max(top,mesh.pos[i]);
      const states=[...(mesh?[{id:'3d',label:'Modello 3D',group:'3d'}]:[]),...w.ConquerAssetStage.states(v.id)];
      items.push({id:'castle:'+v.id,stageId:v.id,title:v.label,category:'Fortificazioni',family:v.family,kind:'castle',spec:v.spec,
        key:v.spec.type,mesh,states,format:(mesh?'Modello 3D · h '+top.toFixed(1)+' U':'Solo 2.5D')+' · '+(states.length-(mesh?1:0))+' stati',
        source:'src/settlement-asset-stage.js · '+(mesh?'src/settlement-castle3d.js':'percorso 2.5D')+' (varianti: src/settlement-siege-preview.js)',builder:true});
      if(mesh)meshes++;
    }
    const total=items.filter(x=>x.kind==='castle').length;
    status(total+' fortificazioni dal motore · '+meshes+' in 3D · '+(total-meshes)+' solo 2.5D');
    refresh();
  }
  // Engine captures: the game's 2.5D render of one state, ground removed. Cached per view.
  const captureCache=new Map();
  function engineCapture(item,stateId,rotation=0){
    if(!engine||!item.stageId)return null;
    const key=item.stageId+'|'+stateId+'|'+rotation;
    if(!captureCache.has(key))captureCache.set(key,engine.ConquerAssetStage.capture(item.stageId,stateId,{rotation}));
    return captureCache.get(key);
  }
  const defaultState=item=>item.states?.[0]?.id||null;
  const hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
  // Engine meshes: 6 floats per vertex (x, y, z, r, g, b), 3 vertices per triangle, colours already
  // side-shaded. Re-centred on the structure and dropped to z = 0 for the Lab's own iso view.
  function toLabMesh(m){
    if(!m)return null;
    const sets=[m.body,m.front],pos=[],col=[];let zMin=Infinity;
    for(const t of sets)for(let i=2;i<t.length;i+=6)zMin=Math.min(zMin,t[i]);
    for(const t of sets)for(let i=0;i+17<t.length;i+=18){
      for(let v=0;v<3;v++){const o=i+v*6;pos.push(t[o]-m.origin.x,t[o+1]-m.origin.y,t[o+2]-zMin)}
      col.push(hex(t[i+3],t[i+4],t[i+5]));
    }
    return col.length?{pos:new Float32Array(pos),col}:null;
  }

  // The same indexed/triangle Blender geometry used by the game, not screenshots or illustrations.
  const meshCache=new Map();
  function modelMesh(item){
    if(meshCache.has(item.id))return meshCache.get(item.id);
    let mesh;
    if(item.kind==='castle')mesh=item.mesh;
    else if(item.kind==='animal'&&window.ConquerAnimals3D){
      mesh=window.ConquerAnimals3D.triangles(item.key,{x:0,y:0,heading:0},{mode:'idle',t:0,seed:1},
        window.ConquerAnimals3D.coatColors(item.key,'brown'));
    }else{
      const db=window[item.registry],model=db&&db[item.collection]&&db[item.collection][item.key];
      if(!db||!model)return null;
      const parts=model.parts||{model},pos=[],col=[],palette=db.palette||[];
      for(const part of Object.values(parts)){
        const verts=part.p||part.v,idx=part.i;
        if(!verts)continue;
        const count=idx?Math.floor(idx.length/3):Math.floor(verts.length/9);
        for(let t=0;t<count;t++){
          if(idx){
            for(let vi=0;vi<3;vi++){
              const offset=idx[t*3+vi]*3;pos.push(verts[offset],verts[offset+1],verts[offset+2]);
            }
          }else pos.push(...verts.slice(t*9,t*9+9));
          const color=part.c?.[t]??0;
          col.push(typeof color==='string'?color:(palette[color]||'#a69a83'));
        }
      }
      mesh={pos:new Float32Array(pos),col};
    }
    if(!mesh||!mesh.pos?.length)return null;
    meshCache.set(item.id,mesh);
    return mesh;
  }
  function renderModel(canvas,item,rotationDegrees=0){return renderMesh(canvas,modelMesh(item),rotationDegrees)}
  function renderMesh(canvas,mesh,rotationDegrees=0){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    if(!mesh)return placeholder(canvas,'ANTEPRIMA NON DISPONIBILE');
    const angle=rotationDegrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const rotate=(x,y)=>[x*cos-y*sin,x*sin+y*cos];
    const p=mesh.pos;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<p.length;i+=3){
      const [rx,ry]=rotate(p[i],p[i+1]);
      const x=(rx-ry)*.866,y=(rx+ry)*.5-p[i+2]*.95;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(!Number.isFinite(minX))return placeholder(canvas,'MODELLO VUOTO');
    const scale=Math.min((w-28)/Math.max(.01,maxX-minX),(h-28)/Math.max(.01,maxY-minY),900);
    const mx=(minX+maxX)/2,my=(minY+maxY)/2;
    const view={turns:0,
      project:(x,y,z)=>{const [rx,ry]=rotate(x,y);return{x:w/2+((rx-ry)*.866-mx)*scale,y:h/2+((rx+ry)*.5-z*.95-my)*scale}},
      depth:(x,y,z)=>{const [rx,ry]=rotate(x,y);return rx+ry+z*.55}};
    if(window.ConquerMesh3D?.drawMeshes)window.ConquerMesh3D.drawMeshes(g,[mesh],view);
    else placeholder(canvas,'RENDERER NON DISPONIBILE');
  }
  function placeholder(canvas,message){
    const g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);
    g.fillStyle='#a89b88';g.textAlign='center';g.font='12px system-ui';g.fillText(message,canvas.width/2,canvas.height/2);
  }
  function renderSchema(canvas,item){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    const key=item.key,cx=w/2,cy=h*.54,s=Math.min(w/4,h/2.7);
    const line=(x,y,X,Y)=>{g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.stroke()};
    const poly=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle=fill;g.fill();g.stroke()};
    g.strokeStyle='#d4bc92';g.lineWidth=2;
    if(key.startsWith('house')||key==='well'){
      poly([[cx-s*.7,cy-s*.4],[cx,cy-s*.75],[cx+s*.7,cy-s*.4],[cx,cy]],'#796958');
      poly([[cx-s*.7,cy-s*.4],[cx,cy],[cx,cy+s*.75],[cx-s*.7,cy+s*.30]],'#514b43');
      poly([[cx,cy],[cx+s*.7,cy-s*.4],[cx+s*.7,cy+s*.3],[cx,cy+s*.75]],'#9c8570');
      if(key==='well'){
        g.beginPath();g.ellipse(cx,cy-s*.45,s*.65,s*.30,0,0,Math.PI*2);g.fillStyle='#9c8570';g.fill();g.stroke();
      }
    }else if(key==='road'){
      poly([[cx-s*1.5,cy],[cx+s*.6,cy-s*.8],[cx+s*1.45,cy-s*.33],[cx-s*.65,cy+s*.55]],'#817b69');
    }else{
      poly([[cx-s,cy],[cx,cy-s*.5],[cx+s,cy],[cx,cy+s*.5]],key==='river'?'#3b7989':'#65835b');
      if(key==='field'){g.strokeStyle='#c8ac6a';for(let i=-3;i<=3;i++)line(cx-s*.75,cy+i*s*.085,cx+s*.75,cy+i*s*.085)}
      if(key==='forest'){g.fillStyle='#375c39';for(let i=-2;i<=2;i++){g.beginPath();g.arc(cx+i*s*.29,cy-i%2*s*.23,s*.27,0,Math.PI*2);g.fill()}}
    }
    g.fillStyle='#edc98f';g.font='bold 10px system-ui';g.textAlign='right';g.fillText('SCHEMA',w-10,h-10);
  }
  function renderSymbol(container,item){
    const symbol=item.symbol,source=window.CONQUER_HERALDRY_SOURCES?.[symbol.source];
    if(!source||!symbol.viewBox){container.textContent='SVG non disponibile';return}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',symbol.viewBox.join(' '));svg.setAttribute('aria-label',item.title);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.classList.add('symbol-preview');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',source.path);path.setAttribute('fill','#d9b77c');
    svg.appendChild(path);container.appendChild(svg);
  }
  // Thumbnail figures use the very same drawing calls as the live Figure Lab.
  // Each call temporarily swaps the classic-script canvas context, then restores it.
  const LAB_VILLAGER={id:'asset-lab-villager',kind:'peasant',sex:'male',age:'adult',hair:'brown',colors:['#8c6b3f','#5d4a32']};
  function renderFigure(canvas,item,rotationDegrees=0){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,subject=item.subject;
    g.clearRect(0,0,w,h);
    if(subject==='wagon3d'&&window.ConquerWagons3D?.worldTriangles){
      const spec={chassis:'wagon',cargo:['crate','sack','barrel'],team:[]};
      const mesh=window.ConquerWagons3D.worldTriangles(spec,{x:0,y:0,heading:0,distance:0});
      return renderMesh(canvas,mesh,rotationDegrees);
    }
    if(subject==='wagon'&&window.ConquerWagons?.drawWagon){
      window.ConquerWagons.drawWagon(g,w*.48,h*.64,Math.min(w*.48,h*.8),
        {chassis:'wagon',cargo:['crate','barrel'],team:[],facing:1,moving:false,t:0,distance:0});return;
    }
    const previous=ctx,oldScale=State.view.scale;
    try{
      ctx=g;State.view.scale=Math.min(w*.09,h*.14);
      const p={x:w*.5,y:h*.78};
      if(item.tool&&window.ConquerWorkAnim){
        // Frozen at the stroke, where the pose and the tool read best.
        const T=window.ConquerWorkAnim.TOOLS[item.tool];
        window.ConquerWorkAnim.drawWorkerUnmasked({...LAB_VILLAGER,id:'asset-lab-worker-'+item.tool,p},item.tool,T?T.period*T.hit:0,1);
      }else if(subject==='villager'){
        drawVillagerFigureUnmasked({...LAB_VILLAGER,p});
      }else{
        const unit={id:'asset-lab-'+subject,engaged:false};
        window.ConquerCombatAnim.drawFigure(p,0,subject,unit.id,0,null,
          window.ConquerCombatAnim.pose(unit,0));
      }
    }catch(error){
      console.warn('Asset Lab figure thumbnail could not render',subject,error);
      placeholder(canvas,'ANTEPRIMA DAL LAB');
    }finally{ctx=previous;State.view.scale=oldScale}
  }
  // Rotation sets: the pre-rendered frame closest to the requested heading.
  function rotationFrame(item,rotationDegrees){
    const want=((rotationDegrees%360)+360)%360;
    return item.rotations.reduce((best,f)=>{
      const d=Math.min(Math.abs(f.deg-want),360-Math.abs(f.deg-want)),b=Math.min(Math.abs(best.deg-want),360-Math.abs(best.deg-want));
      return d<b?f:best;
    });
  }
  // stateId: for fortifications, '3d' (the mesh) or an engine state (a 2.5D capture; rotation in 90° views).
  function makePreview(item,container,large,rotationDegrees=0,stateId=defaultState(item)){
    container.replaceChildren();
    if(item.kind==='castle'&&stateId&&stateId!=='3d'){
      const c=engineCapture(item,stateId,Math.round(rotationDegrees/90)%4);
      if(!c?.dataUrl){container.textContent='Cattura non disponibile';return}
      const im=document.createElement('img');im.src=c.dataUrl;im.alt=item.title+' · '+stateId;im.className='engine-capture';
      container.appendChild(im);return;
    }
    if(item.kind==='file'){
      const url=item.rotations&&rotationDegrees?'./'+rotationFrame(item,rotationDegrees).file:item.url;
      const im=document.createElement('img');im.src=url;im.alt=item.title;im.loading=large?'eager':'lazy';
      im.decoding='async';im.addEventListener('error',()=>{container.textContent='File non caricabile';});
      container.appendChild(im);return;
    }
    if(item.kind==='symbol')return renderSymbol(container,item);
    const canvas=document.createElement('canvas');canvas.width=large?680:248;canvas.height=large?390:156;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Anteprima '+item.title);
    container.appendChild(canvas);
    if(item.kind==='schematic')return renderSchema(canvas,item);
    if(item.kind==='model'||item.kind==='animal'||item.kind==='castle')return renderModel(canvas,item,rotationDegrees);
    if(item.kind==='figure')return renderFigure(canvas,item,rotationDegrees);
  }
  let currentCategory='Tutti',currentFamily='',currentFormat='',query='',selectedId='',selectedRotation=0,selectedItem=null,selectedState=null;
  let observer=null;
  const snapshotMode=()=>selectedItem?.kind==='castle'&&selectedState&&selectedState!=='3d';
  function renderStateBar(item){
    const bar=byId('assetStateBar');if(!bar)return;
    bar.replaceChildren();bar.hidden=!item.states;
    if(!item.states)return;
    let group=null;
    for(const st of item.states){
      if(st.group!==group){group=st.group;const tag=document.createElement('span');tag.textContent=group;bar.appendChild(tag)}
      const b=document.createElement('button');b.type='button';b.textContent=st.label;b.dataset.state=st.id;
      b.setAttribute('aria-pressed',String(st.id===selectedState));
      b.onclick=()=>selectState(st.id);bar.appendChild(b);
    }
  }
  function selectState(stateId){
    if(!selectedItem?.states?.some(s=>s.id===stateId))return;
    const wasSnapshot=snapshotMode();selectedState=stateId;
    if(wasSnapshot!==snapshotMode())selectedRotation=0;
    renderStateBar(selectedItem);updateRotationLabels();
    byId('assetRotationValue').textContent=selectedRotation+'°';
    byId('assetPreviewNote').textContent=snapshotMode()?'Render 2.5D del gioco (ConquerAssetStage), terreno rimosso.':'Geometria costruita dal motore di gioco (ConquerCastle3D).';
    makePreview(selectedItem,byId('assetDetailPreview'),true,selectedRotation,selectedState);
  }
  // 3D meshes turn by 15°, game captures by the camera's four 90° views.
  function updateRotationLabels(){
    const step=snapshotMode()?90:15;
    byId('assetRotateLeft').textContent='↶ −'+step+'°';byId('assetRotateRight').textContent='+'+step+'° ↷';
    byId('assetRotateLeft').setAttribute('aria-label','Ruota di '+step+' gradi a sinistra');
    byId('assetRotateRight').setAttribute('aria-label','Ruota di '+step+' gradi a destra');
  }
  function selectItem(item,stateId){
    if(!item)return;
    if(selectedId!==item.id)selectedRotation=0;
    selectedItem=item;selectedId=item.id;
    selectedState=item.states?.some(s=>s.id===stateId)?stateId:defaultState(item);
    renderStateBar(item);updateRotationLabels();
    document.querySelectorAll('.asset-card').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.id===item.id)));
    byId('assetDetailName').textContent=item.title;
    byId('assetDetailMeta').textContent=item.category+' / '+item.family+' · '+item.format;
    byId('assetDetailSource').textContent=item.source;
    const live=!!item.subject&&!!document.querySelector('[data-subject="'+item.subject+'"]');
    document.body.classList.toggle('asset-figure',live);
    document.body.classList.toggle('asset-catalog-static',!live);
    const art=byId('assetDetailPreview');art.hidden=live;
    byId('assetAnimationPanel').hidden=!live;
    const rotatable=item.kind==='model'||item.kind==='animal'||item.kind==='castle'||item.subject==='wagon3d'||!!item.rotations;
    byId('assetRotationControls').hidden=!rotatable;
    byId('assetRotationValue').textContent=selectedRotation+'°';
    const label=byId('assetPreviewNote');
    label.textContent=live?'Anteprima animata dal motore di gioco.':snapshotMode()?'Render 2.5D del gioco (ConquerAssetStage), terreno rimosso.':
      item.kind==='castle'?'Geometria costruita dal motore di gioco (ConquerCastle3D).':item.rotations?'Fotogrammi pre-renderizzati ogni 15°.':'';
    if(live){
      document.querySelector('[data-subject="'+item.subject+'"]').click();
      if(item.action)document.querySelector('#actions [data-action="'+item.action+'"]')?.click();
    }else makePreview(item,art,true,selectedRotation,selectedState);
    const link=byId('assetBuilderLink');link.hidden=!item.builder;
    details.hidden=false;
  }
  function rotateSelection(delta){
    if(!selectedItem||byId('assetRotationControls').hidden)return;
    if(snapshotMode())delta=Math.sign(delta)*90;
    selectedRotation=((selectedRotation+delta)%360+360)%360;
    byId('assetRotationValue').textContent=selectedRotation+'°';
    const live=!byId('assetAnimationPanel').hidden;
    if(live)window.ConquerLab?.rotate3d(delta);
    else makePreview(selectedItem,byId('assetDetailPreview'),true,selectedRotation,selectedState);
  }
  byId('assetRotateLeft').addEventListener('click',()=>rotateSelection(-15));
  byId('assetRotateRight').addEventListener('click',()=>rotateSelection(15));
  function updateFilters(){
    filters.replaceChildren();
    for(const category of CATEGORY_ORDER.filter(c=>c==='Tutti'||items.some(x=>x.category===c))){
      const button=document.createElement('button');button.type='button';button.textContent=category;
      button.setAttribute('aria-pressed',String(category===currentCategory));
      button.onclick=()=>{currentCategory=category;currentFamily='';refresh()};
      filters.appendChild(button);
    }
    const fam=byId('assetFamily');fam.replaceChildren(new Option('Tutte le famiglie',''));
    const visible=items.filter(x=>currentCategory==='Tutti'||x.category===currentCategory);
    for(const v of [...new Set(visible.map(x=>x.family))].sort((a,b)=>a.localeCompare(b,'it'))){
      fam.appendChild(new Option(v,v));
    }
    fam.value=currentFamily;
  }
  // Only real fields are searchable: a missing key must not match the word "undefined".
  const searchText=x=>[x.title,x.family,x.category,x.key,x.source,x.format].filter(Boolean).join(' ').toLocaleLowerCase('it');
  function refresh(){
    updateFilters();
    const subset=items.filter(x=>(currentCategory==='Tutti'||x.category===currentCategory)&&
      (!currentFamily||x.family===currentFamily)&&(!currentFormat||x.kind===currentFormat)&&
      (!query||searchText(x).includes(query)));
    byId('assetCount').textContent=subset.length+' / '+items.length+' asset';
    gallery.replaceChildren();
    if(observer)observer.disconnect();
    const drawQueue=[];
    for(const item of subset){
      const card=document.createElement('button');card.type='button';card.className='asset-card';
      card.dataset.id=item.id;card.setAttribute('aria-selected',String(item.id===selectedId));
      const visual=document.createElement('div');visual.className='asset-card-visual';
      const title=document.createElement('strong');title.textContent=item.title;
      const sub=document.createElement('small');sub.textContent=item.family+' · '+item.format;
      card.append(visual,title,sub);card.onclick=()=>selectItem(item);
      gallery.appendChild(card);
      if(item.kind==='file'||item.kind==='symbol')makePreview(item,visual,false);
      else drawQueue.push({card,item,visual});
    }
    if(!subset.length){const p=document.createElement('p');p.className='catalog-empty';p.textContent='Nessun asset corrisponde ai filtri.';gallery.appendChild(p)}
    if('IntersectionObserver'in window){
      const queued=new Map(drawQueue.map(q=>[q.card,q]));
      observer=new IntersectionObserver(entries=>{
        for(const e of entries)if(e.isIntersecting){
          const q=queued.get(e.target);if(q){makePreview(q.item,q.visual,false);queued.delete(e.target)}
          observer.unobserve(e.target);
        }
      },{root:gallery,rootMargin:'140px'});
      for(const q of drawQueue)observer.observe(q.card);
    }else for(const q of drawQueue)makePreview(q.item,q.visual,false);
  }
  byId('assetSearch').addEventListener('input',e=>{query=e.target.value.trim().toLocaleLowerCase('it');refresh()});
  byId('assetFamily').addEventListener('change',e=>{currentFamily=e.target.value;refresh()});
  byId('assetFormat').addEventListener('change',e=>{currentFormat=e.target.value;refresh()});
  byId('assetReset').addEventListener('click',()=>{currentCategory='Tutti';currentFamily='';currentFormat='';query='';
    byId('assetSearch').value='';byId('assetFormat').value='';refresh()});
  window.ConquerAssetCatalog={items,refresh,select:(id,state)=>{const item=items.find(x=>x.id===id);if(item)selectItem(item,state)},
    selectState,get selected(){return selectedId},get state(){return selectedState},get rotation(){return selectedRotation},
    get engineReady(){return !!engine},
    // The Lab's own renderers, for src/asset-audit.js: the audit looks at exactly what the Lab shows.
    lab:{makePreview,modelMesh,engineCapture,defaultState,rotationFrame}};
  // Reparent the existing native animation canvas: the animator retains its context.
  const liveCanvas=byId('c');if(liveCanvas)byId('assetAnimationPanel').appendChild(liveCanvas);
  refresh();
  selectItem(items.find(x=>x.id==='animal:sheep')||items[0]);
  // The engine frame is heavy: start it once the catalogue is on screen.
  setTimeout(loadEngine,0);
})();
