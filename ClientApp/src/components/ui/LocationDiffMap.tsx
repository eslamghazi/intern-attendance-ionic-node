import { useEffect } from 'react';
import {
  Circle,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

type LatLng = { lat: number; lng: number };

// Teal target pin — the hospital/branch (matches MapPicker's pin).
const targetIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 26 14 26s14-16 14-26C28 6.3 21.7 0 14 0z" fill="#0d9488"/>
    <circle cx="14" cy="14" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

// Red "you" pin — the member's current position.
const meIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 26 14 26s14-16 14-26C28 6.3 21.7 0 14 0z" fill="#dc2626"/>
    <circle cx="14" cy="14" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

/** Pan/zoom so both points and the geofence circle are visible. */
function FitBoth({ me, target, radius }: { me: LatLng; target: LatLng; radius: number }) {
  const map = useMap();
  useEffect(() => {
    // Approximate the geofence's cardinal extent from the radius (a standalone
    // L.circle can't compute getBounds() until it is attached to a map).
    const dLat = radius / 111_320;
    const dLng = radius / (111_320 * Math.cos((target.lat * Math.PI) / 180) || 1);
    const bounds = L.latLngBounds([
      [me.lat, me.lng],
      [target.lat, target.lng],
      [target.lat + dLat, target.lng],
      [target.lat - dLat, target.lng],
      [target.lat, target.lng + dLng],
      [target.lat, target.lng - dLng],
    ]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }, [map, me.lat, me.lng, target.lat, target.lng, radius]);
  return null;
}

/**
 * Read-only map that shows the member's current location and the target branch's
 * geofence side by side, with a connecting line labelled by the distance — so an
 * out-of-range check-in failure is immediately legible.
 */
export default function LocationDiffMap({
  me,
  target,
  radius,
  distance,
  area,
  height = 260,
}: {
  me: LatLng;
  target: LatLng;
  radius: number;
  distance: number;
  area?: LatLng[] | null;
  height?: number;
}) {
  const { t } = useTranslation();
  const hasPolygon = !!area && area.length >= 3;

  return (
    <MapContainer
      center={[target.lat, target.lng]}
      zoom={15}
      scrollWheelZoom
      style={{ height, width: '100%', borderRadius: 12 }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name={t('admin.mapStreets')}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name={t('admin.mapSatellite')}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri, Maxar, Earthstar Geographics"
            maxNativeZoom={18}
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Geofence — polygon if defined, otherwise the radius circle. */}
      {hasPolygon ? (
        <Polygon
          positions={area!.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.12 }}
        />
      ) : (
        <Circle
          center={[target.lat, target.lng]}
          radius={radius}
          pathOptions={{ color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.12 }}
        />
      )}

      {/* Line between the two points, labelled with the distance. */}
      <Polyline
        positions={[
          [me.lat, me.lng],
          [target.lat, target.lng],
        ]}
        pathOptions={{ color: '#dc2626', weight: 2, dashArray: '6 6' }}
      >
        <Tooltip permanent direction="center" className="loc-diff-dist">
          {t('checkin.mapDistance', { distance })}
        </Tooltip>
      </Polyline>

      <Marker position={[target.lat, target.lng]} icon={targetIcon}>
        <Tooltip direction="top">{t('checkin.mapTarget')}</Tooltip>
      </Marker>
      <Marker position={[me.lat, me.lng]} icon={meIcon}>
        <Tooltip direction="top">{t('checkin.mapYou')}</Tooltip>
      </Marker>

      <FitBoth me={me} target={target} radius={radius} />
    </MapContainer>
  );
}
