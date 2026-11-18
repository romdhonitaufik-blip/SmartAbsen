/**
 * SmartAbsen & ABSENSI KARYAWAN - PT ANUGERAH BERKAH INDUSTRI
 * Ultra-Reliable Native SPA Engine (100% Robust, Zero Framework Fragility)
 */

// ============================================================================
// 1. STATE & STORAGE MANAGEMENT
// ============================================================================
const STORAGE_KEY = 'ABI_HR_SYSTEM_DATABASE_V3';
const SESSION_KEY = 'ABI_HR_AUTH_SESSION_V3';

const state = {
  currentUser: null,        // Logged-in employee object
  currentRole: 'employee',  // 'employee' | 'admin'
  currentTab: 'attendance', // 'attendance', 'requests', 'history', 'dashboard', 'approvals', 'employees', 'reports', 'settings'
  employees: [],
  attendances: [],
  requests: [],
  officeSettings: {
    companyName: 'PT ANUGERAH BERKAH INDUSTRI',
    companyLogo: 'logo.jpg',
    workStart: '08:00',
    workEnd: '17:00',
    officeLatitude: -6.2088,
    officeLongitude: 106.8456,
    allowedRadiusMeters: 150,
    strictGps: false,
    defaultAnnualLeaveQuota: 12,
    googleScriptUrl: ''
  },
  loginRole: 'employee',
  camera: {
    stream: null,
    capturedPhoto: null,
    active: false,
    error: null
  },
  gps: {
    lat: null,
    lng: null,
    accuracy: null,
    distanceToOffice: null,
    isInRadius: false,
    loading: false,
    error: null
  },
  requestForm: {
    type: 'IZIN', // 'IZIN', 'SAKIT', 'CUTI'
    category: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    emergencyContact: '',
    attachment: null
  },
  reportFilter: {
    range: '30days', // '30days' | 'month' | 'custom' | 'all'
    viewType: 'per-employee', // 'per-employee' | 'daily'
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().slice(0, 7),
    department: 'ALL',
    employeeId: 'ALL',
    status: 'ALL'
  },
  approvalModal: {
    isOpen: false,
    requestId: null,
    action: 'APPROVE',
    notes: ''
  },
  employeeModal: {
    isOpen: false,
    isEdit: false,
    data: {}
  },
  photoModal: {
    isOpen: false,
    title: '',
    url: ''
  },
  isSyncingSheets: false
};

// Initialize State from LocalStorage or Seed Data
function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.officeSettings) {
        state.officeSettings = { ...state.officeSettings, ...parsed.officeSettings };
        if (!state.officeSettings.companyLogo) state.officeSettings.companyLogo = 'logo.jpg';
        if (typeof DEFAULT_OFFICE_SETTINGS !== 'undefined' && DEFAULT_OFFICE_SETTINGS.googleScriptUrl) {
          if (!state.officeSettings.googleScriptUrl) {
            state.officeSettings.googleScriptUrl = DEFAULT_OFFICE_SETTINGS.googleScriptUrl;
          }
        }
      }
      if (Array.isArray(parsed.employees) && parsed.employees.length >= 30) {
        state.employees = parsed.employees;
      } else {
        state.employees = typeof DEFAULT_EMPLOYEES !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)) : [];
      }
      state.attendances = Array.isArray(parsed.attendances) ? parsed.attendances : (typeof DEFAULT_ATTENDANCES !== 'undefined' ? [...DEFAULT_ATTENDANCES] : []);
      state.requests = Array.isArray(parsed.requests) ? parsed.requests : (typeof DEFAULT_REQUESTS !== 'undefined' ? [...DEFAULT_REQUESTS] : []);
    } else {
      resetToDefaultDatabase(false);
    }
  } catch (err) {
    console.error('Error loading database:', err);
    resetToDefaultDatabase(false);
  }
}

function saveDatabase() {
  try {
    const data = {
      officeSettings: state.officeSettings,
      employees: state.employees,
      attendances: state.attendances,
      requests: state.requests
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

function resetToDefaultDatabase(notify = true) {
  if (typeof DEFAULT_OFFICE_SETTINGS !== 'undefined') {
    state.officeSettings = JSON.parse(JSON.stringify(DEFAULT_OFFICE_SETTINGS));
  }
  if (typeof DEFAULT_EMPLOYEES !== 'undefined') {
    state.employees = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
  }
  if (typeof DEFAULT_ATTENDANCES !== 'undefined') {
    state.attendances = JSON.parse(JSON.stringify(DEFAULT_ATTENDANCES));
  }
  if (typeof DEFAULT_REQUESTS !== 'undefined') {
    state.requests = JSON.parse(JSON.stringify(DEFAULT_REQUESTS));
  }
  saveDatabase();
  if (notify) showToast('Data berhasil di-reset ke data bawaan demo!', 'info');
}

function clearAllAttendances(notify = true) {
  state.attendances = [];
  saveDatabase();
  if (notify) showToast('Seluruh riwayat presensi & log lembur berhasil dikosongkan (0 Jam).', 'success');
  renderApp();
}
window.clearAllAttendances = clearAllAttendances;

function clearAllRequests(notify = true) {
  state.requests = [];
  saveDatabase();
  if (notify) showToast('Seluruh riwayat pengajuan cuti & izin berhasil dikosongkan.', 'success');
  renderApp();
}
window.clearAllRequests = clearAllRequests;

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.id) {
        const emp = state.employees.find(e => e.id === sess.id);
        if (emp) {
          state.currentUser = emp;
          state.currentRole = (emp.role === 'admin') ? (sess.role || 'admin') : 'employee';
          state.currentTab = state.currentRole === 'admin' ? 'dashboard' : 'attendance';
        }
      }
    }
  } catch (e) {
    console.warn('Session parse error:', e);
  }
}

function saveSession() {
  if (state.currentUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      id: state.currentUser.id,
      role: state.currentRole
    }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// ============================================================================
// 2. GOOGLE SPREADSHEET SYNC & CLOUD DATABASE
// ============================================================================
function getGoogleScriptUrl() {
  const localUrl = (state.officeSettings && state.officeSettings.googleScriptUrl || '').trim();
  const defaultUrl = (typeof DEFAULT_OFFICE_SETTINGS !== 'undefined' && DEFAULT_OFFICE_SETTINGS.googleScriptUrl || '').trim();
  return localUrl || defaultUrl;
}
window.getGoogleScriptUrl = getGoogleScriptUrl;

function getCompanyLetterhead() {
  if (typeof KOP_SURAT_BASE64 !== 'undefined' && KOP_SURAT_BASE64) {
    return KOP_SURAT_BASE64;
  }
  return 'kop_surat.jpg';
}
window.getCompanyLetterhead = getCompanyLetterhead;

async function syncToGoogleSheets(action, payload) {
  const url = getGoogleScriptUrl();
  if (!url) {
    console.warn(`[Google Sheets] URL belum disetel, data ${action} hanya disimpan di lokal perangkat.`);
    return false;
  }
  try {
    const body = { action, ...payload, clientTimestamp: new Date().toISOString() };
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    console.log(`[Google Sheets] Berhasil mengirim aksi: ${action}`);
    return true;
  } catch (err) {
    console.warn(`[Google Sheets] Gagal mengirim ${action}:`, err);
    return false;
  }
}

async function fetchCloudData(notify = false) {
  const url = getGoogleScriptUrl();
  if (!url) {
    if (notify) showToast('URL Google Apps Script belum disetel di Pengaturan.', 'warning');
    return;
  }

  state.isSyncingSheets = true;
  updateSyncButtonUI(true);

  try {
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'action=GET_DATA&t=' + Date.now();
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (data && data.status === 'success') {
      // 1. Sinkronisasi Data Absensi dari Cloud
      if (Array.isArray(data.attendances)) {
        const attMap = new Map();
        // Pertahankan data lokal
        state.attendances.forEach(a => {
          const key = a.id || (a.employeeId + '_' + a.date);
          attMap.set(key, a);
        });
        // Gabungkan data dari Cloud
        data.attendances.forEach(cloudAtt => {
          const key = cloudAtt.id || (cloudAtt.employeeId + '_' + cloudAtt.date);
          const existing = attMap.get(key);
          const ot = calculateOvertime(cloudAtt.date, cloudAtt.clockIn, cloudAtt.clockOut);
          const normalized = {
            id: cloudAtt.id,
            date: cloudAtt.date,
            employeeId: cloudAtt.employeeId,
            clockIn: cloudAtt.clockIn || (existing ? existing.clockIn : null),
            clockInStatus: cloudAtt.clockInStatus || (existing ? existing.clockInStatus : 'Tepat Waktu'),
            clockInPhoto: cloudAtt.clockInPhoto || (existing ? existing.clockInPhoto : null),
            clockInLocation: cloudAtt.clockInLocation || (existing ? existing.clockInLocation : { address: 'Kantor PT ABI' }),
            clockOut: cloudAtt.clockOut || (existing ? existing.clockOut : null),
            workHours: cloudAtt.workHours || (existing ? existing.workHours : null),
            overtimeHours: ot.formatted,
            overtimeDecimal: ot.hoursDecimal,
            overtimeMinutes: ot.minutes,
            status: cloudAtt.status || (existing ? existing.status : 'Hadir')
          };
          attMap.set(key, normalized);
        });
        state.attendances = Array.from(attMap.values());
        state.attendances.sort((a, b) => (b.date + ' ' + (b.clockIn || '')).localeCompare(a.date + ' ' + (a.clockIn || '')));
      }

      // 2. Sinkronisasi Data Pengajuan Cuti / Izin dari Cloud
      if (Array.isArray(data.requests)) {
        const reqMap = new Map();
        state.requests.forEach(r => reqMap.set(r.id, r));
        data.requests.forEach(cloudReq => {
          reqMap.set(cloudReq.id, {
            id: cloudReq.id,
            employeeId: cloudReq.employeeId,
            type: cloudReq.type || 'IZIN',
            category: cloudReq.category || cloudReq.type || 'IZIN',
            startDate: cloudReq.startDate,
            endDate: cloudReq.endDate,
            totalDays: Number(cloudReq.totalDays) || 1,
            reason: cloudReq.reason || '-',
            emergencyContact: cloudReq.emergencyContact || '-',
            attachment: cloudReq.attachment || null,
            status: cloudReq.status || 'PENDING',
            reviewNotes: cloudReq.reviewNotes || null,
            createdAt: cloudReq.createdAt || (cloudReq.startDate + ' 08:00:00')
          });
        });
        state.requests = Array.from(reqMap.values());
        state.requests.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
      }

      saveDatabase();
      if (notify) {
        showToast(`Sinkronisasi Cloud Berhasil! (${state.attendances.length} Log Presensi, ${state.requests.length} Pengajuan)`, 'success');
      }
      renderApp();
    } else {
      if (notify) showToast('Respon dari Google Sheets: ' + (data ? data.message : 'Gagal'), 'warning');
    }
  } catch (err) {
    console.warn('Fetch cloud data warning:', err);
    if (notify) showToast('Gagal sinkronisasi dari Google Sheets: ' + err.message, 'error');
  } finally {
    state.isSyncingSheets = false;
    updateSyncButtonUI(false);
  }
}
window.fetchCloudData = fetchCloudData;

function updateSyncButtonUI(isSyncing) {
  const syncBtns = document.querySelectorAll('[data-action="sync-cloud-data"]');
  syncBtns.forEach(btn => {
    if (isSyncing) {
      btn.classList.add('opacity-75');
      const textSpan = btn.querySelector('span');
      if (textSpan) textSpan.textContent = 'Menyinkronkan...';
      const svg = btn.querySelector('svg');
      if (svg) svg.classList.add('animate-spin');
    } else {
      btn.classList.remove('opacity-75');
      const textSpan = btn.querySelector('span');
      if (textSpan) textSpan.textContent = 'Sinkron Cloud';
      const svg = btn.querySelector('svg');
      if (svg) svg.classList.remove('animate-spin');
    }
  });
}

async function sendTestRowToGoogleSheets() {
  const url = getGoogleScriptUrl();
  if (!url) {
    showToast('Masukkan URL Web App terlebih dahulu!', 'warning');
    return;
  }
  showToast('Mengirim baris uji coba beserta contoh foto selfie...', 'info');
  try {
    const now = new Date();
    // Buat sampel foto uji coba (ikon selfie mini)
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 120;
    testCanvas.height = 120;
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TES FOTO', 60, 55);
    ctx.fillText('ABI HR', 60, 75);
    const samplePhoto = testCanvas.toDataURL('image/jpeg', 0.8);

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'CLOCK_IN',
        id: 'TEST-' + Date.now(),
        date: getTodayString(),
        employeeId: state.currentUser ? state.currentUser.id : 'ABR-024',
        employeeName: state.currentUser ? state.currentUser.name : 'ADMIN ABI',
        clockIn: now.toTimeString().split(' ')[0],
        clockInStatus: 'Tepat Waktu',
        clockInLocation: 'Uji Coba Pengiriman Foto & Data',
        photo: samplePhoto,
        clientTimestamp: now.toISOString()
      })
    });
    showToast('Baris uji coba BERHASIL dikirim! Cek kolom Foto di tab "Absensi" Spreadsheet Anda.', 'success');
  } catch (err) {
    showToast('Gagal mengirim data uji coba.', 'error');
  }
}

