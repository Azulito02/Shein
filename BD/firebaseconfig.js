// BD/firebaseconfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCPDLo0CNWJx7pl_94R9yy-aifUnw1A2Wc",
  authDomain: "shein-b94a9.firebaseapp.com",
  projectId: "shein-b94a9",
  storageBucket: "shein-b94a9.appspot.com",
  messagingSenderId: "637343166210",
  appId: "1:637343166210:web:5f836dbb71149c6b52dc1b"
};


const app = initializeApp(firebaseConfig);


const db = getFirestore(app); 
const storage = getStorage(app);

export { db, storage };
