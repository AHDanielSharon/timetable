const periods = [
  { id: 1, label: '1', time: '08:00-08:50' },
  { id: 2, label: '2', time: '08:50-09:40' },
  { id: 'b1', label: 'Break', time: '09:40-10:10', isBreak: true },
  { id: 3, label: '3', time: '10:10-11:00' },
  { id: 4, label: '4', time: '11:00-11:50' },
  { id: 'b2', label: 'Break', time: '11:50-12:00', isBreak: true },
  { id: 5, label: '5', time: '12:00-12:50' },
  { id: 'lunch', label: 'Lunch', time: '12:50-13:40', isBreak: true },
  { id: 6, label: '6', time: '13:40-14:30' },
  { id: 7, label: '7', time: '14:30-15:20' },
  { id: 8, label: '8', time: '15:20-16:30' }
];

const weekly = {
  MONDAY: { 1: 'Graph Theory', 2: 'Free', 3: 'ADAA Lab (B1) / DMS Lab (B2)', 4: 'Free', 5: 'Analysis & Design of Algorithms', 6: 'Microcontrollers', 7: 'Database Management Systems', 8: 'Free' },
  TUESDAY: { 1: 'Microcontrollers (B2) / Database Management Systems (B1)', 2: 'Microcontrollers (B2) / Database Management Systems (B1)', 3: 'Database Management Systems', 4: 'Database Management Systems', 5: 'Analysis & Design of Algorithms', 6: 'AEC Vertical Level 2', 7: 'AEC Vertical Level 2', 8: 'Additional Mathematics-II' },
  WEDNESDAY: { 1: 'Yoga', 2: 'Yoga', 3: 'Biology for Engineers', 4: 'Graph Theory', 5: 'Microcontrollers (R)', 6: 'Counselling', 7: 'Microcontrollers', 8: 'Free' },
  THURSDAY: { 1: 'Microcontrollers', 2: 'Free', 3: 'Analysis & Design of Algorithms', 4: 'Biology for Engineers', 5: 'Database Management Systems (R)', 6: 'Microcontrollers (B2) / ADAA Lab (B1)', 7: 'Microcontrollers (B2) / ADAA Lab (B1)', 8: 'Additional Mathematics-II' },
  FRIDAY: { 1: 'Database Management Systems', 2: 'Library', 3: 'Analysis & Design of Algorithms', 4: 'Graph Theory', 5: 'Graph Theory (R)', 6: 'Free', 7: 'Universal Human Values Course', 8: 'Free' },
  SATURDAY: { 1: 'Free', 2: 'Free', 3: 'Free', 4: 'Free', 5: 'Free', 6: 'Free', 7: 'Free', 8: 'Free' }
};

const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const timetableEl = document.getElementById('timetable');
const currentSubjectEl = document.getElementById('currentSubject');
const currentTimeEl = document.getElementById('currentTime');
const nextSubjectEl = document.getElementById('nextSubject');
const nextTimeEl = document.getElementById('nextTime');
const notifyBtn = document.getElementById('notifyBtn');
const installBtn = document.getElementById('installBtn');
const bgHintEl = document.getElementById('bgHint');

let lastNotifiedKey = '';
let deferredInstallPrompt = null;
let boundaryTimer = null;

buildTable();
setupInstallPrompt();
setupNotificationPermission();
registerServiceWorker();
startTicker();

