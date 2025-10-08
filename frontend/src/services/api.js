const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if(token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'include' });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),
  listRides: (params={}) => request(`/rides?${new URLSearchParams(params)}`),
  getRide: (id) => request(`/rides/${id}`),
  getRideSeats: (id) => request(`/rides/${id}/seats`),
  bookRide: (id, method) => request(`/rides/${id}/book`, { method: 'POST', body: { method } }),
  verifyRideQr: (id, qr) => request(`/rides/${id}/verify-qr`, { method: 'POST', body: { qr } }),
  createRide: (payload) => request('/conductor/rides', { method: 'POST', body: payload }),
  addPassenger: (rideId, payload) => request(`/conductor/rides/${rideId}/passengers`, { method: 'POST', body: payload }),
  updateLocation: (rideId, payload) => request(`/conductor/rides/${rideId}/location`, { method: 'PATCH', body: payload }),
  updateCounter: (rideId, value) => request(`/conductor/rides/${rideId}/counter`, { method: 'PATCH', body: { value } }),
  importConductors: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/admin/conductors/import`, { method: 'POST', body: form, credentials: 'include' }).then(r=>r.json());
  },
  listConductors: () => request('/admin/conductors')
  ,importBuses: (file) => { const form = new FormData(); form.append('file', file); return fetch(`${API_BASE}/admin/buses/import`, { method:'POST', body: form, credentials:'include' }).then(r=>r.json()); }
  ,listBuses: () => request('/admin/buses')
  ,availableBuses: (rideType) => request(`/conductor/buses/available?${rideType?`rideType=${rideType}`:''}`)
  ,createConductor: (payload) => request('/admin/conductors', { method: 'POST', body: payload })
  ,createBus: (payload) => request('/admin/buses', { method: 'POST', body: payload })
};
