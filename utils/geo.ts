export interface Bydel {
  id: number;
  name: string;
  polygon: number[][];
}

function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    if (
      (latI > lat) !== (latJ > lat) &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function centroid(polygon: number[][]): [number, number] {
  const n = polygon.length;
  return [
    polygon.reduce((s, p) => s + p[0], 0) / n,
    polygon.reduce((s, p) => s + p[1], 0) / n,
  ];
}

export function findBydel(lat: number, lng: number, bydeler: Bydel[]): Bydel | null {
  const exact = bydeler.find(b => pointInPolygon(lat, lng, b.polygon));
  if (exact) return exact;

  // Fallback for POIs near mis-stitched OSM ring boundaries
  let best: Bydel | null = null;
  let bestDist = 0.05;
  for (const b of bydeler) {
    const [cLat, cLng] = centroid(b.polygon);
    const d = Math.hypot(lat - cLat, lng - cLng);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}
