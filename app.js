document.addEventListener('DOMContentLoaded', () => {
    let genAI; // This will hold the initialized Gemini client
    // --- State Management ---
    let decks = [];
    let conversations = [];
    let newDeckData = { title: '', description: '', words: [], type: 'Vocabulary' };
    let currentDeckState = { deck: null, currentWord: null, homeWord: null };
    let currentEditDeckId = null;
    let activeMenu = { element: null, type: null }; // Unified menu/popover state
    let activeConversationId = null;
    let editingMessageId = null;
    
    // API and Chat State
    let groqApiKey = '';
    let geminiApiKey = '';
    let unsplashApiKey = '';
    let omdbApiKey = '';

// UI State
    let lastActiveScreen = null;
let activeDeckFilter = 'all'; // Default to show all decks

    // Movie State
    let movies = [];
    let currentMovieId = null;
    let foundMovieData = null;

    


    // Quiz State
    let currentQuiz = [];
    let currentQuestionIndex = 0;
    let quizScore = 0;
    let quizDeckId = null;
    let userQuizAnswers = [];
    let deckViewMode = 'flashcard';
    let currentMcChoice = null; // For Multiple Choice selection


    // --- Element Selections ---
    const mainAppContainer = document.getElementById('main-app-container');
    const allModals = document.querySelectorAll('.screen-modal');
    const screens = {
        home: document.getElementById('home-screen'),
        decks: document.getElementById('decks-screen'),
        viewDeck: document.getElementById('view-deck-screen'),
        settings: document.getElementById('settings-screen'),
        chat: document.getElementById('chat-screen'),
        createDeck: document.getElementById('create-deck-screen'),
        addWordsManually: document.getElementById('add-words-manually-screen'),
        testType: document.getElementById('test-type-screen'),
        deckType: document.getElementById('deck-type-screen'), // New screen added
        quiz: document.getElementById('quiz-screen'),
        mcQuiz: document.getElementById('mc-quiz-screen'), // Multiple Choice Quiz Screen
        quizReview: document.getElementById('quiz-review-screen'),
        
        // Movie Screen Selectors
        movieList: document.getElementById('movie-list-screen'),
        addMovie: document.getElementById('add-movie-modal'),
        movieDetail: document.getElementById('movie-detail-screen'),
        moviePlayer: document.getElementById('movie-player-screen'),
    };
    const allMainScreens = [screens.home, screens.decks, screens.viewDeck, screens.settings, screens.chat, screens.movieList];
    const navLinks = { 
        home: document.getElementById('nav-home'), 
        decks: document.getElementById('nav-decks'),
        chat: document.getElementById('nav-chat'),
        movie: document.getElementById('nav-movie'),
        settings: document.getElementById('nav-settings' )
    };
    
    const mainSearchInput = document.getElementById('main-search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const defaultDecksView = document.getElementById('default-decks-view');

    // --- API Key & Theme Management ---
    function saveApiKeyToStorage(key, provider) {
        localStorage.setItem(`wordwise${provider}ApiKey`, key);
    }
    function loadApiKeysFromStorage() {
        groqApiKey = localStorage.getItem('wordwiseGroqApiKey') || '';
        geminiApiKey = localStorage.getItem('wordwiseGeminiApiKey') || '';
        unsplashApiKey = localStorage.getItem('wordwiseUnsplashApiKey') || '';
        
        // Initialize the Gemini AI client if a key exists
        if (geminiApiKey && window.GoogleGenerativeAI) {
            genAI = new window.GoogleGenerativeAI(geminiApiKey);
        }

        const groqInput = document.getElementById('groq-api-key-input');
        const geminiInput = document.getElementById('gemini-api-key-input');
        const unsplashInput = document.getElementById('unsplash-api-key-input');
        const omdbInput = document.getElementById('omdb-api-key-input');
        if(groqInput) groqInput.value = groqApiKey;
        if(geminiInput) geminiInput.value = geminiApiKey;
        if(unsplashInput) unsplashInput.value = unsplashApiKey;
        if(omdbInput) omdbInput.value = omdbApiKey;

        // Load OMDb API key
        omdbApiKey = localStorage.getItem('wordwiseOmdbApiKey') || '';
    }
    function applySavedTheme() {
        const savedTheme = localStorage.getItem('wordwiseTheme');
        const themeIcon = document.getElementById('theme-icon');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark-theme');
            if (themeIcon) themeIcon.className = 'ph ph-sun';
        } else {
            document.documentElement.classList.remove('dark-theme');
            if (themeIcon) themeIcon.className = 'ph ph-moon';
        }
    }

    // --- Data Persistence ---
    function loadDecksFromStorage() {
    const decksJSON = localStorage.getItem('wordwiseDecks');
    let loadedDecks = decksJSON ? JSON.parse(decksJSON) : [];
    let needsSave = false;

    // --- Data Migration Logic ---
    loadedDecks.forEach(deck => {
        if (deck.words && deck.words.length > 0) {
            // Check if the first word is a simple string (old format) or an object without the new 'definitions' key.
            if (typeof deck.words[0] === 'string' || !deck.words[0].hasOwnProperty('definitions')) {
                needsSave = true;
                deck.words = deck.words.map(word => {
                    const wordText = typeof word === 'string' ? word : word.text;
                    // Create the new, comprehensive word object structure
                    return {
                        text: wordText,
                        masteryLevel: word.masteryLevel || 0,
                        lastSeen: word.lastSeen || null,
                        imageUrl: null, // To be fetched
                        definitions: {
                            flashcard: null, // To be fetched
                            detailed: null,  // To be fetched
                            gemini: null     // To be fetched
                        }
                    };
                });
            }
        }
    });

    decks = loadedDecks;
    if (needsSave) {
        console.log("Migrating word data to new structure. Saving changes.");
        saveDecksToStorage();
    }
}
    function saveDecksToStorage() {
        localStorage.setItem('wordwiseDecks', JSON.stringify(decks));
    }
    function loadConversationsFromStorage() {
        const convosJSON = localStorage.getItem('wordwiseConversations');
        conversations = convosJSON ? JSON.parse(convosJSON) : [];
    }
    function saveConversationsToStorage() {
        localStorage.setItem('wordwiseConversations', JSON.stringify(conversations));
    }
    function saveConversationsToStorage() {
        localStorage.setItem('wordwiseConversations', JSON.stringify(conversations));
    }

    function loadMoviesFromStorage() {
        const moviesJSON = localStorage.getItem('wordwiseMovies');
        movies = moviesJSON ? JSON.parse(moviesJSON) : [];
    }

    function saveMoviesToStorage() {
        localStorage.setItem('wordwiseMovies', JSON.stringify(movies));
    }
// ========================================================================
// --- MOVIE FEATURE LOGIC ---
// ========================================================================

function renderMovies(movieArray = movies) {
    const defaultGrid = document.getElementById('movie-grid');
    const searchGrid = document.getElementById('movie-search-results-container');
    const container = (movieArray === movies) ? defaultGrid : searchGrid;
    container.innerHTML = '';

    movieArray.forEach(movie => {
        const movieCardHTML = `
            <div class="movie-card" data-id="${movie.id}">
                <div class="movie-card-poster-wrapper">
                    <div class="movie-card-poster" style="background-image: url('${movie.poster}')"></div>
                </div>
                <div class="movie-card-title-wrapper">
                    <p class="movie-card-title">${movie.title}</p>
                    <div class="options-container">
                        <button class="options-button movie-options-btn"><i class="ph ph-dots-three-vertical"></i></button>
                        <div class="options-menu">
                            <a href="#" class="option-item upload-srt-btn">Upload SRT</a>
                            <a href="#" class="option-item create-deck-from-movie-btn">Create Deck</a>
                            <a href="#" class="option-item delete-movie-btn" style="color: #ef4444;">Delete</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', movieCardHTML);
    });
}

function handleMovieSearch() {
    const query = document.getElementById('movie-list-search-input').value.trim().toLowerCase();
    const searchResultsContainer = document.getElementById('movie-search-results-container');
    const defaultMoviesView = document.getElementById('default-movies-view');

    if (query.length === 0) {
        searchResultsContainer.style.display = 'none';
        defaultMoviesView.style.display = 'block';
        searchResultsContainer.innerHTML = '';
        renderMovies();
        return;
    }

    searchResultsContainer.style.display = 'grid';
    searchResultsContainer.className = 'movie-grid-container';
    defaultMoviesView.style.display = 'none';
    
    const matchingMovies = movies.filter(movie => 
        movie.title.toLowerCase().includes(query)
    );
    
    renderMovies(matchingMovies);
}

async function handleOMDbSearch() {
    const title = document.getElementById('movie-search-input').value.trim();
    if (!title) return;
    if (!omdbApiKey) {
        alert('Please add your OMDb API Key in the Settings tab.');
        return;
    }

    const statusEl = document.getElementById('movie-search-status');
    statusEl.textContent = 'Searching...';
    document.getElementById('api-search-result').style.display = 'none';
    document.getElementById('manual-entry-form').style.display = 'none';

    try {
        const response = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbApiKey}`);
        const data = await response.json();

        if (data.Response === "True") {
            statusEl.textContent = 'Movie found!';
            foundMovieData = { id: data.imdbID, title: data.Title, description: data.Plot, poster: data.Poster, year: data.Year };
            document.getElementById('api-result-poster').src = foundMovieData.poster;
            document.getElementById('api-result-title').textContent = foundMovieData.title;
            document.getElementById('api-result-year').textContent = foundMovieData.year;
            document.getElementById('api-search-result').style.display = 'block';
        } else {
            statusEl.textContent = `Movie not found. Please enter details manually.`;
            foundMovieData = null;
            document.getElementById('manual-entry-form').style.display = 'block';
        }
    } catch (error) {
        console.error('OMDb API Error:', error);
        statusEl.textContent = 'Error during search. Please enter details manually.';
        foundMovieData = null;
        document.getElementById('manual-entry-form').style.display = 'block';
    }
}

function handleAddMovieSubmit() {
    
    let newMovie;
    const now = new Date().toISOString();

    if (foundMovieData) {
        newMovie = { 
            ...foundMovieData, 
            srtContent: null,
            createdAt: now,
            lastSeen: null
        };
    } else {
        const title = document.getElementById('manual-movie-title').value.trim();
        if (!title) {
            alert('Please enter a title for the movie.');
            return;
        }
        newMovie = {
            id: 'manual_' + Date.now(),
            title: title,
            description: document.getElementById('manual-movie-description').value,
            poster: document.getElementById('manual-movie-poster').value,
            srtContent: null,
            createdAt: now,
            lastSeen: null
        };
    }
    
    movies.unshift(newMovie);
    saveMoviesToStorage();
    renderMovies();
    closeAllModals();
}

function showMovieDetail(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;

    // Set the lastSeen timestamp and save
    movie.lastSeen = new Date().toISOString();
    saveMoviesToStorage();

    currentMovieId = movieId;

    document.getElementById('movie-detail-title').textContent = movie.title;
    document.getElementById('movie-detail-poster').style.backgroundImage = `url('${movie.poster}')`;
    document.getElementById('movie-detail-description').textContent = movie.description;
    showModal(screens.movieDetail);
}

function parseSrt(srtContent) {
    if (!srtContent) return [];
    const subtitleBlocks = srtContent.trim().split(/\n\n/);
    return subtitleBlocks.map(block => {
        const lines = block.split('\n');
        if (lines.length < 2) return null;
        return { number: lines[0], timestamp: lines[1], text: lines.slice(2).join(' ') };
    }).filter(Boolean);
}

function playSubtitles() {
    const movie = movies.find(m => m.id === currentMovieId);
    if (!movie) return;

    document.getElementById('movie-player-title').textContent = movie.title;
    const container = document.getElementById('subtitle-player-container');
    container.innerHTML = '';

    if (!movie.srtContent) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding: 2rem;">No subtitles have been uploaded for this movie yet.</p>`;
        showModal(screens.moviePlayer);
        return;
    }

    const subtitles = parseSrt(movie.srtContent);
    // Find the deck associated with this movie
    const movieDeck = decks.find(d => d.title === movie.title && d.type === 'Subtitle');
    // Create a Set of existing word texts for fast lookups
    const existingWords = movieDeck ? new Set(movieDeck.words.map(w => w.text.toLowerCase())) : new Set();

    subtitles.forEach(line => {
        const lineEl = document.createElement('div');
        lineEl.className = 'subtitle-line';
        
        const isAdded = existingWords.has(line.text.toLowerCase());
        const buttonHTML = isAdded 
            ? `<button class="subtitle-add-btn" title="Already added" disabled><i class="ph ph-check"></i></button>`
            : `<button class="subtitle-add-btn" title="Add to deck"><i class="ph ph-plus"></i></button>`;

        lineEl.innerHTML = `
            <div class="subtitle-line-number">${line.number}</div>
            <div class="subtitle-line-text">${line.text}</div>
            ${buttonHTML}
        `;

        if (!isAdded) {
            const btn = lineEl.querySelector('.subtitle-add-btn');
            btn.dataset.text = line.text;
            btn.dataset.timestamp = line.timestamp; // Store the timestamp
        }
        
        container.appendChild(lineEl);
    });
    showModal(screens.moviePlayer);
}

function handleSrtUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentMovieId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const movie = movies.find(m => m.id === currentMovieId);
        if (movie) {
            movie.srtContent = e.target.result;
            saveMoviesToStorage();
            alert(`Subtitles uploaded for "${movie.title}"`);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
function handleDeleteMovie(movieId) {
    const movieToDelete = movies.find(m => m.id === movieId);
    if (!movieToDelete) return;

    if (confirm(`Are you sure you want to delete the movie "${movieToDelete.title}"? This cannot be undone.`)) {
        movies = movies.filter(m => m.id !== movieId);
        saveMoviesToStorage();
        renderMovies(); // Re-render the movie list to reflect the deletion
    }
}
function addSubtitleToDeck(subtitleText, subtitleTimestamp, buttonElement) {
    const movie = movies.find(m => m.id === currentMovieId);
    if (!movie) return;
    let movieDeck = decks.find(d => d.title === movie.title && d.type === 'Subtitle');

    if (!movieDeck) {
        movieDeck = {
            id: 'deck_' + movie.id,
            title: movie.title,
            description: `Subtitles and expressions from the movie ${movie.title}.`,
            words: [],
            type: 'Subtitle',
            imageUrl: movie.poster,
            createdAt: new Date().toISOString()
        };
        decks.unshift(movieDeck);
    }

    const newWordObject = {
        ...createPlaceholderWordObjects([subtitleText])[0],
        timestamp: subtitleTimestamp // Add the timestamp to the word object
    };
    if (!movieDeck.words.some(w => w.text.toLowerCase() === newWordObject.text.toLowerCase())) {
         movieDeck.words.push(newWordObject);
         saveDecksToStorage();
         applyDeckFilters();
         alert(`Added to deck "${movie.title}"!`);

         // Disable the button and provide immediate visual feedback
         if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.title = "Added";
            buttonElement.innerHTML = `<i class="ph ph-check"></i>`;
         }
    } else {
        alert('This line is already in the deck.');
    }
}
    // ========================================================================
// --- SRS (SPACED REPETITION SYSTEM) LOGIC ---
// ========================================================================
const masteryIntervalsDays = [1, 3, 7, 14, 30, 90, 180];

function selectNextWord(deck) {
    if (!deck || !deck.words || deck.words.length === 0) return null;
    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // 1. Unseen words (randomly pick one)
    const unseenWords = deck.words.filter(word => word.lastSeen === null);
    if (unseenWords.length > 0) {
        return unseenWords[Math.floor(Math.random() * unseenWords.length)];
    }

    // 2. Due words (pick the most overdue one)
    const dueWords = deck.words.map(word => {
        const intervalDays = masteryIntervalsDays[Math.min(word.masteryLevel, masteryIntervalsDays.length - 1)];
        const reviewDueDate = word.lastSeen + (intervalDays * oneDayInMs);
        const timeUntilDue = reviewDueDate - now;
        return { ...word, timeUntilDue };
    }).filter(word => word.timeUntilDue <= 0);

    if (dueWords.length > 0) {
        dueWords.sort((a, b) => a.timeUntilDue - b.timeUntilDue);
        return dueWords[0];
    }

    // 3. FALLBACK for endless loop: Pick the least recently seen word.
    const allWordsSorted = [...deck.words].sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0));
    return allWordsSorted[0];
}

