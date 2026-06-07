import type { Band } from './types'

/** CW band segments by frequency (Hz). Order matters only for readability. */
const BAND_RANGES: Array<{ band: Band; min: number; max: number }> = [
  { band: '160m', min: 1_800_000, max: 2_000_000 },
  { band: '80m', min: 3_500_000, max: 4_000_000 },
  { band: '40m', min: 7_000_000, max: 7_300_000 },
  { band: '20m', min: 14_000_000, max: 14_350_000 },
  { band: '15m', min: 21_000_000, max: 21_450_000 },
  { band: '10m', min: 28_000_000, max: 29_700_000 }
]

/** A representative CW frequency (Hz) per band — used when logging offline (no radio). */
const BAND_DEFAULT_FREQ: Record<string, number> = {
  '160m': 1_818_000,
  '80m': 3_530_000,
  '40m': 7_030_000,
  '20m': 14_030_000,
  '15m': 21_030_000,
  '10m': 28_030_000
}

/** Representative frequency for a band, or 0 if unknown. */
export function defaultFreqForBand(band: Band): number {
  return BAND_DEFAULT_FREQ[band] ?? 0
}

/** Map a frequency in Hz to a CWT band, or 'other' if outside the six bands. */
export function bandForFreq(freqHz: number): Band {
  for (const r of BAND_RANGES) {
    if (freqHz >= r.min && freqHz <= r.max) return r.band
  }
  return 'other'
}

/** Format a frequency in Hz as kHz with three decimals, e.g. 14_025_300 -> "14025.300". */
export function freqToKhz(freqHz: number): string {
  return (freqHz / 1000).toFixed(3)
}

/** Format a frequency in Hz as MHz for display, e.g. "14.025.30". */
export function freqToDisplay(freqHz: number): string {
  if (!freqHz) return '—'
  const mhz = Math.floor(freqHz / 1_000_000)
  const khz = Math.floor((freqHz % 1_000_000) / 1000)
    .toString()
    .padStart(3, '0')
  const hz = Math.floor((freqHz % 1000) / 10)
    .toString()
    .padStart(2, '0')
  return `${mhz}.${khz}.${hz}`
}
