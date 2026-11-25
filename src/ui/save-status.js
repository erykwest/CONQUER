'use strict';
// Shared translation of transport indicators into presentation states. Unknown
// messages are never evidence that a save succeeded.
(function(){
  function classify(value){
    const text=String(value||'').trim().toLowerCase();
    if(/fail|error|errore|fallit|non caricat/.test(text))return 'error';
    if(/block|blocc/.test(text))return 'blocked';
    if(/loading|saving|in corso|caricamento|salvando/.test(text))return 'loading';
    if(/unsaved|not saved|non salvat|da salvare|modifiche/.test(text))return 'unsaved';
    if(/\bsaved\b|\bsalvat[oa]\b/.test(text))return 'saved';
    return 'unsaved';
  }
  const LABELS=Object.freeze({saved:'Salvato',unsaved:'Modifiche non salvate',
    error:'Errore di salvataggio',loading:'Salvataggio in corso',blocked:'Salvataggio bloccato'});
  function label(state,translations={}){return translations[state]||LABELS[state]||LABELS.unsaved}
  window.ConquerSaveStatus=Object.freeze({classify,label});
})();