function updateWordMastery(wordObject, knewIt) {
    if (!wordObject) return;
    if (knewIt) {
        wordObject.masteryLevel = Math.min(wordObject.masteryLevel + 1, masteryIntervalsDays.length - 1);
    } else {
        wordObject.masteryLevel = Math.max(0, wordObject.masteryLevel - 1);
    }
    wordObject.lastSeen = Date.now();
}
function calculateDeckStudyScore(deck) {
    if (!deck || !deck.words || deck.words.length === 0) {
        return 0; // No words, no progress
    }
    
    const maxMastery = masteryIntervalsDays.length - 1;
    let totalMasteryPoints = 0;

    deck.words.forEach(word => {
        totalMasteryPoints += word.masteryLevel;
    });

    const maxPossiblePoints = deck.words.length * maxMastery;

    if (maxPossiblePoints === 0) {
        return 0; // Avoid division by zero if maxMastery is 0 for some reason
    }

    const percentage = (totalMasteryPoints / maxPossiblePoints) * 100;
    return Math.round(percentage); // Return a clean integer percentage
}
function selectPrioritizedWordsForQuiz(deck, count = 10) {
    if (!deck || !deck.words || deck.words.length === 0) return [];
    const scoredWords = deck.words.map(word => {
        const masteryScore = word.masteryLevel * 1000;
        const timeScore = (Date.now() - (word.lastSeen || 0)) / (1000 * 60);
        const score = masteryScore - timeScore;
        return { text: word.text, score };
    });
    scoredWords.sort((a, b) => a.score - b.score);
    return scoredWords.slice(0, count).map(w => w.text);
}
function applyDeckFilters() {
    let filteredDecks = [...decks]; // Create a copy to avoid modifying the original array

    switch (activeDeckFilter) {
        case 'recent':
            // Sort by lastSeen date, most recent first. Decks never seen go to the end.
            filteredDecks.sort((a, b) => (new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0)));
            break;
        case 'alpha':
            // Sort by title, A-Z
            filteredDecks.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'newest':
            // Sort by creation date, newest first
            filteredDecks.sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)));
            break;
        case 'Vocabulary':
        case 'Expressions':
        case 'Subtitle':
            // Filter by type
            filteredDecks = filteredDecks.filter(deck => deck.type === activeDeckFilter);
            break;
        case 'all':
        default:
            // Do nothing, show all decks in their default order
            break;
    }
    
    renderAllDecks(filteredDecks);
}

// --- UI Rendering ---
function renderAllDecks(decksToRender = decks) {
    const homeContainer = document.getElementById('home-decks-container');
    const gridContainer = document.getElementById('decks-grid-container');
    
    homeContainer.innerHTML = ''; 
    gridContainer.innerHTML = '';

    const viewAllCardHTML = `<div class="deck-card" id="view-all-decks-btn"><div class="deck-card-special-image"><i class="ph ph-arrow-right"></i></div><p class="deck-card-title">View All</p></div>`;

    decksToRender.forEach(deck => {
        const wordCount = deck.words ? deck.words.length : 0;
        const deckTypeRaw = deck.type || 'Vocabulary';
        const typeMap = { 'Vocabulary': 'Voc', 'Expressions': 'Exp', 'Subtitle': 'Sub' };
        const deckTypeAbbr = typeMap[deckTypeRaw] || 'Voc';

        // Use imageUrl for background, or fallback to CSS gradient class
        const imageStyleOrClass = deck.imageUrl 
            ? `style="background-image: url('${deck.imageUrl}'); background-size: cover; background-position: center;"`
            : `class="css-bg-${(parseInt(deck.id) % 4) + 1}"`;

        const tagHTML = `<span class="deck-card-tag">${deckTypeAbbr}</span>`;
        
        const homeCardHTML = `
            <div class="deck-card" data-deck-id="${deck.id}" style="cursor: pointer;">
                <div class="deck-card-image" ${imageStyleOrClass}>${tagHTML}</div>
                <p class="deck-card-title">${deck.title}</p>
            </div>`;
        homeContainer.insertAdjacentHTML('beforeend', homeCardHTML);
        
        const studyScore = calculateDeckStudyScore(deck);

        const gridCardHTML = `
            <div class="grid-deck-card" data-deck-id="${deck.id}">
                <a href="#" class="grid-deck-image-wrapper">
                    <div class="grid-deck-image" ${imageStyleOrClass}>${tagHTML}</div>
                </a>
                <div class="deck-progress-wrapper">
                    <div class="deck-progress-bar-container">
                        <div class="deck-progress-bar" style="width: ${studyScore}%;"></div>
                    </div>
                    <span class="deck-progress-percentage">${studyScore}%</span>
                </div>
                <div class="grid-deck-title-wrapper">
                    <div>
                        <p class="grid-deck-title">${deck.title}</p>
                        <p class="grid-deck-subtitle">${wordCount} words</p>
                    </div>
                    <div class="options-container">
                        <button class="options-button deck-options-btn"><i class="ph ph-dots-three-vertical"></i></button>
                        <div class="options-menu">
                            <a href="#" class="option-item edit-btn">Edit</a>
                            <a href="#" class="option-item practice-btn">Practice</a>
                            <a href="#" class="option-item test-btn">Start Test</a>
                        </div>
                    </div>
                </div>
            </div>`;
        gridContainer.insertAdjacentHTML('beforeend', gridCardHTML);
    });

    homeContainer.insertAdjacentHTML('beforeend', viewAllCardHTML);
    // Re-attach its specific event listener since it's being recreated
    const viewAllBtn = document.getElementById('view-all-decks-btn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            showMainScreen(screens.decks, navLinks.decks); 
        });
    }
}

