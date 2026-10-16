# CONQUER /sound — Audio skeleton

Four independently adjustable Web Audio buses, mixed through a master and compressor:

- **environment**: climate/season/day-night continuous beds (rain and wind overlays, occasional thunder).
- **local**: supported building ambience for selected objects, or up to two nearby when zoom scale >= 0.30.
- **effects**: one-shot gameplay API; action hooks are future work.
- **notifications**: independent signal bus with test/synthetic tone.

The catalog maps **14 imported playable MP3s from Drive** to files in `src/assets/sounds/` (see `docs/sound-assets.md`). No generic/uncertain clips are mapped. Individual cues can be auditioned in the DEV dropdown; the asset-free synthesized bus checks remain available. DEV ▶ buttons work without audio assets and are wired to synthesized sine cues on each bus. Click DEV **Audio ON** first; autoplay blocks browser audio otherwise. Settings persist separately in `localStorage`, not in game saves.

API: `ConquerSound.setEnabled(bool)` (async); `setMaster(0..1)`; `setVolume(layer,0..1)`; `setMuted(layer,bool)`; `syncScene({environment:[{id,volume}],local:[{id,volume}]})`; `play(id,layer,volume)`; `notify()`; `testTone(layer)`; `state()`.

Audio engine and catalog are independent of world State, rendering, calendar and DOM; the adapter `settlement-sound-bridge.js` is the only scene reader. Deferred: noise normalization, loop-point cleaning, spatial pan, notification priorities/ducking and gameplay effect hookups.
