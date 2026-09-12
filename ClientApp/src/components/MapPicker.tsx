import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Circle,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  arrowUndoOutline,
  closeCircleOutline,
  contractOutline,
  expandOutline,
  locateOutline,
  navigateOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { useTranslation } from 'react-i18next';
import { LOCATION, MAP } from '../lib/config';

const DEFAULT = MAP.defaultCenter;

type LatLng = { lat: number; lng: number };

// Self-contained teal SVG pin (no external image -> never breaks under bundlers).
const pinIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 26 14 26s14-16 14-26C28 6.3 21.7 0 14 0z" fill="#0d9488"/>
    <circle cx="14" cy="14" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

// Small draggable dot for polygon vertices.
const vertexIcon = L.divIcon({
  className: 'map-vertex',
  html: '<span></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      // Ignore clicks that landed on a map control (zoom / layers / our buttons)
      // so pressing a button never drops a point on the map.
      const el = e.originalEvent?.target as HTMLElement | null;
      if (el && el.closest('.leaflet-control')) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, MAP.pointZoom);
  }, [target, map]);
  return null;
}

/** Leaflet renders blank/partial tiles when created inside a modal (size 0 at
 *  init). Recompute its size once the container reaches its real dimensions. */
function FixSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 250);
    const t2 = setTimeout(fix, 600);
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

/** Renders its children inside a real Leaflet control (native `leaflet-bar`
 *  styling, positioned by Leaflet in a map corner) — not an overlaid element. */
function LeafletControl({ position, children }: { position: L.ControlPosition; children: ReactNode }) {
  const map = useMap();
  const elRef = useRef<HTMLElement | null>(null);
  if (!elRef.current) elRef.current = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-ctl');
  const el = elRef.current;
  useEffect(() => {
    const Ctl = L.Control.extend({ onAdd: () => el });
    const ctl = new Ctl({ position });
    map.addControl(ctl);
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return () => {
      map.removeControl(ctl);
    };
  }, [map, position, el]);
  return createPortal(children, el);
}

