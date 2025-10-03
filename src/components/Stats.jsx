// src/components/Stats.jsx

// Global React hooks from CDN
const { useState, useEffect, useMemo } = React;

// Core Modules
// No specific local imports needed, all data comes from the parent props.
// We rely on the globally available Chart object (Chart.js CDN)

// --- Country Books Modal Component ---
function CountryBooksModal({ isOpen, country, books, onClose }) {
    if (!isOpen) return null;

    const sortedBooks = useMemo(() => {
        return [...books].sort((a, b) => new Date(b.readDate) - new Date(a.readDate));
    }, [books]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Books from {country}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
                    {sortedBooks.length > 0 ? sortedBooks.map(book => (
                        <div key={book.id} className="flex items-start gap-4 p-3 bg-gray-700 rounded-lg">
                            <img src={book.coverUrl} alt={book.title} className="w-12 h-20 object-cover rounded-md flex-shrink-0"/>
                            <div>
                                <p className="font-bold text-white">{book.title}</p>
                                <p className="text-sm text-gray-300">{book.author}</p>
                                <p className="text-xs text-gray-500">Read in {new Date(book.readDate).getFullYear()}</p>
                            </div>
                        </div>
                    )) : (
                        <p className="text-gray-400">No books found for this country.</p>
                    )}
                </div>
                <button onClick={onClose} className="mt-2 ml-auto px-4 py-2 bg-indigo-600 text-white rounded-md">Close</button>
            </div>
        </div>
    );
}

// --- Decade Books Modal Component ---
function DecadeBooksModal({ isOpen, decade, books, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Books from the {decade}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
                    {books.length > 0 ? books.map(book => (
                        <div key={book.id} className="flex items-start gap-4 p-3 bg-gray-700 rounded-lg">
                            <img src={book.coverUrl} alt={book.title} className="w-12 h-20 object-cover rounded-md flex-shrink-0"/>
                            <div>
                                <p className="font-bold text-white">{book.title}</p>
                                <p className="text-sm text-gray-300">{book.author}</p>
                                <p className="text-xs text-gray-500">Published in {book.publicationYear}</p>
                            </div>
                        </div>
                    )) : (
                        <p className="text-gray-400">No books found for this decade.</p>
                    )}
                </div>
                <button onClick={onClose} className="mt-2 ml-auto px-4 py-2 bg-indigo-600 text-white rounded-md">Close</button>
            </div>
        </div>
    );
}

