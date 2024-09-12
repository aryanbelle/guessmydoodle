import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const PrivateRoute = ({ element: Element }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const auth = getAuth();
    const location = useLocation(); // To preserve the redirect path

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
            setLoading(false);
        });

        return () => unsubscribe(); // Clean up subscription on unmount
    }, [auth]);

    if (loading) {
        return <div>Loading...</div>; // Show loading spinner or placeholder
    }

    // Redirect to `/main` if the user is authenticated and trying to access `/signin`
    if (isAuthenticated && location.pathname === '/signin') {
        return <Navigate to="/main" />;
    }

    return isAuthenticated ? (
        Element
    ) : (
        <Navigate to="/signin" state={{ from: location }} />
    );
};

export default PrivateRoute;
