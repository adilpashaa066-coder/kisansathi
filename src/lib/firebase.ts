import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const hasValidConfig = Boolean(
  firebaseConfig?.apiKey &&
    firebaseConfig?.projectId &&
    firebaseConfig.projectId !== 'remixed-project-id'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (hasValidConfig) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { app, auth, googleProvider, hasValidConfig as isFirebaseConfigured };
