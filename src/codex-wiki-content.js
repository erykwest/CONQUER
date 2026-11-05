'use strict';
// Editorial content only. Numbers, prices and compatibility stay in the Codex.
(function(root){
  const categories={building:['Edifici','edificio','edifici'], 'sub-building':['Annessi','annesso','annessi','sub-building'],upgrade:['Miglioramenti','miglioramento','miglioramenti','upgrade'],room:['Stanze','stanza','stanze'],unit:['Unità','unità'], 'siege-engine':['Macchine da guerra','macchina da guerra','macchine da guerra','macchine d’assedio'],ship:['Navi','nave','navi','imbarcazioni']};
  const names={tower:'Torre',gate:'Porta fortificata',wall:'Mura',palisade:'Palizzata',built:'Sezione costruita',well:'Pozzo',house:'Casa',field:'Campo coltivato',road:'Strada',moat:'Fossato',bridge:'Ponte',market:'Mercato',tavern:'Taverna',church:'Chiesa',training:'Campo di addestramento',plaza:'Piazza',townhall:'Municipio',guild:'Gilda',loggingCamp:'Campo taglialegna',quarry:'Cava di pietra',mine:'Miniera',windmill:'Mulino a vento',watermill:'Mulino ad acqua',pier:'Molo',quay:'Banchina',vineyard:'Vigneto',
    streetSpot:'Spazio per artisti',stage:'Palco',festivalGround:'Spiazzo per eventi',arenaLot:'Arena',armyCamp:'Accampamento militare',pillory:'Gogna',gallows:'Forca',scaffold:'Patibolo',
    guard:'Posto di guardia',barracks:'Caserma',armory:'Armeria',storage:'Deposito materiali',granary:'Granaio',kitchen:'Cucina',stables:'Scuderie',nobleRoom:'Camere nobiliari',workshop:'Officina d’armamento',chapel:'Cappella',commonHall:'Sala comune',throneHall:'Sala del trono',treasury:'Tesoreria',prison:'Prigione',latrine:'Latrina',infirmary:'Infermeria',dovecote:'Colombaia',cistern:'Cisterna',council:'Sala del consiglio',tribunal:'Tribunale',
    spearman:'Lanciere',patrol:'Pattuglia',wolf:'Lupo',infantry:'Fanteria',knight:'Cavaliere',captain:'Capitano',archer:'Arciere',
    ram:'Ariete',catapult:'Mangano',trebuchet:'Trabucco',mantlet:'Mantelletto',ladder:'Scala d’assalto',ballista:'Ballista',
    cemetery:'Cimitero',herbGarden:'Orto delle erbe',scriptorium:'Scriptorium',almshouse:'Ospizio',monastery:'Monastero',cloister:'Chiostro',square:'Sagrato',courtyard:'Cortile di servizio',brewery:'Birreria',inn:'Alloggio per ospiti',stall:'Bancarella',loggia:'Loggia',warehouse:'Magazzino',shop:'Bottega'};
  const specific={
    'building:tower':'La torre appartiene alle fortificazioni. Forma, materiale e dimensioni determinano le configurazioni possibili; le stanze utilizzabili dipendono anche dal piano e dal ruolo dell’edificio.',
    'building:gate':'La porta fortificata controlla un accesso nelle fortificazioni. Il ponte levatoio della porta e la grata sono elementi distinti, con funzioni e danni propri.',
    'building:built':'La sezione costruita ospita stanze entro il castello. Dimensioni e piani influenzano gli spazi disponibili; la cucina e le scuderie seguono regole diverse.',
    'building:mine':'La miniera appartiene agli edifici di produzione. Nel gioco attuale produce pietra: il suo nome non implica ancora una produzione di metallo.',
    'building:clay-quarry':'La cava argilla è una variante della cava di pietra. L’argilla viene usata nelle costruzioni in mattoni; il piazzamento richiede terreno basso e vicinanza ad acqua interna.',
    'building:well':'Il pozzo fonda il villaggio e partecipa alla disponibilità d’acqua. La cisterna è invece una stanza delle fortificazioni; durante un assedio la raggiungibilità dell’acqua conta.',
    'building:house':'La casa accoglie la popolazione civile. I livelli L1–L4 distinguono le coorti; classe sociale e incarico di lavoro non sono la stessa cosa.',
    'building:plaza':'La piazza è uno spazio civile con varianti pavimentata, fontana e giardino. La presenza della costruzione non implica servizi o bonus di popolazione già simulati.',
    'building:pier':'Il molo offre attracchi alle navi. La destinazione commerciale o militare influenza gli ormeggi; il cantiere navale è una struttura specializzata distinta dal normale molo.',
    'building:vineyard':'Il vigneto compare nelle definizioni economiche, ma la voce è parziale: non dimostra la presenza di un edificio selezionabile nel Builder.',
    'room:kitchen':'La cucina è una stanza al piano terra delle sezioni costruite. Non è assegnabile alle torri o alle porte fortificate. Fa parte dell’organizzazione interna e della logistica del castello.',
    'room:stables':'Le scuderie sono stanze al piano terra delle torri o delle sezioni costruite compatibili. Le sale larghe W2, le porte fortificate e le sottotorri sono escluse.',
    'room:cistern':'La cisterna è una stanza al piano terra delle torri in pietra di dimensione almeno media. Fornisce acqua al presidio quando i pozzi esterni non sono raggiungibili.',
    'room:latrine':'La latrina è una stanza che modifica anche l’esterno della costruzione. La sua assegnazione dipende dal piano, dal tipo di edificio e dallo spazio libero per lo sbalzo; la compatibilità segue le regole correnti del gioco.',
    'room:infirmary':'L’infermeria è una stanza delle sezioni costruite, al piano terra o al primo piano. Non è prevista nelle torri: il trasporto dei feriti richiede ambienti accessibili.',
    'room:prison':'La prigione è una stanza al piano terra di una costruzione compatibile. Nel municipio segue il catalogo delle stanze civiche; nelle porte il piano terra resta un passaggio.',
    'room:tribunal':'Il tribunale è una stanza del municipio disponibile dal livello L2. Non è una funzione ordinaria delle torri o delle sezioni costruite.',
    'upgrade:gate.drawbridge':'Il ponte levatoio della porta è un miglioramento delle fortificazioni che consente di interrompere il passaggio. Va distinto dal ponte levatoio del mastio e dal ponte fisso sul fossato.',
    'upgrade:gate.portcullis':'La grata è un miglioramento della porta fortificata. È distinta dal portone e dal nucleo murario: le sue condizioni influiscono sul controllo dell’accesso.',
    'siege-engine:mantlet':'Il mantelletto appartiene alle macchine da guerra. Il modello e l’animazione sono disponibili; la sola presenza visiva non certifica un effetto difensivo completo nel combattimento.'
  };
  const aliases={
    'building:built':['sezioni costruite','sezione costruita'], 'building:gate':['porte fortificate','porta fortificata'],
    'building:tower':['torri','torre'], 'building:well':['pozzi','pozzo'], 'building:moat':['fossati','fossato'],
    'building:bridge':['ponti fissi','ponte fisso'], 'building:clay-quarry':['cava argilla'],
    'upgrade:gate.drawbridge':['ponte levatoio della porta'], 'upgrade:keep.drawbridge':['ponte levatoio del mastio'],
    'topic:fortifications':['fortificazioni','fortificazione','castello'], 'topic:production':['produzione','filiera produttiva'],
    'topic:logistics':['logistica','rifornimenti'], 'topic:population':['popolazione','popolazione civile'],
    'topic:combat':['combattimento','assedio'], 'topic:navigation':['navigazione','cantiere navale'],
    'topic:construction':['costruzioni','costruzione'], 'topic:technology':['tecnologie','conoscenze']
  };
  function title(r){
    if(r.id==='building:clay-quarry')return'Cava argilla';
    if(r.id.startsWith('building:shipyard.'))return'Cantiere navale L'+r.key.split('.').at(-1);
    if(r.id.startsWith('building:terraforming.'))return({terrain:'Modellazione del terreno',walled:'Terrazzamento murato',flat:'Spianamento'})[r.key];
    if(r.id.startsWith('unit:cohort.'))return'Civili '+r.key;
    if(r.category==='siege-engine'&&r.key.startsWith('tower'))return r.key==='tower'?'Torre d’assedio':'Torre d’assedio alta';
    if(r.category==='upgrade'){
      const fixed={'gate.drawbridge':'Ponte levatoio della porta','gate.portcullis':'Grata','keep.stair':'Scala lignea del mastio','keep.stone-stair':'Scala in pietra del mastio','keep.drawbridge':'Ponte levatoio del mastio'};
      if(fixed[r.key])return fixed[r.key];
      const p=r.properties,values={none:'nessuno',off:'smontato',on:'montato',battlement:'merlato',machicolation:'con caditoie',pitched:'a falde',standard:'standard',buttress:'con contrafforti',splayed:'a scarpa',mangonel:'mangano',ballista:'ballista',pyramid:'piramidale',gable:'a due falde',hip:'a padiglione',stone:'pietra',timber:'legno',flat:'piano',hoarding:'ballatoio',arcade:'porticato',bell:'campana'};
      const fields={roofStyle:'Sommità',baseStyle:'Base',topWeapon:'Arma sommitale',bartizan:'Garitta',roofShape:'Forma del tetto',hoarding:'Ballatoio',bell:'Campana',upper:'Piano superiore',skin:'Rivestimento'};
      return(names[r.id.split(':')[1].split('.')[0]]||'Struttura')+' · '+fields[p.variant]+' '+(values[p.value]||p.value);
    }
    if(r.category==='ship')return r.label;
    const key=r.key.startsWith('venue.')?r.key.slice(6):r.key;
    return names[key]||r.label;
  }
  const topics=[
    {id:'fortifications',title:'Fortificazioni',text:'Le fortificazioni organizzano la difesa del castello. Torri, mura e porte fortificate controllano spazi e accessi; le stanze e i miglioramenti ne completano le funzioni.',test:r=>['tower','gate','wall','palisade','built'].includes(r.key)||r.category==='upgrade'},
    {id:'production',title:'Produzione',text:'La produzione collega popolazione, lavoro ed edifici. Le risorse alimentano le costruzioni e la logistica; ogni struttura segue la filiera effettivamente presente nel gioco.',test:r=>['loggingCamp','quarry','mine','windmill','watermill','field','vineyard'].includes(r.key)},
    {id:'logistics',title:'Logistica',text:'La logistica riguarda scorte, capacità e collegamenti. Deposito materiali, granaio, armeria e cisterna svolgono ruoli diversi; strade, moli e navi collegano l’insediamento.',test:r=>['storage','granary','armory','treasury','cistern','road','pier','quay','warehouse'].includes(r.key)||r.category==='ship'},
    {id:'population',title:'Popolazione',text:'La popolazione vive nelle case e partecipa alla produzione. Le coorti civili L1–L4 non coincidono con i singoli incarichi di lavoro; le unità militari hanno profili propri.',test:r=>r.category==='unit'||r.key==='house'},
    {id:'combat',title:'Combattimento e assedio',text:'Il combattimento unisce unità, fortificazioni e macchine da guerra. Gli accessi, i danni e i rifornimenti rendono il castello parte del sistema difensivo.',test:r=>r.category==='siege-engine'||r.properties.kind==='combat-profile'||['tower','gate','wall','palisade'].includes(r.key)},
    {id:'navigation',title:'Navigazione e porti',text:'La navigazione collega le navi ai porti e al cantiere navale. Gli attracchi commerciali e militari, gli equipaggi e le rotte hanno funzioni distinte.',test:r=>r.category==='ship'||['pier','quay'].includes(r.key)||r.id.startsWith('building:shipyard.')},
    {id:'construction',title:'Costruzioni',text:'Le costruzioni impiegano risorse e lavoro. I costi e i giorni nominali dipendono dalla configurazione; un miglioramento non equivale sempre a una nuova costruzione.',test:r=>['building','sub-building','upgrade'].includes(r.category)},
    {id:'technology',title:'Conoscenze e tecnologie',text:'Le conoscenze saranno collegate agli elementi del catalogo in una fase successiva. I requisiti fisici e funzionali restano distinti: una struttura compatibile non implica una tecnologia già ricercata.',test:()=>false}
  ];
  function create(catalog){
    const rows=catalog.list(),byId=new Map(rows.map(r=>[r.id,r])),pages=new Map();
    for(const [key,labels] of Object.entries(categories))pages.set('category:'+key,{id:'category:'+key,title:labels[0],kind:'category',text:[({building:'Gli edifici comprendono le strutture civili e militari, le infrastrutture e le opere del territorio. Produzione, popolazione e fortificazioni sono percorsi di lettura trasversali.','sub-building':'Gli annessi sono elementi collegati a un edificio principale. Possono richiedere un livello minimo, un ingombro e un limite di quantità; le loro funzioni restano distinte da quelle delle stanze.',upgrade:'I miglioramenti comprendono accessori e configurazioni di strutture esistenti. Compatibilità, effetti e costi dipendono dal singolo elemento delle fortificazioni o delle costruzioni.',room:'Le stanze assegnano funzioni agli spazi interni. Tipo di edificio, dimensione, piano e stato della costruzione determinano le assegnazioni possibili.',unit:'Le unità comprendono profili di combattimento e coorti della popolazione. Un profilo non equivale automaticamente a una scelta di reclutamento.','siege-engine':'Le macchine da guerra comprendono arieti, mangani, trabucchi, torri d’assedio e altri dispositivi. Modelli, animazioni e impiego nel combattimento possono avere livelli di completamento diversi.',ship:'Le navi sono imbarcazioni con scafo, equipaggio e ruolo. Il cantiere navale costruisce i tipi compatibili con il proprio livello; moli e banchine ne organizzano gli attracchi.'})[key]],members:rows.filter(r=>r.category===key).map(r=>r.id)});
    for(const t of topics)pages.set('topic:'+t.id,{id:'topic:'+t.id,title:t.title,kind:'topic',text:[t.text],members:rows.filter(t.test).map(r=>r.id)});
    for(const r of rows){
      const category=pages.get('category:'+r.category).title.toLowerCase();
      let text=specific[r.id];
      if(!text){
        if(r.category==='sub-building')text=title(r)+' è un annesso di '+title(byId.get(r.relations.find(l=>l.kind==='belongs-to').id))+'. Il livello richiesto e gli ingombri sono definiti dal catalogo; servizi, posti di lavoro e rese non vanno dedotti dalla sola presenza dell’annesso.';
        else if(r.category==='upgrade')text=title(r)+' appartiene ai miglioramenti delle fortificazioni. Le condizioni della struttura determinano le opzioni utilizzabili: la presenza nel catalogo non garantisce che ogni configurazione possa essere installata.';
        else if(r.category==='room')text=title(r)+' appartiene alle stanze del castello o degli edifici civici compatibili. L’assegnazione dipende dalla struttura e dal piano; le funzioni disponibili seguono le regole della partita.';
        else if(r.category==='ship')text=title(r)+' appartiene alle navi costruibili nel cantiere navale. Il livello del cantiere determina la disponibilità; ruolo, equipaggio e attracco completano l’impiego nella navigazione.';
        else if(r.category==='siege-engine')text=title(r)+' appartiene alle macchine da guerra. Il catalogo comprende il modello e l’animazione; produzione, equipaggio e comportamento di combattimento vanno distinti dalla rappresentazione visiva.';
        else if(r.category==='unit')text=title(r)+' è '+(r.properties.kind==='civilian-cohort'?'una coorte della popolazione civile. Il livello sociale va distinto dalla professione e dall’incarico corrente.':'un profilo presente nel combattimento. Le statistiche descrivono il profilo e non costituiscono un costo di reclutamento.');
        else text=title(r)+' appartiene agli edifici e alle opere dell’insediamento. Le costruzioni dipendono dai materiali, dal territorio e dalle condizioni funzionali effettive del gioco.';
      }
      pages.set(r.id,{id:r.id,title:title(r),kind:'entry',record:r,text:[text],category:'category:'+r.category,parents:['category:'+r.category,...topics.filter(t=>t.test(r)).map(t=>'topic:'+t.id)]});
    }
    const terms=new Map();
    function register(term,id){if(!term||term.length<3||!pages.has(id))return;const k=term.toLocaleLowerCase('it');if(!terms.has(k))terms.set(k,id);else if(terms.get(k)!==id)terms.set(k,null)}
    for(const p of pages.values())if(p.kind==='entry'&&!p.title.includes(' · '))register(p.title,p.id);
    for(const [key,labels] of Object.entries(categories))for(const term of labels)terms.set(term.toLowerCase(),'category:'+key);
    for(const [id,words] of Object.entries(aliases))for(const w of words)terms.set(w.toLowerCase(),id);
    const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const regex=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+[...terms.keys()].filter(k=>terms.get(k)).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![\\p{L}\\p{N}_])','giu');
    function tokenize(text,self){
      const tokens=[],seen=new Set();let at=0;regex.lastIndex=0;
      for(const m of text.matchAll(regex)){
        const id=terms.get(m[0].toLocaleLowerCase('it'));
        if(id===self||seen.has(id))continue;
        if(m.index>at)tokens.push({text:text.slice(at,m.index)});
        tokens.push({text:m[0],id});seen.add(id);at=m.index+m[0].length;
      }
      if(at<text.length)tokens.push({text:text.slice(at)});return tokens;
    }
    function backlinks(id){return[...pages.values()].filter(p=>p.id!==id&&(p.text.some(text=>tokenize(text,p.id).some(t=>t.id===id))||p.record?.relations.some(r=>r.id===id))).map(p=>p.id)}
    return{pages,tokenize,backlinks,title:id=>pages.get(id)?.title||id};
  }
  root.ConquerWikiContent={create,categories};
})(typeof window==='undefined'?globalThis:window);
