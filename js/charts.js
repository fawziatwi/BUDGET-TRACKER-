// Pure-SVG chart helpers — no external dependencies, returns SVG markup strings.

export function donutChart(segments, { size = 160, thickness = 22 } = {}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  if (total <= 0) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--sep)" stroke-width="${thickness}" />
    </svg>`;
  }

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const frac = seg.value / total;
      const dash = frac * circumference;
      const gap = circumference - dash;
      const rotation = (offset / total) * 360 - 90;
      offset += seg.value;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${thickness}"
        stroke-dasharray="${dash} ${gap}" stroke-linecap="butt"
        transform="rotate(${rotation} ${cx} ${cy})" />`;
    })
    .join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}</svg>`;
}

export function progressRing(pct, { size = 120, thickness = 12, color = 'var(--accent)' } = {}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const dash = clamped * circumference;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--sep)" stroke-width="${thickness}" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}"
      stroke-dasharray="${dash} ${circumference}" stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})" />
  </svg>`;
}

export function barChart(points, { width = 320, height = 120, color = 'var(--accent)' } = {}) {
  if (!points.length) return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
  const max = Math.max(...points.map((p) => p.value), 1);
  const gap = 6;
  const barWidth = (width - gap * (points.length - 1)) / points.length;
  const bars = points
    .map((p, i) => {
      const h = Math.max(2, (p.value / max) * (height - 24));
      const x = i * (barWidth + gap);
      const y = height - 20 - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${p.color || color}" />
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 6}" font-size="9" fill="var(--text-secondary)" text-anchor="middle">${p.label}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bars}</svg>`;
}

export function lineChart(points, { width = 320, height = 120, color = 'var(--accent)' } = {}) {
  if (points.length < 2) return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - 16 - ((p.value - min) / range) * (height - 32);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${height} L0,${height} Z`;
  const dots = coords
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" />`)
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <path d="${area}" fill="${color}" opacity="0.12" stroke="none" />
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}
  </svg>`;
}

export function progressBar(pct, { color = 'var(--accent)', height = 8 } = {}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const overColor = pct > 1 ? '#ff3b30' : color;
  return `<div class="progress-track" style="height:${height}px">
    <div class="progress-fill" style="width:${Math.min(1, clamped) * 100}%;background:${overColor}"></div>
  </div>`;
}
