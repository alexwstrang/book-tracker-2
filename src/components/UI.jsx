// src/components/UI.jsx

// Global React hooks from CDN
const { useState } = React;

// Core Modules
import { auth, signOut } from '../core/firebase.js';
import { YEARLY_GOAL } from '../core/config.js';

// --- Confirmation Modal Component ---
export function ConfirmationModal({ isOpen, message, onConfirm, onCancel }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full">
                <p className="text-white mb-4">{message}</p>
                <div className="flex justify-end gap-4">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Confirm</button>
                </div>
            </div>
        </div>
    );
}

// --- Goal Progress Component ---
export function GoalProgress({ count, goal, year }) {
    const percentage = Math.min((count / goal) * 100, 100);
    const booksLeft = goal - count;
    const currentYear = new Date().getFullYear();
    let progressText;

    if (booksLeft <= 0) {
        progressText = "Goal achieved! 🎉";
    } else if (year < currentYear) {
        progressText = `You were ${booksLeft} ${booksLeft === 1 ? 'book' : 'books'} short.`;
    } else if (year > currentYear) {
        progressText = `Goal set for ${year}.`;
    } else {
        progressText = `${booksLeft} more to go!`;
    }

    return (
        <div className="max-w-4xl mx-auto mb-6 p-4 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-white">Your {year} Reading Goal</h3>
                <span className="text-lg font-bold text-indigo-400">{count} / {goal}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                    className="bg-indigo-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <p className="text-right text-sm text-gray-400 mt-2">
                {progressText}
            </p>
        </div>
    );
}

// --- Navbar Component ---
export function Navbar({ user, setView, currentView }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const activeClass = "bg-indigo-600 text-white";
    const inactiveClass = "text-gray-300 hover:bg-gray-700 hover:text-white";

    const NavLink = ({ view, children }) => (
        <button 
            onClick={() => { setView(view); setIsMenuOpen(false); }} 
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${currentView === view ? activeClass : inactiveClass}`}
        >
            {children}
        </button>
    );

    return (
        <header className="relative">
            <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-2">
                    <h1 className="text-3xl font-bold text-white">Book Tracker</h1>
                    <span className="font-mono text-xs text-gray-500">v0.94 (revert)</span>
                </div>

                {/* Hamburger Button - Mobile */}
                <div className="md:hidden">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700">
                        <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                        </svg>
                    </button>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
                    <NavLink view="gallery">Books</NavLink>
                    <NavLink view="stats">Stats</NavLink>
                    <NavLink view="search">Search</NavLink>
                    <NavLink view="add-single">+ Add Book</NavLink>
                    <NavLink view="add-multiple">+ Add Multiple</NavLink>
                </nav>
                <div className="hidden md:flex items-center space-x-4">
                    <span className="text-sm text-gray-400">{user.email}</span>
                    <button onClick={() => signOut(auth)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Logout</button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden mt-4 bg-gray-800 rounded-lg p-4">
                    <nav className="flex flex-col space-y-2">
                        <NavLink view="gallery">Books</NavLink>
                        <NavLink view="stats">Stats</NavLink>
                        <NavLink view="search">Search</NavLink>
                        <NavLink view="add-single">+ Add Book</NavLink>
                        <NavLink view="add-multiple">+ Add Multiple</NavLink>
                    </nav>
                    <div className="border-t border-gray-700 mt-4 pt-4 flex flex-col items-start space-y-3">
                        <span className="text-sm text-gray-400 w-full">{user.email}</span>
                        <button onClick={() => signOut(auth)} className="w-full text-left px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Logout</button>
                    </div>
                </div>
            )}
        </header>
    );
}
