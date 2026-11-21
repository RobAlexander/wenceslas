#!/usr/bin/env python3
"""Builds every sound effect in audio/sfx/ and writes CREDITS.md.

  * Some effects are trimmed from third-party CC0 clips (see SOURCED; fetch them first
    with tools/fetch_audio.sh).
  * The rest are synthesised here, with a fixed random seed, so a rebuild gives the same files.

Every effect ends up as the brief asks: mono, 8-bit, 11025 Hz WAV (Amiga-style).
Needs ffmpeg and SoX; uses only the Python standard library.   Usage: python3 tools/build_sounds.py
"""
import math, os, random, struct, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'audio' / 'source' / 'rpg-sounds-kenney' / 'OGG'
OUT = ROOT / 'audio' / 'sfx'
SR = 22050            # working sample rate; the final files are 11025 Hz
FINAL_RATE = 11025

PACK_URL = 'https://opengameart.org/content/50-rpg-sound-effects'
PACK_AUTHOR = 'Kenney Vleugels (kenney.nl)'
PACK_LICENCE = 'CC0 1.0'

# name: (source clip, start s, duration s or None, fade-out s, what it's for)
SOURCED = {
    'swing':      ('knifeSlice2.ogg',       0.00, 0.34, 0.14, 'sword swing'),
    'hit':        ('chop.ogg',              0.00, None, 0.03, 'sword hits a robber'),
    'pickup':     ('handleSmallLeather.ogg', 0.00, None, 0.03, 'food picked up'),
    'foodDrop':   ('dropLeather.ogg',       0.00, 0.34, 0.12, 'food dropped'),
    'deliver':    ('handleCoins2.ogg',      0.00, None, 0.05, 'food delivered to the old man'),
    'menuMove':   ('metalClick.ogg',        0.00, 0.12, 0.05, 'menu cursor moves'),
    'menuSelect': ('metalLatch.ogg',        0.00, None, 0.03, 'menu choice'),
}

# ---------------------------------------------------------------- synthesis helpers
rng = random.Random(20261120)
TAU = 2 * math.pi

def silence(sec): return [0.0] * int(sec * SR)

def mix(dst, src, at=0.0, gain=1.0):
    off = int(at * SR)
    if off + len(src) > len(dst): dst.extend([0.0] * (off + len(src) - len(dst)))
    for i, v in enumerate(src): dst[off + i] += v * gain
    return dst

def note(name):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = names[name[0]]; i = 1
    if name[i] == '#': n += 1; i += 1
    elif name[i] == 'b': n -= 1; i += 1
    return 440.0 * 2 ** ((n + 12 * (int(name[i:]) + 1) - 69) / 12)

def resonate(x, freq, bw):
    """Two-pole resonator: gives a noise or pulse source a vowel-like peak at freq."""
    r = math.exp(-math.pi * bw / SR); a1 = 2 * r * math.cos(TAU * freq / SR); a2 = -r * r
    y1 = y2 = 0.0; out = []
    for v in x:
        y = (1 - r) * v + a1 * y1 + a2 * y2
        out.append(y); y2, y1 = y1, y
    return out

def bell(freq, dur, decay=4.0, index=4.0, attack=0.003):
    """FM bell: a sine carrier modulated at 3.5x, with the modulation dying away faster."""
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        env = math.exp(-decay * t) * min(1.0, t / attack)
        idx = index * math.exp(-decay * 0.8 * t)
        out.append(env * (0.7 * math.sin(TAU * freq * t + idx * math.sin(TAU * freq * 3.5 * t)) + 0.3 * math.sin(TAU * freq * 2 * t)))
    return out

def voice(f0a, f0b, dur, formants, breath=0.08, attack=0.012, decay=6.0, roughness=0.0):
    """A sung or shouted vowel: a glottal pulse train gliding from f0a to f0b through formants."""
    n = int(dur * SR); phase = 0.0; src = []
    for i in range(n):
        t = i / n
        f0 = f0a * (f0b / f0a) ** t
        phase = (phase + f0 / SR) % 1.0
        pulse = (1 - 2 * phase) * (1 + roughness * rng.uniform(-1, 1))
        src.append(pulse + breath * rng.uniform(-1, 1))
    out = [0.0] * n
    for k, (f, bw) in enumerate(formants):
        for i, v in enumerate(resonate(src, f, bw)): out[i] += v / (1 + k)
    return [v * math.exp(-decay * (i / SR)) * min(1.0, (i / SR) / attack) for i, v in enumerate(out)]

