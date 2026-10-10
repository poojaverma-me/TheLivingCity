# Audio metrics (procedural WebAudio)

Generated 2026-10-09T08:02:56.208Z by `node scripts/audio-qa.mjs` (headless Chrome, OfflineAudioContext @ 48 kHz).

Limits: peak ≤ -1 dBFS · |DC| ≤ 0.002 · energy above 8 kHz ≤ 2 % · spectral centroid ≤ 4 kHz · no NaN / silence · SFX short-term loudness within ±1 dB of its target.

Loudness columns: **loud S** = max short-term (200 ms) K-weighted loudness (LUFS-like, dB); **loud I** = gated integrated loudness (BS.1770 style). SFX are measured after the runtime normalisation step (`normalizeVariants`).

## SFX

| sound | target | loud S | variant spread dB | norm gain dB | peak dBFS | RMS dB | dur s | |DC| | centroid Hz | >8k % | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ui_hover | -32 | -32.0 | 0.0 | -14.1 | -20.0 | -35.2 | 0.11 | 9.5e-6 | 1485 | 0.03 | ok |
| ui_click | -23 | -23.0 | 0.0 | -4.7 | -6.7 | -25.6 | 0.14 | 1.2e-4 | 805 | 0.03 | ok |
| ui_open | -23 | -23.0 | 0.0 | -7.0 | -16.3 | -32.0 | 0.84 | 2.1e-9 | 757 | 0.00 | ok |
| ui_close | -24 | -24.0 | 0.0 | -5.9 | -16.3 | -32.3 | 0.74 | 3.4e-9 | 768 | 0.00 | ok |
| discovery_chime | -17 | -17.0 | 0.0 | -4.8 | -9.2 | -26.4 | 2.48 | 1.2e-10 | 721 | 0.00 | ok |
| success_flourish | -17 | -17.0 | 0.0 | -7.1 | -8.2 | -27.3 | 2.36 | 2.0e-7 | 609 | 0.00 | ok |
| notebook_page | -24 | -24.0 | 0.0 | 7.6 | -7.3 | -29.5 | 0.46 | 3.0e-8 | 740 | 0.10 | ok |
| footstep_pave | -29 | -29.0 | 0.0 | -6.0 | -11.3 | -28.1 | 0.10 | 4.0e-8 | 99 | 0.00 | ok |
| footstep_metal | -28 | -28.0 | 0.0 | -5.2 | -8.7 | -29.3 | 0.13 | 1.0e-8 | 279 | 0.00 | ok |
| interact_ping | -21 | -21.0 | 0.0 | -9.4 | -15.2 | -31.1 | 1.65 | 4.8e-9 | 999 | 0.00 | ok |
| valve_turn | -22 | -22.0 | 0.0 | -2.9 | -8.3 | -31.2 | 1.08 | 2.4e-5 | 350 | 0.00 | ok |
| button_press | -22 | -22.0 | 0.0 | -2.9 | -6.5 | -23.8 | 0.15 | 6.5e-7 | 420 | 0.00 | ok |
| parcel_thunk | -20 | -20.0 | 0.0 | -6.5 | -6.0 | -22.7 | 0.22 | 1.7e-5 | 94 | 0.00 | ok |
| vesicle_bloop | -20 | -20.0 | 0.0 | -5.3 | -9.8 | -25.9 | 0.31 | 4.9e-10 | 336 | 0.00 | ok |
| vesicle_bud | -22 | -22.0 | 0.0 | -4.3 | -14.9 | -27.7 | 0.42 | 1.6e-6 | 404 | 0.00 | ok |
| bubble | -27 | -27.0 | 0.0 | -3.8 | -11.4 | -27.1 | 0.10 | 7.8e-5 | 713 | 0.04 | ok |
| whoosh | -21 | -21.0 | 0.0 | -1.8 | -11.6 | -29.4 | 1.61 | 1.0e-7 | 432 | 0.10 | ok |
| zap | -23 | -23.0 | 0.0 | -1.8 | -8.3 | -27.0 | 0.17 | 4.9e-6 | 926 | 0.01 | ok |
| atp_pop | -22 | -22.0 | 0.0 | -2.3 | -8.9 | -30.7 | 0.53 | 6.1e-10 | 1810 | 0.00 | ok |
| truck_honk | -20 | -20.0 | 0.0 | -12.9 | -13.6 | -24.1 | 0.43 | 3.6e-10 | 764 | 0.00 | ok |
| wave_hello | -22 | -22.0 | 0.0 | -11.5 | -17.0 | -27.7 | 0.49 | 1.3e-8 | 662 | 0.00 | ok |
| error_soft | -23 | -23.0 | 0.0 | -10.2 | -13.4 | -29.1 | 0.45 | 7.0e-9 | 264 | 0.00 | ok |
| typewriter_tick | -36 | -36.0 | 0.0 | -0.7 | -15.7 | -34.1 | 0.03 | 7.1e-7 | 1777 | 0.02 | ok |
| guide_blip | -26 | -26.0 | 0.0 | -3.2 | -14.7 | -27.4 | 0.14 | 5.8e-7 | 585 | 0.00 | ok |

