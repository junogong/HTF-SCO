import axios from 'axios';

// Fallback to localhost for local development if the env var isn't set
let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Because some users paste the root domain without /api, ensure it's there.
if (API_BASE_URL && !API_BASE_URL.endsWith('/api') && !API_BASE_URL.endsWith('/api/')) {
    API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api/';
} else if (API_BASE_URL && !API_BASE_URL.endsWith('/')) {
    API_BASE_URL += '/';
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Axios naturally strips the baseURL path (like `/api/`) if the specific request 
// string starts with a leading slash (like `/suppliers`). 
// This interceptor automatically strips leading slashes from every request BEFORE Axios processes it.
api.interceptors.request.use(config => {
    if (config.url && config.url.startsWith('/')) {
        config.url = config.url.substring(1);
    }
    return config;
});

export default api;
