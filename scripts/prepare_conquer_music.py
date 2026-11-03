#!/usr/bin/env python3
"""CONQUER: prepara SOLO musiche stagionali, senza modificare gli originali.

Richiede FFmpeg/FFprobe nel PATH. I file MP3 elaborati vengono salvati
nella cartella sorella MUSIC_processed, con un report JSON riepilogativo.

Esempio: python prepare_conquer_music.py --dry-run
         python prepare_conquer_music.py
         python prepare_conquer_music.py --bass-db 1 --high-db -1
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any

def default_input() -> Path:
    """Se lo script è accanto a MUSIC o dentro MUSIC, funziona senza argomenti."""
    here = Path(__file__).resolve().parent
    if here.name.casefold() == "music":
        return here
    if (here / "MUSIC").is_dir():
        return here / "MUSIC"
    return Path.cwd() / "MUSIC"

EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus"}
SEASONS = {
    "spring": {"spring", "springtime", "primavera", "primaverile"},
    "summer": {"summer", "summertime", "estate", "estivo", "estiva"},
    "autumn": {"autumn", "autumnal", "autunno", "autunnale"},
    "winter": {"winter", "wintertime", "wintry", "inverno", "invernale"},
}
MP3_BITRATES = (64, 80, 96, 112, 128, 160, 192, 224, 256, 320)


def get_season(file: Path, relative: Path) -> str | None:
    # Considera solo parole inequivocabili nel titolo o nelle cartelle.
    words = set(re.findall(r"[a-zàèéìòù]+", " ".join(relative.parts).casefold()))
    choices = [season for season, aliases in SEASONS.items() if words & aliases]
    return choices[0] if len(choices) == 1 else None


def execute(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, check=True)


def probe(file: Path) -> dict[str, Any]:
    raw = execute([
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=channels,sample_rate,codec_name:format=duration,bit_rate",
        "-of", "json", str(file),
    ])
    info = json.loads(raw.stdout)
    if not info.get("streams") or not info.get("format", {}).get("duration"):
        raise ValueError("Traccia audio o durata non leggibile")
    return info


def loudnorm_stats(file: Path, filters: list[str], target: float, peak: float) -> dict[str, Any]:
    af = filters + [f"loudnorm=I={target:g}:TP={peak:g}:LRA=11:print_format=json"]
    result = execute([
        "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info",
        "-i", str(file), "-map", "0:a:0", "-vn", "-af", ",".join(af),
        "-f", "null", "-",
    ])
    match = re.findall(r'\{\s*"input_i".*?\}', result.stderr, flags=re.S)
    if not match:
        raise ValueError("FFmpeg non ha prodotto le misure di loudness")
    data = json.loads(match[-1])
    for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset"):
        if not math.isfinite(float(data[key])):
            raise ValueError(f"Misura loudness non valida: {key}")
    return data


def eq_filters(args: argparse.Namespace) -> list[str]:
    filters = []
    if args.bass_db:
        filters.append(f"bass=f=120:g={args.bass_db:g}")
    if args.mid_db:
        filters.append(f"equalizer=f=950:t=q:w=0.9:g={args.mid_db:g}")
    if args.high_db:
        filters.append(f"treble=f=4600:g={args.high_db:g}")
    return filters


def mp3_bitrate(input_kbps: float, maximum: int) -> int:
    # Non aumentare artificialmente il bitrate degli MP3 già compressi.
    ceiling = min(maximum, int(input_kbps)) if input_kbps > 0 else maximum
    return max(64, max((x for x in MP3_BITRATES if x <= ceiling), default=64))


def sha256(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def conversion(file: Path, output: Path, args: argparse.Namespace) -> dict[str, Any]:
    before = probe(file)
    audio = before["streams"][0]
    channels = int(audio["channels"])
    if channels not in (1, 2):
        raise ValueError(f"Formato a {channels} canali: conversione non automatica")
    source_rate = int(audio["sample_rate"])
    rate = source_rate if source_rate in (32000, 44100, 48000) else 44100
    src_duration = float(before["format"]["duration"])
    source_kbps = float(before["format"].get("bit_rate") or 0) / 1000
    bit_rate = mp3_bitrate(source_kbps, args.mono_kbps if channels == 1 else args.stereo_kbps)
    filters = eq_filters(args)
    analysis = loudnorm_stats(file, filters, args.target_lufs, args.peak_dbtp)
    norm = (
        f"loudnorm=I={args.target_lufs:g}:TP={args.peak_dbtp:g}:LRA=11:"
        f"measured_I={analysis['input_i']}:measured_TP={analysis['input_tp']}:"
        f"measured_LRA={analysis['input_lra']}:"
        f"measured_thresh={analysis['input_thresh']}:"
        f"offset={analysis['target_offset']}:linear=true:print_format=summary"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".conquer-music-", suffix=".mp3", dir=output.parent)
    import os
    os.close(fd)
    tmp = Path(temp_name)
    try:
        peak_correction_db = 0.0
        final: dict[str, Any] | None = None
        # L'encoder MP3 può introdurre overshoot inter-sample. Se accade,
        # ricodifica sempre dall'originale con la compensazione necessaria,
        # evitando una seconda generazione lossy.
        for _ in range(3):
            encode_filters = filters + [norm]
            if peak_correction_db:
                encode_filters.append(f"volume={peak_correction_db:g}dB")
            execute([
                "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", "-y",
                "-i", str(file), "-map", "0:a:0", "-vn", "-map_metadata", "0",
                "-af", ",".join(encode_filters), "-ar", str(rate),
                "-ac", str(channels), "-c:a", "libmp3lame", "-b:a", f"{bit_rate}k",
                "-id3v2_version", "3", str(tmp),
            ])
            final = loudnorm_stats(tmp, [], args.target_lufs, args.peak_dbtp)
            excess = float(final["input_tp"]) - args.peak_dbtp
            if excess <= 0.02:
                break
            peak_correction_db -= excess + 0.05
        if final is None or float(final["input_tp"]) > args.peak_dbtp + 0.02:
            raise ValueError("Il true peak finale supera il limite dopo la compensazione MP3")
        after = probe(tmp)
        output_duration = float(after["format"]["duration"])
        output_channels = int(after["streams"][0]["channels"])
        if abs(output_duration - src_duration) > max(0.25, src_duration * .001):
            raise ValueError("La durata è cambiata oltre la tolleranza")
        if output_channels != channels:
            raise ValueError("Il numero di canali audio è cambiato")
        if tmp.stat().st_size == 0:
            raise ValueError("Output vuoto")
        result = {
            "original_bytes": file.stat().st_size,
            "processed_bytes": tmp.stat().st_size,
            "original_kbps": round(source_kbps, 1),
            "processed_kbps": bit_rate,
            "duration_seconds": round(src_duration, 2),
            "channels": channels,
            "input_lufs": float(analysis["input_i"]),
            "output_lufs": float(final["input_i"]),
            "output_true_peak_dbtp": float(final["input_tp"]),
            "peak_correction_db": round(peak_correction_db, 2),
        }
        # Solo dopo tutti i controlli l'output diventa definitivo.
        tmp.replace(output)
        return result
    finally:
        tmp.unlink(missing_ok=True)


def arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compressione e EQ delle musiche stagionali CONQUER")
    parser.add_argument("--input", type=Path, default=default_input(), help="Cartella originale MUSIC; rilevata automaticamente se lo script è nella cartella MUSIC o nella sua cartella padre")
    parser.add_argument("--output", type=Path, help="Cartella di destinazione (default: MUSIC_processed, accanto a MUSIC)")
    parser.add_argument("--all", action="store_true", help="Includi anche brani generici (default: SOLO stagionali)")
    parser.add_argument("--dry-run", action="store_true", help="Mostra i file candidati senza convertirli")
    parser.add_argument("--overwrite", action="store_true", help="Rielabora i file già presenti nell'output")
    parser.add_argument("--stereo-kbps", type=int, default=160, choices=MP3_BITRATES)
    parser.add_argument("--mono-kbps", type=int, default=96, choices=MP3_BITRATES)
    parser.add_argument("--target-lufs", type=float, default=-18, help="Loudness musicale, default -18 LUFS")
    parser.add_argument("--peak-dbtp", type=float, default=-1.5, help="Limite true peak, default -1.5 dBTP")
    parser.add_argument("--bass-db", type=float, default=0, help="EQ bassi (120 Hz), default flat")
    parser.add_argument("--mid-db", type=float, default=0, help="EQ medi (950 Hz), default flat")
    parser.add_argument("--high-db", type=float, default=0, help="EQ alti (4600 Hz), default flat")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = arguments(argv)
    for name in ("bass_db", "mid_db", "high_db"):
        if not (-12 <= getattr(args, name) <= 12):
            print(f"Errore: {name} deve essere compreso tra -12 e +12 dB", file=sys.stderr)
            return 2
    if not (-30 <= args.target_lufs <= -10 and -6 <= args.peak_dbtp <= -1):
        print("Errore: LUFS o true peak fuori dai limiti di sicurezza", file=sys.stderr)
        return 2
    source = args.input.expanduser().resolve()
    target = (args.output or (source.parent / "MUSIC_processed")).expanduser().resolve()
    if not source.is_dir():
        print(f"Cartella sorgente non trovata: {source}", file=sys.stderr)
        return 2
    if source == target or source in target.parents or target in source.parents:
        print("Sorgente e destinazione devono essere cartelle distinte e non annidate", file=sys.stderr)
        return 2
    candidates = []
    seen: dict[str, Path] = {}
    result: list[dict[str, Any]] = []
    for file in sorted(source.rglob("*"), key=lambda x: str(x).casefold()):
        if not file.is_file() or file.suffix.lower() not in EXTENSIONS:
            continue
        relative = file.relative_to(source)
        season = get_season(file, relative)
        if not season and not args.all:
            result.append({"source": str(relative), "status": "excluded_generic_or_ambiguous"})
            continue
        category = season or "generic"
        candidates.append((file, relative, category))
    print(f"CONQUER Music | sorgente: {source}")
    print(f"Destinazione: {target} | candidati: {len(candidates)} | modalità: {'dry-run' if args.dry_run else 'conversione'}")
    if not args.dry_run and not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        print("FFmpeg e FFprobe non trovati nel PATH: installare FFmpeg prima di procedere.", file=sys.stderr)
        return 2
    had_errors = False
    planned_outputs: set[Path] = set()
    for file, relative, season in candidates:
        # Se l'originale era WAV/FLAC, conserva il formato sorgente nel nome per evitare collisioni.
        name = file.name if file.suffix.lower() == ".mp3" else f"{file.stem}__{file.suffix[1:].lower()}.mp3"
        out = target / season / relative.parent / name
        row: dict[str, Any] = {"source": str(relative), "season": season, "output": str(out.relative_to(target))}
        if out in planned_outputs:
            row.update(status="duplicate_output_name")
        elif out.is_file() and not args.overwrite:
            row.update(status="already_present")
        elif args.dry_run:
            row.update(status="candidate")
        else:
            try:
                digest = sha256(file)
                if digest in seen:
                    row.update(status="duplicate_content", identical_to=str(seen[digest].relative_to(source)))
                else:
                    seen[digest] = file
                    row.update(conversion(file, out, args), status="processed")
            except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError, KeyError) as exc:
                had_errors = True
                row.update(status="error", error=str(exc)[-1000:])
        planned_outputs.add(out)
        result.append(row)
        print(f"  [{row['status']}] {relative} => {row['output']}")
    if not args.dry_run:
        target.mkdir(parents=True, exist_ok=True)
        report = {
            "source_directory": str(source),
            "output_directory": str(target),
            "settings": {
                "stereo_kbps": args.stereo_kbps, "mono_kbps": args.mono_kbps,
                "target_lufs": args.target_lufs, "peak_dbtp": args.peak_dbtp,
                "eq_db": {"bass": args.bass_db, "mid": args.mid_db, "high": args.high_db},
                "season_only": not args.all,
            },
            "tracks": result,
        }
        report_file = target / "music-processing-report.json"
        report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Report: {report_file}")
    if not candidates:
        print("Nessun brano stagionale trovato. Nessun file modificato.")
    return 1 if had_errors else 0


if __name__ == "__main__":
    sys.exit(main())
