import { Effect } from 'postprocessing';
import { CanvasTexture, Uniform, Vector2 } from 'three';
import fragmentShader from '@src/components/canvas/fluid/glsl/post.frag';
import hexToRgb from '@src/components/canvas/fluid/utils';

class FluidEffect extends Effect {
  constructor({ tFluid, intensity = 1.0, fluidColor = '#ffffff', backgroundColor = '#000000', edge = 0 } = {}) {
    const uniforms = new Map(
      Object.entries({
        tFluid: new Uniform(tFluid),
        uIntensity: new Uniform(intensity),
        uColor: new Uniform(hexToRgb(fluidColor)),
        uBackgroundColor: new Uniform(hexToRgb(backgroundColor)),
        uEdge: new Uniform(edge),
        tRecord: new Uniform(null),
        uRecordTime: new Uniform(-1),
        uRecordSize: new Uniform(new Vector2()),
      }),
    );

    super('FluidEffect', fragmentShader, { uniforms });

    this.state = {
      tFluid,
      intensity,
      fluidColor,
      backgroundColor,
      edge,
      cachedFluidColorString: fluidColor,
      cachedBackgroundColorString: backgroundColor,
    };
  }

  updateUniform(key, value) {
    const uniform = this.uniforms.get(key);
    if (uniform && uniform.value !== value) {
      uniform.value = value;
    }
  }

  showRecord({ width, height }) {
    if (!this.recordTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.font = '750 176px "Inter Display", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#fff';
      context.fillText('New Best', 512, 132);
      this.recordTexture = new CanvasTexture(canvas);
      this.updateUniform('tRecord', this.recordTexture);
    }
    const messageWidth = Math.min(width * 0.9, 720);
    this.uniforms.get('uRecordSize').value.set(messageWidth / width, messageWidth / 4 / height);
    this.recordStarted = performance.now();
    this.updateUniform('uRecordTime', 0);
  }

  update() {
    if (this.uniforms.get('uRecordTime').value >= 0) {
      const age = (performance.now() - this.recordStarted) / 1000;
      this.updateUniform('uRecordTime', age < 2.4 ? age : -1);
    }
    if (this.state.fluidColor !== this.state.cachedFluidColorString) {
      this.state.cachedFluidColorString = this.state.fluidColor;
      this.updateUniform('uColor', hexToRgb(this.state.fluidColor));
    }

    if (this.state.backgroundColor !== this.state.cachedBackgroundColorString) {
      this.state.cachedBackgroundColorString = this.state.backgroundColor;
      this.updateUniform('uBackgroundColor', hexToRgb(this.state.backgroundColor));
    }

    this.updateUniform('uIntensity', this.state.intensity);
    this.updateUniform('uEdge', this.state.edge);
  }
}

export default FluidEffect;
