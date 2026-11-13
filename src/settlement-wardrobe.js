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
    cookCap:{label:'Berretto da cuoco',slot:'head',role:'Cuoco',palette:['#f1ece0']}
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
    bailiff:{label:'Giudice del Balivo',pieces:['bailiffRobe','clerkCap']}
  };
  const pieceOf=id=>PIECES[id]||ROLE_PIECES[id];
  // Calendar month (0 = January) -> share of residents dressed for the cold / the sun.
  // Shoulder months dress only part of the town, so a season never flips everyone at once.
  const WINTER_BY_MONTH=[1,1,.45,0,0,0,0,0,0,0,.45,1];
  const SUMMER_BY_MONTH=[0,0,0,0,.4,1,1,1,.4,0,0,0];
  // Civil classes by house level: peasant L1, artisan L2, merchant L3, elite L4.
  const HAT_SHARE={peasant:.75,artisan:.45,merchant:.3,elite:.2};
  const CLOAK_BY_CLASS={peasant:'sheepskin',artisan:'woolCloak',merchant:'furCloak',elite:'furCloak'};
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
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
  function outfitFor(dot,c=conditions()){
    if(dot.outfit!==undefined)return dot.outfit;
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
  function drawBody(o,dot,x,bodyY,w,h){
    if(!o)return;
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
      if(fine){
        ctx.fillStyle=R.emblem;ctx.beginPath();ctx.moveTo(x-w*.12,top+h*.14);ctx.lineTo(x+w*.12,top+h*.14);ctx.lineTo(x+w*.12,top+h*.3);
        ctx.quadraticCurveTo(x,top+h*.42,x-w*.12,top+h*.3);ctx.closePath();ctx.fill();
        ctx.fillStyle='#3e2c1d';ctx.fillRect(x-w*.5,bodyY+h*.02,w,Math.max(.6,h*.05));
      }
    }else if(o.body){
      const cape=o.body==='rainCape'||!!pieceOf(o.body)?.cape,hem=bodyY+h*(cape?.14:.30);
      ctx.beginPath();
      ctx.moveTo(x-w*.20,top-h*.02);ctx.lineTo(x-w*.50,top+h*.18);ctx.lineTo(x-w*.60,hem);
      ctx.quadraticCurveTo(x,hem+h*.10,x+w*.60,hem);ctx.lineTo(x+w*.50,top+h*.18);ctx.lineTo(x+w*.20,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(!cape&&fine){
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
    if(o.neck==='shawl'){
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
  // Over the head: x/headY its centre, r its radius; the hood also drapes the shoulders.
  function drawHead(o,x,headY,r){
    if(!o||!o.head)return;
    const lw=Math.max(.6,r*.2),c=o.colors.head,P=pieceOf(o.head);
    ctx.save();
    if(o.head==='judgeCap'||o.head==='clerkCap'){
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
      if(r>=1.1){ctx.fillStyle='#d9c3a5';for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(x+s*r*.38,headY-r*.08,r*.2,r*.12,0,0,Math.PI*2);ctx.fill()}}
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
      ctx.fillStyle=c;
      ctx.beginPath();ctx.moveTo(x-r*1.0,headY+r*.6);ctx.lineTo(x-r*1.5,headY+r*1.55);
      ctx.quadraticCurveTo(x,headY+r*2.0,x+r*1.5,headY+r*1.55);ctx.lineTo(x+r*1.0,headY+r*.6);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);
      ctx.moveTo(x+r*.9,headY+r*.18);ctx.ellipse(x,headY+r*.18,r*.9,r*.94,0,0,Math.PI*2);ctx.fill('evenodd');
      ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);outline(lw*.8);
      // The liripipe tail of the wool hood falls on one side.
      if(o.head==='woolHood'&&r>=1.2){ctx.beginPath();ctx.moveTo(x+r*.9,headY-r*.9);ctx.quadraticCurveTo(x+r*2.0,headY-r*.4,x+r*1.7,headY+r*1.2);ctx.lineTo(x+r*1.35,headY+r*1.0);ctx.closePath();ctx.fill();outline(lw*.6)}
    }
    ctx.restore();
  }
  const api={PIECES,ROLE_PIECES,ROLES,WINTER_BY_MONTH,SUMMER_BY_MONTH,preview:null,conditions,fromKind,levels,classPalette,compose,outfitFor,drawBody,drawHead};
  window.ConquerWardrobe=api;
})();
