'use strict';
// CONQUER animals: procedural canvas animation from the split SVG parts in
// animali_svg_v2 (body / head / legs / tail). Each species is one rigid set
// of parts: browsing lowers the same head, it never reshapes it.
// Classic script, no dependencies; poses are pure functions of time.
(function(){
  const SPECIES={
    // Source: pecora_estesa.svg (256×256, faces left).
    sheep:{
      artFacing:-1,
      body:'M74 96 C74 78,92 68,116 68 C128 56,154 58,166 72 C190 72,208 86,208 108 C220 116,224 128,220 142 C222 158,214 170,198 176 C188 190,166 196,146 192 C128 198,102 196,88 184 C66 182,52 166,52 144 C42 132,40 118,46 104 C44 92,54 84,66 82 C68 88,70 92,74 96 Z',
      head:'M58 78 C72 62,94 58,106 70 C112 76,112 88,106 96 C96 110,76 116,62 104 C50 94,50 86,58 78 Z M56 76 L46 66 L42 56 L52 56 L62 64 Z M96 74 L108 66 L118 64 L118 72 L104 82 Z',
      legs:'M80 174 C86 174,92 178,92 184 L90 226 C90 232,86 238,80 238 C74 238,70 232,70 226 L72 184 C72 178,74 174,80 174 Z M112 178 C118 178,124 182,124 188 L124 230 C124 236,120 242,114 242 C108 242,104 236,104 230 L104 188 C104 182,106 178,112 178 Z M154 178 C160 178,166 182,166 188 L162 228 C162 236,158 242,152 242 C146 242,142 236,142 230 L144 188 C144 182,148 178,154 178 Z M186 170 C192 170,198 174,198 180 L194 224 C194 232,190 238,184 238 C178 238,174 232,174 226 L176 182 C176 176,180 170,186 170 Z',
      tail:'M206 112 C220 114,224 122,222 130 C218 126,212 124,206 120 Z',
      pivot:{x:100,y:92},eye:{x:72,y:82},tailPivot:{x:206,y:116},center:{x:134,y:240},
      // Walk pulls the head clear of the fleece (as in the reference
      // silhouette); browse lowers it, muzzle to the grass.
      pose:{walk:{x:-18,y:-8,rot:0},browse:{x:-66,y:98,rot:-.85}},
      // Fleece-covered neck root, hidden in the body until the head drops.
      woolNeck:{x:80,y:122,width:34},
      colors:{body:'#f6f3ec',shade:'#e4ddd0',line:'#5e554b',head:'#e7b1ab',headLine:'#87534f',
        leg:'#e7b1ab',legFar:'#c98f8a',legLine:'#87534f',eye:'#2b2321'}
    },
    // Source: capra_estesa.svg (256×256, faces right). Horns redrawn to sweep
    // back over the neck like an ibex; head and neck move as one rigid piece.
    goat:{
      artFacing:1,
      body:'M66 126 C76 100,106 88,144 92 C166 80,192 88,202 108 C214 112,220 122,220 134 C220 146,214 156,202 162 C194 176,178 184,156 186 C130 188,102 182,86 172 C72 164,62 150,66 126 Z',
      head:'M170 100 C176 82,192 68,210 62 C226 56,238 62,240 74 C242 90,234 104,222 112 C212 118,202 118,192 114 C188 124,182 132,172 138 C162 136,156 132,154 126 C160 120,166 112,170 100 Z',
      horn:'M211 68 C213 40,198 16,174 14 C162 14,152 22,148 36 C158 28,170 22,181 24 C196 30,203 50,201 70 Z',
      beard:'M228 112 C230 120,228 128,222 134 C220 128,218 120,220 112 Z',
      legs:'M88 170 C94 170,98 174,98 180 L96 228 C96 234,92 240,86 240 C80 240,76 234,76 228 L78 180 C78 174,82 170,88 170 Z M120 176 C126 176,130 180,130 186 L130 232 C130 238,126 244,120 244 C114 244,110 238,110 232 L110 186 C110 180,114 176,120 176 Z M156 176 C162 176,166 180,166 186 L164 230 C164 238,160 244,154 244 C148 244,144 238,144 232 L146 186 C146 180,150 176,156 176 Z M188 168 C194 168,198 172,198 178 L196 226 C196 232,192 238,186 238 C180 238,176 232,176 226 L178 178 C178 172,182 168,188 168 Z',
      tail:'M66 130 C56 124,54 112,60 104 C68 110,72 120,70 130 Z',
      pivot:{x:166,y:128},eye:{x:216,y:76},tailPivot:{x:66,y:128},center:{x:138,y:242},
      pose:{walk:{x:10,y:-14,rot:0},browse:{x:6,y:30,rot:1.42}},
      // The neck grows out of the body: the head group sits behind the body.
      hoof:12,farHorn:{x:-7,y:3},headBehind:true,
      colors:{body:'#d8c19a',shade:'#c4aa80',line:'#5f4a33',head:'#d8c19a',headLine:'#5f4a33',
        leg:'#d8c19a',legFar:'#b99f76',legLine:'#5f4a33',eye:'#2b2321',
        horn:'#4a2f1d',hornFar:'#33200f',hornLine:'#24170c',beard:'#b39a72',hoof:'#3a2c20'}
    },
    // Source: mucca_estesa.svg (256×256, faces right). Polled like the
    // reference: no horns, an ear instead, lighter muzzle, long tufted tail.
    cow:{
      artFacing:1,
      body:'M52 102 C68 88,96 82,126 84 C150 74,184 78,206 92 C220 98,228 110,228 126 C228 142,220 154,206 162 C190 174,164 180,132 180 C102 180,78 174,60 164 C46 156,38 142,38 126 C38 116,42 108,52 102 Z',
      head:'M194 94 C202 80,218 72,232 76 C244 80,250 92,248 104 C246 116,236 126,224 128 C214 130,204 126,198 118 C190 124,182 128,174 130 C166 124,164 116,166 108 C172 102,180 96,194 94 Z',
      headParts:[
        {d:'M212 84 C204 74,192 70,184 74 C188 84,200 90,212 90 Z',fill:'ear'},
        {d:'M236 96 C246 96,251 104,249 112 C246 121,236 122,231 116 C228 108,230 99,236 96 Z',fill:'muzzle'}
      ],
      legs:'M76 166 C82 166,86 170,86 176 L86 230 C86 236,82 242,76 242 C70 242,66 236,66 230 L66 176 C66 170,70 166,76 166 Z M112 170 C118 170,122 174,122 180 L122 234 C122 240,118 246,112 246 C106 246,102 240,102 234 L102 180 C102 174,106 170,112 170 Z M160 168 C166 168,170 172,170 178 L168 232 C168 238,164 244,158 244 C152 244,148 238,148 232 L150 178 C150 172,154 168,160 168 Z M194 160 C200 160,204 164,204 170 L202 226 C202 232,198 238,192 238 C186 238,182 232,182 226 L184 170 C184 164,188 160,194 160 Z',
      tail:'M48 104 C38 122,32 150,34 186 C29 191,27 199,31 205 C37 202,41 195,39 187 C39 153,45 126,54 108 Z',
      pivot:{x:176,y:118},eye:{x:226,y:90},tailPivot:{x:50,y:106},center:{x:134,y:244},
      pose:{walk:{x:16,y:4,rot:0},browse:{x:24,y:30,rot:1.25}},
      // In-world size relative to sheep and goats.
      hoof:12,headBehind:true,scale:1.7,
      colors:{body:'#7a5236',shade:'#694530',line:'#3b2617',head:'#7a5236',headLine:'#3b2617',
        leg:'#7a5236',legFar:'#5f3f29',legLine:'#3b2617',eye:'#1e140d',
        ear:'#5f3f29',muzzle:'#a47c5d',hoof:'#2a1c12'}
    },
    // Source: cavallo_esteso.svg (256×256, faces right). Long hanging tail
    // and a mane along the neck redrawn after the reference; coat variants.
    horse:{
      artFacing:1,
      body:'M54 130 C60 108,88 92,126 92 C150 84,176 90,190 106 C202 110,210 118,214 128 C220 144,214 158,200 168 C190 180,172 188,148 188 C124 188,96 184,76 174 C60 166,50 150,54 130 Z',
      head:'M170 102 C174 84,182 68,194 52 C204 38,214 28,222 28 C226 28,228 32,228 38 C226 48,224 60,224 70 C226 84,230 94,236 104 C236 112,228 118,220 118 C210 120,198 118,190 112 C182 120,172 128,162 132 C156 128,154 120,156 112 C160 108,164 106,170 102 Z',
      headParts:[
        {d:'M217 34 L213 17 L226 29 Z',fill:'body'},
        {d:'M166 104 C170 84,180 66,194 50 C202 41,210 33,219 30 C214 40,206 50,200 60 C190 74,183 88,178 106 Z',fill:'mane'}
      ],
      legs:'M80 172 C86 172,90 176,90 182 L88 230 C88 236,84 242,78 242 C72 242,68 236,68 230 L70 182 C70 176,74 172,80 172 Z M110 178 C116 178,120 182,120 188 L118 236 C118 242,114 248,108 248 C102 248,98 242,98 236 L100 188 C100 182,104 178,110 178 Z M156 176 C162 176,166 180,166 186 L164 232 C164 238,160 244,154 244 C148 244,144 238,144 232 L146 186 C146 180,150 176,156 176 Z M190 166 C196 166,200 170,200 176 L196 226 C196 232,192 238,186 238 C180 238,176 232,176 226 L180 176 C180 170,184 166,190 166 Z',
      tail:'M60 124 C46 134,38 162,36 198 C35 208,41 214,47 207 C49 182,55 158,66 138 Z',
      tailFill:'mane',
      pivot:{x:166,y:118},eye:{x:222,y:52},tailPivot:{x:60,y:128},center:{x:134,y:246},
      // Dedicated neck joint: the neck is its own tapered piece from a root
      // hidden in the body to the throat (line a→b); the rigid head rides on
      // its end. Pose x/y move the throat, rot turns the head about it.
      pose:{walk:{x:0,y:0,rot:0},browse:{x:36,y:120,rot:.55}},
      joint:{a:{x:210,y:40},b:{x:194,y:108}},
      neck:{root:{x:150,y:112},rootWidth:58,tipWidth:66,mane:12},
      // In-world size: a horse stands well above sheep and people.
      hoof:12,headBehind:true,scale:1.9,
      colors:{body:'#8a5a35',shade:'#764b2b',line:'#3a2414',head:'#8a5a35',headLine:'#3a2414',
        leg:'#8a5a35',legFar:'#6d4628',legLine:'#3a2414',eye:'#120c08',mane:'#2a1a10',hoof:'#221812'},
      coats:{
        brown:{},
        black:{body:'#2e2a27',shade:'#24211f',line:'#0c0b0a',head:'#2e2a27',headLine:'#0c0b0a',
          leg:'#2e2a27',legFar:'#1f1c1a',legLine:'#0c0b0a',eye:'#000',mane:'#151311',hoof:'#0a0908'},
        grey:{body:'#9b9a95',shade:'#888782',line:'#474643',head:'#9b9a95',headLine:'#474643',
          leg:'#9b9a95',legFar:'#7f7e79',legLine:'#474643',mane:'#5e5d59',hoof:'#2c2b29'},
        white:{body:'#ece9e2',shade:'#d8d3c8',line:'#6a645b',head:'#ece9e2',headLine:'#6a645b',
          leg:'#ece9e2',legFar:'#cdc7bc',legLine:'#6a645b',mane:'#d0c9bc',hoof:'#4a443d'}
      }
    }
  };
  // Wildlife, authored for this game (right-facing, ground at y 244).
  // Legs are listed hind near, hind far, fore near, fore far — the order the
  // gallop and rearing poses rely on.
  const legs=(xs,make)=>xs.map(make).join(' ');
  const slimLeg=(top,w)=>x=>`M${x-w/2} ${top} L${x+w/2} ${top} L${x+w/2-1} 238 C${x+w/2-1} 244,${x-w/2+1} 244,${x-w/2+1} 238 Z`;
  const pawLeg=(top,w)=>x=>`M${x-w/2} ${top} L${x+w/2} ${top} L${x+w/2-1} 234 C${x+w/2+3} 236,${x+w/2+3} 244,${x+w/2-4} 244 L${x-w/2+2} 244 C${x-w/2} 240,${x-w/2} 238,${x-w/2+1} 234 Z`;
  const DOMESTIC_MODES=[['walk','Walking'],['browse','Browse']];
  for(const sp of Object.values(SPECIES))sp.modes=DOMESTIC_MODES;
  const DEER={
    artFacing:1,scale:1.6,hindLegs:[0,1],headBehind:true,hoof:8,
    modes:[['walk','Walking'],['browse','Browse'],['alert','Allerta'],['run','Corsa']],
    body:'M70 122 C76 102,108 94,148 96 C176 92,198 100,206 116 C214 132,208 150,194 158 C172 168,128 170,98 166 C78 162,64 148,70 122 Z',
    head:'M204 50 C212 40,228 40,238 48 L252 60 C256 64,254 70,248 70 L232 70 C222 76,210 74,204 66 C200 60,200 54,204 50 Z',
    headParts:[
      {d:'M208 48 C198 36,196 22,204 14 C212 22,216 36,214 46 Z',fill:'ear'},
      {d:'M218 46 C220 32,228 22,238 20 C238 32,232 42,226 50 Z',fill:'ear'},
      {d:'M248 60 C254 60,256 66,252 68 C248 68,246 64,248 60 Z',fill:'nose'}
    ],
    legs:legs([92,104,184,172],slimLeg(146,10)),
    tail:'M72 112 C64 104,62 94,68 90 C74 96,78 106,78 116 Z',tailFill:'tail',
    pivot:{x:184,y:114},eye:{x:226,y:54},tailPivot:{x:74,y:114},center:{x:134,y:244},
    joint:{a:{x:214,y:44},b:{x:204,y:70}},neck:{root:{x:184,y:114},rootWidth:40,tipWidth:26},
    pose:{walk:{x:0,y:0,rot:0},browse:{x:22,y:142,rot:1.3},alert:{x:-4,y:-12,rot:-.1},run:{x:14,y:26,rot:.3}},
    colors:{body:'#a8703f',shade:'#cfa676',line:'#3c2716',head:'#a8703f',headLine:'#3c2716',
      leg:'#a8703f',legFar:'#86572f',legLine:'#3c2716',ear:'#93612f',nose:'#2a1d12',eye:'#1a120b',
      tail:'#f1e9dc',hoof:'#2a1d12',antler:'#dcc9a3',antlerFar:'#b7a27b'}
  };
  // Stag: the doe's body with a branching palm of antlers on the same head.
  const antler=(dx,dy)=>[[[218+dx,46+dy],[208+dx,18+dy],[194+dx,-10+dy],[186+dx,-36+dy],[192+dx,-64+dy]],
    [[206+dx,14+dy],[228+dx,-14+dy]],[[195+dx,-8+dy],[214+dx,-40+dy]],[[188+dx,-30+dy],[174+dx,-56+dy]],[[212+dx,30+dy],[198+dx,20+dy]]];
  const STAG={...DEER,scale:1.8,headStrokes:[
    {lines:antler(12,-2),width:7,color:'antlerFar',far:true},
    {lines:antler(0,0),width:7,color:'antler'}
  ]};
  const WOLF={
    // Intrinsic SVG scale only: world sizing is controlled centrally by
    // settlement-wolves.js relative to a human, not a second resize factor.
    artFacing:1,hindLegs:[0,1],headBehind:true,
    modes:[['walk','Walking'],['run','Corsa'],['howl','Ululato'],['idle','Fermo']],
    body:'M66 126 C72 104,98 96,132 98 C162 92,188 94,202 108 C214 120,212 140,200 150 C184 162,146 164,114 162 C88 160,66 150,66 126 Z',
    head:'M198 92 C208 80,226 78,236 86 L254 98 C258 102,256 107,250 108 L232 110 C222 116,208 114,200 106 C196 100,195 96,198 92 Z',
    headParts:[
      {d:'M204 90 L206 66 L218 84 Z',fill:'ear'},
      {d:'M214 86 L222 64 L228 84 Z',fill:'ear'},
      {d:'M250 98 C256 98,258 104,252 106 C248 106,247 100,250 98 Z',fill:'nose'}
    ],
    legs:legs([90,102,182,170],pawLeg(146,12)),
    tail:'M68 118 C50 124,38 150,34 180 C32 196,44 200,50 188 C54 168,62 146,76 132 Z',tailFill:'tail',
    pivot:{x:178,y:114},eye:{x:226,y:92},tailPivot:{x:70,y:122},center:{x:134,y:244},
    joint:{a:{x:210,y:80},b:{x:202,y:110}},neck:{root:{x:178,y:114},rootWidth:50,tipWidth:34},
    pose:{walk:{x:0,y:0,rot:0},run:{x:18,y:22,rot:.2},howl:{x:-8,y:-26,rot:-.95},idle:{x:0,y:0,rot:0}},
    colors:{body:'#8c8b86',shade:'#c7c3b8',line:'#2c2c2a',head:'#8c8b86',headLine:'#2c2c2a',
      leg:'#8c8b86',legFar:'#6b6a66',legLine:'#2c2c2a',ear:'#6b6a66',nose:'#1c1c1b',eye:'#e2b93b',tail:'#7d7c77'}
  };
  const BEAR={
    artFacing:1,scale:1.7,hindLegs:[0,1],
    modes:[['walk','Walking'],['stand','In piedi'],['sleep','Dorme']],
    body:'M56 140 C56 106,88 86,130 88 C156 78,186 82,202 100 C216 116,216 146,204 160 C188 176,142 180,104 178 C74 176,56 166,56 140 Z',
    head:'M194 106 C202 94,218 90,230 96 C240 102,250 110,254 120 C255 128,248 131,240 129 C228 134,210 134,200 126 C192 120,190 112,194 106 Z',
    headParts:[
      {d:'M200 102 C196 88,206 84,212 94 Z',fill:'ear'},
      {d:'M238 112 C248 112,256 118,254 126 C250 132,240 130,234 124 Z',fill:'muzzle'},
      {d:'M250 116 C256 116,258 122,253 124 C249 124,248 119,250 116 Z',fill:'nose'}
    ],
    legs:legs([84,98,184,170],pawLeg(156,28)),
    tail:'M58 128 C50 124,46 132,52 138 C56 136,58 132,58 128 Z',
    pivot:{x:192,y:116},eye:{x:222,y:106},tailPivot:{x:58,y:130},center:{x:134,y:244},
    pose:{walk:{x:0,y:0,rot:0},
      // Rearing: body up about the hip, hind legs stay planted, fore legs
      // hang forward, head levels out.
      stand:{x:0,y:0,rot:1.1,bodyRot:-1.25,bodyPivot:{x:90,y:160},legAdd:[0,0,.95,.8]},
      sleep:{x:0,y:0,rot:0,art:'sleep'}},
    sleep:{
      body:'M58 204 C54 156,96 122,150 124 C202 126,228 160,224 200 C222 228,198 242,150 244 C100 246,60 234,58 204 Z',
      parts:[
        {d:'M186 216 C192 200,212 194,226 200 C238 206,240 222,230 230 C218 238,198 236,186 228 Z',fill:'head'},
        {d:'M196 206 C194 194,202 192,208 200 Z',fill:'ear'},
        {d:'M224 214 C234 214,240 220,236 226 C230 230,222 226,220 220 Z',fill:'muzzle'},
        {d:'M150 232 C160 222,184 222,188 236 C176 242,160 242,150 232 Z',fill:'body'}
      ],
      eye:[[204,212],[213,215]]
    },
    colors:{body:'#5b3e27',shade:'#4b3320',line:'#1d130b',head:'#5b3e27',headLine:'#1d130b',
      leg:'#5b3e27',legFar:'#45301d',legLine:'#1d130b',ear:'#45301d',muzzle:'#8a6a4c',nose:'#120c08',eye:'#120c08'}
  };
  const BOAR={
    artFacing:1,scale:1.1,hindLegs:[0,1],headBehind:true,hoof:10,
    modes:[['walk','Walking'],['browse','Grufola'],['run','Corsa']],
    body:'M62 122 C72 98,110 92,150 96 C176 88,202 96,212 114 C218 132,212 154,194 162 C162 172,110 172,84 164 C66 158,58 142,62 122 Z',
    head:'M196 104 C210 96,226 104,234 118 L250 138 C254 145,250 150,244 148 L226 146 C214 147,202 140,198 130 C194 120,193 110,196 104 Z',
    headParts:[
      {d:'M206 104 C202 90,212 86,218 98 Z',fill:'ear'},
      {d:'M244 136 C250 136,254 142,250 148 C246 150,242 146,242 142 Z',fill:'nose'},
      {d:'M232 144 C234 134,240 130,244 132 C242 138,238 142,232 144 Z',fill:'tusk'}
    ],
    legs:legs([92,104,186,174],slimLeg(150,18)),
    tail:'M62 112 C52 104,44 110,48 116 C52 120,48 126,42 122 C44 130,54 128,56 120 C58 116,60 114,62 112 Z',
    pivot:{x:180,y:118},eye:{x:216,y:114},tailPivot:{x:62,y:114},center:{x:134,y:244},
    joint:{a:{x:204,y:98},b:{x:198,y:132}},neck:{root:{x:180,y:118},rootWidth:64,tipWidth:40,mane:9},
    pose:{walk:{x:0,y:0,rot:0},browse:{x:6,y:48,rot:.6},run:{x:8,y:10,rot:.15}},
    colors:{body:'#9b8a74',shade:'#8a7964',line:'#33393b',head:'#9b8a74',headLine:'#33393b',
      leg:'#6d6151',legFar:'#574d40',legLine:'#33393b',ear:'#7d6e5c',nose:'#5b4a42',tusk:'#efe8d6',
      mane:'#5a4f42',hoof:'#2a2522',eye:'#1a1a1a'}
  };
  Object.assign(SPECIES,{deer:DEER,stag:STAG,wolf:WOLF,bear:BEAR,boar:BOAR});
  // Coat variants are merged once, not per frame.
  for(const sp of Object.values(SPECIES))
    if(sp.coats)sp.coatColors=Object.fromEntries(Object.entries(sp.coats).map(([k,v])=>[k,{...sp.colors,...v}]));
  // Each leg is its own subpath; its hip is the top of the subpath.
  for(const sp of Object.values(SPECIES))
    sp.legList=sp.legs.split(/(?=M)/).map(s=>{const [x,y]=s.slice(1).trim().split(/[ ,]+/).map(Number);return{d:s,x,y:y+6}});

  const lerp=(a,b,k)=>a+(b-a)*k;
  const ease=k=>k*k*(3-2*k);
  // Pure gait maths for one mode, shared by all species.
  function gaitPose(mode,t,seed=0){
    const out={legs:[0,0,0,0],lift:[0,0,0,0],bob:0,head:0,tail:0,chew:0};
    if(mode==='walk'){
      const p=t*Math.PI*2*1.6+seed;
      // Diagonal gait: front-left with back-right.
      const swing=[Math.sin(p),-Math.sin(p),-Math.sin(p),Math.sin(p)];
      out.legs=swing.map(s=>s*.38);
      out.lift=swing.map(s=>Math.max(0,s)*5);
      out.bob=-Math.abs(Math.cos(p))*4+2;
      out.head=Math.sin(p*2)*.05;
      out.tail=Math.sin(p*2)*.18;
    }else if(mode==='browse'){
      // Browse: legs planted, short nibbles, a step every few seconds.
      const p=t*Math.PI*2+seed,nibble=Math.max(0,Math.sin(p*2.2));
      out.head=nibble*.08;
      out.chew=nibble;
      const shift=Math.sin(t*.9+seed*3);
      if(shift>.96){const s=Math.sin((shift-.96)/.04*Math.PI);out.legs[0]=-s*.22;out.lift[0]=s*4}
      out.bob=Math.sin(t*1.3+seed)*.8;
      out.tail=Math.sin(t*5+seed)*(Math.sin(t*.7+seed)>.6?.25:.04);
    }else if(mode==='run'){
      // Gallop: hind pair (legs 0,1) and fore pair (2,3) reach together,
      // the body pitches over the stride. Leg order: hind near/far, fore near/far.
      const p=t*Math.PI*2*2.2+seed;
      out.legs=[Math.sin(p),Math.sin(p+.35),Math.sin(p+Math.PI),Math.sin(p+Math.PI+.35)].map(s=>s*.6);
      out.lift=out.legs.map(a=>Math.max(0,-a)*14);
      out.bob=-Math.abs(Math.sin(p))*8+3;
      out.head=Math.sin(p*2)*.06;
      out.tail=.25+Math.sin(p)*.15;
      out.pitch=Math.sin(p)*.07;
    }else{
      // Still: standing, howling, rearing — only breathing and a tail twitch.
      out.bob=Math.sin(t*1.5+seed)*.6;
      out.tail=Math.sin(t*2+seed)*.05;
    }
    return out;
  }
  // One mode's full pose. Gait angles are authored for left-facing art;
  // right-facing art mirrors them. Pose specs per species: {x,y,rot} place
  // the head; optional gait, tilt, neck, bodyRot/bodyPivot, legAdd, art.
  function modePose(species,mode,t,seed){
    const sp=SPECIES[species],spec=sp.pose[mode]||sp.pose.walk,dir=-sp.artFacing;
    const gait=spec.gait||(['walk','browse','run'].includes(mode)?mode:'still');
    const g=gaitPose(gait,t,seed),add=spec.legAdd||[0,0,0,0];
    return{
      legs:g.legs.map((a,i)=>a*dir+add[i]),lift:g.lift,bob:g.bob,tail:g.tail*dir,
      headX:spec.x,headY:spec.y+(gait==='browse'?g.chew*2:0),headRot:spec.rot+g.head*dir,
      neck:spec.neck??(mode==='browse'?1:0),
      tilt:((spec.tilt??(mode==='browse'?-.05:0))+(g.pitch||0))*dir,
      bodyRot:spec.bodyRot||0,bodyPivot:spec.bodyPivot||null,art:spec.art||'body'
    };
  }
  // Transition from one mode to another (k 0..1). Rigid parts travel
  // continuously; a different art (sleeping) swaps inside a short crouch.
  function transitionPose(species,from,to,k,t,seed){
    const a=modePose(species,from,t,seed),b=modePose(species,to,t,seed),e=ease(Math.max(0,Math.min(1,k)));
    const out={};
    for(const key of Object.keys(a)){
      const va=a[key],vb=b[key];
      out[key]=Array.isArray(va)?va.map((v,i)=>lerp(v,vb[i],e)):typeof va==='number'?lerp(va,vb,e):(e<.5?va:vb);
    }
    out.bodyPivot=b.bodyPivot||a.bodyPivot;
    out.crouch=a.art!==b.art?Math.sin(e*Math.PI):0;
    return out;
  }
  // Legacy blend: 0 = walk, 1 = browse.
  const blendedPose=(species,t,seed,blend)=>transitionPose(species,'walk','browse',blend,t,seed);

  const pathCache=new Map();
  const path=d=>{let p=pathCache.get(d);if(!p){p=new Path2D(d);pathCache.set(d,p)}return p};
  function fillStroke(ctx,d,fill,line,lw){
    const p=path(d);ctx.fillStyle=fill;ctx.fill(p);
    if(line){ctx.strokeStyle=line;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke(p)}
  }
  const rotateAbout=(ctx,p,a)=>{ctx.translate(p.x,p.y);ctx.rotate(a);ctx.translate(-p.x,-p.y)};
  // Draws one animal. (x,y) = ground point under its feet, size = on-screen
  // height of the 256-unit art box, facing 1 = right / -1 = left.
  // Modes: opts.mode is the target; opts.from + opts.blend (0..1) animate a
  // transition into it. Without opts.from, walk/browse keep the legacy blend
  // (0 = walk, 1 = browse); other modes are shown fully.
  function drawAnimal(species,ctx,x,y,size,opts={}){
    // opts.coat picks a coat variant where the species has them (horse).
    const sp=SPECIES[species],c=sp.coatColors?.[opts.coat]||sp.colors;
    const t=opts.t||0,seed=opts.seed||0,facing=opts.facing>=0?1:-1,mode=opts.mode||'walk';
    let pose;
    if(opts.from)pose=transitionPose(species,opts.from,mode,opts.blend??1,t,seed);
    else if(mode==='walk'||mode==='browse')pose=blendedPose(species,t,seed,Math.max(0,Math.min(1,opts.blend??(mode==='browse'?1:0))));
    else pose=transitionPose(species,mode,mode,1,t,seed);
    size*=sp.scale||1;
    const s=size/256,lw=Math.max(.55,size/90)/s;
    ctx.save();
    ctx.translate(x,y);ctx.scale(facing*sp.artFacing*s,s);ctx.translate(-sp.center.x,-sp.center.y);
    // Soft ground shadow.
    ctx.fillStyle='rgba(30,40,20,.22)';ctx.beginPath();
    ctx.ellipse(sp.center.x,sp.center.y-2,78,12,0,0,Math.PI*2);ctx.fill();
    if(pose.crouch){
      // Squash about the ground while one art swaps for another.
      ctx.translate(sp.center.x,sp.center.y);ctx.scale(1+pose.crouch*.08,1-pose.crouch*.18);ctx.translate(-sp.center.x,-sp.center.y);
    }
    if(pose.art==='sleep'){drawSleeping(ctx,sp,c,lw,t,size);ctx.restore();return}
    // Rearing: the whole animal turns about its hind feet, hind legs stay planted.
    if(pose.bodyRot&&pose.bodyPivot)rotateAbout(ctx,pose.bodyPivot,pose.bodyRot);
    const hind=sp.hindLegs||[];
    // Far legs (1, 3) a shade darker, all legs under the body.
    sp.legList.forEach((leg,i)=>{
      ctx.save();ctx.translate(0,-pose.lift[i]);rotateAbout(ctx,leg,pose.legs[i]-(hind.includes(i)?pose.bodyRot:0));
      fillStroke(ctx,leg.d,i%2?c.legFar:c.leg,null,lw);
      if(sp.hoof){
        const p=path(leg.d);ctx.save();ctx.clip(p);ctx.fillStyle=c.hoof;
        ctx.fillRect(leg.x-20,sp.center.y-sp.hoof-4,40,40);ctx.restore();
      }
      ctx.strokeStyle=c.legLine;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke(path(leg.d));
      ctx.restore();
    });
    ctx.translate(0,pose.bob);
    rotateAbout(ctx,{x:sp.center.x,y:150},pose.tilt);
    // Head anchor: the head pivot carried by the head placement.
    const anchor={x:sp.pivot.x+pose.headX,y:sp.pivot.y+pose.headY};
    if(sp.woolNeck&&pose.neck>.02){
      // Fleece-covered neck from inside the body down to the lowered head.
      const n=sp.woolNeck;ctx.lineCap='round';
      ctx.strokeStyle=c.line;ctx.lineWidth=n.width*pose.neck+lw*2;
      ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(anchor.x,anchor.y);ctx.stroke();
      ctx.strokeStyle=c.body;ctx.lineWidth=n.width*pose.neck;ctx.stroke();
    }
    if(sp.headBehind)drawHead(ctx,sp,c,pose,lw,size);
    ctx.save();rotateAbout(ctx,sp.tailPivot,pose.tail);
    fillStroke(ctx,sp.tail,c[sp.tailFill||'body'],c.line,lw);ctx.restore();
    fillStroke(ctx,sp.body,c.body,c.line,lw);
    // A low belly shade keeps light coats readable on light ground.
    ctx.save();ctx.clip(path(sp.body));ctx.fillStyle=c.shade;
    ctx.beginPath();ctx.ellipse(sp.center.x,sp.center.y-50,110,24,0,0,Math.PI*2);ctx.fill();ctx.restore();
    if(!sp.headBehind)drawHead(ctx,sp,c,pose,lw,size);
    ctx.restore();
  }
  // The head is rigid: only moved and rotated, never reshaped.
  function drawHead(ctx,sp,c,pose,lw,size){
    if(sp.neck){
      // Dedicated neck: tapered piece from the hidden root to the moved throat,
      // then the rigid head (cut at the throat) turned about its own joint.
      const {a,b}=sp.joint,j={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      drawNeck(ctx,sp,c,lw,{x:j.x+pose.headX,y:j.y+pose.headY});
      ctx.save();ctx.translate(pose.headX,pose.headY);rotateAbout(ctx,j,pose.headRot);
      // Antlers reach past the throat line: they ride the head unclipped.
      for(const s of sp.headStrokes||[])if(s.far)drawStroke(ctx,s,c,lw);
      ctx.save();ctx.clip(jointSide(sp,true));drawHeadArt(ctx,sp,c,lw,size,false);ctx.restore();
      for(const s of sp.headStrokes||[])if(!s.far)drawStroke(ctx,s,c,lw);
      ctx.restore();
      return;
    }
    ctx.save();ctx.translate(pose.headX,pose.headY);rotateAbout(ctx,sp.pivot,pose.headRot);
    drawHeadArt(ctx,sp,c,lw,size);
    ctx.restore();
  }
  function drawNeck(ctx,sp,c,lw,tip){
    const n=sp.neck,r=n.root,dx=tip.x-r.x,dy=tip.y-r.y,len=Math.hypot(dx,dy)||1;
    // Normal pointing to the crest (away from the throat) carries the mane.
    let nx=dy/len,ny=-dx/len;
    if(nx*(sp.joint.a.x-sp.joint.b.x)+ny*(sp.joint.a.y-sp.joint.b.y)<0){nx=-nx;ny=-ny}
    const quad=(w0,w1,o0,o1)=>{ctx.beginPath();
      ctx.moveTo(r.x+nx*(w0/2+o0),r.y+ny*(w0/2+o0));ctx.lineTo(tip.x+nx*(w1/2+o1),tip.y+ny*(w1/2+o1));
      ctx.lineTo(tip.x-nx*w1/2,tip.y-ny*w1/2);ctx.lineTo(r.x-nx*w0/2,r.y-ny*w0/2);ctx.closePath()};
    quad(n.rootWidth,n.tipWidth,0,0);ctx.fillStyle=c.head;ctx.fill();
    ctx.strokeStyle=c.headLine;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke();
    if(n.mane){
      // Mane strip along the crest edge.
      ctx.beginPath();
      ctx.moveTo(r.x+nx*n.rootWidth/2,r.y+ny*n.rootWidth/2);ctx.lineTo(tip.x+nx*n.tipWidth/2,tip.y+ny*n.tipWidth/2);
      ctx.lineTo(tip.x+nx*(n.tipWidth/2-n.mane),tip.y+ny*(n.tipWidth/2-n.mane));
      ctx.lineTo(r.x+nx*(n.rootWidth/2-n.mane),r.y+ny*(n.rootWidth/2-n.mane));ctx.closePath();
      ctx.fillStyle=c.mane;ctx.fill();ctx.strokeStyle=c.headLine;ctx.stroke();
    }
  }
  function drawHeadArt(ctx,sp,c,lw,size,strokes=true){
    if(sp.horn){ctx.save();ctx.translate(sp.farHorn.x,sp.farHorn.y);fillStroke(ctx,sp.horn,c.hornFar,c.hornLine,lw);ctx.restore()}
    if(strokes)for(const s of sp.headStrokes||[])if(s.far)drawStroke(ctx,s,c,lw);
    fillStroke(ctx,sp.head,c.head,c.headLine,lw);
    if(sp.beard)fillStroke(ctx,sp.beard,c.beard,c.headLine,lw);
    for(const part of sp.headParts||[])fillStroke(ctx,part.d,c[part.fill],c.headLine,lw);
    if(sp.horn)fillStroke(ctx,sp.horn,c.horn,c.hornLine,lw);
    if(strokes)for(const s of sp.headStrokes||[])if(!s.far)drawStroke(ctx,s,c,lw);
    if(size>=24){ctx.fillStyle=c.eye;ctx.beginPath();ctx.arc(sp.eye.x,sp.eye.y,4.5,0,Math.PI*2);ctx.fill()}
  }
  // Branching parts (antlers) as outlined round-capped polylines.
  function drawStroke(ctx,s,c,lw){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const [color,width] of [[c.headLine,s.width+lw*2],[c[s.color],s.width]]){
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
      for(const line of s.lines){ctx.moveTo(line[0][0],line[0][1]);for(const [px,py] of line.slice(1))ctx.lineTo(px,py)}
      ctx.stroke();
    }
    ctx.restore();
  }
  // Sleeping art: a curled body that breathes slowly.
  function drawSleeping(ctx,sp,c,lw,t,size){
    const z=sp.sleep,breath=1+Math.sin(t*1.4)*.025;
    ctx.translate(sp.center.x,sp.center.y);ctx.scale(1,breath);ctx.translate(-sp.center.x,-sp.center.y);
    fillStroke(ctx,z.body,c.body,c.line,lw);
    for(const part of z.parts)fillStroke(ctx,part.d,c[part.fill],c.line,lw);
    if(size>=24&&z.eye){ctx.strokeStyle=c.line;ctx.lineWidth=lw*1.4;ctx.lineCap='round';ctx.beginPath();
      ctx.moveTo(z.eye[0][0],z.eye[0][1]);ctx.lineTo(z.eye[1][0],z.eye[1][1]);ctx.stroke()}
  }
  // Half-plane on one side of the throat line (head side or neck side).
  const jointCache=new Map();
  function jointSide(sp,head){
    const key=sp.joint.a.x+','+sp.joint.a.y+','+head;let p=jointCache.get(key);if(p)return p;
    const {a,b}=sp.joint,len=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/len,dy=(b.y-a.y)/len;
    let nx=-dy,ny=dx;
    if((sp.pivot.x-a.x)*nx+(sp.pivot.y-a.y)*ny>0){nx=-nx;ny=-ny}
    if(!head){nx=-nx;ny=-ny}
    const shift=0,F=600,ax=a.x+nx*shift,ay=a.y+ny*shift,bx=b.x+nx*shift,by=b.y+ny*shift;
    p=new Path2D();
    p.moveTo(ax-dx*F,ay-dy*F);p.lineTo(bx+dx*F,by+dy*F);
    p.lineTo(bx+dx*F+nx*F,by+dy*F+ny*F);p.lineTo(ax-dx*F+nx*F,ay-dy*F+ny*F);p.closePath();
    jointCache.set(key,p);return p;
  }
  const drawSheep=(ctx,x,y,size,opts)=>drawAnimal('sheep',ctx,x,y,size,opts);
  const drawGoat=(ctx,x,y,size,opts)=>drawAnimal('goat',ctx,x,y,size,opts);
  const drawCow=(ctx,x,y,size,opts)=>drawAnimal('cow',ctx,x,y,size,opts);
  const drawHorse=(ctx,x,y,size,opts)=>drawAnimal('horse',ctx,x,y,size,opts);
  window.ConquerAnimals={SPECIES,SHEEP:SPECIES.sheep,HEAD:SPECIES.sheep.pose,COLORS:SPECIES.sheep.colors,
    gaitPose,sheepPose:gaitPose,blendedPose:(t,seed,blend)=>blendedPose('sheep',t,seed,blend),blendedPoseOf:blendedPose,
    modePose,transitionPose,
    drawAnimal,drawSheep,drawGoat,drawCow,drawHorse};
})();