// --- Stats Component ---
export function Stats({ books, loading }) {
    const [year, setYear] = useState('All Time');
    const [modalData, setModalData] = useState({ isOpen: false, country: '', books: [] });
    const [decadeModalData, setDecadeModalData] = useState({ isOpen: false, decade: '', books: [] });

    // This is imported from the core/config.js in main.jsx but must be declared here if accessed directly
    const YEARLY_GOAL = 52; 

    const availableYears = useMemo(() => {
        const years = new Set(books.map(b => b.readYear).filter(y => y));
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        return ['All Time', ...Array.from(years).sort((a, b) => b - a)];
    }, [books]);

    const stats = useMemo(() => {
        const filteredBooks = year === 'All Time' ? books : books.filter(b => b.readYear === year);
        if (filteredBooks.length === 0) return null;

        const booksWithPages = filteredBooks.filter(b => b.pageCount > 0);
        const totalPagesRead = filteredBooks.reduce((acc, book) => acc + Number(book.pageCount || 0), 0);
        const averagePageCount = booksWithPages.length > 0 ? Math.round(totalPagesRead / booksWithPages.length) : 0;
        const shortestBook = booksWithPages.length > 0 ? [...booksWithPages].sort((a, b) => a.pageCount - b.pageCount)[0] : null;
        const longestBook = booksWithPages.length > 0 ? [...booksWithPages].sort((a, b) => b.pageCount - a.pageCount)[0] : null;

        const fictionCount = filteredBooks.filter(b => b.isFiction).length;
        const nonfictionCount = filteredBooks.length - fictionCount;

        const fictionGenreCounts = filteredBooks
            .filter(b => b.isFiction)
            .reduce((acc, book) => {
                if (book.genre) acc[book.genre] = (acc[book.genre] || 0) + 1;
                return acc;
            }, {});

        const nonFictionGenreCounts = filteredBooks
            .filter(b => !b.isFiction)
            .reduce((acc, book) => {
                if (book.genre) acc[book.genre] = (acc[book.genre] || 0) + 1;
                return acc;
            }, {});

        const authorCounts = filteredBooks.reduce((acc, book) => {
            acc[book.author] = (acc[book.author] || 0) + 1;
            return acc;
        }, {});

        const topAuthors = Object.entries(authorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const uniqueAuthors = new Set(filteredBooks.map(b => b.author)).size;

        const monthlyCounts = Array(12).fill(0);
        const pagesPerMonth = Array(12).fill(0);
        if (year !== 'All Time') {
            filteredBooks.forEach(book => {
                const month = new Date(book.readDate).getMonth();
                monthlyCounts[month]++;
                pagesPerMonth[month] += Number(book.pageCount || 0);
            });
        }

        const booksByDecade = filteredBooks.reduce((acc, book) => {
            if (book.publicationYear && !isNaN(book.publicationYear)) {
                const decade = Math.floor(book.publicationYear / 10) * 10;
                acc[decade] = (acc[decade] || 0) + 1;
            }
            return acc;
        }, {});

        const booksByCountry = filteredBooks.reduce((acc, book) => {
            if (book.country) {
                acc[book.country] = (acc[book.country] || 0) + 1;
            }
            return acc;
        }, {});

        return {
            total: filteredBooks.length, totalPagesRead, fictionCount, nonfictionCount, fictionGenreCounts, nonFictionGenreCounts,
            topAuthors,
            monthlyCounts, pagesPerMonth, averagePageCount, shortestBook, longestBook, uniqueAuthors, booksByDecade, booksByCountry
        };
    }, [year, books]);

    useEffect(() => {
        let pieChart, fictionGenreChart, nonFictionGenreChart, lineChart, decadeChart, countryChart;
        const chartInstances = [];
        // Chart is globally available because of the CDN import in index.html

        if (stats) {
            const pieCtx = document.getElementById('pie-chart')?.getContext('2d');
            if (pieCtx) {
                pieChart = new Chart(pieCtx, {
                    type: 'pie',
                    data: {
                        labels: ['Fiction', 'Non-Fiction'],
                        datasets: [{ data: [stats.fictionCount, stats.nonfictionCount], backgroundColor: ['#818cf8', '#f87171'], borderColor: '#1f2937' }]
                    },
                    options: { plugins: { legend: { labels: { color: 'white' }}}}
                });
                chartInstances.push(pieChart);
            }

            const fictionCtx = document.getElementById('fiction-genre-chart')?.getContext('2d');
            if (fictionCtx && Object.keys(stats.fictionGenreCounts).length > 0) {
                const sortedGenres = Object.entries(stats.fictionGenreCounts).sort((a, b) => b[1] - a[1]);
                fictionGenreChart = new Chart(fictionCtx, {
                    type: 'bar',
                    data: {
                        labels: sortedGenres.map(item => item[0]),
                        datasets: [{ label: 'Books per Genre', data: sortedGenres.map(item => item[1]), backgroundColor: '#818cf8' }]
                    },
                    options: { scales: { y: { ticks: { color: 'white', stepSize: 1 }, grid: { color: '#4b5563' } }, x: { ticks: { color: 'white' } } }, plugins: { legend: { display: false }} }
                });
                chartInstances.push(fictionGenreChart);
            }

            const nonfictionCtx = document.getElementById('nonfiction-genre-chart')?.getContext('2d');
            if (nonfictionCtx && Object.keys(stats.nonFictionGenreCounts).length > 0) {
                const sortedGenres = Object.entries(stats.nonFictionGenreCounts).sort((a, b) => b[1] - a[1]);
                nonFictionGenreChart = new Chart(nonfictionCtx, {
                    type: 'bar',
                    data: {
                        labels: sortedGenres.map(item => item[0]),
                        datasets: [{ label: 'Books per Genre', data: sortedGenres.map(item => item[1]), backgroundColor: '#f87171' }]
                    },
                    options: { scales: { y: { ticks: { color: 'white', stepSize: 1 }, grid: { color: '#4b5563' } }, x: { ticks: { color: 'white' } } }, plugins: { legend: { display: false }} }
                });
                chartInstances.push(nonFictionGenreChart);
            }

            if (year !== 'All Time') {
                const lineCtx = document.getElementById('line-chart')?.getContext('2d');
                if(lineCtx) {
                    lineChart = new Chart(lineCtx, {
                        type: 'line',
                        data: {
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                            datasets: [{ label: 'Pages Read per Month', data: stats.pagesPerMonth, borderColor: '#818cf8', tension: 0.1 }]
                        },
                        options: { scales: { y: { ticks: { color: 'white' }, grid: { color: '#4b5563' } }, x: { ticks: { color: 'white' } } }, plugins: { legend: { display: false }} }
                    });
                    chartInstances.push(lineChart);
                }
            }

            const decadeCtx = document.getElementById('decade-chart')?.getContext('2d');
            if (decadeCtx) {
                const sortedDecades = Object.keys(stats.booksByDecade).sort();
                decadeChart = new Chart(decadeCtx, {
                    type: 'bar',
                    data: {
                        labels: sortedDecades.map(d => `${d}s`),
                        datasets: [{ label: 'Books by Decade', data: sortedDecades.map(d => stats.booksByDecade[d]), backgroundColor: '#818cf8' }]
                    },
                    options: {
                        onClick: (event, elements, chart) => {
                            if (elements.length > 0) {
                                const elementIndex = elements[0].index;
                                const clickedDecadeLabel = chart.data.labels[elementIndex];
                                const clickedDecade = parseInt(clickedDecadeLabel);
                                const filteredBooks = year === 'All Time' ? books : books.filter(b => b.readYear === year);
                                const booksFromDecade = filteredBooks.filter(book => book.publicationYear && Math.floor(book.publicationYear / 10) * 10 === clickedDecade);

                                setDecadeModalData({
                                    isOpen: true,
                                    decade: clickedDecadeLabel,
                                    books: booksFromDecade
                                });
                            }
                        },
                        onHover: (event, chartElement) => {
                            const canvas = event.native.target;
                            canvas.style.cursor = chartElement[0] ? 'pointer' : 'default';
                        },
                        scales: { y: { ticks: { color: 'white', stepSize: 1 }, grid: { color: '#4b5563' } }, x: { ticks: { color: 'white' } } }, 
                        plugins: { legend: { display: false }}
                    }
                });
                chartInstances.push(decadeChart);
            }

            const countryCtx = document.getElementById('country-chart')?.getContext('2d');
            if (countryCtx) {
                countryChart = new Chart(countryCtx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(stats.booksByCountry),
                        datasets: [{ data: Object.values(stats.booksByCountry) }]
                    },
                    options: {
                        onClick: (event, elements, chart) => {
                            if (elements.length > 0) {
                                const elementIndex = elements[0].index;
                                const clickedCountry = chart.data.labels[elementIndex];
                                const booksFromCountry = books.filter(book => book.country === clickedCountry);

                                setModalData({
                                    isOpen: true,
                                    country: clickedCountry,
                                    books: booksFromCountry
                                });
                            }
                        },
                        onHover: (event, chartElement) => {
                            const canvas = event.native.target;
                            canvas.style.cursor = chartElement[0] ? 'pointer' : 'default';
                        },
                        plugins: { legend: { labels: { color: 'white' }}}
                    }
                });
                chartInstances.push(countryChart);
            }
        }

        return () => {
            chartInstances.forEach(chart => {
                if (chart) chart.destroy();
            });
        };
    }, [stats, books, year]);

    const handleCloseModal = () => setModalData({ isOpen: false, country: '', books: [] });
    const handleCloseDecadeModal = () => setDecadeModalData({ isOpen: false, decade: '', books: [] });

    if (loading) return <p>Loading stats...</p>;

    return (
        <div>
            <CountryBooksModal
                isOpen={modalData.isOpen}
                country={modalData.country}
                books={modalData.books}
                onClose={handleCloseModal}
            />
            <DecadeBooksModal
                isOpen={decadeModalData.isOpen}
                decade={decadeModalData.decade}
                books={decadeModalData.books}
                onClose={handleCloseDecadeModal}
            />
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold">Statistics for</h2>
                <select value={year} onChange={e => setYear(e.target.value === 'All Time' ? 'All Time' : Number(e.target.value))} className="p-2 bg-gray-700 rounded-md">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {!stats ? (
                <p className="text-gray-400">No books read for this period. Add one to see your stats!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-4 bg-gray-800 rounded-lg"><h3 className="font-bold text-lg mb-2">Total Books Read</h3><p className="text-5xl font-bold text-indigo-400">{stats.total}</p></div>
                    <div className="p-4 bg-gray-800 rounded-lg"><h3 className="font-bold text-lg mb-2">Total Pages Read</h3><p className="text-5xl font-bold text-indigo-400">{stats.totalPagesRead.toLocaleString()}</p></div>
                    <div className="p-4 bg-gray-800 rounded-lg"><h3 className="font-bold text-lg mb-2">Avg. Book Length</h3><p className="text-5xl font-bold text-indigo-400">{stats.averagePageCount.toLocaleString()} pgs</p></div>
                    <div className="p-4 bg-gray-800 rounded-lg"><h3 className="font-bold text-lg mb-2">Unique Authors</h3><p className="text-5xl font-bold text-indigo-400">{stats.uniqueAuthors}</p></div>

                    <div className="md:col-span-2 p-4 bg-gray-800 rounded-lg">
                        <h3 className="font-bold text-lg mb-4">Top Authors</h3>
                        {stats.topAuthors.length > 0 ? (
                            <ol className="space-y-3">
                                {stats.topAuthors.map(([author, count], index) => (
                                    <li key={author} className="flex justify-between items-baseline text-sm">
                                        <span className="flex items-center truncate">
                                            <span className="text-gray-400 font-bold w-7 text-left">{index + 1}.</span>
                                            <span className="text-white truncate" title={author}>{author}</span>
                                        </span>
                                        <span className="font-mono text-indigo-400 flex-shrink-0 ml-2">{count} {count > 1 ? 'books' : 'book'}</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-gray-400">No authors to display.</p>
                        )}
                    </div>

                    <div className="p-4 bg-gray-800 rounded-lg flex gap-4 items-start">
                        <img src={stats.shortestBook?.coverUrl} className="w-1/3 h-auto object-cover rounded-md"/>
                        <div className="flex-grow">
                            <h3 className="font-bold text-lg mb-2">Shortest Book</h3>
                            <p className="text-xl font-bold text-indigo-400">{stats.shortestBook?.title || 'N/A'}</p>
                            <p className="text-sm text-gray-400">{stats.shortestBook?.pageCount} pgs</p>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-800 rounded-lg flex gap-4 items-start">
                        <img src={stats.longestBook?.coverUrl} className="w-1/3 h-auto object-cover rounded-md"/>
                        <div className="flex-grow">
                            <h3 className="font-bold text-lg mb-2">Longest Book</h3>
                            <p className="text-xl font-bold text-indigo-400">{stats.longestBook?.title || 'N/A'}</p>
                            <p className="text-sm text-gray-400">{stats.longestBook?.pageCount} pgs</p>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-800 rounded-lg lg:col-span-2"><h3 className="font-bold text-lg mb-2">Fiction vs. Non-Fiction</h3><canvas id="pie-chart"></canvas></div>
                    <div className="p-4 bg-gray-800 rounded-lg lg:col-span-2"><h3 className="font-bold text-lg mb-2">Books by Decade</h3><canvas id="decade-chart"></canvas></div>
                    <div className="p-4 bg-gray-800 rounded-lg md:col-span-2"><h3 className="font-bold text-lg mb-2">Books by Country</h3><canvas id="country-chart"></canvas></div>

                    <div className="p-4 bg-gray-800 rounded-lg md:col-span-2 lg:col-span-4">
                        <h3 className="font-bold text-lg mb-2">Monthly Reading Pace (Pages)</h3>
                        <canvas id="line-chart"></canvas>
                    </div>
                </div>
            )}
        </div>
    );
}
