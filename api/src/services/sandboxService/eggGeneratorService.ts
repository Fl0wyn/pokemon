// Forme d'oeuf réaliste : large en bas, pointu en haut
// path centré sur (100, 120) dans un viewBox 200x240
const EGG_PATH =
  "M100,30 C60,30 30,70 30,120 C30,170 60,210 100,210 C140,210 170,170 170,120 C170,70 140,30 100,30 Z";

function uid8(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function generateEggSvg(): string {
  const hue = Math.floor(Math.random() * 360);
  const id = uid8();

  const bands = Array.from({ length: 5 }, () => {
    const cy = 60 + Math.random() * 120;
    return `<line x1="30" y1="${cy}" x2="170" y2="${cy}" stroke="hsla(${hue + 180},60%,70%,0.45)" stroke-width="7"/>`;
  }).join("");

  const dots = Array.from({ length: 6 }, () => {
    const cx = 45 + Math.random() * 110;
    const cy = 50 + Math.random() * 140;
    const r = Math.random() * 7 + 4;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.3)"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
  <defs>
    <radialGradient id="grad-${id}" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="hsl(${hue},85%,80%)"/>
      <stop offset="100%" stop-color="hsl(${hue},60%,38%)"/>
    </radialGradient>
    <clipPath id="clip-${id}">
      <path d="${EGG_PATH}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#clip-${id})">
    <path d="${EGG_PATH}" fill="url(#grad-${id})"/>
    ${bands}
    ${dots}
  </g>
  <path d="${EGG_PATH}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2.5"/>
</svg>`;
}
