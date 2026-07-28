/**
 * firebase-config.js — Firebase project credentials & initialization.
 * These values are safe to be public (they identify the project, not secret keys).
 * Real access control is enforced by Firestore Security Rules in the Firebase console.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCpDLcUzgY02PI2lCeG7A76o-m7fhvvJv8",
  authDomain: "absensi-magang-34ed1.firebaseapp.com",
  projectId: "absensi-magang-34ed1",
  storageBucket: "absensi-magang-34ed1.firebasestorage.app",
  messagingSenderId: "496675637162",
  appId: "1:496675637162:web:2dcfe14a951dd55db44dd3"
};

firebase.initializeApp(firebaseConfig);
