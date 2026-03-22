export interface TrackPoint {
  lat: number;
  lng: number;
  ele?: number;
}

export interface ParsedRoute {
  points: TrackPoint[];
  distanceKm: number;
  elevationGainM: number;
}
