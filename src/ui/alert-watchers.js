// CONQUER alert watchers (UI v2): read the game and feed the alert center.
// Read-only: every probe is guarded, a missing module simply raises nothing.
// Conditions are re-read every poll (cheap ones) or once per game day (economy, which
// runs the labour allocation); one-shot events come from diffs between two polls.

const fmt = n => Math.round(Number(n) || 0).toLocaleString('it-IT');
// Display name of a structure: the shell's Italian names first, the game's own label as fallback.
let names = {};
const label = s => {
  if (!s) return '';
  if (s.type === 'tower' && !s.woodStyle && names[s.shape === 'round' ? 'towerRound' : 'towerSquare']) return names[s.shape === 'round' ? 'towerRound' : 'towerSquare'];
  if (names[s.woodStyle] || names[s.type]) return names[s.woodStyle] || names[s.type];
  try { return (typeof structureLabel === 'function' && structureLabel(s)) || s.label || s.type || ''; }
  catch { return s.label || s.type || ''; }
};
const listNames = (items, max = 3) => {
  const list = items.slice(0, max).map(label).filter(Boolean);
  return list.join(', ') + (items.length > max ? ' e altri ' + (items.length - max) : '');
};
const g = name => (typeof window !== 'undefined' ? window[name] : undefined);

// Economy notes are written in English by settlement-economy.js: give them Italian titles.
const ECON_NOTES = [
  [/^Founding charter funded/i, () => ({ title: 'Carta di fondazione finanziata', category: 'economy' })],
  [/^Forest clearance .*: \+([\d.]+) wood/i, m => ({ title: 'Disboscamento completato', detail: '+' + m[1] + ' legna', category: 'economy' })],
  [/^(\w+) .* abandoned after (\d+) years/i, m => ({ title: 'Attività abbandonata', detail: m[1] + ' in perdita da ' + m[2] + ' anni', severity: 'warn', category: 'economy' })],
  [/^Castle rationing ended/i, () => ({ title: 'Razionamento del castello terminato', category: 'economy' })],
  [/^Full rations authorized/i, () => ({ title: 'Razioni piene autorizzate', category: 'economy' })],
  [/^Half rations authorized/i, () => ({ title: 'Mezze razioni autorizzate', category: 'economy' })],
  [/^Transferred (\w+) for ([\d.]+) gold/i, m => ({ title: 'Attività trasferita', detail: m[1] + ' per ' + m[2] + ' oro', category: 'economy' })],
  [/^Economy backlog truncated/i, () => null]
];
export function economyNote(text) {
  const s = String(text || '');
  for (const [re, make] of ECON_NOTES) { const m = s.match(re); if (m) return make(m); }
  return { title: s, category: 'economy' };
}

