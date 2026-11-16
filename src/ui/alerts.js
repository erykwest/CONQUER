// CONQUER alert center (UI v2): the in-game notice stack and the event journal.
// Pure logic, no DOM and no game globals: the shell feeds it and renders what it returns,
// node tests drive it with a fake clock (qa/ui-alerts-regression.mjs).
//
// Two kinds of entries:
//  - condition: a state that holds over time (fire, hostiles in the safe zone, starving castle).
//    sync() raises it when it appears and resolves it when it disappears. While active it never
//    expires; once resolved it lingers `resolvedLinger` ms, marked as resolved, then leaves the stack.
//  - event: something that happened once (site completed, enterprise sold). push() shows it for
//    `eventTtl` ms (`dangerTtl` for a danger event) and then it leaves the stack by itself.
// dismiss() hides an entry by hand. A dismissed condition stays quiet until it resolves and
// returns, or until it gets worse (severity rises). Everything raised or resolved also goes
// to the journal, which survives dismissals and is what the "Diario" menu section lists.

export const SEVERITY = { info: 0, good: 0, warn: 1, danger: 2 };
const rank = s => SEVERITY[s] ?? 0;

export function createAlertCenter({
  now = () => Date.now(),
  resolvedLinger = 6000,
  // A condition must stay absent this long before it counts as resolved (no flapping).
  resolveGrace = 4000,
  eventTtl = 9000,
  dangerTtl = 20000,
  journalMax = 300,
  maxVisible = 5
} = {}) {
  const alerts = new Map();
  let journal = [];
  let serial = 0;
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) fn(); };

  function log(entry, phase, day) {
    journal.unshift({
      id: 'j' + (++serial) + '-' + now(),
      key: entry.key, phase, day: Number.isFinite(day) ? day : null, at: now(),
      severity: phase === 'resolved' ? 'good' : entry.severity,
      category: entry.category || 'general', title: entry.title, detail: entry.detail || '',
      focusId: entry.focusId ?? null
    });
    if (journal.length > journalMax) journal.length = journalMax;
  }
  const clean = c => ({
    key: String(c.key), severity: SEVERITY[c.severity] != null ? c.severity : 'info',
    category: c.category || 'general', title: String(c.title || ''), detail: String(c.detail || ''),
    resolvedTitle: c.resolvedTitle ? String(c.resolvedTitle) : null, focusId: c.focusId ?? null
  });

  // Conditions currently true. Anything active and missing from the list is resolved.
  function sync(conditions, day) {
    const t = now(), seen = new Set();
    let dirty = false;
    for (const raw of conditions || []) {
      if (!raw || raw.key == null) continue;
      const c = clean(raw);
      seen.add(c.key);
      const a = alerts.get(c.key);
      if (a) a.missingSince = null;
      if (!a || a.kind !== 'condition' || a.resolvedAt != null) {
        const entry = { ...c, kind: 'condition', raisedAt: t, resolvedAt: null, missingSince: null, dismissed: false, count: (a?.count || 0) + 1 };
        alerts.set(c.key, entry);
        log(entry, 'raised', day);
        dirty = true;
        continue;
      }
      const worse = rank(c.severity) > rank(a.severity);
      if (worse) { log({ ...a, ...c }, 'raised', day); a.dismissed = false; a.raisedAt = t; }
      if (worse || a.title !== c.title || a.detail !== c.detail || a.severity !== c.severity || a.focusId !== c.focusId) {
        Object.assign(a, { severity: c.severity, title: c.title, detail: c.detail, focusId: c.focusId, resolvedTitle: c.resolvedTitle, category: c.category });
        dirty = true;
      }
    }
    for (const a of alerts.values()) {
      if (a.kind !== 'condition' || a.resolvedAt != null || seen.has(a.key)) continue;
      if (a.missingSince == null) a.missingSince = t;
      if (t - a.missingSince < resolveGrace) continue;
      a.resolvedAt = t;
      log({ ...a, title: a.resolvedTitle || a.title }, 'resolved', day);
      dirty = true;
    }
    if (prune() || dirty) changed();
  }

  // A one-shot happening. Same key within its lifetime refreshes the entry instead of stacking.
  function push(raw, day) {
    if (!raw) return null;
    const c = clean({ key: raw.key ?? 'ev-' + (serial + 1), ...raw });
    const entry = { ...c, kind: 'event', raisedAt: now(), resolvedAt: null, dismissed: false, count: (alerts.get(c.key)?.count || 0) + 1 };
    alerts.set(c.key, entry);
    log(entry, 'event', day);
    changed();
    return entry.key;
  }

  function dismiss(key) {
    const a = alerts.get(key);
    if (!a || a.dismissed) return false;
    a.dismissed = true;
    // A resolved condition or an event has nothing left to watch: drop it now.
    if (a.kind === 'event' || a.resolvedAt != null) alerts.delete(key);
    changed();
    return true;
  }
  function dismissAll() {
    let any = false;
    for (const a of [...alerts.values()]) if (!a.dismissed) { dismiss(a.key); any = true; }
    return any;
  }

  const expiresAt = a => a.kind === 'event' ? a.raisedAt + (a.severity === 'danger' ? dangerTtl : eventTtl)
    : a.resolvedAt != null ? a.resolvedAt + resolvedLinger : Infinity;
  // Drops expired entries; true when something left the stack.
  function prune() {
    const t = now();
    let gone = false;
    for (const a of [...alerts.values()]) if (expiresAt(a) <= t) { alerts.delete(a.key); gone = true; }
    return gone;
  }
  function tick() { if (prune()) changed(); }

  // What the stack shows: most severe first, then newest. `hidden` counts the overflow.
  function visible() {
    const t = now();
    const list = [...alerts.values()].filter(a => !a.dismissed && expiresAt(a) > t)
      .sort((a, b) => (a.resolvedAt != null) - (b.resolvedAt != null) || rank(b.severity) - rank(a.severity) || b.raisedAt - a.raisedAt)
      .map(a => ({
        key: a.key, kind: a.kind, severity: a.resolvedAt != null ? 'good' : a.severity, category: a.category,
        title: a.resolvedAt != null && a.resolvedTitle ? a.resolvedTitle : a.title, detail: a.detail,
        resolved: a.resolvedAt != null, focusId: a.focusId, count: a.count,
        // 0..1 of the time left before it leaves by itself (null: stays until resolved or dismissed).
        remaining: Number.isFinite(expiresAt(a)) ? Math.max(0, Math.min(1, (expiresAt(a) - t) / (a.kind === 'event' ? (a.severity === 'danger' ? dangerTtl : eventTtl) : resolvedLinger))) : null
      }));
    return { items: list.slice(0, maxVisible), hidden: Math.max(0, list.length - maxVisible), active: list.filter(a => !a.resolved).length };
  }
  const active = () => [...alerts.values()].filter(a => a.kind === 'condition' && a.resolvedAt == null).map(a => a.key);

  return {
    sync, push, dismiss, dismissAll, tick, visible, active,
    journal: () => journal.slice(),
    clearJournal() { journal = []; changed(); },
    // Persistence of the journal only: live alerts are rebuilt from the game state.
    exportJournal: () => journal.slice(),
    importJournal(list) {
      if (!Array.isArray(list)) return 0;
      journal = list.filter(e => e && typeof e.title === 'string' && typeof e.phase === 'string').slice(0, journalMax);
      changed();
      return journal.length;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
