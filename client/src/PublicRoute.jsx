import React, { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const PublicRoute = ({ element: Element }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const auth = getAuth();
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth]);

    if (loading) {
        return <div>Loading...</div>;
    }

    return !isAuthenticated ? (
        Element
    ) : (
        <Navigate to="/main" />
    );
};

export default PublicRoute;
