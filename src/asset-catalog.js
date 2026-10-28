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
    {global:'ConquerSiegeModel',collection:'engines',category:'Assedio',family:'Macchine d’assedio'},
    {global:'ConquerWoodFortModels',collection:'models',category:'Fortificazioni',family:'Legno 3D (Blender)'}
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
    ladder:'Scala d’assedio',mantlet:'Mantelletto',ballista:'Balista',
    stake:'Palo di palizzata',watchtower:'Torre di vedetta in legno',palisadeTower_open:'Torre a palizzata aperta',
    palisadeTower_roofed:'Torre a palizzata coperta',woodGate:'Porta in legno'};
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
            ConquerSiegeModel:'siege-engines-model.js',ConquerWoodFortModels:'wood-fort-models.js'}[source.global]),
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
  const wardrobe=window.ConquerWardrobe?.PIECES||{};
  for(const key of Object.keys(wardrobe)){
    items.push({id:'wardrobe:'+key,title:wardrobe[key].label,category:'Popolazione',family:'Abbigliamento stagionale',
      kind:'wardrobe',key,format:'Overlay',note:'Si attiva: '+wardrobe[key].when+'.',source:'src/settlement-wardrobe.js'});
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
      // Wood towers, wood gates and palisades are meshed by ConquerWood3D (Blender models).
      const mesh=toLabMesh(w.ConquerSiegePreview.assetMesh(v.spec));
      // Thumbnails are fitted to the card: the height tells L1 from L3.
      let top=0;if(mesh)for(let i=2;i<mesh.pos.length;i+=3)top=Math.max(top,mesh.pos[i]);
      const states=[...(mesh?[{id:'3d',label:'Modello 3D',group:'3d'}]:[]),...w.ConquerAssetStage.states(v.id)];
      items.push({id:'castle:'+v.id,stageId:v.id,title:v.label,category:'Fortificazioni',family:v.family,kind:'castle',spec:v.spec,
        key:v.spec.type,mesh,states,format:(mesh?'Modello 3D · h '+top.toFixed(1)+' U':'Solo 2.5D')+' · '+(states.length-(mesh?1:0))+' stati',
        source:'src/settlement-asset-stage.js · '+(!mesh?'percorso 2.5D':w.ConquerWood3D?.handles?.(v.spec)?'src/settlement-wood3d.js':'src/settlement-castle3d.js')+' (varianti: src/settlement-siege-preview.js)',builder:true});
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
  // Forced occupancy: 'off', 'depth' (figures tested against the depth buffer, the correct
  // occlusion) or 'overlay' (figures painted over the scene, as the game's 2D population pass).
  let occupancyMode='off';
  function renderModel(canvas,item,rotationDegrees=0,occupancy=occupancyMode){return renderMesh(canvas,modelMesh(item),rotationDegrees,occupancy)}
  function renderMesh(canvas,mesh,rotationDegrees=0,occupancy='off'){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    if(!mesh)return placeholder(canvas,'ANTEPRIMA NON DISPONIBILE');
    const angle=rotationDegrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const rotate=(x,y)=>[x*cos-y*sin,x*sin+y*cos];
    const p=mesh.pos;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const people=occupancy!=='off'?occupants(mesh):[];
    const fit=(px,py,pz)=>{
      const [rx,ry]=rotate(px,py);
      const x=(rx-ry)*.866,y=(rx+ry)*.5-pz*.95;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    };
    for(let i=0;i<p.length;i+=3)fit(p[i],p[i+1],p[i+2]);
    for(const q of people){fit(q.x,q.y,q.z);fit(q.x,q.y,q.z+.6)}
    if(!Number.isFinite(minX))return placeholder(canvas,'MODELLO VUOTO');
    const scale=Math.min((w-28)/Math.max(.01,maxX-minX),(h-28)/Math.max(.01,maxY-minY),900);
    const mx=(minX+maxX)/2,my=(minY+maxY)/2;
    const view={turns:0,
      project:(x,y,z)=>{const [rx,ry]=rotate(x,y);return{x:w/2+((rx-ry)*.866-mx)*scale,y:h/2+((rx+ry)*.5-z*.95-my)*scale}},
      depth:(x,y,z)=>{const [rx,ry]=rotate(x,y);return rx+ry+z*.55}};
    if(!window.ConquerMesh3D?.shadedHex)return placeholder(canvas,'RENDERER NON DISPONIBILE');
    const zb=depthRender(g,mesh,view,w,h);
    if(people.length)drawOccupants(g,people,view,zb,w,h,scale,occupancy);
  }
  // Standing points on a 0.6 U grid over the model and a 1 U ring around it: on the ground or
  // on a floor / platform up to 0.8 U, wherever 0.6 U of headroom is free (not inside a wall).
  const occupantCache=new WeakMap();
  function occupants(mesh){
    if(occupantCache.has(mesh))return occupantCache.get(mesh);
    const p=mesh.pos,n=mesh.col.length;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(let i=0;i<p.length;i+=3){x0=Math.min(x0,p[i]);x1=Math.max(x1,p[i]);y0=Math.min(y0,p[i+1]);y1=Math.max(y1,p[i+1])}
    // Height of every triangle over a ground point (null when the point is outside it in plan).
    const zAt=(t,x,y)=>{
      const o=t*9,ax=p[o],ay=p[o+1],bx=p[o+3],by=p[o+4],cx=p[o+6],cy=p[o+7];
      const ar=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);if(Math.abs(ar)<1e-9)return null;
      const u=((bx-x)*(cy-y)-(cx-x)*(by-y))/ar,v=((cx-x)*(ay-y)-(ax-x)*(cy-y))/ar,w=1-u-v;
      return u<-1e-6||v<-1e-6||w<-1e-6?null:u*p[o+2]+v*p[o+5]+w*p[o+8];
    };
    const out=[],step=.6;let k=0;
    for(let y=y0-1;y<=y1+1;y+=step)for(let x=x0-1;x<=x1+1;x+=step){
      const hits=[];for(let t=0;t<n;t++){const z=zAt(t,x,y);if(z!=null)hits.push(z)}
      const floor=Math.max(0,...hits.filter(z=>z<=.8));
      if(hits.some(z=>z>floor+.05&&z<floor+.6))continue;
      out.push({x,y,z:floor,id:'lab-occupant-'+(k++)});
    }
    occupantCache.set(mesh,out);
    return out;
  }
  const OCCUPANT_COLORS=[['#8a5a3b','#5f4b3a'],['#6f7f4a','#4e5a35'],['#5d6f86','#3f4b5d'],['#8e4d4d','#5e3434'],['#a58b5b','#6f5c3c'],['#6b5a7d','#483c57']];
  // Each figure is drawn alone with the villager renderer, then its pixels are kept only where
  // they are nearer than the model: a standing billboard at the foot point, rising in z.
  function drawOccupants(g,people,view,zb,w,h,scale,mode){
    if(typeof drawVillagerFigureUnmasked!=='function')return;
    const layer=document.createElement('canvas');layer.width=w;layer.height=h;
    const lg=layer.getContext('2d',{willReadFrequently:true}),ss=zb.ss;
    const order=people.map(q=>({q,d:view.depth(q.x,q.y,q.z)})).sort((a,b)=>a.d-b.d);
    const previous=ctx,oldView={...State.view};
    try{
      ctx=lg;
      // The Lab's w2s is the identity (p is the foot on screen); figures are sized as in the
      // game, where 1 U = 12 * State.view.scale px.
      State.view.scale=scale/12;
      const out=g.getImageData(0,0,w,h),od=out.data;
      for(const {q,d} of order){
        lg.clearRect(0,0,w,h);
        const i=+q.id.split('-').pop(),foot=view.project(q.x,q.y,q.z);
        drawVillagerFigureUnmasked({...LAB_VILLAGER,id:q.id,colors:OCCUPANT_COLORS[i%OCCUPANT_COLORS.length],
          sex:i%3?'male':'female',hair:['brown','black','blond'][i%3],p:foot});
        const fd=lg.getImageData(0,0,w,h).data;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const j=(y*w+x)*4,a=fd[j+3];if(!a)continue;
          if(mode==='depth'){
            const zf=Math.max(0,(foot.y-y)/(.95*scale)),z=zb.z[Math.min(zb.H-1,y*ss+1)*zb.W+Math.min(zb.W-1,x*ss+1)];
            if(z>d+.55*zf+.02)continue;
          }
          const k=a/255;for(let c=0;c<3;c++)od[j+c]=od[j+c]*(1-k)+fd[j+c]*k;od[j+3]=Math.max(od[j+3],a);
        }
      }
      g.putImageData(out,0,0);
    }finally{ctx=previous;Object.assign(State.view,oldView)}
  }
  // The game draws meshes with WebGL and a depth buffer; the Lab does the same in software
  // (2x supersampled). The 2.5D painter sorts whole triangles and cuts the timber frames
  // and windows that lie almost on the wall, so it would show defects the game has not.
  function depthRender(g,mesh,view,w,h,ss=2){
    const W=w*ss,H=h*ss,p=mesh.pos,n=mesh.col.length,zb=new Float32Array(W*H).fill(-Infinity),img=new ImageData(W,H),d=img.data;
    for(let t=0;t<n;t++){
      const o=t*9,hex=window.ConquerMesh3D.shadedHex(mesh,t),r=parseInt(hex.slice(1,3),16),gr=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
      const V=[0,3,6].map(k=>{const q=view.project(p[o+k],p[o+k+1],p[o+k+2]);return[q.x*ss,q.y*ss,view.depth(p[o+k],p[o+k+1],p[o+k+2])]});
      const ar=(V[1][0]-V[0][0])*(V[2][1]-V[0][1])-(V[2][0]-V[0][0])*(V[1][1]-V[0][1]);if(Math.abs(ar)<1e-9)continue;
      const x0=Math.max(0,Math.floor(Math.min(V[0][0],V[1][0],V[2][0]))),x1=Math.min(W-1,Math.ceil(Math.max(V[0][0],V[1][0],V[2][0])));
      const y0=Math.max(0,Math.floor(Math.min(V[0][1],V[1][1],V[2][1]))),y1=Math.min(H-1,Math.ceil(Math.max(V[0][1],V[1][1],V[2][1])));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const px=x+.5,py=y+.5;
        const w0=((V[1][0]-px)*(V[2][1]-py)-(V[2][0]-px)*(V[1][1]-py))/ar,w1=((V[2][0]-px)*(V[0][1]-py)-(V[0][0]-px)*(V[2][1]-py))/ar,w2=1-w0-w1;
        if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;
        const z=w0*V[0][2]+w1*V[1][2]+w2*V[2][2],i=y*W+x;
        if(z<=zb[i])continue;
        zb[i]=z;d[i*4]=r;d[i*4+1]=gr;d[i*4+2]=b;d[i*4+3]=255;
      }
    }
    const big=document.createElement('canvas');big.width=W;big.height=H;big.getContext('2d').putImageData(img,0,0);
    g.imageSmoothingQuality='high';g.drawImage(big,0,0,w,h);
    return{z:zb,W,H,ss};
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
  const LAB_VILLAGER={id:'asset-lab-villager',kind:'peasant',sex:'male',age:'adult',hair:'brown',colors:['#9c9078','#7d7a72']};
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
  // A wardrobe piece worn by the four civil classes (L1-L4), drawn by the game's own figure code.
  function renderWardrobe(canvas,item){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,W=window.ConquerWardrobe;
    g.clearRect(0,0,w,h);
    const previous=ctx,oldScale=State.view.scale;
    try{
      ctx=g;State.view.scale=Math.min(w*.045,h*.1);
      [['peasant','male'],['artisan','female'],['merchant','male'],['elite','female']].forEach(([kind,sex],i)=>{
        const id='wardrobe-'+item.key+'-'+kind,pal=W.classPalette(kind)||['#8c6b3f','#5d4a32'],colors=[pal[0],pal[2]];
        drawVillagerFigureUnmasked({id,kind,sex,age:'adult',hair:'brown',colors,
          outfit:W.compose([item.key],id,kind,colors[0]),p:{x:w*(.2+i*.2),y:h*.74}});
      });
    }catch(error){
      console.warn('Asset Lab wardrobe thumbnail could not render',item.key,error);
      placeholder(canvas,'ANTEPRIMA NON DISPONIBILE');
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
    if(item.kind==='wardrobe')return renderWardrobe(canvas,item);
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
      item.kind==='castle'?'Geometria costruita dal motore di gioco (ConquerCastle3D).':item.rotations?'Fotogrammi pre-renderizzati ogni 15°.':item.note||'';
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
  // A 512 x 512 PNG of an entry as the Lab shows it (state and rotation included): meshes are
  // re-rendered at that size, captures, files and symbols are fitted into the square.
  async function exportImage(item,stateId=defaultState(item),rotationDegrees=0,size=512,occupancy=occupancyMode){
    const out=document.createElement('canvas');out.width=out.height=size;
    if(item.kind==='model'||item.kind==='animal'||item.kind==='castle'&&(!stateId||stateId==='3d')){
      renderModel(out,item,rotationDegrees,occupancy);return out.toDataURL('image/png');
    }
    const box=document.createElement('div');makePreview(item,box,true,rotationDegrees,stateId);
    let el=box.querySelector('canvas,img,svg');if(!el)throw new Error('export: nessun render per '+item.id);
    if(el.tagName.toLowerCase()==='svg'){const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(el));el=im}
    if(el.tagName==='IMG'&&!(el.complete&&el.naturalWidth))await new Promise(res=>{el.onload=el.onerror=res});
    const w=el.naturalWidth||el.width,h=el.naturalHeight||el.height,k=Math.min((size-16)/(w||1),(size-16)/(h||1));
    out.getContext('2d').drawImage(el,(size-w*k)/2,(size-h*k)/2,w*k,h*k);
    return out.toDataURL('image/png');
  }
  const OCCUPANCY_LABEL={off:'Occupazione: no',depth:'Occupazione: occlusione corretta',overlay:'Occupazione: come nel gioco (sopra)'};
  byId('assetOccupancy')?.addEventListener('click',e=>{
    occupancyMode={off:'depth',depth:'overlay',overlay:'off'}[occupancyMode];
    e.currentTarget.textContent=OCCUPANCY_LABEL[occupancyMode];
    if(selectedItem)makePreview(selectedItem,byId('assetDetailPreview'),true,selectedRotation,selectedState);
  });
  byId('assetExportPng')?.addEventListener('click',async()=>{
    if(!selectedItem)return;
    const a=document.createElement('a');a.href=await exportImage(selectedItem,selectedState,selectedRotation);
    a.download=selectedItem.id+(selectedState&&selectedState!=='3d'?'-'+selectedState:'')+(selectedRotation?'-r'+selectedRotation:'')+'-512.png';a.click();
  });
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
    lab:{makePreview,modelMesh,engineCapture,defaultState,rotationFrame},exportImage};
  // Reparent the existing native animation canvas: the animator retains its context.
  const liveCanvas=byId('c');if(liveCanvas)byId('assetAnimationPanel').appendChild(liveCanvas);
  refresh();
  selectItem(items.find(x=>x.id==='animal:sheep')||items[0]);
  // The engine frame is heavy: start it once the catalogue is on screen.
  setTimeout(loadEngine,0);
})();
