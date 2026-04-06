import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNoBvgu7W4txBT-nbnho_ILwU462bhlC4",
  authDomain: "habit-tracker-de698.firebaseapp.com",
  projectId: "habit-tracker-de698"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
