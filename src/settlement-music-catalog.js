'use strict';
// Verified seasonal-only Mureka music; generic scores are deliberately excluded.
(() => {
 const values=[["spring1","Primavera _ The Awakening Kingdom.mp3","spring",0,-18.45,-3.48],["spring2","Primavera _ The Awakening Kingdom (1).mp3","spring",0,-18.46,-3.63],["spring3","Primavera _ The Awakening Kingdom (3).mp3","spring",0,-18.44,-4.35],["summer1","Estate _ The Golden Harvest.mp3","summer",0,-18.45,-3.9],["summer2","Estate _ The Golden Harvest (1).mp3","summer",0,-18.45,-1.65],["autumn1","Autunno _ Whispers of the Harvest.mp3","autumn",0,-18.46,-2.14],["autumn2","Autunno _ Whispers of the Harvest (1).mp3","autumn",0,-18.44,-2.27],["winter1","Inverno _ The Silent Citadel.mp3","winter",0,-18.46,-2.97],["winter2","Inverno _ The Silent Citadel (1).mp3","winter",0,-18.62,-2.26]];
 window.ConquerMusicCatalog=Object.freeze(values.map(([id,file,season,gainDb,lufs=null,truePeak=null])=>
  Object.freeze({id,file,season,gainDb,lufs,truePeak,url:'./src/assets/sounds/music/'+encodeURIComponent(file)})));
})();
