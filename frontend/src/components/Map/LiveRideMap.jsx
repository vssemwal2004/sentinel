import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Basic circle markers (avoid external image fetch issues)
const busIcon = new L.DivIcon({ className: 'bus-marker', html: '<div style="background:#2563eb;color:#fff;border-radius:4px;padding:2px 4px;font-size:10px;">BUS</div>' });
const pointIcon = new L.DivIcon({ className: 'point-marker', html: '<div style="background:#059669;color:#fff;border-radius:50%;width:12px;height:12px;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>' });
const destIcon = new L.DivIcon({ className: 'dest-marker', html: '<div style="background:#dc2626;color:#fff;border-radius:50%;width:12px;height:12px;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>' });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(()=>{
    const filtered = points.filter(p=>p && !Number.isNaN(p[0]) && !Number.isNaN(p[1]));
    if(filtered.length === 0) return;
    if(filtered.length === 1){
      map.setView(filtered[0], 14);
    } else {
      const b = L.latLngBounds(filtered.map(p=>L.latLng(p[0], p[1])));
      map.fitBounds(b, { padding: [30,30] });
    }
  },[points, map]);
  return null;
}

/**
 * LiveRideMap props:
 *  - origin: { lat, lng }
 *  - destination: { lat, lng }
 *  - bus: { lat, lng }
 *  - etaMinutes: number
 *  - users: array of { userId, name, lat, lng }
 */
export default function LiveRideMap({ origin, destination, bus, etaMinutes, users=[] }) {
  const originPoint = origin?.lat && origin?.lng ? [origin.lat, origin.lng] : null;
  const destPoint = destination?.lat && destination?.lng ? [destination.lat, destination.lng] : null;
  const busPoint = bus?.lat && bus?.lng ? [bus.lat, bus.lng] : null;
  const linePoints = originPoint && destPoint ? [originPoint, destPoint] : null;
  return (
    <div className="h-full w-full relative">
      <MapContainer style={{ height: '100%', width:'100%' }} center={originPoint || busPoint || [0,0]} zoom={13} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
  <FitBounds points={[originPoint, destPoint, busPoint, ...users.map(u=>[u.lat,u.lng])].filter(Boolean)} />
        {linePoints && <Polyline positions={linePoints} pathOptions={{ color: '#2563eb', dashArray: '6 6' }} />}
        {originPoint && <Marker position={originPoint} icon={pointIcon}><Popup>Origin</Popup></Marker>}
        {destPoint && <Marker position={destPoint} icon={destIcon}><Popup>Destination</Popup></Marker>}
        {busPoint && <Marker position={busPoint} icon={busIcon}><Popup>Bus{etaMinutes?` | ETA ${etaMinutes}m`:''}</Popup></Marker>}
        {users.map(u=> (
          (u.lat!=null && u.lng!=null) && <Marker key={u.userId || u.name} position={[u.lat, u.lng]} icon={new L.DivIcon({ className:'user-marker', html:`<div style=\"background:#f59e0b;color:#111;border-radius:4px;padding:2px 4px;font-size:10px;\">U</div>` })}>
            <Popup>{u.name || 'User'}</Popup>
          </Marker>
        ))}
      </MapContainer>
      {etaMinutes!=null && <div className="absolute top-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs font-medium shadow">
        ETA: {etaMinutes} min
      </div>}
    </div>
  );
}
