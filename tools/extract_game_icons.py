"""Extract the small UI sprites used by the inspector from a local SPAM installation.

Requires UnityPy (pip install UnityPy). Game code and card illustrations are never copied.
Assets retain their original owners' rights; see THIRD-PARTY-NOTICES.md.
"""
import argparse
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.tools/python'))
import UnityPy

parser=argparse.ArgumentParser()
parser.add_argument('--game-path', type=pathlib.Path, required=True)
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
output=root/'extension/assets/game'
output.mkdir(parents=True,exist_ok=True)
elements={'fire','water','earth','nature','shadow','light'}
symbols=elements|{'precision','critdamage','cooldown','gold','eternity','protection','random','luck','basedamage','temporality','heal'}
names={f'element_{name}' for name in elements}|{f'sprite_textmeshpro_{name}' for name in symbols}|{'gold_icon','card_multiplicator','card_critical'}
found=set()
for asset in (args.game_path/'SPAM_Data').glob('*.assets'):
    env=UnityPy.load(str(asset))
    for obj in env.objects:
        if obj.type.name!='Sprite':continue
        sprite=obj.read()
        if sprite.m_Name not in names:continue
        image=sprite.image
        if sprite.m_Name.startswith('element_'):
            watermark=image.copy();watermark.thumbnail((640,640));watermark.save(output/('element_watermark_'+sprite.m_Name.removeprefix('element_')+'.png'),optimize=True)
        image.thumbnail((128,128))
        image.save(output/(sprite.m_Name+'.png'),optimize=True)
        found.add(sprite.m_Name)
missing=names-found
if missing:raise SystemExit('Missing game sprites: '+', '.join(sorted(missing)))
print(f'Extracted {len(found)} UI icons to {output}')
