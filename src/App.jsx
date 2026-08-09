import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as SunCalc from 'suncalc';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import {
  ArrowRight, Binoculars, Buildings, CalendarBlank, Car, CheckCircle, CloudSun,
  Compass, Crosshair, Info, MagnifyingGlass, MapPin, ShieldWarning,
  GlobeHemisphereWest, Mountains, Sun, Tree, WarningCircle, Waves, X
} from '@phosphor-icons/react';
import 'leaflet/dist/leaflet.css';

const ECLIPSE_DATE = '2026-08-12';
const PUBLIC_BASE = import.meta.env.BASE_URL;
const DEFAULT_POINT = { lat: 46.6034, lng: 1.8883 };
const MAXIMUM_MINUTE = 20 * 60 + 19;

function scoreColor(score) {
  if (score >= 75) return '#2f9e44';
  if (score >= 45) return '#f08c00';
  return '#e03131';
}

function scoreLabel(score) {
  if (score >= 75) return 'Très favorable';
  if (score >= 45) return 'Favorable avec réserves';
  return 'Peu favorable';
}

function destination(lat, lng, distanceKm, bearingDeg) {
  const R = 6371;
  const d = distanceKm / R;
  const b = bearingDeg * Math.PI / 180;
  const p1 = lat * Math.PI / 180;
  const l1 = lng * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 * 180 / Math.PI, l2 * 180 / Math.PI];
}

function makeWedge(point, bearing) {
  return [
    [point.lat, point.lng],
    destination(point.lat, point.lng, 9, bearing - 8),
    destination(point.lat, point.lng, 11, bearing),
    destination(point.lat, point.lng, 9, bearing + 8)
  ];
}

function timeToDate(value) {
  return new Date(`${ECLIPSE_DATE}T${value}:00+02:00`);
}

function solarAt(point, time) {
  const pos = SunCalc.getPosition(timeToDate(time), point.lat, point.lng);
  return {
    altitude: pos.altitude,
    azimuth: pos.azimuth
  };
}

function minutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function distanceMetres(a, b) {
  const dy = (b.lat - a.lat) * 111320;
  const dx = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(dx, dy);
}

function bearingBetween(a, b) {
  const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function geometryCenter(geometry) {
  const points = [];
  const collect = value => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') points.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
  };
  collect(geometry?.coordinates);
  if (!points.length) return null;
  return { lng: points.reduce((sum,p) => sum + p[0], 0) / points.length, lat: points.reduce((sum,p) => sum + p[1], 0) / points.length };
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

function FranceView({ boundary, recenterKey }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [24, 24], maxZoom: 6, animate: Boolean(recenterKey) });
  }, [map, boundary, recenterKey]);
  return null;
}

function MapUpdater({ point, recenterKey }) {
  const map = useMap();
  const lastKey = useRef(recenterKey);
  useEffect(() => {
    if (recenterKey === lastKey.current) return;
    lastKey.current = recenterKey;
    map.flyTo([point.lat,point.lng], Math.max(map.getZoom(),14), {duration:.6});
  }, [map,point.lat,point.lng,recenterKey]);
  return null;
}

function HorizonCanvas({ profile, sunAltitude, obstacle }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const profileMin = Math.min(0, ...profile.map(p => p.angle));
    const profileMax = Math.max(0, ...profile.map(p => p.angle), obstacle?.angle || 0);
    const minY = Math.floor(profileMin - 1);
    const maxY = Math.ceil(Math.max(sunAltitude + 1.5, profileMax + 1.5));
    const left = 38, right = 12, top = 22, bottom = 32;
    const y = (v) => height - bottom - ((v - minY) / Math.max(1, maxY - minY)) * (height - top - bottom);
    const x = (i) => left + (i / Math.max(1, profile.length - 1)) * (width - left - right);
    const xDistance = (km) => left + (Math.min(10, Math.max(0, km)) / 10) * (width - left - right);
    ctx.font = '10px Marianne, Arial'; ctx.fillStyle = '#647381'; ctx.textAlign = 'right';
    ctx.strokeStyle = '#d9e0eb';
    ctx.lineWidth = 1;
    const tickStep = maxY - minY > 12 ? 3 : 2;
    for (let v = Math.ceil(minY / tickStep) * tickStep; v <= maxY; v += tickStep) { ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(width-right, y(v)); ctx.stroke(); ctx.fillText(`${v}°`, left-7, y(v)+3); }
    ctx.beginPath();
    profile.forEach((p, i) => { i ? ctx.lineTo(x(i), y(p.angle)) : ctx.moveTo(x(i), y(p.angle)); });
    ctx.lineTo(width-right, y(minY)); ctx.lineTo(left, y(minY)); ctx.closePath();
    ctx.fillStyle = 'rgba(47,158,68,.18)'; ctx.fill();
    ctx.beginPath();
    profile.forEach((p, i) => { i ? ctx.lineTo(x(i), y(p.angle)) : ctx.moveTo(x(i), y(p.angle)); });
    ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(left, y(sunAltitude)); ctx.lineTo(width-right, y(sunAltitude));
    ctx.strokeStyle = '#000091'; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#000091'; ctx.textAlign = 'right'; ctx.font = '700 10px Marianne, Arial'; ctx.fillText(`Soleil ${sunAltitude.toFixed(1)}°`, width-right, Math.max(12,y(sunAltitude)-5));
    if (obstacle?.angle != null) {
      const ox = xDistance((obstacle.distance || 0) / 1000), oy = y(obstacle.angle);
      ctx.strokeStyle = '#e07a2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox, y(minY)); ctx.lineTo(ox, oy); ctx.stroke();
      ctx.fillStyle = '#e07a2f'; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI*2); ctx.fill();
      ctx.font = '700 10px Marianne, Arial'; ctx.textAlign = ox > width*.65 ? 'right' : 'left'; ctx.fillText(`Obstacle ${obstacle.angle.toFixed(1)}°`, ox + (ox > width*.65 ? -8 : 8), Math.max(13,oy-7));
    }
    ctx.fillStyle = '#647381'; ctx.font = '10px Marianne, Arial'; ctx.textAlign = 'left'; ctx.fillText('0 km', left, height-7); ctx.textAlign = 'right'; ctx.fillText('10 km', width-right, height-7);
  }, [profile, sunAltitude, obstacle]);
  return <canvas className="horizon-canvas" ref={ref} aria-label="Profil de l’horizon" />;
}

