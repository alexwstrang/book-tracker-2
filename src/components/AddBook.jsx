// src/components/AddBook.jsx

// Global React hooks from CDN
const { useState, useEffect, useMemo, useCallback } = React;

// Core Modules
import { GOOGLE_BOOKS_API_KEY } from '../core/config.js';
import { parseGenre, isNonFiction, sanitizeIsbn } from '../core/helpers.js';
import { db, auth, collection, addDoc, writeBatch, doc } from '../core/firebase.js';

// Import external library access (it's globally available from the CDN link)
const Html5Qrcode = window.Html5Qrcode;


// --- Barcode Scanner Component ---
function BarcodeScanner({ onScanSuccess, onCancel }) {
    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            html5QrCode.stop()
                .finally(() => {
                    onScanSuccess(decodedText);
                });
        };

        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => { 
                console.error("Unable to start scanning.", err);
                onCancel(); 
            });

        return () => {
            try {
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.stop();
                }
            } catch (err) {
                console.error("Failed to stop scanner during cleanup.", err);
            }
        };
    }, [onScanSuccess, onCancel]);

    return (
        <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400">Point your camera at the book's barcode</p>
            <div className="scanner-viewfinder">
                <div id="reader"></div>
                <div className="scanner-scan-line"></div>
            </div>
            <button
                onClick={onCancel}
                className="w-full max-w-xs px-4 py-2 font-bold bg-red-600 text-white rounded-md hover:bg-red-700"
            >
                Cancel Scan and Add Book Manually
            </button>
        </div>
    );
}

