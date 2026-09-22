import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, allowedRoles }) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');

    let user = {};
    if (rawUser) {
        try {
            user = JSON.parse(rawUser);
        } catch {
            user = {};
        }
    }

    const normalizedRoles = Array.isArray(allowedRoles)
        ? allowedRoles
        : allowedRoles ? [allowedRoles] : [];

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Check token expiry quickly on client if possible
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                // expired
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                return <Navigate to="/login" replace />;
            }
        }
    } catch (e) {
        // ignore malformed token; server will enforce
    }

    if (normalizedRoles.length > 0 && !normalizedRoles.includes(user.role)) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;