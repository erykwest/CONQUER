'use strict';
// Verified seasonal-only Mureka music; generic scores are deliberately excluded.
(() => {
 const values=[["spring1","Primavera _ The Awakening Kingdom.mp3","spring",-4.49],["spring2","Primavera _ The Awakening Kingdom (1).mp3","spring",-2.37],["spring3","Primavera _ The Awakening Kingdom (3).mp3","spring",-5.62],["summer1","Estate _ The Golden Harvest.mp3","summer",-2.81],["summer2","Estate _ The Golden Harvest (1).mp3","summer",-2.47],["autumn1","Autunno _ Whispers of the Harvest.mp3","autumn",-1.48],["autumn2","Autunno _ Whispers of the Harvest (1).mp3","autumn",-3.86],["winter1","Inverno _ The Silent Citadel.mp3","winter",-0.74],["winter2","Inverno _ The Silent Citadel (1).mp3","winter",4.08]];
 window.ConquerMusicCatalog=Object.freeze(values.map(([id,file,season,gainDb,lufs=null,truePeak=null])=>
  Object.freeze({id,file,season,gainDb,lufs,truePeak,url:'./src/assets/sounds/music/'+encodeURIComponent(file)})));
})();
