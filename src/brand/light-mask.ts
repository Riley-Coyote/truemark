/** One-time monochrome Gaussian blur, independent of Safari's Canvas filter support. */
export function softenLightMask(data: Uint8ClampedArray, width: number, height: number, sigma = 5) {
  const radius = Math.ceil(sigma * 3);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma ** 2)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const horizontal = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.max(0, Math.min(width - 1, x + k));
        value += data[(y * width + xx) * 4] * weights[k + radius];
      }
      horizontal[y * width + x] = value / sum;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.max(0, Math.min(height - 1, y + k));
        value += horizontal[yy * width + x] * weights[k + radius];
      }
      const at = (y * width + x) * 4;
      data[at] = data[at + 1] = data[at + 2] = Math.round(value / sum);
      data[at + 3] = 255;
    }
  }
}