async function populateWordData(wordObject, deck) {
    const deckType = deck.type || 'Vocabulary';
    // This function fetches all missing data for a word object and saves it.
    let needsSave = false;
    const isOnline = navigator.onLine; // Check for internet connection

    // If the entry is a standard vocabulary word, use the Dictionary API and Unsplash.
    if (deckType === 'Vocabulary') {
        // 1. Fetch detailed definition if missing AND we are online
        if (!wordObject.definitions.detailed && isOnline) {
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordObject.text}`);
            if (response.ok) {
                const data = await response.json();
                wordObject.definitions.detailed = data[0]; // Store the whole API response
                // Only set the flashcard definition if it wasn't pre-filled by a CSV import
                if (!wordObject.definitions.flashcard) {
                    wordObject.definitions.flashcard = data[0]?.meanings[0]?.definitions[0]?.definition || 'Definition not found.';
                }
                needsSave = true;
            }
        } catch (error) {
            console.error(`Failed to fetch dictionary data for ${wordObject.text}:`, error);
        }
    }

    // 2. Fetch image URL if missing (using a simple search query) AND we are online
    if (!wordObject.imageUrl && unsplashApiKey && isOnline) {
         try {
            const imageResult = await searchUnsplash(wordObject.text); // Use the word itself as the query
            if (imageResult.images && imageResult.images.length > 0) {
                wordObject.imageUrl = imageResult.images[0].url;
                needsSave = true;
            }
        } catch (error) {
            console.error(`Failed to fetch image for ${wordObject.text}:`, error);
        }
    }

        if (needsSave) {
            saveDecksToStorage(); // Save the updated deck with the new data
        }
    } 
    // Otherwise, if it's an Expression or Subtitle, use AI to get an explanation.
    else {
        // Only fetch AI explanation if it's missing AND we are online
        if (!wordObject.definitions.flashcard && isOnline) { // Only fetch if we don't have an explanation
            try {
                const explanation = await getExplanationFromAi(wordObject, deck);
                // For non-vocab items, the explanation serves as both flashcard and detailed view.
                wordObject.definitions.flashcard = explanation;
                wordObject.definitions.detailed = explanation; // Store it here too for the definition view
                needsSave = true;
            } catch (error) {
                console.error(`Failed to get AI explanation for ${wordObject.text}:`, error);
                wordObject.definitions.flashcard = "Could not get an explanation at this time.";
            }
        }
        // We won't fetch an image for expressions/subtitles to avoid irrelevant results.
        if (needsSave) {
            saveDecksToStorage();
        }
    }
    return wordObject; // Return the (potentially updated) object
}

async function displayHomeFlashcard() {
    const allWords = decks.flatMap(deck => deck.words.map(word => ({ ...word, deckId: deck.id })));
    const flashcardInner = document.getElementById('flashcard').querySelector('.flashcard-inner');
    const frontFace = flashcardInner.querySelector('.flashcard-front');
    const backFace = flashcardInner.querySelector('.flashcard-back');
    
    frontFace.removeAttribute('style');
    backFace.removeAttribute('style');

    if (allWords.length === 0) {
        document.getElementById('home-flashcard-term').textContent = 'No words yet';
        document.getElementById('home-flashcard-definition').textContent = 'Add words to a deck to start!';
        frontFace.className = 'flashcard-face flashcard-front css-bg-4';
        backFace.className = 'flashcard-face flashcard-back css-bg-4';
        return;
    }
    
    const masterDeck = { words: allWords };
    let wordToShow = selectNextWord(masterDeck);
    
    currentDeckState.homeWord = wordToShow;
    document.getElementById('home-flashcard-term').textContent = wordToShow.text;
    document.getElementById('home-flashcard-definition').textContent = '...';

    const cssBgClass = `css-bg-${(Math.floor(Math.random() * 4)) + 1}`;
    frontFace.className = `flashcard-face flashcard-front ${cssBgClass}`;
    backFace.className = `flashcard-face flashcard-back ${cssBgClass}`;

    const deckForHomeWord = decks.find(d => d.id === wordToShow.deckId);
    wordToShow = await populateWordData(wordToShow, deckForHomeWord);

    document.getElementById('home-flashcard-definition').textContent = wordToShow.definitions.flashcard || 'Definition not found.';
    if(wordToShow.imageUrl) {
        const imageStyle = `background-image: url('${wordToShow.imageUrl}'); background-size: cover; background-position: center;`;
        frontFace.setAttribute('style', imageStyle);
        backFace.setAttribute('style', imageStyle);
    }
    flashcardInner.classList.remove('is-flipped');
}


async function displayDeckWord() {
    const flashcardInner = document.querySelector('#deck-flashcard-view .flashcard-inner');
    flashcardInner.classList.remove('is-flipped');
    
    let { currentWord } = currentDeckState;
    const definitionArea = document.getElementById('deck-word-display-area');
    const geminiContainer = document.getElementById('gemini-amharic-definition-area');
    const flashcardTerm = document.getElementById('deck-flashcard-term');
    const flashcardDefContainer = document.getElementById('deck-flashcard-definition-container');
    const frontFace = flashcardInner.querySelector('.flashcard-front');
    const backFace = flashcardInner.querySelector('.flashcard-back');

    frontFace.removeAttribute('style');
    backFace.removeAttribute('style');
    
    definitionArea.innerHTML = '';
    geminiContainer.innerHTML = '';

    if (!currentWord) {
        const emptyMessage = `<p>This deck is empty. Add some words to start reviewing!</p>`;
        definitionArea.innerHTML = emptyMessage;
        flashcardTerm.textContent = "Deck Empty";
        flashcardDefContainer.innerHTML = `<p>Add words to this deck to begin.</p>`;
        return;
    }

    flashcardTerm.textContent = currentWord.text;
    flashcardDefContainer.innerHTML = `<p class="card-text">${currentWord.definitions.flashcard || 'Loading...'}</p>`;
    
    const cssBgClass = `css-bg-${(parseInt(currentDeckState.deck.id) % 4) + 1}`;
    frontFace.className = `flashcard-face flashcard-front ${cssBgClass}`;
    backFace.className = `flashcard-face flashcard-back ${cssBgClass}`;

    // Await the population of data BEFORE rendering the final content
    currentWord = await populateWordData(currentWord, currentDeckState.deck);
    
    // Now render the final content with the potentially new data
    flashcardDefContainer.innerHTML = `<p class="flashcard-definition">${currentWord.definitions.flashcard || 'Definition not found.'}</p>`;
    if (currentWord.imageUrl) {
        const imageStyle = `background-image: url('${currentWord.imageUrl}'); background-size: cover; background-position: center;`;
        frontFace.setAttribute('style', imageStyle);
        backFace.setAttribute('style', imageStyle);
    }

    let definitionHtml = '';
    const wordData = currentWord.definitions.detailed;
    const deckType = currentDeckState.deck.type || 'Vocabulary';

    if (deckType === 'Vocabulary') {
        if (wordData && typeof wordData === 'object') {
            definitionHtml += `<h2>${wordData.word}</h2>`;
            if (wordData.phonetic) definitionHtml += `<h3>${wordData.phonetic}</h3>`;
            wordData.meanings.forEach(meaning => {
                definitionHtml += `<div class="meaning-block"><p class="part-of-speech">${meaning.partOfSpeech}</p><ul>${meaning.definitions.map(def => `<li>${def.definition}</li>`).join('')}</ul></div>`;
            });
        } else {
            definitionHtml = `<h2>${currentWord.text}</h2><h3>Could not find a detailed definition.</h3>`;
        }
    } else {
        // For Expressions and Subtitles, display the AI-generated text.
        const title = deckType === 'Expressions' ? 'Expression' : 'Subtitle';
        definitionHtml = `<h2>${title}</h2>`;
        // Use a blockquote for the expression/subtitle itself for emphasis
        definitionHtml += `<blockquote style="font-size: 1.25rem; font-style: italic; border-left: 4px solid var(--accent-primary); padding-left: var(--space-md); margin: var(--space-md) 0;">${currentWord.text}</blockquote>`;
        
        definitionHtml += '<h3>Explanation <i class="ph-fill ph-sparkle" title="AI Generated" style="vertical-align: middle; font-size: 1rem; color: var(--text-tertiary);"></i></h3>';
        
        // The 'detailed' definition now holds the AI explanation string
        if (wordData && typeof wordData === 'string') {
            definitionHtml += `<div style="font-family: var(--font-secondary); line-height: 1.7;">${marked.parse(wordData, { breaks: true, gfm: true })}</div>`;
        } else {
            definitionHtml += `<p>Loading explanation...</p>`;
        }
    }
    definitionArea.innerHTML = definitionHtml;

    if (currentWord.definitions.gemini) {
        const formattedDef = marked.parse(currentWord.definitions.gemini, { breaks: true, gfm: true });
        geminiContainer.innerHTML = `<h3 class="section-title" style="font-size: 1.125rem; padding-left: 0;">Amharic Definition (Gemini) <i class="ph-fill ph-sparkle" title="AI Generated" style="vertical-align: middle; font-size: 1rem; color: var(--text-tertiary);"></i></h3><div style="font-family: 'Noto Sans', sans-serif; line-height: 1.8;">${formattedDef}</div>`;
    } else if (geminiApiKey) {
        geminiContainer.innerHTML = ``; // Do not show any message if it's missing
    } else {
        geminiContainer.innerHTML = ``;
    }
}

    function openDeck(deck, wordToShowText = null) {
        deck.lastSeen = new Date().toISOString();
        saveDecksToStorage();
        
        currentDeckState.deck = deck;
        if (wordToShowText) {
            currentDeckState.currentWord = deck.words.find(w => w.text.toLowerCase() === wordToShowText.toLowerCase()) || selectNextWord(deck);
        } else {
            currentDeckState.currentWord = selectNextWord(deck);
        }
        document.querySelector('#view-deck-header .header-title').textContent = deck.title;
        document.querySelector('#deck-flashcard-view .flashcard-inner')?.classList.remove('is-flipped');
        deckViewMode = 'flashcard';
        document.getElementById('deck-flashcard-mode-btn').classList.add('active');
        document.getElementById('deck-definition-mode-btn').classList.remove('active');
        document.getElementById('deck-flashcard-view').classList.add('active');
        document.getElementById('deck-definition-view').classList.remove('active');
        displayDeckWord(); 
        showMainScreen(screens.viewDeck, navLinks.decks);
        mainSearchInput.value = '';
        handleSearch();
    }

    // --- Navigation & UI Functions ---
    function showMainScreen(screenToShow, activeNavLink) {
        closeAllModals();
        allMainScreens.forEach(s => s.classList.remove('active'));
        screenToShow.classList.add('active');
        Object.values(navLinks).forEach(link => link.classList.remove('active'));
        if (activeNavLink) activeNavLink.classList.add('active');
        const navContainer = document.querySelector('.nav-container');
        if (screenToShow === screens.chat) {
            navContainer.style.display = 'none';
            document.body.style.overflow = 'hidden';
        } else {
            navContainer.style.display = 'block';
            document.body.style.overflow = 'auto';
        }
        window.scrollTo(0, 0);
    }
    function showModal(modalToShow) {
        // Find and store the currently active main screen before hiding it
        lastActiveScreen = allMainScreens.find(s => s.classList.contains('active')) || screens.home;

        mainAppContainer.style.display = 'none';
        allModals.forEach(modal => modal.classList.remove('active'));
        modalToShow.classList.add('active');
        window.scrollTo(0, 0);
    }
    function closeAllModals(returnToLastScreen = false) {
        allModals.forEach(modal => modal.classList.remove('active'));
        mainAppContainer.style.display = 'flex';
        
        if (returnToLastScreen && lastActiveScreen) {
            // Determine which nav link corresponds to the last active screen
            let correspondingNavLink = null;
            if(lastActiveScreen === screens.home) correspondingNavLink = navLinks.home;
            else if(lastActiveScreen === screens.decks) correspondingNavLink = navLinks.decks;
            else if(lastActiveScreen === screens.chat) correspondingNavLink = navLinks.chat;
            else if(lastActiveScreen === screens.movieList) correspondingNavLink = navLinks.movie;
            else if(lastActiveScreen === screens.settings) correspondingNavLink = navLinks.settings;

            showMainScreen(lastActiveScreen, correspondingNavLink);
        }
    }
    
    function closeActiveMenu() {
        if (activeMenu.element) {
            const className = activeMenu.type === 'popover' ? 'active' : 'visible';
            activeMenu.element.classList.remove(className);
        }
        activeMenu = { element: null, type: null };
    }

    function toggleMenu(menu, type = 'options') {
        const className = type === 'popover' ? 'active' : 'visible';
        if (activeMenu.element && activeMenu.element !== menu) {
            closeActiveMenu();
        }
        menu.classList.toggle(className);
        if (menu.classList.contains(className)) {
            activeMenu = { element: menu, type: type };
        } else {
            activeMenu = { element: null, type: null };
        }
    }

    // --- Search Functionality ---
    function renderSearchResults(results) { let html = ''; if (results.decks.length === 0 && results.words.length === 0) { html = '<p class="no-results-message">No results found.</p>'; } else { if (results.decks.length > 0) { html += '<h4 class="search-result-group-title">Decks</h4>'; results.decks.forEach(deck => { const bgClass = `css-bg-${(parseInt(deck.id) % 4) + 1}`; html += `<a href="#" class="search-result-item" data-deck-id="${deck.id}"><div class="search-result-image ${bgClass}"></div><div class="search-result-text-content"><p class="search-result-title">${deck.title}</p><p class="search-result-subtitle">${deck.words.length} words</p></div><i class="ph ph-caret-right"></i></a>`; }); } if (results.words.length > 0) { html += '<h4 class="search-result-group-title">Words</h4>'; results.words.forEach(item => { html += `<a href="#" class="search-result-item" data-word-deck-id="${item.deck.id}" data-word="${item.word.text}"><div class="search-result-icon"><i class="ph ph-text-t"></i></div><div class="search-result-text-content"><p class="search-result-title">${item.word.text}</p><p class="search-result-subtitle">In deck: ${item.deck.title}</p></div><i class="ph ph-caret-right"></i></a>`; }); } } searchResultsContainer.innerHTML = html; }
    function handleSearch() { const query = mainSearchInput.value.trim().toLowerCase(); if (query.length === 0) { searchResultsContainer.style.display = 'none'; defaultDecksView.style.display = 'block'; searchResultsContainer.innerHTML = ''; return; } searchResultsContainer.style.display = 'block'; defaultDecksView.style.display = 'none'; const matchingDecks = decks.filter(deck => deck.title.toLowerCase().includes(query)); const matchingWords = []; decks.forEach(deck => { deck.words.forEach(word => { if (word.text.toLowerCase().includes(query)) { matchingWords.push({ word, deck }); } }); }); renderSearchResults({ decks: matchingDecks, words: matchingWords }); }
async function getExplanationFromAi(wordObject, deck) {
    if (!groqApiKey) {
        return "Please add your Groq API key in Settings to use AI features.";
    }

    let userPrompt = '';
    if (deck.type === 'Expressions') {
        userPrompt = `Explain the meaning, origin (if known), and provide an example sentence for the English expression: "${wordObject.text}"`;
    } else if (deck.type === 'Subtitle') {
        userPrompt = `CONTEXT: This line is from the movie "${deck.title}". It appears at the timestamp ${wordObject.timestamp}.
        
LINE: "${wordObject.text}"
        
TASK: Based on the context, explain the meaning of this line. If it's a famous quote, mention that. Keep the explanation concise and focused on the line's significance.`;
    } else {
        return "Invalid type for AI explanation.";
    }

    const systemPrompt = "You are a helpful assistant that provides clear and concise explanations for vocabulary, expressions, and phrases. Respond only with the explanation itself, without any conversational filler.";

    try {
        // We use the more generic getGroqCompletion function here
        const result = await getGroqCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);
        return result;
    } catch (error) {
        console.error("Error getting AI explanation from Groq:", error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}
function srtTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(/[:,]/);
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    const milliseconds = parseInt(parts[3], 10) || 0;
    return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
}
function formatRelativeTime(dateString) {
    if (!dateString) return "never";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes} minute(s) ago`;
    if (hours < 24) return `${hours} hour(s) ago`;
    return `${days} day(s) ago`;
}
    // ========================================================================
    // --- QUIZ & AI API FUNCTIONS ---
    // ========================================================================
    async function getQuizFromAI(prompt) { if (!groqApiKey) { alert('Groq API Key is not set. Please add it in Settings.'); return null; } try { const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: "You are a helpful assistant that creates educational quizzes. Respond ONLY with the requested JSON, no extra text or explanations." }, { role: "user", content: prompt }], model: "llama3-8b-8192", temperature: 0.7, response_format: { "type": "json_object" } }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`); } const data = await response.json(); const jsonString = data.choices[0].message.content; const cleanedJsonString = jsonString.replace(/```json\n|```/g, '').trim(); return JSON.parse(cleanedJsonString); } catch (error) { console.error("Failed to generate quiz:", error); alert(`Failed to generate quiz: ${error.message}`); return null; } }
    async function startQuiz(deckId) { const deck = decks.find(d => d.id === deckId); if (!deck || deck.words.length < 5) { alert("This deck needs at least 5 words to generate a quiz."); return; } quizDeckId = deckId; showModal(screens.quiz); document.getElementById('quiz-question-title').textContent = "Generating Quiz..."; document.getElementById('quiz-card').style.visibility = 'hidden'; document.getElementById('quiz-buttons').style.visibility = 'hidden'; const prioritizedWords = selectPrioritizedWordsForQuiz(deck, 15); const wordList = prioritizedWords.join(', '); const prompt = `Based on this list of vocabulary words: [${wordList}], create a 10-question True/False quiz. For each question, use either the correct definition or a plausible but incorrect one. Respond ONLY with a valid JSON object with a single key "questions" which is an array of objects. Each object must have four keys: a 'word' (string), a 'definition' (string), 'is_correct' (boolean), and a concise 'explanation' (string) explaining why the definition is correct or incorrect. Do not include any other text or markdown formatting.`; const quizData = await getQuizFromAI(prompt); if (quizData && quizData.questions && quizData.questions.length > 0) { currentQuiz = quizData.questions; currentQuestionIndex = 0; quizScore = 0; userQuizAnswers = []; document.getElementById('quiz-question-title').textContent = "Is this definition correct?"; document.getElementById('quiz-card').style.visibility = 'visible'; document.getElementById('quiz-buttons').style.visibility = 'visible'; displayQuestion(); } else { alert("Sorry, I couldn't create a quiz right now. Please check your API key or try again."); closeAllModals(); showMainScreen(screens.decks, navLinks.decks); } }
    function displayQuestion() { const question = currentQuiz[currentQuestionIndex]; document.getElementById('quiz-card-word').textContent = question.word; document.getElementById('quiz-card-definition').textContent = question.definition; const progress = ((currentQuestionIndex + 1) / currentQuiz.length) * 100; document.getElementById('quiz-progress-text').textContent = `${currentQuestionIndex + 1}/${currentQuiz.length}`; document.getElementById('quiz-progress-bar').style.width = `${progress}%`; const trueBtn = document.getElementById('true-btn'); const falseBtn = document.getElementById('false-btn'); trueBtn.disabled = false; falseBtn.disabled = false; trueBtn.className = 'quiz-answer-btn true'; falseBtn.className = 'quiz-answer-btn false'; }
    function handleAnswer(userAnswer) { document.getElementById('true-btn').disabled = true; document.getElementById('false-btn').disabled = true; const question = currentQuiz[currentQuestionIndex]; const correctAnswer = question.is_correct; const wasCorrect = userAnswer === correctAnswer; const chosenBtn = userAnswer ? document.getElementById('true-btn') : document.getElementById('false-btn'); chosenBtn.classList.add(wasCorrect ? 'correct' : 'incorrect'); if (wasCorrect) { quizScore++; } userQuizAnswers.push({ ...question, is_correct: wasCorrect }); const deck = decks.find(d => d.id === quizDeckId); if(deck) { const wordInDeck = deck.words.find(w => w.text.toLowerCase() === question.word.toLowerCase()); if(wordInDeck) { updateWordMastery(wordInDeck, userAnswer); saveDecksToStorage(); } } showResult(wasCorrect); }
    function renderGenericReviewScreen() {
        const scoreTextEl = document.getElementById('review-score-text');
        const scoreDescriptionEl = document.getElementById('review-score-description');
        const reviewListEl = document.getElementById('review-list');
        const total = currentQuiz.length;

        scoreTextEl.textContent = `${quizScore}/${total}`;
        const percentage = total > 0 ? (quizScore / total) * 100 : 0;

        if (percentage >= 80) {
            scoreDescriptionEl.textContent = "Excellent work!";
        } else if (percentage >= 50) {
            scoreDescriptionEl.textContent = "Good effort! A little more practice will help.";
        } else {
            scoreDescriptionEl.textContent = "Keep practicing! You'll get it.";
        }

        reviewListEl.innerHTML = '';
        userQuizAnswers.forEach((answer, index) => {
            const isCorrect = answer.is_correct;
            const resultClass = isCorrect ? 'correct' : 'incorrect';
            const icon = isCorrect ? 'ph-fill ph-check-circle' : 'ph-fill ph-x-circle';
            
            let questionContentHTML = '';
            let explanationHTML = '';

            // Handle True/False format
            if (answer.hasOwnProperty('word')) {
                questionContentHTML = `<p class="word">${answer.word}</p><p class="definition">${answer.definition}</p>`;
                const aiMarker = '<div class="ai-marker-inline"><i class="ph-fill ph-sparkle"></i> AI Explanation</div>';
                const parsedExplanation = marked.parse(answer.explanation || 'No explanation provided.', { breaks: true, gfm: true });
                explanationHTML = `<div class="review-explanation-block ${resultClass}">${aiMarker}${parsedExplanation}</div>`;
            } 
            // Handle Multiple Choice format
            else if (answer.hasOwnProperty('definition')) {
                questionContentHTML = `<p class="definition">${answer.definition}</p>`;
                // Use the AI's explanation if available, otherwise fall back to the simple text.
                let explanationText;
                if (answer.explanation) {
                    const aiMarker = '<div class="ai-marker-inline"><i class="ph-fill ph-sparkle"></i> AI Explanation</div>';
                    const parsedExplanation = marked.parse(answer.explanation, { breaks: true, gfm: true });
                    explanationText = `${aiMarker}${parsedExplanation}`;
                } else {
                    explanationText = isCorrect
                        ? `You correctly chose <strong>${answer.correct_answer}</strong>.`
                        : `Your answer: <strong>${answer.user_answer}</strong>. The correct answer was <strong>${answer.correct_answer}</strong>.`;
                }
                explanationHTML = `<div class="review-explanation-block ${resultClass}">${explanationText}</div>`;
            }
            
            const itemHTML = `
                <div class="review-item">
                    <div class="review-item-header">
                        <span class="review-question-number">Question ${index + 1}</span>
                        <i class="ph ${icon} review-result-icon ${resultClass}"></i>
                    </div>
                    <div class="review-question-content">${questionContentHTML}</div>
                    ${explanationHTML}
                </div>`;
            reviewListEl.insertAdjacentHTML('beforeend', itemHTML);
        });

        showModal(screens.quizReview);
    }
    function showResult(wasCorrect) { const overlay = document.getElementById('quiz-result-overlay'); const content = document.getElementById('quiz-result-content'); const icon = document.getElementById('quiz-result-icon'); const text = document.getElementById('quiz-result-text'); content.className = wasCorrect ? 'correct' : 'incorrect'; icon.className = wasCorrect ? 'ph-fill ph-check-circle' : 'ph-fill ph-x-circle'; text.textContent = wasCorrect ? 'Correct!' : 'Incorrect!'; overlay.style.display = 'flex'; setTimeout(() => { overlay.style.display = 'none'; currentQuestionIndex++; if (currentQuestionIndex < currentQuiz.length) { displayQuestion(); } else { renderGenericReviewScreen(); } }, 1200); }
    
    

    // NEW: Tool definitions for the Gemini API's native Function Calling
    const GEMINI_AGENT_TOOLS = [{
        function_declarations: [
            {
                name: "create_deck_and_set_wallpaper",
                description: "Creates a new vocabulary deck and automatically finds and sets a relevant wallpaper for it from Unsplash. This is the primary tool for creating new decks.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "The title for the new deck." },
                        description: { type: "STRING", description: "An optional description for the deck." },
                        words: { type: "ARRAY", items: { type: "STRING" }, description: "An optional list of initial words." },
                        themeQuery: { type: "STRING", description: "A search query for Unsplash to find a relevant background image, e.g., 'spanish culture', 'ocean coral reef', 'studying books'." },
                        deckType: { type: "STRING", description: "The type of the deck. If not specified, defaults to Vocabulary.", "enum": ["Vocabulary", "Expressions", "Subtitle"] }
                    },
                    required: ["title", "themeQuery"]
                }
            },
            {
                name: "get_full_deck_report",
                description: "Retrieves a complete report for one or more decks. Can provide a high-level summary or a deep-dive with full word details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deckTitles: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "An array of deck titles to get a report for."
                        },
                        includeWords: {
                            type: "BOOLEAN",
                            description: "Set to true to include the full, detailed list of every word in the deck(s). Defaults to false (summary view)."
                        }
                    },
                    required: ["deckTitles"]
                }
            },
            {
                name: "add_words",
                description: "Adds words to one or more existing decks in a single batch operation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        updates: {
                            type: "ARRAY",
                            description: "An array of update instructions.",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    deckTitle: { type: "STRING", description: "The title of the deck to add words to." },
                                    words: { type: "ARRAY", items: { type: "STRING" }, description: "The list of words to add." }
                                },
                                required: ["deckTitle", "words"]
                            }
                        }
                    },
                    required: ["updates"]
                }
            },
            {
                name: "edit_deck_details",
                description: "Edits the title, description, or type for one or more decks in a single batch operation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        edits: {
                            type: "ARRAY",
                            description: "An array of edit instructions.",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    deckTitle: { type: "STRING", description: "The current title of the deck to be edited." },
                                    newTitle: { type: "STRING", description: "The new title for the deck." },
                                    newDescription: { type: "STRING", description: "The new description for the deck." },
                                    newDeckType: { type: "STRING", description: "The new type for the deck.", "enum": ["Vocabulary", "Expressions", "Subtitle"] }
                                },
                                required: ["deckTitle"]
                            }
                        }
                    },
                    required: ["edits"]
                }
            },
            {
                name: "delete_words",
                description: "Deletes specific words from one or more decks in a single batch operation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deletions: {
                           type: "ARRAY",
                           description: "An array of deletion instructions.",
                           items: {
                                type: "OBJECT",
                                properties: {
                                    deckTitle: { type: "STRING", description: "The title of the deck from which to delete words." },
                                    words: { type: "ARRAY", items: { type: "STRING" }, description: "The list of words to delete." }
                                },
                                required: ["deckTitle", "words"]
                           }
                        }
                    },
                    required: ["deletions"]
                }
            },
            {
                name: "delete_deck",
                description: "Permanently deletes an entire vocabulary deck. This action cannot be undone.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deckTitle: { type: "STRING", description: "The title of the deck to delete." }
                    },
                    required: ["deckTitle"]
                }
            },
            {
                name: "change_deck_wallpaper",
                description: "Changes the background wallpaper image for a specific vocabulary deck using a theme query.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deckTitle: { type: "STRING", description: "The title of the deck whose wallpaper should be changed." },
                        newThemeQuery: { type: "STRING", description: "A search query for Unsplash to find a relevant new background image, e.g., 'spanish culture', 'ocean coral reef', 'studying books'." }
                    },
                    required: ["deckTitle", "newThemeQuery"]
                }
            },
            {
                name: "change_word_image",
                description: "Changes the background image for a single, specific word within a deck using a theme query.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deckTitle: { type: "STRING", description: "The title of the deck containing the word." },
                        word: { type: "STRING", description: "The specific word whose image should be changed." },
                        newThemeQuery: { type: "STRING", description: "A search query for Unsplash to find a relevant new background image." }
                    },
                    required: ["deckTitle", "word", "newThemeQuery"]
                }
            },
            {
                name: "list_decks",
                description: "Lists all of the user's available vocabulary decks.",
                parameters: { type: "OBJECT", properties: {} }
            },
            {
                name: "view_deck",
                description: "Opens the interactive UI screen for a specific deck for the user to study.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deckTitle: { type: "STRING", description: "The title of the deck to open." }
                    },
                    required: ["deckTitle"]
                }
            },
            {
                name: "list_movies",
                description: "Lists all of the user's available movies, including when they were added and last viewed.",
                parameters: { type: "OBJECT", properties: {} }
            },
            {
                name: "get_movie_subtitle_lines",
                description: "Retrieves specific lines from a movie's subtitle file based on a time range or line number range. Use this to find specific quotes or conversations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        movieTitle: { type: "STRING", description: "The title of the movie to get subtitles from." },
                        fromTime: { type: "STRING", description: "Optional. The starting timestamp, e.g., '00:15:30'." },
                        toTime: { type: "STRING", description: "Optional. The ending timestamp, e.g., '00:16:00'." },
                        fromLine: { type: "NUMBER", description: "Optional. The starting line number." },
                        toLine: { type: "NUMBER", description: "Optional. The ending line number." }
                    },
                    required: ["movieTitle"]
                }
            }
        ]
    }];



    async function getGeminiCompletion(history) { if (!geminiApiKey) return Promise.reject(new Error("Gemini API Key is not set.")); const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: history }) }); if (!res.ok) throw new Error((await res.json()).error.message); const data = await res.json(); return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini."; }
    async function getAmharicDefinitionFromGemini(word) { if (!geminiApiKey) { return "Please add your Gemini API key in Settings to use this feature."; } const prompt = `You are an Amharic-English dictionary. Provide a dictionary-style definition for the English word "${word}".\nRULES:\n1.  Respond ONLY in Amharic script.\n2.  Do NOT include any English transliteration (writing Amharic words with English letters).\n3.  You MAY include an English sentence as an example, followed by its Amharic translation.\n4.  Format the response clearly.`; const maxRetries = 3; for (let attempt = 1; attempt <= maxRetries; attempt++) { try { const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); if (!res.ok) { if (res.status === 503 || res.status === 429) { if (attempt < maxRetries) { console.warn(`Attempt ${attempt} failed: Gemini overloaded. Retrying in ${attempt * 1000}ms...`); await new Promise(resolve => setTimeout(resolve, attempt * 1000)); continue; } } const errorData = await res.json(); throw new Error(errorData.error.message); } const data = await res.json(); return data.candidates?.[0]?.content?.parts?.[0]?.text || "No Amharic definition found."; } catch (error) { console.error(`Gemini Amharic Definition Error (Attempt ${attempt}):`, error); if (attempt === maxRetries) { return "Sorry, Gemini seems to be busy right now. Please try again in a few moments."; }     } } }
  
    // ========================================================================
    // --- AI PRACTICE SESSION LOGIC ---
    // ========================================================================

    const specialScenarioPrompt = `With the words you've listed in mind, craft a scenario where you take on a role and assign me one too—we’ll both embody characters from your imagined setting.

