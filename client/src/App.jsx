import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SignIn from './components/SignIn';
import Main from './components/Main';
import Room from './components/Room';
import { AuthProvider } from './lib/AuthProvider';
import PrivateRoute from './PrivateRoute'; // Import your PrivateRoute component
import PublicRoute from './PublicRoute'; // Import your PublicRoute component
import { Navigate } from 'react-router-dom'; // Import Navigate
import { SocketProvider } from './SocketProvider';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/main" replace />} />
          <Route path="/signin" element={<PublicRoute element={<SignIn />} />} /> {/* Public route for sign-in */}
          <Route path="/room/:roomId" element={<PrivateRoute element={<Room />} />} />
          <Route path="/main" element={<PrivateRoute element={<Main />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
