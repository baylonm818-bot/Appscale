import axios from 'axios';
import { API_URL } from './config';

const axiosClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// response interceptor to surface server errors in console for debugging
axiosClient.interceptors.response.use(
    (res) => res,
    (err) => {
        console.error('API error:', err && (err.response && err.response.data) ? err.response.data : err.message);
        return Promise.reject(err);
    }
);

export default axiosClient;