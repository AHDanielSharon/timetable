const CACHE_NAME = 'timetable-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon-192.svg', './icons/icon-512.svg'];

let scheduleData = null;
let lastNotifiedKey = null;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_SCHEDULE') {
    scheduleData = event.data.payload;
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'timetable-period-check') {
    event.waitUntil(notifyCurrentPeriod());
  }
});

async function notifyCurrentPeriod() {
  if (!scheduleData) return;
  const now = new Date();
  const day = scheduleData.dayNames[now.getDay()];
  const schedule = scheduleData.weekly[day];
  if (!schedule) return;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayStart = toMinutes('08:00');
  const dayEnd = toMinutes('15:20');
  if (minutes < dayStart || minutes >= dayEnd) return;

  for (const slot of scheduleData.periods) {
    const [start, end] = slot.time.split('-').map(toMinutes);
    if (minutes >= start && minutes < end) {
      const subject = slot.isBreak ? slot.label.toUpperCase() : schedule[slot.id] || 'Free';
      const key = `${day}-${slot.id}`;
      if (lastNotifiedKey === key) return;
      lastNotifiedKey = key;

      await self.registration.showNotification(`Now: ${subject}`, {
        body: `${day} · ${slot.time}`,
        icon: 'icons/icon-192.svg',
        badge: 'icons/icon-192.svg',
        tag: key,
        renotify: true
      });
      return;
    }
  }
}

function toMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