function buildTable() {
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  hRow.innerHTML = '<th>Day</th>';
  periods.forEach((slot) => {
    const th = document.createElement('th');
    th.innerHTML = `${slot.label}<br><small>${slot.time}</small>`;
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);

  const tbody = document.createElement('tbody');
  Object.entries(weekly).forEach(([day, schedule]) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="day">${day}</td>`;
    periods.forEach((slot) => {
      const td = document.createElement('td');
      if (slot.isBreak) {
        td.textContent = slot.label.toUpperCase();
        td.className = 'break';
      } else {
        td.textContent = schedule[slot.id] || 'Free';
        if (td.textContent === 'Free') td.className = 'empty';
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  timetableEl.append(thead, tbody);
}

function toMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentSlot(now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const day = dayNames[now.getDay()];
  const schedule = weekly[day];
  const dayStart = toMinutes('08:00');
  const dayEnd = toMinutes('15:20');

  if (!schedule || currentMinutes < dayStart || currentMinutes >= dayEnd) return { active: null, next: null, day };

  let active = null;
  let next = null;
  for (let i = 0; i < periods.length; i += 1) {
    const slot = periods[i];
    const [start, end] = slot.time.split('-').map(toMinutes);
    if (currentMinutes >= start && currentMinutes < end) {
      active = slot;
      next = periods[i + 1] || null;
      break;
    }
  }
  return { active, next, day, schedule };
}

function subjectFor(slot, schedule) {
  if (!slot) return null;
  if (slot.isBreak) return slot.label.toUpperCase();
  return schedule?.[slot.id] || 'Free';
}

function updateStatus() {
  const { active, next, day, schedule } = getCurrentSlot();
  if (!schedule || !active) {
    currentSubjectEl.textContent = 'Outside class hours';
    currentTimeEl.textContent = `${day} · Notifications active only 8:00 AM - 3:20 PM`;
  } else {
    const subject = subjectFor(active, schedule);
    currentSubjectEl.textContent = subject;
    currentTimeEl.textContent = `${day} · ${active.time}`;
    maybeNotify(subject, active.time, day, active.id);
  }

  if (!schedule || !next) {
    nextSubjectEl.textContent = '--';
    nextTimeEl.textContent = '--';
  } else {
    nextSubjectEl.textContent = subjectFor(next, schedule);
    nextTimeEl.textContent = `${day} · ${next.time}`;
  }
}

function startTicker() {
  updateStatus();
  setInterval(updateStatus, 30000);
  scheduleBoundaryRefresh();
}

function scheduleBoundaryRefresh() {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  const now = new Date();
  const boundaryTimes = periods.map((p) => p.time.split('-')[0]);
  let nextBoundary = null;

  for (const hhmm of boundaryTimes) {
    const [h, m] = hhmm.split(':').map(Number);
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate > now) {
      nextBoundary = candidate;
      break;
    }
  }

  if (!nextBoundary) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    nextBoundary = tomorrow;
  }

  const delay = Math.max(1000, nextBoundary.getTime() - now.getTime() + 250);
  boundaryTimer = setTimeout(() => {
    updateStatus();
    scheduleBoundaryRefresh();
  }, delay);
}

function setupNotificationPermission() {
  notifyBtn.addEventListener('click', async () => {
    if (!('Notification' in window)) return alert('Notifications are not supported in this browser.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    notifyBtn.textContent = 'Notifications Enabled';
    notifyBtn.disabled = true;
    updateStatus();
    await setupBackgroundNotificationSync();
  });

  if ('Notification' in window && Notification.permission === 'granted') {
    notifyBtn.textContent = 'Notifications Enabled';
    notifyBtn.disabled = true;
    setupBackgroundNotificationSync();
  }
}

async function setupBackgroundNotificationSync() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'SET_SCHEDULE', payload: { periods, weekly, dayNames } });

  if ('periodicSync' in registration) {
    try {
      await registration.periodicSync.register('timetable-period-check', { minInterval: 15 * 60 * 1000 });
      bgHintEl.textContent = 'Background sync enabled (supported browsers) for app-closed updates.';
      return;
    } catch {
      // fallback note below
    }
  }

  bgHintEl.textContent = 'Exact auto-updates work while app is running. App-closed updates depend on browser support.';
}

async function maybeNotify(subject, timeRange, day, slotId) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `${day}-${slotId}`;
  if (lastNotifiedKey === key) return;
  lastNotifiedKey = key;

  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    registration.showNotification(`Now: ${subject}`, {
      body: `${day} · ${timeRange}`,
      icon: 'icons/icon-192.svg',
      badge: 'icons/icon-192.svg',
      tag: key,
      renotify: true
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch {
    bgHintEl.textContent = 'Service worker failed to register.';
  }
}
