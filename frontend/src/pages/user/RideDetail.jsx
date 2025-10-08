import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { io } from 'socket.io-client';
import LiveRideMap from '../../components/Map/LiveRideMap.jsx';
import QrCameraScanner from '../../components/QR/QrCameraScanner.jsx';

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
    socket = io(import.meta.env.VITE_API_WS || 'http://localhost:4000', { transports: ['websocket'] });
    socket.emit('joinRide', id);
    socket.on('ride:update', msg => { if (msg.rideId === id) load(false); });
    socket.on('ride:userLocations', payload => { if (payload.rideId === id) setOtherUsers(payload.users); });
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
        } catch (err) { /* ignore until QR verified maybe */ }
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/rides/${id}/book`, {
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
    if (!a || !b) return null; const R = 6371; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLng = (b.lng - a.lng) * Math.PI / 180; const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180; const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h));
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

  if (!ride) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Loading ride details...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-white">TransitPro</h1>
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
          <SidebarItem icon="🚌" text="Ride Details" active={true} open={sidebarOpen} />
          <SidebarItem icon="📊" text="Live Tracking" open={sidebarOpen} />
          <SidebarItem icon="👥" text="Passengers" open={sidebarOpen} />
          <SidebarItem icon="⚙️" text="Settings" open={sidebarOpen} />
        </nav>

        {/* Ride Info in Sidebar */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-700 mt-4">
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Route</p>
                <p className="font-medium text-white truncate">{ride.origin} → {ride.destination}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Current ETA</p>
                <p className="font-medium text-white">{ride.etaMinutes ? `${ride.etaMinutes} min` : '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Passengers</p>
                <p className="font-medium text-white">{ride.capacityCounter}{ride.seatsTotal ? ` / ${ride.seatsTotal}` : ''}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {ride.origin} → {ride.destination}
                </h1>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Live Tracking Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{ride.type === 'inter' ? 'Inter-City' : 'Intra-City'} Service</span>
                  </div>
                </div>
              </div>
              
              {geoAllowed !== false && etaToUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4">
                  <p className="text-blue-900 font-semibold text-lg">
                    Arrival to you: {etaToUser} min
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left Column - Map & Passengers */}
            <div className="xl:col-span-2 space-y-8">
              {/* Map Section */}
              {(ride.busLocation?.lat || (ride.originCoords?.lat && ride.destinationCoords?.lat)) && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Live Route Map</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Your Location</span>
                      <div className="w-3 h-3 bg-red-500 rounded-full ml-2"></div>
                      <span>Other Passengers</span>
                    </div>
                  </div>
                  <div className="h-96 rounded-xl overflow-hidden border border-gray-200">
                    <LiveRideMap
                      origin={ride.originCoords}
                      destination={ride.destinationCoords}
                      bus={ride.busLocation}
                      etaMinutes={ride.etaMinutes}
                      users={[...(userLoc ? [{ userId: 'me', name: 'You', lat: userLoc.lat, lng: userLoc.lng }] : []), ...otherUsers.filter(u => u.userId !== 'me')]}
                    />
                  </div>
                </div>
              )}

              {/* Passengers List */}
              {ride.type === 'inter' && ride.passengers.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Passenger List</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ride.passengers.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">{p.name ? p.name.charAt(0).toUpperCase() : 'G'}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{p.name || 'Guest'}</p>
                            <p className="text-sm text-gray-500">Seat {p.seatNumber || '—'}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          p.paid ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}>
                          {p.paid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Booking & Actions */}
            <div className="space-y-8">
              {ride.type === 'inter' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Book Your Journey</h2>

                  {/* QR Verification */}
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <span className="text-lg">📷</span>
                        Verify Bus QR Code
                      </h3>
                      
                      <div className="space-y-4">
                        {/* File Upload */}
                        <div className="space-y-2">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleQrUpload}
                            className="hidden" 
                            id="qr-upload"
                          />
                          <label 
                            htmlFor="qr-upload"
                            className="block w-full bg-white border-2 border-dashed border-blue-300 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                          >
                            <div className="text-blue-600 text-2xl mb-2">📁</div>
                            <span className="text-blue-700 font-medium block mb-1">Upload QR Image</span>
                            <span className="text-blue-600 text-sm">Click or drag & drop</span>
                          </label>
                        </div>

                        {/* Text Input */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Or enter QR code manually</label>
                          <div className="flex gap-2">
                            <input 
                              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Paste QR code text here..."
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
                                  setMethod('online'); 
                                } catch (err) { 
                                  alert(err.message); 
                                  setQrValidated(false); 
                                  setVerificationToken(null);
                                } finally {
                                  setLoading(false);
                                }
                              }} 
                              disabled={loading}
                              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium whitespace-nowrap"
                            >
                              {loading ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                        </div>

                        {/* Camera Button */}
                        <button 
                          onClick={startCameraScan}
                          className="w-full bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition-all duration-200 font-medium flex items-center justify-center gap-3"
                        >
                          <span className="text-xl">📱</span>
                          Open Camera Scanner
                        </button>
                      </div>

                      {/* Verification Status */}
                      {qrValidated ? (
                        <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-xl flex items-center gap-3">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                          <span className="text-green-800 font-medium">QR Verified - Payment Enabled</span>
                        </div>
                      ) : (
                        <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-xl text-center">
                          <span className="text-gray-600">Verify QR code to enable payment and seat selection</span>
                        </div>
                      )}
                    </div>

                    {/* Camera Scanner Modal */}
                    {showScanner && (
                      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Scan QR Code</h3>
                            <button 
                              onClick={() => setShowScanner(false)}
                              className="text-gray-500 hover:text-gray-700 transition-colors duration-200 text-xl"
                            >
                              ✕
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

                    {/* Payment & Seat Selection */}
                    {qrValidated && (
                      <div className="space-y-6 animate-fadeIn">
                        {/* Payment Method */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Payment Method
                          </label>
                          <select 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                            value={method} 
                            onChange={e => setMethod(e.target.value)}
                          >
                            <option value="online">💳 Credit/Debit Card</option>
                            <option value="online">📱 Mobile Wallet</option>
                            <option value="cash">💵 Cash Payment</option>
                          </select>
                        </div>

                        {/* Seat Selection */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Select Your Seat
                            </label>
                            <span className="text-sm text-gray-500">{seats.length - seatAssignments.length} seats available</span>
                          </div>
                          <SeatGrid 
                            seats={seats} 
                            assignments={seatAssignments} 
                            selectedSeat={selectedSeat} 
                            onSelect={setSelectedSeat} 
                          />
                        </div>

                        {/* Book Button */}
                        <button 
                          onClick={book}
                          disabled={!selectedSeat || loading}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                        >
                          {loading ? (
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Processing Booking...
                            </div>
                          ) : (
                            `Book Seat ${selectedSeat} - Confirm Payment`
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {ride.type === 'intra' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="text-5xl mb-4">🚌</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Intra-City Service</h3>
                  <p className="text-gray-600 mb-6">No booking required. Pay as you go with cash or card.</p>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-green-800 font-medium">Just hop on and enjoy the ride!</p>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Ride Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">⏱️</div>
                    <p className="text-sm text-gray-600">Total ETA</p>
                    <p className="font-semibold text-gray-900">{ride.etaMinutes || '—'} min</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">👥</div>
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p className="font-semibold text-gray-900">{ride.capacityCounter}{ride.seatsTotal ? `/${ride.seatsTotal}` : ''}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sidebar Item Component
function SidebarItem({ icon, text, active = false, open }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
      active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`}>
      <span className="text-xl">{icon}</span>
      {open && <span className="font-medium">{text}</span>}
    </div>
  );
}

