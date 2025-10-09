import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';
import QrCameraScanner from '../../components/QR/QrCameraScanner.jsx';
import { 
  MapPin, Users, Ticket, Info, QrCode, Camera, Upload, 
  CreditCard, DollarSign, Bus, Navigation, UserCheck, 
  Clock, Shield, CheckCircle, X
} from 'lucide-react';

// Resolve API and WS endpoints from env vars with sensible defaults
const apiUrl = import.meta.env.VITE_API_URL; // full URL e.g., https://api.example.com/api
const apiOrigin = import.meta.env.VITE_API_ORIGIN; // origin only e.g., https://api.example.com
const API_BASE = apiUrl ? apiUrl.replace(/\/$/, '') : ((apiOrigin || 'http://localhost:4000').replace(/\/$/, '') + '/api');
const WS_BASE = import.meta.env.VITE_API_WS || (apiUrl ? new URL(apiUrl).origin : (apiOrigin || 'http://localhost:4000'));

let socket;

export default function RideDetail() {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [userLoc, setUserLoc] = useState(null);
  const [geoAllowed, setGeoAllowed] = useState(null);
  const [method, setMethod] = useState('online');
  const [qrValidated, setQrValidated] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [qrRaw, setQrRaw] = useState('');
  const [otherUsers, setOtherUsers] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [seats, setSeats] = useState([]);
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleQrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const bitmap = await file.arrayBuffer();
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = blobUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      if (!code) { alert('No QR code detected'); return; }
      const text = code.data.trim();
      setQrRaw(text);
      const v = await api.verifyRideQr(id, text);
      setVerificationToken(v.verificationToken);
      setQrValidated(true);
    } catch (err) {
      console.error(err);
      alert(err.message || 'QR decode/verify failed');
      setQrValidated(false);
      setVerificationToken(null);
    } finally {
      setLoading(false);
    }
  }

  function startCameraScan() {
    setShowScanner(true);
  }

  function handleDecodedFromCamera(text) {
    (async () => {
      setLoading(true);
      try {
        setQrRaw(text);
        const v = await api.verifyRideQr(id, text);
        setVerificationToken(v.verificationToken);
        setQrValidated(true);
        setShowScanner(false);
      } catch (err) {
        alert(err.message || 'Verification failed');
        setQrValidated(false);
        setVerificationToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const success = (pos) => {
      setGeoAllowed(true);
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLoc(loc);
      if (socket) socket.emit('user:location', { rideId: id, lat: loc.lat, lng: loc.lng });
    };
    const err = () => setGeoAllowed(false);
    navigator.geolocation.getCurrentPosition(success, err);
    const watchId = navigator.geolocation.watchPosition(success, err, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [id]);
  useEffect(() => {
    socket = io(WS_BASE, { transports: ['websocket'] });
    socket.emit('joinRide', id);
    socket.on('ride:update', msg => { if (msg.rideId === id) load(false); });
    socket.on('ride:userLocations', payload => { if (payload.rideId === id) setOtherUsers(payload.users); });
    socket.on('ride:counter', ({ rideId, count }) => {
      if (rideId === id) {
        setRide(prev => ({ ...prev, capacityCounter: count }));
      }
    });
    return () => { socket.emit('leaveRide', id); socket.disconnect(); };
  }, [id]);

  async function load(fetchDetails = true) {
    setLoading(true);
    try {
      const d = await api.getRide(id);
      setRide(d.ride);
      if (d.ride?.type === 'inter') {
        try {
          const seatData = await api.getRideSeats(id);
          setSeats(seatData.seats);
          setSeatAssignments(seatData.assignments);
        } catch (err) { }
      }
    } finally {
      setLoading(false);
    }
  }

  async function book() {
    if (ride.type === 'inter' && !qrValidated) {
      alert('Scan the bus QR first');
      return;
    }
    if (ride.type === 'inter' && !selectedSeat) {
      alert('Select a seat');
      return;
    }
    setLoading(true);
    try {
  const res = await fetch(`${API_BASE}/rides/${id}/book`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, verificationToken, seatNumber: selectedSeat })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Booking failed'); return; }
      await load();
    } finally {
      setLoading(false);
    }
  }

  function haversineKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const etaToUser = (() => {
    if (!userLoc || !ride?.busLocation?.lat) return null;
    const bus = { lat: Number(ride.busLocation.lat), lng: Number(ride.busLocation.lng) };
    if (Number.isNaN(bus.lat) || Number.isNaN(bus.lng)) return null;
    const distKm = haversineKm(bus, userLoc);
    if (distKm == null) return null;
    const speed = ride.type === 'inter' ? 55 : 30;
    return Math.max(1, Math.round(distKm / speed * 60));
  })();

  const menuItems = [
    { id: 'overview', label: 'Journey Overview', icon: Bus },
    { id: 'map', label: 'Live Tracking', icon: Navigation },
    { id: 'passengers', label: 'Passengers', icon: UserCheck },
    { id: 'book', label: 'Book Your Ride', icon: Ticket }
  ];

  if (!ride) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center border border-gray-100">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Loading Your Journey</h3>
            <p className="text-gray-600">Preparing your ride details...</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className={`bg-gradient-to-b from-blue-900 to-indigo-900 text-white transition-all duration-500 ${sidebarOpen ? 'w-80' : 'w-20'} flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-blue-700/50">
          <div className={`flex items-center gap-3 transition-all duration-300 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Bus className="w-6 h-6 text-blue-600" />
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <h1 className="text-xl font-bold">TransitPro</h1>
                <p className="text-blue-200 text-sm">Smart Travel</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 group ${
                      activeTab === item.id 
                        ? 'bg-white/10 text-white shadow-lg' 
                        : 'text-blue-200 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-6 h-6 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium text-left transition-all duration-300">
                        {item.label}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-blue-700/50">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-blue-200 text-sm">Active Passengers</p>
                <p className="text-white font-bold text-lg">{ride.capacityCounter}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200/60 sticky top-0 z-40 backdrop-blur-sm">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Book Your Ride</h1>
              <p className="text-gray-600 mt-1">{ride.origin} → {ride.destination}</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* ETA Display */}
              <div className="text-right">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Your ETA</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {etaToUser ? `${etaToUser} min` : '--'}
                </div>
              </div>

              {/* Toggle Sidebar */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors duration-200"
              >
                <div className={`w-4 h-4 border-t-2 border-r-2 border-gray-600 transition-transform duration-300 ${sidebarOpen ? 'rotate-45' : '-rotate-135'}`}></div>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 bg-gray-50/50">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="xl:col-span-2 space-y-6">
                {/* Route Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <Navigation className="w-7 h-7 text-blue-600" />
                    Route Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                        <div className="text-blue-900 font-semibold text-sm uppercase tracking-wide mb-2">Departure</div>
                        <div className="text-xl font-bold text-gray-900">{ride.origin}</div>
                      </div>
                      <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                        <div className="text-green-900 font-semibold text-sm uppercase tracking-wide mb-2">Arrival</div>
                        <div className="text-xl font-bold text-gray-900">{ride.destination}</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                        <div className="text-orange-900 font-semibold text-sm uppercase tracking-wide mb-2">Service Type</div>
                        <div className="text-2xl font-black text-gray-900">
                          {ride.type === 'inter' ? 'Inter-City' : 'Intra-City'}
                        </div>
                      </div>
                      {geoAllowed === false && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <p className="text-red-700 text-sm flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Enable location for accurate ETA
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveTab('map')}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl text-left hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg group"
                    >
                      <Navigation className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform duration-300" />
                      <div className="text-lg font-bold">Live Tracking</div>
                      <div className="text-blue-100 text-sm">Real-time bus location</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('book')}
                      className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl text-left hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-lg group"
                    >
                      <Ticket className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform duration-300" />
                      <div className="text-lg font-bold">Book Now</div>
                      <div className="text-green-100 text-sm">Secure your seat</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Service Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    Service Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Passengers</span>
                      <span className="font-bold text-blue-600">{ride.capacityCounter}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Capacity</span>
                      <span className="font-semibold text-gray-900">{ride.seatsTotal || 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Status</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Active</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-bold text-lg mb-4">Features</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Real-time GPS
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Live Updates
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Secure Booking
                    </li>
                    {ride.type === 'inter' && (
                      <li className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        QR Verification
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Navigation className="w-7 h-7 text-blue-600" />
                  Live Bus Tracking
                </h2>
              </div>
              <div className="h-[600px]">
                {(ride.busLocation?.lat || (ride.originCoords?.lat && ride.destinationCoords?.lat)) && (
                  <LiveRideMap
                    origin={ride.originCoords}
                    destination={ride.destinationCoords}
                    bus={ride.busLocation}
                    etaMinutes={ride.etaMinutes}
                    users={[...(userLoc ? [{ userId: 'me', name: 'You', lat: userLoc.lat, lng: userLoc.lng }] : []), ...otherUsers.filter(u => u.userId !== 'me')]}
                  />
                )}
              </div>
            </div>
          )}

          {/* Passengers Tab */}
          {activeTab === 'passengers' && ride.type === 'inter' && ride.passengers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <UserCheck className="w-7 h-7 text-blue-600" />
                Current Passengers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ride.passengers.map((p, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all duration-300 group hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">{p.name || 'Guest'}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.paid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                    {p.seatNumber && (
                      <div className="text-gray-600 text-sm">Seat: <span className="font-semibold">{p.seatNumber}</span></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Book Tab */}
          {activeTab === 'book' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Book Your Journey</h2>
                <p className="text-gray-600 mb-8">Secure your seat for {ride.origin} → {ride.destination}</p>

                {ride.type === 'inter' ? (
                  <div className="space-y-8">
                    {/* QR Verification */}
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-3">
                        <Shield className="w-5 h-5" />
                        Step 1: Verify Bus QR Code
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <button
                          onClick={startCameraScan}
                          className="bg-white border border-blue-300 rounded-xl p-4 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 group"
                        >
                          <Camera className="w-6 h-6 mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform duration-300" />
                          <div className="font-semibold text-blue-700">Camera Scan</div>
                        </button>
                        
                        <label className="bg-white border border-blue-300 rounded-xl p-4 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 group cursor-pointer">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform duration-300" />
                          <div className="font-semibold text-blue-700">Upload Image</div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrUpload}
                            className="hidden"
                          />
                        </label>

                        <div className="bg-white border border-blue-300 rounded-xl p-4">
                          <div className="font-semibold text-blue-700 mb-2 text-sm">Manual Entry</div>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                            placeholder="Paste QR text..."
                            value={qrRaw}
                            onChange={e => setQrRaw(e.target.value)}
                          />
                          <button
                            onClick={async () => {
                              if (!qrRaw) return;
                              setLoading(true);
                              try {
                                const v = await api.verifyRideQr(id, qrRaw);
                                setVerificationToken(v.verificationToken);
                                setQrValidated(true);
                              } catch (err) {
                                alert(err.message);
                                setQrValidated(false);
                                setVerificationToken(null);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                          >
                            {loading ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                      </div>

                      {qrValidated ? (
                        <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-2 text-green-800 font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            QR Verified - Proceed to seat selection
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
                          <span className="text-gray-600">Scan or upload bus QR code to continue</span>
                        </div>
                      )}
                    </div>

                    {/* Seat Selection */}
                    {qrValidated && (
                      <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                        <h3 className="text-lg font-bold text-green-900 mb-4">
                          Step 2: Select Your Seat
                        </h3>
                        <SeatGrid
                          seats={seats}
                          assignments={seatAssignments}
                          selectedSeat={selectedSeat}
                          onSelect={setSelectedSeat}
                        />
                      </div>
                    )}

                    {/* Payment Method */}
                    {qrValidated && selectedSeat && (
                      <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                        <h3 className="text-lg font-bold text-purple-900 mb-4">
                          Step 3: Choose Payment Method
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => setMethod('online')}
                            className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                              method === 'online' 
                                ? 'border-blue-500 bg-blue-50 shadow-md' 
                                : 'border-gray-300 bg-white hover:border-blue-300'
                            }`}
                          >
                            <CreditCard className="w-6 h-6 mb-2 text-blue-600" />
                            <div className="font-bold text-gray-900">Online Payment</div>
                            <div className="text-gray-600 text-sm mt-1">Pay now securely</div>
                          </button>
                          <button
                            onClick={() => setMethod('cash')}
                            className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                              method === 'cash' 
                                ? 'border-green-500 bg-green-50 shadow-md' 
                                : 'border-gray-300 bg-white hover:border-green-300'
                            }`}
                          >
                            <DollarSign className="w-6 h-6 mb-2 text-green-600" />
                            <div className="font-bold text-gray-900">Cash Payment</div>
                            <div className="text-gray-600 text-sm mt-1">Pay when boarding</div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Final Booking */}
                    {qrValidated && selectedSeat && (
                      <button
                        onClick={book}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-4 rounded-xl hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg transform hover:scale-105 transition-all duration-300"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Processing Booking...
                          </div>
                        ) : (
                          `Confirm Booking - Seat ${selectedSeat}`
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ticket className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Intra-City Service</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      No booking required for intra-city rides. Simply board the bus and pay as you go!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Scan QR Code</h3>
              <button
                onClick={() => setShowScanner(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <QrCameraScanner
              onDecode={handleDecodedFromCamera}
              onError={(e) => console.warn('Scanner error', e)}
              onClose={() => setShowScanner(false)}
              facingMode="environment"
              scanIntervalMs={400}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SeatGrid({ seats, assignments, selectedSeat, onSelect }) {
  if (!seats || seats.length === 0) return (
    <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-300">
      <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
        <Ticket className="w-6 h-6 text-gray-600" />
      </div>
      <p className="text-gray-600">No seat data available</p>
      <p className="text-gray-500 text-sm mt-1">Please verify QR code first</p>
    </div>
  );

  const taken = new Set(assignments.map(a => a.seatNumber));
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) rows.push(seats.slice(i, i + 4));

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex flex-col gap-3">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-3 items-center justify-center">
            {row.map(seat => {
              const isTaken = taken.has(seat);
              const isSel = seat === selectedSeat;
              return (
                <button
                  key={seat}
                  type="button"
                  disabled={isTaken}
                  onClick={() => onSelect(seat)}
                  className={`
                    w-12 h-12 rounded-lg border-2 flex items-center justify-center relative
                    transition-all duration-300 hover:scale-110 font-semibold text-sm
                    ${isTaken
                      ? 'bg-gray-100 border-gray-400 text-gray-500 cursor-not-allowed'
                      : 'bg-white border-blue-400 text-blue-700 hover:border-blue-600 hover:bg-blue-50'
                    }
                    ${isSel ? 'ring-2 ring-blue-400 border-blue-600 bg-blue-100 scale-110 shadow-md' : ''}
                  `}
                >
                  {seat}
                  {isTaken && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                      <X className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {selectedSeat && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-800 font-semibold">
            Selected: <span className="text-lg">Seat {selectedSeat}</span>
          </p>
        </div>
      )}
      <div className="mt-4 flex justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white border-2 border-blue-400 rounded"></div>
          <span className="text-gray-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-100 border-2 border-gray-400 rounded"></div>
          <span className="text-gray-600">Taken</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 border-2 border-blue-600 rounded"></div>
          <span className="text-gray-600">Selected</span>
        </div>
      </div>
    </div>
  );
}