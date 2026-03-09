import axios from 'axios';

// The Render backend has blueprints that ALREADY include '/api' 
// e.g. @suppliers_bp.route("/api/suppliers")
// Therefore the base URL should just be the domain!
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
