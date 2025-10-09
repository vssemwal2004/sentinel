import { MapContainer, TileLayer, CircleMarker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function levelColor(level){
  switch(level){
    case 'Smooth': return '#16a34a';
    case 'Moderate': return '#eab308';
    case 'Heavy': return '#dc2626';
    default: return '#6b7280';
  }
}

export default function TrafficMap({ signals, onSelect, showHeat=true }){
  const center = signals?.[0]?.location || { lat: 28.6203, lng: 77.3811 };
  const maxDensity = signals.reduce((m,s)=> Math.max(m, s.density||0), 0) || 1;
  return <MapContainer center={[center.lat, center.lng]} zoom={14} className="w-full h-80 rounded" scrollWheelZoom>
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors" />
    {showHeat && <LayerGroup>
      {signals.map(sig=>{
        const scale = (sig.density || 0) / maxDensity; // 0..1
        const radius = 40 + scale * 60; // pixel radius for heat circle
        const color = levelColor(sig.level);
        const opacity = 0.15 + scale * 0.35;
        return <CircleMarker
          key={sig.signalId+':heat'}
          center={[sig.location.lat, sig.location.lng]}
          radius={radius}
          pathOptions={{ color: color, fillColor: color, fillOpacity: opacity, weight: 0 }} />;
      })}
    </LayerGroup>}
    {signals.map(sig=> <CircleMarker key={sig.signalId}
      center={[sig.location.lat, sig.location.lng]}
      radius={12}
      pathOptions={{ color: levelColor(sig.level), fillColor: levelColor(sig.level), fillOpacity: 0.6 }}
      eventHandlers={{ click: ()=> onSelect && onSelect(sig) }}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-semibold">{sig.name}</p>
          <p>Entry: {sig.entryCount} Exit: {sig.exitCount}</p>
          <p>Density: {sig.density}</p>
          <p>Status: <span style={{ color: levelColor(sig.level) }}>{sig.level}</span></p>
          <p className="text-[10px] text-gray-500">{new Date(sig.timestamp).toLocaleTimeString()}</p>
        </div>
      </Popup>
    </CircleMarker>)}
  </MapContainer>;
}
