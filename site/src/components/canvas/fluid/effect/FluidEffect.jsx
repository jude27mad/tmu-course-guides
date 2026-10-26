import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import fragmentShader from '@src/components/canvas/fluid/glsl/post.frag';
import hexToRgb from '@src/components/canvas/fluid/utils';

class FluidEffect extends Effect {
  constructor({ tFluid, intensity = 1.0, fluidColor = '#ffffff', backgroundColor = '#000000' } = {}) {
    const uniforms = new Map(
      Object.entries({
        tFluid: new Uniform(tFluid),
        uIntensity: new Uniform(intensity),
        uColor: new Uniform(hexToRgb(fluidColor)),
        uBackgroundColor: new Uniform(hexToRgb(backgroundColor)),
      }),
    );

    super('FluidEffect', fragmentShader, { uniforms });

    this.state = {
      tFluid,
      intensity,
      fluidColor,
      backgroundColor,
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

  update() {
    if (this.state.fluidColor !== this.state.cachedFluidColorString) {
      this.state.cachedFluidColorString = this.state.fluidColor;
      this.updateUniform('uColor', hexToRgb(this.state.fluidColor));
    }

    if (this.state.backgroundColor !== this.state.cachedBackgroundColorString) {
      this.state.cachedBackgroundColorString = this.state.backgroundColor;
      this.updateUniform('uBackgroundColor', hexToRgb(this.state.backgroundColor));
    }

    this.updateUniform('uIntensity', this.state.intensity);
  }
}

export default FluidEffect;
