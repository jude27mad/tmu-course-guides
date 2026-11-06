uniform sampler2D tFluid;

uniform vec3 uColor;
uniform vec3 uBackgroundColor;

uniform float uIntensity;
// iPhone and iPad: the share of the canvas's height over which the effect fades out at its top and
// bottom edges, which are where Safari's bars begin (0 elsewhere: no fade).
uniform float uEdge;




void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {

    vec3 fluidColor = texture2D(tFluid, uv).rgb;


    vec4 texture = texture2D(inputBuffer, uv);

    // Safari shows the page under its bars, but not this canvas, which ends at the layout viewport: a
    // trail drawn there was cut in a straight line. It fades out before each bar instead.
    float edge = uEdge > 0.0 ? smoothstep(0.0, uEdge, uv.y) * smoothstep(0.0, uEdge, 1.0 - uv.y) : 1.0;

    float intensity = length(fluidColor) * uIntensity * edge;

    vec3 selectedColor = uColor * length(fluidColor);

    vec4 colorForFluidEffect = vec4(selectedColor, 1); // Set alpha to 0.5 for semi-transparency

    vec4 computedBgColor = vec4(uBackgroundColor, 1.);



    vec4 computedFluidColor = mix(texture, colorForFluidEffect, 0.0);

    vec4 finalColor;

    if(texture.a < 0.1) {
        finalColor = mix(computedBgColor, colorForFluidEffect, intensity);
    } else {
        finalColor = mix(computedFluidColor, computedBgColor, 1.0 - texture.a);
    }

    outputColor = finalColor;
}
