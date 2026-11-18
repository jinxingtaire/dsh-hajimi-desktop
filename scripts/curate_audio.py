"""Apply the user's reviewed selection; move excluded project copies to Trash."""
import argparse
import json
import shutil
import uuid
from pathlib import Path

def curate(allow_partial=False):
    root=Path(__file__).resolve().parent.parent
    dest=root/'assets'/'audio'
    selection=json.loads((dest/'selection.json').read_text())
    manifest_path=dest/'manifest.json'
    manifest=json.loads(manifest_path.read_text())
    by_id={clip['id']:clip for clip in manifest['clips']}
    selected=[clip_id for category in selection['categories'] for clip_id in category['clips']]
    missing=[clip_id for clip_id in selected if clip_id not in by_id]
    if missing and not allow_partial:raise RuntimeError(f'Selected clips missing: {missing}')
    kept=[]
    for category in selection['categories']:
        for clip_id in category['clips']:
            if clip_id not in by_id:continue
            clip=by_id[clip_id]
            if not (root/clip['url']).is_file():raise RuntimeError(clip['url'])
            clip.update(category=category['id'],classificationBasis='user-reviewed',semanticVerified=True)
            clip['sourceGroup']=clip.get('sourceGroup','video')
            if clip_id=='unhappy-cat':clip['label']='生气猫叫'
            clip['suggestedRole']={'meow':'meow','discontent':'warn','angry':'fight'}[category['id']]
            kept.append(clip)
    keep_ids={clip['id'] for clip in kept}
    original_names={Path(clip['originalUrl']).name for clip in kept if clip.get('originalUrl')}
    excluded=[path for path in dest.glob('*.m4a') if path.stem not in selected]
    excluded += [path for path in (dest/'originals').glob('*.mp3') if path.name not in original_names]
    if excluded:
        trash=Path.home()/'.Trash'/f'hajimi-unselected-audio-{uuid.uuid4().hex[:10]}'
        trash.mkdir(parents=True)
        shutil.copy2(manifest_path,trash/'manifest-before.json')
        for path in excluded:
            target=trash/path.relative_to(dest);target.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(path),str(target))
        print(f'Moved {len(excluded)} unselected project copies to Trash.')
    manifest['clips']=kept
    manifest['categories']=[dict(category,clips=[i for i in category['clips'] if i in keep_ids]) for category in selection['categories']]
    manifest['presets']={role:[i for i in ids if i in keep_ids] for role,ids in selection['presets'].items()}
    manifest['supplementalCount']=sum(c['sourceGroup']=='supplemental' for c in kept)
    manifest['note']='用户已试听分类：普通 6 条、不满 6 条、生气 1 条。靠近时左右声道分别播放不同不满叫声；距离越近音调越高，音量稳定。'
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Curated library: {len(kept)} clips.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--allow-partial',action='store_true')
    curate(parser.parse_args().allow_partial)
