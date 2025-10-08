import { useState } from 'react';
import { useAuth } from '../../store/authStore';
import { Link } from 'react-router-dom';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  function update(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(form);
    } catch (e) {
      setError(e.message || 'Please fill in all fields');
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Geometric Shapes */}
        <div className="absolute w-72 h-72 bg-sky-500/10 rounded-full blur-3xl animate-float-slow" style={{ top: '5%', left: '5%' }}></div>
        <div className="absolute w-96 h-96 bg-sky-600/10 rounded-full blur-3xl animate-float-medium" style={{ top: '15%', right: '10%' }}></div>
        <div className="absolute w-80 h-80 bg-sky-700/10 rounded-full blur-3xl animate-float-fast" style={{ bottom: '5%', left: '45%' }}></div>
        <div className="absolute w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl animate-float-slow" style={{ top: '40%', right: '35%' }}></div>
        <div className="absolute w-56 h-56 bg-sky-400/10 rounded-full blur-3xl animate-float-medium" style={{ bottom: '25%', left: '15%' }}></div>
        
        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(14, 165, 233, 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(14, 165, 233, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
            animation: 'grid-move 20s linear infinite'
          }}></div>
        </div>

        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-sky-400/30 rounded-full animate-float-particles"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 20}s`,
                animationDuration: `${15 + Math.random() * 20}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl mx-4">
        <div className="bg-gradient-to-br from-slate-900/95 via-blue-950/90 to-indigo-950/95 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border-2 md:border-4 border-sky-600/50 shadow-2xl overflow-hidden">
          <div className="grid lg:grid-cols-2 min-h-[80vh] md:min-h-[600px]">
            
            {/* Left Panel - Bus Animation */}
            <div className="relative bg-gradient-to-br from-slate-900/80 via-blue-950/70 to-indigo-950/80 p-6 md:p-8 lg:p-12 flex flex-col items-center justify-center overflow-hidden order-2 lg:order-1">
              {/* Decorative Elements */}
              <div className="absolute inset-0">
                <div className="absolute w-40 h-40 bg-sky-500/20 rounded-full blur-2xl animate-pulse-slow" style={{ top: '15%', left: '15%' }}></div>
                <div className="absolute w-48 h-48 bg-sky-600/20 rounded-full blur-2xl animate-pulse-medium" style={{ bottom: '15%', right: '15%', animationDelay: '2s' }}></div>
                <div className="absolute w-32 h-32 bg-sky-700/20 rounded-full blur-2xl animate-pulse-fast" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animationDelay: '1s' }}></div>
              </div>

              {/* Bus Illustration */}
              <div className="relative w-full max-w-md mb-8">
                <div className="bus-container animate-bus-drive">
                  <svg viewBox="0 0 400 300" className="w-full h-auto drop-shadow-2xl">
                    {/* Road Shadow */}
                    <ellipse cx="200" cy="280" rx="140" ry="12" fill="rgba(0,0,0,0.4)" className="animate-pulse"/>
                    
                    {/* Main Bus Body with Gradient */}
                    <defs>
                      <linearGradient id="busGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0EA5E9" />
                        <stop offset="50%" stopColor="#0284C7" />
                        <stop offset="100%" stopColor="#0369A1" />
                      </linearGradient>
                    </defs>
                    <rect x="80" y="120" width="240" height="120" rx="20" fill="url(#busGradient)" stroke="#0C4A6E" strokeWidth="3"/>
                    
                    {/* Windows with Reflection */}
                    <g className="animate-window-glow">
                      <rect x="100" y="140" width="50" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>
                      <rect x="160" y="140" width="50" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>
                      <rect x="220" y="140" width="50" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>
                      <rect x="280" y="140" width="30" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>
                      <rect x="105" y="145" width="15" height="10" rx="2" fill="white" opacity="0.3"/>
                      <rect x="165" y="145" width="15" height="10" rx="2" fill="white" opacity="0.3"/>
                      <rect x="225" y="145" width="15" height="10" rx="2" fill="white" opacity="0.3"/>
                    </g>
                    
                    {/* Door */}
                    <rect x="95" y="190" width="40" height="50" rx="6" fill="#0C4A6E"/>
                    <line x1="115" y1="195" x2="115" y2="235" stroke="#0EA5E9" strokeWidth="2"/>
                    <circle cx="105" cy="215" r="3" fill="#0EA5E9"/>
                    
                    {/* Front Detail */}
                    <path d="M 80 180 L 60 200 L 60 220 L 80 240" fill="#0C4A6E" stroke="#0369A1" strokeWidth="2"/>
                    
                    {/* Headlights */}
                    <g className="animate-headlight-glow">
                      <circle cx="70" cy="210" r="10" fill="#FCD34D" opacity="0.8"/>
                      <circle cx="70" cy="230" r="8" fill="#EF4444" opacity="0.8"/>
                    </g>
                    
                    {/* Wheels with Hubcaps */}
                    <g>
                      <circle cx="130" cy="250" r="28" fill="#1F2937" stroke="#374151" strokeWidth="3"/>
                      <circle cx="130" cy="250" r="18" fill="#4B5563"/>
                      <circle cx="130" cy="250" r="10" fill="#6B7280"/>
                      <circle cx="130" cy="250" r="4" fill="#9CA3AF"/>
                      <circle cx="270" cy="250" r="28" fill="#1F2937" stroke="#374151" strokeWidth="3"/>
                      <circle cx="270" cy="250" r="18" fill="#4B5563"/>
                      <circle cx="270" cy="250" r="10" fill="#6B7280"/>
                      <circle cx="270" cy="250" r="4" fill="#9CA3AF"/>
                    </g>
                    
                    {/* Roof with Rails */}
                    <rect x="140" y="100" width="120" height="20" rx="10" fill="#0C4A6E" stroke="#0369A1" strokeWidth="2"/>
                    <rect x="150" y="95" width="100" height="5" rx="2" fill="#374151"/>
                    
                    {/* Side Mirror */}
                    <rect x="50" y="155" width="10" height="4" fill="#0C4A6E"/>
                    <rect x="42" y="150" width="8" height="12" rx="2" fill="#0EA5E9"/>
                    
                    {/* Animated Road Lines */}
                    <g className="animate-road-move">
                      <line x1="0" y1="285" x2="100" y2="285" stroke="#38BDF8" strokeWidth="4" strokeDasharray="20,15"/>
                      <line x1="150" y1="285" x2="250" y2="285" stroke="#38BDF8" strokeWidth="4" strokeDasharray="20,15"/>
                      <line x1="300" y1="285" x2="400" y2="285" stroke="#38BDF8" strokeWidth="4" strokeDasharray="20,15"/>
                    </g>
                  </svg>
                </div>
              </div>
              
              {/* Slogan Section */}
              <div className="text-center relative z-10 px-4">
                <div className="mb-6">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                    <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                      Smart Buses
                    </span>
                    <br />
                    <span className="text-white">Smooth Roads</span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 to-sky-300 bg-clip-text text-transparent">
                      Happier Cities
                    </span>
                  </h2>
                </div>
                
                <div className="space-y-3 text-sky-100/80">
                  <p className="text-lg md:text-xl font-light">
                    Transforming Urban Mobility
                  </p>
                  <div className="w-24 h-1 bg-gradient-to-r from-sky-500 to-cyan-400 mx-auto rounded-full"></div>
                  <p className="text-sm md:text-base max-w-md mx-auto leading-relaxed">
                    Join the future of public transportation with our intelligent bus management system
                  </p>
                </div>
                
                {/* Feature Points */}
                <div className="grid grid-cols-3 gap-4 mt-8 max-w-md mx-auto">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">⚡</span>
                    </div>
                    <p className="text-xs text-sky-200/80">Real-time Tracking</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">🎯</span>
                    </div>
                    <p className="text-xs text-sky-200/80">Smart Routes</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">🌍</span>
                    </div>
                    <p className="text-xs text-sky-200/80">Eco Friendly</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Register Form */}
            <div className="bg-gradient-to-br from-slate-900/80 via-blue-950/60 to-indigo-950/70 backdrop-blur-lg p-6 md:p-8 lg:p-12 flex flex-col justify-center order-1 lg:order-2">
              <div className="max-w-md mx-auto w-full">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🚌</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">Create Your Account</h1>
                  <p className="text-sky-200/70 text-sm md:text-base">
                    Join our smart bus system as a passenger
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm backdrop-blur-sm">
                    <div className="flex items-center">
                      <span className="mr-3 text-lg">⚠️</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={submit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-sky-200 mb-3">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      className="w-full px-4 py-4 bg-slate-800/70 border border-sky-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all backdrop-blur-sm text-base"
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={update}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-sky-200 mb-3">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="w-full px-4 py-4 bg-slate-800/70 border border-sky-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all backdrop-blur-sm text-base"
                      placeholder="Enter your email address"
                      value={form.email}
                      onChange={update}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-sky-200 mb-3">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      className="w-full px-4 py-4 bg-slate-800/70 border border-sky-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all backdrop-blur-sm text-base"
                      placeholder="Enter your phone number"
                      value={form.phone}
                      onChange={update}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-sky-200 mb-3">Password</label>
                    <input
                      type="password"
                      name="password"
                      className="w-full px-4 py-4 bg-slate-800/70 border border-sky-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all backdrop-blur-sm text-base"
                      placeholder="Create a password"
                      value={form.password}
                      onChange={update}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white py-4 px-6 rounded-xl font-bold transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 flex items-center justify-center gap-3 text-base"
                  >
                    <span className="text-lg">🚀</span>
                    Create Account
                  </button>
                </form>

                <div className="mt-8 text-center space-y-4">
                  <p className="text-slate-300 text-sm">
                    Already have an account?{' '}
                    <Link to="/login" className="text-sky-400 hover:text-sky-300 font-semibold underline transition-colors">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(30px, -30px) scale(1.1) rotate(120deg); }
          66% { transform: translate(-20px, 20px) scale(0.9) rotate(240deg); }
        }
        
        @keyframes float-medium {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(-40px, 40px) scale(1.15) rotate(120deg); }
          66% { transform: translate(40px, -20px) scale(0.95) rotate(240deg); }
        }
        
        @keyframes float-fast {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -50px) scale(1.2); }
        }
        
        @keyframes float-particles {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.3; }
          25% { transform: translateY(-40px) translateX(20px) scale(1.2); opacity: 0.6; }
          50% { transform: translateY(-20px) translateX(-30px) scale(0.8); opacity: 0.4; }
          75% { transform: translateY(30px) translateX(40px) scale(1.1); opacity: 0.7; }
        }
        
        @keyframes bus-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-0.5deg); }
          50% { transform: translateY(-12px) rotate(0.5deg); }
          75% { transform: translateY(-6px) rotate(-0.3deg); }
        }
        
        @keyframes bus-drive {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(15px); }
        }
        
        @keyframes road-move {
          0% { transform: translateX(0); }
          100% { transform: translateX(-30px); }
        }
        
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        
        @keyframes pulse-medium {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        
        @keyframes pulse-fast {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.02); }
        }
        
        @keyframes window-glow {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
        
        @keyframes headlight-glow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        
        .animate-float-slow {
          animation: float-slow 25s ease-in-out infinite;
        }
        
        .animate-float-medium {
          animation: float-medium 20s ease-in-out infinite;
        }
        
        .animate-float-fast {
          animation: float-fast 15s ease-in-out infinite;
        }
        
        .animate-float-particles {
          animation: float-particles 25s ease-in-out infinite;
        }
        
        .animate-bus-bounce {
          animation: bus-bounce 3s ease-in-out infinite;
        }
        
        .animate-bus-drive {
          animation: bus-drive 4s ease-in-out infinite;
        }
        
        .animate-road-move {
          animation: road-move 1s linear infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-pulse-medium {
          animation: pulse-medium 3s ease-in-out infinite;
        }
        
        .animate-pulse-fast {
          animation: pulse-fast 2s ease-in-out infinite;
        }
        
        .animate-window-glow {
          animation: window-glow 2s ease-in-out infinite;
        }
        
        .animate-headlight-glow {
          animation: headlight-glow 1.5s ease-in-out infinite;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .min-h-\[80vh\] {
            min-height: 80vh;
          }
        }

        @media (max-width: 640px) {
          .mx-4 {
            margin-left: 1rem;
            margin-right: 1rem;
          }
        }
      `}</style>
    </div>
  );
}