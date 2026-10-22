/* CONQUER visual asset catalogue: native model registries + actual repository art.
 * Source of truth for static art is the checked-in manifest. Models are read at runtime.
 * Schematic entries are explicitly labelled, never passed off as game renders.
 */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const gallery=byId('assetGallery'),filters=byId('assetCategoryFilters'),details=byId('assetDetail');
  if(!gallery||!filters||!details)return;
  const STATIC_FILES=["src/assets/animals/capra_estesa.svg","src/assets/animals/cavallo_esteso.svg","src/assets/animals/mucca_estesa.svg","src/assets/animals/pecora_estesa.svg","src/assets/architecture/arcade_2.png","src/assets/architecture/arcade_3.png","src/assets/architecture/arrow_slit.png","src/assets/architecture/gate_portal.png","src/assets/architecture/gate_portal_broken.png","src/assets/architecture/gate_portal_damaged.png","src/assets/architecture/gothic_l1.png","src/assets/architecture/gothic_l2.png","src/assets/architecture/gothic_l3.png","src/assets/architecture/tower_door.png","src/assets/bushes/bush_01_tondo.svg","src/assets/bushes/bush_02_globulare.svg","src/assets/bushes/bush_03_stratificato_globulare.svg","src/assets/bushes/bush_04_largo.svg","src/assets/bushes/bush_05_asimmetrico.svg","src/assets/bushes/bush_06_multilobato.svg","src/assets/bushes/bush_07_spinoso.svg","src/assets/economy/logging_camp.svg","src/assets/economy/mine.svg","src/assets/economy/stone_quarry.svg","src/assets/forest/tree_01_tonda.svg","src/assets/forest/tree_02_affusolata.svg","src/assets/forest/tree_03_conica.svg","src/assets/forest/tree_04_ombrello.svg","src/assets/forest/tree_05_goccia.svg","src/assets/forest/tree_06_stratificata.svg","src/assets/forest/tree_07_asimmetrica.svg","src/assets/heraldry/her1.svg","src/assets/heraldry/her2.svg","src/assets/interior/barrel.svg","src/assets/interior/crate.svg","src/assets/tree-svgrepo-com.svg"];
  const CATEGORY_ORDER=['Tutti','Fortificazioni','Edifici','Produzione','Popolazione','Truppe','Fauna','Veicoli','Assedio','Natura','Scatter','Interni','Araldica','Territorio'];
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
  const SCHEMATICS=[
    ['tower-square','Torre quadrata','Fortificazioni','Torri'],
    ['tower-round','Torre circolare','Fortificazioni','Torri'],
    ['watchtower','Torre di guardia in legno','Fortificazioni','Torri'],
    ['palisade-tower','Torre palizzata','Fortificazioni','Torri'],
    ['wall','Mura in pietra','Fortificazioni','Mura'],
    ['built','Mura abitate (Built Sections)','Fortificazioni','Mura'],
    ['palisade','Palizzata','Fortificazioni','Mura'],
    ['gate','Portale fortificato','Fortificazioni','Accessi'],
    ['drawbridge','Ponte levatoio','Fortificazioni','Accessi'],
    ['moat','Fossato','Fortificazioni','Accessi'],
    ['bridge','Ponte','Fortificazioni','Accessi'],
    ['earthworks','Terrapieno','Fortificazioni','Difese'],
    ['hoarding','Caditoie in legno','Fortificazioni','Difese'],
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
  const fileCategory=path=>path.includes('/animals/')?'Fauna':path.includes('/architecture/')?'Fortificazioni'
    :path.includes('/economy/')?'Produzione':path.includes('/forest/')||path.includes('/bushes/')||path.endsWith('/tree-svgrepo-com.svg')?'Natura'
    :path.includes('/interior/')?'Interni':path.includes('/heraldry/')?'Araldica':'Territorio';
  const fileFamily=path=>path.split('/').slice(-2,-1)[0]||'SVG';
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
  for(const source of MODEL_SOURCES){
    const registry=window[source.global],collection=registry&&registry[source.collection];
    if(!collection)continue;
    for(const key of Object.keys(collection)){
      const isCivicProp=source.global==='ConquerCivicModels'&&key.startsWith('prop_');
      const isCivicIndoor=source.global==='ConquerCivicModels'&&/table|stall|storage|stables|shop|brewery|warehouse/.test(key);
      let category=isCivicProp?'Scatter':isCivicIndoor?'Interni':source.category;
      const family=source.global==='ConquerScatterModel'?prettify(collection[key].family||'Oggetti ambientali')
        :isCivicProp?'Arredi ambientali':source.family;
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

  // The same indexed/triangle Blender geometry used by the game, not screenshots or illustrations.
  const meshCache=new Map();
  function modelMesh(item){
    if(meshCache.has(item.id))return meshCache.get(item.id);
    let mesh;
    if(item.kind==='animal'&&window.ConquerAnimals3D){
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
  function renderModel(canvas,item){return renderMesh(canvas,modelMesh(item))}
  function renderMesh(canvas,mesh){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    if(!mesh)return placeholder(canvas,'ANTEPRIMA NON DISPONIBILE');
    const p=mesh.pos;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<p.length;i+=3){
      const x=(p[i]-p[i+1])*.866,y=(p[i]+p[i+1])*.5-p[i+2]*.95;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(!Number.isFinite(minX))return placeholder(canvas,'MODELLO VUOTO');
    const scale=Math.min((w-28)/Math.max(.01,maxX-minX),(h-28)/Math.max(.01,maxY-minY),900);
    const mx=(minX+maxX)/2,my=(minY+maxY)/2;
    const view={turns:0,
      project:(x,y,z)=>({x:w/2+((x-y)*.866-mx)*scale,y:h/2+((x+y)*.5-z*.95-my)*scale}),
      depth:(x,y,z)=>x+y+z*.55};
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
    const tower=key.includes('tower')||key==='gate'||key.startsWith('house')||key==='well';
    const linear=['wall','built','palisade','hoarding','bridge','drawbridge','road','earthworks','moat'].includes(key);
    if(tower){
      poly([[cx-s*.7,cy-s*.4],[cx,cy-s*.75],[cx+s*.7,cy-s*.4],[cx,cy]],'#796958');
      poly([[cx-s*.7,cy-s*.4],[cx,cy],[cx,cy+s*.75],[cx-s*.7,cy+s*.30]],'#514b43');
      poly([[cx,cy],[cx+s*.7,cy-s*.4],[cx+s*.7,cy+s*.3],[cx,cy+s*.75]],'#9c8570');
      if(key==='tower-round'||key==='well'){
        g.beginPath();g.ellipse(cx,cy-s*.45,s*.65,s*.30,0,0,Math.PI*2);g.fillStyle='#9c8570';g.fill();g.stroke();
      }
      if(key==='gate'){g.fillStyle='#312920';g.fillRect(cx-s*.24,cy+s*.1,s*.48,s*.5)}
    }else if(linear){
      poly([[cx-s*1.5,cy],[cx+s*.6,cy-s*.8],[cx+s*1.45,cy-s*.33],[cx-s*.65,cy+s*.55]],key==='moat'?'#426676':key==='road'?'#817b69':'#8e7b64');
      if(!['road','moat','earthworks'].includes(key))poly([[cx-s*.65,cy+s*.55],[cx+s*1.45,cy-s*.33],[cx+s*1.45,cy+s*.10],[cx-s*.65,cy+s]],'#594e43');
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
  function renderFigure(canvas,item){
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,subject=item.subject;
    g.clearRect(0,0,w,h);
    if(subject==='wagon3d'&&window.ConquerWagons3D?.worldTriangles){
      const spec={chassis:'wagon',cargo:['crate','sack','barrel'],team:[]};
      const mesh=window.ConquerWagons3D.worldTriangles(spec,{x:0,y:0,heading:0,distance:0});
      return renderMesh(canvas,mesh);
    }
    if(subject==='wagon'&&window.ConquerWagons?.drawWagon){
      window.ConquerWagons.drawWagon(g,w*.48,h*.64,Math.min(w*.48,h*.8),
        {chassis:'wagon',cargo:['crate','barrel'],team:[],facing:1,moving:false,t:0,distance:0});return;
    }
    const previous=ctx,oldScale=State.view.scale;
    try{
      ctx=g;State.view.scale=Math.min(w*.09,h*.14);
      const p={x:w*.5,y:h*.78};
      if(subject==='villager'){
        drawVillagerFigureUnmasked({id:'asset-lab-villager',kind:'peasant',sex:'male',age:'adult',
          hair:'brown',colors:['#8c6b3f','#5d4a32'],p});
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
  function makePreview(item,container,large){
    container.replaceChildren();
    if(item.kind==='file'){
      const im=document.createElement('img');im.src=item.url;im.alt=item.title;im.loading=large?'eager':'lazy';
      im.decoding='async';im.addEventListener('error',()=>{container.textContent='File non caricabile';});
      container.appendChild(im);return;
    }
    if(item.kind==='symbol')return renderSymbol(container,item);
    const canvas=document.createElement('canvas');canvas.width=large?680:248;canvas.height=large?390:156;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Anteprima '+item.title);
    container.appendChild(canvas);
    if(item.kind==='schematic')return renderSchema(canvas,item);
    if(item.kind==='model'||item.kind==='animal')return renderModel(canvas,item);
    if(item.kind==='figure')return renderFigure(canvas,item);

  }
  let currentCategory='Tutti',currentFamily='',currentFormat='',query='',selectedId='';
  let observer=null;
  function selectItem(item){
    if(!item)return;
    selectedId=item.id;
    document.querySelectorAll('.asset-card').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.id===item.id)));
    byId('assetDetailName').textContent=item.title;
    byId('assetDetailMeta').textContent=item.category+' / '+item.family+' · '+item.format;
    byId('assetDetailSource').textContent=item.source;
    const live=!!item.subject&&!!document.querySelector('[data-subject="'+item.subject+'"]');
    document.body.classList.toggle('asset-figure',live);
    document.body.classList.toggle('asset-catalog-static',!live);
    const art=byId('assetDetailPreview');art.hidden=live;
    const label=byId('assetPreviewNote');label.textContent=live?'Anteprima animata dal motore di gioco.':'';
    if(live)document.querySelector('[data-subject="'+item.subject+'"]').click();
    else makePreview(item,art,true);
    const link=byId('assetBuilderLink');link.hidden=!item.builder;
    details.hidden=false;
  }
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
  function refresh(){
    updateFilters();
    const subset=items.filter(x=>(currentCategory==='Tutti'||x.category===currentCategory)&&
      (!currentFamily||x.family===currentFamily)&&(!currentFormat||x.kind===currentFormat)&&
      (!query||(x.title+' '+x.family+' '+x.category+' '+x.key+' '+x.source).toLocaleLowerCase('it').includes(query)));
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
  window.ConquerAssetCatalog={items,refresh,select:id=>{const item=items.find(x=>x.id===id);if(item)selectItem(item)},get selected(){return selectedId}};
  refresh();
  selectItem(items.find(x=>x.id==='animal:sheep')||items[0]);
})();