export default function MapPicker({
  lat,
  lng,
  radius,
  onChange,
  height = MAP.pickerHeight,
  enlargeable = true,
  onShrink,
  mode = 'circle',
  polygon,
  onPolygonChange,
  readOnly = false,
}: {
  lat: number | null;
  lng: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  /** Show the fullscreen "enlarge" button (off inside the fullscreen modal). */
  enlargeable?: boolean;
  /** When provided (fullscreen view), show a "shrink" button that calls this. */
  onShrink?: () => void;
  /** 'circle' = single point + radius; 'polygon' = click to add vertices. */
  mode?: 'circle' | 'polygon';
  polygon?: LatLng[];
  onPolygonChange?: (coords: LatLng[]) => void;
  /** Display-only map: no editing, search or manual entry (attendance detail). */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [manLat, setManLat] = useState('');
  const [manLng, setManLng] = useState('');
  // Set when a control button is pressed, to swallow the map click it may leak.
  const suppressClickRef = useRef(0);
  const hasPoint = lat != null && lng != null;
  const poly = polygon ?? [];
  const center: [number, number] =
    mode === 'polygon' && poly.length
      ? [poly[0].lat, poly[0].lng]
      : hasPoint
        ? [lat!, lng!]
        : DEFAULT;

  // Reflect a location in the manual lat/lng inputs.
  const fillCoords = (la: number, ln: number) => {
    setManLat(la.toFixed(6));
    setManLng(ln.toFixed(6));
  };

  // Apply a picked/typed/searched location: a vertex in polygon mode, else the point.
  const applyPoint = (la: number, ln: number) => {
    if (readOnly) return;
    if (mode === 'polygon') {
      // Keep the current view while drawing so earlier vertices stay visible —
      // recentering on each new corner would hide the ones already placed.
      onPolygonChange?.([...poly, { lat: la, lng: ln }]);
    } else {
      onChange(la, ln);
      setFlyTarget([la, ln]);
    }
    fillCoords(la, ln);
  };

  const locate = async () => {
    setBusy(true);
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: LOCATION.highAccuracyTimeoutMs,
      });
      applyPoint(pos.coords.latitude, pos.coords.longitude);
    } catch {
      /* permission denied / unavailable */
    } finally {
      setBusy(false);
    }
  };

  // Free-text place search via OpenStreetMap Nominatim → a list of options.
  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': 'ar,en' } },
      );
      const arr = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      setResults((arr ?? []).map((a) => ({ name: a.display_name, lat: parseFloat(a.lat), lng: parseFloat(a.lon) })));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };
  // Pick a search suggestion: pan there AND place it — a vertex in polygon mode,
  // the center in circle mode — and reflect it in the coordinate inputs.
  const selectResult = (res: { name: string; lat: number; lng: number }) => {
    setFlyTarget([res.lat, res.lng]);
    applyPoint(res.lat, res.lng);
    setQuery(res.name);
    setResults([]);
  };

  const addManual = () => {
    const la = parseFloat(manLat);
    const ln = parseFloat(manLng);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      applyPoint(la, ln);
      setManLat('');
      setManLng('');
    }
  };

  const ctlBtn = (icon: string, label: string, onClick: () => void, spinning = false) => (
    <a
      role="button"
      href="#"
      className="map-ctl-btn"
      title={label}
      aria-label={label}
      onPointerDown={() => {
        suppressClickRef.current = Date.now();
      }}
      onClick={(e) => {
        e.preventDefault();
        suppressClickRef.current = Date.now();
        onClick();
      }}
    >
      {spinning ? <IonSpinner name="dots" /> : <IonIcon icon={icon} />}
    </a>
  );

  return (
    <div style={{ position: 'relative' }}>
      {!readOnly && (
        <div className="map-tools">
          <div className="map-tools__row" style={{ position: 'relative' }}>
            <IonInput
              fill="outline"
              className="map-tools__input"
              placeholder={t('admin.searchPlace')}
              value={query}
              onIonInput={(e) => {
                setQuery(e.detail.value ?? '');
                setResults([]);
              }}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            />
            <IonButton onClick={doSearch} disabled={searching} title={t('admin.searchPlace')}>
              {searching ? <IonSpinner name="dots" /> : <IonIcon slot="icon-only" icon={searchOutline} />}
            </IonButton>
            {results.length > 0 && (
              <ul className="map-search-results">
                {results.map((r, i) => (
                  <li key={i} onClick={() => selectResult(r)}>
                    {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="map-tools__row">
            <IonInput
              fill="outline"
              className="map-tools__input ltr-nums"
              type="number"
              placeholder={t('admin.latitude')}
              value={manLat}
              onIonInput={(e) => setManLat(e.detail.value ?? '')}
            />
            <IonInput
              fill="outline"
              className="map-tools__input ltr-nums"
              type="number"
              placeholder={t('admin.longitude')}
              value={manLng}
              onIonInput={(e) => setManLng(e.detail.value ?? '')}
            />
            <IonButton fill="outline" onClick={addManual}>
              {mode === 'polygon' ? t('admin.addPoint') : t('common.add')}
            </IonButton>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={hasPoint || poly.length ? MAP.pointZoom : MAP.defaultZoom}
        scrollWheelZoom
        style={{ height, width: '100%', borderRadius: 8 }}
      >
        {/* Switchable base maps (streets / satellite / terrain). */}
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
          <LayersControl.BaseLayer name={t('admin.mapTerrain')}>
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenTopoMap (CC-BY-SA)"
              maxNativeZoom={16}
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {!readOnly && (
          <ClickHandler
            onPick={(la, ln) => {
              // Ignore the stray map click a control button may emit under itself.
              if (Date.now() - suppressClickRef.current < 500) return;
              applyPoint(la, ln);
            }}
          />
        )}
        <FlyTo target={flyTarget} />
        <FixSize />

        {/* Native Leaflet control buttons (stack under the zoom control). */}
        <LeafletControl position="topleft">
          {!readOnly && ctlBtn(locateOutline, t('admin.useCurrentLocation'), locate, busy)}
          {(hasPoint || poly.length > 0) &&
            ctlBtn(navigateOutline, t('admin.recenter'), () => setFlyTarget(center))}
          {enlargeable && ctlBtn(expandOutline, t('admin.enlargeMap'), () => setFull(true))}
          {onShrink && ctlBtn(contractOutline, t('admin.shrinkMap'), onShrink)}
          {!readOnly &&
            mode === 'polygon' &&
            poly.length > 0 &&
            ctlBtn(arrowUndoOutline, t('admin.undoPoint'), () => onPolygonChange?.(poly.slice(0, -1)))}
          {!readOnly &&
            mode === 'polygon' &&
            poly.length > 0 &&
            ctlBtn(trashOutline, t('admin.clearPolygon'), () => onPolygonChange?.([]))}
        </LeafletControl>

        {/* Geometry: polygon area or radius circle. Vertices/point are draggable. */}
        {mode === 'polygon' ? (
          poly.length > 0 && (
            <>
              <Polygon
                positions={poly.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: '#0d9488' }}
              />
              {poly.map((p, i) => (
                <Marker
                  key={i}
                  position={[p.lat, p.lng]}
                  icon={vertexIcon}
                  draggable={!readOnly}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.Marker).getLatLng();
                      onPolygonChange?.(
                        poly.map((v, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : v)),
                      );
                    },
                  }}
                />
              ))}
            </>
          )
        ) : (
          hasPoint && (
            <>
              <Marker
                position={[lat!, lng!]}
                icon={pinIcon}
                draggable={!readOnly}
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    onChange(ll.lat, ll.lng);
                    fillCoords(ll.lat, ll.lng);
                  },
                }}
              />
              <Circle center={[lat!, lng!]} radius={radius} pathOptions={{ color: '#0d9488' }} />
            </>
          )
        )}
      </MapContainer>

      {/* Polygon vertices: list them all (drag on the map, or remove here). */}
      {!readOnly && mode === 'polygon' && poly.length > 0 && (
        <div className="map-vertex-list">
          {poly.map((p, i) => (
            <div key={i} className="map-vertex-list__item">
              <span className="ltr-nums">
                {i + 1}. {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </span>
              <IonButton
                fill="clear"
                size="small"
                color="danger"
                onClick={() => onPolygonChange?.(poly.filter((_, j) => j !== i))}
              >
                <IonIcon slot="icon-only" icon={closeCircleOutline} />
              </IonButton>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen map */}
      {enlargeable && (
        <IonModal isOpen={full} onDidDismiss={() => setFull(false)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonTitle>{t('admin.map')}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setFull(false)}>{t('common.close')}</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <MapPicker
              lat={lat}
              lng={lng}
              radius={radius}
              onChange={onChange}
              height={Math.max(400, (typeof window !== 'undefined' ? window.innerHeight : 800) - 120)}
              enlargeable={false}
              onShrink={() => setFull(false)}
              mode={mode}
              polygon={polygon}
              onPolygonChange={onPolygonChange}
              readOnly={readOnly}
            />
          </IonContent>
        </IonModal>
      )}
    </div>
  );
}
