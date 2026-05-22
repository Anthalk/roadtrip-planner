import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MAPTILER_KEY } from '../lib/maptiler';

maptilersdk.config.apiKey = MAPTILER_KEY;

const CAT_COLOR = {
  Visite: '#4A90D9',
  Resto: '#E8734A',
  Bar: '#9B6BB5',
  Hébergement: '#4AAD8A',
  Autre: '#888',
};

const STYLES = [
  {
    id: 'satellite',
    label: 'Satellite',
    style: maptilersdk.MapStyle.HYBRID_V4,
  },
  { id: 'streets', label: 'Plan', style: maptilersdk.MapStyle.STREETS.DARK },
  { id: 'outdoor', label: 'Relief', style: maptilersdk.MapStyle.OUTDOOR },
];

const Map = forwardRef(function Map({ etapes = [], spots = [], routes = {}, tight = false }, ref) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [currentStyle, setCurrentStyle] = useState('satellite');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.HYBRID_V4,
      center: [20, -20],
      zoom: 1,
      zoomControl: false,
      projection : 'globe',
      navigationControl: false,
      geolocateControl: false,
      attributionControl: false,
    });
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon) => {
      if (!map.current) return;
      map.current.flyTo({ center: [lon, lat], zoom: 15, duration: 800 });
    },
  }));

  const switchStyle = (styleId) => {
    const found = STYLES.find((s) => s.id === styleId);
    if (!found || !map.current) return;
    map.current.setStyle(found.style);
    setCurrentStyle(styleId);
    setShowPicker(false);
    map.current.once('styledata', () => {
      Object.entries(routes).forEach(([id, route]) => {
        if (!route?.coords?.length) return;
        const sourceId = 'route-' + id;
        const layerId = 'route-' + id;
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.coords.map((c) => [c[1], c[0]]),
            },
          },
        });
        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#E8C97A',
            'line-width': 2.5,
            'line-opacity': 1,
          },
        });
      });
    });
  };

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const pts = [...etapes, ...spots].filter((p) => p.lat && p.lon);
    if (!pts.length) return;

    etapes
      .filter((e) => e.lat && e.lon)
      .forEach((e) => {
        const el = document.createElement('div');
        el.style.cssText = `width:12px;height:12px;border-radius:50%;background:#E8C97A;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
        const m = new maptilersdk.Marker({ element: el })
          .setLngLat([e.lon, e.lat])
          .setPopup(
            new maptilersdk.Popup({ offset: 20 }).setHTML(
              `<strong>${e.nom}</strong><br/>${e.nuits} nuit${e.nuits > 1 ? 's' : ''}`
            )
          )
          .addTo(map.current);
        markers.current.push(m);
      });

    spots
      .filter((s) => s.lat && s.lon)
      .forEach((s) => {
        const el = document.createElement('div');
        el.style.cssText = `width:9px;height:9px;border-radius:50%;background:${
          CAT_COLOR[s.categorie] || '#888'
        };border:1.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);`;
        const m = new maptilersdk.Marker({ element: el })
          .setLngLat([s.lon, s.lat])
          .setPopup(
            new maptilersdk.Popup({ offset: 16 }).setHTML(
              `<strong>${s.nom}</strong><br/>${s.categorie}`
            )
          )
          .addTo(map.current);
        markers.current.push(m);
      });

    const lats = pts.map((p) => p.lat);
    const lons = pts.map((p) => p.lon);
    const pad = tight ? 0.02 : 0.5;
    map.current.fitBounds(
      [
        [Math.min(...lons) - pad, Math.min(...lats) - pad],
        [Math.max(...lons) + pad, Math.max(...lats) + pad],
      ],
      { padding: 60, duration: 800 }
    );
  }, [etapes, spots]);

  useEffect(() => {
    if (!map.current || !Object.keys(routes).length) return;
    const intervals = [];
    const draw = () => {
      const routeEntries = Object.entries(routes).filter(([_, r]) => r?.coords?.length);
      if (!routeEntries.length) return;
      let routeIndex = 0;
      const drawNext = () => {
        if (routeIndex >= routeEntries.length) return;
        const [id, route] = routeEntries[routeIndex];
        const sourceId = 'route-' + id;
        const layerId = 'route-' + id;
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
          },
        });
        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#E8C97A',
            'line-width': 2.5,
            'line-opacity': 1,
          },
        });
        const coords = route.coords.map((c) => [c[1], c[0]]);
        let i = 0;
        const step = Math.max(1, Math.floor(coords.length / 80));
        const interval = setInterval(() => {
          i = Math.min(i + step, coords.length);
          const source = map.current.getSource(sourceId);
          if (!source) { clearInterval(interval); return; }
          source.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords.slice(0, i) },
          });
          if (i >= coords.length) {
            clearInterval(interval);
            routeIndex++;
            setTimeout(drawNext, 200);
          }
        }, 16);
        intervals.push(interval);
      };
      drawNext();
    };
    if (map.current.isStyleLoaded()) draw();
    else map.current.once('load', draw);
    return () => intervals.forEach(clearInterval);
  }, [routes]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <style>{`
        .maplibregl-ctrl-top-right,
        .maplibregl-ctrl-top-left,
        .maplibregl-ctrl-bottom-left,
        .maplibregl-ctrl-bottom-right,
        .mapboxgl-ctrl-top-right,
        .mapboxgl-ctrl-top-left,
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
      `}</style>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        {showPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => switchStyle(s.id)}
                style={{
                  background: currentStyle === s.id ? 'white' : 'rgba(10,14,20,0.85)',
                  color: currentStyle === s.id ? '#0D1117' : 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowPicker((p) => !p)}
          style={{
            background: 'rgba(10,14,20,0.85)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            padding: '7px 14px',
            color: 'white',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            fontFamily: 'inherit',
          }}
        >
          {STYLES.find((s) => s.id === currentStyle)?.label} ▾
        </button>
      </div>
    </div>
  );
});

export default Map;
