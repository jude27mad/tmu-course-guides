uniform sampler2D tFluid;

uniform vec3 uColor;
uniform vec3 uBackgroundColor;

uniform float uIntensity;
// iPhone and iPad: the share of the canvas's height over which the effect fades out at its top and
// bottom edges, which are where Safari's bars begin (0 elsewhere: no fade).
uniform float uEdge;
uniform sampler2D tRecord;
uniform float uRecordTime;
uniform vec2 uRecordSize;




void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {

    vec3 fluidColor = texture2D(tFluid, uv).rgb;


    vec4 sceneColor = texture2D(inputBuffer, uv);

    float intensity = length(fluidColor) * uIntensity;

    vec3 selectedColor = uColor * length(fluidColor);

    vec4 colorForFluidEffect = vec4(selectedColor, 1); // Set alpha to 0.5 for semi-transparency

    vec4 computedBgColor = vec4(uBackgroundColor, 1.);



    vec4 computedFluidColor = mix(sceneColor, colorForFluidEffect, 0.0);

    vec4 finalColor;

    if(sceneColor.a < 0.1) {
        finalColor = mix(computedBgColor, colorForFluidEffect, intensity);
    } else {
        finalColor = mix(computedFluidColor, computedBgColor, 1.0 - sceneColor.a);
    }

    // Safari shows the page under its bars, but not this canvas, which ends at the layout viewport: a
    // trail drawn there was cut in a straight line. The visible result fades out before each bar instead:
    // the colour as the screen shows it (clamped), not the intensity, which a strong trail saturates
    // until a few pixels from the edge.
    float edge = uEdge > 0.0 ? smoothstep(0.0, uEdge, uv.y) * smoothstep(0.0, uEdge, 1.0 - uv.y) : 1.0;

    if (uRecordTime >= 0.0) {
        finalColor = clamp(finalColor, 0.0, 1.0);
        // Lettering is drawn by this fluid pass and displaced by its live flow.
        float grow = smoothstep(0.0, 0.22, uRecordTime);
        float settle = smoothstep(0.22, 0.46, uRecordTime);
        float scale = mix(0.55, 1.12, grow) - 0.12 * settle;
        float dissolve = smoothstep(1.15, 2.4, uRecordTime);
        vec2 flow = clamp(fluidColor.xy * 0.0002, vec2(-0.008), vec2(0.008));
        vec2 center = vec2(0.5, 0.8 + dissolve * 0.025);
        vec2 letteringUV = (uv - center + flow * (0.3 + dissolve * 4.0)) / (uRecordSize * scale) + 0.5;
        float lettering = texture2D(tRecord, letteringUV).a;
        float coverage = smoothstep(dissolve * 0.7, 0.75, lettering) * grow * (1.0 - dissolve);
        // Keep the words readable over both an idle trail and the discovery bloom.
        float brightness = dot(finalColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 ink = vec3(1.0 - smoothstep(0.35, 0.65, brightness));
        finalColor.rgb = mix(finalColor.rgb, ink, coverage);
    }
    outputColor = mix(computedBgColor, clamp(finalColor, 0.0, 1.0), edge);
}
