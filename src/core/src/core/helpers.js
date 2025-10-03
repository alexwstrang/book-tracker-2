// src/core/helpers.js

// --- Helper Functions ---
export const parseGenre = (categories) => {
    if (!categories || categories.length === 0) return 'General';

    const forbiddenTerms = ['fiction', 'non-fiction', 'general', 'biography & autobiography', 'comics & graphic novels', 'books'];
    let potentialGenres = [];

    for (const category of categories) {
        const parts = category.split(/ \/ | > /);
        for (const part of parts) {
            const cleanPart = part.trim();
            if (cleanPart && !forbiddenTerms.includes(cleanPart.toLowerCase())) {
                potentialGenres.push(cleanPart);
            }
        }
    }

    return potentialGenres.length > 0 ? potentialGenres[potentialGenres.length - 1] : 'General';
};

export const isNonFiction = (categories) => {
    if (!categories || categories.length === 0) return false;
    const nonFictionKeywords = ['biography', 'autobiography', 'history', 'science', 'business', 'psychology', 'self-help', 'memoir', 'true crime', 'nonfiction'];
    const categoryString = categories.join(' ').toLowerCase();
    return nonFictionKeywords.some(keyword => categoryString.includes(keyword));
};

export const sanitizeIsbn = (isbn) => {
    return isbn.replace(/[-\s]/g, '');
};
