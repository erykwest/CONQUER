# CONQUER — SOUND assets (Drive import)

Imported into `src/assets/sounds/` as the **actual files from the user's CONQUER/Sounds Drive folder**, retaining their original filenames. The catalog includes only explicitly identifiable clips. The high/low bitrate rain alternatives have the same approximate duration; **only the smaller 69.9-second, ~79-kbps version is committed**, without resampling the other tracks.

| Cue | Use | Source file |
| --- | --- | --- |
| spring | Spring background | soundreality-spring-forest-nature-332842.mp3 |
| summer | Summer daytime cicadas | freesound_community-cicadas_24bit_48khz-64486.mp3 |
| rain | Weather overlay | soundreality-rain-sound-550289 (1).mp3 |
| wind | Weather/winter overlay | soundreality-wind-blowing-457954.mp3 |
| thunder | Weather event (throttled; recording is 60 s long) | soundreality-thunder-sound-375727.mp3 |
| market | Market structure ambience | freesound_community-market-74496.mp3 |
| tavern | Tavern structure ambience | freesound_community-tavern_ambience_inside_laughter-73008.mp3 |
| choir | Church structure ambience | freesound_community-church-atmosphere-with-choir-54511.mp3 |
| bells | Church bells, testable one-shot; event hookup pending | jasonlee3071-church-bells-194653.mp3 |
| chopping | Logging camp | freesound_community-chopping-logs-73222.mp3 |
| mining | Quarry/mine | freesound_community-mining-with-pick-axe-in-a-group-29590.mp3 |
| pickaxe | Mining single hit, future gameplay hook | herrparadox-mining_pickaxe_hit_crystal_rock_sharp-514333.mp3 |
| marching | Military movement, future unit hook | freesound_community-marching-loop-32908.mp3 |
| training | Training ground | freesound_community-sword-training-1-41565.mp3 |

**Not imported:** Nature Ambience (generic), fire in night forest (ambiguous), wolves fighting (no mapped gameplay context), screaming, spin (uncertain purpose), generic crowd (redundant with market), sword-against-sword (long 78.8 s clip unsuitable for current one-shot combat API), two rain duplicates. River (106 s / 3.39 MB) was reviewed but not committed because the raw connector transfer exceeded the available binary-transfer path; it may be compressed/added once linked to a real water emitter.

Metadata: creator names and source IDs appear in the filenames, but exact individual Pixabay page URLs, independent quality listening checks, seamless loop points and licensing evidence have not been verified. These sounds are integrated into the game as functional audio cues, **not offered for standalone resale**. Pixabay's Content License Summary forbids standalone redistribution (https://pixabay.com/service/license-summary/); check terms before commercial shipping or exposing raw assets separately.

Drive master folder: https://drive.google.com/drive/folders/1QlAyXxEaGVdwxUVhA5ihDswg0B8N0PUv

Mix test: DEV -> SOUND -> Audio ON -> select clip -> Ascolta file; Stop preview stops it. Per-channel ▶ tests remain synthesized. Autoplay is disabled until user interaction.

## Loudness analysis and runtime trims

All 14 assets were examined with FFmpeg `loudnorm` first-pass; per-file LUFS, measured true peak (dBTP), and applied gain (dB) are in `settlement-sound-catalog.js`. No offline processing replaced original media. The normalization policy guarantees a peak ceiling of -3 dBTP at the calibrated *file* gain stage (before extra EQ), with the final compressor also protecting summed output. EQ boost can of course alter peaks; use restrained EQ settings.

Bitrates: rain selected variant ~79 kbps; many local tracks ~160 kbps; 256 kbps originals are preserved pending controlled transcoding with listening comparisons. Further destructive compression is deliberately deferred instead of multiplying codec loss without proof.
