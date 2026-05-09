/** Build discrete playback rates from min to max inclusive (e.g. 1.0, 1.05, … 1.2 with step 0.05). */
export function buildPlaybackSpeedOptions(
  min: number,
  max: number,
  step: number,
): number[] {
  if (step <= 0 || !Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return [1];
  }
  const out: number[] = [];
  let v = min;
  const guard = max + step * 0.5;
  while (v <= guard) {
    if (v <= max + 1e-9) {
      out.push(Number(v.toFixed(6)));
    }
    v += step;
  }
  const last = out[out.length - 1];
  if (last !== undefined && last < max - 1e-9) {
    out.push(Number(max.toFixed(6)));
  }
  return out;
}
