---
theme: technical
---

# Signals and spectra

This document is a worked example of folio's math catalog: every
number in every table below is a formula, computed row by row as
you read. The signal is synthesized, transformed into the
frequency domain two ways (a textbook DFT and a radix-2 FFT), and
pushed through a recursive low-pass filter - all inside one
table, all visible in the Markdown source.

## Two tones

A one-second signal sampled 512 times a second (fs = 512 Hz): a
5 Hz sine at full amplitude and a 20 Hz sine at 0.6, summed
sample by sample. The `t` column is the sample time, `sig` the
signal itself - the table *is* the signal:

::: table {#signal}
caption: "A 512-sample signal: two sine tones, all formula columns"
columns:
  - {name: n, type: number, align: right}
  - {name: t, type: formula, unit: "s", align: right, expr: "(self.row - 1) / 512"}
  - {name: sig, type: formula, align: right, expr: "sin(2 * pi * 5 * t) + 0.6 * sin(2 * pi * 20 * t)"}
  - {name: lp, type: formula, align: right, expr: "0.03 * sig + (self.row == 1 ? sig : 0.97 * self.prev.lp)"}
  - {name: freq, type: formula, unit: "Hz", align: right, expr: "self.row - 1"}
  - {name: re, type: formula, align: right, expr: "round(dftRe(self.col.sig, self.row - 1), 6)"}
  - {name: im, type: formula, align: right, expr: "round(dftIm(self.col.sig, self.row - 1), 6)"}
  - {name: mag, type: formula, align: right, expr: "sqrt(re * re + im * im)"}
  - {name: fftmag, type: formula, align: right, expr: "round(at(fft(self.col.sig), self.row - 1), 6)"}
  - {name: lpmag, type: formula, align: right, expr: "round(dftMag(self.col.lp, self.row - 1), 6)"}
data:
  - [1]
  - [2]
  - [3]
  - [4]
  - [5]
  - [6]
  - [7]
  - [8]
  - [9]
  - [10]
  - [11]
  - [12]
  - [13]
  - [14]
  - [15]
  - [16]
  - [17]
  - [18]
  - [19]
  - [20]
  - [21]
  - [22]
  - [23]
  - [24]
  - [25]
  - [26]
  - [27]
  - [28]
  - [29]
  - [30]
  - [31]
  - [32]
  - [33]
  - [34]
  - [35]
  - [36]
  - [37]
  - [38]
  - [39]
  - [40]
  - [41]
  - [42]
  - [43]
  - [44]
  - [45]
  - [46]
  - [47]
  - [48]
  - [49]
  - [50]
  - [51]
  - [52]
  - [53]
  - [54]
  - [55]
  - [56]
  - [57]
  - [58]
  - [59]
  - [60]
  - [61]
  - [62]
  - [63]
  - [64]
  - [65]
  - [66]
  - [67]
  - [68]
  - [69]
  - [70]
  - [71]
  - [72]
  - [73]
  - [74]
  - [75]
  - [76]
  - [77]
  - [78]
  - [79]
  - [80]
  - [81]
  - [82]
  - [83]
  - [84]
  - [85]
  - [86]
  - [87]
  - [88]
  - [89]
  - [90]
  - [91]
  - [92]
  - [93]
  - [94]
  - [95]
  - [96]
  - [97]
  - [98]
  - [99]
  - [100]
  - [101]
  - [102]
  - [103]
  - [104]
  - [105]
  - [106]
  - [107]
  - [108]
  - [109]
  - [110]
  - [111]
  - [112]
  - [113]
  - [114]
  - [115]
  - [116]
  - [117]
  - [118]
  - [119]
  - [120]
  - [121]
  - [122]
  - [123]
  - [124]
  - [125]
  - [126]
  - [127]
  - [128]
  - [129]
  - [130]
  - [131]
  - [132]
  - [133]
  - [134]
  - [135]
  - [136]
  - [137]
  - [138]
  - [139]
  - [140]
  - [141]
  - [142]
  - [143]
  - [144]
  - [145]
  - [146]
  - [147]
  - [148]
  - [149]
  - [150]
  - [151]
  - [152]
  - [153]
  - [154]
  - [155]
  - [156]
  - [157]
  - [158]
  - [159]
  - [160]
  - [161]
  - [162]
  - [163]
  - [164]
  - [165]
  - [166]
  - [167]
  - [168]
  - [169]
  - [170]
  - [171]
  - [172]
  - [173]
  - [174]
  - [175]
  - [176]
  - [177]
  - [178]
  - [179]
  - [180]
  - [181]
  - [182]
  - [183]
  - [184]
  - [185]
  - [186]
  - [187]
  - [188]
  - [189]
  - [190]
  - [191]
  - [192]
  - [193]
  - [194]
  - [195]
  - [196]
  - [197]
  - [198]
  - [199]
  - [200]
  - [201]
  - [202]
  - [203]
  - [204]
  - [205]
  - [206]
  - [207]
  - [208]
  - [209]
  - [210]
  - [211]
  - [212]
  - [213]
  - [214]
  - [215]
  - [216]
  - [217]
  - [218]
  - [219]
  - [220]
  - [221]
  - [222]
  - [223]
  - [224]
  - [225]
  - [226]
  - [227]
  - [228]
  - [229]
  - [230]
  - [231]
  - [232]
  - [233]
  - [234]
  - [235]
  - [236]
  - [237]
  - [238]
  - [239]
  - [240]
  - [241]
  - [242]
  - [243]
  - [244]
  - [245]
  - [246]
  - [247]
  - [248]
  - [249]
  - [250]
  - [251]
  - [252]
  - [253]
  - [254]
  - [255]
  - [256]
  - [257]
  - [258]
  - [259]
  - [260]
  - [261]
  - [262]
  - [263]
  - [264]
  - [265]
  - [266]
  - [267]
  - [268]
  - [269]
  - [270]
  - [271]
  - [272]
  - [273]
  - [274]
  - [275]
  - [276]
  - [277]
  - [278]
  - [279]
  - [280]
  - [281]
  - [282]
  - [283]
  - [284]
  - [285]
  - [286]
  - [287]
  - [288]
  - [289]
  - [290]
  - [291]
  - [292]
  - [293]
  - [294]
  - [295]
  - [296]
  - [297]
  - [298]
  - [299]
  - [300]
  - [301]
  - [302]
  - [303]
  - [304]
  - [305]
  - [306]
  - [307]
  - [308]
  - [309]
  - [310]
  - [311]
  - [312]
  - [313]
  - [314]
  - [315]
  - [316]
  - [317]
  - [318]
  - [319]
  - [320]
  - [321]
  - [322]
  - [323]
  - [324]
  - [325]
  - [326]
  - [327]
  - [328]
  - [329]
  - [330]
  - [331]
  - [332]
  - [333]
  - [334]
  - [335]
  - [336]
  - [337]
  - [338]
  - [339]
  - [340]
  - [341]
  - [342]
  - [343]
  - [344]
  - [345]
  - [346]
  - [347]
  - [348]
  - [349]
  - [350]
  - [351]
  - [352]
  - [353]
  - [354]
  - [355]
  - [356]
  - [357]
  - [358]
  - [359]
  - [360]
  - [361]
  - [362]
  - [363]
  - [364]
  - [365]
  - [366]
  - [367]
  - [368]
  - [369]
  - [370]
  - [371]
  - [372]
  - [373]
  - [374]
  - [375]
  - [376]
  - [377]
  - [378]
  - [379]
  - [380]
  - [381]
  - [382]
  - [383]
  - [384]
  - [385]
  - [386]
  - [387]
  - [388]
  - [389]
  - [390]
  - [391]
  - [392]
  - [393]
  - [394]
  - [395]
  - [396]
  - [397]
  - [398]
  - [399]
  - [400]
  - [401]
  - [402]
  - [403]
  - [404]
  - [405]
  - [406]
  - [407]
  - [408]
  - [409]
  - [410]
  - [411]
  - [412]
  - [413]
  - [414]
  - [415]
  - [416]
  - [417]
  - [418]
  - [419]
  - [420]
  - [421]
  - [422]
  - [423]
  - [424]
  - [425]
  - [426]
  - [427]
  - [428]
  - [429]
  - [430]
  - [431]
  - [432]
  - [433]
  - [434]
  - [435]
  - [436]
  - [437]
  - [438]
  - [439]
  - [440]
  - [441]
  - [442]
  - [443]
  - [444]
  - [445]
  - [446]
  - [447]
  - [448]
  - [449]
  - [450]
  - [451]
  - [452]
  - [453]
  - [454]
  - [455]
  - [456]
  - [457]
  - [458]
  - [459]
  - [460]
  - [461]
  - [462]
  - [463]
  - [464]
  - [465]
  - [466]
  - [467]
  - [468]
  - [469]
  - [470]
  - [471]
  - [472]
  - [473]
  - [474]
  - [475]
  - [476]
  - [477]
  - [478]
  - [479]
  - [480]
  - [481]
  - [482]
  - [483]
  - [484]
  - [485]
  - [486]
  - [487]
  - [488]
  - [489]
  - [490]
  - [491]
  - [492]
  - [493]
  - [494]
  - [495]
  - [496]
  - [497]
  - [498]
  - [499]
  - [500]
  - [501]
  - [502]
  - [503]
  - [504]
  - [505]
  - [506]
  - [507]
  - [508]
  - [509]
  - [510]
  - [511]
  - [512]
:::

The time domain plot - 512 samples, two visible wiggles:

::: chart {#time-chart}
source: @signal
query: {select: [n, sig]}
type: line
caption: "Time domain: a 5 Hz tone riding a 20 Hz ripple (512 samples = 1 s)"
:::

## From time to frequency

A signal can be described two ways: as it changes in time (above)
or as the pure tones it is built from (below). The bridge is the
discrete Fourier transform. For each frequency bin *k* it asks:
how much of the signal rotates *k* times per window? Using
Euler's formula, one bin of the DFT is a single sum:

$$
X_k = \sum_{n=0}^{N-1} x_n \, e^{-i\,2\pi k n / N}
$$

Splitting $e^{-i\theta}$ into its real and imaginary parts gives
the two sums the table computes per row (`re` and `im`, rounded
to six decimals so the table reads like a report, not a float
dump), and the magnitude of a complex number - the length of its
vector - is the `mag` column, exactly as written:

$$
|X_k| = \sqrt{(\mathrm{Re}\, X_k)^2 + (\mathrm{Im}\, X_k)^2}
$$

The per-bin cost is the textbook implementation - O(N) per bin,
O(N^2) for the whole spectrum, and completely unambiguous:

```ts
function dftBin(x: number[], k: number): [number, number] {
  const N = x.length;
  let re = 0;
  let im = 0;
  for (let n = 0; n < N; n++) {
    const angle = (-2 * Math.PI * k * n) / N;
    re += x[n] * Math.cos(angle);
    im += x[n] * Math.sin(angle);
  }
  return [re, im];
}
```

Because `fs` is 512 Hz and the window holds 512 samples, bin *k*
is literally the frequency *k* Hz - the `freq` column. The
interesting band is the low end, so the chart filters to the
first 32 Hz (the same Jexl filters every chart speaks):

::: chart {#spectrum-chart}
source: @signal
query: {select: [freq, mag], filter: "freq <= 32"}
type: bar
caption: "Frequency domain (0-32 Hz): energy peaks at 5 Hz and 20 Hz"
:::

Two things deserve a look. The peaks land at exactly 256 and
153.6 - that is N/2 times each tone's amplitude, the DFT's
promise. And the full spectrum in the table is mirrored around
the Nyquist frequency (256 Hz): a 5 Hz tone also appears at 507
Hz, because a real-valued signal cannot tell +5 from -5 apart.
Both halves carry the same information - which is why plotting
the first 32 Hz loses nothing.

## The FFT: divide and conquer

The fast Fourier transform computes the same bins, but it never
computes a bin from scratch. It splits the signal into even- and
odd-indexed samples, transforms each half (recursively), and
stitches them with the butterfly - the two outputs of one
complex multiply:

$$
X_k = E_k + e^{-i 2\pi k/N} O_k \qquad
X_{k+N/2} = E_k - e^{-i 2\pi k/N} O_k
$$

An iterative radix-2 version - bit-reverse the input order, then
fly through the butterflies - runs in O(N log N) instead of
O(N^2), which is the difference between a heartbeat and a coffee
break at a million samples:

```ts
function fftMagnitudes(x: number[]): number[] {
  const N = x.length; // power of two
  const re = [...x];
  const im = new Array(N).fill(0);
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] = re[a] + tr;
        im[a] = im[a] + ti;
      }
    }
  }
  return re.map((r, k) => Math.hypot(r, im[k]));
}
```

The table's `fftmag` column runs this against the whole `sig`
column and picks out one bin per row (`at(fft(...), k)`). Compare
`mag` and `fftmag` in the table: they agree to floating-point
rounding - two very different algorithms, one answer. At 512
samples the DFT columns grind through 512 bins the slow way;
the FFT column does the whole spectrum in nine butterfly passes.

## Filters: smoothing in time

A one-pole exponential moving average is the simplest recursive
low-pass filter: each output is a blend of the current input and
the previous output.

$$
y_n = \alpha\, x_n + (1-\alpha)\, y_{n-1}
$$

That recurrence is exactly what the `lp` column computes - note
`self.prev.lp`, the previous row of the formula's own column, the
same mechanism that powers running totals:

```ts
function ema(x: number[], alpha: number): number[] {
  const y: number[] = [];
  for (let n = 0; n < x.length; n++) {
    y.push(n === 0 ? x[0] : alpha * x[n] + (1 - alpha) * y[n - 1]);
  }
  return y;
}
```

The price of smoothing is lag: the filtered curve below starts
at the signal's first value and takes a few dozen samples to
settle into its slower rhythm:

::: chart {#filtered-time-chart}
source: @signal
query: {select: [n, lp]}
type: line
caption: "The filtered signal: the 20 Hz ripple is gone"
:::

## Hearing the filter in the spectrum

What did the filter do? Take the DFT of the *filtered* signal -
the `lpmag` column - and plot it against frequency:

::: chart {#filtered-spectrum-chart}
source: @signal
query: {select: [freq, lpmag], filter: "freq <= 32"}
type: bar
caption: "The filtered spectrum (0-32 Hz): high tones fade, low tones survive"
:::

The 20 Hz tone is crushed to about 12% of its amplitude while the
5 Hz tone keeps about 44%. That is what "low-pass" means, made
measurable. The cutoff of an EMA with smoothing factor $\alpha$
sampled at $f_s$ sits at:

$$
f_c = -\frac{f_s}{2\pi} \ln(1-\alpha)
$$

With $\alpha = 0.03$ and $f_s = 512\,\mathrm{Hz}$ that is about
2.48 Hz - well below both tones, which is why they both shrink,
the higher one faster.

## Try it

Nothing here is static. Switch to the Markdown view and change
the second tone in `sig` from 20 to 40 - the spectrum peak slides
to 40 Hz and its mirror to 472. Raise the 20 Hz amplitude past
the 5 Hz one and watch the time-domain plot change its mind about
which wiggle dominates. Raise $\alpha$ to 0.2 in `lp` and the
cutoff climbs to about 18 Hz - the 20 Hz tone starts to survive.
Every chart follows, because every chart is a query over the
same living table.
