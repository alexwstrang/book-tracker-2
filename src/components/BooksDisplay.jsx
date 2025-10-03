// src/components/BooksDisplay.jsx

// Global React hooks from CDN
const { useState, useEffect, useMemo, useRef } = React;

// Core Modules
import { db, doc, updateDoc, deleteDoc, writeBatch } from '../core/firebase.js';
import { YEARLY_GOAL } from '../core/config.js';

// Components
import { ConfirmationModal, GoalProgress } from './UI.jsx'; 

// --- Lightbox Component ---
function Lightbox({ book, onClose }) {
    if (!book) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 p-6 rounded-lg max-w-lg w-full flex flex-col md:flex-row gap-6" onClick={e => e.stopPropagation()}>
                <img src={book.coverUrl} alt={book.title} className="w-48 h-auto object-cover rounded-md shadow-lg self-center md:self-start" />
                <div className="flex flex-col flex-grow">
                    <h2 className="text-2xl font-bold text-white mb-2">{book.title}</h2>
                    <p className="text-lg text-gray-300 mb-4">{book.author}</p>
                    <div className="space-y-2 text-sm">
                        <p><span className="font-bold text-gray-400">Type:</span> {book.isFiction ? 'Fiction' : 'Non-Fiction'}</p>
                        <p><span className="font-bold text-gray-400">Genre:</span> {book.genre}</p>
                        <p><span className="font-bold text-gray-400">Pages:</span> {book.pageCount > 0 ? book.pageCount : 'N/A'}</p>
                        <p><span className="font-bold text-gray-400">Read:</span> {new Date(book.readDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <button onClick={onClose} className="mt-4 md:mt-auto ml-auto px-4 py-2 bg-indigo-600 text-white rounded-md">Close</button>
                </div>
            </div>
        </div>
    );
}

// --- Books Display (Gallery + List) Component ---
export function BooksDisplay({ books, loading, onBookUpdated, setView }) {
    const [viewMode, setViewMode] = useState('list');
    const [displayedBooks, setDisplayedBooks] = useState([]);
    const [editingBookId, setEditingBookId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [lightboxBook, setLightboxBook] = useState(null);
    const [isEditingNewGenre, setIsEditingNewGenre] = useState(false);
    const [isBulkEditing, setIsBulkEditing] = useState(false);
    const [bulkEditData, setBulkEditData] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().getFullYear());
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, bookId: null });

    const draggedItem = useRef(null);

    const availablePeriods = useMemo(() => {
        const years = new Set(books.map(b => b.readYear).filter(y => y));
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        return ['All Time', ...Array.from(years).sort((a, b) => b - a)];
    }, [books]);

    const fictionGenres = useMemo(() => [...new Set(books.filter(b => b.isFiction).map(b => b.genre))], [books]);
    const nonFictionGenres = useMemo(() => [...new Set(books.filter(b => !b.isFiction).map(b => b.genre))], [books]);
    const allCountries = useMemo(() => [...new Set(books.map(b => b.country).filter(Boolean))].sort(), [books]);

    useEffect(() => {
        let filteredBooks;
        if (selectedPeriod === 'All Time') {
            // All Time: Sort by readDate DESCENDING (Newest first)
            filteredBooks = [...books].sort((a, b) => {
                // 1. Sort by readDate DESCENDING (Newest first)
                const dateDiff = new Date(b.readDate).getTime() - new Date(a.readDate).getTime();
                if (dateDiff !== 0 && !isNaN(dateDiff)) {
                    return dateDiff;
                }
                // 2. Fallback to orderIndex DESCENDING for books read on the same day (to maintain "most recently added" as most recent)
                return (b.orderIndex ?? Infinity) - (a.orderIndex ?? Infinity);
            });
        } else {
            // Specific Year: Filter and sort by orderIndex ASCENDING (drag-and-drop order)
            filteredBooks = books.filter(b => b.readYear === selectedPeriod);

            filteredBooks.sort((a, b) => {
                // 1. Sort by explicit orderIndex (for drag and drop)
                const orderDiff = (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity);
                if (orderDiff !== 0 && !isNaN(orderDiff)) {
                    return orderDiff;
                }
                // 2. Fallback to readDate ASCENDING (Oldest first) for books without an explicit order
                const dateA = new Date(a.readDate).getTime() || 0;
                const dateB = new Date(b.readDate).getTime() || 0;
                return dateA - dateB; 
            });
        }

        setDisplayedBooks(filteredBooks);

        if (isBulkEditing && selectedPeriod !== 'All Time') {
            setIsBulkEditing(false);
        }
    }, [books, selectedPeriod, isBulkEditing]);

    const handlePeriodSelect = (period) => {
        setSelectedPeriod(period);
    };

    const handleDeleteRequest = (bookId) => {
        setConfirmDelete({ isOpen: true, bookId: bookId });
    };

    const confirmDeletion = async () => {
        if (confirmDelete.bookId) {
            await deleteDoc(doc(db, "readings", confirmDelete.bookId));
            onBookUpdated();
        }
        setConfirmDelete({ isOpen: false, bookId: null });
    };

    const cancelDeletion = () => {
        setConfirmDelete({ isOpen: false, bookId: null });
    };

    const handleDragStart = (e, index) => {
        draggedItem.current = displayedBooks[index];
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        const draggedOverItem = displayedBooks[index];
        if (draggedItem.current === draggedOverItem) {
            return;
        }
        let items = displayedBooks.filter(item => item.id !== draggedItem.current.id);
        items.splice(index, 0, draggedItem.current);
        setDisplayedBooks(items);
    };

    const handleDrop = async () => {
        const batch = writeBatch(db);
        displayedBooks.forEach((book, index) => {
            const bookRef = doc(db, "readings", book.id);
            batch.update(bookRef, { orderIndex: index });
        });
        await batch.commit();
        draggedItem.current = null;
        onBookUpdated();
    };

    const handleEditClick = (book) => {
        setEditingBookId(book.id);
        const date = new Date(book.readDate);
        setEditFormData({
            title: book.title,
            author: book.author,
            coverUrl: book.coverUrl,
            readMonth: date.getMonth(),
            readYear: date.getFullYear(),
            pageCount: book.pageCount || 0,
            genre: book.genre,
            country: book.country || '',
            isFiction: book.isFiction,
        });
    };

    const handleCancelEdit = () => {
        setEditingBookId(null);
        setIsEditingNewGenre(false);
    };

    const handleSaveEdit = async (bookId) => {
        const { readMonth, readYear, pageCount, genre, title, coverUrl, country, author, isFiction } = editFormData;
        const newReadDate = new Date(readYear, readMonth, 15).toISOString().split('T')[0];
        const updatedData = {
            readDate: newReadDate,
            pageCount: Number(pageCount),
            genre,
            title,
            author,
            isFiction,
            coverUrl,
            country,
            readYear: Number(readYear),
        };
        const bookRef = doc(db, "readings", bookId);
        await updateDoc(bookRef, updatedData);
        setEditingBookId(null);
        setIsEditingNewGenre(false);
        onBookUpdated();
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'genreSelect') {
            if (value === 'add-new') {
                setIsEditingNewGenre(true);
                setEditFormData(prev => ({ ...prev, genre: '' }));
            } else {
                setIsEditingNewGenre(false);
                setEditFormData(prev => ({ ...prev, genre: value }));
            }
        } else if (name === 'isFiction') {
            const isFictionValue = value === 'true';
            setEditFormData(prev => {
                const newFormData = { ...prev, isFiction: isFictionValue };
                const newGenreList = isFictionValue ? fictionGenres : nonFictionGenres;
                if (!newGenreList.includes(newFormData.genre)) {
                    newFormData.genre = '';
                }
                return newFormData;
            });
        } else {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const toggleBulkEdit = () => {
        if (!isBulkEditing) {
            const dataForEditing = displayedBooks.map(book => {
                const date = new Date(book.readDate);
                return {
                    ...book,
                    readMonth: date.getMonth(),
                    readYear: date.getFullYear(),
                    isAddingNewGenre: false,
                    isAddingNewCountry: false,
                };
            });
            setBulkEditData(dataForEditing);
        }
        setIsBulkEditing(!isBulkEditing);
    };

    const handleBulkEditChange = (index, field, value) => {
        const updatedData = [...bulkEditData];

        if (field === 'genreSelect') {
            if (value === 'add-new') {
                updatedData[index].isAddingNewGenre = true;
                updatedData[index].genre = '';
            } else {
                updatedData[index].isAddingNewGenre = false;
                updatedData[index].genre = value;
            }
        } else if (field === 'countrySelect') {
            if (value === 'add-new') {
                updatedData[index].isAddingNewCountry = true;
                updatedData[index].country = '';
            } else {
                updatedData[index].isAddingNewCountry = false;
                updatedData[index].country = value;
            }
        } else if (field === 'isFiction') {
            const isFiction = value === 'true';
            updatedData[index].isFiction = isFiction;
            const newGenreList = isFiction ? fictionGenres : nonFictionGenres;
            if (!newGenreList.includes(updatedData[index].genre)) {
                updatedData[index].genre = ''; 
            }
        }
        else {
            updatedData[index][field] = value;
        }

        setBulkEditData(updatedData);
    };

    const handleSaveBulkEdit = async () => {
        try {
            const batch = writeBatch(db);
            bulkEditData.forEach(book => {
                const year = Number(book.readYear);
                const month = Number(book.readMonth);

                if (isNaN(year) || isNaN(month)) {
                    console.warn(`Skipping book "${book.title}" due to invalid date.`);
                    return;
                }

                const bookRef = doc(db, "readings", book.id);
                const newReadDate = new Date(year, month, 15).toISOString().split('T')[0];
                const { id, readMonth, isAddingNewGenre, isAddingNewCountry, ...dataToSave } = book;

                const updatedData = {
                    ...dataToSave,
                    pageCount: Number(book.pageCount) || 0,
                    readDate: newReadDate,
                    readYear: year,
                };
                batch.update(bookRef, updatedData);
            });
            await batch.commit();
            setIsBulkEditing(false);
            onBookUpdated();
        } catch (error) {
            console.error("Failed to save bulk changes:", error);
            alert("Error: Could not save changes. Please ensure all fields like Year have valid numbers.");
        }
    };

    if (loading) return <p>Loading books...</p>;

    const activeClass = "bg-indigo-600 text-white";
    const inactiveClass = "bg-gray-700 text-gray-300";

    return (
        <div>
            <button
                onClick={() => setView('add-single')}
                className="md:hidden fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
                aria-label="Add new book"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>

            {selectedPeriod !== 'All Time' && (
                <GoalProgress count={displayedBooks.length} goal={YEARLY_GOAL} year={selectedPeriod} />
            )}
            <Lightbox book={lightboxBook} onClose={() => setLightboxBook(null)} />
            <ConfirmationModal isOpen={confirmDelete.isOpen} message="Are you sure you want to delete this book?" onConfirm={confirmDeletion} onCancel={cancelDeletion} />

            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-bold mb-2 md:mb-0">Your Library</h2>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-800 p-1 rounded-lg">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'list' ? activeClass : inactiveClass}`}>List</button>
                        <button onClick={() => setViewMode('gallery')} className={`px-3 py-1 rounded-md text-sm font-medium ${viewMode === 'gallery' ? activeClass : inactiveClass}`}>Gallery</button>
                    </div>
                    {viewMode === 'list' && !isBulkEditing && selectedPeriod !== 'All Time' && (
                        <button onClick={toggleBulkEdit} className="px-3 py-1 rounded-md text-sm font-medium bg-yellow-600 text-white">Bulk Edit</button>
                    )}
                </div>
            </div>

            {isBulkEditing && (
                <div className="flex justify-end gap-2 mb-4">
                    <button onClick={handleSaveBulkEdit} className="px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-md">Save All Changes</button>
                    <button onClick={toggleBulkEdit} className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md">Cancel</button>
                </div>
            )}

            <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                    {availablePeriods.map(period => (
                        <button
                            key={period}
                            onClick={() => handlePeriodSelect(period)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedPeriod === period ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            {displayedBooks.length === 0 ? (
                            <p className="text-gray-400">No books found for the selected period.</p>
                        ) : viewMode === 'gallery' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {displayedBooks.map(book => (
                                <button key={book.id} onClick={() => setLightboxBook(book)} className="focus:outline-none">
                                    <img 
                                        src={book.coverUrl} 
                                        alt={`Cover of ${book.title}`}
                                        className="w-full h-auto object-cover rounded-md shadow-lg transform hover:scale-105 transition-transform duration-300"
                                    />
                                </button>
                            ))}
                        </div>
                    ) : isBulkEditing ? (
                                <div className="space-y-3">
                                {bulkEditData.map((book, index) => (
                                        <div key={book.id} className="p-3 bg-gray-700 rounded-lg space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-10 gap-x-4 gap-y-2 items-end">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-400">Title</label>
                                                    <input type="text" value={book.title || ''} onChange={(e) => handleBulkEditChange(index, 'title', e.target.value)} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-400">Author</label>
                                                    <input type="text" value={book.author || ''} onChange={(e) => handleBulkEditChange(index, 'author', e.target.value)} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400">Country</label>
                                                     <select
                                                         value={book.isAddingNewCountry ? 'add-new' : book.country}
                                                         onChange={(e) => handleBulkEditChange(index, 'countrySelect', e.target.value)}
                                                         className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"
                                                     >
                                                         <option value={book.country} disabled>{book.country || 'Select Country'}</option>
                                                         {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
                                                         <option value="add-new">--- Add New ---</option>
                                                     </select>
                                                     {book.isAddingNewCountry && (
                                                         <input
                                                             type="text"
                                                             placeholder="New Country"
                                                             value={book.country}
                                                             onChange={(e) => handleBulkEditChange(index, 'country', e.target.value)}
                                                             className="w-full p-1 mt-1 bg-gray-500 rounded-md text-white"
                                                         />
                                                     )}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400">Type</label>
                                                     <select
                                                         value={book.isFiction}
                                                         onChange={(e) => handleBulkEditChange(index, 'isFiction', e.target.value)}
                                                         className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"
                                                     >
                                                         <option value={true}>Fiction</option>
                                                         <option value={false}>Non-Fiction</option>
                                                     </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-400">Genre</label>
                                                     <select
                                                         value={book.isAddingNewGenre ? 'add-new' : book.genre}
                                                         onChange={(e) => handleBulkEditChange(index, 'genreSelect', e.target.value)}
                                                         className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"
                                                     >
                                                         <option value={book.genre} disabled>{book.genre || 'Select Genre'}</option>
                                                         {(book.isFiction ? fictionGenres : nonFictionGenres).map(g => <option key={g} value={g}>{g}</option>)}
                                                         <option value="add-new">--- Add New Genre ---</option>
                                                     </select>
                                                     {book.isAddingNewGenre && (
                                                         <input
                                                             type="text"
                                                             placeholder="New Genre"
                                                             value={book.genre}
                                                             onChange={(e) => handleBulkEditChange(index, 'genre', e.target.value)}
                                                             className="w-full p-1 mt-1 bg-gray-500 rounded-md text-white"
                                                         />
                                                     )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">Month</label>
                                                         <select
                                                             value={book.readMonth ?? 0}
                                                             onChange={(e) => handleBulkEditChange(index, 'readMonth', parseInt(e.target.value))}
                                                             className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"
                                                         >
                                                             {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                         </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400">Pages</label>
                                                     <input
                                                         type="number"
                                                         value={book.pageCount || 0}
                                                         onChange={(e) => handleBulkEditChange(index, 'pageCount', parseInt(e.target.value) || 0)}
                                                         className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"
                                                     />
                                                </div>
                                            </div>
                                        </div>
                                ))}
                                </div>
                    ) : (
                        <div className="space-y-4 md:space-y-0 md:border-separate md:min-w-full" style={{ borderSpacing: '0 0.75rem' }}>
                            <div className="hidden md:table-header-group">
                                <div className="md:table-row">
                                    <div className="md:table-cell w-[4%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-center">#</div>
                                    <div className="md:table-cell w-[25%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Title</div>
                                    <div className="md:table-cell w-[15%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Author</div>
                                    <div className="md:table-cell w-[10%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Country</div>
                                    <div className="md:table-cell w-[10%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Type</div>
                                    <div className="md:table-cell w-[12%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Genre</div>
                                    <div className="md:table-cell w-[8%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Month</div>
                                    <div className="md:table-cell w-[6%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-left">Pages</div>
                                    <div className="md:table-cell w-[10%] px-3 py-2 text-xs font-bold text-gray-400 uppercase text-right">Actions</div>
                                </div>
                            </div>

                            <div className="md:table-row-group">
                            {displayedBooks.map((book, index) => {
                                const isEditing = editingBookId === book.id;
                                return isEditing ? (
                                    <div key={book.id} className="md:table-row"><div className="md:table-cell md:p-0" colSpan="9"><div className="p-3 bg-indigo-900 bg-opacity-50 rounded-lg space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-400">Title</label>
                                                <input type="text" name="title" value={editFormData.title} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Author</label>
                                                <input type="text" name="author" value={editFormData.author} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Type</label>
                                                <select name="isFiction" value={editFormData.isFiction} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white">
                                                       <option value={true}>Fiction</option>
                                                       <option value={false}>Non-Fiction</option>
                                                   </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Genre</label>
                                                <select name="genreSelect" value={isEditingNewGenre ? 'add-new' : editFormData.genre} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white">
                                                     <option value={editFormData.genre} disabled>{editFormData.genre}</option>
                                                     {(editFormData.isFiction ? fictionGenres : nonFictionGenres).map(g => <option key={g} value={g}>{g}</option>)}
                                                     <option value="add-new">--- Add New ---</option>
                                                 </select>
                                                 {isEditingNewGenre && (
                                                     <input type="text" name="genre" placeholder="New Genre" value={editFormData.genre} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-500 rounded-md text-white"/>
                                                 )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-400">Country</label>
                                                <input type="text" name="country" value={editFormData.country} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-400">Cover Image URL</label>
                                                <input type="text" name="coverUrl" value={editFormData.coverUrl} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                            </div>
                                            <div className="flex gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400">Date</label>
                                                    <div className="flex gap-1">
                                                        <select name="readMonth" value={editFormData.readMonth} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white">
                                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                        </select>
                                                        <input type="number" name="readYear" value={editFormData.readYear} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400">Pages</label>
                                                    <input type="number" name="pageCount" value={editFormData.pageCount} onChange={handleEditFormChange} className="w-full p-1 mt-1 bg-gray-600 rounded-md text-sm text-white"/>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleSaveEdit(book.id)} className="px-3 py-1 text-xs rounded bg-green-600 text-white">Save</button>
                                            <button onClick={handleCancelEdit} className="px-3 py-1 text-xs rounded bg-gray-600 text-white">Cancel</button>
                                        </div>
                                    </div></div></div>
                                ) : (
                                    <div
                                        key={book.id}
                                        className="bg-gray-800 rounded-lg p-4 flex flex-col gap-3 md:table-row md:p-0 md:bg-transparent hover:bg-gray-700 transition-colors duration-200 cursor-grab"
                                        draggable={selectedPeriod !== 'All Time'}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={handleDrop}
                                    >
                                        {/* Mobile Card Layout */}
                                        <div className="flex gap-4 md:hidden">
                                            <img src={book.coverUrl} alt={book.title} className="w-20 h-32 object-cover rounded-md flex-shrink-0"/>
                                            <div className="flex flex-col justify-between w-full">
                                                <div>
                                                    <h3 className="font-bold text-white text-lg">{book.title}</h3>
                                                    <p className="text-sm text-gray-400">{book.author}</p>
                                                    <p className="text-xs text-gray-500">{book.genre} &bull; {book.pageCount} pages</p>
                                                </div>
                                                <div className="flex gap-2 mt-2 self-end">
                                                    <button onClick={() => handleEditClick(book)} className="p-2 rounded-md hover:bg-gray-600" title="Edit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteRequest(book.id)} className="p-2 rounded-md hover:bg-gray-600" title="Delete">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop Table Cells */}
                                        <div className="hidden md:table-cell p-3 text-center font-bold text-gray-400 rounded-l-lg align-middle">{index + 1}</div>
                                        <div className="hidden md:table-cell p-3 align-middle">
                                            <div className="flex items-center gap-4">
                                                <img src={book.coverUrl} alt={book.title} className="w-10 h-16 object-cover rounded-md flex-shrink-0"/>
                                                <span className="font-bold text-white">{book.title}</span>
                                            </div>
                                        </div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{book.author}</div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{book.country || 'N/A'}</div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{book.isFiction ? 'Fiction' : 'Non-Fiction'}</div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{book.genre}</div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{new Date(book.readDate).toLocaleDateString('en-US', { month: 'short' })}</div>
                                        <div className="hidden md:table-cell p-3 text-sm text-gray-400 align-middle">{book.pageCount > 0 ? book.pageCount : 'N/A'}</div>
                                        <div className="hidden md:table-cell p-3 text-right rounded-r-lg align-middle">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditClick(book)} className="p-2 rounded-md hover:bg-gray-700" title="Edit">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteRequest(book.id)} className="p-2 rounded-md hover:bg-gray-700" title="Delete">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}

// --- Search Component ---
export function Search({ books, onCancel }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setResults([]);
            return;
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const searchResults = books.filter(book => {
            return (
                book.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                book.author.toLowerCase().includes(lowerCaseSearchTerm)
            );
        });
        setResults(searchResults);
    }, [searchTerm, books]);

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Search Your Library</h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by title or author..."
                    className="flex-grow p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div>
                {searchTerm.trim() && results.length > 0 ? (
                    <div className="space-y-3">
                        {results.map(book => (
                            <div key={book.id} className="flex items-start gap-4 p-3 bg-gray-700 rounded-lg">
                                <img src={book.coverUrl} alt={book.title} className="w-10 h-16 object-cover rounded-md flex-shrink-0"/>
                                <div>
                                    <p className="font-bold text-white">{book.title}</p>
                                    <p className="text-sm text-gray-400">{book.author}</p>
                                    <p className="text-xs text-gray-500">Read: {new Date(book.readDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : searchTerm.trim() && results.length === 0 ? (
                    <p className="text-center text-gray-400">No books found matching your search.</p>
                ) : (
                    <p className="text-center text-gray-400">Start typing to see results.</p>
                )}
            </div>
        </div>
    );
}
