const WHSF_CACHE_NAME = 'whsf-pwa-v166';
const WHSF_OFFLINE_URL = '/offline.html';

const WHSF_CORE_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/mobile-app.html',
  '/mobile-app-admin.html',
  '/programs.html',
  '/robotic-drone-programme.html',
  '/girls-in-ict-tech-excursion.html',
  '/media-information-library.html',
  '/media-information-library/',
  '/ai-career-connect/',
  '/ai-career-connect/index.html',
  '/ai-career-connect/styles.css',
  '/ai-career-connect/app.js',
  '/ai-career-connect/workspaces.css',
  '/ai-career-connect/resume-builder.html',
  '/ai-career-connect/resume-builder.js',
  '/ai-career-connect/interview-coach.html',
  '/ai-career-connect/interview-coach.js',
  '/ai-career-connect/skills-passport.html',
  '/ai-career-connect/skills-passport.js',
  '/innovation.html',
  '/contact.html',
  '/contact-reference.css',
  '/privacy-policy.html',
  '/child-safeguarding-policy.html',
  '/opportunities.html',
  '/innovation-support-building.html',
  '/student-projects.html',
  '/e-classroom.html',
  '/impact-dashboard.html',
  '/impact-data.js',
  '/impact-experience.js',
  '/impact-reference.css',
  '/milestone.css',
  '/programme-girls-in-ict.html',
  '/programme-robotics-drones.html',
  '/programme-agrismart-ai.html',
  '/programme-ai-career-connect.html',
  '/governance.html',
  '/transparency.html',
  '/responsible-ai.html',
  '/newsroom.html',
  '/media-library.html',
  '/donor-portal.html',
  '/corporate-partnerships.html',
  '/partner-reference.css',
  '/content-data.js',
  '/content-hub.js',
  '/verify-certificate.html',
  '/styles.css',
  '/homepage-reference.css',
  '/about-reference.css',
  '/programs-reference.css',
  '/e-learning-reference.css',
  '/mil-platform.js',
  '/script.js',
  '/manifest.webmanifest',
  WHSF_OFFLINE_URL,
  '/assets/whsf-logo.jpg',
  '/assets/impact/whsf-girls-certificates-2026.jpg',
  '/assets/partners/whsf-partnership-recognition.jpg',
  '/assets/contact/whsf-contact-learner.jpg',
  '/assets/programs/whsf-drone-practical-header.jpg',
  '/assets/awards/london-data-center-world-award-2025-winner.jpg',
  '/assets/about/about-us-board.webp',
  '/assets/programs/ai-career-connect-social.png',
  '/assets/programs/agrismart-ai-programme.png',
  '/assets/programs/ai-career-connect-programme.png',
  '/assets/programs/media-information-library.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(WHSF_CACHE_NAME).then((cache) => cache.addAll(WHSF_CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== WHSF_CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  const shouldRefreshFirst =
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname === '/mobile-app' ||
    requestUrl.pathname === '/mobile-app-admin';

  if (event.request.mode === 'navigate' || shouldRefreshFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(WHSF_CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          return cachedPage || caches.match(WHSF_OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const responseCopy = response.clone();
          caches.open(WHSF_CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match(WHSF_OFFLINE_URL);
          }
          return Response.error();
        });
    })
  );
});
