// src/core/firebase.js

// Import configurations
import { firebaseConfig } from './config.js';

// Import Firebase SDK functions from CDN links (as they were in your HTML)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    writeBatch,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export all necessary functions for components to use
export {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    writeBatch,
    deleteDoc
};
