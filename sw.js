// Service Worker for Chinese Character Learning App
const CACHE_NAME = 'chinese-chars-v1';
const STATIC_CACHE = 'static-v1';

// Core app files that should always be cached
const CORE_FILES = [
    '/',
    '/index.html',
    '/app.js',
    '/chars_data.js',
    '/style.css'
];

// Install event - cache core files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching core app files');
                return cache.addAll(CORE_FILES);
            })
            .then(() => {
                console.log('Service worker installed and core files cached');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        // Delete old versions of caches
                        return cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME;
                    })
                    .map(cacheName => {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('Service worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Handle GIF files (stroke order images)
    if (request.url.includes('/img/') && request.url.endsWith('.gif')) {
        event.respondWith(
            caches.open(CACHE_NAME)
                .then(cache => {
                    return cache.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }

                            // Not in cache, fetch from network
                            return fetch(request)
                                .then(response => {
                                    // Only cache successful responses
                                    if (response.status === 200) {
                                        cache.put(request, response.clone());
                                    }
                                    return response;
                                })
                                .catch(() => {
                                    // Return a placeholder or error response if offline
                                    return new Response('Image not available offline', {
                                        status: 404,
                                        statusText: 'Not Found'
                                    });
                                });
                        });
                })
        );
        return;
    }

    // Handle core app files
    if (CORE_FILES.some(file => request.url.endsWith(file) || (file === '/' && request.url.endsWith('/index.html')))) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    return cachedResponse || fetch(request);
                })
        );
        return;
    }

    // For all other requests, try network first, then cache
    event.respondWith(
        fetch(request)
            .catch(() => {
                return caches.match(request);
            })
    );
});

// Message handling for cache management
self.addEventListener('message', (event) => {
    const { data } = event;

    if (data.type === 'CACHE_GIFS') {
        const { gifs } = data;
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => {
                    const requests = gifs.map(gif => new Request(gif));
                    return Promise.all(
                        requests.map(request =>
                            fetch(request)
                                .then(response => {
                                    if (response.status === 200) {
                                        return cache.put(request, response);
                                    }
                                })
                                .catch(err => {
                                    console.log('Failed to cache:', request.url);
                                })
                        )
                    );
                })
                .then(() => {
                    console.log(`Cached ${gifs.length} GIF files`);
                    event.ports[0].postMessage({ success: true });
                })
                .catch(err => {
                    console.error('Error caching GIFs:', err);
                    event.ports[0].postMessage({ success: false, error: err.message });
                })
        );
    }

    if (data.type === 'GET_CACHE_STATUS') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => cache.keys())
                .then(keys => {
                    const cachedGifs = keys
                        .filter(request => request.url.includes('/img/') && request.url.endsWith('.gif'))
                        .map(request => request.url);

                    event.ports[0].postMessage({
                        cachedCount: cachedGifs.length,
                        cachedGifs: cachedGifs
                    });
                })
        );
    }
});