Max deviation from target loudness: 0.00 dB.

## Ambience calibration

| name | target loud I | measured | level trim | suggested trim |
|---|---|---|---|---|
| mitochondria | -27 | -27.0 | 0.385 | 0.385 |
| golgi | -27 | -27.0 | 0.385 | 0.386 |
| lysosome | -29 | -28.4 | 1.400 | 1.313 |
| vacuole | -29 | -29.4 | 0.770 | 0.810 |
| nucleus | -29 | -29.0 | 0.710 | 0.712 |
| ser | -30 | -29.5 | 0.890 | 0.841 |
| membrane | -30 | -29.2 | 0.690 | 0.633 |
| truck | -26 | -25.3 | 0.430 | 0.395 |
| crowd | -31 | -30.6 | 2.300 | 2.185 |
| bed (stereo) | -30 | -30.0 | 0.194 | 0.194 |

## Ambience emitters (dry, at refDistance) and bed

Each emitter rendered dry for its full graph (continuous layers + scheduled events) at unity panner gain, i.e. what you hear at refDistance = 4 before bus faders.

| name | loud I | loud S max | peak dBFS | RMS dB | dur s | |DC| | centroid Hz | >8k % | status |
|---|---|---|---|---|---|---|---|---|---|
| mitochondria | -27.0 | -25.7 | -17.2 | -27.7 | 10.0 | 1.3e-5 | 127 | 0.00 | ok |
| golgi | -27.0 | -24.1 | -10.8 | -28.0 | 10.0 | 4.8e-4 | 166 | 0.00 | ok |
| lysosome | -28.4 | -23.0 | -11.4 | -30.7 | 10.0 | 6.9e-6 | 345 | 0.00 | ok |
| vacuole | -29.4 | -23.0 | -11.1 | -29.2 | 10.0 | 2.4e-4 | 240 | 0.00 | ok |
| nucleus | -29.0 | -28.3 | -18.8 | -29.7 | 10.0 | 6.5e-5 | 114 | 0.00 | ok |
| ser | -29.5 | -26.8 | -16.3 | -30.0 | 10.0 | 3.3e-4 | 134 | 0.00 | ok |
| membrane | -29.2 | -25.6 | -15.6 | -31.2 | 10.0 | 1.9e-4 | 468 | 0.00 | ok |
| truck | -25.3 | -24.6 | -13.7 | -26.3 | 10.0 | 5.6e-5 | 125 | 0.00 | ok |
| crowd | -30.6 | -24.5 | -10.9 | -32.8 | 9.8 | 3.5e-4 | 398 | 0.00 | ok |
| bed (stereo) | -30.0 | -27.0 | -17.2 | -30.5 | 20.0 | 1.0e-4 | 119 | 0.00 | ok |

## Music moods

Score rendered per mood (dry + 0.25 reverb-send stand-in), before the music bus fader.

