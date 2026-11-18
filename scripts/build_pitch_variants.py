"""Prepare +1..+4 semitone cat calls, compensating tempo to retain duration."""
import json
import subprocess
import tempfile
import wave
from pathlib import Path

root=Path(__file__).resolve().parent.parent
dest=root/'assets'/'audio'
manifest_path=dest/'manifest.json'
manifest=json.loads(manifest_path.read_text())
(dest/'pitch').mkdir(exist_ok=True)
for clip in manifest['clips']:
    if clip['category']!='discontent':continue
    clip['pitchVariants']=[{'semitones':0,'url':clip['url'],'duration':clip['duration']}]
    for semitones in range(1,5):
        factor=2**(semitones/12)
        name=f'{clip["id"]}-up{semitones}.wav'
        filters=f'asetrate={44100*factor:.6f},aresample=44100,atempo={1/factor:.9f}'
        target=dest/'pitch'/name
        with tempfile.TemporaryDirectory(prefix='hajimi-pitch-') as folder:
            raw=Path(folder)/'pitch.wav'
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(root/clip['url']),
                            '-af',filters,'-ac','1','-ar','44100','-c:a','pcm_s16le',str(raw)],check=True)
            with wave.open(str(raw),'rb') as source:
                frames=source.readframes(source.getnframes())
            count=round(clip['duration']*44100)
            frames=frames[:count*2].ljust(count*2,b'\0')
            with wave.open(str(target),'wb') as output:
                output.setnchannels(1);output.setsampwidth(2);output.setframerate(44100);output.writeframes(frames)
        actual=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(target)]))['format']['duration'])
        if abs(actual-clip['duration'])>.045:raise RuntimeError(f'Duration drift in {name}: {actual}')
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(target),'-f','null','-'],check=True)
        clip['pitchVariants'].append({'semitones':semitones,'url':f'assets/audio/pitch/{name}','duration':actual})
manifest['pitchPolicy']={'minSemitones':0,'maxSemitones':4,'keepTempo':True,'pairGain':.2}
for obsolete in (dest/'pitch').glob('*.m4a'):obsolete.unlink()
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Built and decoded 24 pitch variants; durations retained to the nearest sample.')
