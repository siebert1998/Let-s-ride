import { LatLngBoundsExpression } from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import type { TrackPoint } from '../types';

interface RouteMapProps {
  points: TrackPoint[];
}

const polylineColor = '#b5ff49';

export function RouteMap({ points }: RouteMapProps): JSX.Element {
  const positions = useMemo(() => points.map((point) => [point.lat, point.lng] as [number, number]), [points]);

  const bounds = useMemo(
    () =>
      positions.reduce(
        (result, [lat, lng]) => {
          result[0][0] = Math.min(result[0][0], lat);
          result[0][1] = Math.min(result[0][1], lng);
          result[1][0] = Math.max(result[1][0], lat);
          result[1][1] = Math.max(result[1][1], lng);
          return result;
        },
        [
          [positions[0][0], positions[0][1]],
          [positions[0][0], positions[0][1]],
        ] as [[number, number], [number, number]],
      ) as LatLngBoundsExpression,
    [positions],
  );

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
      style={{ backgroundColor: '#0b1119' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polyline positions={positions} pathOptions={{ color: polylineColor, weight: 5, opacity: 0.95 }} />
    </MapContainer>
  );
}