// --- Add Single Book Component ---
export function AddBook({ books, onBookAdded, onCancel }) {
    const [isbn, setIsbn] = useState('');
    const [bookData, setBookData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [readMonth, setReadMonth] = useState(new Date().getMonth());
    const [readYear, setReadYear] = useState(new Date().getFullYear());
    const [isAddingNewGenre, setIsAddingNewGenre] = useState(false);
    const [isManualAdd, setIsManualAdd] = useState(false);
    const [isScanning, setIsScanning] = useState(true);
    const [manualFormData, setManualFormData] = useState({
        title: '', author: '', isFiction: true, genre: '', pageCount: 0, coverUrl: '', country: '',
    });

    const fictionGenres = useMemo(() => [...new Set(books.filter(b => b.isFiction).map(b => b.genre))], [books]);
    const nonFictionGenres = useMemo(() => [...new Set(books.filter(b => !b.isFiction).map(b => b.genre))], [books]);

    const handleIsbnSearch = useCallback(async (searchIsbn) => {
        setLoading(true);
        setError('');
        setBookData(null);
        setIsManualAdd(false);
        try {
            const sanitized = sanitizeIsbn(searchIsbn);
            const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${sanitized}${GOOGLE_BOOKS_API_KEY ? '&key=' + GOOGLE_BOOKS_API_KEY : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.totalItems > 0) {
                const book = data.items[0].volumeInfo;
                const title = book.title || 'No Title Provided';
                setBookData({
                    title: title,
                    author: book.authors ? book.authors.join(', ') : 'N/A',
                    isFiction: !isNonFiction(book.categories),
                    genre: parseGenre(book.categories),
                    pageCount: book.pageCount || 0,
                    publicationYear: book.publishedDate ? new Date(book.publishedDate).getFullYear() : 'N/A',
                    coverUrl: book.imageLinks?.thumbnail || `https://placehold.co/128x192/1f2937/ffffff?text=${title.split(' ').join('+')}`,
                    country: '',
                });
            } else {
                setError('Book not found for this ISBN.');
            }
        } catch (err) {
            console.error("API Fetch Error:", err);
            setError('Failed to fetch book data. Please check the ISBN and your connection.');
        }
        setLoading(false);
    }, []);

    const handleScanSuccess = useCallback((decodedIsbn) => {
        setIsScanning(false);
        setIsbn(decodedIsbn);
        handleIsbnSearch(decodedIsbn);
    }, [handleIsbnSearch]);

    const handleIsbnFormSubmit = (e) => {
        e.preventDefault();
        handleIsbnSearch(isbn);
    };

    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!bookData) return;

        const readDate = new Date(readYear, readMonth, 15).toISOString().split('T')[0];
        const bookToSave = {
            title: bookData.title,
            author: bookData.author,
            isFiction: bookData.isFiction,
            genre: bookData.genre,
            pageCount: Number(bookData.pageCount) || 0,
            publicationYear: bookData.publicationYear,
            coverUrl: bookData.coverUrl,
            country: bookData.country,
            isbn: sanitizeIsbn(isbn),
            userId: auth.currentUser.uid,
            readDate: readDate,
            readYear: Number(readYear),
            orderIndex: Date.now(),
        };

        try {
            await addDoc(collection(db, "readings"), bookToSave);
            setIsbn('');
            setBookData(null);
            onBookAdded();
        } catch (err) {
            console.error("Error adding book:", err);
            setError('Failed to save book.');
        }
    };

    const handleSaveManualBook = async (e) => {
        e.preventDefault();
        if (!manualFormData.title || !manualFormData.author) {
            setError('Title and Author are required.');
            return;
        }

        const readDate = new Date(readYear, readMonth, 15).toISOString().split('T')[0];
        const bookToSave = {
            title: manualFormData.title,
            author: manualFormData.author,
            isFiction: manualFormData.isFiction,
            genre: manualFormData.genre,
            pageCount: Number(manualFormData.pageCount) || 0,
            coverUrl: manualFormData.coverUrl || `https://placehold.co/128x192/1f2937/ffffff?text=${manualFormData.title.split(' ').join('+')}`,
            country: manualFormData.country,
            userId: auth.currentUser.uid,
            isbn: '', 
            publicationYear: 'N/A',
            readDate: readDate,
            readYear: Number(readYear),
            orderIndex: Date.now(),
        };

        try {
            await addDoc(collection(db, "readings"), bookToSave);
            setIsManualAdd(false);
            setManualFormData({ title: '', author: '', isFiction: true, genre: '', pageCount: 0, coverUrl: '', country: '' });
            onBookAdded();
        } catch (err) {
            console.error("Error adding manual book:", err);
            setError('Failed to save book.');
        }
    };

    const handleBookDataChange = (e) => {
        const { name, value } = e.target;
        if (name === 'genreSelect') {
            if (value === 'add-new') {
                setIsAddingNewGenre(true);
                setBookData(prev => ({ ...prev, genre: '' }));
            } else {
                setIsAddingNewGenre(false);
                setBookData(prev => ({ ...prev, genre: value }));
            }
        } else {
            setBookData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleManualFormChange = (e) => {
        const { name, value } = e.target;

        if (name === 'genreSelect') {
            if (value === 'add-new') {
                setIsAddingNewGenre(true);
                setManualFormData(prev => ({ ...prev, genre: '' }));
            } else {
                setIsAddingNewGenre(false);
                setManualFormData(prev => ({ ...prev, genre: value }));
            }
        } else if (name === 'isFiction') {
            const isFictionValue = value === 'true';
            setManualFormData(prev => ({ 
                ...prev, 
                isFiction: isFictionValue,
                genre: (isFictionValue ? fictionGenres : nonFictionGenres).includes(prev.genre) ? prev.genre : ''
            }));
        } else {
            setManualFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleToggleManualAdd = () => {
        setIsManualAdd(true);
        setError('');
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{isScanning ? 'Scan Book Barcode' : (isManualAdd ? 'Add Book Manually' : 'Add a New Book')}</h2>
                <button onClick={isScanning ? () => setIsScanning(false) : onCancel} className="text-gray-400 hover:text-white">&times;</button>
            </div>

            {isScanning ? (
                <BarcodeScanner onScanSuccess={handleScanSuccess} onCancel={() => setIsScanning(false)} />
            ) : (
                <>
                    {!isManualAdd && (
                        <div className="space-y-3 mb-4">
                            <form onSubmit={handleIsbnFormSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={isbn}
                                    onChange={(e) => setIsbn(e.target.value)}
                                    placeholder="Enter 10 or 13-digit ISBN"
                                    className="flex-grow p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                                <button type="submit" disabled={loading} className="px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500">
                                    {loading ? 'Searching...' : 'Find Book'}
                                </button>
                            </form>
                            <button 
                                onClick={() => setIsScanning(true)} 
                                className="w-full py-2 font-bold text-white bg-gray-600 rounded-md hover:bg-gray-500 flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /><path d="M3 8V4m0 12v4m18-4v4m0-12V4" /></svg>
                                Scan Barcode
                            </button>
                        </div>
                    )}

                    {error && <p className="text-red-400 mb-4">{error}</p>}

                    {error === 'Book not found for this ISBN.' && !bookData && !isManualAdd && (
                        <div className="text-center">
                            <button onClick={handleToggleManualAdd} className="px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">
                                Add Manually
                            </button>
                        </div>
                    )}

                    {isManualAdd && (
                            <form onSubmit={handleSaveManualBook} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Title*</label>
                                        <input type="text" name="title" value={manualFormData.title} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white" required/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Author*</label>
                                        <input type="text" name="author" value={manualFormData.author} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white" required/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Cover Image URL</label>
                                    <input type="text" name="coverUrl" value={manualFormData.coverUrl} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Date Read</label>
                                    <div className="flex gap-2 mt-1">
                                        <select value={readMonth} onChange={e => setReadMonth(parseInt(e.target.value))} className="w-full p-2 bg-gray-700 rounded-md text-white">
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                        </select>
                                        <input type="number" value={readYear} onChange={e => setReadYear(parseInt(e.target.value))} className="w-full p-2 bg-gray-700 rounded-md text-white" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Type</label>
                                        <select name="isFiction" value={manualFormData.isFiction} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white">
                                            <option value="true">Fiction</option>
                                            <option value="false">Non-Fiction</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Pages</label>
                                        <input type="number" name="pageCount" value={manualFormData.pageCount} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Genre</label>
                                    <select name="genreSelect" value={isAddingNewGenre ? 'add-new' : manualFormData.genre} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white">
                                        <option value="" disabled>Select a genre</option>
                                        {(manualFormData.isFiction ? fictionGenres : nonFictionGenres).map(g => <option key={g} value={g}>{g}</option>)}
                                        <option value="add-new">--- Add New Genre ---</option>
                                    </select>
                                    {isAddingNewGenre && (
                                        <input type="text" name="genre" placeholder="New Genre" value={manualFormData.genre} onChange={handleManualFormChange} className="w-full p-2 mt-2 bg-gray-600 rounded-md text-white"/>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Author's Country</label>
                                    <input type="text" name="country" value={manualFormData.country} onChange={handleManualFormChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white"/>
                                </div>
                                <button type="submit" className="w-full py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">Add Book</button>
                           </form>
                    )}

                    {bookData && !isManualAdd && (
                        <form onSubmit={handleAddBook}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                                <div className="md:col-span-1">
                                    <img src={bookData.coverUrl} alt={bookData.title} className="w-full h-auto object-cover rounded-md shadow-lg" />
                                </div>
                                <div className="md:col-span-2 space-y-4">
                                    <h3 className="text-2xl font-bold">{bookData.title}</h3>
                                    <p className="text-gray-400">by {bookData.author}</p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Date Read</label>
                                        <div className="flex gap-2 mt-1">
                                            <select value={readMonth} onChange={e => setReadMonth(parseInt(e.target.value))} className="w-full p-2 bg-gray-700 rounded-md text-white">
                                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>
                                            <input type="number" value={readYear} onChange={e => setReadYear(parseInt(e.target.value))} className="w-full p-2 bg-gray-700 rounded-md text-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Type</label>
                                            <select name="isFiction" value={bookData.isFiction} onChange={e => handleBookDataChange({ target: { name: 'isFiction', value: e.target.value === 'true' }})} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white">
                                                <option value="true">Fiction</option>
                                                <option value="false">Non-Fiction</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Pages</label>
                                            <input type="number" name="pageCount" value={bookData.pageCount} onChange={handleBookDataChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Genre</label>
                                        <select name="genreSelect" value={isAddingNewGenre ? 'add-new' : bookData.genre} onChange={handleBookDataChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white">
                                            <option value={bookData.genre} disabled>{bookData.genre}</option>
                                            {(bookData.isFiction ? fictionGenres : nonFictionGenres).map(g => <option key={g} value={g}>{g}</option>)}
                                            <option value="add-new">--- Add New Genre ---</option>
                                        </select>
                                        {isAddingNewGenre && (
                                            <input type="text" name="genre" placeholder="New Genre" value={bookData.genre} onChange={handleBookDataChange} className="w-full p-2 mt-2 bg-gray-600 rounded-md text-white"/>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400">Author's Country</label>
                                        <input type="text" name="country" value={bookData.country} onChange={handleBookDataChange} className="w-full p-2 mt-1 bg-gray-700 rounded-md text-white"/>
                                    </div>
                                    <button type="submit" className="w-full py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">Add Book</button>
                                </div>
                            </div>
                        </form>
                    )}
                </>
            )}
        </div>
    );
}

// --- Add Multiple Books Component ---
export function AddMultipleBooks({ books, onBooksAdded, onCancel }) {
    const [isbnList, setIsbnList] = useState('');
    const [foundBooks, setFoundBooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fictionGenres = useMemo(() => [...new Set(books.filter(b => b.isFiction).map(b => b.genre))], [books]);
    const nonFictionGenres = useMemo(() => [...new Set(books.filter(b => !b.isFiction).map(b => b.genre))], [books]);

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text').trim();
        if (!pastedText) return;

        const separator = isbnList.trim() === '' ? '' : ', ';
        setIsbnList(prevList => prevList + separator + pastedText);
    };

    const handleFindBooks = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setFoundBooks([]);

        const isbns = isbnList.split(/[\s,]+/).filter(isbn => isbn.trim() !== '');
        if (isbns.length === 0) {
            setError('Please enter at least one ISBN.');
            setLoading(false);
            return;
        }

        try {
            const bookPromises = isbns.map(async rawIsbn => {
                const isbn = sanitizeIsbn(rawIsbn);
                const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${GOOGLE_BOOKS_API_KEY ? '&key=' + GOOGLE_BOOKS_API_KEY : ''}`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.totalItems > 0) {
                    const book = data.items[0].volumeInfo;
                    const title = book.title || 'No Title Provided';
                    return {
                        isbn,
                        title: title,
                        author: book.authors ? book.authors.join(', ') : 'N/A',
                        isFiction: !isNonFiction(book.categories),
                        genre: parseGenre(book.categories),
                        pageCount: book.pageCount || 0,
                        publicationYear: book.publishedDate ? new Date(book.publishedDate).getFullYear() : 'N/A',
                        coverUrl: book.imageLinks?.thumbnail || `https://placehold.co/128x192/1f2937/ffffff?text=${title.split(' ').join('+')}`,
                        readMonth: new Date().getMonth(),
                        readYear: new Date().getFullYear(),
                        country: '',
                    };
                }
                return { isbn: rawIsbn, error: 'Not Found' };
            });

            const results = await Promise.all(bookPromises);
            setFoundBooks(results.map(b => ({...b, isAddingNewGenre: false })));

        } catch (err) {
            setError('An error occurred while fetching book data.');
        }
        setLoading(false);
    };

    const handleBookDataChange = (index, field, value) => {
        const updatedBooks = [...foundBooks];
        if (field === 'genreSelect') {
            if (value === 'add-new') {
                updatedBooks[index].isAddingNewGenre = true;
                updatedBooks[index].genre = '';
            } else {
                updatedBooks[index].isAddingNewGenre = false;
                updatedBooks[index].genre = value;
            }
        } else {
            updatedBooks[index][field] = value;
        }
        setFoundBooks(updatedBooks);
    };

    const handleAddAllBooks = async () => {
        const booksToAdd = foundBooks.filter(book => !book.error);
        if (booksToAdd.length === 0) {
            setError('No valid books to add.');
            return;
        }

        try {
            const batch = writeBatch(db);
            let baseOrderIndex = Date.now();
            booksToAdd.forEach((book, index) => {
                const newBookRef = doc(collection(db, "readings"));

                const readDate = new Date(book.readYear, book.readMonth, 15).toISOString().split('T')[0];
                const bookToSave = {
                    title: book.title,
                    author: book.author,
                    isFiction: book.isFiction,
                    genre: book.genre,
                    pageCount: Number(book.pageCount) || 0,
                    publicationYear: book.publicationYear,
                    coverUrl: book.coverUrl,
                    country: book.country,
                    isbn: book.isbn,
                    userId: auth.currentUser.uid,
                    readDate: readDate,
                    readYear: Number(book.readYear),
                    orderIndex: baseOrderIndex + index,
                };

                batch.set(newBookRef, bookToSave);
            });
            await batch.commit();
            onBooksAdded();
        } catch (err) {
            console.error("Error saving books:", err);
            setError('Failed to save books.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Add Multiple Books</h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleFindBooks} className="mb-4">
                <textarea
                    value={isbnList}
                    onChange={(e) => setIsbnList(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Paste a list of ISBNs, separated by spaces or commas"
                    className="w-full h-24 p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" disabled={loading} className="mt-2 w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500">
                    {loading ? 'Searching...' : 'Find Books'}
                </button>
            </form>
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {foundBooks.length > 0 && (
                <div className="space-y-4">
                    {foundBooks.map((book, index) => (
                        <div key={book.isbn} className="p-4 bg-gray-700 rounded-md">
                            {book.error ? (
                                <p className="text-red-400">ISBN: {book.isbn} - Not Found</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                    <div className="md:col-span-1">
                                        <img src={book.coverUrl} alt={book.title} className="w-24 h-36 object-cover rounded-md" />
                                    </div>
                                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="font-bold">{book.title}</p>
                                            <p className="text-sm text-gray-400">{book.author}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400">Date Read</label>
                                            <div className="flex gap-2 mt-1">
                                                <select value={book.readMonth} onChange={e => handleBookDataChange(index, 'readMonth', parseInt(e.target.value))} className="w-full p-2 bg-gray-600 rounded-md text-sm text-white">
                                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                </select>
                                                <input type="number" value={book.readYear} onChange={e => handleBookDataChange(index, 'readYear', parseInt(e.target.value))} className="w-full p-2 bg-gray-600 rounded-md text-sm text-white" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Type</label>
                                                <select value={book.isFiction} onChange={e => handleBookDataChange(index, 'isFiction', e.target.value === 'true')} className="w-full p-2 mt-1 bg-gray-600 rounded-md text-sm text-white">
                                                    <option value="true">Fiction</option>
                                                    <option value="false">Non-Fiction</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Pages</label>
                                                <input type="number" value={book.pageCount} onChange={e => handleBookDataChange(index, 'pageCount', parseInt(e.target.value))} className="w-full p-2 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400">Genre</label>
                                            <select name="genreSelect" value={book.isAddingNewGenre ? 'add-new' : book.genre} onChange={e => handleBookDataChange(index, 'genreSelect', e.target.value)} className="w-full p-2 mt-1 bg-gray-600 rounded-md text-white">
                                                <option value={book.genre} disabled>{book.genre}</option>
                                                {(book.isFiction ? fictionGenres : nonFictionGenres).map(g => <option key={g} value={g}>{g}</option>)}
                                                <option value="add-new">--- Add New Genre ---</option>
                                            </select>
                                            {book.isAddingNewGenre && (
                                                <input type="text" placeholder="New Genre" value={book.genre} onChange={e => handleBookDataChange(index, 'genre', e.target.value)} className="w-full p-2 mt-2 bg-gray-500 rounded-md text-white"/>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                        <button onClick={handleAddAllBooks} className="mt-4 w-full py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">Add All Books</button>
                </div>
            )}
        </div>
    );
}
