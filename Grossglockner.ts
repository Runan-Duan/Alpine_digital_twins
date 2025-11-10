import React, { useEffect, useRef, useState } from 'react';
import { Cloud, Layers, ZoomIn, ZoomOut, Maximize2, Info, AlertTriangle, Calendar, Clock, Map, Mountain } from 'lucide-react';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  map: {
    center: [47.074, 12.732], // Großglockner coordinates [lat, lon] for Leaflet
    zoom: 10,
    bounds: [[47.02, 12.6], [47.12, 12.9]],
    tiles: {
      satellite: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      hillshade: 'https://tiles.wmflabs.org/hillshade/{z}/{x}/{y}.png'
    }
  },
  weather: {
    apiUrl: 'https://api.open-meteo.com/v1/forecast',
    updateInterval: 600000 // 10 minutes
  }
};

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Drizzle: Light',
  53: 'Drizzle: Moderate',
  55: 'Drizzle: Dense',
  61: 'Rain: Slight',
  63: 'Rain: Moderate',
  65: 'Rain: Heavy',
  71: 'Snow fall: Slight',
  73: 'Snow fall: Moderate',
  75: 'Snow fall: Heavy',
  95: 'Thunderstorm'
};

const SAMPLE_ROADS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 1, name: 'Grossglockner High Alpine Road' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [12.63, 47.04],
          [12.68, 47.06],
          [12.72, 47.08],
          [12.76, 47.09],
          [12.80, 47.10]
        ]
      }
    }
  ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const weatherUtils = {
  getDescription: (code) => WEATHER_CODES[code] || 'Unknown',
  
  fetchWeather: async (lat, lon) => {
    const url = `${CONFIG.weather.apiUrl}?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,snowfall_sum&timezone=auto`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      const current = data.current_weather || {};
      const daily = data.daily || {};
      
      return {
        temp: current.temperature,
        wind: current.windspeed,
        condition: current.weathercode,
        snow: daily.snowfall_sum ? daily.snowfall_sum[0] : 0,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Weather fetch failed:', error);
      return null;
    }
  }
};

// ============================================================================
// LOAD LEAFLET FROM CDN
// ============================================================================

