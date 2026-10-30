#version 300 es
// Red Queen screen look: red monochrome, projected wire grid, glow,
// scanlines, flicker, tearing and RGB split. See docs/redqueen-visuals.md#screen-look
precision highp float;

uniform sampler2D uImage;     // current expression
uniform sampler2D uPrev;      // previous expression (cross-fade)
uniform vec2 uImageSize;
uniform vec2 uPrevSize;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMix;           // 0 = previous image, 1 = current image
uniform float uVoice;         // 0..1, loudness of her voice
uniform float uGlitch;        // 0..1, extra interference (switches, endings)
uniform float uPower;         // 0..1, how visible the hologram is

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Fits the image into the screen without cropping.
vec2 containUv(vec2 uv, vec2 imageSize) {
  float screenAspect = uResolution.x / uResolution.y;
  float imageAspect = imageSize.x / imageSize.y;
  vec2 scale = screenAspect > imageAspect
    ? vec2(screenAspect / imageAspect, 1.0)
    : vec2(1.0, imageAspect / screenAspect);
  return (uv - 0.5) * scale + 0.5;
}

float luma(sampler2D tex, vec2 imageSize, vec2 uv) {
  vec2 p = containUv(uv, imageSize);
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
  return dot(texture(tex, p).rgb, vec3(0.299, 0.587, 0.114));
}

float figure(vec2 uv) {
  return mix(luma(uPrev, uPrevSize, uv), luma(uImage, uImageSize, uv), uMix);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;
  float interference = clamp(uGlitch + uVoice * 0.5 + (1.0 - uPower) * 0.6, 0.0, 1.0);

  // Horizontal tearing: random bands jump sideways, more with interference.
  float band = floor(uv.y * 28.0);
  float frame = floor(t * 14.0);
  float tear = step(1.0 - (0.03 + 0.25 * interference), hash(vec2(band, frame)));
  uv.x += tear * (hash(vec2(band + 7.0, frame)) - 0.5) * 0.15 * interference;
  // Slow wave, like an unstable projection.
  uv.x += sin(uv.y * 35.0 + t * 2.5) * 0.0015 * (0.4 + interference);

  // RGB split
  float split = 0.0015 + 0.012 * interference;
  float l = figure(uv);
  float lr = figure(uv + vec2(split, 0.0));
  float lb = figure(uv - vec2(split, 0.0));

  // Glow: blurred brightness around the figure.
  float glow = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    glow += figure(uv + vec2(cos(a), sin(a)) * 0.012);
  }
  glow /= 8.0;

  // Projected grid that bends with the contours of the figure.
  vec2 e = vec2(2.0 / uResolution.y, 0.0);
  vec2 gradient = vec2(figure(uv + e.xy) - figure(uv - e.xy), figure(uv + e.yx) - figure(uv - e.yx));
  vec2 gridUv = uv * vec2(uResolution.x / uResolution.y, 1.0) * 110.0 + gradient * 18.0;
  vec2 cell = abs(fract(gridUv) - 0.5);
  float gridLine = smoothstep(0.36, 0.5, max(cell.x, cell.y));
  float onFigure = smoothstep(0.04, 0.25, l);

  // Red monochrome with pink-white highlights.
  vec3 color = vec3(1.0, 0.07, 0.06) * pow(l, 0.9) * 1.25;
  color += vec3(1.0, 0.75, 0.72) * pow(l, 3.5) * 0.9;
  color *= 0.75 + 0.25 * (1.0 - gridLine);
  color += vec3(1.0, 0.35, 0.3) * gridLine * onFigure * (0.25 + 0.5 * l);
  color += vec3(0.9, 0.05, 0.04) * glow * 0.45;
  color.r += (lr - l) * 0.8;
  color.b += (lb - l) * 0.6;

  // Scanlines, flicker, noise, faint red background, vignette.
  color *= 0.88 + 0.12 * sin(gl_FragCoord.y * 1.6);
  color *= 0.94 + 0.06 * hash(vec2(frame, 3.0)) - interference * 0.15 * hash(vec2(t, 1.0));
  color += (hash(gl_FragCoord.xy + t) - 0.5) * 0.05;
  color += vec3(0.04, 0.0, 0.0);
  vec2 v = uv - 0.5;
  color *= 1.0 - dot(v, v) * 0.9;

  outColor = vec4(max(color, 0.0) * uPower, 1.0);
}
