'use strict';
// CONQUER seasonal wardrobe: a catalogue of clothing overlays drawn over the shared
// villager figure (drawVillagerFigureUnmasked) in bad weather and in the cold months.
// Overlays, not alternate skins: the procedural body keeps its class silhouette and
// tunic colours, and the pieces stack (a cloak with a hood, a shawl under a hat).
// Outfits are pure functions of resident id, month and weather: no state, no economy.
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
    executionerHood:{label:'Cappuccio del boia',slot:'head',role:'Boia',palette:['#1f1b1c']}
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
    }else if(o.body){
      const cape=o.body==='rainCape',hem=bodyY+h*(cape?.14:.30);
      ctx.beginPath();
      ctx.moveTo(x-w*.20,top-h*.02);ctx.lineTo(x-w*.50,top+h*.18);ctx.lineTo(x-w*.60,hem);
      ctx.quadraticCurveTo(x,hem+h*.10,x+w*.60,hem);ctx.lineTo(x+w*.50,top+h*.18);ctx.lineTo(x+w*.20,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(!cape&&fine){
        // Open front: the class tunic colour stays readable down the middle.
        ctx.beginPath();ctx.moveTo(x-w*.05,top+h*.12);ctx.lineTo(x-w*.14,hem+h*.06);ctx.lineTo(x+w*.14,hem+h*.06);ctx.lineTo(x+w*.05,top+h*.12);ctx.closePath();
        ctx.fillStyle=dot.colors?.[0]||'#8c6b3f';ctx.fill();
      }
      const trim=PIECES[o.body].trim;
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
  const api={PIECES,ROLE_PIECES,WINTER_BY_MONTH,SUMMER_BY_MONTH,preview:null,conditions,fromKind,levels,classPalette,compose,outfitFor,drawBody,drawHead};
  window.ConquerWardrobe=api;
})();