Design the scenario in a way that naturally allows the use of all the words you gave earlier. As the conversation unfolds, you’ll subtly encourage me to use those words too—not by telling me directly, but by weaving them into your speech and making them irresistible. We won’t dump them all at once; they'll flow organically throughout a long, immersive dialogue.

Start by describing the general setting, characters, and context. Once I approve, we jump straight into the scene—no breaking the fourth wall, no reminders that it's a prompt. We live it, speak it, become it.

Once inside, the entire interaction is pure conversation—just me and you talking in-character. No narrative descriptions, no stage directions, no commentary. Only real-time, raw, character-to-character dialogue. Let’s make it feel alive.`;

    function startAiPracticeSession(deckId) {
        const deck = decks.find(d => d.id === deckId);
        if (!deck || deck.words.length === 0) {
            alert("This deck is empty. Add some words to practice!");
            return;
        }

        const wordsToPractice = selectPrioritizedWordsForQuiz(deck, 20).map(word => `"${word}"`);
        if (wordsToPractice.length === 0) {
            alert("You're all caught up on this deck! No words are currently due for practice.");
            return;
        }
        
        const initialUserMessage = `I want to practice the following words: [${wordsToPractice.join(', ')}]`;
        const initialAiMessage = "I've received your list of words. How would you like to practice them? We can try a few different methods.";

        const newConversation = { 
            id: String(Date.now()), 
            title: `Practice: ${deck.title}`,
            model: 'Gemini', // Default to Gemini as requested
            messages: [
                { id: String(Date.now() + 1), role: 'user', content: initialUserMessage },
                { id: String(Date.now() + 2), role: 'model', content: initialAiMessage }
            ] 
        };

        conversations.unshift(newConversation);
        activeConversationId = newConversation.id;
        saveConversationsToStorage();
        
        showMainScreen(screens.chat, navLinks.chat);
        
        renderConversation(); // Renders the initial user/AI messages
        
        // Render the initial special suggestions
        const suggestions = [
            { text: "Role-playing scenario", type: 'prompt-suggestion' },
            { text: "Ask me to use them in sentences", type: 'normal' }
        ];
        renderSuggestedReplies(suggestions, true);
    }
    
    function renderSuggestedReplies(suggestions, isInitial = false) {
        const container = document.getElementById('main-suggested-replies-container');
        container.innerHTML = '';
        if (!suggestions || suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggested-reply-btn';
            
            if (isInitial && suggestion.type === 'prompt-suggestion') {
                btn.classList.add('prompt-suggestion');
                // Store the special prompt in a data attribute
                btn.dataset.prompt = specialScenarioPrompt;
            }

            btn.textContent = suggestion.text;
            container.appendChild(btn);
        });
    }

    function parseAiResponseWithSuggestions(responseText) {
        const suggestionTag = '<suggestions>';
        const endSuggestionTag = '</suggestions>';
        
        let mainContent = responseText;
        let suggestions = [];

        if (responseText.includes(suggestionTag)) {
            const startIndex = responseText.indexOf(suggestionTag);
            const endIndex = responseText.indexOf(endSuggestionTag);
            
            if (endIndex > startIndex) {
                mainContent = responseText.substring(0, startIndex).trim();
                const suggestionsBlock = responseText.substring(startIndex + suggestionTag.length, endIndex).trim();
                // Suggestions are expected to be separated by newlines
                suggestions = suggestionsBlock.split('\n').map(s => s.trim()).filter(Boolean);
            }
        }
        
        return { mainContent, suggestions };
    }

    async function getGeminiCompletionWithSuggestions(history) {
        if (!geminiApiKey) return Promise.reject(new Error("Gemini API Key is not set."));

        // Add the instruction for suggestions to the last user message
        const lastUserMessage = history[history.length - 1];
        const instruction = "\n\nAfter your response, generate three short, relevant suggested replies for me to choose from. Format them inside <suggestions> tags, with each suggestion on a new line. For example: <suggestions>\nSuggestion 1\nSuggestion 2\nSuggestion 3</suggestions>";
        
        // Ensure parts is an array
        if (!Array.isArray(lastUserMessage.parts)) {
            lastUserMessage.parts = [{ text: lastUserMessage.parts.text || '' }];
        }
        lastUserMessage.parts[0].text += instruction;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: history })
        });

        if (!res.ok) throw new Error((await res.json()).error.message);
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
    }
  
    // ========================================================================
    // --- FULL CHAT INTERFACE & COMMAND LOGIC ---
    // ========================================================================
    
    // NEW: Function to handle a parsing error and trigger a retry
    
    
    

    
    async function generateChatTitle(userQuery) {
        if (!groqApiKey) {
            console.warn("Groq API key not set, using fallback title.");
            return userQuery.substring(0, 30) + (userQuery.length > 30 ? '...' : '');
        }
        const prompt = `Based on the following user query, create a short, concise title for our conversation (max 5 words). Respond with ONLY the title itself, no quotes, no extra text. My query was: "${userQuery}"`;
        try {
            const title = await getGroqCompletion([{ role: 'user', content: prompt }]);
            return title.replace(/["']/g, '').trim();
        } catch (error) {
            console.error("Error generating chat title:", error);
            return userQuery.substring(0, 30) + (userQuery.length > 30 ? '...' : '');
        }
    }
    
    const fullChatElements = { appContainer: document.getElementById('full-chat-app-container'), sidebarToggle: document.getElementById('chat-sidebar-toggle'), sidebarOverlay: document.getElementById('chat-sidebar-overlay'), historyList: document.getElementById('chat-history-list'), logArea: document.getElementById('main-chat-log-area'), textarea: document.getElementById('main-chat-textarea'), sendBtn: document.getElementById('main-send-chat-btn'), newChatBtn: document.getElementById('new-chat-btn'), modelSwitcherBtn: document.getElementById('model-switcher-btn'), optionsBtn: document.getElementById('options-btn'), modelPopover: document.getElementById('model-popover'), optionsPopover: document.getElementById('options-popover'), currentModelName: document.getElementById('current-model-name'), deleteChatBtn: document.getElementById('delete-chat-btn'), };

    function setupFullChatEventListeners() {
        document.getElementById('exit-chat-btn').addEventListener('click', (e) => {
            e.preventDefault();
            showMainScreen(screens.home, navLinks.home);
        });

        fullChatElements.sidebarToggle.addEventListener('click', () => fullChatElements.appContainer.classList.toggle('sidebar-open'));
        fullChatElements.sidebarOverlay.addEventListener('click', () => fullChatElements.appContainer.classList.remove('sidebar-open'));
        
        fullChatElements.modelSwitcherBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(fullChatElements.modelPopover, 'popover');
        });
        
        fullChatElements.optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(fullChatElements.optionsPopover, 'popover');
        });

        fullChatElements.modelPopover.addEventListener('click', (e) => {
            const item = e.target.closest('.popover-item');
            if(item) {
                const conv = conversations.find(c => c.id === activeConversationId);
                if(conv) {
                    conv.model = item.dataset.model;
                    fullChatElements.currentModelName.textContent = conv.model;
                    saveConversationsToStorage();
                }
            }
        });

        fullChatElements.deleteChatBtn.addEventListener('click', () => {
            if (!activeConversationId) return;
            if (confirm('Are you sure you want to delete this chat?')) {
                conversations = conversations.filter(c => c.id !== activeConversationId);
                activeConversationId = conversations.length > 0 ? conversations[0].id : null;
                saveConversationsToStorage();
                renderConversation();
                closeActiveMenu();
            }
        });

        fullChatElements.historyList.addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            if (historyItem) {
                activeConversationId = historyItem.dataset.convId;
                renderConversation();
                fullChatElements.appContainer.classList.remove('sidebar-open');
            }
        });

        fullChatElements.newChatBtn.addEventListener('click', createNewChat);
        fullChatElements.sendBtn.addEventListener('click', handleSendMessage);
        fullChatElements.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
        });

                fullChatElements.textarea.addEventListener('input', () => {
            fullChatElements.textarea.style.height = 'auto';
            fullChatElements.textarea.style.height = `${fullChatElements.textarea.scrollHeight}px`;
        });

        document.getElementById('main-suggested-replies-container').addEventListener('click', (e) => {
            const btn = e.target.closest('.suggested-reply-btn');
            if (btn) {
                e.preventDefault();
                let replyText;
                // Check if this is the special prompt button
                if (btn.dataset.prompt) {
                    replyText = btn.dataset.prompt;
                } else {
                    replyText = btn.textContent.trim();
                }
                
                fullChatElements.textarea.value = replyText;
                // Focus the textarea and adjust its height after populating
                fullChatElements.textarea.focus();
                fullChatElements.textarea.dispatchEvent(new Event('input'));

                // We don't automatically send the long prompt, we let the user review and send it.
                if (!btn.dataset.prompt) {
                    handleSendMessage();
                }
            }
        });
        
        fullChatElements.logArea.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (btn) {
                const action = btn.dataset.action;
                const messageWrapper = btn.closest('.chat-message-wrapper');
                const messageText = messageWrapper.querySelector('.message-content').textContent;
                const messageId = messageWrapper.dataset.messageId;

                if (action === 'copy') {
                    navigator.clipboard.writeText(messageText).then(() => {
                       btn.innerHTML = '<i class="ph ph-check"></i> Copied!';
                       setTimeout(() => { btn.innerHTML = '<i class="ph ph-copy"></i> Copy'; }, 2000);
                    });
                } else if (action === 'edit') {
                    editingMessageId = messageId;
                    fullChatElements.textarea.value = messageText;
                    fullChatElements.textarea.focus();
                    // Optional: add a visual cue that you're editing
                    fullChatElements.textarea.style.boxShadow = '0 0 0 3px rgba(251, 191, 36, 0.4)';
                } else if (action === 'regenerate') {
                    handleRegenerate();
                }
            }
        });
    }

    function renderChatHistory() {
        fullChatElements.historyList.innerHTML = '';
        if (conversations.length === 0) {
            fullChatElements.historyList.innerHTML = `<li style="padding: var(--space-md); color: var(--text-tertiary); text-align: center;">No chats yet.</li>`;
            return;
        }
        conversations.forEach(conv => {
            const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].content : '...';
            const item = document.createElement('li');
            item.innerHTML = `<a class="history-item ${conv.id === activeConversationId ? 'active' : ''}" data-conv-id="${conv.id}"><div class="history-item-title">${conv.title}</div><div class="history-item-preview">${lastMessage}</div></a>`;
            fullChatElements.historyList.appendChild(item);
        });
    }

    function renderConversation() {
        if (!activeConversationId) {
            fullChatElements.logArea.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); margin-top: auto; margin-bottom: auto;">Select a conversation or start a new one.</div>`;
            renderChatHistory();
            return;
        }
        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return;
        fullChatElements.currentModelName.textContent = conv.model;
        fullChatElements.logArea.innerHTML = '';
        conv.messages.forEach(msg => {
            const sender = msg.role === 'model' ? 'ai' : 'user';
            // Give each message an ID if it doesn't have one, for backward compatibility
            if (!msg.id) msg.id = String(Date.now() + Math.random()); 
            appendChatMessage(sender, msg.content, false, msg.id);
        });
        renderChatHistory();
    }
    
    function appendChatMessage(sender, text, isTyping = false, id = null) {
        if (!text && !isTyping) return; // Don't append empty messages

        const wrapper = document.createElement('div');
        wrapper.classList.add('chat-message-wrapper', `${sender}-message`);
        if(id) wrapper.dataset.messageId = id;

        const avatarInitial = sender === 'ai' ? 'W' : 'U';
        const avatar = `<div class="avatar">${avatarInitial}</div>`;
        const aiMarker = sender === 'ai' ? '<div class="ai-marker"><i class="ph-fill ph-sparkle" title="AI Generated"></i></div>' : '';
        const sanitizedText = marked.parse(text, { breaks: true, gfm: true });
        const message = `<div class="chat-message">${avatar}<div class="message-content">${sanitizedText}</div>${aiMarker}</div>`;
        let actions = '';
        if (!isTyping) {
            actions = sender === 'user' ? `<div class="bubble-actions"><button class="action-btn" data-action="copy"><i class="ph ph-copy"></i> Copy</button><button class="action-btn" data-action="edit"><i class="ph ph-pencil-simple"></i> Edit</button></div>` : `<div class="bubble-actions"><button class="action-btn" data-action="copy"><i class="ph ph-copy"></i> Copy</button><button class="action-btn" data-action="regenerate"><i class="ph ph-arrow-clockwise"></i> Regenerate</button></div>`;
        }
        wrapper.innerHTML = isTyping ? `<div class="chat-message">${avatar}<div class="typing-indicator">WordWise is typing...</div></div>` : message + actions;
        if (isTyping) wrapper.id = 'main-typing-indicator';
        fullChatElements.logArea.appendChild(wrapper);
        fullChatElements.logArea.scrollTop = fullChatElements.logArea.scrollHeight;
    }
        async function searchUnsplash(query) {
        if (!unsplashApiKey) {
            return { error: "Unsplash API key is not set. The user needs to add it in Settings." };
        }
        try {
            const response = await fetch(`https://api.unsplash.com/search/photos?page=1&per_page=10&query=${encodeURIComponent(query)}&orientation=squarish`, {
                headers: {
                    Authorization: `Client-ID ${unsplashApiKey}`
                }
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.errors ? error.errors.join(', ') : 'Unsplash API error');
            }
            const data = await response.json();
            if (data.results.length === 0) {
                return { information: "No images found for that query." };
            }
            const simplifiedResults = data.results.map(img => ({
                id: img.id,
                description: img.alt_description || img.description || "No description.",
                url: img.urls.regular
            }));
            return { images: simplifiedResults };
    
        } catch (error) {
            console.error("Unsplash search error:", error);
            return { error: error.message };
        }
    }


    // This new function handles the execution of tool calls from the Gemini agent.
    async function executeAppFunction(functionName, args) {
        console.log(`🚀 Executing function: ${functionName}`, args);
        let resultMessage = "";
        let success = false;

        switch (functionName) {
            case 'create_deck_and_set_wallpaper':
                if (confirm(`Create a new deck named "${args.title}" with a wallpaper related to "${args.themeQuery}"?`)) {
                    const newDeck = {
                        id: String(Date.now()),
                        title: args.title,
                        description: args.description || '',
                        words: (args.words || []).map(w => ({ text: w, masteryLevel: 0, lastSeen: null })),
                        type: args.deckType || 'Vocabulary',
                        createdAt: new Date().toISOString(),
                        imageUrl: null // Start with null
                    };

                    const imageResult = await searchUnsplash(args.themeQuery);
                    
                    if (imageResult.images && imageResult.images.length > 0) {
                        newDeck.imageUrl = imageResult.images[0].url;
                        resultMessage = `Successfully created the deck "${args.title}" and set a wallpaper.`;
                    } else {
                        resultMessage = `Successfully created the deck "${args.title}", but could not find a suitable wallpaper.`;
                    }
                    
                    decks.push(newDeck);
                    success = true;
                } else {
                    resultMessage = "User cancelled the action.";
                }
                break;

            case 'add_words':
                if (confirm(`This will add words to ${args.updates.length} deck(s). Proceed?`)) {
                    let results = [];
                    args.updates.forEach(update => {
                        const deckToAdd = decks.find(d => d.title.toLowerCase() === update.deckTitle.toLowerCase());
                        if (deckToAdd) {
                            const newWordObjects = update.words.map(w => ({ text: w, masteryLevel: 0, lastSeen: null }));
                            deckToAdd.words.push(...newWordObjects);
                            results.push(`Added ${update.words.length} words to "${update.deckTitle}".`);
                        } else {
                            results.push(`Could not find deck "${update.deckTitle}".`);
                        }
                    });
                    success = true;
                    resultMessage = "Batch operation complete:\n- " + results.join('\n- ');
                } else { resultMessage = "User cancelled the action."; }
                break;

            case 'edit_deck_details':
                if (confirm(`This will edit ${args.edits.length} deck(s). Proceed?`)) {
                    let results = [];
                    args.edits.forEach(edit => {
                        const deckToEdit = decks.find(d => d.title.toLowerCase() === edit.deckTitle.toLowerCase());
                        if (deckToEdit) {
                            if (edit.newTitle) deckToEdit.title = edit.newTitle;
                            if (edit.newDescription) deckToEdit.description = edit.newDescription;
                            if (edit.newDeckType) deckToEdit.type = edit.newDeckType;
                            results.push(`Successfully updated "${edit.deckTitle}".`);
                        } else {
                            results.push(`Could not find deck "${edit.deckTitle}".`);
                        }
                    });
                    success = true;
                    resultMessage = "Batch operation complete:\n- " + results.join('\n- ');
                } else { resultMessage = "User cancelled the action."; }
                break;

            case 'delete_words':
                if (confirm(`This will delete words from ${args.deletions.length} deck(s). Proceed?`)) {
                     let results = [];
                     args.deletions.forEach(del => {
                        const deckToDeleteFrom = decks.find(d => d.title.toLowerCase() === del.deckTitle.toLowerCase());
                        if (deckToDeleteFrom) {
                            const wordsToDelete = del.words.map(w => w.toLowerCase());
                            const originalWordCount = deckToDeleteFrom.words.length;
                            deckToDeleteFrom.words = deckToDeleteFrom.words.filter(wordObj => !wordsToDelete.includes(wordObj.text.toLowerCase()));
                            const wordsDeletedCount = originalWordCount - deckToDeleteFrom.words.length;
                            results.push(`Deleted ${wordsDeletedCount} word(s) from "${del.deckTitle}".`);
                        } else {
                            results.push(`Could not find deck "${del.deckTitle}".`);
                        }
                     });
                     success = true;
                     resultMessage = "Batch operation complete:\n- " + results.join('\n- ');
                } else { resultMessage = "User cancelled the action."; }
                break;

            case 'delete_deck':
                const deckToDelete = decks.find(d => d.title.toLowerCase() === args.deckTitle.toLowerCase());
                if (deckToDelete) {
                    if (confirm(`Are you sure you want to permanently delete the deck "${args.deckTitle}"? This cannot be undone.`)) {
                        decks = decks.filter(d => d.id !== deckToDelete.id);
                        success = true;
                        resultMessage = `The deck "${args.deckTitle}" has been permanently deleted.`;
                    } else { resultMessage = "User cancelled the action."; }
                } else { resultMessage = `Error: Could not find a deck named "${args.deckTitle}".`; }
                break;
            case 'change_deck_wallpaper':
                const deckToUpdate = decks.find(d => d.title.toLowerCase() === args.deckTitle.toLowerCase());
                if (deckToUpdate) {
                    const imageResult = await searchUnsplash(args.newThemeQuery);
                    if (imageResult.images && imageResult.images.length > 0) {
                        deckToUpdate.imageUrl = imageResult.images[0].url;
                        success = true;
                        resultMessage = `Successfully changed the wallpaper for the deck "${args.deckTitle}".`;
                    } else {
                        resultMessage = `Could not find any images for the theme "${args.newThemeQuery}".`;
                    }
                } else {
                    resultMessage = `Error: Could not find a deck named "${args.deckTitle}".`;
                }
                break;
                
            case 'change_word_image':
                const deckContainingWord = decks.find(d => d.title.toLowerCase() === args.deckTitle.toLowerCase());
                if (deckContainingWord) {
                    const wordToUpdate = deckContainingWord.words.find(w => w.text.toLowerCase() === args.word.toLowerCase());
                    if (wordToUpdate) {
                        const imageResult = await searchUnsplash(args.newThemeQuery);
                        if (imageResult.images && imageResult.images.length > 0) {
                            wordToUpdate.imageUrl = imageResult.images[0].url;
                            success = true;
                            resultMessage = `Successfully changed the image for the word "${args.word}".`;
                        } else {
                           resultMessage = `Could not find any images for the theme "${args.newThemeQuery}".`;
                        }
                    } else {
                        resultMessage = `Error: Could not find the word "${args.word}" in the deck "${args.deckTitle}".`;
                    }
                } else {
                    resultMessage = `Error: Could not find a deck named "${args.deckTitle}".`;
                }
                break;
            case 'list_decks':
                if (decks.length > 0) {
                    const deckList = decks.map(d => `- **${d.title}** (Last seen: ${formatRelativeTime(d.lastSeen)})`).join('\n');
                    resultMessage = `Here are the user's current decks:\n${deckList}`;
                } else {
                    resultMessage = "The user currently has no decks.";
                }
                break;
            
            case 'get_full_deck_report':
                if (!args.deckTitles || args.deckTitles.length === 0) {
                    resultMessage = "Error: No deck titles were provided.";
                    break;
                }

                const includeWords = args.includeWords || false;
                let reportParts = [];
                let notFoundReportTitles = [];

                if (includeWords) {
                    appendChatMessage('ai', `Analyzing deck(s) for a detailed report...`, true);
                }

                // Use a for...of loop to handle potential async calls inside
                for (const title of args.deckTitles) {
                    const deck = decks.find(d => d.title.toLowerCase() === title.toLowerCase());

                    if (deck) {
                        let details = `### Report for deck: **${deck.title}**\n`;
                        details += `- **Type:** ${deck.type || 'Vocabulary'}\n`;
                        details += `- **Description:** ${deck.description || 'N/A'}\n`;
                        details += `- **Created:** ${formatRelativeTime(deck.createdAt)}\n`;
                        details += `- **Last Seen:** ${formatRelativeTime(deck.lastSeen)}\n`;
                        details += `- **Total Entries:** ${deck.words.length}\n`;

                        if (includeWords && deck.words.length > 0) {
                            details += `\n**Word Details:**\n`;
                            let wordDetailsList = [];
                            for (const word of deck.words) {
                                const populatedWord = await populateWordData(word, deck);
                                let definitionInfo = "No definition/explanation available.";
                                if (populatedWord.definitions.flashcard) {
                                    definitionInfo = populatedWord.definitions.flashcard.length > 100
                                        ? populatedWord.definitions.flashcard.substring(0, 97) + '...'
                                        : populatedWord.definitions.flashcard;
                                }
                                wordDetailsList.push(
                                    `  - **${populatedWord.text}**\n` +
                                    `    - Mastery: ${populatedWord.masteryLevel}/${masteryIntervalsDays.length - 1}\n` +
                                    `    - Last Seen: ${formatRelativeTime(populatedWord.lastSeen)}`
                                );
                            }
                            details += wordDetailsList.join('\n');
                        }
                        reportParts.push(details);
                    } else {
                        notFoundReportTitles.push(title);
                    }
                }
                
                if(includeWords) {
                     document.getElementById('main-typing-indicator')?.remove();
                }

                resultMessage = reportParts.join('\n\n---\n\n');

                if (notFoundReportTitles.length > 0) {
                    resultMessage += `\n\n**Note:** Could not find the following deck(s): ${notFoundReportTitles.join(', ')}.`;
                }
                
                if (reportParts.length === 0 && notFoundReportTitles.length > 0) {
                    resultMessage = `Error: Could not find any of the requested decks: ${notFoundReportTitles.join(', ')}.`;
                }
                break;

            case 'list_movies':
                if (movies.length > 0) {
                    const movieList = movies.map(m => `- **${m.title}** (Last seen: ${formatRelativeTime(m.lastSeen)})`).join('\n');
                    resultMessage = `Here are the user's current movies:\n${movieList}`;
                } else {
                    resultMessage = "The user currently has no movies in their library.";
                }
                break;

            case 'get_movie_subtitle_lines':
                const movieForSubs = movies.find(m => m.title.toLowerCase() === args.movieTitle.toLowerCase());

                if (!movieForSubs) {
                    resultMessage = `Error: Could not find a movie named "${args.movieTitle}".`;
                    break;
                }
                if (!movieForSubs.srtContent) {
                    resultMessage = `The movie "${args.movieTitle}" does not have any subtitles uploaded.`;
                    break;
                }

                const allLines = parseSrt(movieForSubs.srtContent);
                let filteredLines = allLines;

                if (args.fromLine || args.toLine) {
                    const from = args.fromLine || 1;
                    const to = args.toLine || allLines.length;
                    filteredLines = filteredLines.filter(line => {
                        const lineNum = parseInt(line.number, 10);
                        return lineNum >= from && lineNum <= to;
                    });
                } else if (args.fromTime || args.toTime) {
                    const fromSec = srtTimeToSeconds(args.fromTime);
                    // If no toTime, set a very large number to get everything after fromTime
                    const toSec = args.toTime ? srtTimeToSeconds(args.toTime) : Number.MAX_SAFE_INTEGER;
                    filteredLines = filteredLines.filter(line => {
                        const lineStartSec = srtTimeToSeconds(line.timestamp.split(' --> ')[0]);
                        return lineStartSec >= fromSec && lineStartSec <= toSec;
                    });
                }

                if (filteredLines.length > 0) {
                    resultMessage = `Here are the requested subtitle lines from "${args.movieTitle}":\n\n`;
                    resultMessage += filteredLines.map(line => `**[${line.number}]**\n> ${line.text}`).join('\n\n');
                } else {
                    resultMessage = `No subtitle lines were found for the specified range in "${args.movieTitle}".`;
                }
                break;

            default:
                resultMessage = `Error: Unknown function name "${functionName}".`;
        }
        if (success) {
            saveDecksToStorage();
                applyDeckFilters();
            renderChatHistory();
        }

        return { output: resultMessage };
    }

        async function handleSendMessage() {
        const text = fullChatElements.textarea.value.trim();
        if (text === '' || !activeConversationId) return;
        
        const conv = conversations.find(c => c.id === activeConversationId);
        if (!conv) return;

        // --- Add User Message to State ---
        if (editingMessageId) {
            const messageIndex = conv.messages.findIndex(m => m.id === editingMessageId);
            if (messageIndex > -1) {
                conv.messages[messageIndex].content = text;
                conv.messages.splice(messageIndex + 1); // Remove subsequent messages
            }
            editingMessageId = null;
        } else {
            if (conv.title === "New Chat") {
                generateChatTitle(text).then(newTitle => {
                    if (conv) { conv.title = newTitle; saveConversationsToStorage(); renderChatHistory(); }
                });
            }
            conv.messages.push({ id: String(Date.now()), role: 'user', content: text });
        }
        
        // --- Update UI Immediately ---
        renderConversation();
        saveConversationsToStorage();
        fullChatElements.textarea.value = '';
        fullChatElements.textarea.style.height = 'auto';
        appendChatMessage('ai', '', true); // Show typing indicator

        try {
            let finalResponse = '';
            const aiMessageId = String(Date.now());
            
            // --- CORE LOGIC: Check the selected model ---
            if (conv.model === 'GeminiAgent') {
                if (!genAI) throw new Error("Gemini API key not found or invalid. Please set it in Settings.");

                let history = conv.messages.map(({ role, content }) => ({ role: role === 'user' ? 'user' : 'model', parts: [{ text: content }] }));
                history.pop(); // Remove the user message we just added, as it's the "current" message

                // --- FIX: Ensure first message is from 'user' ---
                if (history.length > 0 && history[0].role === 'model') {
                    history.shift(); // Removes the initial greeting from the model
                }

                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                const chat = model.startChat({ history, tools: GEMINI_AGENT_TOOLS });
                const result = await chat.sendMessage(text);
                const response = result.response;
                const responseContent = response.candidates[0].content;
                
                if (responseContent.parts[0].functionCall) {
                    const { name, args } = responseContent.parts[0].functionCall;
                    const functionResult = await executeAppFunction(name, args);
                    const result2 = await chat.sendMessage([{ functionResponse: { name, response: functionResult } }]);
                    finalResponse = result2.response.candidates[0].content.parts[0].text;
                } else {
                    finalResponse = response.text();
                }

            } else if (conv.model === 'Groq') {
                if (!groqApiKey) throw new Error("Groq API Key is not set. Please add it in Settings.");
                
                const groqHistory = conv.messages.map(({ role, content }) => ({
                    role: role === 'model' ? 'assistant' : 'user', // Groq uses 'assistant'
                    content: content
                }));

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: groqHistory, model: "llama3-8b-8192" })
                });
                if (!response.ok) throw new Error((await response.json()).error.message);
                const data = await response.json();
                finalResponse = data.choices[0].message.content;

            } else {
                throw new Error(`Unknown model selected: ${conv.model}`);
            }

            // --- Update state and UI with the final response ---
            document.getElementById('main-typing-indicator')?.remove();
            conv.messages.push({ id: aiMessageId, role: 'model', content: finalResponse });
            appendChatMessage('ai', finalResponse, false, aiMessageId);
            saveConversationsToStorage();

        } catch (error) {
            console.error("Chat Error:", error);
            document.getElementById('main-typing-indicator')?.remove();
            conv.messages.pop(); // Rollback user message on error
            saveConversationsToStorage();
            renderConversation();
            fullChatElements.textarea.value = text;
            alert(`An API error occurred: ${error.message}\n\nYour message has been restored. Please check your API key and try again.`);
        }
    }
    // handleRegenerate can be simplified or removed for now as it's complex with function calling
    async function handleRegenerate() {
        alert("Regeneration is not supported in agent mode yet.");
    }

    function createNewChat() {
        const newConversation = { 
            id: String(Date.now()), 
            title: "New Chat", 
            model: 'GeminiAgent', // Default to the agent-powered model
            messages: [{ role: 'model', content: 'Hello! I am your AI assistant. How can I help you manage your decks today?' }] 
        };
        conversations.unshift(newConversation);
        activeConversationId = newConversation.id;
        saveConversationsToStorage();
        renderConversation();
    }
    
    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // --- Global Click Listener for Menus ---
        document.addEventListener('click', (e) => {
            if (!activeMenu.element) return;
            
            // Logic for deck options menus
            if (activeMenu.type === 'options' && !e.target.closest('.options-container')) {
                closeActiveMenu();
            }
            // Logic for chat popovers
            if (activeMenu.type === 'popover' && !e.target.closest('.popover') && !e.target.closest('.popover-toggle')) {
                closeActiveMenu();
            }
        });
        
        // --- Navigation ---
        navLinks.home.addEventListener('click', (e) => { e.preventDefault(); showMainScreen(screens.home, navLinks.home); });
        // --- Deck Screen Filter Pills ---
        document.getElementById('deck-filter-pills-container').addEventListener('click', (e) => {
            const pill = e.target.closest('.filter-pill');
            if (!pill) return;

            // Update the active filter state
            activeDeckFilter = pill.dataset.filter;

            // Update the UI for the pills
            document.querySelectorAll('#deck-filter-pills-container .filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Apply the filter and re-render the decks
            applyDeckFilters();
        });
        navLinks.decks.addEventListener('click', (e) => { e.preventDefault(); showMainScreen(screens.decks, navLinks.decks); });
        navLinks.chat.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (!navigator.onLine) {
                alert("The AI Chat feature requires an internet connection.");
                return;
            }
            showMainScreen(screens.chat, navLinks.chat); 
        });
        navLinks.movie.addEventListener('click', (e) => { e.preventDefault(); showMainScreen(screens.movieList, navLinks.movie); });
        navLinks.settings.addEventListener('click', (e) => { e.preventDefault(); showMainScreen(screens.settings, navLinks.settings); });
        
        // --- Settings & Theme ---
        document.getElementById('theme-toggle-btn').addEventListener('click', () => { const html = document.documentElement; html.classList.toggle('dark-theme'); const isDark = html.classList.contains('dark-theme'); localStorage.setItem('wordwiseTheme', isDark ? 'dark' : 'light'); applySavedTheme(); });
        document.getElementById('save-groq-api-key-btn').addEventListener('click', () => { const key = document.getElementById('groq-api-key-input').value.trim(); groqApiKey = key; saveApiKeyToStorage(key, 'Groq'); alert('Groq API Key saved!'); });
                        document.getElementById('save-gemini-api-key-btn').addEventListener('click', () => { 
            const key = document.getElementById('gemini-api-key-input').value.trim(); 
            geminiApiKey = key; 
            saveApiKeyToStorage(key, 'Gemini'); 
            
            // --- The Fix ---
            // Re-initialize the Gemini AI client with the new key.
            if (geminiApiKey && window.GoogleGenerativeAI) {
                try {
                    genAI = new window.GoogleGenerativeAI(geminiApiKey);
                    alert('Gemini API Key saved and client updated!');
                } catch (error) {
                    alert('There was an error initializing the Gemini client. Please check your key.');
                    console.error("Gemini Init Error:", error);
                }
            } else {
                alert('Gemini API Key saved!');
            }
        });
        document.getElementById('save-unsplash-api-key-btn').addEventListener('click', () => { 
            const key = document.getElementById('unsplash-api-key-input').value.trim(); 
            unsplashApiKey = key; 
            saveApiKeyToStorage(key, 'Unsplash');
            alert('Unsplash API Key saved!'); 
        });
        
        document.getElementById('save-omdb-api-key-btn').addEventListener('click', () => {
            const key = document.getElementById('omdb-api-key-input').value.trim();
            omdbApiKey = key;
            saveApiKeyToStorage(key, 'Omdb');
            alert('OMDb API Key saved!');
        });
        
        // --- Modal & Deck Creation ---
        document.body.addEventListener('click', (e) => {
            const practiceBtn = e.target.closest('.practice-btn');
            if (practiceBtn) {
                e.preventDefault();
                e.stopPropagation();
                closeActiveMenu();
                const card = practiceBtn.closest('[data-deck-id]');
                if (card) {
                    const deckId = card.dataset.deckId;
                    startAiPracticeSession(deckId);
                }
                return;
            }
            const testBtn = e.target.closest('.test-btn');
            if (testBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!navigator.onLine) {
                    alert("Quiz generation requires an internet connection.");
                    closeActiveMenu();
                    return;
                }
                closeActiveMenu();
                const card = testBtn.closest('[data-deck-id]');
                if(card) quizDeckId = card.dataset.deckId;
                showModal(screens.testType);
            }
            if(e.target.closest('#start-tf-quiz-btn')) { e.preventDefault(); if(quizDeckId) startQuiz(quizDeckId); }
            if(e.target.closest('#start-mc-quiz-btn')) { e.preventDefault(); if(quizDeckId) startMcQuiz(quizDeckId); }
            if(e.target.closest('#close-quiz-btn')) { e.preventDefault(); closeAllModals(); showMainScreen(screens.decks, navLinks.decks); }
            if (e.target.closest('#add-deck-btn')) {
                e.preventDefault();
                resetCreateDeckModal();
                showModal(screens.deckType);
                return; // IMPORTANT: Stop further execution in this click event
            }
            const deckTypeChoice = e.target.closest('#deck-type-screen .list-option');
            if (deckTypeChoice) {
                e.preventDefault();
                if (deckTypeChoice.id === 'create-deck-vocabulary') newDeckData.type = 'Vocabulary';
                if (deckTypeChoice.id === 'create-deck-expressions') newDeckData.type = 'Expressions';
                if (deckTypeChoice.id === 'create-deck-subtitle') newDeckData.type = 'Subtitle';
                showModal(screens.createDeck);
                return; // Stop further execution
            }
            if (e.target.closest('#deck-type-screen [data-action="close-modal"]')) {
                e.preventDefault();
                closeAllModals();
                showMainScreen(screens.decks, navLinks.decks);
                return;
            }
            if (e.target.closest('#add-manually-btn')) { e.preventDefault(); newDeckData.title = document.getElementById('deck-title-input').value; newDeckData.description = document.getElementById('deck-description-input').value; showModal(screens.addWordsManually); }
            if (e.target.closest('#close-create-deck-btn')) { e.preventDefault(); closeAllModals(); showMainScreen(screens.decks, navLinks.decks); }
            if (e.target.closest('#back-to-create-deck-btn')) { e.preventDefault(); showModal(screens.createDeck); }
            if (e.target.closest('#save-manual-words-btn')) { e.preventDefault(); saveManualWords(); }
            if (e.target.closest('#import-from-list-btn')) { e.preventDefault(); document.getElementById('import-file-input').click(); }
            if (e.target.closest('#create-deck-submit-btn')) { e.preventDefault(); submitDeck(); }
                     // Handle specific back buttons first
            const movieDetailBackBtn = e.target.closest('#movie-detail-screen .close-modal-btn');
            if (movieDetailBackBtn) {
                e.preventDefault();
                closeAllModals(true); // true = return to last active screen (movie list)
                return;
            }

            const moviePlayerBackBtn = e.target.closest('#movie-player-screen .close-modal-btn');
            if (moviePlayerBackBtn) {
                e.preventDefault();
                // When going back from player, we want to see the movie detail, not the list
                showModal(screens.movieDetail);
                return;
            }

            // --- Generic Modal Close Button Logic (for quizzes, etc.) ---
            const genericCloseBtn = e.target.closest('.close-modal-btn');
            if (genericCloseBtn) {
                e.preventDefault();
                closeAllModals(); // This closes the modal
                // This part handles returning to a default screen (like 'decks' after a quiz)
                const destination = genericCloseBtn.dataset.destination || 'decks'; 
                showMainScreen(screens[destination] || screens.decks, navLinks[destination] || navLinks.decks);
            }
        });
        
        // --- Quiz Flow ---
        document.getElementById('true-btn').addEventListener('click', () => handleAnswer(true));
        document.getElementById('false-btn').addEventListener('click', () => handleAnswer(false));
        document.getElementById('quiz-done-btn').addEventListener('click', () => { closeAllModals(); showMainScreen(screens.decks, navLinks.decks); });
        
        // MC Quiz Listeners
        document.getElementById('close-mc-quiz-btn').addEventListener('click', () => { closeAllModals(); showMainScreen(screens.decks, navLinks.decks); });
        document.getElementById('mc-quiz-options-container').addEventListener('click', handleMcOptionSelect);
        document.getElementById('mc-quiz-submit-btn').addEventListener('click', handleMcSubmit);
        
        // --- Deck Interaction ---
        document.getElementById('delete-deck-btn').addEventListener('click', handleDeleteDeck);
        document.getElementById('home-decks-container').addEventListener('click', handleDeckClick);
        document.getElementById('view-all-decks-btn').addEventListener('click', (e) => { e.preventDefault(); showMainScreen(screens.decks, navLinks.decks); });
        document.getElementById('decks-grid-container').addEventListener('click', handleDeckGridClick);
        document.getElementById('back-to-decks-btn').addEventListener('click', e => { e.preventDefault(); showMainScreen(screens.decks, navLinks.decks); });
        
        // --- Flashcard Interaction ---
        document.getElementById('home-i-dont-know-btn').addEventListener('click', () => handleHomeAnswer(false));
        document.getElementById('home-i-know-btn').addEventListener('click', () => handleHomeAnswer(true));
        function handleHomeAnswer(knewIt) {
            const flashcard = document.getElementById('flashcard');
            const homeWord = currentDeckState.homeWord;
            if (homeWord) {
                const deck = decks.find(d => d.id === homeWord.deckId);
                const wordInDeck = deck?.words.find(w => w.text === homeWord.text);
                if (wordInDeck) {
                    updateWordMastery(wordInDeck, knewIt);
                    saveDecksToStorage();
                }
            }
            flashcard.querySelector('.flashcard-inner').classList.add('is-flipped');
            setTimeout(() => { displayHomeFlashcard(); }, 1200);
        }

        const handleDeckAnswer = (knewIt) => {
            if (!currentDeckState.deck || !currentDeckState.currentWord) return;

            // 1. Update mastery and save
            updateWordMastery(currentDeckState.currentWord, knewIt);
            saveDecksToStorage();
            
            // 2. Flip the card to show the answer as feedback
            document.querySelector('#deck-flashcard-view .flashcard-inner').classList.add('is-flipped');

            // 3. Wait a moment, then proceed to the next card
            setTimeout(() => {
                // 4. Select the next word
                currentDeckState.currentWord = selectNextWord(currentDeckState.deck);
                
                // 5. UN-FLIP the card for the new word before displaying it
                document.querySelector('#deck-flashcard-view .flashcard-inner').classList.remove('is-flipped');
                
                // 6. Display the new word's content
                displayDeckWord();
            }, 1200);
        };
        document.getElementById('deck-i-dont-know-btn').addEventListener('click', () => handleDeckAnswer(false));
        document.getElementById('deck-i-know-btn').addEventListener('click', () => handleDeckAnswer(true));

        // --- View Deck Screen Toggles ---
        const flashcardModeBtn = document.getElementById('deck-flashcard-mode-btn');
        const definitionModeBtn = document.getElementById('deck-definition-mode-btn');
        const deckFlashcardView = document.getElementById('deck-flashcard-view');
        const deckDefinitionView = document.getElementById('deck-definition-view');
        flashcardModeBtn.addEventListener('click', () => { deckViewMode = 'flashcard'; flashcardModeBtn.classList.add('active'); definitionModeBtn.classList.remove('active'); deckFlashcardView.classList.add('active'); deckDefinitionView.classList.remove('active'); });
        definitionModeBtn.addEventListener('click', () => { deckViewMode = 'definition'; flashcardModeBtn.classList.remove('active'); definitionModeBtn.classList.add('active'); deckFlashcardView.classList.remove('active'); deckDefinitionView.classList.add('active'); });
        deckFlashcardView.addEventListener('click', () => { deckFlashcardView.querySelector('.flashcard-inner').classList.toggle('is-flipped'); });

        // --- Search & Import ---
        mainSearchInput.addEventListener('input', handleSearch);
        searchResultsContainer.addEventListener('click', handleSearchResultClick);
                document.getElementById('import-file-input').addEventListener('change', handleFileImport);
        
        // --- Movie Feature Listeners ---
        document.getElementById('movie-list-search-input').addEventListener('input', handleMovieSearch);
        document.getElementById('srt-upload-input').addEventListener('change', handleSrtUpload);

        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#add-movie-btn')) {
                foundMovieData = null;
                document.getElementById('movie-search-input').value = '';
                document.getElementById('movie-search-status').textContent = '';
                document.getElementById('api-search-result').style.display = 'none';
                document.getElementById('manual-entry-form').style.display = 'none';
                ['manual-movie-title', 'manual-movie-description', 'manual-movie-poster'].forEach(id => document.getElementById(id).value = '');
                showModal(screens.addMovie);

                // Offline check for OMDb search
                if (!navigator.onLine) {
                    document.getElementById('movie-search-input').disabled = true;
                    document.getElementById('movie-search-btn').disabled = true;
                    document.getElementById('movie-search-status').textContent = 'OMDb search is unavailable offline.';
                    document.getElementById('manual-entry-form').style.display = 'block';
                }
            }

            const movieCard = e.target.closest('.movie-card');
            if (movieCard && !e.target.closest('.options-container')) {
                showMovieDetail(movieCard.dataset.id);
            }

            if (e.target.closest('.movie-options-btn')) {
                 e.preventDefault(); e.stopPropagation();
                 const menu = e.target.closest('.options-container').querySelector('.options-menu');
                 toggleMenu(menu, 'options');
            }

            if (e.target.closest('.upload-srt-btn')) {
                e.preventDefault();
                currentMovieId = e.target.closest('.movie-card').dataset.id;
                document.getElementById('srt-upload-input').click();
            }
            const deleteMovieBtn = e.target.closest('.delete-movie-btn');
            if (deleteMovieBtn) {
                e.preventDefault();
                e.stopPropagation(); // Prevent the card click from firing
                closeActiveMenu();
                const movieId = deleteMovieBtn.closest('.movie-card').dataset.id;
                handleDeleteMovie(movieId);
                return; // Stop further processing
            }

            
            if (e.target.closest('.create-deck-from-movie-btn')) {
                e.preventDefault();
                const movie = movies.find(m => m.id === e.target.closest('.movie-card').dataset.id);
                if (movie) {
                    // Check if a deck for this movie already exists
                    let movieDeck = decks.find(d => d.title === movie.title && d.type === 'Subtitle');
                    if (!movieDeck) {
                        // Create a new, completely empty deck
                        movieDeck = {
                            id: 'deck_' + movie.id,
                            title: movie.title,
                            description: movie.description || `Subtitles from the movie ${movie.title}.`, // Use movie's plot
                            words: [], // START EMPTY
                            type: 'Subtitle',
                            imageUrl: movie.poster,
                            createdAt: new Date().toISOString(), // Add creation timestamp
                            lastSeen: null // Add last seen timestamp
                        };
                        decks.unshift(movieDeck);
                        saveDecksToStorage();
                        applyDeckFilters(); // Update the main decks view
                        alert(`Deck "${movie.title}" created. Now opening subtitles...`);
                    } else {
                        alert(`Deck "${movie.title}" already exists. Opening subtitles...`);
                    }
                    // Set the current movie context and open the player
                    currentMovieId = movie.id;
                    playSubtitles();
                }
            }

            if (e.target.closest('#movie-search-btn')) { handleOMDbSearch(); }
            if (e.target.closest('#add-movie-submit-btn')) { handleAddMovieSubmit(); }
            if (e.target.closest('#play-subtitles-btn')) { playSubtitles(); }
                 const subtitleAddBtn = e.target.closest('.subtitle-add-btn');
            if (subtitleAddBtn && !subtitleAddBtn.disabled) { 
                addSubtitleToDeck(subtitleAddBtn.dataset.text, subtitleAddBtn.dataset.timestamp, subtitleAddBtn); 
            }
        });
        
        // --- Miscellaneous Listeners ---
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.addEventListener('click', (e) => {
                if (flashcard.closest('.flashcard-wrapper.chat-active')) return;
                if (!e.target.closest('.flashcard-option-item, .flashcard-options-toggle')) {
                    flashcard.querySelector('.flashcard-inner').classList.toggle('is-flipped');
                }
            });
        }
        const flashcardOptionsToggle = document.querySelector('.flashcard-options-toggle');
        if (flashcardOptionsToggle) {
            flashcardOptionsToggle.addEventListener('click', () => {
                flashcardOptionsToggle.classList.toggle('active');
                flashcardOptionsToggle.nextElementSibling.classList.toggle('active');
            });
        }
    }

    // ========================================================================
    // --- MULTIPLE CHOICE QUIZ LOGIC ---
    // ========================================================================
    async function startMcQuiz(deckId) {
        const deck = decks.find(d => d.id === deckId);
        if (!deck || deck.words.length < 5) {
            alert("This deck needs at least 5 words to generate a quiz.");
            return;
        }
        quizDeckId = deckId;
        showModal(screens.mcQuiz);
        // Reset UI to "Loading" state
        document.getElementById('mc-quiz-definition').textContent = "Generating Quiz...";
        document.getElementById('mc-quiz-options-container').innerHTML = '';
        document.getElementById('mc-quiz-submit-btn').disabled = true;

        const prioritizedWords = selectPrioritizedWordsForQuiz(deck, 15);
        const wordList = prioritizedWords.join(', ');
        
        const prompt = `Based on this list of vocabulary words: [${wordList}], create a 5-question multiple choice quiz. For each question, provide a definition and four words as options: one correct word and three plausible but incorrect distractors from the provided list. Respond ONLY with a valid JSON object with a single key "questions" which is an array of objects. Each object must have four keys: a 'definition' (string), an 'options' (an array of 4 strings), a 'correct_answer' (string, which is the correct word), and a concise 'explanation' (string) detailing why the correct word matches the definition. Do not include any other text or markdown formatting.`;

        const quizData = await getQuizFromAI(prompt);
        if (quizData && quizData.questions && quizData.questions.length > 0) {
            currentQuiz = quizData.questions;
            currentQuestionIndex = 0;
            quizScore = 0;
            userQuizAnswers = [];
            displayMcQuestion();
        } else {
            alert("Sorry, I couldn't create a quiz right now. Please check your API key or try again.");
            closeAllModals();
            showMainScreen(screens.decks, navLinks.decks);
        }
    }

    function displayMcQuestion() {
        // Reset state for the new question
        currentMcChoice = null;
        document.getElementById('mc-quiz-submit-btn').disabled = true;

        const question = currentQuiz[currentQuestionIndex];
        document.getElementById('mc-quiz-definition').textContent = question.definition;

        // Update progress bar
        const progress = ((currentQuestionIndex + 1) / currentQuiz.length) * 100;
        document.getElementById('mc-quiz-progress-text').textContent = `Question ${currentQuestionIndex + 1} of ${currentQuiz.length}`;
        document.getElementById('mc-quiz-progress-bar').style.width = `${progress}%`;

        // Render options
        const optionsContainer = document.getElementById('mc-quiz-options-container');
        optionsContainer.innerHTML = '';
        const questionName = `mc-q-${currentQuestionIndex}`; // Unique name for radio group

        question.options.forEach(optionText => {
            const optionId = `mc-option-${optionText.replace(/\s+/g, '-')}`;
            const label = document.createElement('label');
            label.className = 'mc-option-label';
            label.htmlFor = optionId;
            label.innerHTML = `
                <input type="radio" name="${questionName}" id="${optionId}" value="${optionText}" class="mc-option-input">
                <span class="mc-radio-custom"></span>
                <span class="mc-option-text">${optionText}</span>
            `;
            optionsContainer.appendChild(label);
        });
    }

    function handleMcOptionSelect(e) {
        const label = e.target.closest('.mc-option-label');
        if (!label) return;

        // Remove 'selected' from all other labels
        document.querySelectorAll('.mc-option-label').forEach(l => l.classList.remove('selected'));
        // Add 'selected' to the clicked label
        label.classList.add('selected');

        const input = label.querySelector('input[type="radio"]');
        if (input) {
            currentMcChoice = input.value;
            document.getElementById('mc-quiz-submit-btn').disabled = false;
        }
    }

    function handleMcSubmit() {
        if (!currentMcChoice) return;

        const question = currentQuiz[currentQuestionIndex];
        const wasCorrect = currentMcChoice === question.correct_answer;

        // Provide visual feedback
        const labels = document.querySelectorAll('.mc-option-label');
        labels.forEach(label => {
            const input = label.querySelector('input');
            if (input.value === question.correct_answer) {
                label.classList.add('correct');
            } else if (input.value === currentMcChoice && !wasCorrect) {
                label.classList.add('incorrect');
            }
            // Disable further clicks
            label.style.pointerEvents = 'none';
        });

        if (wasCorrect) {
            quizScore++;
        }
        userQuizAnswers.push({
            ...question,
            user_answer: currentMcChoice,
            is_correct: wasCorrect
        });

        // Move to the next question or show review after a delay
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < currentQuiz.length) {
                displayMcQuestion();
                 // Re-enable clicks for the new question
                document.querySelectorAll('.mc-option-label').forEach(label => label.style.pointerEvents = 'auto');
            } else {
                // We need a generic review screen that can handle both quiz types
                renderGenericReviewScreen(); 
            }
        }, 2000); // 2-second delay to see the result
    }

    // --- Home Screen Flashcard Chat Interface ---
