// src/components/Dashboard.jsx

// Global React hooks from CDN
const { useState, useEffect, useCallback } = React;

// Core Modules
import { db, auth, collection, query, where, getDocs } from '../core/firebase.js';

// Components
import { Navbar } from './UI.jsx';
import { AddBook, AddMultipleBooks } from './AddBook.jsx';
import { Stats } from './Stats.jsx';
import { BooksDisplay, Search } from './BooksDisplay.jsx';

// --- Main Dashboard Component ---
export function Dashboard({ user }) {
    const [view, setView] = useState('gallery');
    const [books, setBooks] = useState([]);
    const [loadingBooks, setLoadingBooks] = useState(true);

    const fetchBooks = useCallback(async () => {
        if (!user) return;
        setLoadingBooks(true);
        try {
            const q = query(collection(db, "readings"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const userBooks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            userBooks.sort((a, b) => {
                const orderDiff = (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity);
                if (orderDiff !== 0 && !isNaN(orderDiff)) {
                    return orderDiff;
                }
                const dateA = new Date(a.readDate).getTime() || 0;
                const dateB = new Date(b.readDate).getTime() || 0;
                return dateA - dateB; // Oldest first
            });

            setBooks(userBooks);
        } catch (error) {
            console.error("Error fetching books:", error);
        } finally {
            setLoadingBooks(false);
        }
    }, [user]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    const handleBooksChanged = () => {
        fetchBooks();
        setView('gallery');
    };

    return (
        <div className="p-4 md:p-8">
            <Navbar user={user} setView={setView} currentView={view} />
            <main className="mt-8">
                {view === 'add-single' && <AddBook books={books} onBookAdded={handleBooksChanged} onCancel={() => setView('gallery')} />}
                {view === 'add-multiple' && <AddMultipleBooks books={books} onBooksAdded={handleBooksChanged} onCancel={() => setView('gallery')} />}
                {view === 'stats' && <Stats books={books} loading={loadingBooks} />}
                {view === 'gallery' && <BooksDisplay books={books} loading={loadingBooks} onBookUpdated={fetchBooks} setView={setView} />}
                {view === 'search' && <Search books={books} onCancel={() => setView('gallery')} />}
            </main>
        </div>
    );
}