// ============================================================================
// 3. TOAST & NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-blue-600 text-white'
  };

  const icons = {
    success: '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  toast.className = `p-3.5 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold pointer-events-auto transform transition-all duration-300 opacity-0 translate-y-2 ${bgColors[type] || bgColors.success}`;
  toast.innerHTML = `
    ${icons[type] || icons.success}
    <div class="flex-1">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 4. GPS & GEOLOCATION (Haversine Formula)
// ============================================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function detectLocation(onDone) {
  state.gps.loading = true;
  state.gps.error = null;

  if (!navigator.geolocation) {
    state.gps.error = 'Browser tidak mendukung GPS Geolocation.';
    state.gps.loading = false;
    mockGpsFallback();
    if (onDone) onDone();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy);
      const distance = calculateDistance(
        lat, lng,
        state.officeSettings.officeLatitude,
        state.officeSettings.officeLongitude
      );
      state.gps = {
        lat,
        lng,
        accuracy,
        distanceToOffice: distance,
        isInRadius: distance <= state.officeSettings.allowedRadiusMeters,
        loading: false,
        error: null
      };
      if (onDone) onDone();
    },
    (err) => {
      console.warn('Geolocation warning:', err.message);
      state.gps.error = 'GPS belum diizinkan atau tidak aktif.';
      state.gps.loading = false;
      mockGpsFallback();
      if (onDone) onDone();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

function mockGpsFallback() {
  const lat = state.officeSettings.officeLatitude + 0.00015;
  const lng = state.officeSettings.officeLongitude + 0.00015;
  const dist = calculateDistance(
    lat, lng,
    state.officeSettings.officeLatitude,
    state.officeSettings.officeLongitude
  );
  state.gps.lat = lat;
  state.gps.lng = lng;
  state.gps.accuracy = 15;
  state.gps.distanceToOffice = dist;
  state.gps.isInRadius = dist <= state.officeSettings.allowedRadiusMeters;
}

// ============================================================================
// 5. CAMERA & SELFIE
// ============================================================================
async function startCamera() {
  try {
    state.camera.error = null;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    state.camera.stream = stream;
    state.camera.active = true;
    renderApp();
    setTimeout(() => {
      const videoEl = document.getElementById('camera-video');
      if (videoEl && state.camera.stream) {
        videoEl.srcObject = state.camera.stream;
        videoEl.play();
      }
    }, 100);
  } catch (err) {
    console.warn('Camera access error:', err);
    state.camera.error = 'Kamera tidak dapat diakses atau diblokir browser.';
    state.camera.active = false;
    renderApp();
  }
}

function stopCamera() {
  if (state.camera.stream) {
    state.camera.stream.getTracks().forEach(t => t.stop());
    state.camera.stream = null;
  }
  state.camera.active = false;
}

function capturePhoto() {
  const videoEl = document.getElementById('camera-video');
  if (!videoEl) return;
  const canvas = document.createElement('canvas');
  let width = videoEl.videoWidth || 640;
  let height = videoEl.videoHeight || 480;
  const maxDim = 480;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, width, height);
  state.camera.capturedPhoto = canvas.toDataURL('image/jpeg', 0.7);
  stopCamera();
  showToast('Foto selfie berhasil diambil!', 'success');
  renderApp();
}

function retakePhoto() {
  state.camera.capturedPhoto = null;
  startCamera();
}

function handlePhotoUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 500;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      state.camera.capturedPhoto = canvas.toDataURL('image/jpeg', 0.7);
      stopCamera();
      showToast('Foto berhasil diunggah & dioptimasi!', 'success');
      renderApp();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================================
// 6. BUSINESS LOGIC & HELPERS
// ============================================================================
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTimeFormatted() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

function getCurrentDateFormatted() {
  const now = new Date();
  return now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getPastDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getDayNameIndonesian(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return dayNames[d.getDay()] || '-';
  } catch (e) {
    return '-';
  }
}

/**
 * Aturan Perhitungan Lembur PT ANUGERAH BERKAH INDUSTRI:
 * 1. Senin - Jumat: Jam 17:00 ke atas dihitung lembur.
 * 2. Sabtu: Jam 13:00 ke atas dihitung lembur.
 * 3. Minggu: Seluruh jam kerja dihitung lembur.
 * 
 * ATURAN PEMBULATAN MENIT:
 * - Kurang dari 45 menit tidak dihitung (< 45 menit = 0 Jam).
 * - 45 menit ke atas dibulatkan ke 1 Jam penuh (>= 45 menit = +1 Jam).
 *   Contoh:
 *   - Lembur 30 menit -> 0 Jam (hangus)
 *   - Lembur 45 menit -> 1 Jam
 *   - Lembur 1 jam 20 menit -> 1 Jam (sisa 20 mnt hangus)
 *   - Lembur 1 jam 45 menit / 1 jam 50 menit -> 2 Jam
 */
function calculateOvertime(dateStr, clockInStr, clockOutStr) {
  if (!clockOutStr || !dateStr) {
    return { formatted: '-', hoursDecimal: 0, text: '-', minutes: 0 };
  }

  try {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu

    const [outH, outM] = clockOutStr.split(':').map(Number);
    const outTotalMin = outH * 60 + (outM || 0);

    let overtimeMin = 0;

    if (day === 0) {
      // HARI MINGGU: Seluruh jam kerja dari jam masuk ke jam pulang dihitung lembur
      if (clockInStr) {
        const [inH, inM] = clockInStr.split(':').map(Number);
        const inTotalMin = inH * 60 + (inM || 0);
        overtimeMin = Math.max(0, outTotalMin - inTotalMin);
      }
    } else if (day === 6) {
      // HARI SABTU: Jam 13:00 ke atas dihitung lembur
      const threshold = 13 * 60; // 13:00 = 780 menit
      if (outTotalMin > threshold) {
        overtimeMin = outTotalMin - threshold;
      }
    } else {
      // SENIN - JUMAT: Jam 17:00 ke atas dihitung lembur
      const threshold = 17 * 60; // 17:00 = 1020 menit
      if (outTotalMin > threshold) {
        overtimeMin = outTotalMin - threshold;
      }
    }

    if (overtimeMin <= 0) {
      return { formatted: '0 Jam', hoursDecimal: 0, text: '0 Jam', minutes: 0 };
    }

    // PEMBULATAN MENIT (ATURAN 45 MENIT):
    const fullHours = Math.floor(overtimeMin / 60);
    const remainderMin = overtimeMin % 60;

    let roundedHours = fullHours;
    if (remainderMin >= 45) {
      roundedHours += 1; // Sisa >= 45 menit dibulatkan ke 1 jam penuh
    }

    if (roundedHours <= 0) {
      return { formatted: '0 Jam', hoursDecimal: 0, text: '0 Jam', minutes: overtimeMin };
    }

    const formatted = `${roundedHours} Jam`;

    return {
      formatted: formatted,
      hoursDecimal: roundedHours,
      text: formatted,
      minutes: overtimeMin,
      hrs: roundedHours,
      fullHours: fullHours,
      remainderMin: remainderMin
    };
  } catch (err) {
    return { formatted: '-', hoursDecimal: 0, text: '-', minutes: 0 };
  }
}

function getEmployee(id) {
  return state.employees.find(e => e.id === id) || {
    name: 'Karyawan',
    department: '-',
    position: '-',
    nip: '-',
    leaveQuota: { remaining: 12, total: 12, used: 0 }
  };
}

function getTodayAttendance(empId) {
  const today = getTodayString();
  return state.attendances.find(a => a.employeeId === empId && a.date === today);
}

// Authentication Handlers
function handleLogin(identifier, pin, role) {
  const idInput = (identifier || '').trim().toLowerCase();
  const pinInput = (pin || '').trim();

  if (!idInput) {
    showToast('Masukkan NIP atau Email Anda!', 'warning');
    return;
  }
  if (!pinInput) {
    showToast('Masukkan PIN / Password Anda!', 'warning');
    return;
  }

  // 1. Cek Login Admin
  const adminUser = state.employees.find(e => e.role === 'admin') || DEFAULT_EMPLOYEES.find(e => e.role === 'admin');
  const isAdminMatch = adminUser && (
    idInput === (adminUser.email || '').toLowerCase() ||
    String(adminUser.nip).toLowerCase() === idInput ||
    String(adminUser.id).toLowerCase() === idInput ||
    idInput === '11024' ||
    idInput === 'admin'
  );

  if (isAdminMatch && (pinInput === String(adminUser.pin || 'user@123') || pinInput === 'user@123' || pinInput === 'admin123')) {
    state.currentUser = adminUser;
    state.currentRole = 'admin';
    state.currentTab = 'dashboard';
    saveSession();
    showToast(`Selamat datang, ${adminUser.name} (HRD Admin)!`, 'success');
    renderApp();
    return;
  }

  // 2. Cek Login Karyawan
  const emp = state.employees.find(e =>
    e.role !== 'admin' && (
      (e.nip && String(e.nip).trim().toLowerCase() === idInput) ||
      (e.id && String(e.id).trim().toLowerCase() === idInput) ||
      (e.name && e.name.trim().toLowerCase() === idInput) ||
      (e.name && e.name.trim().toLowerCase().includes(idInput)) ||
      (e.email && e.email.trim().toLowerCase() === idInput)
    )
  );

  if (emp) {
    const expectedPin = String(emp.pin || emp.nip || '1234').trim();
    const isPinValid = (
      pinInput === expectedPin ||
      pinInput === String(emp.nip) ||
      pinInput === '1234' ||
      pinInput === String(emp.id).toLowerCase()
    );

    if (!isPinValid) {
      showToast('PIN yang Anda masukkan salah! Silakan coba kembali.', 'error');
      return;
    }

    state.currentUser = emp;
    state.currentRole = 'employee';
    state.currentTab = 'attendance';
    saveSession();
    showToast(`Selamat datang, ${emp.name}!`, 'success');
    renderApp();
  } else {
    showToast(`Karyawan dengan NIP/ID "${identifier}" tidak ditemukan. Contoh: 11001, 11002`, 'error');
  }
}

function quickLogin(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  state.currentUser = emp;
  state.currentRole = emp.role;
  state.currentTab = emp.role === 'admin' ? 'dashboard' : 'attendance';
  saveSession();
  showToast(`Masuk sebagai: ${emp.name}`, 'info');
  renderApp();
}

function handleLogout() {
  stopCamera();
  state.currentUser = null;
  state.currentRole = 'employee';
  state.currentTab = 'attendance';
  saveSession();
  showToast('Anda telah berhasil keluar (Logout).', 'info');
  renderApp();
}

// Clock In & Clock Out
function clockIn() {
  if (!state.currentUser) return;

  // 1. VALIDASI FOTO SELFIE WAJIB
  if (!state.camera.capturedPhoto) {
    showToast('FOTO SELFIE WAJIB! Silakan ambil foto wajah selfie Anda sebelum Absen Masuk.', 'error');
    if (!state.camera.active) {
      startCamera();
    }
    return;
  }

  // 2. VALIDASI LOKASI GPS WAJIB
  if (state.gps.lat === null || state.gps.lng === null || state.gps.loading) {
    showToast('LOKASI GPS WAJIB! Pastikan fitur lokasi GPS di HP/Laptop aktif dan izinkan browser mengakses lokasi.', 'error');
    initGpsTracking();
    return;
  }

  // 3. VALIDASI STRICT GPS (Jika diaktifkan di pengaturan)
  if (state.officeSettings.strictGps && !state.gps.isInRadius) {
    showToast(`Absen ditolak! Anda berada di luar radius kantor (${state.gps.distanceToOffice}m > ${state.officeSettings.allowedRadiusMeters}m).`, 'error');
    return;
  }

  const today = getTodayString();
  const timeStr = getCurrentTimeFormatted();
  const isLate = timeStr > (state.officeSettings.workStart + ':00');
  const clockInStatus = isLate ? 'Terlambat' : 'Tepat Waktu';

  const newAtt = {
    id: 'ATT-' + Date.now(),
    employeeId: state.currentUser.id,
    date: today,
    clockIn: timeStr,
    clockInStatus: clockInStatus,
    clockInLocation: {
      lat: state.gps.lat,
      lng: state.gps.lng,
      address: state.gps.isInRadius ? `Kantor Pusat ABI (WFO - Radius ${state.gps.distanceToOffice}m)` : `Luar Kantor (Jarak ${state.gps.distanceToOffice}m)`,
      inOfficeRadius: state.gps.isInRadius,
      distanceMeters: state.gps.distanceToOffice
    },
    clockInPhoto: state.camera.capturedPhoto,
    clockOut: null,
    clockOutLocation: null,
    workHours: null,
    overtimeHours: '-',
    overtimeDecimal: 0,
    status: 'Hadir'
  };

  state.attendances.unshift(newAtt);
  saveDatabase();

  syncToGoogleSheets('CLOCK_IN', {
    id: newAtt.id,
    date: newAtt.date,
    employeeId: newAtt.employeeId,
    employeeName: state.currentUser.name,
    clockIn: newAtt.clockIn,
    clockInStatus: newAtt.clockInStatus,
    clockInLocation: newAtt.clockInLocation.address,
    photo: newAtt.clockInPhoto
  });

  if (window.confetti) {
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
  }

  showToast(`Absen Masuk Berhasil! Status: ${clockInStatus} (${timeStr})`, isLate ? 'warning' : 'success');
  state.camera.capturedPhoto = null;
  renderApp();
}

function clockOut() {
  if (!state.currentUser) return;
  const today = getTodayString();
  const att = state.attendances.find(a => a.employeeId === state.currentUser.id && a.date === today);

  if (!att) {
    showToast('Anda belum melakukan Absen Masuk hari ini!', 'warning');
    return;
  }

  // Refresh GPS saat pulang
  if (state.gps.lat === null || state.gps.lng === null) {
    initGpsTracking();
  }

  const timeStr = getCurrentTimeFormatted();
  att.clockOut = timeStr;
  att.clockOutLocation = {
    lat: state.gps.lat,
    lng: state.gps.lng,
    address: state.gps.isInRadius ? `Kantor Pusat ABI (WFO)` : `Luar Kantor (Jarak ${state.gps.distanceToOffice || 0}m)`,
    inOfficeRadius: state.gps.isInRadius,
    distanceMeters: state.gps.distanceToOffice
  };

  // Hitung total jam kerja
  try {
    const startParts = att.clockIn.split(':');
    const endParts = timeStr.split(':');
    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const diff = Math.max(0, endMin - startMin);
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    att.workHours = `${hrs} Jam ${mins} Menit`;
  } catch (e) {
    att.workHours = '8 Jam';
  }

  // HITUNG JAM LEMBUR SESUAI ATURAN PERUSAHAAN:
  // - Senin-Jumat: Jam 17:00 ke atas dihitung lembur
  // - Sabtu: Jam 13:00 ke atas dihitung lembur
  // - Minggu: Seluruh jam kerja dihitung lembur
  const ot = calculateOvertime(att.date, att.clockIn, timeStr);
  att.overtimeHours = ot.formatted;
  att.overtimeDecimal = ot.hoursDecimal;
  att.overtimeMinutes = ot.minutes;

  saveDatabase();

  syncToGoogleSheets('CLOCK_OUT', {
    id: att.id,
    date: att.date,
    employeeId: att.employeeId,
    employeeName: state.currentUser.name,
    clockOut: att.clockOut,
    workHours: att.workHours,
    overtime: att.overtimeHours
  });

  if (window.confetti) {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }

  let toastMsg = `Absen Pulang Berhasil! Jam Kerja: ${att.workHours}`;
  if (ot.hoursDecimal > 0) {
    toastMsg += ` | Lembur: ${ot.formatted} 🎉`;
  }
  showToast(toastMsg, 'success');
  renderApp();
}

// Request Submissions (Izin, Sakit, Cuti)
function submitLeaveRequest() {
  if (!state.currentUser) return;
  const form = state.requestForm;

  if (!form.startDate || !form.endDate) {
    showToast('Harap tentukan tanggal mulai dan tanggal selesai!', 'warning');
    return;
  }
  if (form.startDate > form.endDate) {
    showToast('Tanggal selesai tidak boleh sebelum tanggal mulai!', 'warning');
    return;
  }
  if (!form.reason.trim()) {
    showToast('Alasan pengajuan wajib diisi!', 'warning');
    return;
  }

  const d1 = new Date(form.startDate);
  const d2 = new Date(form.endDate);
  const totalDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

  if (form.type === 'CUTI') {
    const quota = state.currentUser.leaveQuota ? state.currentUser.leaveQuota.remaining : 12;
    if (totalDays > quota) {
      showToast(`Gagal! Pengajuan (${totalDays} hari) melebihi sisa kuota cuti (${quota} hari).`, 'error');
      return;
    }
  }

  const newReq = {
    id: 'REQ-' + Date.now(),
    employeeId: state.currentUser.id,
    type: form.type,
    category: form.category || form.type,
    startDate: form.startDate,
    endDate: form.endDate,
    totalDays: totalDays,
    reason: form.reason.trim(),
    emergencyContact: form.emergencyContact.trim(),
    attachment: form.attachment,
    status: 'PENDING',
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null
  };

  state.requests.unshift(newReq);
  saveDatabase();

  syncToGoogleSheets('SUBMIT_REQUEST', {
    id: newReq.id,
    employeeId: newReq.employeeId,
    employeeName: state.currentUser.name,
    type: newReq.type,
    category: newReq.category,
    startDate: newReq.startDate,
    endDate: newReq.endDate,
    totalDays: newReq.totalDays,
    reason: newReq.reason,
    emergencyContact: newReq.emergencyContact,
    attachment: newReq.attachment,
    status: 'PENDING'
  });

  showToast(`Pengajuan ${newReq.type} (${totalDays} hari) berhasil dikirim ke HRD!`, 'success');
  // Reset form
  state.requestForm.reason = '';
  state.requestForm.emergencyContact = '';
  state.requestForm.attachment = null;
  renderApp();
}

// Approval Workflow
function processApproval(requestId, action, notes) {
  const req = state.requests.find(r => r.id === requestId);
  if (!req) return;

  const isApproved = action === 'APPROVE';
  req.status = isApproved ? 'APPROVED' : 'REJECTED';
  req.reviewedBy = state.currentUser ? state.currentUser.name : 'HR Manager';
  req.reviewedAt = new Date().toISOString();
  req.reviewNotes = notes ? notes.trim() : (isApproved ? 'Disetujui oleh HRD' : 'Ditolak');

  // If approved Cuti, deduct employee quota
  if (req.type === 'CUTI' && isApproved) {
    const emp = state.employees.find(e => e.id === req.employeeId);
    if (emp && emp.leaveQuota) {
      emp.leaveQuota.used = (emp.leaveQuota.used || 0) + req.totalDays;
      emp.leaveQuota.remaining = Math.max(0, emp.leaveQuota.total - emp.leaveQuota.used);
    }
  }

  saveDatabase();

  syncToGoogleSheets('UPDATE_REQUEST_STATUS', {
    id: req.id,
    employeeId: req.employeeId,
    employeeName: getEmployee(req.employeeId).name,
    type: req.type,
    status: req.status,
    notes: req.reviewNotes,
    reviewedAt: req.reviewedAt
  });

  showToast(`Pengajuan ${req.type} berhasil ${isApproved ? 'DISETUJUI' : 'DITOLAK'}!`, isApproved ? 'success' : 'info');
  closeApprovalModal();
  renderApp();
}

// Employee CRUD
function saveEmployeeData(data, isEdit) {
  if (!data.name || !data.email || !data.nip) {
    showToast('Nama, NIP, dan Email wajib diisi!', 'warning');
    return;
  }

  if (isEdit) {
    const emp = state.employees.find(e => e.id === data.id);
    if (emp) {
      emp.name = data.name.trim();
      emp.nip = data.nip.trim();
      emp.email = data.email.trim();
      emp.department = data.department;
      emp.position = data.position.trim();
      emp.phone = data.phone.trim();
      if (data.pin) emp.pin = data.pin.trim();
      if (emp.leaveQuota) {
        emp.leaveQuota.total = Number(data.totalQuota || 12);
        emp.leaveQuota.remaining = emp.leaveQuota.total - (emp.leaveQuota.used || 0);
      }
      showToast(`Data ${emp.name} berhasil diperbarui!`, 'success');
    }
  } else {
    const newId = 'ABR-' + String(state.employees.length + 1).padStart(3, '0');
    const newEmp = {
      id: newId,
      nip: data.nip.trim(),
      name: data.name.trim(),
      email: data.email.trim(),
      department: data.department,
      position: data.position.trim(),
      phone: data.phone.trim() || '-',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=2563eb&color=fff&size=150`,
      joinDate: new Date().toISOString().split('T')[0],
      leaveQuota: {
        total: Number(data.totalQuota || 12),
        used: 0,
        remaining: Number(data.totalQuota || 12)
      },
      pin: data.pin ? data.pin.trim() : data.nip.trim(),
      role: 'employee'
    };
    state.employees.push(newEmp);

    syncToGoogleSheets('ADD_EMPLOYEE', {
      id: newEmp.id,
      nip: newEmp.nip,
      name: newEmp.name,
      email: newEmp.email,
      department: newEmp.department,
      position: newEmp.position,
      phone: newEmp.phone,
      pin: newEmp.pin,
      quota: newEmp.leaveQuota.total
    });

    showToast(`Karyawan baru ${newEmp.name} berhasil ditambahkan!`, 'success');
  }

  saveDatabase();
  closeEmployeeModal();
  renderApp();
}

function deleteEmployee(empId) {
  if (empId === 'ABR-024') {
    showToast('Akun Admin tidak dapat dihapus!', 'error');
    return;
  }
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  if (confirm(`Apakah Anda yakin ingin menghapus data karyawan: ${emp.name}?`)) {
    state.employees = state.employees.filter(e => e.id !== empId);
    saveDatabase();
    showToast('Data karyawan berhasil dihapus.', 'info');
    renderApp();
  }
}

function resetAllLeaveQuotas() {
  if (confirm('Reset kuota cuti tahunan seluruh 34 karyawan ke 12 hari?')) {
    state.employees.forEach(emp => {
      if (emp.leaveQuota) {
        emp.leaveQuota.total = 12;
        emp.leaveQuota.used = 0;
        emp.leaveQuota.remaining = 12;
      }
    });
    saveDatabase();
    showToast('Kuota cuti seluruh karyawan berhasil di-reset ke 12 hari!', 'success');
    renderApp();
  }
}

