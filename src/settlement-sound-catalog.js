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
 // FFmpeg loudnorm analysis of the original 14 MP3 files (LUFS integrated / dBTP).
 // Non-destructive gain is peak-capped at -3 dBTP to preserve transient dynamics.
 const levels={"spring":[-12.32,0.57,-11.68],"summer":[-22.94,-11.44,-1.06],"wind":[-30.77,-8.1,5.1],"rain":[-13.44,0.96,-10.56],"thunder":[-14.58,0.24,-9.42],"market":[-28.74,-5.28,2.28],"tavern":[-19.97,-2.13,-3.03],"bells":[-29.49,-13.28,8.49],"choir":[-34.79,-14.27,11.27],"chopping":[-23.59,-0.24,-2.76],"mining":[-21.85,0.59,-3.59],"pickaxe":[-13.98,0.43,-7.02],"marching":[-16.57,-0.25,-6.43],"training":[-18.26,-0.41,-5.74]};
 window.ConquerSoundCatalog=Object.freeze(Object.fromEntries(Object.entries(names).map(([id,name])=>{
  const [lufs,peakDbtp,gainDb]=levels[id];
  return [id,Object.freeze({id,url:root+encodeURIComponent(name),file:name,
    loop:!oneShots.has(id),lufs,peakDbtp,gainDb})];
 })));
})();
