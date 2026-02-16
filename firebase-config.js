// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyDgX33JA663R8Pyvfkww3mvep1n8_d0AxA",
  authDomain: "linkup-iut.firebaseapp.com",
  projectId: "linkup-iut",
  storageBucket: "linkup-iut.appspot.com",
  messagingSenderId: "187321401718",
  appId: "1:187321401718:web:3a6effbcb0a6477b56ba57",
  measurementId: "G-Z8HV42713H"
};

// Initialisation Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

console.log("✅ Firebase initialisé avec succès");
