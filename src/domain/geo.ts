/** Datensparsame Geofunktionen: gerundete Koordinaten, grobe Entfernungen. */

export function roundCoord(v: number, step = 0.1): number {
  return Math.round(v / step) * step;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Sichtbare Entfernung nur in Stufen – keine genaue Ortung möglich. */
export function distanceBucket(km: number): string {
  if (km < 10) return "unter 10 km";
  if (km < 25) return "unter 25 km";
  if (km < 50) return "unter 50 km";
  if (km < 100) return "unter 100 km";
  if (km < 250) return "unter 250 km";
  return "über 250 km";
}

/** Grobe PLZ: nur die ersten zwei Stellen werden gespeichert/angezeigt. */
export function coarsePostal(postal: string): string {
  return postal.replace(/\s+/g, "").slice(0, 2);
}

export function ageFromBirthYear(year: number, now = new Date()): number {
  return now.getUTCFullYear() - year;
}
