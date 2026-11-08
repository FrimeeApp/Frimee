/**
 * Where the photo pile goes next to the group, so it stays inside the map: below the group
 * near the top edge (else above), and to its left near the right edge (else to its right).
 */
export function pileSide(x: number, y: number, width: number): string {
  const vertical = y < 200 ? "below" : "above";
  const horizontal = x > width - 160 ? "left" : "right";
  return `${vertical} ${horizontal}`;
}
