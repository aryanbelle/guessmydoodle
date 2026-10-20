import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthProvider';

const PrivateRoute = ({ element }) => {
    const { currentUser } = useAuth();
    const location = useLocation();
    return currentUser ? element : <Navigate to="/signin" state={{ from: location }} replace />;
};

export default PrivateRoute;
