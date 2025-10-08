import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Navigation, 
  Search, 
  RefreshCw, 
  Clock,
  Users,
  Bus,
  Car,
  Filter,
  Wifi,
  Battery,
  Shield,
  Star,
  ChevronRight,
  Locate,
  LocateOff
} from 'lucide-react';

export default function UserDashboard() {
  const [tab, setTab] = useState('intra');
  const [rides, setRides] = useState([]);
  const [userLoc, setUserLoc] = useState(null);
  const [geoAllowed, setGeoAllowed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef(null);
  const [query, setQuery] = useState({ origin: '', destination: '' });

  // Enhanced color scheme
  const COLORS = {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1'
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      500: '#64748b',
      600: '#475569',
      700: '#334155'
    },
    accent: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#8b5cf6'
    }
  };

  // Floating background elements
  const FloatingElements = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
      />
      <motion.div
        animate={{
          x: [0, -80, 0],
          y: [0, 60, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute top-3/4 right-1/4 w-80 h-80 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
      />
    </div>
  );

  useEffect(() => { 
    load(); 
  }, [tab]);

  useEffect(() => {
    if (pollRef.current) { 
      clearInterval(pollRef.current); 
      pollRef.current = null; 
    }
    pollRef.current = setInterval(() => { load(false); }, 15000);
    return () => { 
      if (pollRef.current) clearInterval(pollRef.current); 
    };
  }, [tab, userLoc]);

  async function load(showLoading = true) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const params = { type: tab };
      if (query.origin) params.origin = query.origin;
      if (query.destination) params.destination = query.destination;
      const d = await api.listRides(params);
      setRides(d.rides);
    } catch (error) {
      console.error('Failed to load rides:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) { 
      setGeoAllowed(false); 
      return; 
    }
    
    setIsRefreshing(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoAllowed(true);
        setUserLoc({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude 
        });
        setIsRefreshing(false);
      }, 
      err => {
        console.warn('Geolocation denied', err);
        setGeoAllowed(false);
        setIsRefreshing(false);
      }, 
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 5000 
      }
    );
  }

  useEffect(() => { 
    requestLocation(); 
  }, []);

  function haversineKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function etaToUserMinutes(ride) {
    if (!userLoc || !ride.busLocation?.lat) return null;
    const bus = { 
      lat: Number(ride.busLocation.lat), 
      lng: Number(ride.busLocation.lng) 
    };
    if (Number.isNaN(bus.lat) || Number.isNaN(bus.lng)) return null;
    const distKm = haversineKm(bus, userLoc);
    if (distKm == null) return null;
    const speed = ride.type === 'inter' ? 55 : 30;
    return Math.max(1, Math.round(distKm / speed * 60));
  }

  const RideCard = ({ ride, index }) => {
    const etaUser = etaToUserMinutes(ride);
    const isInterCity = ride.type === 'inter';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-white/40 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Ride Information */}
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                isInterCity 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}>
                {isInterCity ? (
                  <Bus className="w-6 h-6 text-white" />
                ) : (
                  <Car className="w-6 h-6 text-white" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-slate-800">
                    {ride.origin} → {ride.destination}
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isInterCity 
                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {isInterCity ? '🚌 Inter-City' : '🏙️ Intra-City'}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Conductor: {ride.conductor?.name || 'Available'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span>Verified Ride</span>
                  </div>
                  
                  {ride.capacityCounter && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>{ride.capacityCounter} passengers</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ETA Information */}
            <div className="flex flex-wrap items-center gap-4">
              {etaUser && (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-2xl border border-green-200"
                >
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">
                    ETA to you: {etaUser} min
                  </span>
                </motion.div>
              )}
              
              {(!etaUser && ride.busLocation?.lat && geoAllowed === true) && (
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-200">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">
                    Calculating ETA...
                  </span>
                </div>
              )}
              
              {ride.etaMinutes && (
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
                  <Navigation className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    Route ETA: {ride.etaMinutes} min
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link 
              to={`/ride/${ride._id}`}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
            >
              View Details
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative">
      <FloatingElements />
      
      {/* Main Container */}
      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="pt-8 pb-6 px-4 max-w-7xl mx-auto"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center"
              >
                <Bus className="w-7 h-7 text-blue-600" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">RideShare Dashboard</h1>
                <p className="text-slate-600 mt-1">Find and book your perfect ride</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="hidden sm:flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/40"
              >
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-slate-700">Live Tracking</span>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/40"
              >
                <Battery className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-slate-700">
                  {rides.length} Rides
                </span>
              </motion.div>
            </div>
          </div>

          {/* Search and Filter Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-white/40 mb-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Origin
                </label>
                <input
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 focus:border-blue-500 focus:ring-3 focus:ring-blue-200 transition-all duration-300 bg-white/50"
                  placeholder="Enter starting point..."
                  value={query.origin}
                  onChange={e => setQuery(q => ({ ...q, origin: e.target.value }))}
                />
              </div>
              
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <Navigation className="w-4 h-4 inline mr-2" />
                  Destination
                </label>
                <input
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 focus:border-blue-500 focus:ring-3 focus:ring-blue-200 transition-all duration-300 bg-white/50"
                  placeholder="Enter destination..."
                  value={query.destination}
                  onChange={e => setQuery(q => ({ ...q, destination: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Ride Type Tabs */}
              <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
                {[
                  { id: 'intra', label: 'Intra-City', icon: Car },
                  { id: 'inter', label: 'Inter-City', icon: Bus }
                ].map((type) => (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTab(type.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                      tab === type.id
                        ? 'bg-white text-slate-800 shadow-md'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </motion.button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={load}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Search className="w-4 h-4" />
                  Search Rides
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Location Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-lg border border-white/40"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  geoAllowed === true ? 'bg-green-500 shadow-lg shadow-green-500/50' :
                  geoAllowed === false ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                }`} />
                
                <div>
                  <p className={`text-sm font-semibold ${
                    geoAllowed === true ? 'text-green-700' :
                    geoAllowed === false ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {geoAllowed === true ? '📍 Live Location Active' :
                     geoAllowed === false ? '❌ Location Access Denied' : '⏳ Requesting Location...'}
                  </p>
                  
                  {userLoc && (
                    <p className="text-xs text-slate-600 font-mono">
                      {userLoc.lat.toFixed(6)}, {userLoc.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={requestLocation}
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-2xl font-medium hover:bg-slate-200 transition-all duration-300 disabled:opacity-50"
              >
                {isRefreshing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : geoAllowed ? (
                  <Locate className="w-4 h-4" />
                ) : (
                  <LocateOff className="w-4 h-4" />
                )}
                {isRefreshing ? 'Updating...' : geoAllowed ? 'Refresh Location' : 'Enable Location'}
              </motion.button>
            </div>
          </motion.div>
        </motion.header>

        {/* Rides List */}
        <main className="px-4 pb-8 max-w-7xl mx-auto">
          {/* Loading State */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ 
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1.5, repeat: Infinity }
                  }}
                  className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-4 shadow-lg"
                >
                  <Bus className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Loading Rides</h3>
                <p className="text-slate-600">Finding the best rides for you...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rides Grid */}
          <AnimatePresence>
            {!isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                {rides.length > 0 ? (
                  rides.map((ride, index) => (
                    <RideCard key={ride._id} ride={ride} index={index} />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 text-center shadow-lg border border-white/40"
                  >
                    <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-3">No Rides Found</h3>
                    <p className="text-slate-600 max-w-md mx-auto mb-6">
                      {query.origin || query.destination 
                        ? 'Try adjusting your search criteria or explore different ride types.'
                        : 'No rides available for the selected type. Try switching between Intra-City and Inter-City.'
                      }
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setQuery({ origin: '', destination: '' });
                        load();
                      }}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Show All Rides
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="px-4 pb-8 max-w-7xl mx-auto"
        >
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-white/40">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live Tracking
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Real-time ETAs
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  Secure Booking
                </span>
              </div>
              
              <div className="text-center md:text-right">
                <p className="text-sm text-slate-600 font-medium">
                  RideShare • Professional Ride Management
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date().getFullYear()} • All rides verified and secure
                </p>
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}