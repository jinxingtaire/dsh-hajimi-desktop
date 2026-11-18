"""Import the 15 user-provided cat sounds without changing their originals.

Usage: python3 scripts/import_supplemental_audio.py /absolute/path/to/Downloads
Classification uses supplied filenames, not inferred/verified listening.
"""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('downloads', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
dest = root / 'assets' / 'audio'
originals = dest / 'originals'
originals.mkdir(parents=True, exist_ok=True)
manifest_path = dest / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
specs = [
    ('angry-old-cat', 'angry-old-cat.mp3', '生气猫叫', 'threat'),
    ('hungry-cat', 'cry-of-a-hungry-cat.mp3', '饿猫叫', 'meow'),
    ('cat-meow', 'the-sound-of-a-cat-quotmeowquot.mp3', '普通喵叫', 'meow'),
    ('unhappy-cat', 'the-sound-when-a-cat-is-unhappy-with-something.mp3', '不满猫叫', 'warn'),
]
specs += [(f'meow-{n}', f'meows/meow-{n}.mp3', f'meow-{n}', 'meow')
          for n in [13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 29]]
selection_path=dest/'selection.json'
if selection_path.is_file():
    selection=json.loads(selection_path.read_text())
    allowed={i for category in selection['categories'] for i in category['clips']}
    specs=[spec for spec in specs if spec[0] in allowed]

def probe(path):
    return float(json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'json', str(path)]))['format']['duration'])

added = []
for clip_id, relative, label, role in specs:
    source = args.downloads / relative
    duration = probe(source)
    analysis = subprocess.run([
        'ffmpeg', '-hide_banner', '-i', str(source),
        '-af', 'silencedetect=noise=-40dB:d=0.04', '-f', 'null', '-'],
        check=True, capture_output=True, text=True).stderr
    intervals = []
    pending = None
    for match in re.finditer(r'silence_(start|end):\s*([\d.]+)', analysis):
        if match[1] == 'start':
            pending = float(match[2])
        elif pending is not None:
            intervals.append((pending, float(match[2])))
            pending = None
    start, end = 0.0, duration
    if intervals and intervals[0][0] < .03:
        start = max(0.0, intervals[0][1] - .05)
    if intervals and intervals[-1][1] >= duration - .12:
        end = min(duration, intervals[-1][0] + .05)
    if end-start < .15:
        raise RuntimeError(f'No usable voiced excerpt in {source.name}')
    shutil.copy2(source, originals / source.name)
    target = dest / f'{clip_id}.m4a'
    length = end-start
    filters = (f'loudnorm=I=-20:TP=-2:LRA=8,'
               f'afade=t=in:st=0:d=0.008,'
               f'afade=t=out:st={length-.02:.4f}:d=0.02')
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(source),
        '-ss', str(start), '-t', str(length), '-vn', '-map_metadata', '-1',
        '-af', filters, '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k',
        str(target)], check=True)
    actual = probe(target)
    if abs(actual-length) > .15:
        raise RuntimeError(f'Unexpected exported duration: {target.name}')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error',
                    '-i', str(target), '-f', 'null', '-'], check=True)
    added.append({
        'id': clip_id, 'label': label, 'url': f'assets/audio/{target.name}',
        'sourceGroup': 'supplemental', 'sourceFile': source.name,
        'originalUrl': f'assets/audio/originals/{source.name}',
        'sourceDuration': round(duration, 4), 'start': round(start, 4),
        'end': round(end, 4), 'duration': round(actual, 4),
        'suggestedRole': role, 'classificationBasis': 'supplied-filename',
        'semanticVerified': False,
    })

manifest['clips'] = [c for c in manifest['clips']
                     if c.get('sourceGroup') != 'supplemental'] + added
manifest['presets']['meow'] = ['cat-meow', 'hungry-cat'] + [
    c['id'] for c in added if c['id'].startswith('meow-')]
manifest['presets']['warn'] = ['unhappy-cat', 'phrase-01', 'phrase-03']
manifest['presets']['threat'] = ['angry-old-cat', 'phrase-02', 'phrase-04', 'phrase-06']
manifest['presets']['fight'] = ['angry-old-cat', 'phrase-05', 'phrase-07']
manifest['supplementalCount'] = len(added)
manifest['note'] = ('原视频 11 段，加用户补充 15 条猫叫。补充素材按原文件名试配事件，'
                    '编号素材用于点击随机回应，未直接试听确认语义。吧唧嘴音效保持为空。')
manifest['processing'] = ('原速原调、单声道 AAC；响度目标 -20 LUFS、真峰值 -2dB，'
                         '首尾短淡化；补充音效仅裁首尾静音，原始 MP3 另存 originals/。')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
if selection_path.is_file():
    from curate_audio import curate
    curate(allow_partial=True)
print(f'Imported {len(added)} files; library now has {len(manifest["clips"])} clips.')
for c in added:
    print(f'{c["sourceFile"]}: {c["sourceDuration"]:.2f}s -> {c["duration"]:.2f}s ({c["suggestedRole"]})')
