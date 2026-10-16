'use strict';
// Drive CONQUER/Sounds manifest; copy reviewed media into src/assets/sounds/.
(() => {
 const root='./src/assets/sounds/';
 const names={
 spring:'soundreality-spring-forest-nature-332842.mp3',
 nature:'u_vr5icvkppa-nature-ambience-323729.mp3',
 summer:'freesound_community-cicadas_24bit_48khz-64486.mp3',
 wind:'soundreality-wind-blowing-457954.mp3',
 rain:'soundreality-rain-sound-550289.mp3',
 thunder:'soundreality-thunder-sound-375727.mp3',
 river:'soundreality-water-stream-river-360596.mp3',
 fire:'soundreality-fire-in-the-night-forest-226199.mp3',
 crowd:'freesound_community-generic-crowd-background-noise-31310.mp3',
 market:'freesound_community-market-74496.mp3',
 tavern:'freesound_community-tavern_ambience_inside_laughter-73008.mp3',
 bells:'jasonlee3071-church-bells-194653.mp3',
 choir:'freesound_community-church-atmosphere-with-choir-54511.mp3',
 chopping:'freesound_community-chopping-logs-73222.mp3',
 mining:'freesound_community-mining-with-pick-axe-in-a-group-29590.mp3',
 pickaxe:'herrparadox-mining_pickaxe_hit_crystal_rock_sharp-514333.mp3',
 marching:'freesound_community-marching-loop-32908.mp3',
 swords:'freesound_community-sword-against-sword-6341.mp3',
 training:'freesound_community-sword-training-1-41565.mp3',
 wolves:'alex_jauk-wolves-fighting-227005.mp3',
 scream:'tithuh-blood-the-screaming-545569.mp3',
 uiSpin:'alice_soundz-spin_300ms_03-224071.mp3'
 };
 const oneShots=new Set(['thunder','bells','pickaxe','swords','wolves','scream','uiSpin']);
 window.ConquerSoundCatalog=Object.freeze(Object.fromEntries(Object.entries(names).map(([id,file])=>
  [id,Object.freeze({id,url:root+encodeURIComponent(file),loop:!oneShots.has(id)})])));
})();
