import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import TrafficDashboard from './TrafficDashboard.jsx';

export default function AdminDashboard(){
  const [conductors, setConductors] = useState([]);
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [busFile, setBusFile] = useState(null);
  const [busResult, setBusResult] = useState(null);
  const [buses, setBuses] = useState([]);
  const [newConductor, setNewConductor] = useState({ name: '', email: '', phone: '', password: '' });
  const [newBus, setNewBus] = useState({ number: '', name: '', seats: '', type: 'Intra-City', routeName: '' });
  const [creating, setCreating] = useState(false);
  const [downloadingBus, setDownloadingBus] = useState(null);
  const [activeTab, setActiveTab] = useState('conductors');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function load(){
    const d = await api.listConductors();
    setConductors(d.conductors);
    const b = await api.listBuses();
    setBuses(b.buses);
  }

  useEffect(() => { load(); }, []);

  async function upload(){
    if(!file) return;
    const res = await api.importConductors(file);
    setImportResult(res);
    await load();
  }

  async function uploadBuses(){
    if(!busFile) return;
    const res = await api.importBuses(busFile);
    setBusResult(res);
    await load();
  }

  async function createConductor(){
    setCreating(true);
    try { 
      await api.createConductor(newConductor); 
      setNewConductor({ name: '', email: '', phone: '', password: '' }); 
      await load(); 
    } finally { 
      setCreating(false); 
    }
  }

  async function createBus(){
    setCreating(true);
    try { 
      await api.createBus(newBus); 
      setNewBus({ number: '', name: '', seats: '', type: 'Intra-City', routeName: '' }); 
      await load(); 
    } finally { 
      setCreating(false); 
    }
  }

  async function downloadBusQrs(bus){
    setDownloadingBus(bus._id);
    try {
      const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api');
      const url = `${base}/admin/buses/qr/download?busId=${bus._id}`;
      const res = await fetch(url, { credentials: 'include' });
      if(!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bus-${bus.number}-qr.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { 
      setDownloadingBus(null); 
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
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
          <button
            onClick={() => setActiveTab('conductors')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'conductors' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-xl">👨‍✈️</span>
            {sidebarOpen && <span className="font-medium">Conductors</span>}
          </button>
          <button
            onClick={() => setActiveTab('buses')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'buses' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-xl">🚌</span>
            {sidebarOpen && <span className="font-medium">Buses</span>}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'import' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-xl">📁</span>
            {sidebarOpen && <span className="font-medium">Bulk Import</span>}
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              activeTab === 'traffic' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-xl">🛰️</span>
            {sidebarOpen && <span className="font-medium">Traffic Engine</span>}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage conductors, buses, and system operations</p>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {/* Conductors Tab */}
          {activeTab === 'conductors' && (
            <div className="space-y-8">
              {/* Create Conductor Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-2xl">👨‍✈️</span>
                  Create New Conductor
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter conductor name"
                      value={newConductor.name} 
                      onChange={e => setNewConductor(c => ({...c, name: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter email address"
                      value={newConductor.email} 
                      onChange={e => setNewConductor(c => ({...c, email: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter phone number"
                      value={newConductor.phone} 
                      onChange={e => setNewConductor(c => ({...c, phone: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      type="password"
                      placeholder="Set temporary password"
                      value={newConductor.password} 
                      onChange={e => setNewConductor(c => ({...c, password: e.target.value}))} 
                    />
                  </div>
                </div>
                <button 
                  disabled={creating} 
                  onClick={createConductor} 
                  className="bg-blue-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      Create Conductor
                    </>
                  )}
                </button>
              </div>

              {/* Conductors List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    All Conductors ({conductors.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {conductors.map(conductor => (
                    <div key={conductor._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-lg">
                            {conductor.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{conductor.name}</h3>
                          <p className="text-sm text-gray-600">{conductor.email}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <span>📞</span>
                          {conductor.phone || 'Not provided'}
                        </p>
                        <p className="flex items-center gap-2">
                          <span>🆔</span>
                          {conductor._id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {conductors.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👨‍✈️</div>
                    <p className="text-gray-500 text-lg">No conductors found</p>
                    <p className="text-gray-400">Create your first conductor to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buses Tab */}
          {activeTab === 'buses' && (
            <div className="space-y-8">
              {/* Create Bus Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-2xl">🚌</span>
                  Create New Bus
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bus Number</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., BUS-001"
                      value={newBus.number} 
                      onChange={e => setNewBus(b => ({...b, number: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bus Name</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., City Express"
                      value={newBus.name} 
                      onChange={e => setNewBus(b => ({...b, name: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seat Capacity</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., 40"
                      value={newBus.seats} 
                      onChange={e => setNewBus(b => ({...b, seats: e.target.value}))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type</label>
                    <select 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={newBus.type} 
                      onChange={e => setNewBus(b => ({...b, type: e.target.value}))}
                    >
                      <option value="Intra-City">Intra-City</option>
                      <option value="Inter-City">Inter-City</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Route Name</label>
                    <input 
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., Downtown Express Route"
                      value={newBus.routeName} 
                      onChange={e => setNewBus(b => ({...b, routeName: e.target.value}))} 
                    />
                  </div>
                </div>
                <button 
                  disabled={creating} 
                  onClick={createBus} 
                  className="bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-all duration-200 font-medium flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <span>🚌</span>
                      Create Bus
                    </>
                  )}
                </button>
              </div>

              {/* Buses List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                    <span className="text-2xl">🚍</span>
                    All Buses ({buses.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {buses.map(bus => (
                    <div key={bus._id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{bus.number}</h3>
                          <p className="text-gray-600">{bus.name}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          bus.activeRide ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {bus.activeRide ? 'On Trip' : 'Available'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Seats</span>
                          <span className="font-medium">{bus.seats}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Type</span>
                          <span className="font-medium">{bus.type}</span>
                        </div>
                        {bus.routeName && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Route</span>
                            <span className="font-medium text-blue-600">{bus.routeName}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => downloadBusQrs(bus)} 
                          disabled={downloadingBus === bus._id}
                          className="flex-1 bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                        >
                          {downloadingBus === bus._id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Preparing...
                            </>
                          ) : (
                            <>
                              <span>📷</span>
                              Download QR
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {buses.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🚌</div>
                    <p className="text-gray-500 text-lg">No buses found</p>
                    <p className="text-gray-400">Create your first bus to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-8">
              {/* Import Conductors */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-2xl">👨‍✈️</span>
                  Bulk Import Conductors
                </h2>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-gray-600 mb-2">Upload CSV file with conductor details</p>
                    <p className="text-gray-400 text-sm mb-4">Supported format: Name, Email, Phone, Password</p>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={e => setFile(e.target.files[0])}
                      className="hidden" 
                      id="conductor-csv"
                    />
                    <label 
                      htmlFor="conductor-csv"
                      className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 cursor-pointer font-medium"
                    >
                      Choose CSV File
                    </label>
                    {file && (
                      <p className="mt-3 text-green-600 font-medium">Selected: {file.name}</p>
                    )}
                  </div>
                  <button 
                    onClick={upload} 
                    disabled={!file}
                    className="w-full bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl hover:bg-green-700 transition-all duration-200 font-medium"
                  >
                    Upload and Import Conductors
                  </button>
                  
                  {importResult && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                      <h4 className="font-semibold text-blue-900 mb-2">Import Results</h4>
                      <p className="text-blue-800">Successfully imported: {importResult.imported} conductors</p>
                      {importResult.credentials && importResult.credentials.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer font-medium text-blue-800">View Generated Credentials</summary>
                          <div className="mt-3 space-y-2">
                            {importResult.credentials.map((cred, index) => (
                              <div key={index} className="bg-white rounded-lg p-3 border border-blue-100">
                                <p className="font-medium">{cred.email}</p>
                                <p className="text-sm text-gray-600">Password: {cred.password}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Import Buses */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="text-2xl">🚌</span>
                  Bulk Import Buses
                </h2>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-gray-600 mb-2">Upload CSV file with bus details</p>
                    <p className="text-gray-400 text-sm mb-4">Supported format: Number, Name, Seats, Type, RouteName</p>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={e => setBusFile(e.target.files[0])}
                      className="hidden" 
                      id="bus-csv"
                    />
                    <label 
                      htmlFor="bus-csv"
                      className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 cursor-pointer font-medium"
                    >
                      Choose CSV File
                    </label>
                    {busFile && (
                      <p className="mt-3 text-green-600 font-medium">Selected: {busFile.name}</p>
                    )}
                  </div>
                  <button 
                    onClick={uploadBuses} 
                    disabled={!busFile}
                    className="w-full bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl hover:bg-green-700 transition-all duration-200 font-medium"
                  >
                    Upload and Import Buses
                  </button>
                  
                  {busResult && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                      <h4 className="font-semibold text-blue-900 mb-2">Import Results</h4>
                      <p className="text-blue-800">Successfully imported: {busResult.imported} buses</p>
                      {busResult.skipped && busResult.skipped.length > 0 && (
                        <div className="mt-3">
                          <p className="text-orange-800 font-medium">Skipped entries: {busResult.skipped.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'traffic' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <iframe title="Traffic Dashboard" src="/admin-traffic" className="w-full h-[1200px] hidden" />
              </div>
              {/* Inline import of TrafficDashboard to avoid routing changes */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-0 overflow-hidden">
                <TrafficDashboardWrapper />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrafficDashboardWrapper(){
  return <div className="p-0"><TrafficDashboard /></div>;
}