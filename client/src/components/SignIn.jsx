import React, {useState} from 'react';
import { ReactComponent as GoogleIcon } from '../assets/icons/googleicon.svg';
import { auth, provider, signInWithPopup, signInAnonymously } from "../lib/firebaseConfig";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useTheme } from '../ThemeContext';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
import Loader from '../Loader';

function SignIn() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { theme } = useTheme();

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            // Set persistence to local to remember the state after reload
            await setPersistence(auth, browserLocalPersistence);

            const result = await signInWithPopup(auth, provider);
            const idToken = await result.user.getIdToken();
            localStorage.setItem('authToken', idToken);

            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/auth/authentication`, {}, {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });
            if (response.data.isSignedIn) {
                navigate("/main");
            } else {
                navigate("/newuserinfo");
            }
        } catch (error) {
            console.error("Google Sign-In Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestSignIn = async () => {
        setLoading(true);
        try {
            await setPersistence(auth, browserLocalPersistence);  // Set persistence for guest login

            const result = await signInAnonymously(auth);
            const idToken = await result.user.getIdToken();
            localStorage.setItem("authToken", idToken);

            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/auth/authentication`, {}, {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            if (response.data.success) {
                navigate("/main");
            } else {
                alert("Login failed");
            }

        } catch (error) {
            console.error("Anonymous Sign-In Error:", error);
        } finally{
            setLoading(false);
        }
    };

    return (

        loading ? <Loader /> :
            <div className={`${theme === 'light' ? 'bg-[#e6e6e6]' : 'bg-black'} w-screen h-screen text-white flex justify-center items-center`}>
                <div className={`w-[50vw] h-[70vh] flex flex-col justify-center items-center border-4 ${theme === 'dark' ? 'border-[#1E1E1E]' : 'border-gray-100 shadow-md'} rounded-lg p-8`} style={{
                    background: `${theme === 'dark' ? 'linear-gradient(145deg, #1b1b1b, #0e0e0e)' : '#f4f4f4'}`,
                }}>
                    <div className={`${theme === 'light' ? 'text-black' : 'text-[#f0f0f0'} text-4xl font-extrabold mb-10`} style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0px 4px 8px rgba(255, 255, 255, 0.1)' }}>WELCOME!</div>
                    <button
                        className={`flex items-center justify-center font-semibold p-4 w-[280px] rounded-md ${theme === 'dark' ? 'bg-[#2b2b2b] hover:bg-[#3a3a3a] active:bg-[#1f1f1f]' : 'bg-[#e6e6e6] shadow-md border-2 border-[#c0c0c0] hover:bg-[#cbcbcb] active:bg-[#b5b5b5] text-black'} active:scale-95 transition duration-200 mb-6`}
                        onClick={handleGoogleSignIn}
                    >
                        <GoogleIcon className="w-6 h-6 mr-4" />
                        Continue with Google
                    </button>

                    <div className={`${theme === 'light' ? 'text-black' : 'text-white'}`} style={{ fontFamily: 'Orbitron', marginBottom: '12px' }}>OR</div>
                    <button
                        className={`font-semibold p-4 w-[280px] rounded-md ${theme === 'dark' ? 'bg-[#2b2b2b] hover:bg-[#3a3a3a] active:bg-[#1f1f1f]' : 'bg-indigo-600 hover:bg-indigo-800 active:bg-indigo-700 text-white'} active:scale-95 transition duration-200`}
                        onClick={handleGuestSignIn}
                    >
                        Guest login
                    </button>

                </div>
            </div>


    );
}

export default SignIn;
