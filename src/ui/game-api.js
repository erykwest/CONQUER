'use strict';
// CONQUER game API — the boundary between the game and the new interface (ui2).
// The UI reads state only through snapshot()/subscribe() and acts only through commands.
// Phase 1: commands delegate to the existing handlers (legacy buttons and functions);
// later phases move that logic here without changing what the UI calls.
(() => {
  const listeners = new Set();
  let queued = false;
  function emit() {
    if (queued) return;
    queued = true;
    // One snapshot per burst of synchronous changes (a click often triggers several).
    queueMicrotask(() => {
      queued = false;
      const snap = snapshot();
      for (const fn of listeners) fn(snap);
    });
  }
  function subscribe(fn) {
    listeners.add(fn);
    fn(snapshot());
    return () => listeners.delete(fn);
  }

  // Re-emit after every global entry point that changes something the UI shows.
  // Classic-script function declarations are global properties, so callers that
  // resolve them by name (legacy buttons, keyboard, simulation loop) get the wrapper.
  for (const name of ['renderUI', 'setTool', 'selectStructure', 'setTimeSpeed', 'rotateCamera', 'togglePlanView', 'renderFunctionPanel', 'markDirty']) {
    const original = window[name];
    if (typeof original !== 'function') continue;
    window[name] = function (...args) {
      const out = original.apply(this, args);
      emit();
      return out;
    };
  }
  // status() and the save indicator are plain text writes: watch their nodes.
  const watch = id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(emit).observe(el, { childList: true, characterData: true, subtree: true });
  };
  watch('status');
  watch('saveState');

  const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  function clock() {
    const cal = calendarDateFromDay(State.clock.day);
    const weekday = window.ConquerEconomy?.weekday(State.clock.day) ?? 0;
    return {
      day: State.clock.day,
      speed: State.clock.speed,
      weekday: WEEKDAYS[weekday] || '',
      date: cal.day + ' ' + MONTHS[cal.month],
      year: cal.year,
      season: State.season
    };
  }
  function tool() {
    const t = State.tool || {};
    return {
      kind: t.kind || 'select',
      material: t.material || null,
      shape: t.shape || null,
      size: t.size ?? null,
      woodStyle: t.woodStyle || null,
      linear: t.linear || null,
      span: t.span || null,
      crossing: t.crossing || null,
      slopeway: t.slopeway || null,
      width: t.width ?? null,
      civic: t.placementSpec?.type && t.kind === 'civic' ? t.placementSpec.type : null,
      industry: t.industry || null,
      extraction: t.placementSpec?.extractionMode || null,
      reach: t.placementSpec?.reach || null,
      venue: t.kind === 'event' ? t.venue || null : null,
      mode: t.mode || null,
      radius: t.radius ?? null,
      delta: t.delta ?? null,
      combatBrush: t.combatBrush || null,
      stormKind: t.stormKind || null,
      fireKind: t.fireKind || null,
      torch: !!t.torch,
      label: t.label || ''
    };
  }
  function selection() {
    const s = typeof selectedStructure === 'function' ? selectedStructure() : null;
    if (!s) return null;
    let detail = null;
    try { detail = StructureCommands.describeStructure(s.id); } catch (err) { console.warn('inspect failed', err); }
    return { id: s.id, type: s.type, detail };
  }
  function snapshot() {
    return {
      resources: { ...State.resources },
      clock: clock(),
      view: { rotation: State.view.rotation || 0, plan: typeof isPlanView === 'function' && isPlanView() },
      tool: tool(),
      levels: { ...State.buildLevels },
      crossingWidth: Number(findLegacy('[data-crossing-width].active')?.dataset.crossingWidth) || 2,
      terraform: {
        shape: findLegacy('[data-terraform-shape].active')?.dataset.terraformShape || 'round',
        delta: Number(findLegacy('[data-terraform-delta].active')?.dataset.terraformDelta) || 1,
        radius: Number(findLegacy('[data-terraform-radius].active')?.dataset.terraformRadius) || 4
      },
      masonry: State.buildMasonryMaterial === 'brick' ? 'brick' : 'stone',
      privateMasonry: findLegacy('[data-private-masonry].active')?.dataset.privateMasonry || 'stone',
      selection: selection(),
      village: State.village?.name || null,
      status: document.getElementById('status')?.textContent || '',
      saved: document.getElementById('saveState')?.textContent || ''
    };
  }

  // Legacy controls are still the source of truth for tool parameters in phase 1.
  // This script loads before settlement-builder-ux.js, which detaches the buttons of
  // closed palette groups: keep references so they stay reachable (handlers still fire).
  const legacyButtons = [...document.querySelectorAll('button')];
  const findLegacy = selector => document.querySelector(selector) || legacyButtons.find(b => b.matches(selector)) || null;
  function press(selector) {
    const el = findLegacy(selector);
    if (!el) return false;
    el.click();
    emit();
    return true;
  }
  const commands = {
    press,
    setSpeed: speed => setTimeSpeed(speed),
    togglePause: () => togglePause(),
    rotate: delta => rotateCamera(delta),
    togglePlan: () => togglePlanView(),
    undo: () => press('#undoBtn'),
    deselect: () => { State.selectedId = null; renderFunctionPanel(); draw(); emit(); },
    // Structure commands: (command name, structure id, ...args) → see settlement-structure-commands.js.
    structure: (name, id, ...args) => {
      const fn = StructureCommands[name];
      if (typeof fn !== 'function' || name === 'describeStructure') return false;
      const out = fn(id, ...args);
      emit();
      return out;
    },
    demolish: id => { deleteStructure(id); emit(); },
    select: id => { selectStructure(State.structures.find(s => s.id === id) || null); emit(); },
    openProfile: () => press('#profileBtn'),
    toggleDev: () => press('#devToggle'),

    // ---- Gestisci ----
    setPolicy: (key, value) => {
      if (key === 'rations') { const ok = window.ConquerEconomy?.setRations(value); if (ok) scheduleLocalSave(200); return !!ok; }
      if (!['tax', 'levy'].includes(key)) return false;
      State.policies[key] = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      const slider = document.getElementById(key);
      if (slider) slider.value = State.policies[key];
      markDirty(false, false, true);
      return true;
    },
    crenelQuote: style => crenelRestyleQuote(style),
    setCrenelStyle: style => { const out = applyCrenelStyle(style); emit(); return out; },
    roofPitchQuote: pitch => roofPitchQuote(Number(pitch)),
    setRoofPitch: pitch => { const out = applyRoofPitch(pitch); emit(); return out; },
    setSaleShare:(good, pct) => { const ok = window.ConquerEconomy?.setShare(good, pct); scheduleLocalSave(200); emit(); return ok; },
    setReserve: (good, qty) => { const ok = window.ConquerEconomy?.setTarget(good, qty); scheduleLocalSave(200); emit(); return ok; },
    // SCOL-01: the lord hires a lay scolarizzato (castle gold, arrives after two weeks).
    hireEducated: () => {
      const out=window.ConquerEducated?.hire?.()||{ok:false,reason:'economy'};
      if(out.ok){scheduleLocalSave(200);emit();}
      return out;
    },
    // L1 Job Manager: commands only; the economy remains the allocator and save owner.
    setL1Minimum: (key, minimum) => {
      const ok=window.ConquerEconomy?.setL1Minimum?.(key,minimum);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    setL1Auto: (key, enabled) => {
      const ok=window.ConquerEconomy?.setL1Auto?.(key,enabled);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    setL1Order: order => {
      const ok=window.ConquerEconomy?.setL1Order?.(order);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    setL2Minimum: (key, minimum) => {
      const ok=window.ConquerEconomy?.setL2Minimum?.(key,minimum);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    setL2Auto: (key, enabled) => {
      const ok=window.ConquerEconomy?.setL2Auto?.(key,enabled);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    setL2Order: order => {
      const ok=window.ConquerEconomy?.setL2Order?.(order);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    adjustPatrols: delta => {
      if(!State.village?.founded||!window.ConquerCombat?.units)return false;
      const before=window.ConquerCombat.units().filter(u=>u.kind==='patrol').length;
      const ok=press(delta>0?'#combatPatrolAdd':'#combatPatrolRemove');
      const after=window.ConquerCombat.units().filter(u=>u.kind==='patrol').length;
      if(ok&&after!==before)emit();
      return ok&&after!==before;
    },
    adjustTowerArchers: (id, delta) => {
      const ok=window.ConquerSiege?.changeArchers?.(id,delta);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    assignCirclePatrol: (sectorId,delta) => {
      const ok=window.ConquerCombat?.assignCirclePatrol?.(sectorId,delta);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    adjustMacroArchers: (id,delta) => {
      const ok=adjustMacroArchers(id,delta);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    adjustZoneArchers: (id,delta) => {
      const ok=adjustZoneArchers(id,delta);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    adjustMacroSquads: (id,delta) => {
      const ok=adjustMacroSquads(id,delta);
      if(ok){scheduleLocalSave(200);emit();}
      return !!ok;
    },
    adjustBarracksSquads: (id, delta) => {
      const camp=window.ConquerCamp,roster=window.ConquerCombat?.units;
      if(!camp||!roster||!camp.barracks?.().some(b=>b.id===id))return false;
      const before=roster().filter(u=>u.kind==='squad'&&u.barracksId===id&&!u.defeated).length;
      if(delta>0)camp.addSquad(id);else camp.removeSquad(id);
      const after=roster().filter(u=>u.kind==='squad'&&u.barracksId===id&&!u.defeated).length;
      if(after!==before){scheduleLocalSave(200);emit();}
      return after!==before;
    },
    transferActivity: (id, owner) => {
      const ok = window.ConquerEconomy?.transfer(id, owner);
      if (!ok) status('Insufficient economic capital for enterprise transfer');
      else scheduleLocalSave(200);
      emit();
      return ok;
    },
    storeInCastle: good => {
      const out = window.ConquerSiege?.transfer(good);
      if (!out) return false;
      status(out.accepted ? 'Stored ' + out.accepted + ' ' + good : out.reason);
      emit();
      return !!out.accepted;
    },
    saveCloud: () => press('#saveBtn'),
    openCaravans: () => { window.ConquerDiplomacy?.openCaravans(); emit(); },
    recruitKnight: () => { const ok = !!window.ConquerCombat?.recruitKnight?.(); emit(); return ok; },

    // ---- Difendi: the combat module's own controls stay the single implementation ----
    defense: (action, arg) => {
      const ids = { fog: '#combatFog', zones: '#combatZones', bell: '#combatRecall', release: '#combatMute',
        orders: '#combatOrders', deselect: '#combatDeselect', patrolAdd: '#combatPatrolAdd', patrolRemove: '#combatPatrolRemove',
        intruder: '#combatIntruder', torch: '#combatTorch', clearEnemies: '#combatClearEnemies', buckets: '#combatBuckets' };
      if (action === 'brush') return press('[data-combat-brush="' + arg + '"]');
      if (action === 'fire') return press('[data-combat-fire="' + arg + '"]');
      if (action === 'storm') return press('[data-combat-storm="' + arg + '"]');
      if (action === 'alarm') { window.ConquerCombat?.setAlarmMode?.(arg); emit(); return true; }
      if (action === 'brushRadius') {
        const el = document.getElementById('combatBrushSize');
        if (!el) return false;
        el.value = arg; el.dispatchEvent(new Event('input', { bubbles: true })); emit(); return true;
      }
      return ids[action] ? press(ids[action]) : false;
    }
  };

  // CIRCLE supplies the zone identity. A tower's parentTowerId forms the
  // authoritative macro-structure; never count its subtowers as separate rows.
  function militaryCircleRoster(){
    const combat=window.ConquerCombat,siege=window.ConquerSiege,
      camp=window.ConquerCamp,circle=window.ConquerCircle;
    const allies=combat?.units?.()||[];
    const circleReady=!!circle?.getStatus?.().ready;
    const compartments=circleReady?(circle?.getSnapshot?.()?.compartments||[]):[];
    const zoneIds=new Set(compartments.map(z=>z.id));
    const towers=(State.structures||[]).filter(s=>s.type==='tower'&&!s.destroyed&&
      !(typeof underConstruction==='function'&&underConstruction(s)));
    const byId=new Map(towers.map(s=>[String(s.id),s]));
    const rootOf=s=>{
      let at=s;
      const seen=new Set([String(s.id)]);
      while(at.parentTowerId&&byId.has(String(at.parentTowerId))&&!seen.has(String(at.parentTowerId))){
        at=byId.get(String(at.parentTowerId));seen.add(String(at.id));
      }
      return at;
    };
    const roots=new Map();
    for(const tower of towers){
      const root=rootOf(tower),key=String(root.id);
      if(!roots.has(key))roots.set(key,{id:key,root,members:[]});
      roots.get(key).members.push(tower);
    }
    const campRooms=camp?.barracks?.()||[];
    const macros=[...roots.values()].map(group=>{
      const ordered=group.members.sort((a,b)=>a.id===group.id?-1:b.id===group.id?1:
        String(a.id).localeCompare(String(b.id)));
      const members=ordered.map(t=>({id:String(t.id),capacity:siege?.archerSlots?.(t)?.length||0,
        assigned:siege?.stationedArchers?.(t)||0,active:siege?.occupiedArcherSlots?.(t)?.length||0}));
      const rooms=campRooms.filter(b=>rootOf(byId.get(String(b.structure?.id))||{})?.id===group.id&&
        byId.has(String(b.structure?.id))).map(b=>({id:b.id,capacity:b.capacity,
        assigned:allies.filter(u=>u.kind==='squad'&&u.barracksId===b.id&&!u.defeated).length}));
      const name=typeof structureLabel==='function'?structureLabel(group.root):null;
      const zoneCandidates=[group.root,...ordered.filter(t=>t!==group.root)];
      const sector=zoneCandidates.map(t=>circleReady?circle?.sectorForStructure?.(t):null)
        .find(id=>zoneIds.has(id))||null;
      return {id:group.id,zoneId:sector,label:group.root.isMastio?'Mastio · '+group.id:
        (name||'Torre · '+group.id),subtowers:Math.max(0,ordered.length-1),
        capacity:members.reduce((n,t)=>n+t.capacity,0),assigned:members.reduce((n,t)=>n+t.assigned,0),
        active:members.reduce((n,t)=>n+t.active,0),
        squadCapacity:rooms.reduce((n,b)=>n+b.capacity,0),squads:rooms.reduce((n,b)=>n+b.assigned,0),
        rooms,members};
    }).sort((a,b)=>a.label.localeCompare(b.label,'it'));
    const otherBarracks=campRooms.filter(b=>!byId.has(String(b.structure?.id)))
      .map(b=>({id:b.id,label:'Caserma · '+b.id,capacity:b.capacity,
        assigned:allies.filter(u=>u.kind==='squad'&&u.barracksId===b.id&&!u.defeated).length,
        zoneId:zoneIds.has(circle?.sectorForStructure?.(b.structure))
          ?circle.sectorForStructure(b.structure):null}));
    const patrols=allies.filter(u=>u.kind==='patrol'&&!u.defeated).map(u=>({
      id:String(u.id),zoneId:zoneIds.has(u.circleSectorId)?u.circleSectorId:null,
      active:!u.routing&&!u.campState,position:u.target?'in marcia':'di pattuglia'
    }));
    const zoneRows=compartments.map((sector,i)=>{
      const grouped=macros.filter(m=>m.zoneId===sector.id);
      const rooms=otherBarracks.filter(b=>b.zoneId===sector.id);
      return {id:sector.id,label:'Settore '+(i+1),depth:sector.depth||1,
        state:sector.state||'unassessed',mastio:!!sector.mastio,
        area:sector.area,patrols:patrols.filter(p=>p.zoneId===sector.id).length,
        towers:grouped,otherBarracks:rooms,
        capacity:grouped.reduce((n,m)=>n+m.capacity,0),
        assigned:grouped.reduce((n,m)=>n+m.assigned,0),
        active:grouped.reduce((n,m)=>n+m.active,0)};
    }).sort((a,b)=>a.depth-b.depth||a.label.localeCompare(b.label,'it'));
    const outside={id:'outside',label:'Fuori dai compartimenti CIRCLE',depth:0,state:'outside',
      patrols:patrols.filter(p=>!p.zoneId).length,towers:macros.filter(m=>!m.zoneId),
      otherBarracks:otherBarracks.filter(b=>!b.zoneId)};
    outside.capacity=outside.towers.reduce((n,m)=>n+m.capacity,0);
    outside.assigned=outside.towers.reduce((n,m)=>n+m.assigned,0);
    outside.active=outside.towers.reduce((n,m)=>n+m.active,0);
    return {circleReady,zones:zoneRows,outside,macros,patrols,otherBarracks,
      totalAssigned:macros.reduce((n,m)=>n+m.assigned,0),
      totalActive:macros.reduce((n,m)=>n+m.active,0),
      unassigned:allies.filter(u=>u.kind==='squad'&&!u.defeated&&!u.barracksId).length,
      hasCampManagement:!!camp};
  }
  function adjustMacroArchers(id,delta){
    const macro=militaryCircleRoster().macros.find(m=>m.id===String(id));
    if(!macro||!Number.isFinite(Number(delta))||!Math.sign(Number(delta)))return false;
    const order=delta>0?macro.members:macro.members.slice().reverse();
    const target=order.find(m=>delta>0?m.assigned<m.capacity:m.assigned>0);
    return !!target&&!!window.ConquerSiege?.changeArchers?.(target.id,delta);
  }
  function adjustZoneArchers(id,delta){
    const zones=militaryCircleRoster(),zone=id==='outside'?zones.outside:
      zones.zones.find(z=>z.id===id);
    if(!zone||!Math.sign(Number(delta)))return false;
    const list=delta>0?zone.towers:zone.towers.slice().reverse();
    const target=list.find(m=>delta>0?m.assigned<m.capacity:m.assigned>0);
    return !!target&&adjustMacroArchers(target.id,delta);
  }
  function adjustMacroSquads(id,delta){
    const macro=militaryCircleRoster().macros.find(m=>m.id===String(id));
    if(!macro||!Math.sign(Number(delta)))return false;
    const rooms=delta>0?macro.rooms:macro.rooms.slice().reverse();
    const target=rooms.find(b=>delta>0?b.assigned<b.capacity:b.assigned>0);
    if(!target)return false;
    const before=target.assigned;
    if(delta>0)window.ConquerCamp?.addSquad?.(target.id);
    else window.ConquerCamp?.removeSquad?.(target.id);
    return militaryCircleRoster().macros.find(m=>m.id===String(id))?.rooms
      .find(b=>b.id===target.id)?.assigned!==before;
  }

  // ---- read models for the panels that are not part of every snapshot ----
  const ECON_GOODS = ['food', 'wood', 'stone', 'metal', 'equipment', 'luxury'];
  const read = {
    defense() { return window.ConquerCombat?.uiState?.() || null; },
    knights() { return window.ConquerCombat?.knightRecruitment?.() || null; },
    militaryAssignments(){ return militaryCircleRoster(); },
    caravans() {
      const d = window.ConquerDiplomacy;
      return d ? (d.caravans?.() || []).filter(c => c.status !== 'completed').length : null;
    },
    village() {
      return {
        name: State.village?.name || null, founded: !!State.village?.founded, seed: State.seed,
        biome: State.biome, day: State.clock.day
      };
    },
    policies() { return { tax: State.policies.tax, rations: State.policies.rations, levy: State.policies.levy }; },
    economy() {
      const econ = window.ConquerEconomy;
      if (!econ) return null;
      const s = econ.snapshot(), e = econ.state(), staff = econ.staffing?.() || {};
      const activities = Object.entries(e.activities)
        .filter(([id]) => State.structures.some(x => x.id === id))
        .map(([id, a]) => ({ id, type: a.type, tier: econ.KIND?.[a.type]?.classId || null,
          owner: a.owner, value: econ.assetValue(a), workers: staff[id] || 0,
          profit: a.profit ?? null, abandoned: !!a.abandoned }));
      return {
        happiness: s.happiness, rationMode: s.rationMode, castleFoodIssued: s.castleFoodIssued,
        jobs: econ.jobSummary?.() || null, jobManager: econ.jobManager?.() || null,
        jobManagerL2: econ.jobManagerL2?.() || null,
        educated: window.ConquerEducated?.summary?.() || null,
        commerce: s.commerce || null,
        welfare: s.welfare, capital: s.capital, castleGold: s.castleGold, population: s.population, wage: s.wage,
        goods: (econ.GOODS || ECON_GOODS).map(g => ({ id: g, price: s.prices[g], market: s.market[g], castle: s.castle[g],
          share: e.saleShare[g], reserve: e.target[g] })),
        activities, events: (e.events || []).slice(0, 8), lastTrade: e.lastTrade || null, weekday: s.weekday
      };
    },
    logistics() {
      const siege = window.ConquerSiege;
      if (!siege) return null;
      const cap = siege.capacity(), x = siege.state(), daily = siege.dailyFoodDemand();
      const material = siege.used('materials');
      const MATERIALS = ['wood', 'stone', 'metal'];
      return {
        stores: [
          { id: 'food', stock: x.stock.food, cap: cap.food },
          { id: 'materials', stock: material, cap: cap.materials },
          { id: 'equipment', stock: x.stock.equipment, cap: cap.equipment },
          { id: 'horses', stock: x.stock.horses, cap: cap.horses },
          { id: 'gold', stock: x.stock.gold, cap: cap.gold }
        ],
        autonomy: daily > 0 ? Math.floor(x.stock.food / daily) : null, daily,
        meals: cap.meals, soldiers: cap.soldiers, knights: cap.knights, shortfall: x.starvationDays || 0,
        water: { ...siege.water(), cisterns: cap.water }, thirst: x.thirstDays || 0,
        transfers: ['food', 'wood', 'stone', 'metal', 'equipment', 'gold', 'horses'].map(key => {
          const group = MATERIALS.includes(key) ? 'materials' : key;
          return { id: key, enabled: (cap[group] || 0) > siege.used(group) && (State.resources[key] || 0) > 0 };
        })
      };
    }
  };

  window.ConquerGame = { snapshot, subscribe, commands, read, emit };
})();
