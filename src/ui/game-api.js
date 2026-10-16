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
      label: t.label || ''
    };
  }
  function selection() {
    const s = typeof selectedStructure === 'function' ? selectedStructure() : null;
    if (!s) return null;
    let label = s.type;
    try { label = structureLabel(s); } catch {}
    return { id: s.id, type: s.type, label };
  }
  function snapshot() {
    return {
      resources: { ...State.resources },
      clock: clock(),
      view: { rotation: State.view.rotation || 0, plan: typeof isPlanView === 'function' && isPlanView() },
      tool: tool(),
      levels: { ...State.buildLevels },
      crossingWidth: Number(findLegacy('[data-crossing-width].active')?.dataset.crossingWidth) || 2,
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
    openProfile: () => press('#profileBtn'),
    toggleDev: () => press('#devToggle')
  };

  window.ConquerGame = { snapshot, subscribe, commands, emit };
})();
