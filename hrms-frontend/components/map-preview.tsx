'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon path issue in bundlers
// https://leafletjs.com/reference.html#icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ---------------------------------------------------------------------------
// Animated fly-to when coordinates change
// ---------------------------------------------------------------------------
function MapAnimator({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  const prevKey = useRef(`${lat},${lng}`);

  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prevKey.current) {
      prevKey.current = key;
      map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }
  }, [lat, lng, zoom, map]);

  return null;
}

// ---------------------------------------------------------------------------
// Pulsing circle overlay — rendered via SVG on top of the Circle
// ---------------------------------------------------------------------------
function PulsingCircle({
  center,
  radius,
}: {
  center: [number, number];
  radius: number;
}) {
  const map = useMap();
  const pulseRef = useRef<L.Circle | null>(null);

  const [centerLat, centerLng] = center;

  useEffect(() => {
    const pulse = L.circle(center, {
      radius,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 0,
      className: 'geo-fence-pulse',
    }).addTo(map);

    pulseRef.current = pulse;

    return () => {
      map.removeLayer(pulse);
    };
  }, [map, centerLat, centerLng, radius]);

  useEffect(() => {
    if (pulseRef.current) {
      pulseRef.current.setLatLng(center);
      pulseRef.current.setRadius(radius);
    }
  }, [center, radius]);

  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface MapPreviewProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  branchName: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MapPreview({
  latitude,
  longitude,
  radiusMeters,
  branchName,
}: MapPreviewProps) {
  return (
    <div className="group relative h-64 w-full overflow-hidden rounded-lg border border-border/50 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        className="h-full w-full"
        zoomControl={true}
        scrollWheelZoom={false}
        dragging={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAnimator lat={latitude} lng={longitude} zoom={15} />

        {/* Geo-fence circle */}
        <Circle
          center={[latitude, longitude]}
          radius={radiusMeters}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '6 4',
          }}
        />

        {/* Pulsing background circle */}
        <PulsingCircle center={[latitude, longitude]} radius={radiusMeters} />

        {/* Branch marker */}
        <Marker position={[latitude, longitude]} />
      </MapContainer>

      {/* Overlay label */}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs text-ink-soft backdrop-blur-sm">
        📍 {branchName} · {radiusMeters}m radius
      </div>
    </div>
  );
}
