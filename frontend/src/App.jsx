
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import UserDashboard from './pages/user/UserDashboard.jsx';
import ConductorDashboard from './pages/conductor/ConductorDashboard.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import RideDetail from './pages/user/RideDetail.jsx';
import { useAuth } from './store/authStore.js';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-4">Loading...</p>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/user" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/user" element={<Protected roles={['user', 'admin', 'conductor']}><UserDashboard /></Protected>} />
          <Route path="/ride/:id" element={<Protected roles={['user', 'admin', 'conductor']}><RideDetail /></Protected>} />
          <Route path="/conductor" element={<Protected roles={['conductor', 'admin']}><ConductorDashboard /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
