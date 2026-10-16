# CONQUER /sound — Audio skeleton

Four independently adjustable Web Audio buses, mixed through a master and compressor:

- **environment**: climate/season/day-night continuous beds (rain and wind overlays, occasional thunder).
- **local**: supported building ambience for selected objects, or up to two nearby when zoom scale >= 0.30.
- **effects**: one-shot gameplay API; action hooks are future work.
- **notifications**: independent signal bus with test/synthetic tone.

The catalog maps **14 imported playable MP3s from Drive** to files in `src/assets/sounds/` (see `docs/sound-assets.md`). No generic/uncertain clips are mapped. Individual cues can be auditioned in the DEV dropdown; the asset-free synthesized bus checks remain available. DEV ▶ buttons work without audio assets and are wired to synthesized sine cues on each bus. Click DEV **Audio ON** first; autoplay blocks browser audio otherwise. Settings persist separately in `localStorage`, not in game saves.

API: `ConquerSound.setEnabled(bool)` (async); `setMaster(0..1)`; `setVolume(layer,0..1)`; `setMuted(layer,bool)`; `syncScene({environment:[{id,volume}],local:[{id,volume}]})`; `play(id,layer,volume)`; `notify()`; `testTone(layer)`; `state()`.

Audio engine and catalog are independent of world State, rendering, calendar and DOM; the adapter `settlement-sound-bridge.js` is the only scene reader. Deferred: noise normalization, loop-point cleaning, spatial pan, notification priorities/ducking and gameplay effect hookups.

## Loudness, EQ and zoom tuning (October 2026)

The 14 original MP3s were analyzed locally with FFmpeg loudnorm first-pass (integrated LUFS and true peak). The catalog now stores the measured loudness, measured dBTP and a per-clip gain trim. **Normalization is non-destructive and calculated before the layer mixer**, preserving transients and the original MP3 files. Targets: ambient -24 LUFS, local -23 LUFS and short one-shots -21 LUFS, with gain capped so measured source peaks remain <= -3 dBTP. Peak constraints mean noisy recordings may remain below target rather than being hard-limited. DEV **Normalizzazione LUFS** toggles calibrated gain for an A/B comparison. This does not create newly normalized MP3 binaries.

Each Web Audio layer now has a live 3-band equalizer: low shelf 120 Hz, mid peaking 950 Hz (Q=.8), high shelf 4600 Hz, all -12 to +12 dB, plus Flat reset. Filter chain: voice lowpass for distant local emitters -> voice gain and measured trim -> layer volume -> three-band EQ -> master -> dynamics compressor -> destination. EQ/normalization preferences persist in localStorage.

Local emitter zoom enters at 30%, exits at 25% (hysteresis), and the two thresholds can be edited in DEV; selecting an eligible building overrides the zoom gate. The local voice low-pass tracks camera distance, retaining clarity close up while softening distant sources. Zoom settings are saved under `conquer.sound.zoom.v1`; they never modify simulation saves. No separate worker/unit emitters are implemented yet.

Files already encoded at 160 kbps or lower have not been re-encoded; the 79 kbps rain variant remains active. The original 256 kbps files are not automatically recompressed because re-encoding lossy MP3 without audition and AB tests can damage environmental stereo and loop transitions. A future asset build may ship selected derived copies after perceptual checks.