| name | loud I | loud S max | peak dBFS | RMS dB | dur s | |DC| | centroid Hz | >8k % | status |
|---|---|---|---|---|---|---|---|---|---|
| explore | -20.1 | -14.4 | -5.7 | -22.0 | 40.0 | 5.0e-6 | 356 | 0.00 | ok |
| nucleus | -20.6 | -14.6 | -6.9 | -22.7 | 40.0 | 2.8e-6 | 401 | 0.00 | ok |
| mito | -20.5 | -15.1 | -6.7 | -22.1 | 40.0 | 6.3e-7 | 317 | 0.00 | ok |
| golgi | -20.1 | -14.4 | -7.1 | -21.9 | 40.0 | 1.4e-6 | 299 | 0.00 | ok |
| calm | -20.6 | -16.8 | -7.7 | -22.7 | 40.0 | 1.4e-6 | 402 | 0.00 | ok |
| wonder | -20.8 | -16.0 | -7.2 | -22.8 | 40.0 | 9.0e-7 | 410 | 0.00 | ok |
| explore · pad stem | -21.7 | -18.3 | -9.8 | -24.3 | 39.9 | 2.0e-7 | 473 | 0.00 | ok |
| explore · mallet stem | -24.5 | -16.6 | -8.5 | -29.4 | 40.0 | 3.4e-6 | 449 | 0.00 | ok |
| explore · bell stem | -33.6 | -27.1 | -24.1 | -51.1 | 20.1 | 4.3e-9 | 1787 | 0.00 | ok |
| explore · bass stem | -27.8 | -24.7 | -22.3 | -28.6 | 40.0 | 1.4e-6 | 54 | 0.00 | ok |
| nucleus · pad stem | -21.8 | -18.7 | -9.6 | -24.3 | 39.9 | 3.0e-7 | 430 | 0.00 | ok |
| nucleus · mallet stem | -27.1 | -18.5 | -13.8 | -31.1 | 40.0 | 8.0e-7 | 483 | 0.00 | ok |
| nucleus · bell stem | -29.9 | -21.4 | -15.1 | -41.5 | 32.1 | 1.2e-8 | 1625 | 0.00 | ok |
| nucleus · bass stem | -31.3 | -28.9 | -25.3 | -31.5 | 40.0 | 4.1e-6 | 46 | 0.00 | ok |
| nucleus · arp stem | -40.2 | -33.7 | -22.8 | -43.8 | 40.0 | 1.3e-7 | 592 | 0.00 | ok |

## Full mix

Engine graph end-to-end (buses at default volumes → reverb → glue comp → limiter → soft clip): music + bed + 3 emitters + repeated SFX barrage.

| name | loud I | loud S max | peak dBFS | RMS dB | dur s | |DC| | centroid Hz | >8k % | status |
|---|---|---|---|---|---|---|---|---|---|
| full mix (default volumes) | -17.8 | -14.1 | -3.2 | -19.5 | 24.0 | 3.6e-6 | 334 | 0.00 | ok |

## Spatial (HRTF panner, inverse distance, ref 4, max 45)

Pink-noise emitter, isometric camera at (0,30,30) looking at the origin; ear placed 5 u up the camera ray. L-R > 0 means louder on the left.

| probe | L dB | R dB | L-R dB | level vs 4u dB |
|---|---|---|---|---|
| right 8u | -41.7 | -31.0 | -10.6 |  |
| left 8u | -31.0 | -41.6 | 10.6 |  |
| ahead (screen up) 8u | -36.3 | -36.3 | 0.0 |  |
| distance 4u | -26.9 | -26.9 | 0.0 | 0.0 |
| distance 8u | -32.9 | -32.9 | 0.0 | -6.0 |
| distance 16u | -38.9 | -38.9 | 0.0 | -12.0 |
| distance 32u | -44.9 | -44.9 | 0.0 | -18.1 |
| distance 44u | -47.7 | -47.7 | 0.0 | -20.8 |

Beyond ~36 u the ambience manager additionally fades emitters to silence at maxDistance (45 u) and frees their graphs.

## Realtime smoke test

Everything running together in a live AudioContext for 6 s (bed, music, all 9 emitter types, an SFX every ~160 ms, some positional):

- master output peak: -3.3 dBFS, NaN samples: 0, update errors: 0, active emitters: 9, context: running
- SFX bank pre-render (all 24 sounds, all variants, incl. loudness analysis): 1855 ms (non-blocking; live fallback until ready)
- dialogue auto-duck: music bus duck gain 0.38 while voice plays, 0.96 2.5 s after it stops
- master chain gain at -24 dBFS: 3.98 dB (trim compensates DynamicsCompressor makeup)
- QA render time: 18.9 s

## Summary

All 50 rendered items within limits.
