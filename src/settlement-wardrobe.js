'use strict';
// CONQUER seasonal wardrobe: a catalogue of clothing overlays drawn over the shared
// villager figure (drawVillagerFigureUnmasked) in bad weather and in the cold months.
// Overlays, not alternate skins: the procedural body keeps its class silhouette and
// tunic colours, and the pieces stack (a cloak with a hood, a shawl under a hat).
// Outfits are pure functions of resident id, month and weather: no state, no economy.
// A figure at work (dot.role) wears its trade's clothes (ROLES) and the season fills the rest.
// Classic script.
(function(){
  // slot: body (over the tunic), head (over hair), neck (scarf/collar).
  // dye: cloth takes the wearer's class palette (dye<1 darkens it, waxed cloth);
  // natural materials keep their own palette. trim: fur or lining edge.
  const PIECES={
    strawHat:{label:'Cappello di paglia',slot:'head',when:'Estate, sereno o vento',palette:['#d9bf6e','#cfb25c','#e0c77f']},
    furCap:{label:'Berretto di pelliccia',slot:'head',when:'Inverno',palette:['#6b4f36','#4f3b2a','#7d6248'],trim:'#a8885f'},
    woolHood:{label:'Cappuccio di lana',slot:'head',when:'Inverno, neve e nebbia',dye:1,palette:['#7d2f24','#4f5f3a','#6b5a44','#3f4a5c']},
    rainHood:{label:'Cappuccio cerato',slot:'head',when:'Pioggia e temporale',dye:.72,palette:['#5f5b48','#6a6450','#4f5550']},
    sheepskin:{label:'Pelle di pecora',slot:'body',when:'Inverno (L1)',palette:['#cdbb98','#bfae8c','#d6c7a6'],trim:'#efe6d2'},
    woolCloak:{label:'Mantello di lana',slot:'body',when:'Inverno (L2)',dye:.85,palette:['#5b4a3a','#4a5544','#5a4b55','#4d4f5c'],trim:'#8a7559'},
    furCloak:{label:'Mantello foderato di pelliccia',slot:'body',when:'Inverno (L3 e L4)',dye:1,palette:['#5a2f45','#2f4560','#3f5a3a'],trim:'#e8dfcc'},
    rainCape:{label:'Mantella antipioggia',slot:'body',when:'Pioggia e temporale',dye:.72,palette:['#5f5b48','#6a6450','#4f5550']},
    shawl:{label:'Scialle di lana',slot:'neck',when:'Mezze stagioni con vento o nebbia',dye:1,palette:['#8b3a2e','#6d6a3a','#7a6a8c','#a07040']}
  };
  // Costumes of office (crime: docs/crime.md), worn by role, never by season or weather:
  // a separate catalogue, so outfitFor() never deals them out and the seasonal list stays as it is.
  const ROLE_PIECES={
    judgeRobe:{label:'Toga del giudice',slot:'body',role:'Giudice',palette:['#8e2a26'],trim:'#efe9dc',robe:true},
    judgeCap:{label:'Berretto del giudice',slot:'head',role:'Giudice',palette:['#8e2a26']},
    clerkGown:{label:'Veste del cancelliere',slot:'body',role:'Cancelliere',palette:['#2f2b2c'],trim:'#d8cfb8',robe:true},
    clerkCap:{label:'Berretto del cancelliere',slot:'head',role:'Cancelliere',palette:['#2f2b2c']},
    prisonerShirt:{label:'Camicia del prigioniero',slot:'body',role:'Prigioniero',palette:['#b9ad8f'],ragged:true},
    executionerHood:{label:'Cappuccio del boia',slot:'head',role:'Boia',palette:['#1f1b1c']},
    // Work clothes by trade (docs: STATUS 2026-11-13, outfit di mestiere).
    leatherApron:{label:'Grembiule di cuoio',slot:'body',role:'Fabbro, falegname, conciatore, carpentiere navale',palette:['#6b4a30','#5e4129'],apron:true,strap:'#3e2c1d'},
    clothApron:{label:'Grembiule di tela',slot:'body',role:'Orafo, tessitore, cavatore',palette:['#d8cfb8','#cfc4a8'],apron:true,strap:'#9c9078'},
    clayApron:{label:'Grembiule del vasaio',slot:'body',role:'Vasaio',palette:['#b98b68'],apron:true,strap:'#7f4a2c',stain:'#8c5233'},
    jerkin:{label:'Farsetto di cuoio',slot:'body',role:'Muratore, taglialegna, minatore, carrettiere, carceriere',palette:['#6b4f36','#5e4632','#73563a'],vest:true},
    shepherdCape:{label:'Mantelletta del pastore',slot:'body',role:'Pastore',palette:['#7a6448','#6e5a40'],cape:true},
    leatherCap:{label:'Calotta di cuoio',slot:'head',role:'Fabbro, cavatore, minatore, carceriere',palette:['#5a4030','#4f3826']},
    linenCoif:{label:'Cuffia di lino',slot:'head',role:'Falegname, tessitore, muratore',palette:['#e6dcc6','#ddd2b9']},
    feltHat:{label:'Cappello di feltro',slot:'head',role:'Pastore, carrettiere',palette:['#4f4436','#5b4a35','#463c30']},
    flatCap:{label:'Tocco',slot:'head',role:'Orafo, sarto',palette:['#2f2b2c','#5a2f45','#2f4560']},
    stockingCap:{label:'Berretto da marinaio',slot:'head',role:'Marinaio, pescatore, carpentiere navale',palette:['#9b3a2e','#a8503f','#3e5b7a']},
    keys:{label:'Mazzo di chiavi',slot:'neck',role:'Carceriere, tesoriere',palette:['#5c6266']},
    // Clergy, officials and household staff (figures of the castle rooms, church, tavern, Bargello, Balivo).
    cassock:{label:'Tonaca',slot:'body',role:'Prete, cappellano',palette:['#1f1d22'],trim:'#efe9dc',robe:true},
    stole:{label:'Stola',slot:'neck',role:'Prete, cappellano',palette:['#e8dcc0'],band:'#c6a457'},
    notableGown:{label:'Veste da notabile',slot:'body',role:'Tesoriere, consigliere',palette:['#2f4a3a','#4a2f3f','#2f3a52'],trim:'#c6a457',robe:true},
    surgeonGown:{label:'Camice del cerusico',slot:'body',role:'Cerusico',palette:['#6b2f2f'],trim:'#e8e0c8',robe:true},
    bailiffRobe:{label:'Toga del Balivo',slot:'body',role:'Giudice del Balivo',palette:['#2f4560'],trim:'#efe9dc',robe:true},
    tabard:{label:'Tabarro del Comune',slot:'body',role:'Esattore',palette:['#b8902f'],tabard:true,emblem:'#8e2a26'},
    chainOfOffice:{label:"Catena d'ufficio",slot:'neck',role:'Consigliere',palette:['#d8b14a']},
    cookCap:{label:'Berretto da cuoco',slot:'head',role:'Cuoco',palette:['#f1ece0']},
    // The levy (alarm recruits, extraordinary levy): own class clothes, a hood in the realm's colours.
    levyHood:{label:'Cappuccio della leva',slot:'head',role:'Leva',palette:['#b53636'],heraldic:true}
  };
  // Trade -> work clothes (role pieces; the free slots still take the season's pieces).
  // `role` on a figure dot names one of these: the shop trades are the keys of TRADES
  // in settlement-shop-cutaway.js, the others are set where the worker is drawn.
  const ROLES={
    blacksmith:{label:'Fabbro',pieces:['leatherApron','leatherCap']},
    carpenter:{label:'Falegname',pieces:['leatherApron','linenCoif']},
    leatherworker:{label:'Conciatore',pieces:['leatherApron']},
    goldsmith:{label:'Orafo',pieces:['clothApron','flatCap']},
    potter:{label:'Vasaio',pieces:['clayApron']},
    weaver:{label:'Tessitore',pieces:['clothApron','linenCoif']},
    tailor:{label:'Sarto',pieces:['flatCap']},
    builder:{label:'Muratore',pieces:['jerkin','linenCoif']},
    woodcutter:{label:'Taglialegna',pieces:['jerkin','woolHood']},
    quarryman:{label:'Cavatore',pieces:['clothApron','leatherCap']},
    miner:{label:'Minatore',pieces:['jerkin','leatherCap']},
    shipwright:{label:'Carpentiere navale',pieces:['leatherApron','stockingCap']},
    shepherd:{label:'Pastore',pieces:['shepherdCape','feltHat']},
    carter:{label:'Carrettiere',pieces:['jerkin','feltHat']},
    jailer:{label:'Carceriere',pieces:['jerkin','leatherCap','keys']},
    sailor:{label:'Marinaio e pescatore',pieces:['stockingCap']},
    priest:{label:'Prete e cappellano',pieces:['cassock','stole']},
    cook:{label:'Cuoco',pieces:['clothApron','cookCap']},
    groom:{label:'Stalliere',pieces:['jerkin','stockingCap']},
    treasurer:{label:'Tesoriere',pieces:['notableGown','flatCap','keys']},
    councillor:{label:'Consigliere',pieces:['notableGown','chainOfOffice','clerkCap']},
    surgeon:{label:'Cerusico',pieces:['surgeonGown','flatCap']},
    orderly:{label:"Inserviente dell'infermeria",pieces:['clothApron']},
    falconer:{label:'Falconiere',pieces:['shepherdCape','leatherCap']},
    dovekeeper:{label:'Colombaro',pieces:['clothApron','feltHat']},
    innkeeper:{label:'Oste',pieces:['leatherApron','feltHat']},
    exactor:{label:'Esattore',pieces:['tabard','flatCap']},
    bailiff:{label:'Giudice del Balivo',pieces:['bailiffRobe','clerkCap']},
    herald:{label:'Araldo della Sala del trono',pieces:['tabard','feltHat']},
    servant:{label:'Servo della Sala comune',pieces:['clothApron','stockingCap']},
    soldier:{label:'Soldato a riposo (Sala comune)',pieces:['jerkin','leatherCap','shawl']},
    jester:{label:'Giullare della Sala comune',pieces:['woolHood']},
    minstrel:{label:'Musico della Sala comune',pieces:['feltHat']}
  };
  // L4 ladies (women and girls of the elite, FIG-HANDS-261117): medieval headdresses over
  // braided hair instead of the town's hats and hoods; furs instead of cloaks in winter.
  // A separate catalogue: outfitFor() deals them to ladies only (ladyOutfit).
  const LADY_PIECES={
    hennin:{label:'Hennin con velo',slot:'head',lady:'fair',palette:['#d83a2e','#2f6fd6','#f2c12e','#7a2f5a'],dye:1,veil:'rgba(246,241,230,.86)',band:'#c9a24a'},
    horned:{label:'Acconciatura a corna',slot:'head',lady:'fair',palette:['#d83a2e','#2f6fd6','#f2c12e','#7a2f5a'],dye:.9,band:'#c9a24a'},
    crespine:{label:'Crespina e coroncina',slot:'head',lady:'fair',palette:['#c9a24a','#b8913c']},
    balzo:{label:'Balzo',slot:'head',lady:'fair',palette:['#d83a2e','#2f6fd6','#f2c12e','#7a2f5a'],dye:1,band:'#d8b14a'},
    coronet:{label:'Coroncina',slot:'head',lady:'fair',palette:['#d8b14a'],jewel:'#b0302a'},
    veil:{label:'Velo e soggolo',slot:'head',lady:'rain',palette:['#f3eee2','#ebe3d0']},
    furToque:{label:'Cappello di pelliccia',slot:'head',lady:'winter',palette:['#5b4330','#4a3628','#6e5640']},
    ladyMantle:{label:'Mantello di velluto',slot:'body',lady:'rain',palette:['#d83a2e','#2f6fd6','#f2c12e','#7a2f5a'],dye:.8,clasp:'#d8b14a'},
    ladyFur:{label:'Pelliccia',slot:'body',lady:'winter',palette:['#f2eee6','#9aa3ad','#5b4330'],spots:'#1d1a19'}
  };
  // Headdresses for fair weather; girls wear only the coronet or the bare braids.
  const LADY_FAIR=['hennin','horned','crespine','balzo','coronet','veil'];
  const LADY_HAIR=['coils','braid','loose'];
  const pieceOf=id=>PIECES[id]||ROLE_PIECES[id]||LADY_PIECES[id];
  // Calendar month (0 = January) -> share of residents dressed for the cold / the sun.
  // Shoulder months dress only part of the town, so a season never flips everyone at once.
  const WINTER_BY_MONTH=[1,1,.45,0,0,0,0,0,0,0,.45,1];
  const SUMMER_BY_MONTH=[0,0,0,0,.4,1,1,1,.4,0,0,0];
  // Civil classes by house level: peasant L1, artisan L2, merchant L3, elite L4.
  const HAT_SHARE={peasant:.75,artisan:.45,merchant:.3,elite:.2};
  const CLOAK_BY_CLASS={peasant:'sheepskin',artisan:'woolCloak',merchant:'furCloak',elite:'furCloak'};
  const hash=window.ConquerUtil.hash;
  const roll=(id,salt)=>(hash(String(id)+':'+salt)%10000)/10000;
  const darken=(hex,k)=>k>=1?hex:'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('');
  // The class palettes live in settlement-core.js (tunics); absent in a bare lab.
  function classPalette(kind){
    if(typeof PEASANT_PALETTE==='undefined')return null;
    return{artisan:ARTISAN_PALETTE,merchant:MERCHANT_PALETTE,elite:ELITE_PALETTE}[kind]||PEASANT_PALETTE;
  }
  // Dyed cloth avoids the tunic's own colour, so the open front still reads.
  function pick(piece,id,kind,tunic){
    const P=pieceOf(piece),dyed=P.dye&&classPalette(kind),p=dyed||P.palette,h=hash(String(id)+':'+piece);
    let c=p[h%p.length];
    if(dyed&&c===tunic&&p.length>1)c=p[(h+1)%p.length];
    return dyed?darken(c,P.dye):c;
  }

  // Weather kinds as defined by settlement-weather.js (sun/clear/wind/rain/storm/snow/fog).
  function fromKind(season,kind,month=null){
    return{season,month,kind,wet:kind==='rain'||kind==='storm',snow:kind==='snow',
      windy:kind==='wind'||kind==='storm',fog:kind==='fog'};
  }
  let cacheKey='',cacheValue=null;
  function conditions(){
    const P=api.preview;
    if(P)return fromKind(P.season||'summer',P.weather||'clear',Number.isInteger(P.month)?P.month:null);
    const S=typeof State!=='undefined'?State:{};
    const day=Math.floor(Number(S.clock?.day)||0);
    const w=typeof currentWeather==='function'?currentWeather():null;
    const key=day+'|'+S.season+'|'+(S.seasonOverride||'')+'|'+(w?.kind||'');
    if(key===cacheKey&&cacheValue)return cacheValue;
    // A forced DEV season dresses everyone for it; the calendar staggers the change.
    const month=!S.seasonOverride&&typeof calendarDateFromDay==='function'?calendarDateFromDay(day).month:null;
    cacheKey=key;cacheValue=fromKind(S.season||'summer',w?.kind||'clear',month);
    return cacheValue;
  }
  function levels(c){
    const winter=c.snow?1:c.month!=null?WINTER_BY_MONTH[c.month]:c.season==='winter'?1:0;
    const summer=c.month!=null?SUMMER_BY_MONTH[c.month]:c.season==='summer'?1:0;
    return{winter,summer};
  }
  // Outfit = {head,body,neck} piece ids (or null) with their colours.
  function compose(pieces,id='catalogue',kind='peasant',tunic=null){
    const o={head:null,body:null,neck:null,colors:{},sleeve:null};
    for(const piece of pieces){
      const P=pieceOf(piece);if(!P)continue;
      o[P.slot]=piece;o.colors[P.slot]=pick(piece,id,kind,tunic);
    }
    o.sleeve=o.body?o.colors.body:null;
    return o.head||o.body||o.neck?o:null;
  }
  const isLady=dot=>dot.kind==='elite'&&dot.sex==='female';
  // A lady's outfit: velvet mantle and veil in the rain, furs in the cold, a headdress otherwise.
  function ladyOutfit(dot,c){
    const id=dot.id,L=levels(c),child=dot.age==='child',pieces=[];
    if(c.wet)pieces.push('ladyMantle',child?'coronet':'veil');
    else if(roll(id,'winter')<L.winter)pieces.push('ladyFur',child||roll(id,'toque')<.65?'furToque':'veil');
    else if(child){if(roll(id,'coronet')<.5)pieces.push('coronet')}
    else pieces.push(LADY_FAIR[hash(String(id)+':headdress')%LADY_FAIR.length]);
    return compose(pieces,id,dot.kind,dot.colors?.[0]);
  }
  function outfitFor(dot,c=conditions()){
    if(dot.outfit!==undefined)return dot.outfit;
    if(isLady(dot)&&!dot.role)return ladyOutfit(dot,c);
    const id=dot.id,L=levels(c),pieces=[];
    if(c.wet)pieces.push('rainCape','rainHood');
    else if(roll(id,'winter')<L.winter){
      pieces.push(CLOAK_BY_CLASS[dot.kind]||'furCloak');
      pieces.push(c.snow||c.fog||roll(id,'cap')<.5?'woolHood':'furCap');
    }else{
      if(c.kind!=='fog'&&roll(id,'hat')<L.summer*(HAT_SHARE[dot.kind]??.3))pieces.push('strawHat');
      if((c.windy||c.fog)&&c.season!=='summer'&&roll(id,'shawl')<.45)pieces.push('shawl');
    }
    // At work the trade's clothes come first; the season only fills the slots they leave free.
    const R=dot.role&&ROLES[dot.role];
    if(R){
      const taken=new Set(R.pieces.map(p=>pieceOf(p)?.slot));
      return compose([...R.pieces,...pieces.filter(p=>!taken.has(pieceOf(p)?.slot))],id,dot.kind,dot.colors?.[0]);
    }
    return compose(pieces,id,dot.kind,dot.colors?.[0]);
  }

  const outline=(lw)=>{ctx.strokeStyle='rgba(33,24,16,.82)';ctx.lineWidth=lw;ctx.stroke()};
  // Over the tunic: x/bodyY are the figure's body centre, w/h its size (px).
  // t (footTurn, CIVIL-VIEWS): the garment turns with the body as a volume; from behind the pieces
  // worn on the front (apron, stole, chain, emblem, open front) are hidden.
  function drawBody(o,dot,x,bodyY,w,h,t=null){
    if(!o)return;
    if(t&&typeof withFootVolume==='function')return withFootVolume(ctx,t,x,0,()=>drawBodyArt(o,dot,x,bodyY,w,h,t.c<-.15));
    drawBodyArt(o,dot,x,bodyY,w,h,false);
  }
  function drawBodyArt(o,dot,x,bodyY,w,h,back){
    const top=bodyY-h/2,lw=Math.max(.6,w*.1),fine=w>=2.6;
    ctx.save();
    const R=o.body&&ROLE_PIECES[o.body];
    if(R?.robe){
      // Robe of office: closed, down to the feet, a pale collar (the judge's ermine is spotted).
      const hem=bodyY+h*.52;
      ctx.beginPath();
      ctx.moveTo(x-w*.22,top-h*.02);ctx.lineTo(x-w*.52,top+h*.2);ctx.lineTo(x-w*.62,hem);
      ctx.quadraticCurveTo(x,hem+h*.06,x+w*.62,hem);ctx.lineTo(x+w*.52,top+h*.2);ctx.lineTo(x+w*.22,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(fine){
        ctx.fillStyle=R.trim;ctx.beginPath();ctx.ellipse(x,top+h*.05,w*.38,h*.1,0,0,Math.PI*2);ctx.fill();outline(lw*.6);
        if(o.body==='judgeRobe'){ctx.fillStyle='#1d1a19';for(const k of [-.2,0,.2])ctx.fillRect(x+w*k-w*.025,top+h*.04,w*.05,h*.03)}
      }
    }else if(R?.ragged){
      // Rough undyed shirt over the tunic, torn at the hem.
      const hem=bodyY+h*.22,n=5;
      ctx.beginPath();ctx.moveTo(x-w*.26,top);ctx.lineTo(x-w*.5,top+h*.2);ctx.lineTo(x-w*.54,hem);
      for(let k=1;k<=n;k++)ctx.lineTo(x-w*.54+w*1.08*k/n,hem+(k%2?h*.07:0));
      ctx.lineTo(x+w*.5,top+h*.2);ctx.lineTo(x+w*.26,top);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
    }else if(R?.apron&&back){
      // Seen from behind: only the waist tie.
      if(fine){ctx.strokeStyle=R.strap;ctx.lineWidth=Math.max(.5,w*.06);ctx.beginPath();ctx.moveTo(x-w*.42,bodyY+h*.02);ctx.lineTo(x+w*.42,bodyY+h*.02);ctx.stroke()}
    }else if(R?.apron){
      // Work apron: a bib from the chest to the knees, neck strap and waist tie; the tunic shows at the sides.
      const bib=top+h*.2,waist=bodyY+h*.02,hem=bodyY+h*.46;
      ctx.beginPath();
      ctx.moveTo(x-w*.2,bib);ctx.lineTo(x+w*.2,bib);ctx.lineTo(x+w*.24,waist);ctx.lineTo(x+w*.34,hem);
      ctx.quadraticCurveTo(x,hem+h*.04,x-w*.34,hem);ctx.lineTo(x-w*.24,waist);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(fine){
        ctx.strokeStyle=R.strap;ctx.lineWidth=Math.max(.5,w*.06);
        ctx.beginPath();ctx.moveTo(x-w*.17,bib);ctx.lineTo(x-w*.1,top+h*.02);ctx.moveTo(x+w*.17,bib);ctx.lineTo(x+w*.1,top+h*.02);
        ctx.moveTo(x-w*.42,waist);ctx.lineTo(x+w*.42,waist);ctx.stroke();
        if(R.stain){ctx.fillStyle=R.stain;for(const [dx,dy,r] of [[-.1,.16,.07],[.12,.3,.06],[-.04,.36,.05]]){ctx.beginPath();ctx.ellipse(x+w*dx,bodyY+h*dy,w*r,h*r*.8,0,0,Math.PI*2);ctx.fill()}}
      }
    }else if(R?.vest){
      // Leather jerkin: closed, sleeveless, to the hips, laced down the front.
      const hem=bodyY+h*.2;
      ctx.beginPath();
      ctx.moveTo(x-w*.24,top-h*.01);ctx.lineTo(x-w*.48,top+h*.12);ctx.lineTo(x-w*.5,hem);
      ctx.quadraticCurveTo(x,hem+h*.06,x+w*.5,hem);ctx.lineTo(x+w*.48,top+h*.12);ctx.lineTo(x+w*.24,top-h*.01);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(fine){
        ctx.strokeStyle='rgba(33,24,16,.7)';ctx.lineWidth=Math.max(.4,w*.04);ctx.beginPath();
        ctx.moveTo(x,top+h*.06);ctx.lineTo(x,hem+h*.03);
        for(let k=0;k<3;k++){const y=top+h*(.14+k*.1);ctx.moveTo(x-w*.06,y);ctx.lineTo(x+w*.06,y+h*.04)}
        ctx.stroke();
        ctx.fillStyle='#3e2c1d';ctx.fillRect(x-w*.5,bodyY+h*.02,w,Math.max(.6,h*.05));   // belt
      }
    }else if(R?.tabard){
      // Tabard of the commune: an open-sided panel front and back to the knees, the town's emblem on the chest.
      const hem=bodyY+h*.44;
      ctx.beginPath();ctx.moveTo(x-w*.3,top-h*.01);ctx.lineTo(x+w*.3,top-h*.01);ctx.lineTo(x+w*.34,hem);ctx.lineTo(x-w*.34,hem);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(fine&&!back){
        ctx.fillStyle=R.emblem;ctx.beginPath();ctx.moveTo(x-w*.12,top+h*.14);ctx.lineTo(x+w*.12,top+h*.14);ctx.lineTo(x+w*.12,top+h*.3);
        ctx.quadraticCurveTo(x,top+h*.42,x-w*.12,top+h*.3);ctx.closePath();ctx.fill();
        ctx.fillStyle='#3e2c1d';ctx.fillRect(x-w*.5,bodyY+h*.02,w,Math.max(.6,h*.05));
      }
    }else if(o.body==='ladyFur'){
      // Fur mantle over the shoulders down past the waist, scalloped edge, a deeper fur collar;
      // ermine shows its black tails.
      const hem=bodyY+h*.14,n=6,c=o.colors.body;
      ctx.beginPath();ctx.moveTo(x-w*.22,top-h*.02);ctx.lineTo(x-w*.56,top+h*.2);ctx.lineTo(x-w*.62,hem);
      for(let k=1;k<=n;k++){const x0=x-w*.62+w*1.24*(k-1)/n,x1=x-w*.62+w*1.24*k/n;ctx.quadraticCurveTo((x0+x1)/2,hem+h*.07,x1,hem)}
      ctx.lineTo(x+w*.56,top+h*.2);ctx.lineTo(x+w*.22,top-h*.02);ctx.closePath();
      ctx.fillStyle=c;ctx.fill();outline(lw);
      ctx.fillStyle=darken(c,.86);ctx.beginPath();ctx.ellipse(x,top+h*.05,w*.4,h*.1,0,0,Math.PI*2);ctx.fill();outline(lw*.6);
      if(fine&&c===LADY_PIECES.ladyFur.palette[0]){
        ctx.fillStyle=LADY_PIECES.ladyFur.spots;
        for(const [dx,dy] of [[-.36,.16],[-.12,.3],[.14,.18],[.38,.32],[-.4,.4],[.02,.44]])ctx.fillRect(x+w*dx-w*.025,top+h*dy,w*.05,h*.07);
      }
    }else if(o.body==='ladyMantle'){
      // Velvet mantle closed at the neck by a gold clasp, falling to mid-skirt.
      const hem=bodyY+h*.3;
      ctx.beginPath();ctx.moveTo(x-w*.2,top-h*.02);ctx.lineTo(x-w*.54,top+h*.2);ctx.lineTo(x-w*.66,hem);
      ctx.quadraticCurveTo(x,hem+h*.1,x+w*.66,hem);ctx.lineTo(x+w*.54,top+h*.2);ctx.lineTo(x+w*.2,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(fine){ctx.fillStyle=LADY_PIECES.ladyMantle.clasp;ctx.beginPath();ctx.arc(x,top+h*.08,Math.max(.6,w*.07),0,Math.PI*2);ctx.fill()}
    }else if(o.body){
      const cape=o.body==='rainCape'||!!pieceOf(o.body)?.cape,hem=bodyY+h*(cape?.14:.30);
      ctx.beginPath();
      ctx.moveTo(x-w*.20,top-h*.02);ctx.lineTo(x-w*.50,top+h*.18);ctx.lineTo(x-w*.60,hem);
      ctx.quadraticCurveTo(x,hem+h*.10,x+w*.60,hem);ctx.lineTo(x+w*.50,top+h*.18);ctx.lineTo(x+w*.20,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(!cape&&fine&&!back){
        // Open front: the class tunic colour stays readable down the middle.
        ctx.beginPath();ctx.moveTo(x-w*.05,top+h*.12);ctx.lineTo(x-w*.14,hem+h*.06);ctx.lineTo(x+w*.14,hem+h*.06);ctx.lineTo(x+w*.05,top+h*.12);ctx.closePath();
        ctx.fillStyle=dot.colors?.[0]||'#8c6b3f';ctx.fill();
      }
      const trim=pieceOf(o.body)?.trim;
      if(trim&&fine){
        ctx.fillStyle=trim;ctx.beginPath();ctx.ellipse(x,top+h*.03,w*.34,h*.08,0,0,Math.PI*2);ctx.fill();
        if(o.body==='sheepskin'){ctx.strokeStyle=trim;ctx.lineWidth=Math.max(.6,h*.06);ctx.beginPath();ctx.moveTo(x-w*.58,hem);ctx.quadraticCurveTo(x,hem+h*.10,x+w*.58,hem);ctx.stroke()}
      }else if(cape&&fine){
        // Waxed cloth sheen.
        ctx.strokeStyle='rgba(220,230,235,.28)';ctx.lineWidth=Math.max(.5,w*.07);
        ctx.beginPath();ctx.moveTo(x-w*.30,top+h*.20);ctx.lineTo(x-w*.38,hem-h*.04);ctx.stroke();
      }
    }
    if(back&&(o.neck==='stole'||o.neck==='chainOfOffice')){/* worn on the front */}
    else if(o.neck==='shawl'){
      ctx.fillStyle=o.colors.neck;
      ctx.beginPath();ctx.rect(x+w*.12,top+h*.08,w*.16,h*.36);ctx.fill();outline(lw*.7);
      ctx.beginPath();ctx.ellipse(x,top+h*.10,w*.46,h*.12,0,0,Math.PI*2);ctx.fill();outline(lw*.7);
    }else if(o.neck==='stole'){
      // Stole: two pale bands from the neck down the front, gold crosses at the ends.
      ctx.fillStyle=o.colors.neck;
      for(const k of [-1,1]){ctx.beginPath();ctx.rect(x+k*w*.13-w*.06,top+h*.02,w*.12,h*.62);ctx.fill();outline(lw*.5)}
      if(fine){ctx.fillStyle=pieceOf('stole').band;for(const k of [-1,1])ctx.fillRect(x+k*w*.13-w*.04,top+h*.54,w*.08,h*.05)}
    }else if(o.neck==='chainOfOffice'){
      // Gold chain across the shoulders with a pendant on the chest.
      ctx.strokeStyle=o.colors.neck;ctx.lineWidth=Math.max(.6,w*.07);
      ctx.beginPath();ctx.moveTo(x-w*.32,top+h*.04);ctx.quadraticCurveTo(x,top+h*.4,x+w*.32,top+h*.04);ctx.stroke();
      ctx.fillStyle=o.colors.neck;ctx.beginPath();ctx.arc(x,top+h*.25,Math.max(.6,w*.08),0,Math.PI*2);ctx.fill();
    }else if(o.neck==='keys'&&fine){
      // Ring of keys hanging from the belt on the right hip.
      const kx=x+w*.36,ky=bodyY+h*.1,r=Math.max(.5,w*.09);
      ctx.strokeStyle=o.colors.neck;ctx.lineWidth=Math.max(.5,w*.05);
      ctx.beginPath();ctx.arc(kx,ky,r,0,Math.PI*2);ctx.moveTo(kx-r*.4,ky+r);ctx.lineTo(kx-r*.6,ky+r*3.2);ctx.moveTo(kx+r*.5,ky+r);ctx.lineTo(kx+r*.9,ky+r*2.8);ctx.stroke();
    }
    ctx.restore();
  }
  // A lady's hair, painted over the bare head and under the headdress: a parted cap of hair
  // with coiled braids over the ears, one long braid over the shoulder, or loose long hair.
  // The veil hides it all. Style and colour are stable per resident.
  function ladyHairStyle(dot){return dot.age==='child'?(hash(String(dot.id)+':hair')&1?'braid':'loose'):LADY_HAIR[hash(String(dot.id)+':hair')%LADY_HAIR.length]}
  function drawLadyHair(o,dot,x,headY,r){
    if(o?.head==='veil')return;
    const colors=typeof HAIR_COLORS!=='undefined'?HAIR_COLORS:{},hair=dot.hair||(typeof villagerHair==='function'?villagerHair(dot.id):'brown');
    const hc=colors[hair]||'#65452f',lw=Math.max(.5,r*.16),style=ladyHairStyle(dot);
    ctx.save();ctx.fillStyle=hc;
    if(style==='loose'){   // long hair behind the shoulders
      for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(x+s*r*.82,headY+r*.85,r*.36,r*1.2,s*.12,0,Math.PI*2);ctx.fill();outline(lw*.7)}
    }
    ctx.beginPath();ctx.arc(x,headY,r,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.7);
    if(r>=1.2){ctx.strokeStyle='rgba(33,24,16,.45)';ctx.lineWidth=Math.max(.4,r*.1);ctx.beginPath();ctx.moveTo(x,headY-r);ctx.lineTo(x,headY-r*.45);ctx.stroke()}
    ctx.fillStyle=hc;
    if(style==='coils'){   // ramshorn braids coiled over the ears
      for(const s of[-1,1]){
        ctx.beginPath();ctx.arc(x+s*r*.92,headY+r*.12,r*.42,0,Math.PI*2);ctx.fill();outline(lw*.7);
        if(r>=1.2){ctx.strokeStyle='rgba(33,24,16,.5)';ctx.lineWidth=Math.max(.35,r*.08);ctx.beginPath();ctx.arc(x+s*r*.92,headY+r*.12,r*.2,0,Math.PI*1.6);ctx.stroke()}
      }
    }else if(style==='braid'){   // one long braid forward over the shoulder
      for(let k=0;k<4;k++){ctx.beginPath();ctx.ellipse(x+r*(.86+k*.06),headY+r*(.35+k*.5),r*.26,r*.32,.2,0,Math.PI*2);ctx.fill();outline(lw*.55)}
    }
    ctx.restore();
  }
  // Medieval headdresses of the L4 ladies (reference sheet of the product owner, 17/11/2026).
  function drawLadyHeaddress(o,x,headY,r,c,lw,back=false){
    const P=LADY_PIECES[o.head],fine=r>=1.2;
    if(o.head==='hennin'){
      // Tall cone tilted back, a sheer veil streaming from the tip, gold band on the brow.
      const tip={x:x+r*.65,y:headY-r*3.1};
      ctx.fillStyle=P.veil;ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.quadraticCurveTo(x+r*2.3,headY-r*.8,x+r*2.0,headY+r*1.5);
      ctx.lineTo(x+r*1.05,headY+r*.35);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(33,24,16,.35)';ctx.lineWidth=lw*.5;ctx.stroke();
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*.95,headY-r*.3);ctx.lineTo(tip.x,tip.y);ctx.lineTo(x+r*.98,headY-r*.55);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.strokeStyle=P.band;ctx.lineWidth=Math.max(.6,r*.24);ctx.beginPath();ctx.moveTo(x-r*.98,headY-r*.33);ctx.lineTo(x+r*1.0,headY-r*.55);ctx.stroke();
    }else if(o.head==='horned'){
      // Escoffion: two padded horns over the temples, a gold net over the dyed cloth.
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*.95,headY-r*.15);
      ctx.quadraticCurveTo(x-r*1.95,headY-r*.7,x-r*1.6,headY-r*2.0);ctx.quadraticCurveTo(x-r*.85,headY-r*1.1,x,headY-r*1.05);
      ctx.quadraticCurveTo(x+r*.85,headY-r*1.1,x+r*1.6,headY-r*2.0);ctx.quadraticCurveTo(x+r*1.95,headY-r*.7,x+r*.95,headY-r*.15);
      ctx.quadraticCurveTo(x,headY-r*.95,x-r*.95,headY-r*.15);ctx.closePath();ctx.fill();outline(lw*.8);
      if(fine){ctx.fillStyle=P.band;for(const [dx,dy] of [[-1.35,-1.3],[-.75,-.8],[-1.5,-.6],[1.35,-1.3],[.75,-.8],[1.5,-.6]]){ctx.beginPath();ctx.arc(x+r*dx,headY+r*dy,r*.09,0,Math.PI*2);ctx.fill()}}
      ctx.strokeStyle=P.band;ctx.lineWidth=Math.max(.5,r*.18);ctx.beginPath();ctx.moveTo(x-r*.95,headY-r*.2);ctx.quadraticCurveTo(x,headY-r*.95,x+r*.95,headY-r*.2);ctx.stroke();
    }else if(o.head==='crespine'){
      // Gold net cauls over the ears, joined by a thin fillet across the crown.
      ctx.strokeStyle=c;ctx.lineWidth=Math.max(.5,r*.2);ctx.beginPath();ctx.arc(x,headY+r*.05,r*1.02,Math.PI*1.08,Math.PI*1.92);ctx.stroke();
      for(const s of[-1,1]){
        ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+s*r*.92,headY+r*.1,r*.5,0,Math.PI*2);ctx.fill();outline(lw*.7);
        if(fine){ctx.strokeStyle='rgba(60,40,10,.55)';ctx.lineWidth=Math.max(.3,r*.07);ctx.beginPath();
          for(const k of[-.25,0,.25]){ctx.moveTo(x+s*r*.92+r*k,headY-r*.38);ctx.lineTo(x+s*r*.92+r*k,headY+r*.58);ctx.moveTo(x+s*r*.92-r*.48,headY+r*.1+r*k);ctx.lineTo(x+s*r*.92+r*.48,headY+r*.1+r*k)}ctx.stroke()}
      }
    }else if(o.head==='balzo'){
      // Balzo: a large padded roll over the hair, crossed by gold bands.
      ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,headY-r*.8,r*1.45,r*.82,0,0,Math.PI*2);ctx.fill();outline(lw*.8);
      if(fine){ctx.strokeStyle=P.band;ctx.lineWidth=Math.max(.4,r*.12);ctx.beginPath();
        for(const k of[-.7,0,.7]){ctx.moveTo(x+r*k-r*.35,headY-r*1.55);ctx.lineTo(x+r*k+r*.35,headY-r*.05)}ctx.stroke()}
    }else if(o.head==='coronet'){
      // Gold circlet with three points and a red stone over the brow.
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*.95,headY-r*.45);
      for(const k of[-.6,0,.6]){ctx.lineTo(x+r*(k-.22),headY-r*.75);ctx.lineTo(x+r*k,headY-r*1.15);ctx.lineTo(x+r*(k+.22),headY-r*.75)}
      ctx.lineTo(x+r*.95,headY-r*.45);ctx.quadraticCurveTo(x,headY-r*.72,x-r*.95,headY-r*.45);ctx.closePath();ctx.fill();outline(lw*.6);
      if(fine){ctx.fillStyle=P.jewel;ctx.beginPath();ctx.arc(x,headY-r*.66,r*.13,0,Math.PI*2);ctx.fill()}
    }else if(o.head==='veil'){
      // Veil and wimple: white linen round the face and under the chin, falling on the shoulders.
      ctx.fillStyle=c;ctx.beginPath();
      ctx.moveTo(x-r*1.35,headY+r*1.6);ctx.quadraticCurveTo(x-r*1.55,headY-r*1.25,x,headY-r*1.35);
      ctx.quadraticCurveTo(x+r*1.55,headY-r*1.25,x+r*1.35,headY+r*1.6);ctx.quadraticCurveTo(x,headY+r*2.0,x-r*1.35,headY+r*1.6);ctx.closePath();
      if(!back){ctx.moveTo(x+r*.7,headY+r*.05);ctx.ellipse(x,headY+r*.05,r*.7,r*.8,0,0,Math.PI*2)}
      ctx.fill('evenodd');outline(lw*.7);
    }else if(o.head==='furToque'){
      // Tall round fur hat, its pile brushed in short strokes.
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*1.02,headY-r*.4);ctx.lineTo(x-r*.95,headY-r*1.45);
      ctx.quadraticCurveTo(x,headY-r*1.75,x+r*.95,headY-r*1.45);ctx.lineTo(x+r*1.02,headY-r*.4);ctx.quadraticCurveTo(x,headY-r*.6,x-r*1.02,headY-r*.4);ctx.closePath();ctx.fill();outline(lw*.8);
      if(fine){ctx.strokeStyle=darken(c,.7);ctx.lineWidth=Math.max(.35,r*.08);ctx.beginPath();
        for(const k of[-.6,-.2,.2,.6])for(const j of[.65,1.05]){ctx.moveTo(x+r*k,headY-r*j);ctx.lineTo(x+r*(k+.1),headY-r*(j+.22))}ctx.stroke()}
    }
  }
  // Over the head: x/headY its centre, r its radius; the hood also drapes the shoulders.
  // t (CIVIL-VIEWS): the headgear turns with the head; from behind hoods and veils are closed.
  function drawHead(o,x,headY,r,t=null){
    if(!o||!o.head)return;
    if(t&&typeof withFootVolume==='function')return withFootVolume(ctx,t,x,0,()=>drawHeadArt(o,x,headY,r,t.c<-.15),.85);
    drawHeadArt(o,x,headY,r,false);
  }
  function drawHeadArt(o,x,headY,r,back){
    const lw=Math.max(.6,r*.2),c=o.colors.head,P=pieceOf(o.head);
    ctx.save();
    if(LADY_PIECES[o.head]){
      drawLadyHeaddress(o,x,headY,r,c,lw,back);
    }else if(o.head==='judgeCap'||o.head==='clerkCap'){
      // Round cap of office (the judge's taller, a biretta), sitting low on the brow.
      const tall=o.head==='judgeCap'?.95:.62;
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*1.02,headY-r*.25);ctx.lineTo(x-r*.86,headY-r*(.25+tall));
      ctx.quadraticCurveTo(x,headY-r*(.45+tall),x+r*.86,headY-r*(.25+tall));ctx.lineTo(x+r*1.02,headY-r*.25);ctx.closePath();ctx.fill();outline(lw*.8);
      if(o.head==='judgeCap'&&r>=1.2){ctx.fillStyle='#d8b14a';ctx.beginPath();ctx.arc(x,headY-r*(.45+tall),r*.18,0,Math.PI*2);ctx.fill()}
    }else if(o.head==='executionerHood'){
      // Full hood over the face and shoulders, two eye holes.
      ctx.fillStyle=c;
      ctx.beginPath();ctx.moveTo(x-r*1.05,headY+r*.5);ctx.lineTo(x-r*1.55,headY+r*1.6);
      ctx.quadraticCurveTo(x,headY+r*2.05,x+r*1.55,headY+r*1.6);ctx.lineTo(x+r*1.05,headY+r*.5);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.moveTo(x-r*1.15,headY+r*.6);ctx.quadraticCurveTo(x-r*1.3,headY-r*1.5,x,headY-r*1.75);
      ctx.quadraticCurveTo(x+r*1.3,headY-r*1.5,x+r*1.15,headY+r*.6);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.1&&!back){ctx.fillStyle='#d9c3a5';for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(x+s*r*.38,headY-r*.08,r*.2,r*.12,0,0,Math.PI*2);ctx.fill()}}
    }else if(o.head==='strawHat'){
      ctx.fillStyle=c;
      ctx.beginPath();ctx.ellipse(x,headY-r*.42,r*1.85,r*.42,0,0,Math.PI*2);ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.ellipse(x,headY-r*.55,r*.88,r*.72,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.strokeStyle='#7b5a2c';ctx.lineWidth=Math.max(.5,r*.18);ctx.beginPath();ctx.moveTo(x-r*.86,headY-r*.62);ctx.lineTo(x+r*.86,headY-r*.62);ctx.stroke()}
    }else if(o.head==='cookCap'){
      // Puffed linen cap of the kitchen, gathered in a band.
      ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,headY-r*1.05,r*1.12,r*.72,0,0,Math.PI*2);ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.rect(x-r*.98,headY-r*.78,r*1.96,r*.4);ctx.fill();outline(lw*.6);
    }else if(o.head==='leatherCap'){
      // Close skullcap with a stitched seam.
      ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,headY-r*.3,r*1.04,r*.82,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.strokeStyle='rgba(33,24,16,.6)';ctx.lineWidth=Math.max(.4,r*.12);ctx.beginPath();ctx.moveTo(x,headY-r*1.1);ctx.lineTo(x,headY-r*.32);ctx.stroke()}
    }else if(o.head==='linenCoif'){
      // Linen coif over the hair, tied under the chin.
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*1.06,headY+r*.25);ctx.quadraticCurveTo(x-r*1.2,headY-r*1.25,x,headY-r*1.2);
      ctx.quadraticCurveTo(x+r*1.2,headY-r*1.25,x+r*1.06,headY+r*.25);ctx.lineTo(x+r*.8,headY+r*.3);ctx.quadraticCurveTo(x,headY-r*.85,x-r*.8,headY+r*.3);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.strokeStyle=c;ctx.lineWidth=Math.max(.4,r*.14);ctx.beginPath();ctx.moveTo(x-r*.95,headY+r*.25);ctx.quadraticCurveTo(x,headY+r*1.25,x+r*.95,headY+r*.25);ctx.stroke()}
    }else if(o.head==='feltHat'){
      // Wide felt brim turned down, low round crown with a cord.
      ctx.fillStyle=c;
      ctx.beginPath();ctx.moveTo(x-r*1.95,headY-r*.15);ctx.quadraticCurveTo(x,headY-r*.85,x+r*1.95,headY-r*.15);ctx.quadraticCurveTo(x,headY-r*.45,x-r*1.95,headY-r*.15);ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.ellipse(x,headY-r*.6,r*.95,r*.78,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.strokeStyle='#2a221b';ctx.lineWidth=Math.max(.5,r*.16);ctx.beginPath();ctx.moveTo(x-r*.93,headY-r*.68);ctx.lineTo(x+r*.93,headY-r*.68);ctx.stroke()}
    }else if(o.head==='flatCap'){
      // Tocco: a flat round cap sitting square on the head.
      ctx.fillStyle=c;
      ctx.beginPath();ctx.ellipse(x,headY-r*.75,r*1.22,r*.42,0,0,Math.PI*2);ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.rect(x-r*.95,headY-r*.78,r*1.9,r*.36);ctx.fill();outline(lw*.6);
    }else if(o.head==='stockingCap'){
      // Knitted stocking cap, the tail falling to one side.
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x-r*1.0,headY-r*.25);ctx.quadraticCurveTo(x-r*.9,headY-r*1.3,x+r*.2,headY-r*1.25);
      ctx.quadraticCurveTo(x+r*1.6,headY-r*1.1,x+r*1.75,headY-r*.1);ctx.lineTo(x+r*1.3,headY-r*.2);ctx.quadraticCurveTo(x+r*1.1,headY-r*.55,x+r*.95,headY-r*.3);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.fillStyle='#e8e0c8';ctx.fillRect(x-r*1.02,headY-r*.42,r*2,Math.max(.5,r*.22))}
    }else if(o.head==='furCap'){
      ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,headY-r*.55,r*1.02,r*.70,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.fillStyle=P.trim;ctx.beginPath();ctx.ellipse(x,headY-r*.5,r*1.12,r*.30,0,0,Math.PI*2);ctx.fill();outline(lw*.6);
    }else{
      // Hood: a ring around the face, then a short cape over the shoulders.
      const shoulders=()=>{ctx.beginPath();ctx.moveTo(x-r*1.0,headY+r*.6);ctx.lineTo(x-r*1.5,headY+r*1.55);
        ctx.quadraticCurveTo(x,headY+r*2.0,x+r*1.5,headY+r*1.55);ctx.lineTo(x+r*1.0,headY+r*.6);ctx.closePath()};
      const ring=()=>{ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);
        if(!back){ctx.moveTo(x+r*.9,headY+r*.18);ctx.ellipse(x,headY+r*.18,r*.9,r*.94,0,0,Math.PI*2)}};
      if(P?.heraldic){
        // Levy hood: party per pale in the realm's two colours, like the soldiers' livery.
        const H=typeof State!=='undefined'&&State.heraldry||{};
        const c1=H.c1||(typeof REIGN_COLOR_1!=='undefined'?REIGN_COLOR_1:c),c2=H.c2||(typeof REIGN_COLOR_2!=='undefined'?REIGN_COLOR_2:c);
        for(const [side,col] of [[-1,c1],[1,c2]]){
          ctx.save();ctx.beginPath();ctx.rect(side<0?x-r*2:x,headY-r*2,r*2,r*4.2);ctx.clip();
          ctx.fillStyle=col;shoulders();ctx.fill();ring();ctx.fill('evenodd');ctx.restore();
        }
        shoulders();outline(lw*.8);
      }else{
        ctx.fillStyle=c;shoulders();ctx.fill();outline(lw*.8);ring();ctx.fill('evenodd');
      }
      ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);outline(lw*.8);
      // The liripipe tail of the wool hood falls on one side.
      if(o.head==='woolHood'&&r>=1.2){ctx.beginPath();ctx.moveTo(x+r*.9,headY-r*.9);ctx.quadraticCurveTo(x+r*2.0,headY-r*.4,x+r*1.7,headY+r*1.2);ctx.lineTo(x+r*1.35,headY+r*1.0);ctx.closePath();ctx.fill();outline(lw*.6)}
    }
    ctx.restore();
  }
  const api={PIECES,ROLE_PIECES,LADY_PIECES,ROLES,WINTER_BY_MONTH,SUMMER_BY_MONTH,preview:null,conditions,fromKind,levels,classPalette,compose,outfitFor,
    isLady,ladyHairStyle,drawLadyHair,drawBody,drawHead};
  window.ConquerWardrobe=api;
})();
