import fragmentSource from "./hologram.frag.glsl?raw";
import { imageFor, type Expression } from "./expressions.js";

const VERTEX_SOURCE = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const SWITCH_MS = 250; // cross-fade between expressions
const SWITCH_GLITCH = 0.6;

type Texture = { texture: WebGLTexture; width: number; height: number };

// Draws the Red Queen on a canvas with the hologram shader.
export class HologramRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly textures = new Map<string, Promise<Texture>>();
  private current?: Texture;
  private previous?: Texture;
  private expression?: Expression;
  private switchStart = 0;
  private glitch = 0;
  private power = 0;
  private powerFrom = 0;
  private powerTo = 0;
  private powerStart = 0;
  private powerDuration = 1;
  private voice = 0;
  private blank = false; // the canvas already shows black and nothing changes

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;

    const program = gl.createProgram()!;
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    gl.useProgram(program);

    // One triangle that covers the whole screen.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const name of ["uImage", "uPrev", "uImageSize", "uPrevSize", "uResolution", "uTime", "uMix", "uVoice", "uGlitch", "uPower"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(this.uniforms.uImage, 0);
    gl.uniform1i(this.uniforms.uPrev, 1);

    requestAnimationFrame(this.frame);
  }

  async setExpression(expression: Expression) {
    if (expression === this.expression) return;
    this.expression = expression;
    const next = await this.load(imageFor(expression));
    if (this.expression !== expression) return; // changed again while loading
    this.previous = this.current ?? next;
    this.current = next;
    this.switchStart = performance.now();
    this.burst(SWITCH_GLITCH);
  }

  // 0..1, loudness of her voice; drives the interference.
  setVoiceLevel(level: number) {
    this.voice = level;
  }

  // Short burst of interference, decays by itself.
  burst(amount: number) {
    this.glitch = Math.max(this.glitch, amount);
  }

  // Fades the hologram in (1) or out (0).
  setPower(target: number, durationMs: number) {
    this.powerFrom = this.power;
    this.powerTo = target;
    this.powerStart = performance.now();
    this.powerDuration = Math.max(1, durationMs);
  }

  private readonly frame = (now: number) => {
    requestAnimationFrame(this.frame);
    this.resize();
    const gl = this.gl;

    const p = Math.min(1, (now - this.powerStart) / this.powerDuration);
    this.power = this.powerFrom + (this.powerTo - this.powerFrom) * p;
    this.glitch *= 0.93;

    // Faded out (standby): the shader would only draw black, so draw it once and then
    // leave the GPU alone until she fades in again. Saves power on the phone.
    if (this.power === 0 && this.powerTo === 0) {
      if (!this.blank) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.blank = true;
      }
      return;
    }
    this.blank = false;

    if (!this.current || !this.previous) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.current.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.previous.texture);
    gl.uniform2f(this.uniforms.uImageSize, this.current.width, this.current.height);
    gl.uniform2f(this.uniforms.uPrevSize, this.previous.width, this.previous.height);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.uTime, now / 1000);
    gl.uniform1f(this.uniforms.uMix, Math.min(1, (now - this.switchStart) / SWITCH_MS));
    gl.uniform1f(this.uniforms.uVoice, this.voice);
    gl.uniform1f(this.uniforms.uGlitch, this.glitch);
    gl.uniform1f(this.uniforms.uPower, this.power);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  private resize() {
    const width = Math.round(this.canvas.clientWidth * devicePixelRatio);
    const height = Math.round(this.canvas.clientHeight * devicePixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  private load(url: string): Promise<Texture> {
    let texture = this.textures.get(url);
    if (!texture) {
      texture = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(this.upload(image));
        image.onerror = () => reject(new Error(`could not load ${url}`));
        image.src = url;
      });
      this.textures.set(url, texture);
    }
    return texture;
  }

  private upload(image: HTMLImageElement): Texture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { texture, width: image.naturalWidth, height: image.naturalHeight };
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "compile failed");
    return shader;
  }
}
