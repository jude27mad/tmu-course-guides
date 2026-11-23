// React Bits Lanyard, adapted from David Haz's portrait pass.
// The source revision and license are in public/licenses/.
import { ExtrudeGeometry, Path, Shape, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const WIDTH = 1.6;
const HEIGHT = 2.25;
const BEVEL = 0.007;
const DEPTH = 0.018;

// The same closed Bézier outline serves the pass, its punched slot and its clamp.
function roundedOutline(path, x, y, w, h, r) {
  const k = r * 0.4477;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.bezierCurveTo(x + w - k, y, x + w, y + k, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.bezierCurveTo(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.bezierCurveTo(x + k, y + h, x, y + h - k, x, y + h - r);
  path.lineTo(x, y + r);
  path.bezierCurveTo(x, y + k, x + k, y, x + r, y);
  return path;
}

function buildCard() {
  const outline = roundedOutline(
    new Shape(),
    -WIDTH / 2 + BEVEL,
    -HEIGHT / 2 + BEVEL,
    WIDTH - 2 * BEVEL,
    HEIGHT - 2 * BEVEL,
    0.117 - BEVEL,
  );
  const slotWidth = 0.34;
  const slotHeight = 0.07;
  const slotY = HEIGHT / 2 - 0.13;
  outline.holes.push(
    roundedOutline(
      new Path(),
      -slotWidth / 2 - BEVEL,
      slotY - slotHeight / 2 - BEVEL,
      slotWidth + 2 * BEVEL,
      slotHeight + 2 * BEVEL,
      slotHeight / 2 + BEVEL,
    ),
  );
  const card = new ExtrudeGeometry(outline, {
    depth: DEPTH,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 5,
    curveSegments: 16,
  });
  card.translate(0, 0, -DEPTH / 2);

  // Print on the extruded faces themselves. Their vertices are independent of
  // the bevel, so both faces share one material and the edge keeps its own.
  const { position, normal, uv } = card.attributes;
  const caps = card.groups[0];
  for (let i = caps.start; i < caps.start + caps.count; i += 1) {
    const printedX = normal.getZ(i) * position.getX(i);
    uv.setXY(i, printedX / WIDTH + 0.5, position.getY(i) / HEIGHT + 0.5);
  }
  return card;
}

function buildHardware(strapJointY) {
  const strapWidth = 0.36;
  const clampWidth = strapWidth * 1.16;
  const clampHeight = 0.15;
  const clampBevel = 0.014;
  const eyeletRadius = 0.036;
  const ringRadius = 0.095;
  // The ribbon tucks just inside the metal jaw. Lengthen only the connecting
  // ring so it passes through the slot and reaches the existing physics joint.
  const eyeletY = strapJointY + 0.015 - eyeletRadius - clampHeight + 0.004;
  const ringBottom = HEIGHT / 2 - 0.055 - ringRadius;
  const ring = new TorusGeometry(ringRadius, 0.0135, 12, 48);
  ring.rotateY(Math.PI / 2 - 0.7);
  ring.scale(1, (eyeletY - ringBottom) / (2 * ringRadius), 1);
  ring.translate(0, (eyeletY + ringBottom) / 2, 0);
  const eyelet = new TorusGeometry(eyeletRadius, 0.0105, 10, 32);
  eyelet.translate(0, eyeletY, 0);
  const shape = roundedOutline(
    new Shape(),
    -clampWidth / 2 + clampBevel,
    -clampHeight / 2 + clampBevel,
    clampWidth - 2 * clampBevel,
    clampHeight - 2 * clampBevel,
    0.024,
  );
  const clamp = new ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelThickness: clampBevel,
    bevelSize: clampBevel,
    bevelSegments: 4,
    curveSegments: 8,
  });
  clamp.translate(0, eyeletY + eyeletRadius + clampHeight / 2 - 0.004, -0.01);
  return mergeGeometries([ring.toNonIndexed(), eyelet.toNonIndexed(), clamp]);
}

export function createPassGeometry(strapJointY) {
  return { card: buildCard(), hardware: buildHardware(strapJointY) };
}
