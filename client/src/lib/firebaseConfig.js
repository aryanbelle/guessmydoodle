import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider,signInAnonymously, signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';


const firebaseConfig = {
  apiKey: "AIzaSyBE7LKygZAUw-5ECAprAoiD9nhqkUmL9O8",
  authDomain: "guess-my-doodle-b2473.firebaseapp.com",
  projectId: "guess-my-doodle-b2473",
  storageBucket: "guess-my-doodle-b2473.appspot.com",
  messagingSenderId: "681940033488",
  appId: "1:681940033488:web:f44cf08a14d31aac1063d5",
  measurementId: "G-G0VZFBGJZN"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

export { auth, provider,signInAnonymously, signInWithPopup };