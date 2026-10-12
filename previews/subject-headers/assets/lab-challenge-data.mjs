// Authored practice examples, independent of DOM and saved course progress.
export const challengeSets = {
  mth140: [
    {
      id: 'shift', topic: 'Function transformations', title: 'Where does the vertex go?',
      prompt: 'A student describes g(x) = (x − 2)² from the parent function f(x) = x².',
      lines: ['The parent vertex is (0, 0).', 'At the new vertex, x − 2 = 0.', 'Solving gives x = −2.', 'So the graph moves 2 units left.'],
      error: 2, correction: 'x − 2 = 0  ⇒  x = 2',
      explanation: 'Add 2 to both sides. The new vertex is at x = 2, so the graph moves right.',
      visual: 'shift', visualTitle: 'The vertex moves right', visualCaption: 'At x = 2, g(x) = 0. At x = −2, g(x) = 16.',
      legend: ['f(x) = x²', 'g(x) = (x − 2)²'],
    },
    {
      id: 'secant', topic: 'Average rate of change', title: 'A slope between two points',
      prompt: 'Find the average rate of change of f(x) = x² from x = 1 to x = 3.',
      lines: ['f(1) = 1 and f(3) = 9.', 'Slope = [f(3) − f(1)] / (3 − 1).', 'Slope = (9 − 1) / 3.', 'Slope = 8/3.'],
      error: 2, correction: 'Slope = (9 − 1) / (3 − 1) = 8/2 = 4',
      explanation: 'The horizontal change is 3 − 1 = 2. Divide by that change, not by the final x-coordinate.',
      visual: 'secant', visualTitle: 'Rise 8. Run 2.', visualCaption: 'The secant passes through (1, 1) and (3, 9). Its slope is 4.',
      legend: ['f(x) = x²', 'Secant: y = 4x − 3'],
    },
    {
      id: 'hole', topic: 'Limits', title: 'A value at the missing point',
      prompt: 'Let f(x) = x + 1 for x ≠ 1, and f(1) = 3. Find the limit as x approaches 1.',
      lines: ['The defined value is f(1) = 3.', 'Near 1, the values of f(x) follow x + 1.', 'Therefore, the limit as x → 1 equals f(1) = 3.'],
      error: 2, correction: 'lim as x → 1 of f(x) = 2',
      explanation: 'Nearby values approach 2 from both sides. The separately defined value f(1) = 3 does not change that limit.',
      visual: 'hole', visualTitle: 'Approach the hole, not the filled point', visualCaption: 'The open circle is at (1, 2). The filled point is f(1) = 3.',
      legend: ['Nearby values', 'Defined point: (1, 3)'],
    },
    {
      id: 'derivative', topic: 'First principles', title: 'What survives the expansion?',
      prompt: 'A student uses the difference quotient to differentiate f(x) = x² at x = 1, with h ≠ 0.',
      lines: ['Difference quotient = [(1 + h)² − 1] / h.', '(1 + h)² = 1 + h².', 'The quotient is h²/h = h.', 'As h → 0, the derivative is 0.'],
      error: 1, correction: '(1 + h)² = 1 + 2h + h²',
      explanation: 'Squaring a sum includes the middle term. Both cross-products contribute h.',
      visual: 'expansion', visualTitle: 'Check the expansion with h = 1', visualCaption: 'The claimed expansion gives 2, but (1 + 1)² = 4.',
      numberCheck: ['(1 + 1)²', '= 1 + 1 + 1 + 1', '= 4'],
    },
  ],
  mth141: [
    {
      id: 'complex', topic: 'Complex numbers', title: 'Multiply by i',
      prompt: 'Simplify (1 + i)i.',
      lines: ['(1 + i)i = i + i².', 'i² = 1.', 'The product is 1 + i.'],
      error: 1, correction: 'i² = −1',
      explanation: 'The square of i is −1. The product is −1 + i: multiplication by i rotates the point 90° counterclockwise.',
      visual: 'complex', visualTitle: 'A quarter turn about zero', visualCaption: '(1, 1) becomes (−1, 1). The magnitude stays √2.',
      legend: ['z = 1 + i', 'iz = −1 + i'],
    },
    {
      id: 'row', topic: 'Linear systems', title: 'Eliminate one variable',
      prompt: 'Solve the system x + y = 3 and 2x + 3y = 8 using R₂ ← R₂ − 2R₁.',
      lines: ['Subtract 2(x + y) from 2x + 3y.', 'The left side becomes y.', 'The right side stays 8.', 'So y = 8.'],
      error: 2, correction: 'The right side becomes 8 − 2(3) = 2.',
      explanation: 'A row operation acts on the entire augmented row, including the right-hand side.',
      visual: 'row', visualTitle: 'Apply the operation to every entry', visualCaption: 'The new second row is [0  1 | 2], so y = 2.',
      numberCheck: ['[2  3 | 8] − 2[1  1 | 3]', '= [2 − 2, 3 − 2 | 8 − 6]', '= [0  1 | 2]'],
    },
    {
      id: 'determinant', topic: 'Determinants', title: 'Keep track of the sign',
      prompt: 'Find det(A) for A = [[1, 2], [3, 4]].',
      lines: ['det(A) = (1)(4) − (2)(3).', 'det(A) = 4 + 6.', 'det(A) = 10.'],
      error: 1, correction: 'det(A) = 4 − 6 = −2',
      explanation: 'The formula subtracts the off-diagonal product. A negative determinant reverses orientation; its magnitude gives the area scale.',
      visual: 'determinant', visualTitle: 'Area scale 2. Orientation reversed.', visualCaption: 'The unit square maps to a parallelogram with area 2; det(A) = −2.',
      legend: ['Unit square: area 1', 'Transformed square: area 2'],
    },
    {
      id: 'vectors', topic: 'Linear combinations', title: 'Subtract a vector',
      prompt: 'Let u = (2, 1) and v = (−1, 2). Calculate 2u − v.',
      lines: ['2u = (4, 2).', '2u − v = (4 − (−1), 2 − 2).', '2u − v = (3, 0).'],
      error: 2, correction: '2u − v = (4 + 1, 0) = (5, 0)',
      explanation: 'Subtracting −1 adds 1 to the first coordinate. The vertical coordinates cancel.',
      visual: 'vectors', visualTitle: 'The vertical parts cancel', visualCaption: 'Start with 2u = (4, 2), then add −v = (1, −2). End at (5, 0).',
      legend: ['2u = (4, 2)', '2u − v = (5, 0)'],
    },
  ],
};

export function evaluateChoice(challenge, line) {
  if (!Number.isInteger(line) || line < 0 || line >= challenge.lines.length) return 'invalid';
  return line === challenge.error ? 'correct' : line < challenge.error ? 'valid-step' : 'earlier-error';
}
