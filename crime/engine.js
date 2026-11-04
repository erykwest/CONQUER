'use strict';
// CONQUER /crime — deterministic, isolated social-order prototype.
// No shared population, economy, combat, settlement save or building mutations.
(function (root) {
  const KEY = 'conquer.crime.prototype.v1';
  const VERSION = 1;
  const PHASES = Object.freeze(['calm', 'discontent', 'protest', 'riot', 'revolt']);
  const POLICY_BOUNDS = Object.freeze({
    tax: [0, 100], foodStress: [0, 100], guards: [0, 40], relief: [0, 100], severity: [0, 2]
  });
  const FACILITIES = Object.freeze({
    watch: Object.freeze({label: 'Corpo di guardia', place: 'Stanza di torre T2/T3, porta o sala del Municipio', role: 'Pattuglie e arresti'}),
    prison: Object.freeze({label: 'Prigione', place: 'Stanza di torre T2/T3, porta o sala del Municipio', role: 'Detenzione · 12 posti'}),
    almshouse: Object.freeze({label: 'Ospizio', place: 'Annesso Chiesa L2', role: 'Assistenza ai più vulnerabili'}),
    pillory: Object.freeze({label: 'Gogna', place: 'Piazza', role: 'Deterrenza pubblica e risentimento'}),
    gallows: Object.freeze({label: 'Forca', place: 'Piazza o margine urbano', role: 'Intimidazione e tensione sociale'}),
    scaffold: Object.freeze({label: 'Patibolo', place: 'Piazza maggiore', role: 'Massimo deterrente, massimo risentimento'}),
    tribunal: Object.freeze({label: 'Tribunale', place: 'Piano del Municipio L2+', role: 'Giustizia ordinaria e rilascio detenuti'})
  });
  const clamp = n => Math.max(0, Math.min(100, n));
  const round = n => Math.round(n * 10) / 10;
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function note(s, text) {
    s.log.unshift('Giorno ' + s.day + ' — ' + text);
    s.log.length = Math.min(48, s.log.length);
  }
  function initial() {
    const s = {
      version: VERSION,
      day: 1,
      population: 120, // Demo headcount; NEVER the actual settlement population.
      metrics: {crime: 28, order: 68, tension: 34},
      policies: {tax: 25, foodStress: 35, guards: 10, relief: 20, severity: 1},
      facilities: {watch: true, prison: true, almshouse: false, pillory: false, gallows: false, scaffold: false, tribunal: false},
      detained: 0,
      phase: 'calm',
      phaseDays: 0,
      history: [],
      log: []
    };
    s.history.push(snapshot(s));
    note(s, 'Scenario autonomo inizializzato. Nessun dato della partita principale è stato caricato.');
    return s;
  }
  function snapshot(s) {
    return {day: s.day, crime: s.metrics.crime, order: s.metrics.order,
      tension: s.metrics.tension, phase: s.phase};
  }
  function setPolicy(s, key, value) {
    if (!has(POLICY_BOUNDS, key) || !Number.isFinite(value)) return false;
    const [min, max] = POLICY_BOUNDS[key];
    if (value < min || value > max || !Number.isInteger(value)) return false;
    if (s.policies[key] === value) return true;
    s.policies[key] = value;
    note(s, 'Politica ' + key + ' impostata a ' + value + '.');
    return true;
  }
  function setFacility(s, key, enabled) {
    if (!has(FACILITIES, key) || typeof enabled !== 'boolean') return false;
    if (key === 'prison' && !enabled && s.detained > 0) return false;
    if (s.facilities[key] === enabled) return true;
    s.facilities[key] = enabled;
    note(s, FACILITIES[key].label + (enabled ? ' attivata (fixture).' : ' disattivata (fixture).'));
    return true;
  }
  function scenario(s, name) {
    if (name !== 'crisis' && name !== 'stabilize') return false;
    s.policies = name === 'crisis'
      ? {tax: 85, foodStress: 90, guards: 2, relief: 0, severity: 2}
      : {tax: 15, foodStress: 12, guards: 20, relief: 75, severity: 0};
    note(s, name === 'crisis'
      ? 'Scenario dimostrativo: carestia, imposte alte e pattuglie ridotte.'
      : 'Scenario dimostrativo: aiuti, tributi ridotti e pattuglie rafforzate.');
    return true;
  }
  function phaseFor(s) {
    const {tension, order} = s.metrics;
    if (tension >= 88 && order <= 48) return 'revolt';
    if (tension >= 70 && order <= 64) return 'riot';
    if (tension >= 55) return 'protest';
    if (tension >= 42) return 'discontent';
    return 'calm';
  }
  function transition(s) {
    const target = PHASES.indexOf(phaseFor(s));
    const previous = PHASES.indexOf(s.phase);
    if (target > previous || (target < previous && s.phaseDays >= 2)) {
      // One transition per day: unrest must pass through observable stages.
      const next = previous + (target > previous ? 1 : -1);
      s.phase = PHASES[next];
      s.phaseDays = 0;
      const labels = {
        calm: 'Tornata la calma.',
        discontent: 'Malcontento diffuso fra i popolani.',
        protest: 'La popolazione si raduna in protesta.',
        riot: 'Sommossa: la folla danneggia e sfida le guardie.',
        revolt: 'Rivolta: l’autorità locale non controlla più la situazione.'
      };
      note(s, labels[s.phase]);
    } else {
      s.phaseDays++;
    }
  }
  function advanceDay(s) {
    s.day++;
    const p = s.policies, f = s.facilities, m = s.metrics;
    const effectiveGuards = f.watch ? p.guards : Math.floor(p.guards / 2);
    const fear = p.severity * 0.5 + (f.pillory ? 0.4 : 0) + (f.gallows ? 0.75 : 0) + (f.scaffold ? 0.9 : 0);
    const care = p.relief * 0.024 + (f.almshouse ? 0.65 : 0);
    const activeDisorder = s.phase === 'riot' || s.phase === 'revolt';
    // Model rules are illustrative balancing placeholders, not medieval statistics.
    const crimeChange = 0.28 + p.tax * 0.008 + p.foodStress * 0.016
      - effectiveGuards * 0.061 - care * 0.3 - fear * 0.42
      - (f.tribunal ? 0.18 : 0) + (activeDisorder ? 0.9 : 0);
    const orderChange = 0.22 + effectiveGuards * 0.068 + p.relief * 0.020 - m.crime * 0.022
      + (f.tribunal ? 0.2 : 0) - (s.phase === 'riot' ? 1.3 : 0)
      - (s.phase === 'revolt' ? 2.1 : 0) - (p.foodStress > 75 ? 0.3 : 0);
    const tensionChange = -0.75 + p.tax * 0.018 + p.foodStress * 0.024
      + p.severity * 0.22 + (f.pillory ? 0.35 : 0)
      + (f.gallows ? 1.3 : 0) + (f.scaffold ? 1.6 : 0) - p.relief * 0.024
      - (f.almshouse ? 0.7 : 0) - (f.tribunal ? 0.25 : 0)
      + (activeDisorder ? 0.35 : 0);
    m.crime = round(clamp(m.crime + crimeChange));
    m.order = round(clamp(m.order + orderChange));
    m.tension = round(clamp(m.tension + tensionChange));
    if (s.day % 7 === 0 && s.detained > 0) {
      const released = Math.min(s.detained, f.tribunal ? 3 : 1);
      s.detained -= released;
      note(s, 'Scarcerati ' + released + ' detenuti (risoluzione settimanale dimostrativa).');
    }
    if (s.day % 3 === 0 && f.prison && effectiveGuards >= 3 && m.crime > 18) {
      const arrests = Math.min(12 - s.detained, Math.max(1, Math.floor(effectiveGuards / 6)));
      if (arrests > 0) {
        s.detained += arrests;
        m.crime = round(clamp(m.crime - arrests * 0.4));
        m.tension = round(clamp(m.tension + arrests * p.severity * 0.25));
        note(s, 'Pattuglie: ' + arrests + ' arresti. Detenuti ' + s.detained + '/12.');
      }
    }
    transition(s);
    s.history.push(snapshot(s));
    if (s.history.length > 60) s.history.shift();
  }
  function advance(s, days = 1) {
    if (!Number.isInteger(days) || days < 1 || days > 30 || !valid(s)) return false;
    for (let i = 0; i < days; i++) advanceDay(s);
    return true;
  }
  function valid(s) {
    const pct = n => Number.isFinite(n) && n >= 0 && n <= 100;
    return !!s && s.version === VERSION &&
      Number.isSafeInteger(s.day) && s.day >= 1 &&
      Number.isSafeInteger(s.population) && s.population >= 0 &&
      s.metrics && ['crime', 'order', 'tension'].every(k => pct(s.metrics[k])) &&
      s.policies && Object.entries(POLICY_BOUNDS).every(([k, [a, b]]) =>
        Number.isInteger(s.policies[k]) && s.policies[k] >= a && s.policies[k] <= b) &&
      s.facilities && Object.keys(FACILITIES).every(k => typeof s.facilities[k] === 'boolean') &&
      Number.isSafeInteger(s.detained) && s.detained >= 0 &&
      s.detained <= 12 && (s.facilities.prison || s.detained === 0) &&
      PHASES.includes(s.phase) && Number.isSafeInteger(s.phaseDays) && s.phaseDays >= 0 &&
      Array.isArray(s.history) && s.history.length > 0 && s.history.length <= 60 &&
      s.history.every(v => Number.isSafeInteger(v.day) && v.day >= 1 &&
        ['crime', 'order', 'tension'].every(k => pct(v[k])) && PHASES.includes(v.phase)) &&
      Array.isArray(s.log) && s.log.length <= 48 &&
      s.log.every(item => typeof item === 'string' && item.length <= 300);
  }
  function load(storage) {
    try {
      const raw = storage?.getItem(KEY);
      if (!raw) return initial();
      const state = JSON.parse(raw);
      // Saves from before the scaffold was split from the gallows: no scaffold yet.
      if (state?.facilities && !has(state.facilities, 'scaffold')) state.facilities.scaffold = false;
      return valid(state) ? state : initial();
    } catch (_) { return initial(); }
  }
  function save(s, storage) {
    if (!valid(s)) return false;
    try { storage?.setItem(KEY, JSON.stringify(s)); return true; }
    catch (_) { return false; }
  }
  const api = Object.freeze({
    KEY, VERSION, PHASES, POLICY_BOUNDS, FACILITIES, initial, valid, load, save,
    setPolicy, setFacility, scenario, phaseFor, advance
  });
  root.ConquerCrime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
