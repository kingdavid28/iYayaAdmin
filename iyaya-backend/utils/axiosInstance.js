// src/utils/axiosInstance.js

import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'x-client-time': new Date().toISOString(), // ✅ Matches backend CORS config
    'App-Version': '1.0.0', // Optional: keep consistent with backend expectations
    platform: 'web' // Or 'android'/'ios' for mobile builds
  },
  withCredentials: true // 🔒 Ensures cookies and sessions work cross-origin
});

// Optional: request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Example: dynamically update client time before each request
    config.headers['x-client-time'] = new Date().toISOString();
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: response interceptor
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('🛑 Axios error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