export function createWatchers(game, center, { econEveryMs = 10000, now = () => Date.now(), structureNames = {} } = {}) {
  names = structureNames || {};
  let sites = null, ruins = null, seenNotes = null, village = null;
  let econCache = [], econDay = null, econAt = -Infinity;

  // State is a top-level const of settlement-core.js: global lexical scope, not a window property.
  const S = () => (typeof State !== 'undefined' ? State : undefined);
  const day = () => Number(S()?.clock?.day) || 0;
  const structures = () => (Array.isArray(S()?.structures) ? S().structures : []);
  const building = s => { try { return typeof underConstruction === 'function' && !!s.construction && underConstruction(s); } catch { return false; } };

  function defenseConditions() {
    const out = [];
    const d = game.read.defense?.();
    if (d?.alert === 'general') out.push({ key: 'defense', severity: 'danger', category: 'military', title: 'Allarme generale',
      detail: fmt(d.hostiles) + ' ostili avvistati nella zona sicura. Suona la campana o schiera le unità (Difendi).', resolvedTitle: 'Nessun ostile nelle zone protette' });
    else if (d?.alert === 'local') out.push({ key: 'defense', severity: 'warn', category: 'military', title: 'Allerta locale',
      detail: fmt(d.hostiles) + ' ostili avvistati nella zona gialla.', resolvedTitle: 'Nessun ostile nelle zone protette' });
    const burning = g('ConquerFire')?.state?.()?.burning;
    if (Array.isArray(burning) && burning.length) {
      const ids = [...new Set(burning.map(f => f.id))];
      const hit = ids.map(id => structures().find(s => s.id === id)).filter(Boolean);
      out.push({ key: 'fire', severity: 'danger', category: 'military', title: hit.length > 1 ? 'Incendi in corso (' + hit.length + ')' : 'Incendio in corso',
        detail: (listNames(hit) || 'Strutture in fiamme') + '. Attiva la brigata dei secchi (Difendi › Allarme).',
        resolvedTitle: 'Incendi spenti', focusId: hit[0]?.id ?? null });
    }
    return out;
  }

  function castleConditions() {
    const out = [], l = game.read.logistics?.();
    if (!l) return out;
    if (l.shortfall > 0) out.push({ key: 'castle-food', severity: 'danger', category: 'castle', title: 'Razioni militari insufficienti',
      detail: 'Il castello è senza cibo da ' + fmt(l.shortfall) + ' giorni. Immagazzina cibo (Gestisci › Castello).', resolvedTitle: 'Razioni militari ristabilite' });
    else if (l.daily > 0 && l.autonomy != null && l.autonomy < 5) out.push({ key: 'castle-food', severity: 'warn', category: 'castle', title: 'Scorte del castello in esaurimento',
      detail: 'Autonomia di ' + fmt(l.autonomy) + ' giorni per la guarnigione.', resolvedTitle: 'Scorte del castello ristabilite' });
    if (l.thirst > 0) out.push({ key: 'castle-water', severity: 'danger', category: 'castle', title: 'Sete nel castello',
      detail: 'Senza acqua da ' + fmt(l.thirst) + ' giorni: servono pozzi o cisterne.', resolvedTitle: 'Acqua del castello ristabilita' });
    return out;
  }

  function siteConditions() {
    const out = [], waiting = [], unpaid = [], idle = [];
    if (typeof constructionWorkStatus !== 'function') return out;
    for (const s of structures()) {
      if (!building(s)) continue;
      let st = '', starved = false;
      try {
        st = constructionWorkStatus(s);
        // Read the materials directly: on weekends the status says "resting" and would hide the shortage.
        if (s.construction?.version === 2 && typeof constructionMaterialInfo === 'function' && typeof constructionProgress === 'function') {
          const m = constructionMaterialInfo(s).progress;
          starved = m < 1 - 1e-7 && m <= constructionProgress(s) + 1e-7;
        }
      } catch { continue; }
      if (starved || /attesa di materiali/i.test(st)) waiting.push(s);
      else if (/insufficient lord treasury/i.test(st)) unpaid.push(s);
      else if (/Waiting for idle L1/i.test(st)) idle.push(s);
    }
    if (unpaid.length) out.push({ key: 'sites-unpaid', severity: 'warn', category: 'construction', title: 'Cantieri fermi: tesoro vuoto',
      detail: 'Il tesoro del signore non copre le paghe: ' + listNames(unpaid) + '.', resolvedTitle: 'Paghe dei cantieri coperte', focusId: unpaid[0].id });
    if (waiting.length) out.push({ key: 'sites-materials', severity: 'warn', category: 'construction',
      title: waiting.length > 1 ? waiting.length + ' cantieri fermi per materiali' : 'Cantiere fermo per materiali',
      detail: 'I carri non hanno ancora consegnato abbastanza materiale: ' + listNames(waiting) + '.', resolvedTitle: 'Cantieri riforniti', focusId: waiting[0].id });
    if (idle.length) out.push({ key: 'sites-workers', severity: 'info', category: 'construction',
      title: idle.length > 1 ? idle.length + ' cantieri senza costruttori' : 'Cantiere senza costruttori',
      detail: 'Nessun L1 libero per ' + listNames(idle) + '.', resolvedTitle: 'Costruttori assegnati', focusId: idle[0].id });
    return out;
  }

  // Economy probes are heavier (labour allocation): once per game day or every econEveryMs.
  function economyConditions() {
    const d = Math.floor(day()), t = now();
    if (d === econDay && t - econAt < econEveryMs) return econCache;
    econDay = d; econAt = t;
    const out = [], econ = g('ConquerEconomy');
    if (!econ || !S()?.village?.founded) return (econCache = out);
    try {
      const jobs = econ.jobSummary?.();
      if (jobs?.foodRisk) out.push({ key: 'food-risk', severity: 'warn', category: 'economy', title: 'Rischio carenza alimentare',
        detail: 'Le scorte di cibo (' + fmt(jobs.foodStock) + ') non coprono due settimane di fabbisogno (' + fmt(jobs.foodWeekly) + '/settimana).',
        resolvedTitle: 'Cibo sufficiente' });
      const e = econ.state?.();
      const unmet = Number(e?.lastTrade?.unmetSupply?.food) || 0;
      if (unmet > 0) out.push({ key: 'food-market', severity: 'warn', category: 'economy', title: 'Mercato senza cibo',
        detail: fmt(unmet) + ' razioni richieste e non trovate al mercato.', resolvedTitle: 'Mercato rifornito di cibo' });
      const welfare = Number(econ.snapshot?.()?.welfare);
      if (Number.isFinite(welfare) && welfare < 35) out.push({ key: 'welfare', severity: welfare < 20 ? 'danger' : 'warn', category: 'population',
        title: 'Malcontento popolare', detail: 'Felicità media ' + fmt(welfare) + '/100.', resolvedTitle: 'Malcontento rientrato' });
    } catch (err) { console.warn('alert economy probe failed', err); }
    return (econCache = out);
  }

  function saveConditions() {
    return game.snapshot?.().saveStatus === 'error'
      ? [{ key: 'save', severity: 'warn', category: 'game', title: 'Salvataggio non riuscito', detail: 'L’ultimo salvataggio non è andato a buon fine.', resolvedTitle: 'Partita salvata' }]
      : [];
  }

  // One-shot events: diffs since the previous poll. The first poll (and a new village) only seeds.
  function events() {
    const v = (S()?.seed ?? '') + '|' + (S()?.village?.name ?? '');
    const reseed = v !== village;
    village = v;
    const all = structures(), today = day();
    const nowSites = new Set(all.filter(building).map(s => s.id));
    const nowRuins = new Set(all.filter(s => s.type === 'ruin').map(s => s.id));
    if (!reseed && sites) {
      for (const id of sites) {
        if (nowSites.has(id)) continue;
        const s = all.find(x => x.id === id);
        if (s && s.type !== 'ruin') center.push({ key: 'done-' + id, severity: 'info', category: 'construction',
          title: 'Costruzione completata', detail: label(s), focusId: id }, today);
      }
      for (const id of nowRuins) if (!ruins.has(id)) {
        const s = all.find(x => x.id === id);
        center.push({ key: 'ruin-' + id, severity: 'danger', category: 'military', title: 'Struttura crollata',
          detail: (s?.ruinOf ? label({ ...s, type: s.ruinOf }) : '') + ' ridotta in macerie.', focusId: id }, today);
      }
    }
    sites = nowSites; ruins = nowRuins;
    const notes = g('ConquerEconomy')?.state?.()?.events;
    if (Array.isArray(notes)) {
      const keyOf = n => n.day + '|' + n.label;
      if (reseed || !seenNotes) seenNotes = new Set(notes.map(keyOf));
      else for (const n of [...notes].reverse()) {
        const k = keyOf(n);
        if (seenNotes.has(k)) continue;
        seenNotes.add(k);
        const ev = economyNote(n.label);
        if (ev && Number(n.day) >= today - 1) center.push({ key: 'econ-' + k, severity: 'info', ...ev }, Number(n.day));
      }
    }
  }

  function poll() {
    if (!S()) return;
    try {
      events();
      center.sync([...defenseConditions(), ...castleConditions(), ...siteConditions(), ...economyConditions(), ...saveConditions()], day());
    } catch (err) { console.warn('alert poll failed', err); }
    center.tick();
  }
  return { poll };
}
