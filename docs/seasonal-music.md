# CONQUER — seasonal soundtrack (sound branch)

## Selected content

Only the **nine distinct seasonal arrangements** from Google Drive `CONQUER/Sounds/MUSIC` have been imported:

| Season | Tracks |
| --- | --- |
| Spring / Primavera | The Awakening Kingdom, original + (1) + (3) |
| Summer / Estate | The Golden Harvest, original + (1) |
| Autumn / Autunno | Whispers of the Harvest, original + (1) |
| Winter / Inverno | The Silent Citadel, original + (1) |

The downloaded Spring (2) file is **byte-identical** to Spring (1), so no duplicate was imported. Six general-purpose Halls / Voices / Highlands files were deliberately excluded, not published. Original files remain intact on Drive.

## Audio policy

The soundtrack is a **dedicated streaming music bus**, independent of the existing four-bus sound-effects mixer. It starts on user interaction (browser autoplay policy) and chooses a non-repeating track from the *current season*. Season changes from the simulation update the music selection. Two HTML Audio decks crossfade with equal-power fade envelopes (default 5 seconds). Browser audio streams rather than pre-decoding all nine tracks into memory.

DEV → SOUND → MUSIC exposes on/off, music volume, seasonal auto playlist, non-destructive LUFS normalization, individual track preview, next, stop, plus a 3-band EQ with ±12 dB shelving/peaking and reset. The music master is routed through a compressor and output; settings persist in localStorage separately from simulation.

## Optimization and provenance

Nine source MP3s were reassembled from authenticated Google Drive transfers into `src/assets/sounds/music/`. The transfer chunks were deleted from the final branch, so the production asset tree contains real MP3s only.

All nine clips were checked with FFprobe, measured with FFmpeg loudnorm, and assigned safe runtime trims toward -22 LUFS, capped at -3 dBTP input headroom. Files already around 130 kbps stereo were preserved. The sole 259 kbps file, Spring (3), was conservatively transcoded to 160 kbps stereo. Across nine tracks total size dropped from **35,109,050 to 32,734,931 bytes** (~6.76%); no changes to Drive masters.

Full per-track metrics: `docs/music-compression-report.json`. Automated QA: `qa/music-regression.cjs`, invoked from GitHub Actions on `sound`. Actual acoustic listening, seamless transitions and rights/usage conditions of each source track should be validated before commercial release.