function setupChatInterface() {
    const askAiBtn = document.getElementById('ask-ai-btn');
    const geminiBtn = document.getElementById('gemini-btn');

    const redirectToChat = (e, provider) => {
        e.preventDefault();
        e.stopPropagation();

        if (!navigator.onLine) {
            alert("This feature requires an internet connection.");
            const menu = e.target.closest('.flashcard-options-menu');
            if (menu) menu.classList.remove('active');
            const toggle = e.target.closest('.flashcard-wrapper').querySelector('.flashcard-options-toggle');
            if (toggle) toggle.classList.remove('active');
            return;
        }

        // Close the options menu on the flashcard
        const menu = e.target.closest('.flashcard-options-menu');
        if (menu) menu.classList.remove('active');
        const toggle = e.target.closest('.flashcard-wrapper').querySelector('.flashcard-options-toggle');
        if (toggle) toggle.classList.remove('active');

        const word = document.getElementById('home-flashcard-term').textContent;
        if (!word || word === 'No words yet' || word === 'All Done!') {
            alert("Please select a word on the flashcard first.");
            return;
        }

        let initialPrompt = '';
        if (provider === 'groq') { // 'groq' is the "Ask AI" button
            initialPrompt = `Tell me more about the word "${word}". Give me a simple definition, a synonym, and use it in a sentence.`;
        } else { // 'gemini' is the Gemini button
            initialPrompt = `What is the Amharic definition for the English word "${word}"?`;
        }
        
        // Create a new conversation object
        const newConversation = {
            id: String(Date.now()),
            title: `About: ${word}`,
            model: 'Gemini', // The agent model is Gemini
            messages: [] // Start with no messages
        };
        
        conversations.unshift(newConversation);
        activeConversationId = newConversation.id;
        saveConversationsToStorage();
        
        // Switch to the main chat screen
        showMainScreen(screens.chat, navLinks.chat);
        
        // Pre-fill the chat input and send the message automatically
        const mainChatTextarea = document.getElementById('main-chat-textarea');
        mainChatTextarea.value = initialPrompt;
        handleSendMessage();
    };

    askAiBtn.addEventListener('click', (e) => redirectToChat(e, 'groq'));
    geminiBtn.addEventListener('click', (e) => redirectToChat(e, 'gemini'));
}
    
    // --- Event Handler Functions ---
    function handleDeckClick(e) { const card = e.target.closest('[data-deck-id]'); if (card) { const deckId = card.dataset.deckId; const deck = decks.find(d => d.id == deckId); if (deck) openDeck(deck); } }
    function handleDeckGridClick(e) { const optionsBtn = e.target.closest('.deck-options-btn'); const cardImage = e.target.closest('.grid-deck-image-wrapper'); if (optionsBtn) { e.preventDefault(); e.stopPropagation(); const optionsContainer = optionsBtn.closest('.options-container'); if (optionsContainer) { const menu = optionsContainer.querySelector('.options-menu'); if (menu) { toggleMenu(menu, 'options'); } } return; } const menuItem = e.target.closest('.option-item'); if (menuItem) { if (menuItem.classList.contains('edit-btn')) { e.preventDefault(); e.stopPropagation(); closeActiveMenu(); handleEditClick(e); } return; } if (cardImage) { e.preventDefault(); handleDeckClick(e); } }
    function handleSearchResultClick(e) { e.preventDefault(); const resultItem = e.target.closest('.search-result-item'); if (!resultItem) return; const { wordDeckId, word } = resultItem.dataset; const deckToOpen = decks.find(d => d.id == wordDeckId); if (deckToOpen) { openDeck(deckToOpen, word || null); } }
    function handleEditClick(e) {
    const card = e.target.closest('[data-deck-id]');
    if (!card) return;
    const deckId = card.dataset.deckId;
    const deckToEdit = decks.find(d => d.id == deckId);
    if (!deckToEdit) return;

    resetCreateDeckModal();
    currentEditDeckId = deckToEdit.id;
    newDeckData.type = deckToEdit.type || 'Vocabulary';

    document.getElementById('deck-title-input').value = deckToEdit.title;
    document.getElementById('deck-description-input').value = deckToEdit.description;
    document.getElementById('manual-words-textarea').value = deckToEdit.words.map(w => w.text).join('\n');
    newDeckData.words = [...deckToEdit.words]; // This tracks existing words for editing
    newDeckData.rawWordStrings = []; // Reset any staged new words

    document.getElementById('add-manually-btn').querySelector('.list-option-text').textContent = `Add/Edit Manually (${newDeckData.words.length} words)`;
    document.getElementById('create-deck-modal-title').textContent = 'Edit Deck';
    document.getElementById('create-deck-submit-btn').textContent = 'Save Changes';
    document.getElementById('delete-deck-btn').style.display = 'flex';
    showModal(screens.createDeck);
}

