// src/main.jsx

// Global React hooks from CDN
const { useState, useEffect } = React; 
const root = ReactDOM.createRoot(document.getElementById('root'));

// Core Modules
import { auth, onAuthStateChanged } from './core/firebase.js';

// Components
import { Login } from './components/Login.jsx'; 
import { Dashboard } from './components/Dashboard.jsx'; 

// --- Main App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
            {user ? <Dashboard user={user} /> : <Login />}
        </div>
    );
}

// Render the app
root.render(<App />);
