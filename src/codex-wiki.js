'use strict';
(async function(){
  const main=document.getElementById('reading'),form=document.getElementById('search-form');
  const q=document.getElementById('query'),family=document.getElementById('family'),status=document.getElementById('completion');
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href=(id,section)=>'#'+encodeURIComponent(id)+(section?'?section='+encodeURIComponent(section):''),num=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:2});
  const stateLabels={present:'Nel catalogo',partial:'Parziale',planned:'Previsto'};
  const goods={gold:'Oro',stone:'Pietra',clay:'Argilla',wood:'Legno',metal:'Metallo',food:'Cibo',equipment:'Equipaggiamento',luxury:'Beni di lusso'};
  const fold=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('it');
  let api,data,host=null,embedded=false;
  try{
    if(new URLSearchParams(location.search).get('embedded')==='1'&&parent!==window&&parent.location.origin===location.origin&&parent.ConquerWikiHost){host=parent.ConquerWikiHost;api=parent.ConquerGameCodex;embedded=true}
    if(!api){const response=await fetch('./catalog.json');if(!response.ok)throw new Error('Catalogo non disponibile');data=await response.json();api=ConquerCodex.fromSnapshot(data.catalog)}
    const content=ConquerWikiContent.create(api),pages=content.pages,rows=[...pages.values()].filter(p=>p.kind==='entry');
    document.body.classList.toggle('embedded',embedded);
    if(embedded){const exit=document.getElementById('return-game');exit.textContent='Apri pagina pubblica';exit.target='_blank';exit.rel='noopener';}
    for(const [key,labels] of Object.entries(ConquerWikiContent.categories)){const option=document.createElement('option');option.value=key;option.textContent=labels[0];family.append(option)}
    const anchor=(id,label,cls='',section)=>'<a '+(cls?'class="'+e(cls)+'" ':'')+'href="'+href(id,section)+'">'+e(label||content.title(id))+'</a>';
    const prose=(text,self)=>content.tokenize(text,self).map(t=>t.id?anchor(t.id,t.text):e(t.text)).join('');
    const formatted=text=>e(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    const editorialInline=(tokens,self)=>content.inline(tokens,self).map(t=>t.id?anchor(t.id,t.text,'',t.anchor):formatted(t.text)).join('');
    function renderBlocks(page){return page.blocks.map((block,index)=>{
      if(block.type==='heading')return '<h'+block.level+' id="'+e(block.anchor)+'" tabindex="-1">'+editorialInline(block.tokens,page.id)+'</h'+block.level+'>';
      if(block.type==='list')return '<ul>'+block.items.map(tokens=>'<li>'+editorialInline(tokens,page.id)+'</li>').join('')+'</ul>';
      return '<p'+(index===0?' class="lead"':'')+'>'+editorialInline(block.tokens,page.id)+'</p>';
    }).join('')}
    const navigation=document.getElementById('navigation');
    navigation.innerHTML='<h2>Le sette famiglie</h2>'+[...pages.values()].filter(p=>p.kind==='category').map(p=>anchor(p.id,p.title)).join('')+'<h2>Percorsi trasversali</h2>'+[...pages.values()].filter(p=>p.kind==='topic').map(p=>anchor(p.id,p.title)).join('');
    function list(ids,search=false){
      if(!ids.length)return'<p class="empty">Nessuna voce corrisponde a questi criteri. Prova un altro termine o seleziona tutte le famiglie.</p>';
      return'<ul class="entry-list">'+ids.map(id=>{const p=pages.get(id);return'<li>'+'<a href="'+href(p.id)+'"><strong>'+e(p.title)+'</strong><small>'+e(p.kind==='entry'?stateLabels[p.record.status]:'Argomento')+'</small></a>'+(search?'<p>'+e(p.text[0].length>170?p.text[0].slice(0,167)+'…':p.text[0])+'</p>':'')+'</li>'}).join('')+'</ul>';
    }
    function breadcrumbs(p){return'<nav class="breadcrumb" aria-label="Percorso">'+anchor('home','Indice')+(p?.category?' <span>/</span> '+anchor(p.category):'')+(p?' <span>/</span> <span>'+e(p.title)+'</span>':'')+'</nav>'}
    function backlinks(id){const links=content.backlinks(id);return links.length?'<details class="backlinks"><summary>Pagine che rimandano qui ('+links.length+')</summary><ul>'+links.map(i=>'<li>'+anchor(i)+'</li>').join('')+'</ul></details>':''}
    function quoteText(result,kind){
      if(result.status==='known')return kind==='time'?num(result.value)+' giorni nominali':'<ul class="cost-list">'+Object.entries(result.value).map(([g,v])=>'<li><span>'+e(goods[g]||g)+'</span><b>'+num(v)+'</b></li>').join('')+'</ul>';
      return e({'context-required':'Dipende dalla configurazione','unmapped':'Non ancora definito','incompatible':'Configurazione non compatibile','not-found':'Voce non disponibile'}[result.status]||'Non disponibile');
    }
    function exampleLabel(s){
      const parts=[];
      if(s.type==='tower')parts.push(s.shape==='round'?'Pianta rotonda':'Pianta quadrata',s.size?num(s.size)+' × '+num(s.size)+' U':'raggio '+num(s.r)+' U');
      if(s.length)parts.push('lunghezza '+num(s.length)+' U');if(s.width)parts.push('larghezza '+num(s.width)+' U');
      if(s.reach)parts.push('sviluppo '+num(s.reach)+' U');if(s.variant)parts.push(({dry:'asciutto',water:'allagato',wood:'legno',stone:'pietra'})[s.variant]||s.variant);
      if(s.level)parts.push('L'+s.level);if(s.civicLevel)parts.push('L'+s.civicLevel);
      return parts.join(' · ')||'Configurazione iniziale';
    }
    function facts(page){
      const r=page.record,context=host?.context?.()||{},selected=context.structure;
      const selectedMatches=selected&&host.idForStructure(selected)===r.id;
      const example=data?.examples?.[r.id];
      const quote=selectedMatches?api.quote(r.id,{structure:selected}):example?.quote||api.quote(r.id);
      const p=r.properties,stats=[];
      if(p.w&&p.h)stats.push(['Ingombro',num(p.w)+' × '+num(p.h)+' U']);
      if(p.length)stats.push(['Lunghezza',num(p.length)+' U']);if(p.beam)stats.push(['Larghezza',num(p.beam)+' U']);
      if(p.good)stats.push(['Produzione',goods[p.good]||p.good]);if(p.workers!==undefined)stats.push(['Lavoratori richiesti',num(p.workers)]);
      if(p.statistics)for(const [key,label] of Object.entries({hp:'Punti salute',combat:'Combattimento',armor:'Armatura',aim:'Mira',range:'Portata'}))if(p.statistics[key]!==null&&p.statistics[key]!==undefined)stats.push([label,num(p.statistics[key])]);
      const roomSlots=context.roomSlots||[];
      let compatibility='';
      if(selected&&r.category==='room'&&roomSlots.length){
        compatibility='<div class="context"><h3>Nella struttura selezionata</h3><label for="room-slot">Spazio interno</label><select id="room-slot">'+roomSlots.map(s=>'<option value="'+s.index+'">Stanza '+(s.index+1)+' · piano '+(s.floor+1)+'</option>').join('')+'</select><p id="compatibility-result" role="status"></p></div>';
      }else if(selected&&r.category==='ship'){
        const c=api.compatible(r.id,{structure:selected});compatibility='<div class="context"><h3>Nella struttura selezionata</h3><p>'+e(c.status==='known'?(c.value?'Costruibile in questo cantiere':'Non costruibile in questa struttura'):'Compatibilità da verificare nel gioco')+'</p></div>';
      }
      return'<aside class="facts" aria-label="Dati della voce"><h2>Dati di gioco</h2><div><h3>Costo</h3>'+quoteText(quote.cost,'cost')+'<h3>Tempo</h3><p>'+quoteText(quote.time,'time')+'</p>'+(selectedMatches?'<p>Preventivo della struttura selezionata.</p>':example?'<p>Configurazione di riferimento:<br>'+e(exampleLabel(example.structure))+'. Il costo può cambiare con le opzioni.</p>':'')+'</div><div><dl>'+stats.map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(v)+'</dd>').join('')+'</dl>'+(r.assets.length?'<p><a href="../figures-lab.html" target="_blank" rel="noopener">Apri Asset Lab</a> per esplorare i modelli disponibili.</p>':'')+'</div>'+compatibility+'</aside>';
    }
    function entry(page){
      const r=page.record,related=[...new Set([...r.relations.map(l=>l.id),...page.related.filter(id=>!page.parents.includes(id))])];
      const requirements=r.requirements.functional.map(f=>f.kind==='parent'?'<li>'+anchor(f.id)+' · livello minimo '+num(f.minimumLevel)+' · massimo '+num(f.maximum)+'</li>':f.kind==='shipyard'?'<li>'+anchor('topic:navigation','Cantiere navale')+' · livelli '+f.levels.map(n=>'L'+n).join(', ')+'</li>':'').join('');
      main.innerHTML=breadcrumbs(page)+'<span class="eyebrow">'+e(pages.get(page.category).title)+'</span><h1>'+e(page.title)+'</h1><span class="status">'+e(stateLabels[r.status])+'</span><div class="article-grid"><article class="article-prose">'+renderBlocks(page)+(r.status==='partial'?'<p class="notice">Questa voce comprende parti ancora da completare. La presenza nel catalogo non certifica tutte le funzioni di gioco.</p>':'')+'<h2>Requisiti e compatibilità</h2>'+(requirements?'<ul>'+requirements+'</ul>':'')+'<p>'+prose(r.category==='room'?'La compatibilità delle stanze dipende dall’edificio, dal piano e dagli spazi disponibili.':'Il piazzamento e l’utilizzo seguono le condizioni fisiche e funzionali del gioco.',page.id)+'</p><p>'+prose('Le conoscenze richieste non sono ancora mappate. Consulta la pagina sulle tecnologie per distinguere questi requisiti dalle condizioni costruttive.',page.id)+'</p>'+(related.length?'<h2>Elementi collegati</h2><div class="section-links">'+related.map(id=>anchor(id)).join('')+'</div>':'')+'<h2>Esplora la sovracategoria</h2><div class="section-links">'+page.parents.map(id=>anchor(id)).join('')+'</div>'+backlinks(page.id)+'</article>'+facts(page)+'</div>';
      const roomSelect=document.getElementById('room-slot');
      if(roomSelect){const update=()=>{const result=api.compatible(page.id,{structure:host.context().structure,slot:Number(roomSelect.value)});document.getElementById('compatibility-result').textContent=result.status==='known'?(result.value?'Assegnabile a questo spazio':'Non assegnabile a questo spazio'):'Compatibilità da verificare nel gioco'};roomSelect.addEventListener('change',update);update()}
    }
    function home(){
      main.innerHTML='<section class="home-intro"><span class="eyebrow">L’insediamento, voce per voce</span><h1>Il sapere di CONQUER</h1><p class="lead">'+prose('Esplora edifici, stanze e navi. Segui i collegamenti tra fortificazioni, produzione e vita dell’insediamento.','home')+'</p></section><div class="lede-rule"></div><span class="eyebrow">'+rows.length+' voci · sette famiglie</span><div class="home-index">'+[...pages.values()].filter(p=>p.kind==='category').map(p=>'<a href="'+href(p.id)+'"><strong>'+e(p.title)+'</strong><small>'+p.members.length+' voci</small></a>').join('')+'</div><h2>Percorsi di lettura</h2><div class="topic-strip">'+[...pages.values()].filter(p=>p.kind==='topic').map(p=>anchor(p.id)).join('')+'</div><h2>Come leggere il Codex</h2><p>'+prose('Le parole evidenziate aprono altre pagine. Ogni voce rimanda alla propria famiglia e agli elementi correlati; le tecnologie saranno collegate in una fase successiva.','home')+'</p>';
    }
    function route(){
      let id;try{id=decodeURIComponent(location.hash.slice(1).split('?')[0])||'home'}catch{id='invalid'}
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      q.value=params.get('q')||'';family.value=params.get('category')||'';status.value=params.get('status')||'';
      for(const a of navigation.querySelectorAll('a'))a.setAttribute('aria-current',a.hash===href(id)?'page':'false');
      if(id==='home'){document.title='CONQUER — Codex';home()}
      else if(id==='search'){
        const term=fold(q.value.trim()),matches=[...pages.values()].filter(p=>{
          if((family.value||status.value)&&p.kind!=='entry')return false;
          if(family.value&&p.record.category!==family.value)return false;if(status.value&&p.record.status!==status.value)return false;
          return !term||fold([p.title,p.id,...p.text].join(' ')).includes(term);
        });
        document.title='Ricerca — CONQUER Codex';main.innerHTML=breadcrumbs()+'<span class="eyebrow">Ricerca nel Codex</span><h1>'+(q.value?'Risultati per “'+e(q.value)+'”':'Tutte le voci')+'</h1><p class="result-count" role="status">'+matches.length+' risultati</p>'+list(matches.map(p=>p.id),true);
      }else{
        const page=pages.get(id);
        if(!page){document.title='Pagina non trovata — CONQUER Codex';main.innerHTML=breadcrumbs()+'<h1>Pagina non trovata</h1><p>Il collegamento non corrisponde a una pagina del Codex.</p><p>'+anchor('home','Torna all’indice')+'</p>'}
        else{document.title=page.title+' — CONQUER Codex';if(page.kind==='entry')entry(page);else main.innerHTML=breadcrumbs(page)+'<span class="eyebrow">'+(page.kind==='category'?'Famiglia del catalogo':'Percorso di lettura')+'</span><h1>'+e(page.title)+'</h1>'+renderBlocks(page)+(page.members.length?'<h2>Voci in questa pagina</h2><p class="result-count">'+page.members.length+' voci</p>'+list(page.members):'<p class="notice">Le associazioni alle singole voci saranno definite in una fase successiva.</p>')+backlinks(page.id)}
      }
      if(embedded)document.getElementById('return-game').href='./'+location.hash;
      main.focus({preventScroll:true});
      const section=params.get('section');const target=section&&document.getElementById(section);
      if(target&&main.contains(target)){target.scrollIntoView();target.focus({preventScroll:true})}else window.scrollTo(0,0);
    }
    document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView()});
    form.addEventListener('submit',event=>{event.preventDefault();const p=new URLSearchParams();if(q.value.trim())p.set('q',q.value.trim());if(family.value)p.set('category',family.value);if(status.value)p.set('status',status.value);const hash='#search?'+p.toString();if(location.hash===hash)route();else location.hash=hash});
    family.addEventListener('change',()=>form.requestSubmit());status.addEventListener('change',()=>form.requestSubmit());
    window.addEventListener('hashchange',route);
    if(embedded)window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();host.close()}});
    route();
  }catch(error){
    console.error('Codex Wiki:',error);main.innerHTML='<div class="error"><span class="eyebrow">CONQUER CODEX</span><h1>Il catalogo non è disponibile</h1><p>Non è stato possibile aprire le voci. Riprova tra poco.</p><button type="button" id="retry">Riprova</button></div>';document.getElementById('retry').addEventListener('click',()=>location.reload());
  }
})();
