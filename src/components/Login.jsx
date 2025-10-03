// src/components/Login.jsx

// Global React hooks from CDN
const { useState } = React;

// Firebase functions from our module
import { 
    auth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from '../core/firebase.js';

// --- Login/Signup Component ---
export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            if (!email) {
                setError('Please enter your email address to reset your password.');
                return;
            }
            await sendPasswordResetEmail(auth, email);
            setMessage('Password reset email sent! Check your inbox.');
        } catch (err) {
            setError(err.message);
        }
    };

    const toggleView = () => {
        setIsResetting(!isResetting);
        setError('');
        setMessage('');
    };

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-center text-white">{isResetting ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Welcome Back')}</h2>

                {isResetting ? (
                    <form onSubmit={handlePasswordReset} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-400">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 mt-1 text-gray-200 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        {message && <p className="text-sm text-green-400">{message}</p>}
                        <button type="submit" className="w-full py-3 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition duration-300">
                            Send Reset Email
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-400">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 mt-1 text-gray-200 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-400">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 mt-1 text-gray-200 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <button type="submit" className="w-full py-3 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition duration-300">
                            {isSignUp ? 'Sign Up' : 'Login'}
                        </button>
                    </form>
                )}

                <p className="text-sm text-center text-gray-400">
                    {isResetting ? (
                        <>
                            Remembered your password?
                            <button onClick={toggleView} className="ml-1 font-bold text-indigo-400 hover:underline">
                                Login
                            </button>
                        </>
                    ) : (
                        <>
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                            <button onClick={() => setIsSignUp(!isSignUp)} className="ml-1 font-bold text-indigo-400 hover:underline">
                                {isSignUp ? 'Login' : 'Sign Up'}
                            </button>
                            <br />
                            <button onClick={toggleView} className="mt-2 font-bold text-indigo-400 hover:underline">
                                Forgot password?
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
