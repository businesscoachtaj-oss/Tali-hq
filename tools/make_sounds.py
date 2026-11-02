#!/usr/bin/env python3
"""Tali HQ sleep sounds. Procedural, seamless loops, no licensing.
Writes 48 kHz mono WAV to tools/sounds_wav/, then run ffmpeg to make AAC for the app."""
import os, numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 72          # seconds per loop
OUT = os.path.join(os.path.dirname(__file__), "sounds_wav")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
N = SR * DUR
t = np.arange(N) / SR


def white(n=N):
    return rng.standard_normal(n)


def pink(n=N):
    # Paul Kellet's filter
    b = np.zeros(7); out = np.empty(n); w = white(n)
    for i in range(n):
        x = w[i]
        b[0] = 0.99886 * b[0] + x * 0.0555179; b[1] = 0.99332 * b[1] + x * 0.0750759
        b[2] = 0.96900 * b[2] + x * 0.1538520; b[3] = 0.86650 * b[3] + x * 0.3104856
        b[4] = 0.55000 * b[4] + x * 0.5329522; b[5] = -0.7616 * b[5] - x * 0.0168980
        out[i] = b.sum() + x * 0.5362; b[6] = x * 0.115926
    return out


def brown(n=N):
    x = np.cumsum(white(n)); x -= signal.lfilter([1, -1], [1, -0.9995], x)  # leak DC
    return x


def lowpass(x, hz, order=2):
    sos = signal.butter(order, hz, "low", fs=SR, output="sos"); return signal.sosfiltfilt(sos, x)


def highpass(x, hz, order=2):
    sos = signal.butter(order, hz, "high", fs=SR, output="sos"); return signal.sosfiltfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos"); return signal.sosfiltfilt(sos, x)


def slow_lfo(rate_hz, depth, n=N, seed=None):
    r = np.random.default_rng(seed)
    # smoothed random walk for organic swell
    k = int(SR / rate_hz / 4) | 1
    x = np.cumsum(r.standard_normal(n)); x = lowpass(x - x.mean(), rate_hz); x /= np.abs(x).max() + 1e-9
    return 1 + depth * x


def seamless(x, fade_s=3.0):
    """Crossfade the tail into the head so the loop has no seam."""
    f = int(fade_s * SR); x = x.copy()
    ramp = np.linspace(0, 1, f)
    head = x[:f] * ramp + x[-f:] * (1 - ramp)
    return np.concatenate([head, x[f:-f]])


def norm(x, peak=0.5):
    x = x - x.mean(); return x / (np.abs(x).max() + 1e-9) * peak


def save(name, x):
    x = seamless(norm(x))
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (x * 32767).astype(np.int16)); print(name, len(x) / SR, "s")


# 1 to 3: coloured noise, gently breathing so it doesn't feel like a fan
save("white_noise", lowpass(white(), 9000) * slow_lfo(0.05, 0.08, seed=1))
save("pink_noise", pink() * slow_lfo(0.05, 0.1, seed=2))
save("brown_noise", lowpass(brown(), 1500) * slow_lfo(0.04, 0.12, seed=3))

# 4: rain on a tin roof. Hiss bed, a mid "sheet" layer, plus random tin pings
bed = bandpass(white(), 800, 7000) * slow_lfo(0.08, 0.25, seed=4)
sheet = bandpass(white(), 200, 1200) * slow_lfo(0.03, 0.3, seed=5) * 0.6
pings = np.zeros(N)
for _ in range(int(DUR * 9)):
    i = rng.integers(0, N - SR); f0 = rng.uniform(1800, 4200); L = int(SR * rng.uniform(0.03, 0.09))
    env = np.exp(-np.linspace(0, 6, L)); pings[i:i + L] += np.sin(2 * np.pi * f0 * np.arange(L) / SR) * env * rng.uniform(0.05, 0.22)
drips = np.zeros(N)
for _ in range(int(DUR * 25)):
    i = rng.integers(0, N - SR); L = int(SR * 0.012)
    drips[i:i + L] += white(L) * np.exp(-np.linspace(0, 5, L)) * rng.uniform(0.1, 0.4)
save("rain_tin_roof", bed + sheet + lowpass(pings, 6000) + bandpass(drips, 1500, 8000))

# 5: mountain wind. Low brown gusts with a whistling band that wanders
gust = slow_lfo(0.06, 0.6, seed=6); gust = np.clip(gust, 0.15, None)
body = lowpass(brown(), 600) * gust
whistle = bandpass(white(), 300, 900) * np.clip(slow_lfo(0.09, 0.9, seed=7) - 0.6, 0, None) * 0.9
save("mountain_wind", body + whistle)

# 6: ocean. Waves every 9 to 13 seconds, each a swell of band noise with a foamy tail
ocean = lowpass(brown(), 400) * 0.35
pos = 0.0
while pos < DUR:
    period = rng.uniform(9, 13); L = int(SR * min(period, DUR - pos)); i = int(pos * SR)
    e = np.linspace(0, 1, L)
    env = np.exp(-((e - 0.28) ** 2) / 0.012) + 0.45 * np.exp(-((e - 0.5) ** 2) / 0.06)
    wave = bandpass(white(L), 150, 3500) * env * rng.uniform(0.7, 1.0)
    foam = bandpass(white(L), 2000, 7000) * np.exp(-((e - 0.55) ** 2) / 0.05) * 0.35
    ocean[i:i + L] += wave + foam; pos += period
save("ocean", ocean)

# 7: campfire. Low roar, mid crackle bed, sharp pops
roar = lowpass(brown(), 250) * slow_lfo(0.1, 0.3, seed=8) * 0.7
crackle = bandpass(white(), 1500, 6000) * np.clip(slow_lfo(2.0, 1.4, seed=9) - 0.9, 0, None) * 0.5
pops = np.zeros(N)
for _ in range(int(DUR * 2.2)):
    i = rng.integers(0, N - SR); L = int(SR * rng.uniform(0.004, 0.02))
    pops[i:i + L] += white(L) * np.exp(-np.linspace(0, 7, L)) * rng.uniform(0.3, 1.0)
save("campfire", roar + crackle + highpass(pops, 800))

# 8: night bush. Cricket chorus (pulsed tones around 4 to 5 kHz) over a soft creek
creek = bandpass(white(), 400, 3000) * slow_lfo(0.3, 0.2, seed=10) * 0.45 + lowpass(brown(), 300) * 0.15
crickets = np.zeros(N)
for k in range(6):
    f0 = rng.uniform(3900, 5200); rate = rng.uniform(5, 9); duty = rng.uniform(0.3, 0.5)
    phase = rng.uniform(0, 1); song = ((t * rate + phase) % 1) < duty
    # each cricket sings in bouts
    bout = slow_lfo(0.05, 1.0, seed=20 + k) > 0.9
    tone = np.sin(2 * np.pi * f0 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 70 * t))
    crickets += tone * song * bout * rng.uniform(0.03, 0.07)
save("night_bush", creek + crickets)
