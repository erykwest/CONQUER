'use strict';
// SCOL-01 fase 1 — Scolarizzati (D-SCOL-261112).
// Educated residents of L3/L4 houses, counted like the Barracks soldiers: plain
// counters inside State.economy, no second wallet or happiness track. Two
// branches, lay and clergy. Cap: three seats per L3/L4 house
// (floor(L3/3)+floor(L4/3)). Phase 1 covers data, cap, overflow ("senza
// alloggio"), saves and the lord's hire. Scriptorium courses, roles, wages,
// happiness and the labour market arrive in later phases.
(() => {
  const BRANCHES = Object.freeze(['lay','clergy']);
  const CLASSES = Object.freeze(['L3','L4']);
  const HIRE_COST = 40;      // castle gold, paid when the hire is ordered
  const HIRE_DAYS = 14;      // courier journey before the hire arrives
  const HOMELESS_DAYS = 28;  // weeks without a seat before emigrating
  const int = v => Math.max(0, Math.floor(Number.isFinite(+v) ? +v : 0));
  const round = n => Math.round(n * 1000) / 1000;
  const econ = () => window.ConquerEconomy;
  const today = () => int(State.clock?.day);

  function blank() {
    return { lay:{L3:0,L4:0}, clergy:{L3:0,L4:0}, homeless:[], courses:{}, hires:[],
      wageMul:1, roles:{enabled:false,order:[],settings:{}}, lastMonthDay:null };
  }
  // Lazy migration: older saves get an empty block, economy.version is untouched.
  function normalize(e) {
    if (!e.educated || typeof e.educated !== 'object') e.educated = blank();
    const d = e.educated;
    for (const b of BRANCHES) {
      if (!d[b] || typeof d[b] !== 'object') d[b] = {L3:0,L4:0};
      for (const c of CLASSES) d[b][c] = int(d[b][c]);
    }
    d.homeless = Array.isArray(d.homeless) ? d.homeless
      .map(x => ({branch:BRANCHES.includes(x?.branch) ? x.branch : 'lay', n:int(x?.n), sinceDay:int(x?.sinceDay)}))
      .filter(x => x.n > 0) : [];
    if (!d.courses || typeof d.courses !== 'object') d.courses = {};
    d.hires = Array.isArray(d.hires) ? d.hires
      .map(h => ({arrivalDay:int(h?.arrivalDay), paid:Math.max(0, +h?.paid || 0)})) : [];
    d.wageMul = Math.min(2, Math.max(.5, Number.isFinite(+d.wageMul) ? +d.wageMul : 1));
    if (!d.roles || typeof d.roles !== 'object') d.roles = {enabled:false,order:[],settings:{}};
    if (!Array.isArray(d.roles.order)) d.roles.order = [];
    if (!d.roles.settings || typeof d.roles.settings !== 'object') d.roles.settings = {};
    return d;
  }
  function state() {
    const E = econ();
    if (!E) return null;
    return normalize(E.state());
  }
  function capacity(pop = econ()?.population?.() || {}) {
    return { L3: Math.floor(int(pop.L3) / 3), L4: Math.floor(int(pop.L4) / 3) };
  }
  const housed = (d, c) => d.lay[c] + d.clergy[c];
  const freeSeats = (d, cap) => CLASSES.reduce((n, c) => n + Math.max(0, cap[c] - housed(d, c)), 0);
  const homelessCount = d => d.homeless.reduce((n, x) => n + x.n, 0);
  function note(label) {
    const e = econ()?.state?.();
    if (!e) return;
    e.events ||= [];
    e.events.unshift({ day:e.lastDay, label });
    if (e.events.length > 25) e.events.length = 25;
  }
  // New arrivals take L3 seats first, then L4. Returns how many were seated.
  function seat(d, cap, branch, n) {
    let left = n;
    for (const c of CLASSES) {
      const take = Math.min(left, Math.max(0, cap[c] - housed(d, c)));
      d[branch][c] += take; left -= take;
    }
    return n - left;
  }
  function addHomeless(d, branch, n, day) {
    if (n <= 0) return;
    const same = d.homeless.find(x => x.branch === branch && x.sinceDay === day);
    if (same) same.n += n; else d.homeless.push({ branch, n, sinceDay:day });
  }

  // Daily bookkeeping: cap enforcement, rehousing, emigration, hire arrivals.
  function daily(day = today()) {
    const d = state();
    if (!d) return;
    const cap = capacity();
    // 1. Over cap: lay first move to the other class if it has room, else lose their seat.
    for (const c of CLASSES) {
      let over = housed(d, c) - cap[c];
      for (const b of BRANCHES) {
        if (over <= 0) break;
        const out = Math.min(over, d[b][c]);
        if (!out) continue;
        d[b][c] -= out; over -= out;
        const other = c === 'L3' ? 'L4' : 'L3';
        const moved = Math.min(out, Math.max(0, cap[other] - housed(d, other)));
        d[b][other] += moved;
        addHomeless(d, b, out - moved, day);
        if (out - moved > 0) note((out - moved) + ' scolarizzati senza alloggio');
      }
    }
    // 2. Rehouse the oldest homeless first.
    d.homeless.sort((a, b) => a.sinceDay - b.sinceDay);
    for (const x of d.homeless) x.n -= seat(d, cap, x.branch, x.n);
    // 3. After four weeks without a seat they emigrate.
    let gone = 0;
    for (const x of d.homeless) if (day - x.sinceDay >= HOMELESS_DAYS) { gone += x.n; x.n = 0; }
    if (gone) note(gone + ' scolarizzati emigrati senza alloggio');
    d.homeless = d.homeless.filter(x => x.n > 0);
    // 4. Hires arrive as lay; with no seat on arrival the gold returns to the castle.
    const arriving = d.hires.filter(h => h.arrivalDay <= day);
    d.hires = d.hires.filter(h => h.arrivalDay > day);
    for (const h of arriving) {
      if (seat(d, cap, 'lay', 1)) note('Arrivato uno scolarizzato ingaggiato');
      else {
        const e = econ().state();
        e.castleGold = round((+e.castleGold || 0) + h.paid);
        note('Ingaggio annullato: nessun posto libero, ' + h.paid + ' oro restituiti');
      }
    }
  }

  // The lord's hire: pay now, a lay scolarizzato arrives after HIRE_DAYS.
  function canHire() {
    const d = state();
    if (!d) return { ok:false, reason:'economy' };
    const e = econ().state();
    if ((+e.castleGold || 0) < HIRE_COST) return { ok:false, reason:'gold' };
    if (freeSeats(d, capacity()) - d.hires.length <= 0) return { ok:false, reason:'seats' };
    return { ok:true };
  }
  function hire(day = today()) {
    const check = canHire();
    if (!check.ok) return check;
    const d = state(), e = econ().state();
    e.castleGold = round((+e.castleGold || 0) - HIRE_COST);
    d.hires.push({ arrivalDay:int(day) + HIRE_DAYS, paid:HIRE_COST });
    note('Ingaggiato uno scolarizzato: arriva tra ' + HIRE_DAYS + ' giorni');
    return { ok:true, arrivalDay:int(day) + HIRE_DAYS };
  }

  function summary() {
    const d = state();
    if (!d) return null;
    const cap = capacity(), sum = b => d[b].L3 + d[b].L4;
    const lay = sum('lay'), clergy = sum('clergy');
    return {
      total:lay + clergy, lay, clergy,
      byClass:{ L3:housed(d, 'L3'), L4:housed(d, 'L4') },
      capacity:{ ...cap, total:cap.L3 + cap.L4 },
      free:freeSeats(d, cap),
      assigned:0, unassigned:lay + clergy, training:0, // roles and courses: phases 2–3
      homeless:homelessCount(d),
      hiresInTransit:d.hires.length,
      nextArrival:d.hires.length ? Math.min(...d.hires.map(h => h.arrivalDay)) : null,
      hireCost:HIRE_COST, hireDays:HIRE_DAYS, wageMul:d.wageMul,
      canHire:canHire()
    };
  }

  window.ConquerEducated = Object.freeze({ BRANCHES, CLASSES, HIRE_COST, HIRE_DAYS, HOMELESS_DAYS,
    state, capacity, daily, canHire, hire, summary });
})();
