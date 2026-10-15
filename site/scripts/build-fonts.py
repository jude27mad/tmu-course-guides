#!/usr/bin/env python3
"""Build public/fonts/InterDisplay-*.woff2 (+ one .woff for drei <Text>).

Source: the full Inter Display files from the inter-ui npm package 4.1.1
(Inter 4.1 by The Inter Project Authors, SIL OFL 1.1, no Reserved Font Name).
They replace the commercial Neue Haas Grotesk Display Pro faces the original used.

What this does to each face:
  * subsets to Latin + Latin Extended-A, Greek, punctuation, arrows, maths
    operators, shapes and dingbats (the symbols the course pages use);
  * copies Neue Haas Grotesk Display's vertical metrics (ascent .818,
    descent .182, line gap .200 per em) into hhea and OS/2 typo, with
    USE_TYPO_METRICS, so text sits at the same height inside the original
    overflow-hidden line reveals in every browser (Safari ignores the CSS
    ascent-override/descent-override descriptors, so it is baked in here).

Weight mapping (CSS weight -> face), matched on stem thickness:
  450 Light, 450 italic LightItalic, 550 Regular, 550 italic Italic,
  650 Bold, 750 ExtraBold.

Needs: pip install 'fonttools[woff]'.
Usage: python3 scripts/build-fonts.py [path/to/inter-ui/package]
"""
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'fonts')
FACES = ['Light', 'LightItalic', 'Regular', 'Italic', 'Bold', 'ExtraBold']
UNICODES = ('U+0000-00FF,U+0100-017F,U+0192,U+02BB-02BC,U+02C6-02C7,U+02D8-02DD,'
            'U+0300-0304,U+0308,U+030A,U+030C,U+0391-03A9,U+03B1-03C9,U+2000-206F,'
            'U+2070-209F,U+20AC,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2300-23FF,'
            'U+25A0-25FF,U+2600-26FF,U+2700-27BF,U+FEFF,U+FFFD')
FEATURES = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum', 'case', 'zero',
            'frac', 'numr', 'dnom', 'sups', 'subs']
NHG = {'ascent': 0.818, 'descent': 0.182, 'gap': 0.200}


def source_dir():
    if len(sys.argv) > 1:
        return sys.argv[1]
    tmp = tempfile.mkdtemp()
    subprocess.run(['npm', 'pack', '--silent', 'inter-ui@4.1.1'], cwd=tmp, check=True, stdout=subprocess.DEVNULL)
    with tarfile.open(os.path.join(tmp, 'inter-ui-4.1.1.tgz')) as t:
        t.extractall(tmp, filter='data')
    return os.path.join(tmp, 'package')


def parse_unicodes(spec):
    out = []
    for part in spec.split(','):
        a, _, b = part.replace('U+', '').partition('-')
        out.extend(range(int(a, 16), int(b or a, 16) + 1))
    return out


def build(src, face, flavor, features):
    font = TTFont(os.path.join(src, 'display', f'InterDisplay-{face}.woff2'))
    opts = subset.Options()
    opts.layout_features = features
    opts.flavor = flavor
    opts.name_IDs = ['*']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=parse_unicodes(UNICODES))
    sub.subset(font)
    upm = font['head'].unitsPerEm
    asc, desc, gap = (round(NHG[k] * upm) for k in ('ascent', 'descent', 'gap'))
    font['hhea'].ascent, font['hhea'].descent, font['hhea'].lineGap = asc, -desc, gap
    os2 = font['OS/2']
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = asc, -desc, gap
    os2.fsSelection |= 1 << 7  # USE_TYPO_METRICS
    font.flavor = flavor
    ext = 'woff2' if flavor == 'woff2' else 'woff'
    path = os.path.join(OUT, f'InterDisplay-{face}.{ext}')
    font.save(path)
    print(f'{os.path.relpath(path)}  {os.path.getsize(path) // 1024} KB')


def main():
    src = source_dir()
    os.makedirs(OUT, exist_ok=True)
    for face in FACES:
        build(src, face, 'woff2', FEATURES)
    # troika-three-text (drei <Text>) reads ttf/otf/woff but not woff2.
    build(src, 'Regular', 'woff', ['kern', 'liga'])
    shutil.copy(os.path.join(src, 'LICENSE.txt'), os.path.join(OUT, 'OFL.txt'))


if __name__ == '__main__':
    main()