async function fetchWeather(point, time) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: point.lat, longitude: point.lng, timezone: 'Europe/Paris',
    start_date: ECLIPSE_DATE, end_date: ECLIPSE_DATE,
    hourly: 'cloud_cover,visibility,precipitation_probability,wind_speed_10m'
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error('Météo indisponible');
  const data = await response.json();
  const targetHour = `${ECLIPSE_DATE}T${time.slice(0,2)}:00`;
  let index = data.hourly.time.indexOf(targetHour);
  if (index < 0) index = 20;
  const cloud = data.hourly.cloud_cover[index];
  const rain = data.hourly.precipitation_probability[index];
  const visibility = data.hourly.visibility[index] / 1000;
  const wind = data.hourly.wind_speed_10m[index];
  const score = Math.round(Math.max(0, Math.min(100, 100 - cloud * .7 - rain * .25 + Math.min(15, visibility) * 1.5 - Math.max(0, wind - 20))));
  return { cloud, rain, visibility, wind, score };
}

async function fetchHorizon(point, bearing) {
  const distances = [0, .05, .1, .2, .35, .5, .75, 1, 1.5, 2.5, 4, 7, 10];
  const pts = distances.map(d => destination(point.lat, point.lng, d, bearing));
  const url = new URL('https://api.open-meteo.com/v1/elevation');
  url.searchParams.set('latitude', pts.map(p => p[0].toFixed(5)).join(','));
  url.searchParams.set('longitude', pts.map(p => p[1].toFixed(5)).join(','));
  const response = await fetch(url);
  if (!response.ok) throw new Error('Relief indisponible');
  const data = await response.json();
  const base = data.elevation[0] + 1.7;
  const profile = data.elevation.map((elevation, i) => {
    if (i === 0) return { distance: 0, elevation, angle: 0 };
    const metres = distances[i] * 1000;
    const curvature = metres * metres / (2 * 6371000);
    return { distance: distances[i], elevation, angle: Math.atan2(elevation - base - curvature, metres) * 180 / Math.PI };
  });
  const maxAngle = Math.max(0, ...profile.map(p => p.angle));
  const score = Math.round(Math.max(0, Math.min(100, 100 - maxAngle * 8)));
  return { profile, maxAngle, score };
}

