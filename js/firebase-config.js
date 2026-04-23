// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBdtFyofrkC_zSLrfPvuIbIwF6vFjYKK_Q",
    authDomain: "flowsense-project.firebaseapp.com",
    projectId: "flowsense-project",
    storageBucket: "flowsense-project.firebasestorage.app",
    messagingSenderId: "836404871715",
    appId: "1:836404871715:web:fdd5038a3a5f0abe38e796",
    measurementId: "G-XXVHNVLBML"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Services
const auth = firebase.auth();
const db = firebase.firestore();

console.log("🚀 Firebase Initialized Successfully");
