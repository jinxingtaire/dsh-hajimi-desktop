"""Cut image_gen sprite sheets and encode looping GIFs with FFmpeg.

No illustration is drawn or retouched here; all character art is image_gen output.
"""
import json
import argparse
import re
import subprocess
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--asset-root',type=Path,default=Path(__file__).resolve().parent.parent/'assets'/'pets'/'hajimi-v1')
root=parser.parse_args().asset_root.resolve()
metadata={}
sequence=[0,0,1,2,3,4,5,6,7,7,6,5,4,3,2,1]
def run(args,**kwargs):return subprocess.run(args,check=True,**kwargs)
for name,source,fps,order in [('stress','stress',12,sequence),('warn','stress',8,[0,0,1,1,6,1,0,0]),('grooming','grooming',10,sequence)]:
    sheet=root/'sheets'/f'{source}.png'
    stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height','-of','json',str(sheet)]))['streams'][0]
    w,h=stream['width'],stream['height']
    frames=root/'frames'/name;frames.mkdir(parents=True,exist_ok=True)
    for index in range(8):
        col,row=index%4,index//4
        x0,x1=round(col*w/4),round((col+1)*w/4)
        y0,y1=round(row*h/2),round((row+1)*h/2)
        raw=frames/f'raw-{index:02}.png'
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(sheet),'-vf',f'crop={x1-x0}:{y1-y0}:{x0}:{y0}:exact=1','-frames:v','1',str(raw)])
        scan=run(['ffmpeg','-hide_banner','-i',str(raw),'-vf','alphaextract,bbox=min_val=180','-frames:v','1','-f','null','-'],capture_output=True,text=True).stderr
        match=re.search(r'x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+) w:(\d+) h:(\d+)',scan)
        if not match:raise RuntimeError(f'No sprite bounds: {name} {index}')
        left,right,top,bottom,cw,ch=map(int,match.groups())
        target=frames/f'{index:02}.png'
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(raw),'-vf',f'crop={cw}:{ch}:{left}:{top}:exact=1,pad=512:512:(ow-iw)/2:448-ih:color=0x00000000','-frames:v','1',str(target)])
    loop=root/'loops'/name;loop.mkdir(parents=True,exist_ok=True)
    for index,frame in enumerate(order):
        (loop/f'{index:02}.png').write_bytes((frames/f'{frame:02}.png').read_bytes())
    output=root/f'{name}.gif'
    filters='split[a][b];[a]palettegen=max_colors=192:reserve_transparent=1[p];[b][p]paletteuse=dither=none:alpha_threshold=190'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate',str(fps),'-i',str(loop/'%02d.png'),'-frames:v',str(len(order)),'-filter_complex',filters,'-loop','0','-gifflags','-offsetting-transdiff',str(output)])
    # Decode the complete animation for visual QA and frame-count verification.
    run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(output),'-f','null','-'])
    metadata[name]={'file':output.name,'width':512,'height':512,'frames':len(order),'fps':fps,'transparent':True,'loop':True,'bytes':output.stat().st_size,'sourceSheet':f'sheets/{source}.png'}
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(output),'-filter_complex',f'color=c=0xf6f3eb:s=512x512[bg];[bg][0:v]overlay=shortest=1','-frames:v','1',str(root/f'{name}-preview.png')])
    print(json.dumps(metadata[name]))
(root/'manifest.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