// Seat Grid Component
function SeatGrid({ seats, assignments, selectedSeat, onSelect }) {
  if (!seats || seats.length === 0) return (
    <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
      <div className="text-4xl mb-3">💺</div>
      <p className="text-gray-600 font-medium">No seat layout available</p>
      <p className="text-gray-500 text-sm mt-1">Please check back later</p>
    </div>
  );

  const taken = new Set(assignments.map(a => a.seatNumber));
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) rows.push(seats.slice(i, i + 4));

  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
      <div className="flex flex-col gap-4">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-4 items-center justify-center">
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
                    w-14 h-14 rounded-xl border-2 flex items-center justify-center relative 
                    transition-all duration-200 transform hover:scale-110 font-semibold
                    ${isTaken
                      ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                      : 'bg-white border-blue-300 text-blue-700 hover:border-blue-500 hover:bg-blue-50'
                    }
                    ${isSel
                      ? 'ring-4 ring-blue-400 border-blue-600 bg-blue-100 scale-110 shadow-lg'
                      : ''
                    }
                  `}
                >
                  <span className="text-sm">{seat}</span>
                  {isTaken && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedSeat && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <p className="text-blue-800 font-semibold text-lg">
            Selected: <span className="text-xl">Seat {selectedSeat}</span>
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border-2 border-blue-400 rounded"></div>
          <span className="text-gray-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 border-2 border-gray-400 rounded"></div>
          <span className="text-gray-600">Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border-2 border-blue-600 rounded"></div>
          <span className="text-gray-600">Selected</span>
        </div>
      </div>
    </div>
  );
}