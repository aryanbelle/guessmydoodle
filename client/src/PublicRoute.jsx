import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthProvider';

const PublicRoute = ({ element }) => {
    const { currentUser } = useAuth();
    return currentUser ? <Navigate to="/main" replace /> : element;
};

export default PublicRoute;
