import axios from 'axios';
import { API_URL } from './config';

const axiosClient = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30-second timeout for slow connections / server cold starts
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosClient.interceptors.request.use((config) => {
    // Prefer sessionStorage (non-persistent login); fall back to localStorage (Remember Me).
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// response interceptor to surface server errors in console for debugging and handle timeout
axiosClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.error('Request timed out. Please check your internet connection.');
        } else {
            console.error('API error:', err && (err.response && err.response.data) ? err.response.data : err.message);
        }
        return Promise.reject(err);
    }
);

export default axiosClient;