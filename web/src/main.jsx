import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import App from './App.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<App />);

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
if (import.meta.env.PROD && firebaseConfigured) {
	isSupported().then(supported => {
		if (!supported) return;
		getAnalytics(initializeApp(firebaseConfig));
	}).catch(error => console.error('Unable to initialize Firebase Analytics:', error));
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
	window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
