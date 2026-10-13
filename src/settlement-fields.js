'use strict';
// Four-corner cells, cached boustrophedon routes and persistent crop work.
const FIELD_RULES=Object.freeze({minSide:1,maxSide:6,rowSpacing:.5,areaPerWorker:4,
  ploughRate:1,sowRate:3,harvestRate:3,growthDays:7,cropHeight:.1});
const fieldLayoutCache=new WeakMap();
function fieldQuadValid(poly){
  return poly?.length===4&&Math.abs(urbanArea(poly))>=4-1e-7&&poly.every((p,i)=>{
    const edge=dist(p,poly[(i+1)%4]);
    return Number.isFinite(p.x)&&Number.isFinite(p.y)&&edge>=1-1e-7&&edge<=6+1e-7;
  })&&poly.every(p=>urbanContains(poly,p));
}
function fieldQuadFromCell(cell,site){
  let best=null,area=0;
  for(let a=0;a<cell.length-3;a++)for(let b=a+1;b<cell.length-2;b++)
    for(let c=b+1;c<cell.length-1;c++)for(let d=c+1;d<cell.length;d++){
      const quad=[cell[a],cell[b],cell[c],cell[d]],size=Math.abs(urbanArea(quad));
      if(size>area&&fieldQuadValid(quad)&&urbanContains(quad,site)){best=quad;area=size}
    }
  return best;
}
function fieldVoronoiQuad(field,rnd,limit=null){
  const site={x:field.x,y:field.y},angle=field.angle||0;
  for(let attempt=0;attempt<16;attempt++){
    let cell=limit?limit.slice():rectWorldPoints(site.x,site.y,9,9,angle);
    // Four nearby virtual sites bound an otherwise unbounded rural cell.
    for(let i=0;i<4;i++){
      const a=angle+i*Math.PI/2+(rnd()-.5)*(limit?.08:.45);
      const r=limit?(i%2?(field.h||2):(field.w||3))*(.92+rnd()*.06):3.5+rnd()*3.5;
      const other={x:site.x+Math.cos(a)*r,y:site.y+Math.sin(a)*r};
      cell=urbanClip(cell,other.x-site.x,other.y-site.y,
        (other.x*other.x+other.y*other.y-site.x*site.x-site.y*site.y)/2);
    }
    for(const other of State.structures){
      if(other.type!=='field'||other.id===field.id||dist(site,other)>18)continue;
      const nx=other.x-site.x,ny=other.y-site.y;
      cell=urbanClip(cell,nx,ny,(other.x*other.x+other.y*other.y-site.x*site.x-site.y*site.y)/2);
    }
    const quad=fieldQuadFromCell(cell,site);if(quad)return quad;
  }
  return null;
}
function fieldPoints(field){
  if(field.points?.length===4)return field.points;
  const original=rectWorldPoints(field.x,field.y,field.w||3,field.h||2,field.angle||0);
  const rnd=seedRand((State.seed^biomeHash(field.id||'field'))>>>0);
  // Migration is inscribed in the old footprint: it cannot steal adjacent lots.
  field.points=fieldVoronoiQuad(field,rnd,original)||original;
  field.fieldVersion=1;
  return field.points;
}
function fieldAllowed(field){
  const poly=fieldPoints(field);
  if(!fieldQuadValid(poly)||!urbanParcelAllowed(poly,field.id))return false;
  if(urbanLots().some(lot=>urbanPolygonsOverlap(poly,lot.points)))return false;
  if(urbanLotUnitConflict({points:poly}))return false;
  for(const s of State.structures){
    if(s.id===field.id)continue;
    if(s.type==='field'&&urbanPolygonsOverlap(poly,fieldPoints(s)))return false;
    if(s.type==='road'&&roadTouchesPolygon(s,poly,.12))return false;
  }
  const minX=Math.min(...poly.map(p=>p.x)),maxX=Math.max(...poly.map(p=>p.x));
  const minY=Math.min(...poly.map(p=>p.y)),maxY=Math.max(...poly.map(p=>p.y));
  for(let x=minX;x<=maxX+.01;x+=.4)for(let y=minY;y<=maxY+.01;y+=.4){
    const p={x,y};if(urbanContains(poly,p)&&environmentBlocksPoint(p,'settlement'))return false;
  }
  return poly.every(p=>!environmentBlocksPoint(p,'settlement'));
}
function fieldLayout(field){
  const poly=fieldPoints(field);if(fieldLayoutCache.has(poly))return fieldLayoutCache.get(poly);
  let longest=0;
  for(let i=1;i<4;i++)if(dist(poly[i],poly[(i+1)%4])>dist(poly[longest],poly[(longest+1)%4]))longest=i;
  const a=poly[longest],b=poly[(longest+1)%4],L=dist(a,b);
  const ux=(b.x-a.x)/L,uy=(b.y-a.y)/L,vx=-uy,vy=ux;
  const dot=(p,x,y)=>p.x*x+p.y*y,vs=poly.map(p=>dot(p,vx,vy));
  const minV=Math.min(...vs),maxV=Math.max(...vs),rows=[],segments=[];
  let total=0,last=null;
  const append=(a,b,row)=>{const length=dist(a,b);if(length>1e-7){segments.push({a,b,row,start:total,end:total+length,length});total+=length}};
  for(let v=minV+.25;v<maxV;v+=FIELD_RULES.rowSpacing){
    const hits=[];
    for(let i=0;i<4;i++){
      const p=poly[i],q=poly[(i+1)%4],pv=dot(p,vx,vy),qv=dot(q,vx,vy);
      if((pv<=v&&qv>v)||(qv<=v&&pv>v)){
        const t=(v-pv)/(qv-pv);hits.push(dot({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t},ux,uy));
      }
    }
    if(hits.length<2)continue;
    // Leave a visible margin inside the parcel for hedges, walls and fences.
    // Crop paths must never reach the parcel boundary.
    const lo=Math.min(...hits)+.28,hi=Math.max(...hits)-.28;if(hi<=lo)continue;
    const world=u=>({x:u*ux+v*vx,y:u*uy+v*vy});
    const row=rows.length,forward=row%2===0,ra=world(forward?lo:hi),rb=world(forward?hi:lo);
    if(last)append(last,ra,-1);
    append(ra,rb,row);rows.push({v,lo,hi,a:ra,b:rb,forward,segment:segments.at(-1)});last=rb;
  }
  const slots=Math.floor((Math.abs(urbanArea(poly))+1e-7)/FIELD_RULES.areaPerWorker),cells=[];
  const at=d=>{const s=segments.find(s=>d<=s.end)||segments.at(-1);if(!s)return{x:field.x,y:field.y};const t=clamp((d-s.start)/s.length,0,1);return{x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t}};
  for(let i=0;i<slots;i++)cells.push({index:i,start:total*i/slots,end:total*(i+1)/slots,world:at(total*i/slots)});
  const layout={poly,area:Math.abs(urbanArea(poly)),ux,uy,vx,vy,minV,maxV,rows,segments,total,cells,at};
  fieldLayoutCache.set(poly,layout);return layout;
}
function fieldCrop(field){
  const n=fieldLayout(field).cells.length;
  if(!field.crop||!['plough','sow','grow','harvest'].includes(field.crop.phase)){
    field.crop={version:1,phase:'plough',work:Array(n).fill(0),growth:0,cycles:0,lastDay:State.clock.day};
  }
  const crop=field.crop;
  if(crop.work?.length!==n)crop.work=Array(n).fill(0);
  if(!Number.isFinite(crop.lastDay))crop.lastDay=State.clock.day;
  return crop;
}
function fieldSlotDone(field,cell){return (fieldCrop(field).work[cell.index]||0)>=cell.end-cell.start-1e-7}
function fieldWorkClock(day){const whole=Math.floor(day);return whole+clamp((day-whole-.14)/.38,0,1)}
// Months are zero based (Jan=0). Farming advances only in the specified seasons.
function fieldSeasonPhase(month){
  if(month===9||month===10)return 'plough'; // October–November
  if(month===2||month===3)return 'sow';      // March–April
  if(month===6||month===7)return 'harvest';  // July–August
  return null;
}
function fieldCropReady(field,day=State.clock.day){
  const crop=fieldCrop(field),month=calendarDateFromDay(day).month;
  if(crop.ploughed&&crop.phase==='plough'||crop.harvested&&crop.phase==='harvest')return false;
  return crop.phase===fieldSeasonPhase(month)&&crop.work.some((done,i)=>{
    const cell=fieldLayout(field).cells[i];
    return cell&&done<cell.end-cell.start-1e-7;
  });
}
function tickFields(day=State.clock.day){
  const fields=completedSettlement('field');if(!fields.length)return;
  const houses=completedSettlement('house').filter(h=>houseLevel(h)===1);
  const month=calendarDateFromDay(day).month,season=fieldSeasonPhase(month);
  // Prepare all crop states before assigning workers so a completed field
  // immediately releases its workforce to any other available parcel.
  for(const field of fields){
    const crop=fieldCrop(field);
    const year=calendarDateFromDay(day).year;
    if(crop.seasonYear==null)crop.seasonYear=year;
    if(season==='plough'&&crop.phase==='plough'&&crop.seasonYear!==year){
      crop.work.fill(0);crop.seasonYear=year;
    }
    if(crop.phase==='grow'){
      // Sown fields develop through the spring; they mature for July harvest.
      crop.growth=clamp((day-(crop.sownDay??day))/(Math.max(1,(year-1)*365+181-CALENDAR_EPOCH_DAY_OF_YEAR-(crop.sownDay??day))),0,1);
      if(season==='harvest'){
        crop.phase='harvest';crop.growth=1;crop.work.fill(0);
      }
    }
    // A finished July/August harvest waits until October to plough again.
    if(season==='plough'&&crop.phase==='harvest'&&crop.harvested){
      crop.phase='plough';crop.work.fill(0);crop.harvested=false;crop.growth=0;
    }
    if(crop.phase==='plough'&&season==='sow'&&crop.ploughed){
      crop.phase='sow';crop.work.fill(0);
    }
  }
  const assignments=fieldWorkAssignments(houses,fields),alarm=window.ConquerCombat?.alarmMode?.()||'off';
  for(const field of fields){
    const crop=fieldCrop(field),layout=fieldLayout(field),before=crop.lastDay;
    const elapsed=Math.max(0,day-before),work=Math.max(0,fieldWorkClock(day)-fieldWorkClock(before));
    crop.lastDay=day;
    if(!elapsed)continue;
    if(crop.phase==='grow')continue;
    if(!season||crop.phase!==season||crop.ploughed&&season==='plough'||crop.harvested&&season==='harvest')continue;
    if(alarm!=='off'||!work)continue;
    const rate=season==='plough'?FIELD_RULES.ploughRate:season==='sow'?FIELD_RULES.sowRate:FIELD_RULES.harvestRate;
    let worked=false;
    for(const assignment of assignments.values())if(assignment.field.id===field.id){
      const cell=assignment.cell,route=peasantPath(assignment.house,assignment);
      if(!route?.length||dist(route.at(-1),cell.world)>.05)continue;
      crop.work[cell.index]=Math.min(cell.end-cell.start,(crop.work[cell.index]||0)+work*rate);
      worked=true;
    }
    if(worked)State.dirty=true;
    if(layout.cells.length&&layout.cells.every(cell=>fieldSlotDone(field,cell))){
      if(season==='plough'){crop.ploughed=true;crop.work.fill(0)}
      else if(season==='sow'){crop.phase='grow';crop.sownDay=day;crop.growth=0;crop.ploughed=false;crop.work.fill(0)}
      else{crop.harvested=true;crop.cycles++;crop.work.fill(0)}
      State.dirty=true;
      fieldWorkAssignmentCache.key=null;
    }
  }
}
function fieldWorkerPosition(field,cell){
  const crop=fieldCrop(field);
  return fieldLayout(field).at(cell.start+Math.min(crop.work[cell.index]||0,cell.end-cell.start));
}
function fieldWorkerRoute(field,cell){
  const layout=fieldLayout(field),end=cell.start+Math.min(fieldCrop(field).work[cell.index]||0,cell.end-cell.start);
  const points=[cell.world];
  for(const segment of layout.segments)if(segment.end>cell.start&&segment.end<end)points.push(segment.b);
  points.push(layout.at(end));return points;
}
function fieldDoneIntervals(field,segment){
  const crop=fieldCrop(field),layout=fieldLayout(field),out=[];
  for(const cell of layout.cells){
    const start=Math.max(cell.start,segment.start),end=Math.min(cell.start+(crop.work[cell.index]||0),segment.end);
    if(end>start)out.push([(start-segment.start)/segment.length,(end-segment.start)/segment.length]);
  }
  return out;
}
function drawFieldGround(field){
  pathPolygon(projectPath(fieldPoints(field)),State.season==='winter'?'#edf1ed':'#76603e','rgba(160,139,91,.65)',.8);
}
function fieldStrip(layout,row,t0,t1){
  let poly=urbanClip(layout.poly,layout.vx,layout.vy,row===layout.rows.at(-1)?layout.maxV:Math.min(layout.maxV,row.v+.25));
  poly=urbanClip(poly,-layout.vx,-layout.vy,-(row===layout.rows[0]?layout.minV:Math.max(layout.minV,row.v-.25)));
  const u0=row.lo+(row.hi-row.lo)*(row.forward?t0:1-t1),u1=row.lo+(row.hi-row.lo)*(row.forward?t1:1-t0);
  if(row.forward?t1<1:t0>0)poly=urbanClip(poly,layout.ux,layout.uy,u1);
  if(row.forward?t0>0:t1<1)poly=urbanClip(poly,-layout.ux,-layout.uy,-u0);
  return poly;
}
function drawFieldWork(field){
  const layout=fieldLayout(field),crop=fieldCrop(field);
  ctx.save();ctx.lineWidth=Math.max(.6,.075*U*State.view.scale);
  for(const row of layout.rows){
    const intervals=crop.phase==='plough'&&!crop.ploughed?fieldDoneIntervals(field,row.segment):[[0,1]];
    ctx.strokeStyle='#4b3020';
    for(const [t0,t1] of intervals){
      const at=t=>({x:row.a.x+(row.b.x-row.a.x)*t,y:row.a.y+(row.b.y-row.a.y)*t});
      const a=w2s(at(t0),.015),b=w2s(at(t1),.015);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    if(crop.phase==='sow'){
      ctx.fillStyle='#bfb183';
      for(const [t0,t1] of fieldDoneIntervals(field,row.segment))for(let t=t0+.035;t<t1;t+=.25/row.segment.length){
        const p=w2s({x:row.a.x+(row.b.x-row.a.x)*t,y:row.a.y+(row.b.y-row.a.y)*t},.025);
        ctx.fillRect(p.x-.7,p.y-.7,1.4,1.4);
      }
    }
    if(crop.phase==='harvest'&&!crop.harvested){
      let cursor=0;
      for(const [a,b] of [...fieldDoneIntervals(field,row.segment),[1,1]]){
        if(a>cursor+1e-7)drawFieldCropPolygon(fieldStrip(layout,row,cursor,a),1);
        cursor=Math.max(cursor,b);
      }
    }
  }
  if(crop.phase==='grow'&&crop.growth>0){
    const poly=urbanClip(layout.poly,layout.vx,layout.vy,layout.minV+(layout.maxV-layout.minV)*crop.growth);
    drawFieldCropPolygon(poly,crop.growth);
  }
  ctx.restore();
}
function drawFieldCropPolygon(poly,growth){
  if(poly.length<3)return;
  const ground=terrainElevation(poly[0]),top=FIELD_RULES.cropHeight;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    pathPolygon([w2sRaw(a,ground),w2sRaw(b,ground),w2sRaw(b,ground+top),w2sRaw(a,ground+top)],'#73733b',null);
  }
  pathPolygon(poly.map(p=>w2sRaw(p,ground+top)),growth<.8?'#729344':'#b6a24d','rgba(77,92,40,.5)',.5);
}