function resetCreateDeckModal() {
    currentEditDeckId = null;
    newDeckData = { title: '', description: '', words: [], rawWordStrings: [], type: 'Vocabulary' };
    const titleInput = document.getElementById('deck-title-input');
    if (titleInput) {
        titleInput.value = '';
        document.getElementById('deck-description-input').value = '';
        document.getElementById('manual-words-textarea').value = '';
        document.getElementById('add-manually-btn').querySelector('.list-option-text').textContent = 'Add Manually';
        document.getElementById('import-from-list-btn').querySelector('.list-option-text').textContent = 'Import from List';
        document.getElementById('create-deck-modal-title').textContent = 'Create Deck';
        document.getElementById('create-deck-submit-btn').textContent = 'Create Deck';
        document.getElementById('delete-deck-btn').style.display = 'none';
    }
}

// New helper to create placeholder word objects
function createPlaceholderWordObjects(wordStrings) {
    return wordStrings.map(text => ({
        text,
        masteryLevel: 0,
        lastSeen: null,
        imageUrl: null,
        definitions: { flashcard: null, detailed: null, gemini: null }
    }));
}



function saveManualWords() {
    const words = document.getElementById('manual-words-textarea').value.split('\n').map(w => w.trim()).filter(Boolean);
    newDeckData.rawWordStrings = words;
    document.getElementById('add-manually-btn').querySelector('.list-option-text').textContent = `Add/Edit Manually (${words.length} words staged)`;
    showModal(screens.createDeck);
}