const loadLeaflet = () => {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// ============================================================================
// COMPONENTS
// ============================================================================

const Header = ({ activeView, setActiveView }) => (
  <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white shadow-lg">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Mountain className="w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold tracking-wide">GROSSGLOCKNER</h1>
          <p className="text-xs text-blue-200">High Alpine Road · Digital Twin Platform</p>
        </div>
      </div>

      <nav className="flex items-center gap-6 text-sm">
        <button 
          onClick={() => setActiveView('map')} 
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            activeView === 'map' ? 'bg-white text-blue-900 font-semibold' : 'hover:bg-blue-700'
          }`}
        >
          <Map size={16} /> Map
        </button>
        <button 
          onClick={() => setActiveView('weather')} 
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            activeView === 'weather' ? 'bg-white text-blue-900 font-semibold' : 'hover:bg-blue-700'
          }`}
        >
          <Cloud size={16} /> Weather
        </button>
        <button 
          onClick={() => setActiveView('info')} 
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            activeView === 'info' ? 'bg-white text-blue-900 font-semibold' : 'hover:bg-blue-700'
          }`}
        >
          <Info size={16} /> Info
        </button>
      </nav>
    </div>
  </header>
);

const MapControls = ({ layersVisible, setLayersVisible, basemap, setBasemap, onZoomIn, onZoomOut, onFitBounds }) => {
  return (
    <div className="absolute top-4 left-4 z-[1000] space-y-2">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button 
          onClick={() => setLayersVisible(s => ({ ...s, roads: !s.roads }))}
          className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 font-medium text-gray-700"
        >
          <Layers size={18} />
          <span>Toggle Roads</span>
        </button>
        <button 
          onClick={() => setLayersVisible(s => ({ ...s, hillshade: !s.hillshade }))}
          className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 font-medium text-gray-700"
        >
          <span>Toggle Hillshade</span>
        </button>
        <div className="border-t p-3 bg-gray-50">
          <label className="text-xs font-medium text-gray-600">Basemap</label>
          <select 
            value={basemap} 
            onChange={(e) => setBasemap(e.target.value)}
            className="w-full mt-1 p-2 border rounded text-sm"
          >
            <option value="satellite">Satellite</option>
            <option value="osm">OpenStreetMap</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button 
          onClick={onZoomIn}
          className="w-full px-4 py-2 hover:bg-gray-50 border-b flex items-center justify-center"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={onZoomOut}
          className="w-full px-4 py-2 hover:bg-gray-50 border-b flex items-center justify-center"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={onFitBounds}
          className="w-full px-4 py-2 hover:bg-gray-50 flex items-center justify-center"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
};

const WeatherWidget = ({ weather }) => (
  <div className="absolute top-4 right-4 z-[1000]">
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud className="text-blue-600" size={20} />
          <span className="font-semibold text-gray-800">Live Weather</span>
        </div>
        <a 
          href="https://open-meteo.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-blue-600 hover:underline"
        >
          Open-Meteo
        </a>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Temperature</span>
          <span className="text-xl font-bold text-gray-800">
            {weather.temp !== null ? `${weather.temp}°C` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Wind</span>
          <span className="font-medium text-gray-800">
            {weather.wind !== null ? `${weather.wind} km/h` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Snow (daily)</span>
          <span className="font-medium text-gray-800">
            {weather.snow !== null ? `${weather.snow} cm` : '—'}
          </span>
        </div>
        <div className="pt-2 border-t text-sm text-gray-600">
          {weather.condition !== null ? weatherUtils.getDescription(weather.condition) : 'Loading...'}
        </div>
      </div>
    </div>

    <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg shadow-lg p-4 w-64 mt-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-yellow-600 flex-shrink-0" size={18} />
        <div>
          <h4 className="font-semibold text-yellow-800 text-sm">Road Status</h4>
          <p className="text-xs text-yellow-700 mt-1">
            Snow chains required above 2000m (sample alert)
          </p>
        </div>
      </div>
    </div>
  </div>
);

const WeatherPanel = ({ weather }) => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <Cloud className="text-blue-600" />Weather Forecast
    </h2>

    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
        <div className="text-sm opacity-90 mb-1">Now</div>
        <div className="text-5xl font-bold mb-2">
          {weather.temp !== null ? `${weather.temp}°C` : '—'}
        </div>
        <div className="text-lg">
          {weather.condition !== null ? weatherUtils.getDescription(weather.condition) : '—'}
        </div>
        <div className="mt-4 pt-4 border-t border-white border-opacity-30 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="opacity-80">Wind</div>
            <div className="font-semibold">
              {weather.wind !== null ? `${weather.wind} km/h` : '—'}
            </div>
          </div>
          <div>
            <div className="opacity-80">Snow</div>
            <div className="font-semibold">
              {weather.snow !== null ? `${weather.snow} cm` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar size={16} />5-Day Forecast
        </h3>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Weather Analysis</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Snow line at ~2,100m (sample)</li>
          <li>• Fresh snow: sample 15 cm</li>
          <li>• Moderate avalanche risk above 2,500m</li>
        </ul>
      </div>
    </div>
  </div>
);

const InfoPanel = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <Info className="text-blue-600" />Platform Information
    </h2>

    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Data Sources</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• DTM: Austrian BEV</li>
          <li>• Roads: sample GeoJSON / OSM</li>
          <li>• Weather: Open-Meteo API</li>
          <li>• Basemaps: OpenStreetMap & Satellite</li>
        </ul>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Features</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Real-time weather integration</li>
          <li>✓ Terrain visualization</li>
          <li>✓ Road network overlay</li>
          <li>✓ Interactive popups</li>
        </ul>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Technical Specs</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Elevation range:</span>
            <span className="font-mono">245 - 3,798m</span>
          </div>
          <div className="flex justify-between">
            <span>Area covered:</span>
            <span className="font-mono">~450 km²</span>
          </div>
          <div className="flex justify-between">
            <span>Road network:</span>
            <span className="font-mono">sample GeoJSON</span>
          </div>
          <div className="flex justify-between">
            <span>CRS:</span>
            <span className="font-mono">EPSG:4326</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Footer = ({ weather }) => (
  <footer className="bg-gray-800 text-gray-300 py-3 px-6">
    <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
      <div className="flex items-center gap-4">
        <span>© 2025 Großglockner Digital Twin</span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> Last updated: {
            weather.fetchedAt ? new Date(weather.fetchedAt).toLocaleString() : '—'
          }
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span>System Online</span>
      </div>
    </div>
  </footer>
);

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  
  const [weather, setWeather] = useState({
    temp: null,
    wind: null,
    snow: null,
    condition: null,
    fetchedAt: null
  });
  
  const [layersVisible, setLayersVisible] = useState({
    hillshade: true,
    roads: true
  });
  
  const [basemap, setBasemap] = useState('satellite');
  const [activeView, setActiveView] = useState('map');
  const [mapReady, setMapReady] = useState(false);

  // Initialize map with Leaflet
  useEffect(() => {
    let map;
    
    loadLeaflet().then((L) => {
      if (mapRef.current) return;

      map = L.map(mapContainer.current, {
        center: CONFIG.map.center,
        zoom: CONFIG.map.zoom,
        zoomControl: false
      });

      mapRef.current = map;

      // Add base layer
      const baseLayer = L.tileLayer(CONFIG.map.tiles.satellite, {
        maxZoom: 18,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps'
      });
      baseLayer.addTo(map);
      layersRef.current.baseLayer = baseLayer;

      // Add hillshade layer
      const hillshadeLayer = L.tileLayer(CONFIG.map.tiles.hillshade, {
        maxZoom: 18,
        opacity: 0.3,
        attribution: '© Wikimedia'
      });
      hillshadeLayer.addTo(map);
      layersRef.current.hillshadeLayer = hillshadeLayer;

      // Add roads layer
      const roadsLayer = L.geoJSON(SAMPLE_ROADS_GEOJSON, {
        style: {
          color: '#ffb400',
          weight: 4,
          opacity: 1
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.name) {
            layer.bindPopup(`<strong>${feature.properties.name}</strong><br/>ID: ${feature.properties.id}`);
          }
        }
      });
      roadsLayer.addTo(map);
      layersRef.current.roadsLayer = roadsLayer;

      // Add marker for Großglockner
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 16px;
          height: 16px;
          background: #e11;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      L.marker(CONFIG.map.center, { icon: customIcon })
        .addTo(map)
        .bindPopup('<strong>Großglockner</strong><br/>3,798 m');

      setMapReady(true);
    });

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle basemap changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const L = window.L;

    if (layersRef.current.baseLayer) {
      map.removeLayer(layersRef.current.baseLayer);
    }

    const tileUrl = basemap === 'satellite' 
      ? CONFIG.map.tiles.satellite 
      : CONFIG.map.tiles.osm;

    const options = basemap === 'satellite'
      ? {
          maxZoom: 18,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps'
        }
      : {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        };

    const newBaseLayer = L.tileLayer(tileUrl, options);
    newBaseLayer.addTo(map);
    layersRef.current.baseLayer = newBaseLayer;
  }, [basemap, mapReady]);

  // Toggle layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    if (layersRef.current.hillshadeLayer) {
      if (layersVisible.hillshade) {
        layersRef.current.hillshadeLayer.addTo(map);
      } else {
        map.removeLayer(layersRef.current.hillshadeLayer);
      }
    }

    if (layersRef.current.roadsLayer) {
      if (layersVisible.roads) {
        layersRef.current.roadsLayer.addTo(map);
      } else {
        map.removeLayer(layersRef.current.roadsLayer);
      }
    }
  }, [layersVisible, mapReady]);

  // Fetch weather data
  useEffect(() => {
    const fetchData = async () => {
      const data = await weatherUtils.fetchWeather(
        CONFIG.map.center[0],
        CONFIG.map.center[1]
      );
      if (data) setWeather(data);
    };

    fetchData();
    const interval = setInterval(fetchData, CONFIG.weather.updateInterval);
    return () => clearInterval(interval);
  }, []);

  // Map control handlers
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleFitBounds = () => {
    if (mapRef.current && window.L) {
      mapRef.current.fitBounds(CONFIG.map.bounds);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      <Header activeView={activeView} setActiveView={setActiveView} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-gray-100">
          <MapControls
            layersVisible={layersVisible}
            setLayersVisible={setLayersVisible}
            basemap={basemap}
            setBasemap={setBasemap}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitBounds={handleFitBounds}
          />
          
          <WeatherWidget weather={weather} />

          <div className="w-full h-full relative bg-gray-800">
            <div ref={mapContainer} className="absolute inset-0" />

            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-3 py-2 rounded text-xs z-[1000]">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-20 h-1 bg-black" />
                <span className="font-medium">2 km</span>
              </div>
              <div className="text-gray-600">© Open Data / Contributors</div>
            </div>
          </div>
        </div>

        {(activeView === 'weather' || activeView === 'info') && (
          <div className="w-96 bg-white border-l shadow-xl overflow-y-auto">
            {activeView === 'weather' && <WeatherPanel weather={weather} />}
            {activeView === 'info' && <InfoPanel />}
          </div>
        )}
      </div>

      <Footer weather={weather} />
    </div>
  );
}