def thump(dur, f0=140.0, f1=38.0, decay=14.0):
    out = []; phase = 0.0
    for i in range(int(dur * SR)):
        t = i / SR; f = f1 + (f0 - f1) * math.exp(-t * 30)
        phase += f / SR
        out.append(math.sin(TAU * phase) * math.exp(-decay * t))
    return out

def noise(dur, lp=0.3, decay=20.0, hp=0.0):
    out = []; y = 0.0; z = 0.0
    for i in range(int(dur * SR)):
        y += lp * (rng.uniform(-1, 1) - y); z += hp * (y - z)
        out.append((y - z if hp else y) * math.exp(-decay * i / SR))
    return out

def chirp(f0, f1, dur, decay=5.0, tremolo=0.0, harmonics=(1.0, 0.4, 0.15)):
    out = []; phase = 0.0
    n = int(dur * SR)
    for i in range(n):
        t = i / n; f = f0 + (f1 - f0) * t
        phase += f / SR
        trem = 1 - tremolo + tremolo * math.sin(TAU * 38 * i / SR)
        v = sum(h * math.sin(TAU * phase * (k + 1)) for k, h in enumerate(harmonics))
        out.append(v * trem * math.exp(-decay * i / SR) * min(1.0, i / (0.004 * SR)))
    return out

def organ(freq, dur, vib=5.0, depth=0.004, decay=2.0):
    out = []; phase = 0.0
    for i in range(int(dur * SR)):
        t = i / SR
        phase += freq * (1 + depth * math.sin(TAU * vib * t)) / SR
        v = math.sin(TAU * phase) + 0.5 * math.sin(TAU * 2 * phase) + 0.25 * math.sin(TAU * 3 * phase) + 0.12 * math.sin(TAU * 4 * phase)
        out.append(v * math.exp(-decay * t) * min(1.0, t / 0.03))
    return out

# ---------------------------------------------------------------- the synthesised effects
def synth_kill():     # robber killed: a thud, a gust of air and a low "uuh"
    s = thump(0.35)
    mix(s, noise(0.25, lp=0.5, decay=14), 0.0, 0.4)
    mix(s, voice(150, 70, 0.32, [(520, 90), (900, 120)], breath=0.15, decay=9, roughness=0.3), 0.02, 0.9)
    return s

def synth_hurt():     # Wenceslas hurt: a grunted "ugh"
    s = voice(190, 105, 0.34, [(620, 80), (1050, 110)], breath=0.12, decay=8, roughness=0.25)
    mix(s, noise(0.06, lp=0.6, decay=40), 0.0, 0.3)
    return s

def synth_page_die():  # page killed: a higher yelp that falls away
    s = voice(420, 190, 0.38, [(480, 70), (2100, 160)], breath=0.06, decay=7)
    mix(s, thump(0.18, f0=110, f1=45), 0.1, 0.4)
    return s

def synth_recruit():  # page recruited: two rising bell notes
    s = bell(note('E5'), 0.5, decay=7, index=3)
    mix(s, bell(note('B5'), 0.6, decay=6, index=3), 0.09)
    return s

def synth_night_complete():  # a bell arpeggio that settles into a chord
    s = []
    for i, n in enumerate(['C5', 'E5', 'G5', 'C6']):
        mix(s, bell(note(n), 1.1, decay=3.2, index=3), 0.13 * i)
    for n in ('C5', 'G5', 'E6'):
        mix(s, bell(note(n), 1.5, decay=2.4, index=2), 0.55, 0.55)
    return s

def synth_gameover():  # four sinking organ notes
    s = []; t = 0.0
    for n, d in (('E4', 0.32), ('D4', 0.32), ('C4', 0.32), ('A3', 1.0)):
        mix(s, organ(note(n), d + 0.25, decay=3.0 if d > 0.5 else 5.0), t)
        t += d
    return s

def synth_partridge():  # a grey partridge's "kee-uck, kee-uck": rising chirp, then a rasp
    s = []
    for at in (0.0, 0.55):
        mix(s, chirp(1500, 2700, 0.16, decay=9, tremolo=0.25), at, 0.8)
        mix(s, voice(260, 180, 0.12, [(900, 200), (2300, 300)], breath=0.5, decay=14, roughness=0.5), at + 0.17, 0.6)
    mix(s, chirp(1800, 3000, 0.1, decay=10, tremolo=0.2), 1.1, 0.5)
    return s