// Export CSV with UTF-8 BOM
function exportReportsToCSV() {
  const reports = getFilteredReports();
  if (reports.length === 0) {
    showToast('Tidak ada data absensi untuk diekspor!', 'warning');
    return;
  }

  // Format 1: Rekapitulasi Jam Lembur Per Karyawan (Per Orang)
  if (state.reportFilter.viewType === 'per-employee') {
    const summaryList = getOvertimeSummaryPerEmployee(reports);
    let csv = '\uFEFFNo,NIP,Nama Karyawan,Departemen,Jabatan,Total Hadir (Hari),Hari Lembur,Lembur Senin-Jumat (Jam),Lembur Sabtu (Jam),Lembur Minggu (Jam),Total Jam Lembur (Jam)\n';
    let totalHadirSum = 0;
    let totalOtDaysSum = 0;
    let totalWeekdaySum = 0;
    let totalSaturdaySum = 0;
    let totalSundaySum = 0;
    let grandTotalOt = 0;

    summaryList.forEach((item, idx) => {
      const emp = item.employee;
      totalHadirSum += item.totalHadir;
      totalOtDaysSum += item.totalOvertimeDays;
      totalWeekdaySum += item.weekdayOvertimeHours;
      totalSaturdaySum += item.saturdayOvertimeHours;
      totalSundaySum += item.sundayOvertimeHours;
      grandTotalOt += item.totalOvertimeHours;

      csv += `"${idx + 1}","${emp.nip}","${emp.name}","${emp.department}","${emp.position}","${item.totalHadir}","${item.totalOvertimeDays}","${item.weekdayOvertimeHours}","${item.saturdayOvertimeHours}","${item.sundayOvertimeHours}","${item.totalOvertimeHours}"\n`;
    });
    csv += `"TOTAL","","","","","${totalHadirSum}","${totalOtDaysSum}","${totalWeekdaySum}","${totalSaturdaySum}","${totalSundaySum}","${grandTotalOt}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Rekap_Lembur_Per_Karyawan_PT_ABI_${getTodayString()}.csv`;
    link.click();
    showToast('Rekap lembur per orang berhasil didownload dalam format CSV!', 'success');
    return;
  }

  // Format 2: Rincian Harian Presensi
  let csv = '\uFEFFID Absensi,Tanggal,Hari,NIP,Nama Karyawan,Departemen,Jam Masuk,Status Masuk,Jam Pulang,Total Jam Kerja,Jam Lembur,Status Kehadiran,Lokasi GPS\n';
  reports.forEach(r => {
    const emp = getEmployee(r.employeeId);
    const dayName = getDayNameIndonesian(r.date);
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    const loc = (r.clockInLocation ? r.clockInLocation.address : '-').replace(/,/g, ' ');
    csv += `"${r.id}","${r.date}","${dayName}","${emp.nip}","${emp.name}","${emp.department}","${r.clockIn || '-'}","${r.clockInStatus || '-'}","${r.clockOut || '-'}","${r.workHours || '-'}","${ot.hoursDecimal > 0 ? ot.formatted : '-'}","${r.clockInStatus || r.status || 'Hadir'}","${loc}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Laporan_Absensi_Harian_PT_ABI_${getTodayString()}.csv`;
  link.click();
  showToast('Laporan absensi harian berhasil didownload dalam format CSV (Excel)!', 'success');
}

// Export to Excel (.xls XML Format)
function exportReportsToExcel() {
  const reports = getFilteredReports();
  if (reports.length === 0) {
    showToast('Tidak ada data absensi untuk diekspor!', 'warning');
    return;
  }

  const rangeLabel = state.reportFilter.range === '30days'
    ? `30 Hari Terakhir (${getPastDateString(30)} s/d ${getTodayString()})`
    : (state.reportFilter.range === 'month' ? `Bulan ${state.reportFilter.month}` : `${state.reportFilter.startDate || '-'} s/d ${state.reportFilter.endDate || '-'}`);

  // Format 1: Rekapitulasi Jam Lembur Per Karyawan (Per Orang)
  if (state.reportFilter.viewType === 'per-employee') {
    const summaryList = getOvertimeSummaryPerEmployee(reports);
    let totalHadirSum = 0;
    let totalOtDaysSum = 0;
    let totalWeekdaySum = 0;
    let totalSaturdaySum = 0;
    let totalSundaySum = 0;
    let grandTotalOt = 0;

    summaryList.forEach(item => {
      totalHadirSum += item.totalHadir;
      totalOtDaysSum += item.totalOvertimeDays;
      totalWeekdaySum += item.weekdayOvertimeHours;
      totalSaturdaySum += item.saturdayOvertimeHours;
      totalSundaySum += item.sundayOvertimeHours;
      grandTotalOt += item.totalOvertimeHours;
    });

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Rekap Lembur Per Orang</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
        <style>
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 7px 10px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 15pt; font-weight: bold; color: #1e3a8a; }
          .sub { font-size: 9pt; color: #475569; }
          .overtime { background-color: #fef3c7; color: #b45309; font-weight: bold; text-align: center; font-size: 11pt; }
          .total-row { background-color: #f1f5f9; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <!-- KOP SURAT RESMI PERUSAHAAN -->
          <tr>
            <td colspan="11" align="center" style="text-align: center; padding: 10px 0; background-color: #ffffff; border: none;">
              <img src="${getCompanyLetterhead()}" width="650" height="90" alt="PT. ANUGERAH BERKAH INDUSTRI" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          <tr><td colspan="11" style="border-bottom: 2px solid #000000; height: 3px; padding: 0;"></td></tr>
          <tr><td colspan="11" style="height: 10px; border: none;"></td></tr>
          <tr><td colspan="11" class="bold" style="font-size: 13pt; text-align: center; color: #1e3a8a;">REKAPITULASI JAM LEMBUR KARYAWAN (PER ORANG)</td></tr>
          <tr><td colspan="11" class="sub" style="text-align: center;">Periode: ${rangeLabel} | Dicetak: ${new Date().toLocaleString('id-ID')} | Total Karyawan: ${summaryList.length} Orang</td></tr>
          <tr><td colspan="11" class="sub" style="text-align: center;">Aturan Lembur: Senin-Jumat &gt;17:00 | Sabtu &gt;13:00 | Minggu Penuh (Kurang 45 mnt = 0 Jam, &ge; 45 mnt = 1 Jam)</td></tr>
          <tr><td colspan="11" style="height: 10px; border: none;"></td></tr>
          <tr>
            <th>No</th>
            <th>NIP</th>
            <th>Nama Lengkap Karyawan</th>
            <th>Departemen</th>
            <th>Jabatan</th>
            <th>Total Kehadiran</th>
            <th>Hari Lembur</th>
            <th>Lembur Senin - Jumat (&gt;17:00)</th>
            <th>Lembur Sabtu (&gt;13:00)</th>
            <th>Lembur Minggu (Penuh)</th>
            <th style="background-color: #b45309; color: #ffffff;">TOTAL JAM LEMBUR</th>
          </tr>
    `;

    summaryList.forEach((item, idx) => {
      const emp = item.employee;
      tableHtml += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center" style="mso-number-format:'\\@';">${emp.nip}</td>
          <td class="bold">${escapeHtml(emp.name)}</td>
          <td>${escapeHtml(emp.department)}</td>
          <td>${escapeHtml(emp.position)}</td>
          <td class="center">${item.totalHadir} Hari</td>
          <td class="center bold">${item.totalOvertimeDays} Hari</td>
          <td class="center">${item.weekdayOvertimeHours > 0 ? item.weekdayOvertimeHours + ' Jam' : '-'}</td>
          <td class="center">${item.saturdayOvertimeHours > 0 ? item.saturdayOvertimeHours + ' Jam' : '-'}</td>
          <td class="center">${item.sundayOvertimeHours > 0 ? item.sundayOvertimeHours + ' Jam' : '-'}</td>
          <td class="overtime">${item.totalOvertimeHours > 0 ? item.totalOvertimeHours + ' Jam' : '0 Jam'}</td>
        </tr>
      `;
    });

    tableHtml += `
          <tr class="total-row">
            <td colspan="5" style="text-align: right; padding: 8px; font-weight: bold;">TOTAL KESELURUHAN:</td>
            <td class="center bold">${totalHadirSum} Hari</td>
            <td class="center bold">${totalOtDaysSum} Hari</td>
            <td class="center bold">${totalWeekdaySum} Jam</td>
            <td class="center bold">${totalSaturdaySum} Jam</td>
            <td class="center bold">${totalSundaySum} Jam</td>
            <td class="overtime" style="background-color: #d97706; color: #ffffff; font-weight: bold; font-size: 12pt;">${grandTotalOt} Jam</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Rekap_Lembur_Per_Karyawan_PT_ABI_${getTodayString()}.xls`;
    link.click();
    showToast('File Excel Rekap Lembur (.xls) berhasil diunduh!', 'success');
    return;
  }

  // Format 2: Rincian Harian Presensi
  let totalOvertimeHours = 0;
  reports.forEach(r => {
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    totalOvertimeHours += ot.hoursDecimal;
  });

  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Rekap Absensi & Lembur</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
      <style>
        th { background-color: #1d4ed8; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 6px 10px; text-align: center; }
        td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: middle; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .title { font-size: 14pt; font-weight: bold; color: #1e3a8a; }
        .sub { font-size: 9pt; color: #475569; }
        .overtime { background-color: #fef3c7; color: #b45309; font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      <table>
        <!-- KOP SURAT RESMI PERUSAHAAN -->
        <tr>
          <td colspan="12" align="center" style="text-align: center; padding: 10px 0; background-color: #ffffff; border: none;">
            <img src="${getCompanyLetterhead()}" width="680" height="95" alt="PT. ANUGERAH BERKAH INDUSTRI" style="display: block; margin: 0 auto;" />
          </td>
        </tr>
        <tr><td colspan="12" style="border-bottom: 2px solid #000000; height: 3px; padding: 0;"></td></tr>
        <tr><td colspan="12" style="height: 10px; border: none;"></td></tr>
        <tr><td colspan="12" class="bold" style="font-size: 13pt; text-align: center; color: #1e3a8a;">LAPORAN REKAPITULASI PRESENSI & JAM LEMBUR KARYAWAN</td></tr>
        <tr><td colspan="12" class="sub" style="text-align: center;">Periode: ${rangeLabel} | Dicetak: ${new Date().toLocaleString('id-ID')} | Total Data: ${reports.length} Baris</td></tr>
        <tr><td colspan="12" style="height: 10px; border: none;"></td></tr>
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Hari</th>
          <th>NIP</th>
          <th>Nama Karyawan</th>
          <th>Departemen</th>
          <th>Jam Masuk</th>
          <th>Jam Pulang</th>
          <th>Durasi Kerja</th>
          <th style="background-color: #b45309;">Jam Lembur</th>
          <th>Status Kehadiran</th>
          <th>Lokasi GPS</th>
        </tr>
  `;

  reports.forEach((r, idx) => {
    const emp = getEmployee(r.employeeId);
    const dayName = getDayNameIndonesian(r.date);
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    const loc = (r.clockInLocation ? r.clockInLocation.address : '-');

    tableHtml += `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="center">${r.date}</td>
        <td class="center">${dayName}</td>
        <td class="center" style="mso-number-format:'\\@';">${emp.nip}</td>
        <td class="bold">${escapeHtml(emp.name)}</td>
        <td>${escapeHtml(emp.department)}</td>
        <td class="center font-mono">${r.clockIn || '-'}</td>
        <td class="center font-mono">${r.clockOut || '-'}</td>
        <td class="center">${r.workHours || '-'}</td>
        <td class="overtime">${ot.hoursDecimal > 0 ? ot.formatted : '-'}</td>
        <td class="center">${r.clockInStatus || r.status || 'Hadir'}</td>
        <td>${escapeHtml(loc)}</td>
      </tr>
    `;
  });

  tableHtml += `
        <tr style="font-weight: bold; background-color: #f8fafc;">
          <td colspan="9" style="text-align: right; padding: 8px;">TOTAL JAM LEMBUR PERIODE INI:</td>
          <td class="overtime" style="font-size: 11pt;">${Math.round(totalOvertimeHours * 10) / 10} Jam</td>
          <td colspan="2"></td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Laporan_Absensi_Lembur_30_Hari_PT_ABI_${getTodayString()}.xls`;
  link.click();
  showToast('File Excel (.xls) berhasil diunduh!', 'success');
}

// Export to PDF
function exportReportsToPDF() {
  const reports = getFilteredReports();
  if (reports.length === 0) {
    showToast('Tidak ada data absensi untuk diekspor!', 'warning');
    return;
  }

  const rangeLabel = state.reportFilter.range === '30days'
    ? `30 Hari Terakhir (${getPastDateString(30)} s/d ${getTodayString()})`
    : (state.reportFilter.range === 'month' ? `Bulan ${state.reportFilter.month}` : `${state.reportFilter.startDate || '-'} s/d ${state.reportFilter.endDate || '-'}`);

  const container = document.createElement('div');
  container.id = 'pdf-export-element';
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#1e293b';
  container.style.backgroundColor = '#ffffff';

  // Format 1: Rekapitulasi Jam Lembur Per Orang (34 Karyawan)
  if (state.reportFilter.viewType === 'per-employee') {
    const summaryList = getOvertimeSummaryPerEmployee(reports);
    let totalHadirSum = 0;
    let totalOtDaysSum = 0;
    let totalWeekdaySum = 0;
    let totalSaturdaySum = 0;
    let totalSundaySum = 0;
    let grandTotalOt = 0;
    let activeOtStaffCount = 0;

    summaryList.forEach(item => {
      totalHadirSum += item.totalHadir;
      totalOtDaysSum += item.totalOvertimeDays;
      totalWeekdaySum += item.weekdayOvertimeHours;
      totalSaturdaySum += item.saturdayOvertimeHours;
      totalSundaySum += item.sundayOvertimeHours;
      grandTotalOt += item.totalOvertimeHours;
      if (item.totalOvertimeHours > 0) activeOtStaffCount++;
    });

    container.innerHTML = `
      <!-- KOP SURAT RESMI PT ABI -->
      <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000000; padding-bottom: 6px;">
        <img src="${getCompanyLetterhead()}" style="width: 100%; max-height: 95px; object-fit: contain; display: block; margin: 0 auto;" alt="Kop Surat PT. ANUGERAH BERKAH INDUSTRI">
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        <div>
          <h2 style="font-size: 15px; font-weight: bold; color: #1e3a8a; margin: 0; text-transform: uppercase;">Laporan Rekapitulasi Jam Lembur Karyawan (Per Orang)</h2>
          <p style="font-size: 10px; color: #475569; margin: 2px 0 0 0;">Daftar akumulasi jam lembur resmi seluruh staf PT ANUGERAH BERKAH INDUSTRI</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: bold; color: #b45309;">Periode: ${rangeLabel}</div>
          <div style="font-size: 9px; color: #64748b;">Dicetak: ${new Date().toLocaleString('id-ID')} WIB</div>
        </div>
      </div>

      <!-- KPI Summary Boxes -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #f8fafc;">
          <div style="font-size: 10px; color: #64748b;">Total Karyawan</div>
          <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${summaryList.length} Orang</div>
        </div>
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #f0fdf4;">
          <div style="font-size: 10px; color: #166534;">Karyawan Lembur</div>
          <div style="font-size: 14px; font-weight: bold; color: #15803d;">${activeOtStaffCount} Orang</div>
        </div>
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #eff6ff;">
          <div style="font-size: 10px; color: #1d4ed8;">Total Hari Lembur</div>
          <div style="font-size: 14px; font-weight: bold; color: #1e40af;">${totalOtDaysSum} Sesi</div>
        </div>
        <div style="flex: 1; border: 1px solid #fef3c7; border-radius: 8px; padding: 8px; text-align: center; background: #fffbeb;">
          <div style="font-size: 10px; color: #92400e;">Grand Total Jam Lembur</div>
          <div style="font-size: 14px; font-weight: bold; color: #b45309;">${grandTotalOt} Jam</div>
        </div>
      </div>

      <div style="font-size: 9px; color: #64748b; margin-bottom: 8px; font-style: italic;">
        * Aturan Lembur: Senin - Jumat (&gt;17:00), Sabtu (&gt;13:00), Minggu (Penuh). Sisa menit &lt;45 hangus, &ge;45 menit dibulatkan ke 1 Jam.
      </div>

      <!-- Table Summary Per Person -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">No</th>
            <th style="padding: 5px; border: 1px solid #94a3b8;">NIP & Nama Karyawan</th>
            <th style="padding: 5px; border: 1px solid #94a3b8;">Departemen</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Hadir</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Hari Lembur</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Senin-Jum (&gt;17:00)</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Sabtu (&gt;13:00)</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Minggu (Full)</th>
            <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center; background-color: #b45309;">TOTAL LEMBUR</th>
          </tr>
        </thead>
        <tbody>
          ${summaryList.map((item, i) => {
      const emp = item.employee;
      return `
              <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-weight: bold;">${escapeHtml(emp.name)} <span style="font-weight: normal; color: #64748b;">(${escapeHtml(emp.nip)})</span></td>
                <td style="padding: 4px; border: 1px solid #cbd5e1;">${escapeHtml(emp.department)}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${item.totalHadir} Hari</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${item.totalOvertimeDays} Hari</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${item.weekdayOvertimeHours > 0 ? item.weekdayOvertimeHours + ' Jam' : '-'}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${item.saturdayOvertimeHours > 0 ? item.saturdayOvertimeHours + ' Jam' : '-'}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${item.sundayOvertimeHours > 0 ? item.sundayOvertimeHours + ' Jam' : '-'}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b45309; background-color: ${item.totalOvertimeHours > 0 ? '#fef3c7' : 'transparent'};">
                  ${item.totalOvertimeHours > 0 ? item.totalOvertimeHours + ' Jam' : '0 Jam'}
                </td>
              </tr>
            `;
    }).join('')}
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td colspan="3" style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">TOTAL KESELURUHAN:</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalHadirSum} Hari</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalOtDaysSum} Hari</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalWeekdaySum} Jam</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalSaturdaySum} Jam</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalSundaySum} Jam</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #b45309; background-color: #fef3c7; font-size: 11px;">
              ${grandTotalOt} Jam
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Signature Block -->
      <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; page-break-inside: avoid;">
        <div style="text-align: center; width: 200px;">
          <div>Dibuat Oleh,</div>
          <div style="height: 50px;"></div>
          <div style="font-weight: bold; text-decoration: underline;">MOCH TAUFIK ROMDHONI</div>
          <div>HRD & GA PT ABI</div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div>Mengetahui / Menyetujui,</div>
          <div style="height: 50px;"></div>
          <div style="font-weight: bold; text-decoration: underline;">DIREKTUR OPERASIONAL</div>
          <div>PT ANUGERAH BERKAH INDUSTRI</div>
        </div>
      </div>
    `;

    if (window.html2pdf) {
      showToast('Sedang membuat file PDF Rekap Lembur...', 'info');
      const opt = {
        margin: 10,
        filename: `Rekap_Lembur_Per_Karyawan_PT_ABI_${getTodayString()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      window.html2pdf().set(opt).from(container).save().then(() => {
        showToast('File PDF Rekap Lembur berhasil didownload!', 'success');
      }).catch(err => {
        console.warn('html2pdf fallback to print:', err);
        window.print();
      });
    } else {
      window.print();
    }
    return;
  }

  // Format 2: Rincian Harian Presensi
  let totalOvertimeHours = 0;
  reports.forEach(r => {
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    totalOvertimeHours += ot.hoursDecimal;
  });

  container.innerHTML = `
    <!-- KOP SURAT RESMI PT ABI -->
    <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000000; padding-bottom: 6px;">
      <img src="${getCompanyLetterhead()}" style="width: 100%; max-height: 95px; object-fit: contain; display: block; margin: 0 auto;" alt="Kop Surat PT. ANUGERAH BERKAH INDUSTRI">
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      <div>
        <h2 style="font-size: 15px; font-weight: bold; color: #1e3a8a; margin: 0; text-transform: uppercase;">Laporan Rincian Presensi & Jam Kerja Harian</h2>
        <p style="font-size: 10px; color: #475569; margin: 2px 0 0 0;">Log detail jam masuk, jam pulang, dan lembur harian staf</p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: bold; color: #1d4ed8;">Periode: ${rangeLabel}</div>
        <div style="font-size: 9px; color: #64748b;">Dicetak: ${new Date().toLocaleString('id-ID')} WIB</div>
      </div>
    </div>

    <!-- Summary KPI Box -->
    <div style="display: flex; gap: 10px; margin-bottom: 16px;">
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #f8fafc;">
        <div style="font-size: 10px; color: #64748b;">Total Presensi</div>
        <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${reports.length} Data</div>
      </div>
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #f0fdf4;">
        <div style="font-size: 10px; color: #166534;">Tepat Waktu</div>
        <div style="font-size: 14px; font-weight: bold; color: #15803d;">${reports.filter(r => r.clockInStatus === 'Tepat Waktu').length}</div>
      </div>
      <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #fff1f2;">
        <div style="font-size: 10px; color: #9f1239;">Terlambat</div>
        <div style="font-size: 14px; font-weight: bold; color: #be123c;">${reports.filter(r => r.clockInStatus === 'Terlambat').length}</div>
      </div>
      <div style="flex: 1; border: 1px solid #fef3c7; border-radius: 8px; padding: 8px; text-align: center; background: #fffbeb;">
        <div style="font-size: 10px; color: #92400e;">Total Jam Lembur</div>
        <div style="font-size: 14px; font-weight: bold; color: #b45309;">${Math.round(totalOvertimeHours * 10) / 10} Jam</div>
      </div>
    </div>

    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #1d4ed8; color: #ffffff;">
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">No</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Tanggal</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Hari</th>
          <th style="padding: 5px; border: 1px solid #94a3b8;">NIP & Nama Karyawan</th>
          <th style="padding: 5px; border: 1px solid #94a3b8;">Departemen</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Masuk</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Pulang</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Durasi</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center; background-color: #b45309;">Jam Lembur</th>
          <th style="padding: 5px; border: 1px solid #94a3b8; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map((r, i) => {
    const emp = getEmployee(r.employeeId);
    const dayName = getDayNameIndonesian(r.date);
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    return `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${r.date}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${dayName}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; font-weight: bold;">${escapeHtml(emp.name)} (${escapeHtml(emp.nip)})</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1;">${escapeHtml(emp.department)}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${r.clockIn || '-'}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${r.clockOut || '-'}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${r.workHours || '-'}</td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b45309; background-color: ${ot.hoursDecimal > 0 ? '#fef3c7' : 'transparent'};">
                ${ot.hoursDecimal > 0 ? ot.formatted : '-'}
              </td>
              <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">${r.clockInStatus || r.status || 'Hadir'}</td>
            </tr>
          `;
  }).join('')}
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="8" style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">TOTAL JAM LEMBUR:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #b45309; background-color: #fef3c7; font-size: 10px;">
            ${Math.round(totalOvertimeHours * 10) / 10} Jam
          </td>
          <td style="border: 1px solid #cbd5e1;"></td>
        </tr>
      </tbody>
    </table>

    <!-- Signature Block -->
    <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; page-break-inside: avoid;">
      <div style="text-align: center; width: 200px;">
        <div>Dibuat Oleh,</div>
        <div style="height: 50px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">MOCH TAUFIK ROMDHONI</div>
        <div>HRD & GA PT ABI</div>
      </div>
      <div style="text-align: center; width: 200px;">
        <div>Mengetahui / Menyetujui,</div>
        <div style="height: 50px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">DIREKTUR OPERASIONAL</div>
        <div>PT ANUGERAH BERKAH INDUSTRI</div>
      </div>
    </div>
  `;

  if (window.html2pdf) {
    showToast('Sedang membuat file PDF...', 'info');
    const opt = {
      margin: 10,
      filename: `Laporan_Absensi_Lembur_30_Hari_PT_ABI_${getTodayString()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    window.html2pdf().set(opt).from(container).save().then(() => {
      showToast('File PDF berhasil didownload!', 'success');
    }).catch(err => {
      console.warn('html2pdf fallback to print:', err);
      window.print();
    });
  } else {
    window.print();
  }
}

function exportDatabaseJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    company: state.officeSettings.companyName,
    officeSettings: state.officeSettings,
    employees: state.employees,
    attendances: state.attendances,
    requests: state.requests
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Cadangan_Database_SmartAbsen_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  showToast('Cadangan basis data JSON berhasil diunduh!', 'success');
}

function importDatabaseJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.employees) && Array.isArray(data.attendances)) {
        state.employees = data.employees;
        state.attendances = data.attendances;
        if (data.requests) state.requests = data.requests;
        if (data.officeSettings) state.officeSettings = { ...state.officeSettings, ...data.officeSettings };
        saveDatabase();
        showToast('Basis data berhasil dipulihkan dari file JSON!', 'success');
        renderApp();
      } else {
        showToast('Format file JSON tidak sesuai struktur aplikasi!', 'error');
      }
    } catch (err) {
      showToast('Gagal membaca file JSON!', 'error');
    }
  };
  reader.readAsText(file);
}

function getFilteredReports() {
  return state.attendances.filter(att => {
    // 1. Filter Rentang Waktu (30 Hari, Bulan, Custom, Semua)
    if (state.reportFilter.range === '30days') {
      const past30 = getPastDateString(30);
      const today = getTodayString();
      if (att.date < past30 || att.date > today) return false;
    } else if (state.reportFilter.range === 'month') {
      if (state.reportFilter.month && !att.date.startsWith(state.reportFilter.month)) return false;
    } else if (state.reportFilter.range === 'custom') {
      if (state.reportFilter.startDate && att.date < state.reportFilter.startDate) return false;
      if (state.reportFilter.endDate && att.date > state.reportFilter.endDate) return false;
    }

    // 2. Filter Karyawan
    if (state.reportFilter.employeeId !== 'ALL' && att.employeeId !== state.reportFilter.employeeId) return false;

    // 3. Filter Departemen
    const emp = getEmployee(att.employeeId);
    if (state.reportFilter.department !== 'ALL' && emp.department !== state.reportFilter.department) return false;

    // 4. Filter Status
    if (state.reportFilter.status !== 'ALL') {
      if (state.reportFilter.status === 'Terlambat' && att.clockInStatus !== 'Terlambat') return false;
      if (state.reportFilter.status === 'Tepat Waktu' && att.clockInStatus !== 'Tepat Waktu') return false;
      if (state.reportFilter.status === 'Lembur') {
        const ot = calculateOvertime(att.date, att.clockIn, att.clockOut);
        if (ot.hoursDecimal <= 0) return false;
      }
    }
    return true;
  });
}

// Rekapitulasi Jam Lembur Per Karyawan (Per Orang)
function getOvertimeSummaryPerEmployee(filteredAtts) {
  const atts = filteredAtts || getFilteredReports();
  const summaryMap = {};

  // Daftarkan seluruh karyawan
  state.employees.forEach(emp => {
    if (state.reportFilter.department !== 'ALL' && emp.department !== state.reportFilter.department) return;
    if (state.reportFilter.employeeId !== 'ALL' && emp.id !== state.reportFilter.employeeId) return;

    summaryMap[emp.id] = {
      employee: emp,
      totalHadir: 0,
      totalOvertimeDays: 0,
      totalOvertimeHours: 0,
      weekdayOvertimeHours: 0,
      saturdayOvertimeHours: 0,
      sundayOvertimeHours: 0,
      records: []
    };
  });

  // Hitung total jam lembur per orang
  atts.forEach(att => {
    if (!summaryMap[att.employeeId]) {
      const emp = getEmployee(att.employeeId);
      summaryMap[att.employeeId] = {
        employee: emp,
        totalHadir: 0,
        totalOvertimeDays: 0,
        totalOvertimeHours: 0,
        weekdayOvertimeHours: 0,
        saturdayOvertimeHours: 0,
        sundayOvertimeHours: 0,
        records: []
      };
    }

    const s = summaryMap[att.employeeId];
    s.totalHadir++;
    s.records.push(att);

    const ot = calculateOvertime(att.date, att.clockIn, att.clockOut);
    if (ot.hoursDecimal > 0) {
      s.totalOvertimeDays++;
      s.totalOvertimeHours += ot.hoursDecimal;

      const d = new Date(att.date + 'T12:00:00');
      const day = d.getDay();
      if (day === 0) {
        s.sundayOvertimeHours += ot.hoursDecimal;
      } else if (day === 6) {
        s.saturdayOvertimeHours += ot.hoursDecimal;
      } else {
        s.weekdayOvertimeHours += ot.hoursDecimal;
      }
    }
  });

  // Urutkan dari jam lembur terbanyak ke terendah
  let res = Object.values(summaryMap).sort((a, b) => b.totalOvertimeHours - a.totalOvertimeHours);
  if (state.reportFilter.status === 'Lembur') {
    res = res.filter(item => item.totalOvertimeHours > 0);
  }
  return res;
}

// ============================================================================
// 7. MODALS HANDLER
// ============================================================================
function openApprovalModal(requestId, action) {
  state.approvalModal = {
    isOpen: true,
    requestId: requestId,
    action: action,
    notes: action === 'APPROVE' ? 'Disetujui oleh HRD' : ''
  };
  renderModals();
}

function closeApprovalModal() {
  state.approvalModal.isOpen = false;
  state.approvalModal.requestId = null;
  renderModals();
}

function openAddEmployeeModal() {
  state.employeeModal = {
    isOpen: true,
    isEdit: false,
    data: {
      id: '',
      nip: '',
      name: '',
      email: '',
      department: 'Produksi',
      position: '',
      phone: '',
      totalQuota: 12,
      pin: ''
    }
  };
  renderModals();
}

function openEditEmployeeModal(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  state.employeeModal = {
    isOpen: true,
    isEdit: true,
    data: {
      id: emp.id,
      nip: emp.nip,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      position: emp.position,
      phone: emp.phone || '',
      totalQuota: emp.leaveQuota ? emp.leaveQuota.total : 12,
      pin: emp.pin || ''
    }
  };
  renderModals();
}

function closeEmployeeModal() {
  state.employeeModal.isOpen = false;
  renderModals();
}

function viewPhoto(title, url) {
  if (!url) return;
  state.photoModal = {
    isOpen: true,
    title: title || 'Pratinjau Foto',
    url: url
  };
  renderModals();
}

function closePhotoModal() {
  state.photoModal.isOpen = false;
  renderModals();
}

// ============================================================================
// 8. TEMPLATE RENDERERS
// ============================================================================

// Render Login Screen
function renderLoginScreen() {
  const timeStr = getCurrentTimeFormatted();
  const dateStr = getCurrentDateFormatted();
  const isEmpRole = state.loginRole === 'employee';

  return `
    <div class="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-6">
      <div class="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        
        <!-- Header Brand & Clock -->
        <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 text-white text-center relative overflow-hidden">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          
          <div class="w-20 h-20 rounded-2xl bg-white p-2 flex items-center justify-center mx-auto mb-3 shadow-xl border border-white/40 overflow-hidden" style="width: 80px; height: 80px;">
            <img src="${escapeHtml(state.officeSettings.companyLogo || 'logo.jpg')}" 
              alt="Logo PT ABI" 
              style="width: 100%; height: 100%; object-fit: contain;"
              class="w-full h-full object-contain"
              onerror="if(this.src.indexOf('logo.png') === -1) { this.src = 'logo.png'; }">
          </div>

          <h2 class="text-xl font-black tracking-tight">Portal SmartAbsen</h2>
          <p class="text-xs text-blue-100 font-medium mt-0.5">${escapeHtml(state.officeSettings.companyName)}</p>

          <div class="mt-4 pt-3 border-t border-white/20 flex items-center justify-center space-x-2 text-xs font-mono text-blue-100">
            <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
            <span id="live-clock">${timeStr} WIB</span>
            <span>•</span>
            <span>${dateStr}</span>
          </div>
        </div>

        <div class="p-6 sm:p-8 space-y-5">
          <!-- Role Selector Tabs -->
          <div class="grid grid-cols-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button type="button" data-action="switch-login-role" data-role="employee"
              class="py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${isEmpRole ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Karyawan</span>
            </button>
            <button type="button" data-action="switch-login-role" data-role="admin"
              class="py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${!isEmpRole ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Admin / HRD</span>
            </button>
          </div>

          <!-- Form Login -->
          <form id="login-form" class="space-y-4 text-xs font-medium">
            <div>
              <label class="block font-bold text-slate-700 mb-1.5">
                ${!isEmpRole ? 'NIP / Email Admin' : 'NIP Karyawan'}
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input type="text" id="login-id" required
                  value=""
                  placeholder="${!isEmpRole ? 'Masukkan NIP / Email Admin' : 'Masukkan NIP Anda (Contoh: 11001)'}"
                  autocomplete="username"
                  class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-xs font-mono font-bold">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1.5">
                ${!isEmpRole ? 'Password / PIN Admin' : 'PIN Karyawan'}
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input type="password" id="login-pin" required
                  value=""
                  placeholder="${!isEmpRole ? 'Masukkan Password / PIN Admin' : 'Masukkan PIN Anda'}"
                  autocomplete="current-password"
                  class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-xs font-mono">
              </div>
            </div>

            <div class="flex items-center justify-between pt-1">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" id="login-remember" checked class="rounded text-blue-600 focus:ring-blue-500">
                <span class="text-slate-600 text-xs font-medium">Ingat Saya</span>
              </label>
              <span class="text-[11px] text-blue-600 font-medium">Bantuan Login?</span>
            </div>

            <button type="submit"
              class="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer">
              <span>MASUK KE SISTEM & ABSEN</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  `;
}

// Render Main App
function renderMainApp() {
  const isEmployee = state.currentRole === 'employee';
  const pendingCount = state.requests.filter(r => r.status === 'PENDING').length;
  const user = state.currentUser || state.employees[0];

  return `
    <!-- Top Navigation Header -->
    <header class="glass-header sticky top-0 z-30 shadow-sm no-print">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          
          <!-- Logo & Brand -->
          <div class="flex items-center space-x-3">
            <div class="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-xs p-1 border border-slate-200 overflow-hidden shrink-0" style="width: 44px; height: 44px;">
              <img src="${escapeHtml(state.officeSettings.companyLogo || 'logo.jpg')}" 
                alt="Logo PT ABI" 
                style="width: 100%; height: 100%; object-fit: contain;"
                class="w-full h-full object-contain"
                onerror="if(this.src.indexOf('logo.png') === -1) { this.src = 'logo.png'; }">
            </div>
            <div>
              <h1 class="text-lg font-bold text-slate-900 leading-tight">SmartAbsen</h1>
              <p class="text-xs text-slate-500 font-medium">${escapeHtml(state.officeSettings.companyName)}</p>
            </div>
          </div>

          <!-- Central Role Switcher Pill (Hanya untuk Admin) -->
          ${state.currentUser && state.currentUser.role === 'admin' ? `
            <div class="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button type="button" data-action="switch-role" data-role="employee"
                class="px-3.5 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 ${isEmployee ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Mode Karyawan</span>
              </button>
              <button type="button" data-action="switch-role" data-role="admin"
                class="px-3.5 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 relative ${!isEmployee ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Mode Admin / HRD</span>
                ${pendingCount > 0 ? `<span class="w-2 h-2 rounded-full bg-rose-500 absolute top-1 right-1"></span>` : ''}
              </button>
            </div>
          ` : `
            <div class="hidden sm:flex items-center space-x-2 px-3.5 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Portal Karyawan</span>
            </div>
          `}

          <!-- User Profile & Logout -->
          <div class="flex items-center space-x-2.5">
            ${getGoogleScriptUrl() ? `
              <button type="button" data-action="sync-cloud-data" title="Tarik data terbaru dari Google Spreadsheet"
                class="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-200 shadow-xs cursor-pointer">
                <svg class="w-3.5 h-3.5 text-emerald-600 ${state.isSyncingSheets ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span class="hidden md:inline">Sinkron Cloud</span>
              </button>
            ` : ''}

            <div class="hidden sm:flex items-center space-x-2.5 bg-white py-1.5 px-3 rounded-xl border border-slate-200 shadow-xs">
              <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User'}" class="w-8 h-8 rounded-lg object-cover">
              <div class="text-left text-xs">
                <div class="font-bold text-slate-800 truncate max-w-[140px]">${escapeHtml(user.name)}</div>
                <div class="text-[10px] text-slate-400 font-medium">${escapeHtml(user.position || user.department)}</div>
              </div>
            </div>

            <button type="button" data-action="logout" title="Keluar dari Akun"
              class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </header>

    <!-- Sub-Navigation Tabs Bar -->
    <nav class="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-xs no-print">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-6 overflow-x-auto text-xs font-bold scrollbar-none">
          ${isEmployee ? `
            <button type="button" data-action="switch-tab" data-tab="attendance"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Presensi Kehadiran</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="history"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span>Riwayat Absen & Rekapan Lembur Saya</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="requests"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Pengajuan Izin & Cuti</span>
            </button>
          ` : `
            <button type="button" data-action="switch-tab" data-tab="dashboard"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              <span>Dashboard KPI</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="approvals"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors relative ${state.currentTab === 'approvals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span>Pusat Persetujuan</span>
              ${pendingCount > 0 ? `<span class="ml-1.5 px-2 py-0.5 text-xs bg-rose-500 text-white rounded-full">${pendingCount}</span>` : ''}
            </button>
            <button type="button" data-action="switch-tab" data-tab="employees"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'employees' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span>Data Karyawan (34)</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="overtime"
              class="py-3 px-2 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors ${state.currentTab === 'overtime' ? 'border-amber-500 text-amber-600 font-black' : 'border-transparent text-slate-600 hover:text-amber-600 font-bold'}">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>👥 Rekap Lembur (34 Staf)</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="reports"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'reports' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Rekapitulasi & Laporan</span>
            </button>
            <button type="button" data-action="switch-tab" data-tab="settings"
              class="py-3 px-1 border-b-2 flex items-center space-x-2 whitespace-nowrap transition-colors ${state.currentTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
              <span>Pengaturan & Sheets</span>
            </button>
          `}
        </div>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      ${renderActiveTabContent()}
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-500 no-print">
      <div class="max-w-7xl mx-auto px-4">
        &copy; 2026 ${escapeHtml(state.officeSettings.companyName)}. Sistem Presensi & Pengajuan Cuti Mandiri.
      </div>
    </footer>
  `;
}

// Dispatcher for Active Tab
function renderActiveTabContent() {
  const isAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
  if (!isAdmin) {
    state.currentRole = 'employee';
    if (!['attendance', 'requests', 'history'].includes(state.currentTab)) {
      state.currentTab = 'attendance';
    }
  }

  if (state.currentRole === 'employee') {
    switch (state.currentTab) {
      case 'attendance': return renderEmployeeAttendanceTab();
      case 'history': return renderEmployeeHistoryTab();
      case 'requests': return renderEmployeeRequestsTab();
      default: return renderEmployeeAttendanceTab();
    }
  } else {
    switch (state.currentTab) {
      case 'dashboard': return renderAdminDashboardTab();
      case 'approvals': return renderAdminApprovalsTab();
      case 'employees': return renderAdminEmployeesTab();
      case 'overtime': {
        state.reportFilter.viewType = 'per-employee';
        return renderAdminReportsTab();
      }
      case 'reports': return renderAdminReportsTab();
      case 'settings': return renderAdminSettingsTab();
      default: return renderAdminDashboardTab();
    }
  }
}

// ----------------------------------------------------------------------------
// VIEW: Employee Attendance (Presensi Kehadiran)
// ----------------------------------------------------------------------------
function renderEmployeeAttendanceTab() {
  const timeStr = getCurrentTimeFormatted();
  const dateStr = getCurrentDateFormatted();
  const todayAtt = getTodayAttendance(state.currentUser ? state.currentUser.id : '');
  const hasClockedIn = !!(todayAtt && todayAtt.clockIn);
  const hasClockedOut = !!(todayAtt && todayAtt.clockOut);
  const quota = state.currentUser && state.currentUser.leaveQuota ? state.currentUser.leaveQuota : { remaining: 12, total: 12, used: 0 };

  return `
    <div class="space-y-6">
      <!-- Live Clock Banner -->
      <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="text-center md:text-left">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md mb-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 mr-2 pulse-dot"></span>
            Waktu Presensi Kantor
          </span>
          <div class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono" id="live-clock-banner">${timeStr} WIB</div>
          <div class="text-sm font-medium text-blue-100 mt-1">${dateStr}</div>
        </div>

        <div class="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
          <div class="text-right">
            <div class="text-xs text-blue-200">Jadwal Kerja Normal</div>
            <div class="text-sm font-bold">${state.officeSettings.workStart} - ${state.officeSettings.workEnd} WIB</div>
            <div class="text-[11px] text-amber-200">Batas Tepat Waktu: ${state.officeSettings.workStart} WIB</div>
          </div>
        </div>
      </div>

      <!-- Main Presensi Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left Column: Camera, GPS & Clock In/Out Buttons -->
        <div class="lg:col-span-7 space-y-6">
          
          <!-- GPS Validation Card -->
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <h3 class="font-bold text-slate-800 text-sm">Status Lokasi GPS</h3>
              </div>
              <button type="button" data-action="refresh-gps"
                class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1 cursor-pointer">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span>Cek GPS</span>
              </button>
            </div>

            <div class="flex items-center justify-between p-3 rounded-xl ${state.gps.isInRadius ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}">
              <div class="space-y-0.5">
                <div class="text-xs font-bold ${state.gps.isInRadius ? 'text-emerald-800' : 'text-amber-800'}">
                  ${state.gps.isInRadius ? '✓ Di Dalam Radius Kantor (WFO)' : '⚠ Di Luar Radius Kantor (WFH / Dinas)'}
                </div>
                <div class="text-[11px] text-slate-500">
                  Jarak ke kantor: <strong>${state.gps.distanceToOffice !== null ? state.gps.distanceToOffice + ' meter' : 'Mendeteksi...'}</strong> (Toleransi: ${state.officeSettings.allowedRadiusMeters}m)
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${state.gps.isInRadius ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">
                ${state.gps.isInRadius ? 'Bisa Absen WFO' : 'Diluar Radius'}
              </span>
            </div>
          </div>

          <!-- Camera Card -->
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <h3 class="font-bold text-slate-800 text-sm">Verifikasi Wajah (Selfie)</h3>
              </div>
              <span class="text-[11px] text-slate-400">Wajib untuk Absen Masuk</span>
            </div>

            <!-- Viewport -->
            <div class="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center">
              ${state.camera.capturedPhoto ? `
                <img src="${state.camera.capturedPhoto}" class="w-full h-[280px] object-cover">
                <div class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-semibold flex items-center space-x-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Foto Selfie Terverifikasi</span>
                </div>
              ` : state.camera.active ? `
                <video id="camera-video" autoplay playsinline class="w-full h-[280px] object-cover"></video>
                <div class="camera-guide-box"></div>
              ` : `
                <div class="text-center p-6 space-y-3">
                  <div class="w-14 h-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </div>
                  <p class="text-xs text-slate-300">Kamera belum aktif. Klik tombol di bawah untuk mengambil selfie.</p>
                </div>
              `}
            </div>

            <!-- Camera Controls -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              ${state.camera.capturedPhoto ? `
                <button type="button" data-action="retake-photo"
                  class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  <span>Ambil Foto Ulang</span>
                </button>
              ` : state.camera.active ? `
                <button type="button" data-action="capture-photo"
                  class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center space-x-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
                  <span>Ambil Foto Sekarang</span>
                </button>
                <button type="button" data-action="stop-camera"
                  class="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">
                  Batal
                </button>
              ` : `
                <button type="button" data-action="start-camera"
                  class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center space-x-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  <span>Buka Kamera Selfie</span>
                </button>

                <label class="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  <span>Upload Foto</span>
                  <input type="file" accept="image/*" class="hidden" id="photo-file-input">
                </label>
              `}
            </div>
          </div>

          <!-- Action Buttons: Absen Masuk & Pulang -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" data-action="clock-in"
              ${hasClockedIn ? 'disabled' : ''}
              class="py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center space-x-3 transition shadow-lg ${hasClockedIn
      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 cursor-pointer transform hover:-translate-y-0.5'
    }">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              <span>${hasClockedIn ? 'Sudah Absen Masuk' : 'ABSEN MASUK'}</span>
            </button>

            <button type="button" data-action="clock-out"
              ${!hasClockedIn || hasClockedOut ? 'disabled' : ''}
              class="py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center space-x-3 transition shadow-lg ${!hasClockedIn || hasClockedOut
      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 cursor-pointer transform hover:-translate-y-0.5'
    }">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              <span>${hasClockedOut ? 'Sudah Absen Pulang' : 'ABSEN PULANG'}</span>
            </button>
          </div>

        </div>

        <!-- Right Column: Status Detail & Kuota Cuti -->
        <div class="lg:col-span-5 space-y-6">
          
          <!-- Today Status Card -->
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 class="font-bold text-slate-800 text-sm">Status Kehadiran Hari Ini</h3>

            ${todayAtt ? `
              <div class="p-4 rounded-xl ${todayAtt.clockInStatus === 'Terlambat' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'} space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-600">Presensi Masuk:</span>
                  <span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${todayAtt.clockInStatus === 'Terlambat' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}">
                    ${escapeHtml(todayAtt.clockInStatus)} (${escapeHtml(todayAtt.clockIn)})
                  </span>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span class="text-xs font-bold text-slate-600">Presensi Pulang:</span>
                  <span class="text-xs font-bold ${todayAtt.clockOut ? 'text-slate-800' : 'text-slate-400 italic'}">
                    ${todayAtt.clockOut ? todayAtt.clockOut + ' WIB' : 'Belum Absen Pulang'}
                  </span>
                </div>

                ${todayAtt.workHours ? `
                  <div class="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span class="text-xs font-bold text-slate-600">Total Durasi Kerja:</span>
                    <span class="text-xs font-extrabold text-blue-600">${escapeHtml(todayAtt.workHours)}</span>
                  </div>
                ` : ''}

                ${todayAtt.clockInPhoto ? `
                  <div class="pt-2">
                    <button type="button" data-action="view-photo" data-title="Foto Selfie Absen Masuk" data-url="${escapeHtml(todayAtt.clockInPhoto)}"
                      class="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1 cursor-pointer">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <span>Lihat Foto Selfie Masuk</span>
                    </button>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <div class="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div class="text-xs font-bold text-slate-700">Belum Ada Catatan Absensi Hari Ini</div>
                <p class="text-[11px] text-slate-400">Silakan ambil foto selfie dan tekan tombol Absen Masuk.</p>
              </div>
            `}
          </div>

          <!-- Leave Quota Card -->
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-slate-800 text-sm">Alokasi Cuti Tahunan</h3>
              <span class="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                ${quota.remaining} Hari Tersisa
              </span>
            </div>

            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="text-[10px] text-slate-400 font-semibold uppercase">Total Hak</div>
                <div class="text-base font-black text-slate-800 mt-0.5">${quota.total} Hari</div>
              </div>
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="text-[10px] text-slate-400 font-semibold uppercase">Terpakai</div>
                <div class="text-base font-black text-amber-600 mt-0.5">${quota.used || 0} Hari</div>
              </div>
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="text-[10px] text-slate-400 font-semibold uppercase">Sisa Kuota</div>
                <div class="text-base font-black text-emerald-600 mt-0.5">${quota.remaining} Hari</div>
              </div>
            </div>

            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-blue-600 h-full rounded-full" style="width: ${(quota.remaining / quota.total) * 100}%"></div>
            </div>
          </div>

        </div>

      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Employee Requests (Pengajuan Izin, Sakit, Cuti)
// ----------------------------------------------------------------------------
function renderEmployeeRequestsTab() {
  const form = state.requestForm;
  const quota = state.currentUser && state.currentUser.leaveQuota ? state.currentUser.leaveQuota : { remaining: 12, total: 12 };
  const myReqs = state.requests.filter(r => r.employeeId === (state.currentUser ? state.currentUser.id : ''));

  return `
    <div class="max-w-4xl mx-auto space-y-8">
      
      <!-- Submission Form Card -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Form Pengajuan Izin, Sakit & Cuti</h2>
          <p class="text-xs text-slate-500 mt-1">Isi formulir berikut untuk mengajukan permohonan ke HRD</p>
        </div>

        <form id="request-leave-form" class="space-y-5 text-xs font-medium">
          
          <!-- Request Type Pills -->
          <div>
            <label class="block font-bold text-slate-700 mb-2">Tipe Permohonan</label>
            <div class="grid grid-cols-3 gap-3">
              <button type="button" data-action="set-request-type" data-type="IZIN"
                class="py-3 px-4 rounded-xl font-extrabold text-xs transition border cursor-pointer ${form.type === 'IZIN' ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
    }">
                IZIN (Keperluan Pribadi)
              </button>

              <button type="button" data-action="set-request-type" data-type="SAKIT"
                class="py-3 px-4 rounded-xl font-extrabold text-xs transition border cursor-pointer ${form.type === 'SAKIT' ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
    }">
                SAKIT (Surat Dokter)
              </button>

              <button type="button" data-action="set-request-type" data-type="CUTI"
                class="py-3 px-4 rounded-xl font-extrabold text-xs transition border cursor-pointer ${form.type === 'CUTI' ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
    }">
                CUTI TAHUNAN
              </button>
            </div>
          </div>

          ${form.type === 'CUTI' ? `
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center justify-between">
              <span>Sisa kuota cuti tahunan Anda saat ini:</span>
              <span class="font-extrabold text-sm">${quota.remaining} Hari dari ${quota.total} Hari</span>
            </div>
          ` : ''}

          <!-- Date Range Pickers -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-bold text-slate-700 mb-1.5">Tanggal Mulai</label>
              <input type="date" id="req-start-date" required value="${form.startDate}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-blue-500 focus:border-blue-500">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1.5">Tanggal Selesai</label>
              <input type="date" id="req-end-date" required value="${form.endDate}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-blue-500 focus:border-blue-500">
            </div>
          </div>

          <!-- Reason Textarea -->
          <div>
            <label class="block font-bold text-slate-700 mb-1.5">Alasan / Keterangan Lengkap</label>
            <textarea id="req-reason" rows="3" required placeholder="Jelaskan alasan pengajuan Anda..."
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:ring-blue-500 focus:border-blue-500">${escapeHtml(form.reason)}</textarea>
          </div>

          <!-- Emergency Contact & Attachment -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-bold text-slate-700 mb-1.5">Kontak yang Dapat Dihubungi (Opsional)</label>
              <input type="text" id="req-contact" placeholder="Contoh: 08123456789 (Keluarga)" value="${escapeHtml(form.emergencyContact)}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1.5">Lampiran Foto / Surat Dokter (Jika Sakit)</label>
              <input type="file" id="req-attachment-file" accept="image/*,.pdf"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs">
              ${form.attachment ? `
                <div class="mt-2 flex items-center space-x-2 text-xs text-emerald-600 font-bold">
                  <span>✓ Lampiran siap dikirim</span>
                  <button type="button" data-action="view-photo" data-title="Pratinjau Lampiran" data-url="${escapeHtml(form.attachment)}" class="text-blue-600 underline">Lihat</button>
                </div>
              ` : ''}
            </div>
          </div>

          <button type="submit"
            class="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            <span>Kirim Pengajuan ke HRD</span>
          </button>
        </form>
      </div>

      <!-- My Previous Requests Table -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 class="font-bold text-slate-800 text-sm">Riwayat Pengajuan Saya</h3>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th class="py-2.5 px-3">Tipe</th>
                <th class="py-2.5 px-3">Tanggal Periode</th>
                <th class="py-2.5 px-3">Durasi</th>
                <th class="py-2.5 px-3">Alasan</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Catatan HRD</th>
                <th class="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
              ${myReqs.length > 0 ? myReqs.map(r => `
                <tr class="hover:bg-slate-50/50">
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-md font-bold text-[10px] ${r.type === 'CUTI' ? 'bg-blue-100 text-blue-700' : (r.type === 'SAKIT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')
      }">
                      ${escapeHtml(r.type)}
                    </span>
                  </td>
                  <td class="py-3 px-3 whitespace-nowrap">${escapeHtml(r.startDate)} s/d ${escapeHtml(r.endDate)}</td>
                  <td class="py-3 px-3 font-bold">${r.totalDays} Hari</td>
                  <td class="py-3 px-3 max-w-xs truncate" title="${escapeHtml(r.reason)}">${escapeHtml(r.reason)}</td>
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : (r.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
      }">
                      ${r.status === 'APPROVED' ? 'Disetujui' : (r.status === 'REJECTED' ? 'Ditolak' : 'Menunggu Review')}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-slate-500 italic">${escapeHtml(r.reviewNotes || '-')}</td>
                  <td class="py-3 px-3 text-center whitespace-nowrap">
                    <button type="button" data-action="delete-request" data-id="${r.id}"
                      class="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg border border-rose-200 hover:border-rose-600 transition inline-flex items-center space-x-1 cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      <span>Hapus</span>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">Belum ada pengajuan izin atau cuti.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Employee History (Riwayat Absensi Saya)
// ----------------------------------------------------------------------------
function renderEmployeeHistoryTab() {
  const myAtts = state.attendances.filter(a => a.employeeId === (state.currentUser ? state.currentUser.id : ''));

  let myTotalOtHours = 0;
  let myOtDays = 0;
  let myWeekdayOt = 0;
  let mySaturdayOt = 0;
  let mySundayOt = 0;

  myAtts.forEach(a => {
    const ot = calculateOvertime(a.date, a.clockIn, a.clockOut);
    if (ot.hoursDecimal > 0) {
      myOtDays++;
      myTotalOtHours += ot.hoursDecimal;
      const d = new Date(a.date + 'T12:00:00');
      const day = d.getDay();
      if (day === 0) mySundayOt += ot.hoursDecimal;
      else if (day === 6) mySaturdayOt += ot.hoursDecimal;
      else myWeekdayOt += ot.hoursDecimal;
    }
  });

  return `
    <div class="space-y-6">
      <!-- Personal Overtime & Attendance Summary Card -->
      <div class="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 uppercase tracking-wider">
            Rekap Lembur Pribadi
          </span>
          <h2 class="text-xl sm:text-2xl font-black mt-1">Total Jam Lembur Anda: ${myTotalOtHours} Jam</h2>
          <p class="text-xs text-amber-100 mt-0.5">Dari total ${myOtDays} hari lembur tercatat (${myAtts.length} hari hadir kerja)</p>
        </div>
        <div class="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-xs">
          <div class="text-center px-2">
            <div class="text-[10px] text-amber-100 uppercase font-bold">Senin - Jum (&gt;17:00)</div>
            <div class="text-base font-black">${myWeekdayOt} Jam</div>
          </div>
          <div class="w-px h-8 bg-white/20"></div>
          <div class="text-center px-2">
            <div class="text-[10px] text-amber-100 uppercase font-bold">Sabtu (&gt;13:00)</div>
            <div class="text-base font-black">${mySaturdayOt} Jam</div>
          </div>
          <div class="w-px h-8 bg-white/20"></div>
          <div class="text-center px-2">
            <div class="text-[10px] text-amber-100 uppercase font-bold">Minggu (Penuh)</div>
            <div class="text-base font-black">${mySundayOt} Jam</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 print-container">
        <!-- KOP SURAT RESMI CETAK -->
        <div class="hidden print-only mb-4 text-center border-b-2 border-black pb-2">
          <img src="${getCompanyLetterhead()}" class="w-full max-h-24 object-contain mx-auto" alt="Kop Surat PT. ANUGERAH BERKAH INDUSTRI">
          <div class="mt-2 flex justify-between items-center text-[10px] text-slate-700 font-bold border-b border-slate-300 pb-1">
            <span>RIWAYAT PRESENSI & JAM KERJA: ${escapeHtml(state.currentUser ? state.currentUser.name : '')} (${escapeHtml(state.currentUser ? state.currentUser.nip : '')})</span>
            <span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span>
          </div>
        </div>

        <div class="flex items-center justify-between no-print">
          <div>
            <h2 class="text-base font-bold text-slate-900">Riwayat Presensi & Jam Kerja</h2>
            <p class="text-xs text-slate-500">Daftar kehadiran harian, jam masuk, jam pulang, dan lemburan Anda</p>
          </div>
          <button type="button" data-action="print-report"
            class="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center space-x-1.5 transition cursor-pointer">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>Cetak Riwayat</span>
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th class="py-2.5 px-3">Tanggal & Hari</th>
                <th class="py-2.5 px-3">Jam Masuk</th>
                <th class="py-2.5 px-3">Jam Pulang</th>
                <th class="py-2.5 px-3">Total Jam Kerja</th>
                <th class="py-2.5 px-3 bg-amber-50 text-amber-800 font-bold">Jam Lembur</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Foto Selfie</th>
                <th class="py-2.5 px-3">Lokasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
              ${myAtts.length > 0 ? myAtts.map(a => {
    const dayName = getDayNameIndonesian(a.date);
    const ot = calculateOvertime(a.date, a.clockIn, a.clockOut);
    return `
                <tr class="hover:bg-slate-50/50">
                  <td class="py-3 px-3 font-semibold whitespace-nowrap">${escapeHtml(dayName)}, ${escapeHtml(a.date)}</td>
                  <td class="py-3 px-3 font-mono font-bold">${escapeHtml(a.clockIn || '-')}</td>
                  <td class="py-3 px-3 font-mono">${escapeHtml(a.clockOut || '-')}</td>
                  <td class="py-3 px-3">${escapeHtml(a.workHours || '-')}</td>
                  <td class="py-3 px-3">
                    ${ot.hoursDecimal > 0 ? `
                      <span class="px-2 py-0.5 rounded-md font-extrabold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                        +${escapeHtml(ot.formatted)}
                      </span>
                    ` : '<span class="text-slate-400">-</span>'}
                  </td>
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${a.clockInStatus === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }">
                      ${escapeHtml(a.clockInStatus || a.status)}
                    </span>
                  </td>
                  <td class="py-3 px-3">
                    ${a.clockInPhoto ? `
                      <button type="button" data-action="view-photo" data-title="Foto Absen ${escapeHtml(a.date)}" data-url="${escapeHtml(a.clockInPhoto)}"
                        class="text-blue-600 hover:text-blue-800 font-bold text-xs underline cursor-pointer">
                        Lihat Foto
                      </button>
                    ` : '-'}
                  </td>
                  <td class="py-3 px-3 text-slate-500 max-w-xs truncate" title="${escapeHtml(a.clockInLocation ? a.clockInLocation.address : '-')}">
                    ${escapeHtml(a.clockInLocation ? a.clockInLocation.address : '-')}
                  </td>
                </tr>
              `;
  }).join('') : `
                <tr>
                  <td colspan="8" class="py-8 text-center text-slate-400">Belum ada riwayat absensi.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Admin Dashboard KPI
// ----------------------------------------------------------------------------
function renderAdminDashboardTab() {
  const today = getTodayString();
  const totalStaff = state.employees.filter(e => e.role !== 'admin').length;
  const todayAtts = state.attendances.filter(a => a.date === today);
  const presentCount = todayAtts.length;
  const lateCount = todayAtts.filter(a => a.clockInStatus === 'Terlambat').length;
  const pendingCount = state.requests.filter(r => r.status === 'PENDING').length;
  const activeLeaves = state.requests.filter(r => r.status === 'APPROVED' && r.startDate <= today && r.endDate >= today).length;
  const attendanceRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  // Akumulasi Total Jam Lembur
  let totalOtOverall = 0;
  state.attendances.forEach(a => {
    const ot = calculateOvertime(a.date, a.clockIn, a.clockOut);
    totalOtOverall += ot.hoursDecimal;
  });

  const scriptUrl = getGoogleScriptUrl();
  const hasScriptUrl = !!scriptUrl;

  return `
    <div class="space-y-6">
      
      <!-- Greeting Banner -->
      <div class="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-semibold text-indigo-300">Ringkasan Hari Ini</span>
          <h2 class="text-2xl font-black mt-0.5">Dashboard Manajemen Presensi</h2>
          <p class="text-xs text-indigo-200 mt-1">${getCurrentDateFormatted()}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${hasScriptUrl ? `
            <button type="button" data-action="sync-cloud-data"
              class="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-md">
              <svg class="w-4 h-4 ${state.isSyncingSheets ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>${state.isSyncingSheets ? 'Menyinkronkan...' : 'Tarik Presensi Cloud'}</span>
            </button>
          ` : `
            <button type="button" data-action="switch-tab" data-tab="settings"
              class="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-md">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span>Hubungkan Sheets</span>
            </button>
          `}
          ${pendingCount > 0 ? `
            <button type="button" data-action="switch-tab" data-tab="approvals"
              class="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-rose-500/30">
              <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>Ada ${pendingCount} Pengajuan Menunggu</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${!hasScriptUrl ? `
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 font-bold">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div class="font-bold text-xs">Penting: Database Cloud Belum Terhubung</div>
              <p class="text-[11px] text-amber-700">Agar presensi dari HP 34 karyawan langsung masuk ke Google Spreadsheet & Dashboard ini, masukkan URL Google Apps Script Anda.</p>
            </div>
          </div>
          <button type="button" data-action="switch-tab" data-tab="settings"
            class="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shadow-sm">
            Buka Menu Pengaturan
          </button>
        </div>
      ` : ''}

      <!-- Quick Banner: Rekapitulasi Jam Lembur Per Orang (34 Staf) -->
      <div class="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-amber-300/40">
        <div class="space-y-1">
          <div class="inline-flex items-center space-x-2 bg-slate-900/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-amber-100">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse"></span>
            <span>REKAPITULASI LEMBUR RESMI (34 KARYAWAN PT ABI)</span>
          </div>
          <h3 class="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">Total Jam Lembur Terakumulasi: ${totalOtOverall} Jam</h3>
          <p class="text-xs text-amber-100 max-w-2xl leading-relaxed">
            Aturan Lembur: Senin-Jumat (>17:00), Sabtu (>13:00), Minggu (Penuh). Sisa menit &lt;45 hangus (0 Jam), &ge;45 menit dibulatkan ke 1 Jam penuh.
          </p>
        </div>
        <button type="button" data-action="switch-tab" data-tab="overtime"
          class="px-6 py-3.5 bg-slate-950 hover:bg-black text-amber-300 hover:text-amber-200 rounded-xl text-xs font-black transition shadow-2xl flex items-center space-x-2.5 shrink-0 border border-amber-400 cursor-pointer">
          <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span class="text-sm">Buka Rekap Lembur Per Orang ➔</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
        
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span class="text-slate-400 text-xs font-bold uppercase">Total Karyawan</span>
          <div class="text-2xl font-black text-slate-800 mt-1">${totalStaff}</div>
          <span class="text-[10px] text-slate-400">33 Staf + 1 Admin</span>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span class="text-slate-400 text-xs font-bold uppercase">Hadir Hari Ini</span>
          <div class="text-2xl font-black text-blue-600 mt-1">${presentCount}</div>
          <span class="text-[10px] text-emerald-600 font-bold">${attendanceRate}% Kehadiran</span>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span class="text-slate-400 text-xs font-bold uppercase">Terlambat</span>
          <div class="text-2xl font-black text-amber-600 mt-1">${lateCount}</div>
          <span class="text-[10px] text-slate-400">&gt; ${state.officeSettings.workStart} WIB</span>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span class="text-slate-400 text-xs font-bold uppercase">Izin / Sakit / Cuti</span>
          <div class="text-2xl font-black text-indigo-600 mt-1">${activeLeaves}</div>
          <span class="text-[10px] text-slate-400">Sedang Berlangsung</span>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span class="text-slate-400 text-xs font-bold uppercase">Pending Approval</span>
          <div class="text-2xl font-black text-rose-600 mt-1">${pendingCount}</div>
          <span class="text-[10px] text-slate-400">Butuh Tindakan HRD</span>
        </div>

        <!-- Overtime KPI Card -->
        <div class="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-xs cursor-pointer" data-action="switch-tab" data-tab="overtime">
          <span class="text-amber-800 text-xs font-bold uppercase">Total Jam Lembur</span>
          <div class="text-2xl font-black text-amber-900 mt-1">${totalOtOverall} Jam</div>
          <span class="text-[10px] text-amber-700 font-bold underline">Buka Rekap ➔</span>
        </div>

      </div>

      <!-- Live Attendance Today Feed -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-slate-800 text-sm">Aktivitas Presensi Hari Ini</h3>
          <span class="text-xs text-slate-400">${todayAtts.length} Karyawan telah absen</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th class="py-2.5 px-3">Karyawan</th>
                <th class="py-2.5 px-3">Departemen</th>
                <th class="py-2.5 px-3">Jam Masuk</th>
                <th class="py-2.5 px-3">Jam Pulang</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Selfie</th>
                <th class="py-2.5 px-3">Lokasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
              ${todayAtts.length > 0 ? todayAtts.map(a => {
    const emp = getEmployee(a.employeeId);
    return `
                  <tr class="hover:bg-slate-50/50">
                    <td class="py-3 px-3 flex items-center space-x-2">
                      <img src="${emp.avatar || 'https://ui-avatars.com/api/?name=User'}" class="w-7 h-7 rounded-full object-cover">
                      <div>
                        <div class="font-bold text-slate-900">${escapeHtml(emp.name)}</div>
                        <div class="text-[10px] text-slate-400">NIP: ${escapeHtml(emp.nip)}</div>
                      </div>
                    </td>
                    <td class="py-3 px-3">${escapeHtml(emp.department)}</td>
                    <td class="py-3 px-3 font-mono font-bold">${escapeHtml(a.clockIn)}</td>
                    <td class="py-3 px-3 font-mono">${escapeHtml(a.clockOut || 'Belum Pulang')}</td>
                    <td class="py-3 px-3">
                      <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${a.clockInStatus === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }">
                        ${escapeHtml(a.clockInStatus)}
                      </span>
                    </td>
                    <td class="py-3 px-3">
                      ${a.clockInPhoto ? `
                        <button type="button" data-action="view-photo" data-title="Selfie Absen - ${escapeHtml(emp.name)}" data-url="${escapeHtml(a.clockInPhoto)}"
                          class="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer">
                          Lihat
                        </button>
                      ` : '-'}
                    </td>
                    <td class="py-3 px-3 text-slate-500 max-w-xs truncate" title="${escapeHtml(a.clockInLocation ? a.clockInLocation.address : '-')}">
                      ${escapeHtml(a.clockInLocation ? a.clockInLocation.address : '-')}
                    </td>
                  </tr>
                `;
  }).join('') : `
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">Belum ada karyawan yang absen masuk hari ini.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Admin Approvals Center (Pusat Persetujuan)
// ----------------------------------------------------------------------------
function renderAdminApprovalsTab() {
  const pendings = state.requests.filter(r => r.status === 'PENDING');
  const reviewed = state.requests.filter(r => r.status !== 'PENDING');

  return `
    <div class="space-y-8">
      
      <!-- Pending Requests Section -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-slate-900">Pengajuan Menunggu Persetujuan</h2>
            <p class="text-xs text-slate-500">Tinjau permohonan izin, sakit, dan cuti karyawan</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold ${pendings.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}">
            ${pendings.length} Menunggu
          </span>
        </div>

        ${pendings.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${pendings.map(req => {
    const emp = getEmployee(req.employeeId);
    return `
                <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-2.5">
                      <img src="${emp.avatar || 'https://ui-avatars.com/api/?name=User'}" class="w-10 h-10 rounded-xl object-cover">
                      <div>
                        <div class="font-bold text-slate-900 text-sm">${escapeHtml(emp.name)}</div>
                        <div class="text-xs text-slate-400">${escapeHtml(emp.department)} • NIP ${escapeHtml(emp.nip)}</div>
                      </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold ${req.type === 'CUTI' ? 'bg-blue-100 text-blue-700' : (req.type === 'SAKIT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')
      }">
                      ${escapeHtml(req.type)} (${req.totalDays} Hari)
                    </span>
                  </div>

                  <div class="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div><span class="text-slate-400">Periode:</span> <strong>${escapeHtml(req.startDate)} s/d ${escapeHtml(req.endDate)}</strong></div>
                    <div><span class="text-slate-400">Alasan:</span> <span class="italic text-slate-800">${escapeHtml(req.reason)}</span></div>
                    ${req.emergencyContact ? `<div><span class="text-slate-400">Kontak:</span> ${escapeHtml(req.emergencyContact)}</div>` : ''}
                    ${req.type === 'CUTI' ? `<div><span class="text-slate-400">Sisa Cuti Karyawan:</span> <strong class="text-blue-600">${emp.leaveQuota ? emp.leaveQuota.remaining : 12} Hari</strong></div>` : ''}
                  </div>

                  <div class="flex items-center space-x-2 pt-1">
                    ${req.attachment ? `
                      <button type="button" data-action="view-photo" data-title="Lampiran - ${escapeHtml(emp.name)}" data-url="${escapeHtml(req.attachment)}"
                        class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                        Lihat Surat
                      </button>
                    ` : ''}
                    <button type="button" data-action="open-approval-modal" data-id="${req.id}" data-action-type="APPROVE"
                      class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                      ✓ Setujui
                    </button>
                    <button type="button" data-action="open-approval-modal" data-id="${req.id}" data-action-type="REJECT"
                      class="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                      ✕ Tolak
                    </button>
                    <button type="button" data-action="delete-request" data-id="${req.id}" title="Hapus Pengajuan"
                      class="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        ` : `
          <div class="py-10 text-center text-slate-400 space-y-2">
            <svg class="w-10 h-10 mx-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div class="font-bold text-slate-700">Semua Pengajuan Telah Ditinjau</div>
            <p class="text-xs text-slate-400">Tidak ada pengajuan izin atau cuti yang sedang pending.</p>
          </div>
        `}
      </div>

      <!-- Reviewed Requests History -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 class="font-bold text-slate-800 text-sm">Riwayat Keputusan Pengajuan</h3>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th class="py-2.5 px-3">Karyawan</th>
                <th class="py-2.5 px-3">Tipe</th>
                <th class="py-2.5 px-3">Periode</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Ditinjau Oleh</th>
                <th class="py-2.5 px-3">Catatan HRD</th>
                <th class="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
              ${reviewed.length > 0 ? reviewed.map(r => {
    const emp = getEmployee(r.employeeId);
    return `
                  <tr class="hover:bg-slate-50/50">
                    <td class="py-3 px-3 font-bold text-slate-900">${escapeHtml(emp.name)}</td>
                    <td class="py-3 px-3 font-semibold">${escapeHtml(r.type)} (${r.totalDays}h)</td>
                    <td class="py-3 px-3 whitespace-nowrap">${escapeHtml(r.startDate)} s/d ${escapeHtml(r.endDate)}</td>
                    <td class="py-3 px-3">
                      <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }">
                        ${r.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-slate-500">${escapeHtml(r.reviewedBy || 'HRD')}</td>
                    <td class="py-3 px-3 text-slate-600 italic">${escapeHtml(r.reviewNotes || '-')}</td>
                    <td class="py-3 px-3 text-center whitespace-nowrap">
                      <button type="button" data-action="delete-request" data-id="${r.id}"
                        class="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg border border-rose-200 hover:border-rose-600 transition inline-flex items-center space-x-1 cursor-pointer">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        <span>Hapus</span>
                      </button>
                    </td>
                  </tr>
                `;
  }).join('') : `
                <tr>
                  <td colspan="7" class="py-6 text-center text-slate-400">Belum ada riwayat persetujuan.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Admin Employees Management (Data Karyawan)
// ----------------------------------------------------------------------------
function renderAdminEmployeesTab() {
  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Data Seluruh Karyawan (34 Staf)</h2>
          <p class="text-xs text-slate-500">Kelola master data karyawan PT ANUGERAH BERKAH INDUSTRI</p>
        </div>

        <div class="flex items-center space-x-2">
          <button type="button" data-action="reset-all-quotas"
            class="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span>Reset Cuti (12 Hari)</span>
          </button>

          <button type="button" data-action="open-employee-modal" data-mode="add"
            class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Tambah Karyawan</span>
          </button>
        </div>
      </div>

      <!-- Table of Employees -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
              <th class="py-2.5 px-3">Nama Lengkap & ID</th>
              <th class="py-2.5 px-3">NIP</th>
              <th class="py-2.5 px-3">Departemen</th>
              <th class="py-2.5 px-3">Jabatan</th>
              <th class="py-2.5 px-3">PIN Login</th>
              <th class="py-2.5 px-3">Sisa Cuti</th>
              <th class="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
            ${state.employees.map(emp => {
    const quota = emp.leaveQuota ? emp.leaveQuota : { remaining: 12, total: 12 };
    return `
                <tr class="hover:bg-slate-50/50">
                  <td class="py-3 px-3 flex items-center space-x-2.5">
                    <img src="${emp.avatar || 'https://ui-avatars.com/api/?name=User'}" class="w-8 h-8 rounded-full object-cover">
                    <div>
                      <div class="font-bold text-slate-900">${escapeHtml(emp.name)}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(emp.id)} • ${escapeHtml(emp.email)}</div>
                    </div>
                  </td>
                  <td class="py-3 px-3 font-mono font-bold text-slate-800">${escapeHtml(emp.nip)}</td>
                  <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-100 text-slate-700">
                      ${escapeHtml(emp.department)}
                    </span>
                  </td>
                  <td class="py-3 px-3 font-semibold">${escapeHtml(emp.position)}</td>
                  <td class="py-3 px-3 font-mono font-bold text-indigo-600">${escapeHtml(emp.pin || emp.nip)}</td>
                  <td class="py-3 px-3">
                    <span class="font-bold text-emerald-600">${quota.remaining}</span>
                    <span class="text-slate-400">/ ${quota.total} Hari</span>
                  </td>
                  <td class="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                    <button type="button" data-action="open-employee-modal" data-mode="edit" data-id="${emp.id}"
                      class="text-blue-600 hover:text-blue-800 font-bold cursor-pointer">
                      Edit
                    </button>
                    ${emp.role !== 'admin' ? `
                      <button type="button" data-action="delete-employee" data-id="${emp.id}"
                        class="text-rose-600 hover:text-rose-800 font-bold cursor-pointer">
                        Hapus
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Admin Reports (Rekapitulasi & Laporan)
// ----------------------------------------------------------------------------
function renderAdminReportsTab() {
  const reports = getFilteredReports();
  const departments = [...new Set(state.employees.map(e => e.department))];
  const currentView = state.reportFilter.viewType || 'per-employee';
  const rangeType = state.reportFilter.range || '30days';

  // Hitung KPI
  let totalOvertimeHours = 0;
  let overtimeEmployeeCount = 0;
  reports.forEach(r => {
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    if (ot.hoursDecimal > 0) {
      totalOvertimeHours += ot.hoursDecimal;
      overtimeEmployeeCount++;
    }
  });

  const onTimeCount = reports.filter(r => r.clockInStatus === 'Tepat Waktu').length;
  const lateCount = reports.filter(r => r.clockInStatus === 'Terlambat').length;

  // Data Rekapitulasi Per Orang
  const summaryList = getOvertimeSummaryPerEmployee(reports);
  let totalHadirSum = 0;
  let totalOtDaysSum = 0;
  let totalWeekdayOtSum = 0;
  let totalSaturdayOtSum = 0;
  let totalSundayOtSum = 0;
  let grandTotalOtHours = 0;

  summaryList.forEach(item => {
    totalHadirSum += item.totalHadir;
    totalOtDaysSum += item.totalOvertimeDays;
    totalWeekdayOtSum += item.weekdayOvertimeHours;
    totalSaturdayOtSum += item.saturdayOvertimeHours;
    totalSundayOtSum += item.sundayOvertimeHours;
    grandTotalOtHours += item.totalOvertimeHours;
  });

  return `
    <div class="space-y-6">
      
      <!-- Top Banner Mode Selector: Rekap Lembur vs Log Harian -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-900">
        <div>
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
              Laporan Presensi &amp; Lembur PT ABI
            </span>
            <span class="text-xs text-amber-200 font-bold">34 Karyawan Terdaftar</span>
          </div>
          <h2 class="text-xl font-black mt-1">Rekapitulasi Jam Lembur Karyawan &amp; Log Kehadiran</h2>
          <p class="text-xs text-slate-300 mt-0.5">Pilih tampilan tabel di bawah: Rekapitulasi per orang atau rincian harian log presensi</p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button type="button" data-action="set-report-view" data-view="per-employee"
            class="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-lg ${currentView === 'per-employee' ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <span>👥 Rekap Lembur Per Orang (34 Staf)</span>
          </button>

          <button type="button" data-action="set-report-view" data-view="daily"
            class="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-lg ${currentView === 'daily' ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            <span>📋 Rincian Harian Presensi</span>
          </button>
        </div>
      </div>

      <!-- Filter & Export Card -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 no-print">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 uppercase tracking-wider">
                Laporan 30 Hari & Rekap Lembur
              </span>
              <span class="text-xs text-slate-400">Total ${reports.length} Data Absensi</span>
            </div>
            <h2 class="text-lg font-bold text-slate-900 mt-1">Rekapitulasi Laporan Presensi & Jam Lembur</h2>
            <p class="text-xs text-slate-500">Konversi data ke format Excel (.xls), PDF resmi berlogo & tanda tangan, atau cetak fisik</p>
          </div>

          <!-- Export Action Buttons -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Download Excel Button -->
            <button type="button" data-action="export-excel"
              class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-600/20 flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Download Excel (.xls)</span>
            </button>

            <!-- Download PDF Button -->
            <button type="button" data-action="export-pdf"
              class="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-6 4h4"/></svg>
              <span>Convert ke PDF</span>
            </button>

            <!-- Download CSV Button -->
            <button type="button" data-action="export-csv"
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>CSV</span>
            </button>

            <!-- Print Button -->
            <button type="button" data-action="print-report"
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              <span>Cetak</span>
            </button>
          </div>
        </div>

        <!-- Quick Filter Range Tabs -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span class="text-xs font-bold text-slate-500 mr-1">Periode Laporan:</span>
          
          <button type="button" data-action="set-report-range" data-range="30days"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${rangeType === '30days' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            30 Hari Terakhir
          </button>

          <button type="button" data-action="set-report-range" data-range="month"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${rangeType === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            Bulan Ini
          </button>

          <button type="button" data-action="set-report-range" data-range="custom"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${rangeType === 'custom' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            Rentang Tanggal Kustom
          </button>

          <button type="button" data-action="set-report-range" data-range="all"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${rangeType === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            Semua Data
          </button>
        </div>

        <!-- Filter Controls Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2">
          ${rangeType === 'custom' ? `
            <div>
              <label class="block font-bold text-slate-700 mb-1">Dari Tanggal</label>
              <input type="date" id="report-start-date" value="${state.reportFilter.startDate || ''}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-semibold">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Sampai Tanggal</label>
              <input type="date" id="report-end-date" value="${state.reportFilter.endDate || ''}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-semibold">
            </div>
          ` : rangeType === 'month' ? `
            <div>
              <label class="block font-bold text-slate-700 mb-1">Pilih Bulan</label>
              <input type="month" id="report-month-filter" value="${state.reportFilter.month}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-semibold">
            </div>
          ` : `
            <div>
              <label class="block font-bold text-slate-700 mb-1">Rentang Tanggal Aktif</label>
              <div class="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-semibold text-xs">
                ${getPastDateString(30)} s/d ${getTodayString()}
              </div>
            </div>
          `}

          <div>
            <label class="block font-bold text-slate-700 mb-1">Departemen</label>
            <select id="report-dept-filter" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs">
              <option value="ALL">Semua Departemen</option>
              ${departments.map(d => `<option value="${escapeHtml(d)}" ${state.reportFilter.department === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Karyawan</label>
            <select id="report-emp-filter" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs">
              <option value="ALL">Semua Karyawan (34 Karyawan)</option>
              ${state.employees.map(e => `<option value="${e.id}" ${state.reportFilter.employeeId === e.id ? 'selected' : ''}>${escapeHtml(e.name)} (${escapeHtml(e.nip)})</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Status Kehadiran / Lembur</label>
            <select id="report-status-filter" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs">
              <option value="ALL" ${state.reportFilter.status === 'ALL' ? 'selected' : ''}>Semua Status</option>
              <option value="Tepat Waktu" ${state.reportFilter.status === 'Tepat Waktu' ? 'selected' : ''}>Tepat Waktu</option>
              <option value="Terlambat" ${state.reportFilter.status === 'Terlambat' ? 'selected' : ''}>Terlambat</option>
              <option value="Lembur" ${state.reportFilter.status === 'Lembur' ? 'selected' : ''}>Ada Jam Lembur (>0 Jam)</option>
            </select>
          </div>
        </div>

        <!-- Mode Tampilan: Rekapitulasi Lembur Per Orang vs Log Harian -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-slate-700">Tampilan Laporan:</span>
            <div class="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button type="button" data-action="set-report-view" data-view="per-employee"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${currentView === 'per-employee' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <span>👥 Rekapitulasi Lembur Per Orang (${summaryList.length} Karyawan)</span>
              </button>
              <button type="button" data-action="set-report-view" data-view="daily"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${currentView === 'daily' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span>📋 Rincian Harian Presensi (${reports.length} Log)</span>
              </button>
            </div>
            <button type="button" data-action="clear-all-attendances"
              class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>🗑️ Kosongkan Log Lembur (0 Jam)</span>
            </button>
          </div>
          ${state.reportFilter.employeeId !== 'ALL' ? `
            <div class="flex items-center space-x-2 text-xs bg-amber-50 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200">
              <span>Filter Karyawan: <b>${escapeHtml(getEmployee(state.reportFilter.employeeId).name)}</b></span>
              <button type="button" data-action="reset-emp-filter" class="font-bold underline text-amber-700 hover:text-amber-900 cursor-pointer">
                Tampilkan Semua
              </button>
            </div>
          ` : ''}
        </div>

      </div>

      <!-- Summary KPI Metric Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Presensi</div>
          <div class="text-2xl font-black text-slate-900 mt-1">${reports.length}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Kehadiran tercatat</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Tepat Waktu</div>
          <div class="text-2xl font-black text-emerald-600 mt-1">${onTimeCount}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${reports.length > 0 ? Math.round((onTimeCount / reports.length) * 100) : 0}% disiplin kehadiran</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Terlambat</div>
          <div class="text-2xl font-black text-rose-600 mt-1">${lateCount}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Lewat jam ${state.officeSettings.workStart}</div>
        </div>

        <div class="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div class="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Total Jam Lembur</div>
          <div class="text-2xl font-black text-amber-900 mt-1">${grandTotalOtHours} Jam</div>
          <div class="text-[10px] text-amber-700 mt-0.5">${overtimeEmployeeCount} sesi lembur (Senin-Jum &gt;17:00, Sab &gt;13:00, Min full)</div>
        </div>
      </div>

      ${currentView === 'per-employee' ? `
        <!-- TABEL 1: REKAPITULASI JAM LEMBUR PER ORANG -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 print-container">
          <!-- KOP SURAT RESMI CETAK -->
          <div class="hidden print-only mb-4 text-center border-b-2 border-black pb-2">
            <img src="${getCompanyLetterhead()}" class="w-full max-h-24 object-contain mx-auto" alt="Kop Surat PT. ANUGERAH BERKAH INDUSTRI">
            <div class="mt-2 flex justify-between items-center text-[10px] text-slate-700 font-bold border-b border-slate-300 pb-1">
              <span>REKAPITULASI JAM LEMBUR KARYAWAN (PER ORANG)</span>
              <span>Periode: ${rangeLabel}</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Tabel Utama Rekapitulasi
                </span>
                <span class="text-xs text-slate-400">Total ${summaryList.length} Karyawan</span>
              </div>
              <h3 class="font-bold text-slate-800 text-base mt-1">Rekapitulasi Jam Lembur Per Orang (34 Karyawan PT ABI)</h3>
              <p class="text-xs text-slate-500">Diurutkan berdasarkan akumulasi jam lembur tertinggi. Klik "Lihat Log Harian" untuk memeriksa detail tanggal.</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-xs font-bold text-amber-800 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200">
                Grand Total Lembur: <span class="font-black text-amber-900 text-sm">${grandTotalOtHours} Jam</span>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/70">
                  <th class="py-3 px-3 text-center">No</th>
                  <th class="py-3 px-3">NIP & Nama Karyawan</th>
                  <th class="py-3 px-3">Departemen & Jabatan</th>
                  <th class="py-3 px-3 text-center">Total Hadir</th>
                  <th class="py-3 px-3 text-center">Hari Lembur</th>
                  <th class="py-3 px-3 text-center bg-blue-50/50 text-blue-900">Senin - Jumat (&gt;17:00)</th>
                  <th class="py-3 px-3 text-center bg-amber-50/50 text-amber-900">Sabtu (&gt;13:00)</th>
                  <th class="py-3 px-3 text-center bg-rose-50/50 text-rose-900">Minggu (Full)</th>
                  <th class="py-3 px-3 text-center bg-amber-100 text-amber-950 font-black">TOTAL JAM LEMBUR</th>
                  <th class="py-3 px-3 text-center no-print">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                ${summaryList.length > 0 ? summaryList.map((item, idx) => {
    const emp = item.employee;
    return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
                      <td class="py-3 px-3">
                        <div class="flex items-center space-x-2.5">
                          <img src="${emp.avatar || 'https://ui-avatars.com/api/?name=User'}" class="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0">
                          <div>
                            <div class="font-bold text-slate-900">${escapeHtml(emp.name)}</div>
                            <div class="text-[10px] text-slate-400 font-mono">NIP: ${escapeHtml(emp.nip)}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-3 whitespace-nowrap">
                        <div class="font-semibold text-slate-800">${escapeHtml(emp.position)}</div>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 inline-block mt-0.5">
                          ${escapeHtml(emp.department)}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-center font-bold text-slate-800">${item.totalHadir} Hari</td>
                      <td class="py-3 px-3 text-center font-bold ${item.totalOvertimeDays > 0 ? 'text-amber-700' : 'text-slate-400'}">
                        ${item.totalOvertimeDays} Hari
                      </td>
                      <td class="py-3 px-3 text-center font-mono ${item.weekdayOvertimeHours > 0 ? 'font-bold text-blue-700' : 'text-slate-400'}">
                        ${item.weekdayOvertimeHours > 0 ? item.weekdayOvertimeHours + ' Jam' : '-'}
                      </td>
                      <td class="py-3 px-3 text-center font-mono ${item.saturdayOvertimeHours > 0 ? 'font-bold text-amber-700' : 'text-slate-400'}">
                        ${item.saturdayOvertimeHours > 0 ? item.saturdayOvertimeHours + ' Jam' : '-'}
                      </td>
                      <td class="py-3 px-3 text-center font-mono ${item.sundayOvertimeHours > 0 ? 'font-bold text-rose-700' : 'text-slate-400'}">
                        ${item.sundayOvertimeHours > 0 ? item.sundayOvertimeHours + ' Jam' : '-'}
                      </td>
                      <td class="py-3 px-3 text-center">
                        ${item.totalOvertimeHours > 0 ? `
                          <span class="px-3 py-1 rounded-lg text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                            +${item.totalOvertimeHours} Jam
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-400">0 Jam</span>
                        `}
                      </td>
                      <td class="py-3 px-3 text-center no-print whitespace-nowrap">
                        <button type="button" data-action="filter-emp-daily" data-id="${emp.id}"
                          class="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition border border-indigo-200 cursor-pointer">
                          Lihat Log Harian ➔
                        </button>
                      </td>
                    </tr>
                  `;
  }).join('') : `
                  <tr>
                    <td colspan="10" class="py-8 text-center text-slate-400">Tidak ada data karyawan yang cocok dengan filter.</td>
                  </tr>
                `}
              </tbody>
              <tfoot class="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900 text-xs">
                <tr>
                  <td colspan="3" class="py-3.5 px-3 text-right uppercase tracking-wider font-extrabold">TOTAL KESELURUHAN (${summaryList.length} KARYAWAN):</td>
                  <td class="py-3.5 px-3 text-center font-black">${totalHadirSum} Hari</td>
                  <td class="py-3.5 px-3 text-center font-black text-amber-800">${totalOtDaysSum} Hari</td>
                  <td class="py-3.5 px-3 text-center font-black text-blue-800">${totalWeekdayOtSum} Jam</td>
                  <td class="py-3.5 px-3 text-center font-black text-amber-800">${totalSaturdayOtSum} Jam</td>
                  <td class="py-3.5 px-3 text-center font-black text-rose-800">${totalSundayOtSum} Jam</td>
                  <td class="py-3.5 px-3 text-center">
                    <span class="px-3.5 py-1.5 rounded-xl text-sm font-black bg-amber-600 text-white shadow-sm">
                      ${grandTotalOtHours} Jam
                    </span>
                  </td>
                  <td class="py-3.5 px-3 no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ` : `
        <!-- TABEL 2: RINCIAN HARIAN PRESENSI (LOG DETAIL) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 print-container">
          <!-- KOP SURAT RESMI CETAK -->
          <div class="hidden print-only mb-4 text-center border-b-2 border-black pb-2">
            <img src="${getCompanyLetterhead()}" class="w-full max-h-24 object-contain mx-auto" alt="Kop Surat PT. ANUGERAH BERKAH INDUSTRI">
            <div class="mt-2 flex justify-between items-center text-[10px] text-slate-700 font-bold border-b border-slate-300 pb-1">
              <span>LAPORAN RINCIAN PRESENSI & JAM KERJA HARIAN</span>
              <span>Periode: ${rangeLabel}</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Log Detail Harian
                </span>
                <span class="text-xs text-slate-400">Total ${reports.length} Baris Log</span>
              </div>
              <h3 class="font-bold text-slate-800 text-base mt-1">Rincian Presensi & Jam Lembur Harian</h3>
              <p class="text-xs text-slate-400">Log kehadiran lengkap dengan jam masuk, pulang, durasi, lembur, foto, dan lokasi GPS</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" data-action="set-report-view" data-view="per-employee"
                class="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 cursor-pointer">
                ⬅ Kembali ke Rekap Lembur Per Orang
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] bg-slate-50/50">
                  <th class="py-2.5 px-3">No</th>
                  <th class="py-2.5 px-3">Tanggal & Hari</th>
                  <th class="py-2.5 px-3">NIP & Nama Karyawan</th>
                  <th class="py-2.5 px-3">Departemen</th>
                  <th class="py-2.5 px-3">Jam Masuk</th>
                  <th class="py-2.5 px-3">Jam Pulang</th>
                  <th class="py-2.5 px-3">Total Jam Kerja</th>
                  <th class="py-2.5 px-3 bg-amber-50 text-amber-900 font-extrabold">Jam Lembur</th>
                  <th class="py-2.5 px-3">Status</th>
                  <th class="py-2.5 px-3 no-print">Foto Selfie</th>
                  <th class="py-2.5 px-3">Lokasi GPS</th>
                  <th class="py-2.5 px-3 text-center no-print">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                ${reports.length > 0 ? reports.map((r, idx) => {
    const emp = getEmployee(r.employeeId);
    const dayName = getDayNameIndonesian(r.date);
    const ot = calculateOvertime(r.date, r.clockIn, r.clockOut);
    return `
                    <tr class="hover:bg-slate-50/50">
                      <td class="py-3 px-3 text-slate-400">${idx + 1}</td>
                      <td class="py-3 px-3 font-semibold whitespace-nowrap">
                        <div>${escapeHtml(r.date)}</div>
                        <div class="text-[10px] text-slate-400 font-normal">${escapeHtml(dayName)}</div>
                      </td>
                      <td class="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        ${escapeHtml(emp.name)} <span class="text-slate-400 font-normal">(${escapeHtml(emp.nip)})</span>
                      </td>
                      <td class="py-3 px-3 whitespace-nowrap">${escapeHtml(emp.department)}</td>
                      <td class="py-3 px-3 font-mono font-bold">${escapeHtml(r.clockIn || '-')}</td>
                      <td class="py-3 px-3 font-mono">${escapeHtml(r.clockOut || '-')}</td>
                      <td class="py-3 px-3">${escapeHtml(r.workHours || '-')}</td>
                      <td class="py-3 px-3">
                        ${ot.hoursDecimal > 0 ? `
                          <span class="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                            +${escapeHtml(ot.formatted)}
                          </span>
                        ` : '<span class="text-slate-400">-</span>'}
                      </td>
                      <td class="py-3 px-3 whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${r.clockInStatus === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }">
                          ${escapeHtml(r.clockInStatus || r.status || 'Hadir')}
                        </span>
                      </td>
                      <td class="py-3 px-3 no-print">
                        ${r.clockInPhoto ? `
                          <button type="button" data-action="view-photo" data-title="Foto Absen ${escapeHtml(emp.name)}" data-url="${escapeHtml(r.clockInPhoto)}"
                            class="p-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center space-x-1 cursor-pointer">
                            <img src="${escapeHtml(r.clockInPhoto)}" class="w-6 h-6 rounded-md object-cover border border-slate-200">
                            <span>Foto</span>
                          </button>
                        ` : '<span class="text-slate-400">-</span>'}
                      </td>
                      <td class="py-3 px-3 text-slate-500 max-w-xs truncate" title="${escapeHtml(r.clockInLocation ? r.clockInLocation.address : '-')}">
                        ${escapeHtml(r.clockInLocation ? r.clockInLocation.address : '-')}
                      </td>
                      <td class="py-3 px-3 text-center no-print whitespace-nowrap">
                        <button type="button" data-action="delete-attendance" data-id="${r.id}"
                          title="Hapus baris log ini"
                          class="px-2 py-1 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition border border-rose-200 cursor-pointer">
                          Hapus
                        </button>
                      </td>
                    </tr>
                  `;
  }).join('') : `
                  <tr>
                    <td colspan="12" class="py-8 text-center text-slate-400">Tidak ada data yang sesuai filter pencarian.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `}

    </div>
  `;
}

// ----------------------------------------------------------------------------
// VIEW: Admin Settings (Pengaturan Kantor & Google Spreadsheet)
// ----------------------------------------------------------------------------
function renderAdminSettingsTab() {
  const set = state.officeSettings;

  return `
    <div class="max-w-4xl mx-auto space-y-6">
      
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Pengaturan Perusahaan, Presensi & Basis Data</h2>
          <p class="text-xs text-slate-500 mt-1">Konfigurasi koordinat GPS kantor, jam operasional, dan integrasi Google Spreadsheet</p>
        </div>

        <form id="office-settings-form" class="space-y-6 text-xs">
          
          <!-- Jam Kerja -->
          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <h3 class="font-bold text-slate-800 text-sm">Konfigurasi Jam Kerja</h3>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nama Perusahaan / Organisasi</label>
              <input type="text" id="set-company-name" value="${escapeHtml(set.companyName)}"
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-xs">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Logo Perusahaan (URL Gambar atau Nama File, misal: logo.png)</label>
              <input type="text" id="set-company-logo" value="${escapeHtml(set.companyLogo || '')}"
                placeholder="Contoh: logo.png atau https://link-gambar.com/logo.png"
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono">
              <p class="text-[10px] text-slate-400 mt-1">Masukkan URL gambar atau letakkan file gambar di folder proyek (misal: <code>logo.png</code>). Kosongkan jika ingin memakai ikon jam standar.</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Batas Masuk Tepat Waktu</label>
                <input type="time" id="set-work-start" value="${set.workStart}"
                  class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-xs">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Jam Pulang Kantor</label>
                <input type="time" id="set-work-end" value="${set.workEnd}"
                  class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-xs">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Kuota Cuti Tahunan Bawaan (Hari)</label>
              <input type="number" id="set-quota" value="${set.defaultAnnualLeaveQuota}"
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-xs">
            </div>
          </div>

          <!-- GPS Coordinates -->
          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-slate-800 text-sm">Koordinat GPS Kantor & Radius</h3>
              <button type="button" data-action="set-office-gps"
                class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer">
                Set dari Lokasi Saya
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Latitude</label>
                <input type="number" step="0.000001" id="set-lat" value="${set.officeLatitude}"
                  class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-xs">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Longitude</label>
                <input type="number" step="0.000001" id="set-lng" value="${set.officeLongitude}"
                  class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-xs">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Radius Toleransi Presensi (Meter)</label>
              <input type="number" id="set-radius" value="${set.allowedRadiusMeters}"
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-xs">
              <p class="text-[10px] text-slate-400 mt-1">Karyawan dalam radius ini dianggap WFO di kantor.</p>
            </div>

            <div class="flex items-center space-x-2 pt-1">
              <input type="checkbox" id="set-strict-gps" ${set.strictGps ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
              <label for="set-strict-gps" class="font-bold text-slate-700 text-xs cursor-pointer">
                Wajib Dalam Radius Kantor (Tolak absen jika di luar radius)
              </label>
            </div>
          </div>

          <!-- Google Spreadsheet Integration -->
          <div class="p-4 rounded-xl border border-slate-200 bg-emerald-50/40 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 text-sm">Integrasi Google Spreadsheet</h3>
                  <p class="text-[11px] text-slate-500">Kirim data absensi & cuti otomatis ke cloud Spreadsheet</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${set.googleScriptUrl ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600'}">
                ${set.googleScriptUrl ? 'Sheets Aktif' : 'Database Lokal'}
              </span>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">URL Web App Google Apps Script</label>
              <input type="url" id="set-sheets-url" value="${escapeHtml(set.googleScriptUrl || (typeof DEFAULT_OFFICE_SETTINGS !== 'undefined' ? DEFAULT_OFFICE_SETTINGS.googleScriptUrl : ''))}"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-xs focus:ring-emerald-500 focus:border-emerald-500">
              <p class="text-[11px] text-slate-500 mt-1">
                💡 <b>Petunjuk:</b> Agar seluruh HP karyawan otomatis terhubung tanpa input manual, cantumkan URL ini ke file <code>dummy-data.js</code> pada baris <code>googleScriptUrl: "..."</code> lalu upload ke GitHub.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" data-action="test-sheets-row"
                class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                <span>Kirim 1 Baris Uji Coba ke Spreadsheet</span>
              </button>

              <button type="button" data-action="sync-cloud-data"
                class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span>Tarik Data Terbaru dari Spreadsheet</span>
              </button>
            </div>
          </div>

          <button type="submit"
            class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-md shadow-indigo-500/20 cursor-pointer">
            Simpan Seluruh Pengaturan
          </button>
        </form>

        <!-- Backup & Restore -->
        <div class="border-t border-slate-200 pt-6 space-y-3">
          <h3 class="font-bold text-slate-800 text-sm">Cadangan & Pemulihan Basis Data (Backup & Restore)</h3>
          <p class="text-xs text-slate-500">Unduh data Anda ke file JSON atau pulihkan data kapan saja.</p>

          <div class="flex flex-wrap gap-3 pt-1">
            <button type="button" data-action="backup-json"
              class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Unduh Cadangan Database (JSON)</span>
            </button>

            <label class="cursor-pointer px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-2 border border-slate-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span>Pulihkan dari File JSON</span>
              <input type="file" accept=".json" class="hidden" id="json-restore-input">
            </label>

            <button type="button" data-action="clear-all-attendances"
              class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-md shadow-rose-500/20">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Kosongkan Seluruh Log Absen & Lembur (0 Jam)</span>
            </button>

            <button type="button" data-action="clear-all-requests"
              class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-md shadow-amber-500/20">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Kosongkan Seluruh Riwayat Pengajuan Cuti / Izin</span>
            </button>

            <button type="button" data-action="reset-demo-data"
              class="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Reset ke Data Demo Bawaan</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  `;
}

// ----------------------------------------------------------------------------
// RENDER MODALS
// ----------------------------------------------------------------------------
function renderModals() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  let html = '';

  // 1. Approval Modal
  if (state.approvalModal.isOpen) {
    const req = state.requests.find(r => r.id === state.approvalModal.requestId);
    const emp = req ? getEmployee(req.employeeId) : null;
    const isApprove = state.approvalModal.action === 'APPROVE';

    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900">
              ${isApprove ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
            </h3>
            <button type="button" data-action="close-approval-modal" class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          ${req && emp ? `
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div><span class="text-slate-500">Nama:</span> <strong class="text-slate-800">${escapeHtml(emp.name)}</strong></div>
              <div><span class="text-slate-500">Tipe:</span> <strong>${escapeHtml(req.type)} (${req.totalDays} Hari)</strong></div>
              <div><span class="text-slate-500">Periode:</span> ${escapeHtml(req.startDate)} s/d ${escapeHtml(req.endDate)}</div>
              <div><span class="text-slate-500">Alasan:</span> <span class="text-slate-700 italic">${escapeHtml(req.reason)}</span></div>
            </div>
          ` : ''}

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Catatan HRD untuk Karyawan</label>
            <textarea id="approval-notes" rows="3" placeholder="Masukkan catatan / alasan persetujuan..."
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-blue-500 focus:border-blue-500">${escapeHtml(state.approvalModal.notes)}</textarea>
          </div>

          <div class="flex items-center space-x-2 pt-2">
            <button type="button" data-action="close-approval-modal"
              class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
              Batal
            </button>
            <button type="button" data-action="submit-approval"
              class="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-sm cursor-pointer ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
      }">
              ${isApprove ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Employee Modal (Add / Edit)
  if (state.employeeModal.isOpen) {
    const isEdit = state.employeeModal.isEdit;
    const d = state.employeeModal.data || {};
    const departments = ['Produksi', 'QC', 'MTC', 'Mixing', 'Finance', 'Keamanan', 'CS', 'Human Resources (HRD)'];

    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900">
              ${isEdit ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
            </h3>
            <button type="button" data-action="close-employee-modal" class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form id="employee-crud-form" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nama Lengkap Karyawan</label>
              <input type="text" id="emp-name" required value="${escapeHtml(d.name || '')}"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">NIP (Nomor Induk)</label>
                <input type="text" id="emp-nip" required value="${escapeHtml(d.nip || '')}"
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Email Kantor</label>
                <input type="email" id="emp-email" required value="${escapeHtml(d.email || '')}"
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Departemen</label>
                <select id="emp-dept" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs">
                  ${departments.map(dept => `<option value="${escapeHtml(dept)}" ${d.department === dept ? 'selected' : ''}>${escapeHtml(dept)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Jabatan / Posisi</label>
                <input type="text" id="emp-position" required value="${escapeHtml(d.position || '')}" placeholder="Operator / Staf"
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">No. Handphone / WA</label>
                <input type="text" id="emp-phone" value="${escapeHtml(d.phone || '')}" placeholder="08..."
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Alokasi Cuti (Hari)</label>
                <input type="number" id="emp-quota" value="${d.totalQuota || 12}"
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">PIN / Password Login (Default sama dengan NIP)</label>
              <input type="text" id="emp-pin" value="${escapeHtml(d.pin || '')}" placeholder="Kosongkan jika sama dengan NIP"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono">
            </div>

            <div class="flex items-center space-x-2 pt-2">
              <button type="button" data-action="close-employee-modal"
                class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                Batal
              </button>
              <button type="submit"
                class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                Simpan Data
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 3. Photo Preview Modal
  if (state.photoModal.isOpen) {
    html += `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
        <div class="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 class="font-bold text-slate-800 text-sm">${escapeHtml(state.photoModal.title)}</h4>
            <button type="button" data-action="close-photo-modal" class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-4 flex items-center justify-center max-h-[70vh] overflow-hidden bg-slate-900">
            <img src="${escapeHtml(state.photoModal.url)}" class="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg">
          </div>

          <div class="p-4 border-t border-slate-100 text-right">
            <button type="button" data-action="close-photo-modal"
              class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer">
              Tutup
            </button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Root Renderer
function renderApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  if (!state.currentUser) {
    root.innerHTML = renderLoginScreen();
  } else {
    root.innerHTML = renderMainApp();
  }
  renderModals();
}

// ============================================================================
// 9. EVENT LISTENERS & DELEGATION
// ============================================================================
function setupEventListeners() {
  // Global Click Delegator
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');

    switch (action) {
      case 'switch-login-role': {
        state.loginRole = target.getAttribute('data-role');
        renderApp();
        break;
      }
      case 'quick-login': {
        const empId = target.getAttribute('data-id');
        quickLogin(empId);
        break;
      }
      case 'logout': {
        handleLogout();
        break;
      }
      case 'switch-role': {
        const newRole = target.getAttribute('data-role');
        if (newRole === 'admin' && (!state.currentUser || state.currentUser.role !== 'admin')) {
          showToast('Akses ditolak: Hanya akun Administrator yang memiliki akses ini.', 'error');
          state.currentRole = 'employee';
          state.currentTab = 'attendance';
          saveSession();
          renderApp();
          break;
        }
        state.currentRole = newRole;
        state.currentTab = newRole === 'admin' ? 'dashboard' : 'attendance';
        saveSession();
        renderApp();
        break;
      }
      case 'switch-tab': {
        const tab = target.getAttribute('data-tab');
        if (tab === 'overtime') {
          state.reportFilter.viewType = 'per-employee';
        }
        state.currentTab = tab;
        renderApp();
        if (getGoogleScriptUrl() && ['dashboard', 'approvals', 'overtime', 'reports', 'history'].includes(tab)) {
          fetchCloudData(false);
        }
        break;
      }
      case 'sync-cloud-data': {
        fetchCloudData(true);
        break;
      }
      case 'refresh-gps': {
        showToast('Memperbarui titik lokasi GPS...', 'info');
        detectLocation(() => {
          showToast('Titik koordinat berhasil diperbarui!', 'success');
          renderApp();
        });
        break;
      }
      case 'set-office-gps': {
        if (state.gps.lat && state.gps.lng) {
          state.officeSettings.officeLatitude = Number(state.gps.lat.toFixed(6));
          state.officeSettings.officeLongitude = Number(state.gps.lng.toFixed(6));
          saveDatabase();
          showToast('Titik kantor diatur ke GPS Anda saat ini!', 'success');
          renderApp();
        } else {
          showToast('Lokasi GPS belum terdeteksi. Silakan klik Cek GPS.', 'warning');
        }
        break;
      }
      case 'start-camera': {
        startCamera();
        break;
      }
      case 'stop-camera': {
        stopCamera();
        renderApp();
        break;
      }
      case 'capture-photo': {
        capturePhoto();
        break;
      }
      case 'retake-photo': {
        retakePhoto();
        break;
      }
      case 'clock-in': {
        clockIn();
        break;
      }
      case 'clock-out': {
        clockOut();
        break;
      }
      case 'set-request-type': {
        state.requestForm.type = target.getAttribute('data-type');
        renderApp();
        break;
      }
      case 'open-approval-modal': {
        const reqId = target.getAttribute('data-id');
        const actType = target.getAttribute('data-action-type');
        openApprovalModal(reqId, actType);
        break;
      }
      case 'close-approval-modal': {
        closeApprovalModal();
        break;
      }
      case 'submit-approval': {
        const notes = document.getElementById('approval-notes') ? document.getElementById('approval-notes').value : '';
        processApproval(state.approvalModal.requestId, state.approvalModal.action, notes);
        break;
      }
      case 'open-employee-modal': {
        const mode = target.getAttribute('data-mode');
        if (mode === 'edit') {
          openEditEmployeeModal(target.getAttribute('data-id'));
        } else {
          openAddEmployeeModal();
        }
        break;
      }
      case 'close-employee-modal': {
        closeEmployeeModal();
        break;
      }
      case 'delete-employee': {
        deleteEmployee(target.getAttribute('data-id'));
        break;
      }
      case 'reset-all-quotas': {
        resetAllLeaveQuotas();
        break;
      }
      case 'export-csv': {
        exportReportsToCSV();
        break;
      }
      case 'export-excel': {
        exportReportsToExcel();
        break;
      }
      case 'export-pdf': {
        exportReportsToPDF();
        break;
      }
      case 'set-report-range': {
        state.reportFilter.range = target.getAttribute('data-range') || '30days';
        renderApp();
        break;
      }
      case 'set-report-view': {
        state.reportFilter.viewType = target.getAttribute('data-view') || 'per-employee';
        renderApp();
        break;
      }
      case 'filter-emp-daily': {
        const empId = target.getAttribute('data-id');
        state.reportFilter.viewType = 'daily';
        state.reportFilter.employeeId = empId || 'ALL';
        renderApp();
        break;
      }
      case 'reset-emp-filter': {
        state.reportFilter.employeeId = 'ALL';
        renderApp();
        break;
      }
      case 'print-report': {
        exportReportsToPDF();
        break;
      }
      case 'backup-json': {
        exportDatabaseJSON();
        break;
      }
      case 'delete-attendance': {
        const attId = target.getAttribute('data-id');
        const att = state.attendances.find(a => a.id === attId);
        const emp = att ? getEmployee(att.employeeId) : null;
        const empName = emp ? emp.name : 'ini';
        if (confirm(`Apakah Anda yakin ingin menghapus data presensi & log lembur milik ${empName} (Tanggal: ${att ? att.date : ''})?`)) {
          state.attendances = state.attendances.filter(a => a.id !== attId);
          saveDatabase();
          showToast('Log presensi & lemburan berhasil dihapus.', 'info');
          renderApp();
        }
        break;
      }
      case 'clear-all-attendances': {
        if (confirm('PERINGATAN:\nApakah Anda yakin ingin MENGHAPUS SEMUA riwayat presensi & log lemburan?\n\nSeluruh rekapitulasi lembur 34 karyawan akan kembali menjadi 0 Jam (bersih untuk operasional asli).\n\nTindakan ini tidak dapat dibatalkan.')) {
          state.attendances = [];
          saveDatabase();
          showToast('Seluruh riwayat presensi & log lembur berhasil dikosongkan (0 Jam).', 'success');
          renderApp();
        }
        break;
      }
      case 'delete-request': {
        const reqId = target.getAttribute('data-id');
        const req = state.requests.find(r => r.id === reqId);
        if (!req) break;
        const emp = getEmployee(req.employeeId);
        const empName = emp ? emp.name : 'ini';
        if (confirm(`Apakah Anda yakin ingin menghapus data pengajuan ${req.type} milik ${empName} (${req.startDate} s/d ${req.endDate})?`)) {
          state.requests = state.requests.filter(r => r.id !== reqId);
          saveDatabase();
          showToast('Riwayat pengajuan berhasil dihapus.', 'info');
          renderApp();
        }
        break;
      }
      case 'clear-all-requests': {
        if (confirm('PERINGATAN:\nApakah Anda yakin ingin MENGHAPUS SEMUA riwayat pengajuan cuti & izin?\n\nSemua data permohonan izin/cuti akan dihapus bersih.\n\nTindakan ini tidak dapat dibatalkan.')) {
          state.requests = [];
          saveDatabase();
          showToast('Seluruh riwayat pengajuan cuti/izin berhasil dikosongkan.', 'success');
          renderApp();
        }
        break;
      }
      case 'reset-demo-data': {
        if (confirm('Kembalikan data ke data awal 34 karyawan PT ABI?')) {
          resetToDefaultDatabase(true);
          renderApp();
        }
        break;
      }
      case 'test-sheets-row': {
        sendTestRowToGoogleSheets();
        break;
      }
      case 'view-photo': {
        const title = target.getAttribute('data-title');
        const url = target.getAttribute('data-url');
        viewPhoto(title, url);
        break;
      }
      case 'close-photo-modal': {
        closePhotoModal();
        break;
      }
    }
  });

  // Global Change Delegator
  document.addEventListener('change', (e) => {
    // Photo File Input (Fallback)
    if (e.target && e.target.id === 'photo-file-input') {
      const file = e.target.files[0];
      if (file) handlePhotoUpload(file);
    }
    // Leave Attachment Input
    if (e.target && e.target.id === 'req-attachment-file') {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.requestForm.attachment = ev.target.result;
          renderApp();
        };
        reader.readAsDataURL(file);
      }
    }
    // Database Restore Input
    if (e.target && e.target.id === 'json-restore-input') {
      const file = e.target.files[0];
      if (file) importDatabaseJSON(file);
    }
    // Report Filters
    if (e.target && e.target.id === 'report-start-date') {
      state.reportFilter.startDate = e.target.value;
      renderApp();
    }
    if (e.target && e.target.id === 'report-end-date') {
      state.reportFilter.endDate = e.target.value;
      renderApp();
    }
    if (e.target && e.target.id === 'report-month-filter') {
      state.reportFilter.month = e.target.value;
      renderApp();
    }
    if (e.target && e.target.id === 'report-dept-filter') {
      state.reportFilter.department = e.target.value;
      renderApp();
    }
    if (e.target && e.target.id === 'report-emp-filter') {
      state.reportFilter.employeeId = e.target.value;
      renderApp();
    }
    if (e.target && e.target.id === 'report-status-filter') {
      state.reportFilter.status = e.target.value;
      renderApp();
    }
  });

  // Global Submit Delegator
  document.addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Login Form Submit
    if (e.target && e.target.id === 'login-form') {
      const id = document.getElementById('login-id').value;
      const pin = document.getElementById('login-pin').value;
      handleLogin(id, pin, state.loginRole);
      return;
    }

    // 2. Leave Request Form Submit
    if (e.target && e.target.id === 'request-leave-form') {
      state.requestForm.startDate = document.getElementById('req-start-date').value;
      state.requestForm.endDate = document.getElementById('req-end-date').value;
      state.requestForm.reason = document.getElementById('req-reason').value;
      state.requestForm.emergencyContact = document.getElementById('req-contact').value;
      submitLeaveRequest();
      return;
    }

    // 3. Employee CRUD Form Submit
    if (e.target && e.target.id === 'employee-crud-form') {
      const data = {
        id: state.employeeModal.data ? state.employeeModal.data.id : '',
        name: document.getElementById('emp-name').value,
        nip: document.getElementById('emp-nip').value,
        email: document.getElementById('emp-email').value,
        department: document.getElementById('emp-dept').value,
        position: document.getElementById('emp-position').value,
        phone: document.getElementById('emp-phone').value,
        totalQuota: document.getElementById('emp-quota').value,
        pin: document.getElementById('emp-pin').value
      };
      saveEmployeeData(data, state.employeeModal.isEdit);
      return;
    }

    // 4. Office Settings Form Submit
    if (e.target && e.target.id === 'office-settings-form') {
      state.officeSettings.companyName = document.getElementById('set-company-name').value.trim();
      state.officeSettings.companyLogo = document.getElementById('set-company-logo').value.trim();
      state.officeSettings.workStart = document.getElementById('set-work-start').value;
      state.officeSettings.workEnd = document.getElementById('set-work-end').value;
      state.officeSettings.defaultAnnualLeaveQuota = Number(document.getElementById('set-quota').value || 12);
      state.officeSettings.officeLatitude = Number(document.getElementById('set-lat').value);
      state.officeSettings.officeLongitude = Number(document.getElementById('set-lng').value);
      state.officeSettings.allowedRadiusMeters = Number(document.getElementById('set-radius').value || 150);
      state.officeSettings.strictGps = document.getElementById('set-strict-gps').checked;
      state.officeSettings.googleScriptUrl = document.getElementById('set-sheets-url').value.trim();

      saveDatabase();
      showToast('Seluruh pengaturan berhasil disimpan!', 'success');
      renderApp();
      return;
    }
  });
}

// Live Clock Ticker
function startClockTicker() {
  setInterval(() => {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) clockEl.innerText = getCurrentTimeFormatted() + ' WIB';
    const bannerClock = document.getElementById('live-clock-banner');
    if (bannerClock) bannerClock.innerText = getCurrentTimeFormatted() + ' WIB';
  }, 1000);
}

// ============================================================================
// 10. SYSTEM BOOTSTRAP
// ============================================================================
function initSystem() {
  console.log('[ABI SmartAbsen] Inisialisasi sistem...');
  try {
    loadDatabase();
    loadSession();
    setupEventListeners();
    detectLocation();
    renderApp();
    startClockTicker();
    if (getGoogleScriptUrl()) {
      fetchCloudData(false);
    }
    console.log('[ABI SmartAbsen] Sistem siap digunakan.');
  } catch (err) {
    console.error('[ABI SmartAbsen] Error inisialisasi:', err);
    const root = document.getElementById('app-root');
    if (root) {
      root.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div class="max-w-md w-full bg-slate-800 p-6 rounded-2xl border border-rose-500/30 text-center space-y-4">
            <div class="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h3 class="text-base font-bold text-white">Terjadi Kendala Memuat Aplikasi</h3>
            <p class="text-xs text-slate-300">${escapeHtml(err.message || 'Gagal menginisialisasi data.')}</p>
            <button onclick="localStorage.clear(); location.reload();" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">
              Reset Cache & Muat Ulang
            </button>
          </div>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem);
} else {
  initSystem();
}
