// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getAnalytics } from "firebase/analytics"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAQAQw5i-ZQSCdEAUgMnk970vSh7SES1Kk",
  authDomain: "cookhouse-main.firebaseapp.com",
  projectId: "cookhouse-main",
  storageBucket: "cookhouse-main.firebasestorage.app",
  messagingSenderId: "884440480404",
  appId: "1:884440480404:web:25aa348feb697352939281",
  measurementId: "G-EGCGZW78E1",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app)

// Initialize Analytics (only in browser)
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null

export default app
