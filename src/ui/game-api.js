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
      crossing: t.crossing || null,
      width: t.width ?? null,
      civic: t.placementSpec?.type && t.kind === 'civic' ? t.placementSpec.type : null,
      industry: t.industry || null,
      extraction: t.placementSpec?.extractionMode || null,
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
      if (!['tax', 'rations', 'levy'].includes(key)) return false;
      State.policies[key] = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      const slider = document.getElementById(key);
      if (slider) slider.value = State.policies[key];
      markDirty(false, false, true);
      return true;
    },
    setSaleShare: (good, pct) => { const ok = window.ConquerEconomy?.setShare(good, pct); scheduleLocalSave(200); emit(); return ok; },
    setReserve: (good, qty) => { const ok = window.ConquerEconomy?.setTarget(good, qty); scheduleLocalSave(200); emit(); return ok; },
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

  // ---- read models for the panels that are not part of every snapshot ----
  const ECON_GOODS = ['food', 'wood', 'stone', 'metal', 'equipment', 'luxury'];
  const read = {
    defense() { return window.ConquerCombat?.uiState?.() || null; },
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
        .map(([id, a]) => ({ id, type: a.type, owner: a.owner, value: econ.assetValue(a), workers: staff[id] || 0,
          profit: a.profit ?? null, abandoned: !!a.abandoned }));
      return {
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
        transfers: ['food', 'wood', 'stone', 'metal', 'equipment', 'gold', 'horses'].map(key => {
          const group = MATERIALS.includes(key) ? 'materials' : key;
          return { id: key, enabled: (cap[group] || 0) > siege.used(group) && (State.resources[key] || 0) > 0 };
        })
      };
    }
  };

  window.ConquerGame = { snapshot, subscribe, commands, read, emit };
})();
