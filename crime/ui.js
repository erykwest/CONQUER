'use strict';
(() => {
  const C = window.ConquerCrime;
  if (!C) throw new Error('ConquerCrime engine not loaded');
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const phaseInfo = {
    calm: ['Calma', 'L’autorità mantiene il controllo. Il disagio può comunque crescere.'],
    discontent: ['Malcontento', 'Crescono lamentele e sfiducia verso il governo.'],
    protest: ['Protesta', 'I popolani si radunano per contestare le condizioni di vita.'],
    riot: ['Sommossa', 'Disordini e scontri mettono alla prova le pattuglie.'],
    revolt: ['Rivolta', 'L’autorità perde il controllo: il combattimento reale non è ancora collegato.']
  };
  let state = C.load(window.localStorage);
  let message = 'Scenario pronto · popolazione dimostrativa di ' + state.population + ' residenti.';

  function setText(id, value) { $(id).textContent = String(value); }
  function action(fn, successText) {
    const result = fn();
    message = result === false
      ? 'Operazione non disponibile: controlla capacità o parametri.'
      : successText;
    C.save(state, window.localStorage);
    render();
  }
  function chart() {
    const svg = $('chart');
    svg.replaceChildren();
    for (const level of [0, 25, 50, 75, 100]) {
      const guide = document.createElementNS(ns, 'line');
      guide.setAttribute('x1', '28'); guide.setAttribute('x2', '510');
      guide.setAttribute('y1', String(140 - level * 1.2));
      guide.setAttribute('y2', String(140 - level * 1.2));
      guide.setAttribute('class', 'gridline');
      svg.appendChild(guide);
    }
    const samples = state.history;
    for (const [key, cls] of [['crime', 'crime-line'], ['order', 'order-line'], ['tension', 'tension-line']]) {
      const line = document.createElementNS(ns, 'polyline');
      const points = samples.map((p, i) => {
        const x = 30 + i / Math.max(1, samples.length - 1) * 476;
        return x.toFixed(1) + ',' + (140 - p[key] * 1.2).toFixed(1);
      });
      line.setAttribute('points', points.join(' '));
      line.setAttribute('class', cls);
      svg.appendChild(line);
    }
    const title = document.createElementNS(ns, 'title');
    title.textContent = 'Criminalità, ordine e tensione · giorni ' +
      samples[0].day + '–' + samples[samples.length - 1].day;
    svg.insertBefore(title, svg.firstChild);
  }
  function facilities() {
    const host = $('facilities');
    host.replaceChildren();
    for (const [key, def] of Object.entries(C.FACILITIES)) {
      const row = document.createElement('label'); row.className = 'facility';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state.facilities[key];
      input.disabled = key === 'prison' && state.detained > 0;
      if (input.disabled) row.classList.add('locked');
      input.addEventListener('change', () => action(
        () => C.setFacility(state, key, input.checked),
        def.label + (input.checked ? ' attivata.' : ' disattivata.')
      ));
      const info = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = def.label;
      const place = document.createElement('small'); place.textContent = def.place;
      const role = document.createElement('span'); role.className = 'detail';
      role.textContent = def.role;
      info.append(name, place, role);
      row.append(input, info); host.appendChild(row);
    }
  }
  function render() {
    setText('day', 'Giorno ' + state.day);
    for (const key of ['crime', 'order', 'tension']) {
      setText(key + 'Value', Math.round(state.metrics[key]) + '/100');
      $(key + 'Bar').style.width = state.metrics[key] + '%';
    }
    const [title, explanation] = phaseInfo[state.phase];
    setText('phaseTitle', title);
    setText('phaseText', explanation);
    const phases = $('phaseSteps'); phases.replaceChildren();
    for (const key of C.PHASES) {
      const step = document.createElement('span');
      step.className = 'step' + (key === state.phase ? ' active' : '');
      step.textContent = phaseInfo[key][0];
      phases.appendChild(step);
    }
    for (const key of Object.keys(C.POLICY_BOUNDS)) {
      $('policy-' + key).value = state.policies[key];
      const output = $('out-' + key);
      if (output) output.value = state.policies[key];
    }
    setText('detention', 'Detenuti ' + state.detained + '/12 · capienza dimostrativa');
    const log = $('log'); log.replaceChildren();
    for (const entry of state.log.slice(0, 24)) {
      const item = document.createElement('li');
      item.textContent = entry; log.appendChild(item);
    }
    setText('status', message);
    facilities();
    chart();
  }
  for (const control of document.querySelectorAll('[data-policy]')) {
    control.addEventListener('change', () => {
      const key = control.dataset.policy;
      const value = Number(control.value);
      action(() => C.setPolicy(state, key, value), 'Parametro ' + key + ' aggiornato.');
    });
  }
  $('advance').addEventListener('click', () => action(
    () => C.advance(state, 1), 'Simulato un giorno nel laboratorio CRIME.'
  ));
  $('advance7').addEventListener('click', () => action(
    () => C.advance(state, 7), 'Simulata una settimana nel laboratorio CRIME.'
  ));
  $('crisis').addEventListener('click', () => action(
    () => C.scenario(state, 'crisis'), 'Scenario carestia impostato: avanza i giorni per osservare le conseguenze.'
  ));
  $('stabilize').addEventListener('click', () => action(
    () => C.scenario(state, 'stabilize'), 'Misure sociali impostate: i miglioramenti richiedono tempo.'
  ));
  $('reset').addEventListener('click', () => {
    if (!window.confirm('Reimpostare soltanto il laboratorio CRIME?')) return;
    state = C.initial();
    message = 'Scenario CRIME azzerato; nessun dato di gioco modificato.';
    C.save(state, window.localStorage);
    render();
  });
  render();
})();
