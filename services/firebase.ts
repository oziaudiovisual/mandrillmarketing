import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Using namespace import to fix potential module resolution issues with named exports in some environments
import * as firebaseStorage from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyB7NUYeeBzsY0qBNE5TN248FQjy3CENEAE",
  authDomain: "mandrill-marketing-90970.firebaseapp.com",
  projectId: "mandrill-marketing-90970",
  storageBucket: "mandrill-marketing-90970.firebasestorage.app",
  messagingSenderId: "240620385678",
  appId: "1:240620385678:web:fd1439112e8f9c609b20df"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = firebaseStorage.getStorage(app);