async function fetchSiteAudit(point, bearing) {
  const corridor = [
    [point.lat,point.lng], destination(point.lat,point.lng,.8,bearing-3), destination(point.lat,point.lng,.8,bearing+3),
    destination(point.lat,point.lng,.04,bearing-90), destination(point.lat,point.lng,.04,bearing+90)
  ];
  const south = Math.min(...corridor.map(p=>p[0])).toFixed(6), north = Math.max(...corridor.map(p=>p[0])).toFixed(6);
  const west = Math.min(...corridor.map(p=>p[1])).toFixed(6), east = Math.max(...corridor.map(p=>p[1])).toFixed(6);
  const query = `[out:json][timeout:18];(
    wr(around:5,${point.lat},${point.lng})[building];
    wr(around:8,${point.lat},${point.lng})[natural=water];
    wr(around:8,${point.lat},${point.lng})[waterway];
    wr(around:8,${point.lat},${point.lng})[landuse=reservoir];
    wr(around:12,${point.lat},${point.lng})[access=private];
    wr(around:35,${point.lat},${point.lng})[natural=wood];
    wr(around:35,${point.lat},${point.lng})[landuse=forest];
    nwr(around:120,${point.lat},${point.lng})[natural=tree];
    way(around:120,${point.lat},${point.lng})[barrier=hedge];
    way(around:35,${point.lat},${point.lng})[highway];
    nwr(around:500,${point.lat},${point.lng})[amenity=parking];
    wr(${south},${west},${north},${east})[building];
    wr(${south},${west},${north},${east})[natural=wood];
    wr(${south},${west},${north},${east})[landuse=forest];
  );out tags center qt;`;
  const endpoints = ['https://overpass-api.de/api/interpreter'];
  const fetchOverpass = async (rawQuery) => {
    const compact = rawQuery.replace(/\n\s*/g,'');
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(`${endpoint}?data=${encodeURIComponent(compact)}`, { signal:controller.signal });
        clearTimeout(timer);
        if (response.ok) return response.json();
      } catch { /* miroir suivant */ }
    }
    throw new Error('Overpass indisponible');
  };
  const fetchIgnBuildings = async () => {
    const latDelta = 0.0032;
    const lngDelta = latDelta / Math.max(.45, Math.cos(point.lat * Math.PI / 180));
    const url = new URL('https://data.geopf.fr/wfs/ows');
    url.search = new URLSearchParams({
      service:'WFS', version:'2.0.0', request:'GetFeature', typeNames:'BDTOPO_V3:batiment',
      srsName:'EPSG:4326', outputFormat:'application/json', count:'800',
      bbox:`${point.lng-lngDelta},${point.lat-latDelta},${point.lng+lngDelta},${point.lat+latDelta},EPSG:4326`
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw new Error('BD TOPO indisponible');
      return await response.json();
    } finally { clearTimeout(timer); }
  };
  const fetchIgnVegetation = async () => {
    const samples = [0, .03, .07, .15, .3, .55];
    return Promise.all(samples.map(async distanceKm => {
      const [lat,lng] = distanceKm ? destination(point.lat,point.lng,distanceKm,bearing) : [point.lat,point.lng];
      const latDelta = 14 / 111320;
      const lngDelta = latDelta / Math.max(.45,Math.cos(lat*Math.PI/180));
      const url = new URL('https://data.geopf.fr/wfs/ows');
      url.search = new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'BDTOPO_V3:zone_de_vegetation',srsName:'EPSG:4326',outputFormat:'application/json',count:'20',propertyName:'nature',bbox:`${lng-lngDelta},${lat-latDelta},${lng+lngDelta},${lat+latDelta},EPSG:4326`});
      const response = await fetch(url);
      if (!response.ok) throw new Error('Végétation IGN indisponible');
      const data = await response.json();
      return {distance:distanceKm*1000,natures:(data.features||[]).map(f=>f.properties?.nature).filter(Boolean)};
    }));
  };
  const [osmResult, ignResult, vegetationResult] = await Promise.allSettled([fetchOverpass(query), fetchIgnBuildings(), fetchIgnVegetation()]);
  if (osmResult.status === 'rejected' && ignResult.status === 'rejected' && vegetationResult.status === 'rejected') throw new Error('Contrôle du lieu indisponible');
  const data = osmResult.status === 'fulfilled' ? osmResult.value : {elements:[]};
  const elements = data.elements || [];
  const onWater = elements.some(el => el.tags?.natural === 'water' || el.tags?.waterway || el.tags?.landuse === 'reservoir');
  const ignVegetation = vegetationResult.status === 'fulfilled' ? vegetationResult.value : [];
  const isForestNature = nature => nature === 'Bois' || nature === 'Peupleraie' || nature?.startsWith('Forêt');
  const forestNearby = elements.some(el => el.tags?.natural === 'wood' || el.tags?.landuse === 'forest') || ignVegetation[0]?.natures?.some(isForestNature);
  const treesNearby = elements.filter(el => el.tags?.natural === 'tree' || el.tags?.barrier === 'hedge').length;
  const osmInBuilding = elements.some(el => el.tags?.building && (() => { const p=el.center?{lat:el.center.lat,lng:el.center.lon}:null; return !p || distanceMetres(point,p)<15; })());
  const privateNearby = elements.some(el => el.tags?.access === 'private');
  const hasRoad = elements.some(el => el.tags?.highway && !['motorway','trunk'].includes(el.tags.highway));
  const hasParking = elements.some(el => el.tags?.amenity === 'parking');
  const hasTransit = elements.some(el => el.tags?.public_transport);
  const obstacles = elements.filter(el => el.tags?.building || el.tags?.natural === 'wood' || el.tags?.landuse === 'forest').map(el => {
    const p = el.center ? {lat:el.center.lat,lng:el.center.lon} : (el.lat ? {lat:el.lat,lng:el.lon} : null);
    if (!p) return null;
    const distance = Math.max(15, distanceMetres(point,p));
    const explicitHeight = Number.parseFloat(el.tags?.height);
    const levels = Number.parseFloat(el.tags?.['building:levels']);
    const roofLevels = Number.parseFloat(el.tags?.['roof:levels']);
    const height = el.tags?.building ? Math.max(5, Number.isFinite(explicitHeight) ? explicitHeight : (Number.isFinite(levels) ? levels * 3 + (Number.isFinite(roofLevels) ? roofLevels * 1.5 : 0) : 7)) : 15;
    const inAxis = angleDifference(bearing, bearingBetween(point,p)) <= Math.max(4, Math.atan2(35,distance) * 180 / Math.PI);
    return { kind:el.tags?.building ? 'Bâtiment OSM' : 'Végétation haute', source:'OpenStreetMap', distance, height, inAxis, angle:Math.atan2(height - 1.7,distance) * 180 / Math.PI };
  }).filter(Boolean).filter(o => o.distance <= 1650 && o.inAxis);
  const ignBuildings = ignResult.status === 'fulfilled' ? (ignResult.value.features || []).map(feature => {
    const p = geometryCenter(feature.geometry);
    if (!p) return null;
    const distance = Math.max(8, distanceMetres(point,p));
    const props = feature.properties || {};
    const heightValue = Number(props.hauteur);
    const roof = Number(props.altitude_maximale_toit ?? props.altitude_minimale_toit);
    const ground = Number(props.altitude_minimale_sol ?? props.altitude_maximale_sol);
    const floors = Number(props.nombre_d_etages);
    const measured = Number.isFinite(heightValue) && heightValue > 1 ? heightValue : (Number.isFinite(roof) && Number.isFinite(ground) && roof > ground ? roof-ground : null);
    const height = measured || (Number.isFinite(floors) && floors >= 0 ? Math.max(4.5,(floors+1)*3) : 7);
    const inAxis = angleDifference(bearing, bearingBetween(point,p)) <= Math.max(4, Math.atan2(35,distance) * 180 / Math.PI);
    return {kind:'Bâtiment BD TOPO', source:'IGN BD TOPO', distance, height, measured:Boolean(measured), inAxis, angle:Math.atan2(height-1.7,distance)*180/Math.PI};
  }).filter(Boolean).filter(o => o.distance <= 700) : [];
  const axisBuildings = ignBuildings.filter(o => o.inAxis && o.distance > 10);
  obstacles.push(...axisBuildings);
  const vegetationHeight = nature => nature === 'Peupleraie' ? 18 : isForestNature(nature) ? 15 : nature === 'Haie' ? 5 : nature === 'Lande ligneuse' ? 3 : nature === 'Verger' ? 6 : 2;
  ignVegetation.slice(1).forEach(sample => sample.natures.forEach(nature => {
    const height = vegetationHeight(nature);
    obstacles.push({kind:`Végétation IGN · ${nature}`,source:'IGN BD TOPO',distance:Math.max(12,sample.distance),height,angle:Math.atan2(height-1.7,Math.max(12,sample.distance))*180/Math.PI});
  }));
  const maxObstacle = obstacles.sort((a,b) => b.angle-a.angle)[0] || null;
  const nearbyIgnBuildings = ignBuildings.filter(o => o.distance <= 180);
  const nearbyOsmBuildings = elements.filter(el => el.tags?.building && el.center && distanceMetres(point,{lat:el.center.lat,lng:el.center.lon}) <= 180).length;
  const nearbyBuildingCount = ignResult.status === 'fulfilled' ? nearbyIgnBuildings.length : nearbyOsmBuildings;
  const inBuilding = osmInBuilding || ignBuildings.some(o => o.distance < 12);
  const urbanPenalty = nearbyBuildingCount ? Math.min(18, 4 + Math.round(Math.sqrt(nearbyBuildingCount) * 2.2)) : 0;
  const buildingScore = Math.max(0, 100 - urbanPenalty - (maxObstacle?.kind?.includes('Bâtiment') ? Math.min(65, Math.round(maxObstacle.angle * 5)) : 0));
  const accessScore = Math.min(100, 35 + (hasRoad?30:0) + (hasParking?20:0) + (hasTransit?15:0));
  return { onWater, inBuilding, forestNearby, treesNearby, privateNearby, excluded:onWater||inBuilding, hasRoad, hasParking, hasTransit, obstacles, maxObstacle, nearbyBuildingCount, urbanPenalty, buildingScore, vegetationSource:vegetationResult.status === 'fulfilled'?'IGN BD TOPO':'OpenStreetMap', buildingSource:ignResult.status === 'fulfilled' ? 'IGN BD TOPO' : 'OpenStreetMap', score:accessScore, timestamp:data.osm3s?.timestamp_osm_base };
}

