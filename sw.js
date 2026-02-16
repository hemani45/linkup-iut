const CACHE_NAME = 'linkup-iut-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './inscription.html',
  './inscription-enseignant.html',
  './login-enseignant.html',
  './dashboard-etudiant.html',
  './dashboard-enseignant.html',
  './firebase-config.js',
  './auth.js',
  './inscription-etudiant.js',
  './inscription-enseignant.js',
  './dashboard-etudiant.js',
  './dashboard-enseignant.js',
  './clubs.js',
  './messages.js',
  './logo.png',
  './favicon.ico'
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourne le fichier du cache s'il existe
        if (response) {
          return response;
        }
        // Sinon, va le chercher sur le réseau
        return fetch(event.request);
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});