import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyB1Z1-1dDHuxvlcO7YtjCdlhKs8EIwDTQA",
  authDomain: "eyetracker-app-9de9d.firebaseapp.com",
  projectId: "eyetracker-app-9de9d",
  storageBucket: "eyetracker-app-9de9d.firebasestorage.app",
  messagingSenderId: "180393936352",
  appId: "1:180393936352:web:4510907fce40f57c841785",
  measurementId: "G-JD36ET06ES"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
