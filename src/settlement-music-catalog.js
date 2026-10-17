'use strict';
// Verified seasonal-only Mureka music; generic scores are deliberately excluded.
(() => {
 const values=[["spring1","Primavera _ The Awakening Kingdom.mp3","spring",-6.49,-15.51,0.07],["spring2","Primavera _ The Awakening Kingdom (1).mp3","spring",-4.37,-17.63,-3.32],["spring3","Primavera _ The Awakening Kingdom (3).mp3","spring",-7.18,-14.82,-0.7],["summer1","Estate _ The Golden Harvest.mp3","summer",-4.81,-17.19,-2.62],["summer2","Estate _ The Golden Harvest (1).mp3","summer",-4.47,-17.53,-0.23],["autumn1","Autunno _ Whispers of the Harvest.mp3","autumn",-3.48,-18.52,-2.21],["autumn2","Autunno _ Whispers of the Harvest (1).mp3","autumn",-5.86,-16.14,-0.04],["winter1","Inverno _ The Silent Citadel.mp3","winter",-2.74,-19.26,-3.74],["winter2","Inverno _ The Silent Citadel (1).mp3","winter",2.08,-24.08,-7.53]];
 window.ConquerMusicCatalog=Object.freeze(values.map(([id,file,season,gainDb,lufs=null,truePeak=null])=>
  Object.freeze({id,file,season,gainDb,lufs,truePeak,url:'./src/assets/sounds/music/'+encodeURIComponent(file)})));
})();