function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // We now handle both raw text words and pre-filled words from CSV
    newDeckData.words = []; // Clear any previously staged words
    
    if (file.name.endsWith('.csv')) {
        // Use PapaParse for CSV files
        Papa.parse(file, {
            header: true, // Assumes first row is headers (e.g., "word", "english_definition", "amharic_definition")
            skipEmptyLines: true,
            complete: (results) => {
                newDeckData.words = results.data.map(row => {
                    const wordText = row.word || row.Word;
                    if (!wordText) return null; // Skip rows without a word
                    return {
                        text: wordText.trim(),
                        masteryLevel: 0,
                        lastSeen: null,
                        imageUrl: null, // Will be fetched on-the-fly later
                        definitions: {
                            // Use provided data, otherwise set to null
                            flashcard: (row.english_definition || row.English_Definition || null),
                            detailed: null, // Always fetch detailed definition on-the-fly
                            gemini: (row.amharic_definition || row.Amharic_Definition || null)
                        }
                    };
                }).filter(Boolean); // Filter out any null rows

                document.getElementById('import-from-list-btn').querySelector('.list-option-text').textContent = `Import from List (${newDeckData.words.length} words staged)`;
                e.target.value = ''; // Reset file input
            },
            error: (err) => {
                alert('Error parsing CSV file: ' + err.message);
            }
        });
    } else {
        // Handle plain text files (.txt) as before
        const reader = new FileReader();
        reader.onload = (event) => {
            const wordStrings = event.target.result.split('\n').map(w => w.trim()).filter(Boolean);
            // Convert strings to placeholder objects immediately
            newDeckData.words = createPlaceholderWordObjects(wordStrings);
            document.getElementById('import-from-list-btn').querySelector('.list-option-text').textContent = `Import from List (${newDeckData.words.length} words staged)`;
            e.target.value = '';
        };
        reader.onerror = () => alert('Error reading file.');
        reader.readAsText(file);
    }
}

