'use strict';
// Whitelisted, descriptive clips actually imported from CONQUER/Sounds on Drive.
// Retain original Pixabay-style filenames for license/source traceability.
(() => {
 const root='./src/assets/sounds/';
 const names={
  spring:'soundreality-spring-forest-nature-332842.mp3',
  summer:'freesound_community-cicadas_24bit_48khz-64486.mp3',
  wind:'soundreality-wind-blowing-457954.mp3',
  rain:'soundreality-rain-sound-550289 (1).mp3',
  thunder:'soundreality-thunder-sound-375727.mp3',
  market:'freesound_community-market-74496.mp3',
  tavern:'freesound_community-tavern_ambience_inside_laughter-73008.mp3',
  bells:'jasonlee3071-church-bells-194653.mp3',
  choir:'freesound_community-church-atmosphere-with-choir-54511.mp3',
  chopping:'freesound_community-chopping-logs-73222.mp3',
  mining:'freesound_community-mining-with-pick-axe-in-a-group-29590.mp3',
  pickaxe:'herrparadox-mining_pickaxe_hit_crystal_rock_sharp-514333.mp3',
  marching:'freesound_community-marching-loop-32908.mp3',
  training:'freesound_community-sword-training-1-41565.mp3'
 };
 const oneShots=new Set(['thunder','bells','pickaxe']);
 window.ConquerSoundCatalog=Object.freeze(Object.fromEntries(Object.entries(names).map(([id,name])=>
  [id,Object.freeze({id,url:root+encodeURIComponent(name),file:name,loop:!oneShots.has(id)})])));
})();