async function reversePlace(point) {
  const url = new URL('https://api-adresse.data.gouv.fr/reverse/');
  url.search = new URLSearchParams({ lat: point.lat, lon: point.lng });
  const response = await fetch(url);
  if (!response.ok) throw new Error('Adresse indisponible');
  const data = await response.json();
  const props = data.features?.[0]?.properties || {};
  const typeBonus = props.type === 'housenumber' || props.type === 'street' ? 18 : 8;
  return { name: props.name || props.city || 'Point sélectionné', city: props.city || props.context || 'France', postcode: props.postcode || '', score: 62 + typeBonus };
}

export function App() {
  const [boundary, setBoundary] = useState(null);
  const [point, setPoint] = useState(DEFAULT_POINT);
  const [time, setTime] = useState('20:19');
  const [weather, setWeather] = useState(null);
  const [horizon, setHorizon] = useState(null);
  const [maximumHorizon, setMaximumHorizon] = useState(null);
  const [siteAudit, setSiteAudit] = useState(null);
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showVisibility, setShowVisibility] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [franceKey, setFranceKey] = useState(0);
  const [safetyOpen, setSafetyOpen] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => { fetch(`${PUBLIC_BASE}data/france-metropolitaine.geojson`).then(r => r.json()).then(setBoundary); }, []);
  const solar = useMemo(() => solarAt(point, time), [point, time]);
  const maximumSolar = useMemo(() => solarAt(point, '20:19'), [point]);
  const wedge = useMemo(() => makeWedge(point, solar.azimuth), [point, solar.azimuth]);

  useEffect(() => {
    if (!hasSelection) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError(''); setPlace(null); setWeather(null); setHorizon(null); setMaximumHorizon(null); setSiteAudit(null);
    Promise.allSettled([fetchWeather(point, time), fetchHorizon(point, solar.azimuth), fetchHorizon(point, maximumSolar.azimuth), reversePlace(point), fetchSiteAudit(point, solar.azimuth)])
      .then(results => {
        if (!active) return;
        if (results[0].status === 'fulfilled') setWeather(results[0].value); else setWeather(null);
        if (results[1].status === 'fulfilled') setHorizon(results[1].value); else setHorizon(null);
        if (results[2].status === 'fulfilled') setMaximumHorizon(results[2].value); else setMaximumHorizon(null);
        if (results[3].status === 'fulfilled') setPlace(results[3].value);
        if (results[4].status === 'fulfilled') setSiteAudit(results[4].value); else setSiteAudit(null);
        const missing = [];
        if (results[0].status === 'rejected') missing.push('météo');
        if (results[1].status === 'rejected' || results[2].status === 'rejected') missing.push('profil du relief');
        if (results[3].status === 'rejected') missing.push('adresse');
        setError(missing.length ? `Contrôle indisponible : ${missing.join(' · ')}.` : '');
        setLoading(false);
      });
    return () => { active = false; };
  }, [hasSelection, point.lat, point.lng, time, solar.azimuth, maximumSolar.azimuth]);

  const timeScore = Math.max(0, 100 - Math.abs(minutes(time) - MAXIMUM_MINUTE) * 1.5);
  const effectiveHorizon = Math.max(horizon?.maxAngle || 0, siteAudit?.maxObstacle?.angle || 0);
  const clearance = solar.altitude - effectiveHorizon;
  const maximumClearance = maximumHorizon ? maximumSolar.altitude - maximumHorizon.maxAngle : null;
  const terrainBlockedNow = Boolean(horizon && clearance <= 0);
  const terrainBlockedAtMaximum = Boolean(maximumHorizon && maximumClearance <= 0);
  const horizonScore = horizon ? Math.round(Math.max(0, Math.min(100, clearance / 7 * 100))) : 0;
  const weatherScore = weather?.score ?? 55;
  const confidence = (horizon?60:0) + (weather?30:0) + 10;
  let total = Math.round((horizonScore * .60 + weatherScore * .30 + timeScore * .10));
  if (siteAudit?.excluded) total = 0;
  else if (siteAudit?.forestNearby) total = Math.min(total, 30);
  else if (!horizon) total = Math.min(total,44);
  else if (!weather) total = Math.min(total,69);
  else if (clearance < 2) total = Math.min(total,44);
  else if (clearance < 4) total = Math.min(total,74);
  if (siteAudit?.urbanPenalty) total = Math.max(0, total - siteAudit.urbanPenalty);
  const color = scoreColor(total);
  const isComplete = Boolean(horizon && weather);
  const decisiveTerrainBlock = terrainBlockedNow || terrainBlockedAtMaximum;
  const availableDataFavorable = Boolean(horizon && weather && horizonScore >= 75 && weatherScore >= 75 && !siteAudit?.excluded && !decisiveTerrainBlock);
  const displayColor = decisiveTerrainBlock ? '#e03131' : !loading && !isComplete ? '#f08c00' : color;
  const resultLabel = terrainBlockedNow ? `Défavorable — Soleil masqué à ${time}` : terrainBlockedAtMaximum ? 'Défavorable au maximum de 20:19' : siteAudit?.onWater ? 'Point situé sur l’eau' : siteAudit?.inBuilding ? 'Bâtiment à moins de 5 m' : siteAudit?.forestNearby ? 'Défavorable — couvert forestier' : isComplete ? scoreLabel(total) : availableDataFavorable ? 'Favorable selon les données disponibles' : 'Estimation partielle';
  const resultExplanation = terrainBlockedNow ? `Le relief ou le bâti dépasse le Soleil de ${Math.abs(clearance).toFixed(1)}°.` : terrainBlockedAtMaximum ? (time === '20:19' ? `Le relief dépasse le Soleil de ${Math.abs(maximumClearance).toFixed(1)}°.` : `À ${time}, le Soleil est plus haut ; il passe derrière le relief vers 20:19.`) : isComplete ? `Score : relief 60 % · météo 30 % · heure 10 %${siteAudit?.urbanPenalty ? ` · contexte urbain −${siteAudit.urbanPenalty}` : ''}.` : 'Pourcentage estimé avec les composantes disponibles.';

  const onSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=8`;
    const data = await fetch(url).then(r => r.json());
    const feature = data.features?.[0];
    if (feature) { setPoint({ lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }); setHasSelection(true); setPanelOpen(true); setRecenterKey(key=>key+1); }
    else setError('Lieu introuvable en France.');
  };

  const resetSearch = () => {
    setPanelOpen(false);
    setHasSelection(false);
    setQuery('');
    setError('');
    setPlace(null);
    setWeather(null);
    setHorizon(null);
    setMaximumHorizon(null);
    setSiteAudit(null);
    setPoint(DEFAULT_POINT);
    setFranceKey(key => key + 1);
  };

  const locateUser = () => {
    if (!navigator.geolocation) { setError('La géolocalisation n’est pas disponible sur cet appareil.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        setPoint({lat:position.coords.latitude,lng:position.coords.longitude});
        setHasSelection(true); setPanelOpen(true); setRecenterKey(key=>key+1); setLocating(false);
      },
      () => { setError('Position non accessible. Autorisez la localisation puis réessayez.'); setLocating(false); },
      {enableHighAccuracy:true,timeout:12000,maximumAge:60000}
    );
  };

  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="brand" href={PUBLIC_BASE} aria-label="CartoKob, accueil"><GlobeHemisphereWest size={29} weight="regular" /><strong>CartoKob</strong></a>
        <div className="event-title"><strong>Où voir l’éclipse ?</strong><span>12 août 2026</span></div>
        <div className="event-summary"><Sun size={20} weight="fill" /><span><strong>Maximum vers 20:19</strong><small>Soleil bas · direction 284°</small></span></div>
        <nav><button onClick={() => setSafetyOpen(true)} aria-label="Informations et sécurité"><Info size={22}/><span>Précautions</span></button></nav>
      </header>

      {safetyOpen && <div className="safety-modal-backdrop">
        <section className="safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title">
          <div className="safety-modal-icon"><ShieldWarning size={32} weight="fill" /></div>
          <div className="section-kicker">AVANT D’OBSERVER</div>
          <h2 id="safety-title">Protégez impérativement vos yeux</h2>
          <p>Ne regardez jamais directement le Soleil sans lunettes d’éclipse certifiées <strong>ISO 12312-2</strong>. Les lunettes de soleil, jumelles et appareils photo sans filtre adapté ne protègent pas.</p>
          <p><strong>Respectez les propriétés privées et la sécurité routière.</strong> Restez sur les espaces autorisés, ne vous installez pas sur la chaussée et stationnez sans gêner la circulation.</p>
          <a href="https://www.service-public.fr/particuliers/actualites/A18393" target="_blank" rel="noreferrer">Lire les précautions officielles ↗</a>
          <button onClick={() => setSafetyOpen(false)}>J’ai compris, ouvrir la carte</button>
        </section>
      </div>}

      <main className={`workspace ${panelOpen ? '' : 'panel-closed'}`}>
        <aside className="controls">
          <div className="section-kicker">CARTE NATIONALE</div>
          <h1>Trouvez votre point d’observation</h1>
          <p>Cliquez n’importe où en France : le score combine le relief, la météo et l’heure d’observation.</p>
          <form onSubmit={onSearch} className="search-form">
            <label htmlFor="place-search">Adresse ou commune</label>
            <div><MagnifyingGlass size={18} /><input id="place-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Commune ou adresse" /><button aria-label="Rechercher"><ArrowRight size={18} /></button></div>
          </form>
          <div className="quick-actions"><button onClick={() => { setPanelOpen(false); setHasSelection(false); setFranceKey(key=>key+1); }}>France entière</button><button onClick={locateUser} disabled={locating}><Crosshair size={18} className={locating?'locating-icon':''} /> {locating?'Localisation…':'Me localiser'}</button></div>

          <div className="control-block">
            <div className="block-title"><CalendarBlank size={18} /><span>Heure d’observation</span><strong>{time}</strong></div>
            <input type="range" min="1170" max="1260" step="1" value={minutes(time)} onChange={e => { const n=+e.target.value; setTime(`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`); }} />
            <div className="range-labels"><span>19:30</span><span>Maximum 20:19</span><span>21:00</span></div>
          </div>

          <div className="safety"><ShieldWarning size={24} weight="fill" /><div><strong>Protégez vos yeux</strong><p>Ne regardez jamais le Soleil sans lunettes certifiées ISO 12312-2. Les lunettes de soleil ne protègent pas.</p><a href="https://www.service-public.fr/particuliers/actualites/A18393" target="_blank" rel="noreferrer">Précautions d’observation ↗</a></div></div>

          <div className="legend">
            <div className="block-title"><Mountains size={18} /><span>Visibilité du relief · 20:19</span></div>
            <label className="layer-toggle"><input type="checkbox" checked={showVisibility} onChange={e=>setShowVisibility(e.target.checked)} /><span>Afficher la surface favorable / défavorable</span></label>
            <div><i className="green" /><span><strong>Dégagé</strong> Marge de relief d’au moins 4°</span></div>
            <div><i className="orange" /><span><strong>Limite</strong> Marge comprise entre 0° et 4°</span></div>
            <div><i className="red" /><span><strong>Masqué</strong> Soleil sous le relief à 20:19</span></div>
            <small>Couche de relief uniquement, calculée avec le Soleil local et un horizon de 10 km. Le clic recalcule le profil et ajoute la météo au score.</small>
          </div>
        </aside>

        <section className="map-wrap" aria-label="Carte interactive de la France">
          <MapContainer center={[46.6034, 1.8883]} zoom={6} minZoom={5} maxZoom={17} zoomControl>
            <TileLayer attribution='© OpenStreetMap' opacity={0.62} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {showVisibility && <ImageOverlay url={`${PUBLIC_BASE}data/visibility-france-2026-08-12.png`} bounds={[[41.33363,-5.14026],[51.089,9.55996]]} opacity={0.68} interactive={false} />}
            {boundary && <GeoJSON data={boundary} style={{ color:'#070047', weight:2.2, fillColor:'#fff', fillOpacity:.05 }} />}
            {hasSelection && <Polygon positions={wedge} pathOptions={{color:'#000091',weight:2,fillColor:'#4fd1ff',fillOpacity:.22,dashArray:'7 6'}} />}
            {hasSelection && <Marker position={[point.lat, point.lng]} icon={L.divIcon({className:'score-marker',html:`<span class="${loading?'marker-loading':''}" style="--marker:${loading?'#5f6b7a':displayColor}"><b>${loading?'':decisiveTerrainBlock?'!':isComplete?total:'?'}</b></span>`,iconSize:[48,48],iconAnchor:[24,48]})} />}
            <ClickHandler onPick={(latlng) => { setPoint({lat:latlng.lat,lng:latlng.lng}); setHasSelection(true); setPanelOpen(true); setRecenterKey(key=>key+1); }} />
            <FranceView boundary={boundary} recenterKey={franceKey} />
            <MapUpdater point={point} recenterKey={recenterKey} />
          </MapContainer>
          <form onSubmit={onSearch} className="mobile-search"><MagnifyingGlass size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un lieu" aria-label="Rechercher un lieu"/><button type="button" className="locate-button" onClick={locateUser} disabled={locating} aria-label={locating?'Localisation en cours':'Je suis ici'} title="Je suis ici"><Crosshair size={19} className={locating?'locating-icon':''}/></button><button className="search-submit" aria-label="Lancer la recherche"><ArrowRight size={18}/></button></form>
          <div className="map-instruction"><MapPin size={18} weight="fill" /><span><strong>Touchez la carte</strong> pour analyser ce lieu</span></div>
          <div className="surface-chip"><Mountains size={18}/><span><strong>Relief à 20:19</strong> · score complet au clic</span></div>
          <div className="direction-chip"><Compass size={20} /><span><strong>{Math.round(solar.azimuth)}°</strong> · ouest-nord-ouest</span><b>{time}</b></div>
        </section>

        {panelOpen && hasSelection && <button className="reset-map-button" onClick={resetSearch}><MagnifyingGlass size={17}/> Nouvelle recherche</button>}
        {panelOpen && hasSelection && <aside className="details" aria-live="polite" aria-busy={loading}>
          <div className="sheet-handle" aria-hidden="true" />
          <button className="close" onClick={() => setPanelOpen(false)} aria-label="Fermer"><X size={20} /></button>
          <div className="details-scroll">
          <div className="mobile-score-hero" style={{'--score-color':displayColor}}>
            <div className="score-gauge"><CircularProgressbar value={loading ? 18 : decisiveTerrainBlock ? 0 : total} text={loading ? '…' : decisiveTerrainBlock ? '!' : `${total}`} styles={buildStyles({pathColor:displayColor,textColor:'#071d57',trailColor:'#dfe5ee',textSize:'28px',strokeLinecap:'round'})}/></div>
            <div><b>{loading ? '…' : decisiveTerrainBlock ? '!' : total}</b><strong>{loading ? 'Analyse…' : resultLabel}</strong><span><ArrowRight size={25} weight="bold" /> {Math.round(solar.azimuth)}°</span><small>ouest-nord-ouest</small></div>
          </div>
          <div className="mobile-factor-summary">
            <div><Mountains size={23}/><span>Marge d’horizon</span><strong>{horizon ? `${clearance.toFixed(1)}°` : '…'}</strong></div>
            <div><CloudSun size={23}/><span>Météo prévue</span><strong>{weather ? `${weatherScore}%` : '…'}</strong></div>
            <div><Buildings size={23}/><span>Environnement bâti</span><strong>{siteAudit ? `${siteAudit.buildingScore}%` : '…'}</strong></div>
          </div>
          <button className="new-search" onClick={resetSearch}><MagnifyingGlass size={18}/> Nouvelle recherche</button>
          <div className="section-kicker">LIEU SÉLECTIONNÉ</div>
          <h2>{place?.name || 'Point sélectionné'}</h2><p className="place-subtitle">{place ? `${place.postcode} · ${place.city}` : `${point.lat.toFixed(5)}° N · ${point.lng.toFixed(5)}° E`}</p>
          <div className="details-safety"><ShieldWarning size={18} weight="fill" /><span><strong>Observation protégée uniquement.</strong> Lunettes certifiées ISO 12312-2 obligatoires.</span></div>
          <div className="confidence-line"><span>Composantes du score disponibles</span><strong>{confidence}/100</strong></div>
          <div className="score-card" style={{'--score-color':displayColor}}>
            <div className="score-number">{loading ? <span className="loading-spinner" aria-hidden="true" /> : decisiveTerrainBlock ? '!' : isComplete ? total : '—'}{isComplete && !decisiveTerrainBlock && <small>/100</small>}</div>
            <div className="score-copy" role={loading ? 'status' : undefined}><strong>{loading ? 'Analyse en cours…' : resultLabel}</strong><p>{loading ? 'Relief, météo et données du lieu sont interrogés.' : resultExplanation}</p>{loading && <span className="loading-track"><i /></span>}</div>
          </div>
          {error && <div className="data-warning"><WarningCircle size={18} />{error}</div>}
          <div className="coordinates"><span>{point.lat.toFixed(5)}° N</span><span>{point.lng.toFixed(5)}° E</span><button onClick={() => navigator.clipboard?.writeText(`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`)}>Copier</button></div>

          <section className="detail-section">
            <div className="detail-heading"><Binoculars size={21} /><div><small>HEURE CONSEILLÉE</small><strong>20:19</strong></div><span>Maximum local</span></div>
            <div className="sun-line"><div className="compass-disc"><ArrowRight size={28} weight="bold" style={{transform:`rotate(${solar.azimuth}deg)`}} /></div><div><strong>Regardez vers {Math.round(solar.azimuth)}°</strong><p>Ouest-nord-ouest · Soleil à {solar.altitude.toFixed(1)}°</p></div></div>
          </section>

          <section className="detail-section">
            <div className="section-row"><h3>Profil de l’horizon</h3><span>{horizon ? `${effectiveHorizon.toFixed(1)}° max.` : 'analyse…'}</span></div>
            <HorizonCanvas profile={horizon?.profile || [{angle:0},{angle:2},{angle:1},{angle:3},{angle:1}]} sunAltitude={Math.max(0,solar.altitude)} obstacle={siteAudit?.maxObstacle} />
            <div className="horizon-key"><span><i className="terrain-line" />Relief dans l’axe</span><span><i className="sun-dash" />Hauteur du Soleil</span>{siteAudit?.maxObstacle && <span><i className="obstacle-line" />Obstacle cartographié</span>}</div>
            <div className="factor-row"><CheckCircle size={19} color={scoreColor(horizonScore)} weight="fill" /><div><strong>Horizon réel · {horizonScore}/100</strong><p>Marge au-dessus des obstacles : {clearance.toFixed(1)}°. Relief analysé jusqu’à 10 km.</p></div></div>
          </section>

          <section className="detail-section factors">
            <div className="factor-row"><CloudSun size={22} color={scoreColor(weatherScore)} /><div><strong>Météo · {weatherScore}/100</strong><p>{weather ? `${weather.cloud}% de nuages · pluie ${weather.rain}% · vent ${weather.wind} km/h` : 'Prévision momentanément indisponible'}</p></div></div>
            <div className="factor-row"><Buildings size={22} color={scoreColor(siteAudit?.buildingScore ?? 50)} /><div><strong>Bâti · {siteAudit ? `${siteAudit.buildingScore}/100` : 'analyse…'}</strong><p>{siteAudit ? (siteAudit.nearbyBuildingCount ? `${siteAudit.nearbyBuildingCount} bâtiments dans un rayon de 180 m · pénalité urbaine −${siteAudit.urbanPenalty} points.` : 'Aucun environnement bâti dense détecté à proximité.') : 'Hauteurs du bâti momentanément indisponibles.'}</p></div></div>
          </section>

          {siteAudit && <section className="detail-section ground-audit">
            <div className="section-row"><h3>Contrôle du lieu et de l’axe</h3><span>{siteAudit.buildingSource}</span></div>
            <div className={siteAudit?.onWater ? 'audit-row danger' : 'audit-row ok'}><Waves size={18}/><span>Point sur l’eau</span><strong>{siteAudit ? (siteAudit.onWater ? 'Oui' : 'Non') : '…'}</strong></div>
            <div className={siteAudit?.inBuilding ? 'audit-row danger' : 'audit-row ok'}><Buildings size={18}/><span>Bâtiment à moins de 5 m</span><strong>{siteAudit ? (siteAudit.inBuilding ? 'Oui' : 'Non') : '…'}</strong></div>
            <div className={siteAudit?.forestNearby ? 'audit-row danger' : 'audit-row ok'}><Tree size={18}/><span>Couvert forestier autour du point</span><strong>{siteAudit.forestNearby ? 'Oui · score plafonné' : siteAudit.treesNearby ? `${siteAudit.treesNearby} arbres ou haies proches` : 'Non signalé'}</strong></div>
            <div className={siteAudit?.privateNearby ? 'audit-row warn' : 'audit-row ok'}><Info size={18}/><span>Accès privé éventuellement à proximité</span><strong>{siteAudit ? (siteAudit.privateNearby ? 'À vérifier' : 'Non signalé') : '…'}</strong></div>
            <div className={siteAudit?.maxObstacle ? 'audit-row warn' : 'audit-row ok'}><Tree size={18}/><span>Obstacle détecté dans l’axe</span><strong>{siteAudit?.maxObstacle ? `${siteAudit.maxObstacle.kind} · ${siteAudit.maxObstacle.height.toFixed(1)} m · ${Math.round(siteAudit.maxObstacle.distance)} m` : siteAudit ? 'Aucun' : '…'}</strong></div>
          </section>}

          <div className="method-note"><Info size={18} /><p><strong>Le pourcentage est une aide à la décision.</strong> Il combine relief, hauteur du bâti, densité urbaine, météo et heure. Vérifiez toujours les conditions réelles sur place et respectez les accès autorisés.</p></div>
          <div className="route-actions" aria-label="Préparer l’itinéraire">
            <a className="route-button" href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`} target="_blank" rel="noreferrer"><Car size={19} /> Google Maps</a>
            <a className="route-button route-button-secondary" href={`https://maps.apple.com/?daddr=${point.lat},${point.lng}&dirflg=d`} target="_blank" rel="noreferrer"><MapPin size={19} /> Plans Apple</a>
            <a className="route-button route-button-secondary" href={`https://www.waze.com/live-map/directions?navigate=yes&to=ll.${point.lat}%2C${point.lng}`} target="_blank" rel="noreferrer"><Compass size={19} /> Waze</a>
          </div>
          <a className="photo-button" href={`https://www.mapillary.com/app/?lat=${point.lat}&lng=${point.lng}&z=17`} target="_blank" rel="noreferrer">Voir les photos disponibles sur Mapillary ↗</a>
          </div>
        </aside>}
        {hasSelection && !panelOpen && <button className="reopen" onClick={() => setPanelOpen(true)}>Voir le résultat <ArrowRight size={18}/></button>}
      </main>
      <footer><span><GlobeHemisphereWest size={14}/> CartoKob</span><span>Données : IGN BD TOPO · Open-Meteo · Base Adresse Nationale · OpenStreetMap · Mapzen</span></footer>
    </div>
  );
}
