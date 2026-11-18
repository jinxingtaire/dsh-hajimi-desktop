"""Extract reproducible local source excerpts. No ASR or semantic classification.

Usage: python3 scripts/split_audio.py /absolute/path/to/source.mp4
"""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
dest = root / 'assets' / 'audio'
dest.mkdir(parents=True, exist_ok=True)

# Acoustic boundaries chosen from the source spectrogram and amplitude pauses.
# Descriptions express duration/texture, not a claim about what the cat says.
cuts = [
    ('tap-01', .10, .88, '短回应 A'),
    ('tap-02', 1.02, 1.88, '短回应 B'),
    ('phrase-01', .08, 4.40, '连续声段 01'),
    ('phrase-02', 4.58, 8.04, '连续声段 02'),
    ('phrase-03', 8.08, 11.16, '连续声段 03'),
    ('phrase-04', 11.20, 14.34, '连续声段 04'),
    ('phrase-05', 14.38, 17.04, '连续声段 05'),
    ('phrase-06', 17.20, 20.52, '连续声段 06'),
    ('phrase-07', 20.56, 23.45, '连续声段 07'),
    ('phrase-08', 24.46, 28.50, '连续声段 08'),
    ('tap-03', 28.60, 30.02, '尾部短回应'),
]
clips = []
selection_path=dest/'selection.json'
if selection_path.is_file():
    selection=json.loads(selection_path.read_text())
    allowed={i for category in selection['categories'] for i in category['clips']}
    cuts=[cut for cut in cuts if cut[0] in allowed]
    previous_path=dest/'manifest.json'
    if previous_path.is_file():
        clips=[c for c in json.loads(previous_path.read_text())['clips'] if c.get('sourceGroup')=='supplemental' and c['id'] in allowed]
for clip_id, start, end, label in cuts:
    duration = end - start
    output = dest / (clip_id + '.m4a')
    filters = (f'highpass=f=55,loudnorm=I=-20:TP=-2:LRA=8,'
               f'afade=t=in:st=0:d=0.012,afade=t=out:st={duration-.025:.3f}:d=0.025')
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',
                    '-i',str(args.source),'-ss',str(start),'-t',str(duration),
                    '-vn','-map_metadata','-1','-af',filters,'-ac','1','-ar','44100',
                    '-c:a','aac','-b:a','96k',str(output)], check=True)
    meta = json.loads(subprocess.check_output([
        'ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]))
    actual = float(meta['format']['duration'])
    if abs(actual - duration) > .15:
        raise RuntimeError(f'{clip_id}: unexpected duration {actual}')
    clips.append({'id':clip_id,'label':label,'url':f'assets/audio/{clip_id}.m4a',
                  'start':start,'end':end,'duration':round(actual,3),
                  'semanticVerified':False})

manifest = {
    'source':args.source.name,
    'note':'按声学边界切分；未直接试听，拟声词与吧唧嘴语义未经确认。事件映射为样机试配。',
    'processing':'原速原调，单声道 AAC；响度目标 -20 LUFS、真峰值 -2dB、首尾 12/25ms 淡化；不生成新声音。',
    'presets':{'meow':['tap-01','tap-02','tap-03'],
               'warn':['phrase-01','phrase-03'],
               'threat':['phrase-02','phrase-04','phrase-06'],
               'fight':['phrase-05','phrase-07'],'chew':[]},
    'clips':clips,
}
(dest / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
if selection_path.is_file():
    from curate_audio import curate
    curate(allow_partial=True)
print(f'Extracted and probed {len(clips)} clips into {dest}')