SYNTH = {
    'kill':          (synth_kill,           'robber killed'),
    'hurt':          (synth_hurt,           'Wenceslas hurt'),
    'pageDie':       (synth_page_die,       'page killed'),
    'recruit':       (synth_recruit,        'page recruited'),
    'nightComplete': (synth_night_complete, 'night complete'),
    'gameover':      (synth_gameover,       'game over'),
    'partridge':     (synth_partridge,      'the partridge'),
}

# ---------------------------------------------------------------- output
def write_wav(path, samples):
    peak = max(1e-9, max(abs(v) for v in samples))
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v / peak)) * 32000)) for v in samples))

def to_amiga(src_wav, dst):
    """Mono, 8-bit, 11025 Hz, normalised to -1 dB. No dither: the crunch is the point."""
    subprocess.run(['sox', str(src_wav), '-D', '-c', '1', '-b', '8', str(dst), 'rate', '-m', str(FINAL_RATE), 'norm', '-1'],
                   check=True, capture_output=True)

def decode(clip, start, dur, fade, dst):
    af = []
    if dur: af.append(f'atrim=0:{dur}')
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(clip)],
                           check=True, capture_output=True, text=True).stdout
    length = min(float(probe) - start, dur) if dur else float(probe) - start
    if fade: af.append(f'afade=t=out:st={max(0, length - fade):.3f}:d={fade}')
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(start), '-i', str(clip), '-ac', '1', '-ar', str(SR)]
    if af: cmd += ['-af', ','.join(af)]
    subprocess.run(cmd + [str(dst)], check=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for name, (clip, start, dur, fade, use) in SOURCED.items():
            if not (SRC / clip).exists():
                sys.exit(f'Missing {SRC / clip}\nRun tools/fetch_audio.sh first.')
            decode(SRC / clip, start, dur, fade, tmp / f'{name}.wav')
            to_amiga(tmp / f'{name}.wav', OUT / f'{name}.wav')
            rows.append((name, use, f'trimmed from `{clip}` in "50 RPG sound effects"', PACK_URL, PACK_AUTHOR, PACK_LICENCE))
        for name, (fn, use) in SYNTH.items():
            write_wav(tmp / f'{name}.wav', fn())
            to_amiga(tmp / f'{name}.wav', OUT / f'{name}.wav')
            rows.append((name, use, 'synthesised by `tools/build_sounds.py`', 'this repository', 'the project', 'CC0 1.0 (dedicated to the public domain)'))
    for name, *_ in rows:
        p = OUT / f'{name}.wav'
        print(f'{p.relative_to(ROOT)}  {p.stat().st_size:>6} bytes')
    write_credits(rows)

def write_credits(rows):
    lines = [
        '# Credits', '',
        'Every audio file in the game, with its source, author and licence.',
        'No file is under a non-commercial (NC) or no-derivatives (ND) licence.', '',
        '## Sound effects (`audio/sfx/`)', '',
        'Built by `tools/build_sounds.py`; the originals are downloaded by `tools/fetch_audio.sh`.',
        'Every file is converted to mono, 8-bit, 11025 Hz WAV.', '',
        '| File | Used for | Origin | Source URL | Author | Licence |',
        '|---|---|---|---|---|---|',
    ]
    for name, use, origin, url, author, lic in sorted(rows):
        lines.append(f'| `audio/sfx/{name}.wav` | {use} | {origin} | {url} | {author} | {lic} |')
    lines += [
        '', '## Music', '',
        'There are no music files. The music is written as tracker-style pattern data in `js/music-data.js`,',
        'and its instrument samples (bell, choir, strings, bass, percussion) are synthesised in the browser by `js/music.js`.',
        '',
        '- Tune: *Tempus adest floridum*, from *Piae Cantiones* (1582), the traditional melody of "Good King Wenceslas".',
        '  It is in the public domain.',
        '- Arrangement and instrument synthesis: original to this project, dedicated to the public domain (CC0 1.0).',
        '',
    ]
    (ROOT / 'CREDITS.md').write_text('\n'.join(lines))
    print('wrote CREDITS.md')

if __name__ == '__main__':
    main()
