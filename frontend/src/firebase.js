// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// kalau nanti mau pakai firestore:
// import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqbbVUwSRMPvZDVDHO-oMSKBtoUtahzQM",
  authDomain: "bdtrex-development.firebaseapp.com",
  projectId: "bdtrex-development",
  storageBucket: "bdtrex-development.firebasestorage.app",
  messagingSenderId: "204857430622",
  appId: "1:204857430622:web:570ad88e38129be06b5acf",
  measurementId: "G-WL78YFQBDD"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// export const db = getFirestore(app); // enable if needed later
export default app;
