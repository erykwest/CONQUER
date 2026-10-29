/**
 * /circle — military control assessment; deterministic and side-effect free.
 *
 * Occupation is not ownership: a breach is not conquest and neither a wall
 * climber nor an intruder transfers supplies. The siege controller will
 * eventually certify a capture as a separate explicit operation.
 */
export const CIRCLE_CONTROL_STATES = Object.freeze({
  UNASSESSED: 'unassessed',
  SECURE: 'secure',
  ALERT: 'alert',
  THREATENED: 'threatened',
  INFILTRATED: 'infiltrated',
  INVADED: 'invaded',
  COMPROMISED: 'compromised',
  CONTESTED: 'contested',
  CAPTURED: 'captured'
});
export const CIRCLE_SAFE_STATES = Object.freeze(['secure', 'alert']);
const living = unit => !!unit && Number.isFinite(unit.x) && Number.isFinite(unit.y)
  && unit.defeated !== true && !(unit.stats && Number(unit.stats.hp) <= 0);
const hostile = unit => living(unit) && unit.neutral !== true
  && unit.kind !== 'wolf' && unit.faction !== 'wildlife';
const activeDefender = unit => living(unit) &&
  unit.campState !== 'camped' && unit.campState !== 'barracks';

/**
 * @param {object} input
 * compartments from defensive-topology; sectorAt is its read-only locator
 * hostiles and defenders from the *actual combat rosters* (never LOS contacts)
 * wallSectors(unit) resolves sectors on either side of a climbed/occupied wall
 * alert describes only the existing alarm; no brush geometry is changed
 */
export function assessDefensiveControl({
  compartments = [], sectorAt, hostiles = [], defenders = [],
  wallSectors = () => [], alert = false
} = {}) {
  if (typeof sectorAt !== 'function' || !Array.isArray(compartments))
    throw new TypeError('Control assessment requires a topology locator and compartments');
  const counts = new Map(compartments.map(c => [c.id, {
    groundEnemies: 0, groundDefenders: 0, wallEnemies: 0, wallDefenders: 0, climbingEnemies: 0
  }]));
  const record = (id, field) => {
    const bucket = counts.get(id);
    if (bucket) bucket[field] += 1;
  };
  for (const unit of hostiles) {
    if (!hostile(unit)) continue;
    // Being on / climbing a wall is an intrusion, not a ground occupation.
    // Do not allow the wall's ground projection to count as sector capture.
    if (unit.wall || unit.climbing) {
      const sectorIds = wallSectors(unit);
      if (!Array.isArray(sectorIds)) continue;
      for (const id of new Set(sectorIds)) record(id, unit.climbing ? 'climbingEnemies' : 'wallEnemies');
      continue;
    }
    record(sectorAt(unit), 'groundEnemies');
  }
  for (const unit of defenders) {
    if (!activeDefender(unit)) continue;
    if (unit.wall) {
      const sectorIds = wallSectors(unit);
      if (Array.isArray(sectorIds))
        for (const id of new Set(sectorIds)) record(id, 'wallDefenders');
      continue;
    }
    if (unit.climbing) continue;
    record(sectorAt(unit), 'groundDefenders');
  }
  const summary = {
    total: compartments.length, unassessed: 0, secure: 0, alert: 0,
    threatened: 0, infiltrated: 0, invaded: 0, contested: 0, compromised: 0,
    occupied: 0, safe: 0, groundEnemies: 0, wallEnemies: 0, wallDefenders: 0
  };
  const sectors = compartments.map(c => {
    const control = counts.get(c.id);
    let state;
    if (control.groundEnemies > 0)
      state = control.groundDefenders + control.wallDefenders > 0 ? 'contested' : 'invaded';
    else if (control.wallEnemies > 0)
      state = control.wallDefenders > 0 ? 'contested' : 'infiltrated';
    else if (control.climbingEnemies > 0)
      state = 'threatened';
    else
      state = c.breached ? 'compromised' : alert ? 'alert' : 'secure';
    const safe = CIRCLE_SAFE_STATES.includes(state);
    summary[state] += 1;
    if (safe) summary.safe += 1;
    else summary.occupied += 1;
    summary.groundEnemies += control.groundEnemies;
    summary.wallEnemies += control.wallEnemies;
    summary.wallDefenders += control.wallDefenders;
    return { ...c, state, safe, control: { ...control } };
  });
  return { compartments: sectors, summary };
}
