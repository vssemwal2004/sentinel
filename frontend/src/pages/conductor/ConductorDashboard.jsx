import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';

let sockets = {};

export default function ConductorDashboard(){
  const [rides, setRides] = useState([]);
  const [form, setForm] = useState({ type: 'intra', origin: '', destination: '', originLat: '', originLng: '', destinationLat: '', destinationLng: '' });
  const [selected, setSelected] = useState(null);
  const [newPassenger, setNewPassenger] = useState('');
  const [location, setLocation] = useState({ lat: '', lng: '', etaMinutes: '' });
  const [autoLoc, setAutoLoc] = useState(true);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ t: 0, lat: null, lng: null });
  const [counter, setCounter] = useState('');
  const [availableBuses, setAvailableBuses] = useState([]);
  const [busId, setBusId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { load(); }, [form.type]);

  async function load(){
    setLoading(true);
    try {
      const d = await api.listRides({});
      setRides(d.rides);
      const b = await api.availableBuses(form.type);
      setAvailableBuses(b.buses);
    } finally {
      setLoading(false);
    }
  }

  async function createRide(){
    if(!busId) { alert('Select a bus'); return; }
    setLoading(true);
    try {
      const payload = { 
        ...form, 
        busId,
        originLat: form.originLat ? parseFloat(form.originLat) : undefined,
        originLng: form.originLng ? parseFloat(form.originLng) : undefined,
        destinationLat: form.destinationLat ? parseFloat(form.destinationLat) : undefined,
        destinationLng: form.destinationLng ? parseFloat(form.destinationLng) : undefined 
      };
      const d = await api.createRide(payload);
      setForm({ type: 'intra', origin: '', destination: '', originLat: '', originLng: '', destinationLat: '', destinationLng: '' });
      setBusId('');
      await load();
      setSelected(d.ride._id);
    } finally {
      setLoading(false);
    }
  }

  async function addPassenger(){
    if(!selected) return;
    setLoading(true);
    try {
      await api.addPassenger(selected, { name: newPassenger, method: 'cash', paid: false });
      setNewPassenger('');
      await refreshSelected();
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelected(){
    if(!selected) return;
    const d = await api.getRide(selected);
    setRides(rs => rs.map(r => r._id === selected ? d.ride : r));
  }

  async function updateLocation(manual = false){
    if(!selected) return;
    if(!location.lat || !location.lng) return;
    setLoading(true);
    try {
      const payload = { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
      if(manual && location.etaMinutes) payload.etaMinutes = parseInt(location.etaMinutes);
      await api.updateLocation(selected, payload);
      if(manual) await refreshSelected();
    } finally {
      setLoading(false);
    }
  }

  // Setup geolocation watch
  useEffect(() => {
    if(!autoLoc){
      if(watchIdRef.current){ navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    if(!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude } = pos.coords;
      setLocation(l => ({...l, lat: latitude.toFixed(6), lng: longitude.toFixed(6) }));
      const now = Date.now();
      const distMoved = (() => {
        if(lastSentRef.current.lat == null) return Infinity;
        const dx = latitude - lastSentRef.current.lat;
        const dy = longitude - lastSentRef.current.lng;
        return Math.sqrt(dx * dx + dy * dy);
      })();
      if(now - lastSentRef.current.t > 7000 || distMoved > 0.0005){
        lastSentRef.current = { t: now, lat: latitude, lng: longitude };
        updateLocation(false);
      }
    }, err => {
      console.warn('Geolocation error', err);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => { if(watchIdRef.current){ navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; } };
  }, [autoLoc, selected]);

  const current = rides.find(r => r._id === selected);
  const [userMarkers, setUserMarkers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if(!selected) return;
    if(socketRef.current) { socketRef.current.emit('leaveRide', socketRef.current.currentRide); }
    if(!socketRef.current){
      socketRef.current = io(import.meta.env.VITE_API_WS || 'http://localhost:4000', { transports: ['websocket'] });
    }
    socketRef.current.currentRide = selected;
    socketRef.current.emit('joinRide', selected);
    socketRef.current.on('ride:userLocations', payload => {
      if(payload.rideId === selected) setUserMarkers(payload.users);
    });
    return () => {
      if(socketRef.current){ socketRef.current.emit('leaveRide', selected); }
    };
  }, [selected]);

  async function updateCounter(){
    if(!selected) return;
    setLoading(true);
    try {
      await api.updateCounter(selected, parseInt(counter));
      setCounter('');
      await refreshSelected();
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(i){
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/conductor/rides/${selected}/passengers/${i}/pay`, { 
        method: 'PATCH', 
        credentials: 'include', 
        headers: { 'Content-Type': 'application/json' }
      });
      await refreshSelected();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-white">Conductor Panel</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {sidebarOpen ? '←' : '→'}
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-600 text-white">
            <span className="text-xl">🚌</span>
            {sidebarOpen && <span className="font-medium">Active Rides</span>}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg text-gray-300">
            <span className="text-xl">📊</span>
            {sidebarOpen && <span className="font-medium">Analytics</span>}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg text-gray-300">
            <span className="text-xl">⚙️</span>
            {sidebarOpen && <span className="font-medium">Settings</span>}
          </div>
        </nav>

        {/* Quick Stats */}
        {sidebarOpen && current && (
          <div className="p-4 border-t border-gray-700 mt-4">
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Current Route</p>
                <p className="font-medium text-white truncate">{current.origin} → {current.destination}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Passengers</p>
                <p className="font-medium text-white">{current.passengers.length}{current.seatsTotal ? ` / ${current.seatsTotal}` : ''}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">ETA</p>
                <p className="font-medium text-white">{current.etaMinutes || '—'} min</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Conductor Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your rides, track locations, and handle passengers</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Create Ride & Ride List */}
          <div className="space-y-8">
            {/* Create Ride Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                Create New Ride
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ride Type</label>
                    <select 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={form.type} 
                      onChange={e => setForm(f => ({...f, type: e.target.value}))}
                    >
                      <option value="intra">Intra-City</option>
                      <option value="inter">Inter-City</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Bus *</label>
                    <select 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={busId} 
                      onChange={e => setBusId(e.target.value)}
                    >
                      <option value="">Choose a bus</option>
                      {availableBuses.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.number} - {b.seats} seats {b.type ? `| ${b.type}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Origin</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Starting point"
                      value={form.origin} 
                      onChange={e => setForm(f => ({...f, origin: e.target.value}))} 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Destination"
                      value={form.destination} 
                      onChange={e => setForm(f => ({...f, destination: e.target.value}))} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Origin Latitude</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Latitude"
                      value={form.originLat} 
                      onChange={e => setForm(f => ({...f, originLat: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Origin Longitude</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Longitude"
                      value={form.originLng} 
                      onChange={e => setForm(f => ({...f, originLng: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dest Latitude</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Latitude"
                      value={form.destinationLat} 
                      onChange={e => setForm(f => ({...f, destinationLat: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dest Longitude</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Longitude"
                      value={form.destinationLng} 
                      onChange={e => setForm(f => ({...f, destinationLng: e.target.value}))} 
                    />
                  </div>
                </div>

                <button 
                  onClick={createRide} 
                  disabled={loading || !busId}
                  className="w-full bg-blue-600 disabled:opacity-50 text-white py-4 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Ride...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Create Ride
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Rides List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  Active Rides ({rides.length})
                </h2>
              </div>

              <div className="space-y-3 max-h-96 overflow-auto">
                {rides.map(ride => (
                  <div 
                    key={ride._id} 
                    className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                      selected === ride._id 
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                    }`}
                    onClick={() => setSelected(ride._id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{ride.origin} → {ride.destination}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ride.type === 'inter' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {ride.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>👥 {ride.passengers.length}{ride.seatsTotal ? ` / ${ride.seatsTotal}` : ''}</span>
                      {ride.busNumber && <span>🚌 {ride.busNumber}</span>}
                      <span>⏱️ {ride.etaMinutes || '—'} min</span>
                    </div>
                  </div>
                ))}
              </div>

              {rides.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🚌</div>
                  <p className="text-gray-500 text-lg">No active rides</p>
                  <p className="text-gray-400">Create your first ride to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Ride Details */}
          <div>
            {current ? (
              <div className="space-y-8">
                {/* Ride Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Ride Details</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      current.type === 'inter' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {current.type} Ride
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Route</p>
                      <p className="font-semibold text-gray-900">{current.origin} → {current.destination}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ETA</p>
                      <p className="font-semibold text-gray-900">{current.etaMinutes || '—'} minutes</p>
                    </div>
                    {current.busNumber && (
                      <div>
                        <p className="text-sm text-gray-600">Bus</p>
                        <p className="font-semibold text-gray-900">{current.busNumber} ({current.seatsTotal} seats)</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Passengers</p>
                      <p className="font-semibold text-gray-900">{current.passengers.length}{current.seatsTotal ? ` / ${current.seatsTotal}` : ''}</p>
                    </div>
                  </div>

                  {current.busLocation?.lat && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">Current Position</p>
                      <p className="font-medium text-gray-900">
                        {current.busLocation.lat?.toFixed ? current.busLocation.lat.toFixed(4) : current.busLocation.lat}, 
                        {current.busLocation.lng?.toFixed ? current.busLocation.lng.toFixed(4) : current.busLocation.lng}
                      </p>
                    </div>
                  )}
                </div>

                {/* Live Map */}
                {(current.busLocation?.lat || (current.originCoords?.lat && current.destinationCoords?.lat)) && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Route Map</h3>
                    <div className="h-80 rounded-xl overflow-hidden border border-gray-200">
                      <LiveRideMap 
                        origin={current.originCoords} 
                        destination={current.destinationCoords} 
                        bus={current.busLocation} 
                        etaMinutes={current.etaMinutes} 
                        users={userMarkers} 
                      />
                    </div>
                  </div>
                )}

                {/* Location & ETA Management */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📍</span>
                    Location & ETA Management
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <input 
                        type="checkbox" 
                        checked={autoLoc} 
                        onChange={e => setAutoLoc(e.target.checked)} 
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-blue-900">Auto GPS Tracking</p>
                        <p className="text-sm text-blue-700">Uses device GPS to push live position automatically</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                        <input 
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100"
                          placeholder="Latitude"
                          value={location.lat} 
                          onChange={e => setLocation(l => ({...l, lat: e.target.value}))} 
                          disabled={autoLoc}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                        <input 
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100"
                          placeholder="Longitude"
                          value={location.lng} 
                          onChange={e => setLocation(l => ({...l, lng: e.target.value}))} 
                          disabled={autoLoc}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Manual ETA (minutes)</label>
                      <input 
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter ETA in minutes"
                        value={location.etaMinutes} 
                        onChange={e => setLocation(l => ({...l, etaMinutes: e.target.value}))} 
                      />
                    </div>

                    <button 
                      onClick={() => updateLocation(true)} 
                      disabled={loading}
                      className="w-full bg-purple-600 disabled:opacity-50 text-white py-3 rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <span>📤</span>
                          Send Location Update
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Passenger Management */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>👥</span>
                    Passenger Management
                  </h3>

                  <div className="space-y-4">
                    {/* Counter Update */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Update Passenger Counter</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter counter value"
                          value={counter} 
                          onChange={e => setCounter(e.target.value)} 
                        />
                        <button 
                          onClick={updateCounter} 
                          disabled={loading}
                          className="bg-indigo-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all duration-200 font-medium"
                        >
                          Update
                        </button>
                      </div>
                    </div>

                    {/* Passenger List */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Passenger List</h4>
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {(current.seatAssignments && current.seatAssignments.length > 0 ? current.seatAssignments : current.passengers).map((p, i) => {
                          const seatLabel = p.seatNumber ? `Seat ${p.seatNumber}: ` : '';
                          return (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  p.paid ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                                }`}>
                                  {p.paid ? '✓' : '💵'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{seatLabel}{p.name || 'Guest'}</p>
                                  <p className="text-sm text-gray-500">{p.method || 'cash'} payment</p>
                                </div>
                              </div>
                              {!p.paid && (
                                <button 
                                  onClick={() => markPaid(i)} 
                                  disabled={loading}
                                  className="bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium"
                                >
                                  Mark Paid
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add Passenger */}
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Add New Passenger</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter passenger name"
                          value={newPassenger} 
                          onChange={e => setNewPassenger(e.target.value)} 
                        />
                        <button 
                          onClick={addPassenger} 
                          disabled={loading}
                          className="bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-all duration-200 font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🚌</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Ride Selected</h3>
                <p className="text-gray-500">Select a ride from the list to view details and manage passengers</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}