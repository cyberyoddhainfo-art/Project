import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
    user: null,
    session: null,
    loading: true,

    initialize: () => {
        const sessionStr = localStorage.getItem('sb-session');
        const userStr = localStorage.getItem('sb-user');
        
        if (sessionStr && userStr) {
            try {
                set({ session: JSON.parse(sessionStr), user: JSON.parse(userStr), loading: false });
            } catch(e) {
                set({ loading: false });
            }
        } else {
            set({ loading: false });
        }
    },

    login: async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            if (data.success) {
                const { session, user } = data.data;
                localStorage.setItem('sb-session', JSON.stringify(session));
                localStorage.setItem('sb-user', JSON.stringify(user));
                set({ session, user });
                return { success: true };
            }
            return { success: false, error: 'Login failed' };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || error.message };
        }
    },

    logout: () => {
        localStorage.removeItem('sb-session');
        localStorage.removeItem('sb-user');
        set({ user: null, session: null });
    }
}));

export default useAuthStore;
