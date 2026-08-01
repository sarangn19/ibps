import axios from 'axios';

// Uses VITE_API_URL when deployed (e.g. the hosted backend), falls back to the
// same-origin /api path (Vite dev proxy or a same-domain serverless API).
const baseURL = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
