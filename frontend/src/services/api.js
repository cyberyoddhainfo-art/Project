import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
});

// Add a request interceptor to inject the Supabase JWT
api.interceptors.request.use(
    (config) => {
        const sessionStr = localStorage.getItem('sb-session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if (session && session.access_token) {
                    config.headers.Authorization = `Bearer ${session.access_token}`;
                }
            } catch(e) {
                console.error("Failed to parse session", e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
