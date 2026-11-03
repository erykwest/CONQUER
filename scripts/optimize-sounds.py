#!/usr/bin/env python3
"""Loss-aware compression of five oversized CONQUER clips on branch sound."""
import json
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'src/assets/sounds'
CATALOG = ROOT / 'src/settlement-sound-catalog.js'
REPORT = ROOT / 'docs/sound-compression-report.json'
TARGETS = {
    'spring': ('soundreality-spring-forest-nature-332842.mp3', 128, -24),
    'wind': ('soundreality-wind-blowing-457954.mp3', 128, -24),
    'thunder': ('soundreality-thunder-sound-375727.mp3', 128, -24),
    'choir': ('freesound_community-church-atmosphere-with-choir-54511.mp3', 96, -23),
    'bells': ('jasonlee3071-church-bells-194653.mp3', 96, -21),
}

def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration,bit_rate:stream=channels,sample_rate', '-of', 'json', str(path)
    ], text=True))

def analyze(path):
    task = subprocess.run([
        'ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af',
        'loudnorm=I=-23:TP=-3:LRA=11:print_format=json', '-f', 'null', '-'
    ], text=True, capture_output=True, check=True)
    found = re.search(r'\{\s*"input_i".*?\}', task.stderr, flags=re.S)
    if not found:
        raise RuntimeError('No loudness measurements: ' + str(path))
    result = json.loads(found.group(0))
    return float(result['input_i']), float(result['input_tp'])

def main():
    original = CATALOG.read_text(encoding='utf-8')
    found = re.search(r'const levels=(\{[^;]*\});', original)
    if not found:
        raise RuntimeError('Catalog lacks measured sound levels')
    levels = json.loads(found.group(1))
    results = []
    with tempfile.TemporaryDirectory(prefix='conquer-sound-') as tmpdir:
        for cue, (filename, kbps, target_lufs) in TARGETS.items():
            file = AUDIO / filename
            if not file.is_file():
                raise RuntimeError('Missing audio: ' + str(file))
            initial = probe(file)
            original_size = file.stat().st_size
            already = int(initial['format']['bit_rate']) <= (kbps + 5) * 1000
            if not already:
                processed = pathlib.Path(tmpdir) / filename
                subprocess.run([
                    'ffmpeg', '-hide_banner', '-nostats', '-loglevel', 'error', '-y',
                    '-i', str(file), '-map_metadata', '-1', '-vn',
                    '-c:a', 'libmp3lame', '-b:a', str(kbps) + 'k', str(processed)
                ], check=True)
                result = probe(processed)
                if abs(float(initial['format']['duration']) - float(result['format']['duration'])) > .18:
                    raise RuntimeError('Duration changed: ' + filename)
                if initial['streams'][0]['channels'] != result['streams'][0]['channels']:
                    raise RuntimeError('Channels changed: ' + filename)
                if processed.stat().st_size >= original_size:
                    raise RuntimeError('Compression did not save space: ' + filename)
                file.write_bytes(processed.read_bytes())
            lufs, peak = analyze(file)
            trim = round(min(target_lufs - lufs, -3 - peak), 2)
            levels[cue] = [round(lufs, 2), round(peak, 2), trim]
            results.append({'cue': cue, 'file': filename, 'original_bytes': original_size,
                'optimized_bytes': file.stat().st_size, 'bitrate_kbps': kbps,
                'lufs': round(lufs, 2), 'true_peak_dbtp': round(peak, 2),
                'trim_db': trim, 'skipped': already})
    replacement = 'const levels=' + json.dumps(levels, separators=(',', ':')) + ';'
    CATALOG.write_text(original[:found.start()] + replacement + original[found.end():], encoding='utf-8')
    REPORT.write_text(json.dumps({'policy': 'Originals on Drive; mono/stereo and duration preserved',
        'assets': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
