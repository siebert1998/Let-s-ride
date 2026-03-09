import type { ParsedRoute, TrackPoint } from '../types';

const EARTH_RADIUS_METERS = 6371e3;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const haversineDistanceMeters = (a: TrackPoint, b: TrackPoint): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const area =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const arc = 2 * Math.atan2(Math.sqrt(area), Math.sqrt(1 - area));

  return EARTH_RADIUS_METERS * arc;
};

export const calculateDistanceKm = (points: TrackPoint[]): number => {
  if (points.length < 2) return 0;

  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    distance += haversineDistanceMeters(points[i - 1], points[i]);
  }

  return distance / 1000;
};

export const calculateElevationGainM = (points: TrackPoint[]): number => {
  if (points.length < 2) return 0;

  let gain = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1].ele;
    const curr = points[i].ele;

    if (typeof prev === 'number' && typeof curr === 'number' && curr > prev) {
      gain += curr - prev;
    }
  }

  return gain;
};

const parseTrackPoints = (doc: XMLDocument): TrackPoint[] => {
  const pointNodes = Array.from(doc.getElementsByTagName('trkpt'));
  const points: TrackPoint[] = [];

  pointNodes.forEach((node) => {
    const lat = Number(node.getAttribute('lat'));
    const lng = Number(node.getAttribute('lon'));
    const elevationNode = node.getElementsByTagName('ele')[0];
    const elevationValue = elevationNode?.textContent ? Number(elevationNode.textContent) : undefined;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const point: TrackPoint = {
      lat,
      lng,
      ...(Number.isFinite(elevationValue) ? { ele: elevationValue } : {}),
    };

    points.push(point);
  });

  return points;
};

export const parseGpxContent = (gpxText: string): ParsedRoute => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML format in GPX file.');
  }

  const hasGpxRoot = doc.getElementsByTagName('gpx').length > 0;
  if (!hasGpxRoot) {
    throw new Error('Unsupported file: no GPX root element found.');
  }

  const points = parseTrackPoints(doc);

  if (points.length < 2) {
    throw new Error('GPX file does not contain enough track points.');
  }

  return {
    points,
    distanceKm: calculateDistanceKm(points),
    elevationGainM: calculateElevationGainM(points),
  };
};

export const parseGpxFile = async (file: File): Promise<ParsedRoute> => {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    throw new Error('Only .gpx files are supported.');
  }

  const text = await file.text();
  return parseGpxContent(text);
};
