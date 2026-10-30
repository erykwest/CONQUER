'use strict';
(() => {
  const M=window.ConquerMarch;
  if(!M)throw new Error('ConquerMarch engine not loaded');
  const $=id=>document.getElementById(id);
  let state=M.load(window.localStorage);
  let destination=null;
  let message='';
  const fiefPosition=f=>({x:f.x,y:f.y});
  const phrase={approach:'Alle porte del feudo',raiding:'Razzia compiuta · puoi ripartire',siege:'Assedio in corso',breached:'Difese espugnate · annessione facoltativa'};
  function currentSelection(){
    return state.fiefs.find(f=>f.id===state.selected)||null;
  }
  function selectedPoint(){
    return destination||fiefPosition(currentSelection()||state.company);
  }
  function setText(id,value){$(id).textContent=String(value);}
  function act(fn){
    const result=fn();
    message=result===false?'Ordine non disponibile nello stato corrente.':'';
    M.save(state,window.localStorage);
    render();return result;
  }
  function render(){
    const c=state.company,selected=currentSelection(),op=state.operation,target=M.currentTarget(state);
    setText('day',state.day);
    setText('troops',Object.values(c.troops).reduce((a,b)=>a+b,0));
    setText('food',c.food);
    setText('cargo',M.cargoUsed(state)+'/'+c.capacity);
    setText('armyDetails','Compagnia · '+c.troops.spearmen+' lancieri · '+c.troops.archers+' arcieri · '+c.troops.knights+' cavalieri · Morale '+c.morale+'% · Bottino: cibo '+c.cargo.food+', legno '+c.cargo.wood+', oro '+c.cargo.gold);
    const map=$('map');map.replaceChildren();
    const goal=selectedPoint();
    for(let y=0;y<M.HEIGHT;y++)for(let x=0;x<M.WIDTH;x++){
      const f=M.fiefAt(state,x,y),water=!M.traversable(x,y);
      const tile=document.createElement('button');
      tile.type='button';
      tile.className='tile '+(water?'water':x===4&&y===3?'bridge':(x+y*3)%5===0?'forest':'plains');
      if(f)tile.classList.add(f.owner);
      if(c.route.some(p=>p.x===x&&p.y===y))tile.classList.add('route');
      if(x===goal.x&&y===goal.y)tile.classList.add('selected');
      tile.disabled=water;tile.setAttribute('aria-label',f?f.name+', '+(f.owner==='player'?'alleato':'nemico'):'Terreno '+x+','+y);
      tile.setAttribute('aria-pressed',String(x===goal.x&&y===goal.y));
      const symbol=document.createElement('span');symbol.className='mark';symbol.textContent=f?(f.owner==='player'?'♜':'♜'):water?'≈':x===4&&y===3?'═':' ';
      tile.appendChild(symbol);
      if(f){const label=document.createElement('span');label.className='spot';label.textContent=f.name;tile.appendChild(label);}
      if(c.x===x&&c.y===y){const army=document.createElement('span');army.className='army';army.textContent='♞';army.setAttribute('aria-label','Posizione compagnia');tile.appendChild(army);}
      if(c.route.some(p=>p.x===x&&p.y===y)){const foot=document.createElement('span');foot.className='foot';foot.textContent='•';tile.appendChild(foot);}
      tile.addEventListener('click',()=>{destination={x,y};if(f)M.select(state,f.id);M.save(state,window.localStorage);render();});
      map.appendChild(tile);
    }
    setText('targetTitle',selected?selected.name:'Feudo selezionato');
    const detail=selected
      ? selected.name+' · '+(selected.owner==='player'?'Alleato':'Nemico')+
        '\nGuarnigione dichiarata: '+selected.garrison+
        '\nScorte: cibo '+selected.stock.food+', legno '+selected.stock.wood+', oro '+selected.stock.gold+
        '\nDanni persistenti: civili '+selected.damage.civil+'%, fortificazioni '+selected.damage.fort+'%'
      : 'Nessun feudo selezionato';
    $('fiefDetails').textContent=detail;
    $('fiefDetails').style.whiteSpace='pre-line';
    const travel=c.route.length?'In marcia · '+c.route.length+' tappe residue.':
      op?(phrase[op.phase]||op.phase)+' · '+(target?.name||'')+(op.phase==='siege'?' · '+op.days+' giorni':''):
      'Compagnia in '+c.x+','+c.y+'. Seleziona una cella e ordina la marcia.';
    setText('status',message||travel);
    const canAct=!!op&&!!target&&target.owner==='enemy';
    $('march').disabled=!!op||!M.traversable(goal.x,goal.y);
    $('resupply').disabled=!M.atFief(state)||M.atFief(state).owner!=='player'||c.food>=64;
    $('raid').disabled=!canAct||c.morale===0;
    $('siege').disabled=!canAct||!['approach','raiding'].includes(op.phase);
    $('testVictory').disabled=!canAct||op.phase!=='siege'||op.days<1;
    $('conquer').disabled=!canAct||!op.breached;
    $('withdraw').disabled=!op;
    $('advance').disabled=c.morale===0;
    $('advance5').disabled=c.morale===0;
    const log=$('log');log.replaceChildren();
    for(const entry of state.log.slice(0,14)){
      const li=document.createElement('li');li.textContent=entry;log.appendChild(li);
    }
  }
  $('march').addEventListener('click',()=>act(()=>M.march(state,selectedPoint().x,selectedPoint().y)));
  $('advance').addEventListener('click',()=>act(()=>M.advance(state,1)));
  $('advance5').addEventListener('click',()=>act(()=>M.advance(state,5)));
  $('raid').addEventListener('click',()=>act(()=>M.raid(state)));
  $('siege').addEventListener('click',()=>act(()=>M.besiege(state)));
  $('testVictory').addEventListener('click',()=>act(()=>M.reportAssaultVictory(state)));
  $('conquer').addEventListener('click',()=>act(()=>M.conquer(state)));
  $('withdraw').addEventListener('click',()=>act(()=>M.withdraw(state)));
  $('resupply').addEventListener('click',()=>act(()=>M.resupply(state)));
  $('reset').addEventListener('click',()=>{
    if(!window.confirm('Reimpostare soltanto lo scenario di prova MARCH?'))return;
    state=M.initial();destination=null;message='Scenario di prova reimpostato.';
    M.save(state,window.localStorage);render();
  });
  render();
})();
