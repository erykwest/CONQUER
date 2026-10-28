#!/usr/bin/env python3
"""Reassemble verified seasonal Mureka MP3s; optimize conservatively, measure LUFS."""
import base64
import json
import pathlib
import re
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGING = ROOT / '.music-staging'
OUT = ROOT / 'src/assets/sounds/music'
CATALOG = ROOT / 'src/settlement-music-catalog.js'
REPORT = ROOT / 'docs/music-compression-report.json'
SOURCES = [["spring1","Primavera _ The Awakening Kingdom.mp3","spring",3570783],["spring2","Primavera _ The Awakening Kingdom (1).mp3","spring",3705023],["spring3","Primavera _ The Awakening Kingdom (3).mp3","spring",6222523],["summer1","Estate _ The Golden Harvest.mp3","summer",3962389],["summer2","Estate _ The Golden Harvest (1).mp3","summer",3623996],["autumn1","Autunno _ Whispers of the Harvest.mp3","autumn",3724765],["autumn2","Autunno _ Whispers of the Harvest (1).mp3","autumn",2983127],["winter1","Inverno _ The Silent Citadel.mp3","winter",3729666],["winter2","Inverno _ The Silent Citadel (1).mp3","winter",3586778]]

def probe(file):
    return json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries',
         'format=duration,bit_rate:stream=index,codec_name,channels,sample_rate',
         '-of', 'json', str(file)], text=True))

def loudness(file):
    r = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(file), '-af',
         'loudnorm=I=-22:TP=-3:LRA=11:print_format=json', '-f', 'null', '-'],
        capture_output=True, text=True, check=True)
    match = re.search(r'\{\s*"input_i".*?\}', r.stderr, flags=re.S)
    if not match:
        raise RuntimeError('Loudness data missing for ' + str(file))
    info = json.loads(match.group(0))
    return float(info['input_i']), float(info['input_tp'])

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    source = CATALOG.read_text(encoding='utf8')
    m = re.search(r'const values=(\[[^\n]*\]);', source)
    if not m:
        raise RuntimeError('Music catalog cannot be parsed')
    catalog = json.loads(m.group(1))
    lookup = {track[0]: track for track in catalog}
    if len(lookup) != len(SOURCES):
        raise RuntimeError('Only the nine distinct seasonal tracks are permitted')
    for cue, filename, season, length in SOURCES:
        track = lookup[cue]
        if track[1] != filename or track[2] != season:
            raise RuntimeError('Catalog-to-MP3 mismatch: ' + cue)
        folder = STAGING / cue
        chunks = sorted(folder.glob('*.b64'))
        target = OUT / filename
        if chunks:
            encoded = ''.join(p.read_text(encoding='ascii').strip() for p in chunks)
            data = base64.b64decode(encoded, validate=True)
            if len(data) != length:
                raise RuntimeError(f'Source size mismatch {cue}: {len(data)} vs {length}')
            if not (data[:3] == b'ID3' or (data[0] == 255 and (data[1] & 224) == 224)):
                raise RuntimeError('Invalid MP3 start: ' + cue)
        elif target.is_file():
            # Safe to rerun after the action has already finished.
            data = None
        else:
            raise RuntimeError('Missing staged source: ' + cue)
        with tempfile.TemporaryDirectory(prefix='conquer-score-') as temporary:
            tmp = pathlib.Path(temporary)
            source_file = tmp / 'source.mp3'
            if data is not None:
                source_file.write_bytes(data)
            else:
                source_file = target
            before = probe(source_file)
            stream = next((x for x in before['streams'] if x.get('codec_name') == 'mp3'), None)
            if stream is None:
                raise RuntimeError('Not an MP3 soundtrack: ' + cue)
            source_rate = int(before['format']['bit_rate'])
            if data is not None:
                if source_rate > 192000:
                    derived = tmp / 'optimized.mp3'
                    subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-loglevel', 'error', '-y',
                      '-i', str(source_file), '-map_metadata', '-1', '-vn',
                      '-c:a', 'libmp3lame', '-b:a', '160k', str(derived)], check=True)
                    after = probe(derived)
                    if abs(float(after['format']['duration']) - float(before['format']['duration'])) > .2:
                        raise RuntimeError('Music duration changed: ' + cue)
                    newstream = next(x for x in after['streams'] if x.get('codec_name') == 'mp3')
                    if int(newstream['channels']) != int(stream['channels']):
                        raise RuntimeError('Music channel layout changed: ' + cue)
                    if derived.stat().st_size >= len(data):
                        raise RuntimeError('No storage savings: ' + cue)
                    shutil.copyfile(derived, target)
                else:
                    target.write_bytes(data)
            after = probe(target)
            lufs, peak = loudness(target)
            gain = round(min(-22 - lufs, -3 - peak), 2)
            lookup[cue] = [cue,filename,season,gain,round(lufs,2),round(peak,2)]
            report.append({
                'id': cue,'season': season,'file': filename,
                'original_bytes': length,'stored_bytes': target.stat().st_size,
                'source_bitrate': source_rate,'final_bitrate': int(after['format']['bit_rate']),
                'duration_seconds': round(float(after['format']['duration']),2),
                'channels': int(stream['channels']),
                'lufs': round(lufs,2),'true_peak_dbtp':round(peak,2),'gain_db':gain,
                'reencoded': source_rate > 192000 if data is not None else False
            })
    updated = [lookup[entry[0]] for entry in catalog]
    text = 'const values=' + json.dumps(updated,ensure_ascii=False,separators=(',',':')) + ';'
    CATALOG.write_text(source[:m.start()] + text + source[m.end():], encoding='utf8')
    REPORT.write_text(json.dumps({'scope':'nine seasonal files; generic music excluded',
        'loudness_target_lufs':-22,'peak_ceiling_dbtp':-3,
        'originals':'Drive originals left untouched',
        'assets':report},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    if STAGING.is_dir():
        shutil.rmtree(STAGING)
    print(json.dumps({'tracks':len(report),'original_total':sum(x['original_bytes'] for x in report),
        'stored_total':sum(x['stored_bytes'] for x in report),'reencoded':sum(x['reencoded'] for x in report)},indent=2))

if __name__ == '__main__':
    main()