async function submitDeck() {
    const title = document.getElementById('deck-title-input').value.trim();
    if (!title) {
        alert('Please enter a deck title.');
        return;
    }

    const description = document.getElementById('deck-description-input').value.trim();
    const type = newDeckData.type;
    
    // Consolidate staged words from manual input and file imports
    let stagedWords = newDeckData.words || []; // From CSV/TXT import
    const manualWordsText = document.getElementById('manual-words-textarea').value;
    if (manualWordsText) {
        const manualWordStrings = manualWordsText.split('\n').map(w => w.trim()).filter(Boolean);
        const manualWordObjects = createPlaceholderWordObjects(manualWordStrings);
        stagedWords.push(...manualWordObjects);
    }

    if (currentEditDeckId) {
        const deckIndex = decks.findIndex(d => d.id == currentEditDeckId);
        if (deckIndex > -1) {
            const deck = decks[deckIndex];
            deck.title = title;
            deck.description = description;
            deck.type = type;

            // Add only new words to avoid duplicates
            const existingWordTexts = new Set(deck.words.map(w => w.text.toLowerCase()));
            const newWordsToAdd = stagedWords.filter(wordObj => !existingWordTexts.has(wordObj.text.toLowerCase()));
            deck.words.push(...newWordsToAdd);
        }
    } 
    else {
        // Create a new deck
        const newDeck = {
            id: String(Date.now()),
            title,
            description,
            words: stagedWords, // Add the staged words directly
            type,
            createdAt: new Date().toISOString(),
            lastSeen: null
        };
        decks.push(newDeck);
    }

    saveDecksToStorage();
        applyDeckFilters();
    closeAllModals();
    showMainScreen(screens.decks, navLinks.decks);
}
    function handleDeleteDeck() { if (!currentEditDeckId) return; if (confirm("Are you sure you want to delete this deck? This action cannot be undone.")) { decks = decks.filter(deck => deck.id !== currentEditDeckId); saveDecksToStorage(); renderAllDecks(); closeAllModals(); showMainScreen(screens.decks, navLinks.decks); } }
    
    // --- Initial Load ---
    function init() {
        

        // Load data from storage
        loadDecksFromStorage();
        loadMoviesFromStorage();
        loadConversationsFromStorage();
        loadApiKeysFromStorage();
        applySavedTheme();

        // Setup all event listeners
        setupEventListeners();
        setupChatInterface(); // For home screen flashcard
        setupFullChatEventListeners(); // For full chat screen
        
        // Initial UI rendering
            applyDeckFilters();
        renderMovies();
        displayHomeFlashcard();
        
        // Initialize chat state
        if (conversations.length === 0) {
            createNewChat(); // Creates and renders the first chat
        } else {
            activeConversationId = conversations[0].id;
            renderConversation();
        }

        // Show the initial screen
        showMainScreen(screens.home, navLinks.home);
    }

    init();
});