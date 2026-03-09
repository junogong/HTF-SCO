import axios from 'axios';

// Fallback to localhost for local development if the env var isn't set
let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Ensure the URL always ends with /api (in case the user only pasted the domain in Vercel)
if (API_BASE_URL && !API_BASE_URL.endsWith('/api')) {
    API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
