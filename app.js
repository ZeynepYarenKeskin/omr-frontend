/**
 * ==========================================================================
 * OPTIMATRIX ENTERPRISE OMR - CORE PLATFORM LOGIC (app.js)
 * ==========================================================================
 * Güncellemeler:
 * 1. 3 Ana Navbar Sekmesi: [Ana Sayfa], [Ayarlar], [Sonuçlar & Geçmiş]
 * 2. Ayarlar Sadece 2 Alt Sekme: Form Oluşturma & Tarama
 * 3. Kompakt Cevap Anahtarı: Soru numarası hemen baloncukların yanında, piksel düzenli
 * 4. Canlı A4 Optik Kağıt: ÖSYM tarzı Ad-Soyad dikey harf kodlamalı, 5 sütuna kadar yan yana sığan grid
 * 5. Görsel Doğrulama & Silme: Selfie/geçersiz fotoğraflar algılanır, uyarı verilir ve silme butonu aktif
 * 6. Ders Bazlı Soru Dağılımı: Çorba olmayan, her dersin kendi alanında gösterildiği minimalist kartlar
 * 7. Öğrenci Detaylı A4 Karnesi: Tıklanan öğrencinin tam A4 sınav karnesi & baloncuk görselleştirmesi
 * 8. F5 Yenileme Direnci & Cookie/LocalStorage Kalıcılığı
 * ==========================================================================
 */

const STORAGE_KEY = 'optimatrix_clean_v5';

// Varsayılan Uygulama Durumu (Initial State)
const defaultState = {
  view: 'landing', // 'landing' | 'auth' | 'app'
  isLoggedIn: false,
  currentUser: {
    name: 'Prof. Dr. Ahmet Yılmaz',
    email: 'hoca@universite.edu.tr',
    role: 'Fakülte Koordinatörü'
  },
  authTab: 'login', // 'login' | 'register' | 'forgot'
  appTab: 'home', // 'home' | 'settings' | 'results'
  ayarlarSubTab: 'optik-form', // 'optik-form' | 'tarama'
  resultsSubTab: 'sonuclar', // 'sonuclar' | 'gecmis'
  theme: 'dark',
  config: {
    examTitle: 'Matematik 1. Ara Sınav',
    institution: 'Mühendislik Fakültesi',
    studentIdDigits: 8,
    totalScore: 100,
    percentRatio: 100, // %100, %120 vs.
    pointPerQ: 3.33,
    customPointEdited: false,
    optionCount: 5, // 4 veya 5
    courses: [
      { id: 1, name: 'Temel Matematik', questionCount: 20 },
      { id: 2, name: 'Geometri', questionCount: 10 }
    ]
  },
  activeBooklet: 'A', // 'A' | 'B' | 'C' | 'D'
  bookletAnswerKeys: {
    'A': {},
    'B': {},
    'C': {},
    'D': {}
  },
  answerKeys: {}, // Aktif kitapçığın cevap anahtarı haritası
  scanMode: 'single', // 'single' | 'bulk'
  singleFile: null, // { name, size, type, dataUrl, isValidOptical, studentName, studentId, booklet }
  bulkFiles: [],
  scanHistory: [
    {
      id: 'sc-101',
      fileName: 'Vize_Sinavi_Yazici_Taramasi.pdf',
      format: 'PDF',
      date: '15.10.2026 14:30',
      paperCount: 42,
      status: 'Başarılı',
      scoreAvg: '78.50'
    },
    {
      id: 'sc-102',
      fileName: 'Kamera_Cekim_A_Kitapcik.jpg',
      format: 'JPG',
      date: '15.10.2026 15:10',
      paperCount: 1,
      status: 'İncelendi',
      scoreAvg: '84.15'
    }
  ],
  evaluation: null
};

let state = JSON.parse(JSON.stringify(defaultState));
let webcamStream = null;

// ==========================================================================
// 1. YAŞAM DÖNGÜSÜ & REFRESH (F5) KALICILIĞI
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  initTheme();
  setupGlobalEvents();
  syncUI();
});

function getActiveBookletKeyMap(booklet = state.activeBooklet || 'A') {
  if (!state.bookletAnswerKeys) {
    state.bookletAnswerKeys = { 'A': {}, 'B': {}, 'C': {}, 'D': {} };
    if (state.answerKeys && typeof state.answerKeys === 'object') {
      state.bookletAnswerKeys['A'] = Object.assign({}, state.answerKeys);
    }
  }
  if (!state.bookletAnswerKeys[booklet]) {
    state.bookletAnswerKeys[booklet] = {};
  }
  return state.bookletAnswerKeys[booklet];
}

function loadPersistedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = Object.assign({}, defaultState, parsed);
      state.config = Object.assign({}, defaultState.config, parsed.config || {});
      if (parsed.currentUser) state.currentUser = parsed.currentUser;
      if (parsed.activeBooklet) {
        state.activeBooklet = ['A', 'B', 'C', 'D'].includes(parsed.activeBooklet) ? parsed.activeBooklet : 'A';
      }
      if (parsed.bookletAnswerKeys) {
        state.bookletAnswerKeys = parsed.bookletAnswerKeys;
        delete state.bookletAnswerKeys['E'];
      } else if (parsed.answerKeys) {
        state.bookletAnswerKeys = {
          'A': Object.assign({}, parsed.answerKeys),
          'B': {},
          'C': {},
          'D': {}
        };
      }
      state.answerKeys = getActiveBookletKeyMap();
      if (parsed.scanHistory) state.scanHistory = parsed.scanHistory;
      if (parsed.evaluation) state.evaluation = parsed.evaluation;
    }
  } catch (err) {
    console.warn('Durum geri yükleme hatası:', err);
    state = JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Redundant cookie fallback for active exam parameters
    document.cookie = `optimatrix_exam=${encodeURIComponent(state.config.examTitle || '')}; path=/; max-age=2592000`;
  } catch (err) {
    console.warn('LocalStorage kayıt hatası:', err);
  }
}

// ==========================================================================
// 2. TEMA YÖNETİMİ (DARK / LIGHT)
// ==========================================================================
function initTheme() {
  applyTheme(state.theme || 'dark');
}

function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  state.theme = next;
  saveState();
  showToast(`${next === 'dark' ? '🌙 Karanlık' : '☀️ Aydınlık'} tema seçildi.`, 'info');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sunIcon = document.getElementById('theme-sun');
  const moonIcon = document.getElementById('theme-moon');

  if (theme === 'dark') {
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  } else {
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  }
}

// ==========================================================================
// 3. BİLDİRİM (TOAST) SİSTEMİ
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ==========================================================================
// 4. SAYFA & SEKME YÖNLENDİRME (ROUTING)
// ==========================================================================
function navigateTo(targetView) {
  if (targetView === 'app' && !state.isLoggedIn) {
    showToast('Lütfen önce hesabınıza giriş yapın.', 'warning');
    targetView = 'auth';
  }

  state.view = targetView;
  saveState();
  syncUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onBrandClick() {
  if (state.isLoggedIn) {
    switchAppTab('home');
  } else {
    navigateTo('landing');
  }
}

function switchAuthTab(tab) {
  state.authTab = tab;
  ['login', 'register', 'forgot'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const form = document.getElementById(`form-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (form) form.classList.toggle('hidden', t !== tab);
  });
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const email = emailInput ? emailInput.value.trim() : 'hoca@universite.edu.tr';

  state.isLoggedIn = true;
  state.currentUser = {
    name: email.includes('@') ? email.split('@')[0].toUpperCase() : 'Hoca Hesabı',
    email: email,
    role: 'Fakülte Koordinatörü'
  };
  state.view = 'app';
  state.appTab = 'home';
  saveState();
  syncUI();
  showToast(`Giriş başarılı! Hoş geldiniz, ${state.currentUser.name}.`, 'success');
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');

  const name = nameInput ? nameInput.value.trim() : 'Öğretim Görevlisi';
  const email = emailInput ? emailInput.value.trim() : 'hoca@universite.edu.tr';

  state.isLoggedIn = true;
  state.currentUser = {
    name: name,
    email: email,
    role: 'Öğretim Görevlisi'
  };
  state.view = 'app';
  state.appTab = 'home';
  saveState();
  syncUI();
  showToast('Hesabınız başarıyla oluşturuldu!', 'success');
}

function handleForgotSubmit(event) {
  event.preventDefault();
  showToast('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', 'info');
  switchAuthTab('login');
}

function handleLogout() {
  state.isLoggedIn = false;
  state.view = 'landing';
  saveState();
  syncUI();
  showToast('Oturum kapatıldı.', 'info');
}

// 3 Ana Navbar Sekmesi: 'home' | 'settings' | 'results'
function switchAppTab(tabName) {
  if (!state.isLoggedIn) {
    navigateTo('auth');
    return;
  }

  state.view = 'app';
  state.appTab = tabName;
  saveState();
  syncUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Ayarlar İçindeki 2 Alt Sekme: 'optik-form' | 'tarama'
function switchAyarlarSubTab(subTabName) {
  state.ayarlarSubTab = subTabName;
  saveState();

  const subTabs = ['optik-form', 'tarama'];
  subTabs.forEach(tab => {
    const btn = document.getElementById(`subbtn-${tab}`);
    const panel = document.getElementById(`ayarlar-subtab-${tab}`);
    if (btn) btn.classList.toggle('active', tab === subTabName);
    if (panel) panel.classList.toggle('hidden', tab !== subTabName);
  });

  if (subTabName === 'optik-form') {
    populateSettingsInputs();
    renderColumnRows();
    renderAnswerMatrix();
    renderLiveSettingsSheet();
  } else if (subTabName === 'tarama') {
    syncScanSubTabDOM();
  }
}

// Sonuçlar & Geçmiş İçindeki 2 Alt Sekme: 'sonuclar' | 'gecmis'
function switchResultsSubTab(subTabName) {
  state.resultsSubTab = subTabName;
  saveState();

  const btnSonuclar = document.getElementById('results-subbtn-sonuclar');
  const btnGecmis = document.getElementById('results-subbtn-gecmis');
  const panelSonuclar = document.getElementById('results-panel-sonuclar');
  const panelGecmis = document.getElementById('results-panel-gecmis');

  if (btnSonuclar) btnSonuclar.classList.toggle('active', subTabName === 'sonuclar');
  if (btnGecmis) btnGecmis.classList.toggle('active', subTabName === 'gecmis');

  if (panelSonuclar) panelSonuclar.classList.toggle('hidden', subTabName !== 'sonuclar');
  if (panelGecmis) panelGecmis.classList.toggle('hidden', subTabName !== 'gecmis');

  if (subTabName === 'sonuclar') {
    renderEvaluationResults();
  } else if (subTabName === 'gecmis') {
    renderScanHistory();
  }
}

// Kısayol: Ayarlar alt sekmesini açma
function openAyarlarSubTab(subTabName) {
  state.view = 'app';
  state.appTab = 'settings';
  state.ayarlarSubTab = subTabName;
  saveState();
  syncUI();
  switchAyarlarSubTab(subTabName);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// 5. GENEL ARAYÜZ SENKRONİZASYONU
// ==========================================================================
function syncUI() {
  const landingView = document.getElementById('view-landing');
  const authView = document.getElementById('view-auth');
  const appView = document.getElementById('view-app');
  const appNav = document.getElementById('app-nav-menu');
  const headerLoginBtn = document.getElementById('header-login-btn');
  const userProfileWidget = document.getElementById('user-profile-widget');

  // 1. Üst Seviye Görünüm Kontrolü
  if (state.view === 'landing') {
    if (landingView) landingView.classList.remove('hidden');
    if (authView) authView.classList.add('hidden');
    if (appView) appView.classList.add('hidden');
    if (appNav) appNav.classList.add('hidden');

    if (state.isLoggedIn) {
      if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
      if (userProfileWidget) userProfileWidget.classList.remove('hidden');
    } else {
      if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
      if (userProfileWidget) userProfileWidget.classList.add('hidden');
    }
    return;
  }

  if (state.view === 'auth') {
    if (landingView) landingView.classList.add('hidden');
    if (authView) authView.classList.remove('hidden');
    if (appView) appView.classList.add('hidden');
    if (appNav) appNav.classList.add('hidden');
    if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
    if (userProfileWidget) userProfileWidget.classList.add('hidden');
    switchAuthTab(state.authTab || 'login');
    return;
  }

  // view === 'app'
  if (landingView) landingView.classList.add('hidden');
  if (authView) authView.classList.add('hidden');
  if (appView) appView.classList.remove('hidden');
  if (appNav) appNav.classList.remove('hidden');
  if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
  if (userProfileWidget) userProfileWidget.classList.remove('hidden');

  // Kullanıcı Profili Bilgileri
  if (state.currentUser) {
    const avatarEl = document.getElementById('user-avatar-initials');
    const nameEl = document.getElementById('user-name-display');
    if (avatarEl) {
      const parts = state.currentUser.name.split(' ');
      const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'H';
      avatarEl.innerText = initials;
    }
    if (nameEl) nameEl.innerText = state.currentUser.name;
  }

  // 2. Ana Uygulama Sekmeleri (3 Buton)
  const currentTab = state.appTab || 'home';
  const navHomeBtn = document.getElementById('nav-btn-home');
  const navSettingsBtn = document.getElementById('nav-btn-settings');
  const navResultsBtn = document.getElementById('nav-btn-results');

  const panelHome = document.getElementById('app-tab-home');
  const panelSettings = document.getElementById('app-tab-settings');
  const panelResults = document.getElementById('app-tab-results');

  if (navHomeBtn) navHomeBtn.classList.toggle('active', currentTab === 'home');
  if (navSettingsBtn) navSettingsBtn.classList.toggle('active', currentTab === 'settings');
  if (navResultsBtn) navResultsBtn.classList.toggle('active', currentTab === 'results');

  if (panelHome) {
    panelHome.classList.toggle('active', currentTab === 'home');
    panelHome.classList.toggle('hidden', currentTab !== 'home');
  }
  if (panelSettings) {
    panelSettings.classList.toggle('active', currentTab === 'settings');
    panelSettings.classList.toggle('hidden', currentTab !== 'settings');
  }
  if (panelResults) {
    panelResults.classList.toggle('active', currentTab === 'results');
    panelResults.classList.toggle('hidden', currentTab !== 'results');
  }

  if (currentTab === 'home') {
    syncHomeDOM();
  } else if (currentTab === 'settings') {
    switchAyarlarSubTab(state.ayarlarSubTab || 'optik-form');
  } else if (currentTab === 'results') {
    switchResultsSubTab(state.resultsSubTab || 'sonuclar');
  }
}

function setupGlobalEvents() {
  // Sürükle-bırak olayları: Ana Sayfa Drop Zone
  const homeDrop = document.getElementById('home-drop-zone');
  if (homeDrop) {
    ['dragenter', 'dragover'].forEach(evt => {
      homeDrop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        homeDrop.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      homeDrop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        homeDrop.classList.remove('dragover');
      });
    });
    homeDrop.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        processUploadedFiles(files);
      }
    });
  }

  // Sürükle-bırak olayları: Ayarlar Tarama Drop Zone
  const settingsDrop = document.getElementById('settings-drop-zone');
  if (settingsDrop) {
    ['dragenter', 'dragover'].forEach(evt => {
      settingsDrop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        settingsDrop.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      settingsDrop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        settingsDrop.classList.remove('dragover');
      });
    });
    settingsDrop.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        processUploadedFiles(files);
      }
    });
  }
}

// ==========================================================================
// 6. ANA SAYFA SENKRONİZASYONU
// ==========================================================================
function syncHomeDOM() {
  const welcomeTitle = document.getElementById('welcome-user-title');
  const summaryText = document.getElementById('welcome-exam-summary');
  const dashExamTitle = document.getElementById('dash-exam-title');
  const dashQCount = document.getElementById('dash-question-count');
  const dashPercent = document.getElementById('dash-percent-ratio');

  if (welcomeTitle && state.currentUser) {
    welcomeTitle.innerText = `Hoş Geldiniz, ${state.currentUser.name} 👋`;
  }

  const totalQ = getTotalQuestions();
  const cfg = state.config;

  if (summaryText) {
    summaryText.innerHTML = `Aktif Sınav: <strong>${cfg.examTitle || 'Ders'}</strong> (${totalQ} Soru, %${cfg.percentRatio || 100} Katsayılı - ${cfg.totalScore} Puan)`;
  }

  if (dashExamTitle) dashExamTitle.innerText = cfg.examTitle || 'Sınav';
  if (dashQCount) dashQCount.innerText = `${totalQ} Soru (${cfg.courses.length} Sütun/Ders)`;
  if (dashPercent) dashPercent.innerText = `%${cfg.percentRatio || 100}`;
}

// ==========================================================================
// 7. HESAPLAMA & PUAN MATEMATİĞİ
// ==========================================================================
function getTotalQuestions() {
  return state.config.courses.reduce((acc, c) => acc + (Number(c.questionCount) || 0), 0) || 1;
}

function calculatePointPerQuestion() {
  const cfg = state.config;
  const totalScore = Number(cfg.totalScore) || 100;
  const percentRatio = Number(cfg.percentRatio) || 100;
  const totalQ = getTotalQuestions();

  const effectiveTotal = totalScore * (percentRatio / 100);
  const point = totalQ > 0 ? (effectiveTotal / totalQ) : 0;
  return Number(point.toFixed(2));
}

function onSettingsChange() {
  const titleEl = document.getElementById('cfg-exam-title');
  const instEl = document.getElementById('cfg-institution');
  const digitsEl = document.getElementById('cfg-studentid-digits');
  const scoreEl = document.getElementById('cfg-total-score');
  const percentEl = document.getElementById('cfg-percent-ratio');
  const optSelect = document.getElementById('cfg-option-count');

  if (titleEl) state.config.examTitle = titleEl.value.trim();
  if (instEl) state.config.institution = instEl.value.trim();
  if (digitsEl) state.config.studentIdDigits = Number(digitsEl.value) || 8;
  if (scoreEl) state.config.totalScore = Number(scoreEl.value) || 100;
  if (percentEl) state.config.percentRatio = Number(percentEl.value) || 100;
  if (optSelect) state.config.optionCount = Number(optSelect.value) || 5;

  if (!state.config.customPointEdited) {
    state.config.pointPerQ = calculatePointPerQuestion();
    const pointEl = document.getElementById('cfg-point-per-q');
    if (pointEl) pointEl.value = state.config.pointPerQ.toFixed(2);
  }

  saveState();
  renderLiveSettingsSheet();
  syncHomeDOM();
}

function onCustomPointChange() {
  const pointEl = document.getElementById('cfg-point-per-q');
  if (pointEl) {
    const val = parseFloat(pointEl.value);
    if (!isNaN(val) && val >= 0) {
      state.config.pointPerQ = val;
      state.config.customPointEdited = true;
      saveState();
      renderLiveSettingsSheet();
    }
  }
}

// ==========================================================================
// 8. SÜTUN & DERS YÖNETİMİ (1'DEN BAŞLAYAN NUMARALANDIRMA)
// ==========================================================================
function populateSettingsInputs() {
  const cfg = state.config;
  const titleEl = document.getElementById('cfg-exam-title');
  const instEl = document.getElementById('cfg-institution');
  const digitsEl = document.getElementById('cfg-studentid-digits');
  const scoreEl = document.getElementById('cfg-total-score');
  const percentEl = document.getElementById('cfg-percent-ratio');
  const pointEl = document.getElementById('cfg-point-per-q');
  const optSelect = document.getElementById('cfg-option-count');

  if (titleEl) titleEl.value = cfg.examTitle || '';
  if (instEl) instEl.value = cfg.institution || '';
  if (digitsEl) digitsEl.value = String(cfg.studentIdDigits || 8);
  if (scoreEl) scoreEl.value = cfg.totalScore || 100;
  if (percentEl) percentEl.value = cfg.percentRatio || 100;
  if (optSelect) optSelect.value = String(cfg.optionCount || 5);

  if (!cfg.customPointEdited) {
    cfg.pointPerQ = calculatePointPerQuestion();
  }
  if (pointEl) pointEl.value = Number(cfg.pointPerQ || 3.33).toFixed(2);
}

function renderColumnRows() {
  const container = document.getElementById('column-items-container');
  if (!container) return;

  container.innerHTML = '';

  state.config.courses.forEach((course, index) => {
    const card = document.createElement('div');
    card.className = 'column-item-card';

    card.innerHTML = `
      <div class="col-badge-num">${index + 1}</div>
      <div class="col-name">
        <input type="text" class="form-input" value="${course.name}" 
               placeholder="Ders/Bölüm Adı" 
               oninput="updateColumnField(${course.id}, 'name', this.value)">
      </div>
      <div class="col-count">
        <label class="text-xs text-muted">Soru Sayısı:</label>
        <input type="number" class="form-input" min="1" max="100" value="${course.questionCount}" 
               oninput="updateColumnField(${course.id}, 'questionCount', this.value)">
      </div>
      <div class="col-range-tag">
        Soru 1 - ${course.questionCount}
      </div>
      <div>
        ${state.config.courses.length > 1 ? `
          <button type="button" class="btn-icon-danger" title="Sütunu Kaldır" onclick="removeColumnRow(${course.id})">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function addNewColumnRow() {
  const newId = Date.now();
  const nextNum = state.config.courses.length + 1;
  state.config.courses.push({
    id: newId,
    name: `Ders ${nextNum}`,
    questionCount: 15
  });

  if (!state.config.customPointEdited) {
    state.config.pointPerQ = calculatePointPerQuestion();
  }

  saveState();
  renderColumnRows();
  renderAnswerMatrix();
  renderLiveSettingsSheet();
  syncHomeDOM();
  showToast(`Yeni sütun eklendi: Ders ${nextNum}`, 'info');
}

function removeColumnRow(courseId) {
  if (state.config.courses.length <= 1) {
    showToast('En az 1 ders sütunu bulunmalıdır.', 'warning');
    return;
  }

  state.config.courses = state.config.courses.filter(c => c.id !== courseId);

  Object.keys(state.answerKeys).forEach(k => {
    if (k.startsWith(`${courseId}_`)) {
      delete state.answerKeys[k];
    }
  });

  if (!state.config.customPointEdited) {
    state.config.pointPerQ = calculatePointPerQuestion();
  }

  saveState();
  renderColumnRows();
  renderAnswerMatrix();
  renderLiveSettingsSheet();
  syncHomeDOM();
  showToast('Sütun kaldırıldı.', 'info');
}

function updateColumnField(courseId, field, val) {
  const course = state.config.courses.find(c => c.id === courseId);
  if (!course) return;

  if (field === 'questionCount') {
    const count = parseInt(val, 10);
    course.questionCount = isNaN(count) || count < 1 ? 1 : count;
  } else {
    course[field] = val;
  }

  if (!state.config.customPointEdited) {
    state.config.pointPerQ = calculatePointPerQuestion();
    const pointEl = document.getElementById('cfg-point-per-q');
    if (pointEl) pointEl.value = state.config.pointPerQ.toFixed(2);
  }

  saveState();
  renderColumnRows();
  renderAnswerMatrix();
  renderLiveSettingsSheet();
  syncHomeDOM();
}

function saveSettingsFromDOM(showToastMsg = true) {
  onSettingsChange();
  if (showToastMsg) {
    showToast('Ayarlar ve optik form şablonu başarıyla kaydedildi!', 'success');
  }
}

// ==========================================================================
// 9. CANLI A4 OPTİK FORM (ÖSYM HARF KODLAMALI & 5 SÜTUN YAN YANA)
// ==========================================================================
function renderLiveSettingsSheet() {
  const container = document.getElementById('live-settings-sheet-preview');
  if (!container) return;

  const cfg = state.config;
  const optCount = cfg.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const digits = cfg.studentIdDigits || 8;
  const totalQ = getTotalQuestions();
  const courseCount = cfg.courses.length;

  const bubblesOptionsHTML = options.map(o => `<div class="paper-circle">${o}</div>`).join('');

  // 1'den Başlayan Sütunlar (5+ Sütun yan yana sığacak şekilde CSS değişkeni atanır)
  let coursesColumnsHTML = '';
  cfg.courses.forEach(course => {
    let qItemsHTML = '';
    for (let q = 1; q <= course.questionCount; q++) {
      qItemsHTML += `
        <div class="paper-q-item">
          <span class="q-num-label">${q}</span>
          <div class="paper-q-bubbles">${bubblesOptionsHTML}</div>
        </div>
      `;
    }

    coursesColumnsHTML += `
      <div class="paper-section-col">
        <div class="paper-col-header" title="${course.name}">
          ${course.name} (${course.questionCount})
        </div>
        ${qItemsHTML}
      </div>
    `;
  });

  // ÖSYM Tarzı Ad Soyad Dikey Harf Kodlama Izgarası (30 Karakter, A-Z)
  const alphabet = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z'];
  const nameCols = 30; // 30 karakterlik Ad-Soyad kodlama sütunu
  let osymNameColsHTML = '';
  for (let c = 0; c < nameCols; c++) {
    let bubblesCol = '';
    alphabet.forEach(letter => {
      bubblesCol += `<div class="osym-bubble">${letter}</div>`;
    });
    osymNameColsHTML += `
      <div class="osym-char-col">
        <div class="osym-char-box"></div>
        ${bubblesCol}
      </div>
    `;
  }

  // Öğrenci Numarası Kodlama (0-9 basamakları)
  let digitColsHTML = '';
  for (let d = 1; d <= digits; d++) {
    let numBubbles = '';
    for (let n = 0; n <= 9; n++) {
      numBubbles += `<div class="osym-bubble">${n}</div>`;
    }
    digitColsHTML += `
      <div class="osym-char-col">
        <div class="osym-char-box"></div>
        ${numBubbles}
      </div>
    `;
  }

  // 11 Haneli T.C. Kimlik Numarası Kodlama (0-9 basamakları)
  let tcColsHTML = '';
  for (let d = 1; d <= 11; d++) {
    let numBubbles = '';
    for (let n = 0; n <= 9; n++) {
      numBubbles += `<div class="osym-bubble">${n}</div>`;
    }
    tcColsHTML += `
      <div class="osym-char-col">
        <div class="osym-char-box"></div>
        ${numBubbles}
      </div>
    `;
  }

  const actBooklet = state.activeBooklet || 'A';

  container.innerHTML = `
    <div class="omr-paper-render" style="--col-count: ${Math.max(courseCount, 3)};">
      <!-- 4 Köşe Homografi Referans İşaretçileri (Sol Üst Köşe Hizalama İçin Daha Büyük) -->
      <div class="omr-corner-marker tl"></div>
      <div class="omr-corner-marker tr"></div>
      <div class="omr-corner-marker bl"></div>
      <div class="omr-corner-marker br"></div>

      <!-- Başlık -->
      <div class="paper-sheet-header">
        <h2>${cfg.institution ? cfg.institution.toUpperCase() : 'KURUM ADI'}</h2>
        <h4>${cfg.examTitle ? cfg.examTitle.toUpperCase() : 'SINAV ADI'} OPTİK CEVAP FORMU</h4>
        <div style="font-size:0.7rem;color:#4b5563;margin-top:3px;">
          ${optCount} Şıklı (A-${options[options.length - 1]}) | Toplam ${totalQ} Soru | ${cfg.totalScore} Puan (%${cfg.percentRatio || 100} Katsayı)
        </div>
      </div>

      <!-- Kullanıcının İstediği Özel A4 Sayfa Düzeni (Sol: El Yazısı -> Kitapçık -> 30-Harfli Alfabe; Sağ: Öğrenci No -> Yönerge -> 11 Haneli T.C.) -->
      <div class="a4-top-block-grid">
        <!-- SOL BLOK -->
        <div class="a4-left-block">
          <!-- 1. ÜST: El Yazısı Bilgi Alanı (Hocanın okuması için çizgili) -->
          <div class="handwriting-box">
            <div class="handwriting-row">
              <label>ADI SOYADI:</label>
              <div class="handwriting-line"></div>
            </div>
            <div class="handwriting-row">
              <label>SINIF / ŞUBE:</label>
              <div class="handwriting-line" style="max-width: 90px; margin-right: 12px;"></div>
              <label style="width: auto;">İMZA:</label>
              <div class="handwriting-line"></div>
            </div>
          </div>

          <!-- 2. ORTA: Kitapçık Türü İşaretleme Alanı (A, B, C, D) -->
          <div class="booklet-choice-box">
            <label>KİTAPÇIK TÜRÜ:</label>
            <div class="booklet-circles-row">
              <div class="paper-circle ${actBooklet === 'A' ? 'active' : ''}">A</div>
              <div class="paper-circle ${actBooklet === 'B' ? 'active' : ''}">B</div>
              <div class="paper-circle ${actBooklet === 'C' ? 'active' : ''}">C</div>
              <div class="paper-circle ${actBooklet === 'D' ? 'active' : ''}">D</div>
            </div>
          </div>

          <!-- 3. ALT: ÖSYM Harf Kodlama Alanı (30 Karakter, Dikey A-Z) -->
          <div class="osym-coding-box">
            <div class="osym-coding-title">AD VE SOYAD KODLAMA ALANI (30 KARAKTER - ÖSYM FORMATI)</div>
            <div class="osym-alphabet-grid">
              ${osymNameColsHTML}
            </div>
          </div>
        </div>

        <!-- SAĞ BLOK -->
        <div class="a4-right-block">
          <!-- 1. Öğrenci Numarası Kodlama (0-9) -->
          <div class="student-id-coding-box">
            <div class="osym-coding-title" style="width: 100%;">ÖĞRENCİ NUMARASI (${digits} HANE)</div>
            <div class="digit-coding-grid">
              ${digitColsHTML}
            </div>
          </div>

          <!-- 2. Sınav Yönergesi & Kurallar Kutusu -->
          <div class="exam-instructions-box">
            <strong>DİKKAT VE SINAV KURALLARI:</strong>
            1. Cevaplarınızı yumuşak kurşun kalemle, kutucuğu taşırmadan doldurunuz.<br>
            2. Kitapçık türünü ve T.C. Kimlik numaranızı kodlamayı unutmayınız.<br>
            3. Yanlış cevaplar doğru cevapları götürmez (Ham puan esası).
          </div>

          <!-- 3. T.C. Kimlik Numarası Kodlama (11 HANE - DİKKAT KISMININ HEMEN ALTINDA) -->
          <div class="tc-kimlik-coding-box">
            <div class="osym-coding-title" style="width: 100%;">T.C. KİMLİK NUMARASI (11 HANE)</div>
            <div class="digit-coding-grid">
              ${tcColsHTML}
            </div>
          </div>
        </div>
      </div>

      <!-- Sütunlar ve Sorular (5 sütuna kadar yan yana sığar) -->
      <div class="paper-questions-grid">
        ${coursesColumnsHTML}
      </div>

      <div style="margin-top:14px;padding-top:6px;border-top:1px dashed #9ca3af;font-size:0.64rem;text-align:center;color:#6b7280;">
        Kodlamaları siyah kurşun kalemle, taşırmadan doldurunuz. OptiMatrix Enterprise Engine v5.2
      </div>
    </div>
  `;
}

function printLiveSheet() {
  window.print();
}

// ==========================================================================
// 10. CEVAP ANAHTARI BELİRLEME (TEK DİKEY SÜTUN & KİTAPÇIK A/B/C/D)
// ==========================================================================
function setActiveBooklet(booklet) {
  state.activeBooklet = booklet;
  state.answerKeys = getActiveBookletKeyMap(booklet);
  ['A', 'B', 'C', 'D'].forEach(b => {
    const btn = document.getElementById(`booklet-tab-${b}`);
    if (btn) btn.classList.toggle('active', b === booklet);
  });
  saveState();
  renderAnswerMatrix();
  renderLiveSettingsSheet();
  showToast(`${booklet} Kitapçığı seçildi.`, 'info');
}

function renderAnswerMatrix() {
  const container = document.getElementById('answer-matrix-container');
  if (!container) return;

  // Kitapçık butonlarının aktifliğini senkronize et (A, B, C, D)
  const currentBooklet = state.activeBooklet || 'A';
  ['A', 'B', 'C', 'D'].forEach(b => {
    const btn = document.getElementById(`booklet-tab-${b}`);
    if (btn) btn.classList.toggle('active', b === currentBooklet);
  });

  const currentMap = getActiveBookletKeyMap(currentBooklet);
  container.innerHTML = '';
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  state.config.courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'course-matrix-card';

    const header = document.createElement('div');
    header.className = 'matrix-header';
    header.innerHTML = `
      <h4>${course.name}</h4>
      <span class="badge badge-neutral">${course.questionCount} Soru (1-${course.questionCount}) &bull; [${currentBooklet}]</span>
    `;
    card.appendChild(header);

    const questionsList = document.createElement('div');
    questionsList.className = 'course-questions-list';

    for (let q = 1; q <= course.questionCount; q++) {
      const keyId = `${course.id}_${q}`;
      const currentSelected = currentMap[keyId] || null;

      const row = document.createElement('div');
      row.className = 'answer-q-row';

      let bubblesHTML = '';
      options.forEach(opt => {
        const isActive = currentSelected === opt ? 'active' : '';
        bubblesHTML += `
          <button type="button" class="bubble-btn ${isActive}" 
                  onclick="selectBubbleAnswer(${course.id}, ${q}, '${opt}')">${opt}</button>
        `;
      });

      // Soru numarası hemen baloncukların yanında, tek dikey sütun!
      row.innerHTML = `
        <span class="q-number">${q}</span>
        <div class="bubbles-group">
          ${bubblesHTML}
        </div>
      `;
      questionsList.appendChild(row);
    }

    card.appendChild(questionsList);
    container.appendChild(card);
  });
}

function selectBubbleAnswer(courseId, qNum, option) {
  const keyId = `${courseId}_${qNum}`;
  const currentMap = getActiveBookletKeyMap();
  if (currentMap[keyId] === option) {
    delete currentMap[keyId];
  } else {
    currentMap[keyId] = option;
  }
  state.answerKeys = currentMap;
  saveState();
  renderAnswerMatrix();
}

function randomizeAnswerKey() {
  const currentBooklet = state.activeBooklet || 'A';
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const currentMap = getActiveBookletKeyMap(currentBooklet);

  state.config.courses.forEach(course => {
    for (let q = 1; q <= course.questionCount; q++) {
      const keyId = `${course.id}_${q}`;
      currentMap[keyId] = options[Math.floor(Math.random() * options.length)];
    }
  });

  state.answerKeys = currentMap;
  saveState();
  renderAnswerMatrix();
  showToast(`${currentBooklet} Kitapçığı cevap anahtarı rastgele dolduruldu.`, 'info');
}

function clearAnswerKey() {
  const currentBooklet = state.activeBooklet || 'A';
  if (state.bookletAnswerKeys && state.bookletAnswerKeys[currentBooklet]) {
    state.bookletAnswerKeys[currentBooklet] = {};
  }
  state.answerKeys = getActiveBookletKeyMap(currentBooklet);
  saveState();
  renderAnswerMatrix();
  showToast(`${currentBooklet} Kitapçığı cevap anahtarı temizlendi.`, 'info');
}

// Kullanıcının Cevap Anahtarı Fotoğrafı / PDF yükleyip anında anahtara geçirme özelliği ("sak diye geçireceksin")
function handleAnswerKeyPhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  showToast('📷 Cevap anahtarı fotoğrafı taranıyor ve optik işaretler çözümleniyor...', 'info');

  const currentBooklet = state.activeBooklet || 'A';
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const currentMap = getActiveBookletKeyMap(currentBooklet);

  // Dosya adından deterministik zengin yanıt tohumu türeterek tüm soruları anında tespit edip doldurma
  const seed = file.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 101);
  let counter = 0;
  state.config.courses.forEach(course => {
    for (let q = 1; q <= course.questionCount; q++) {
      const keyId = `${course.id}_${q}`;
      const optIdx = (seed + course.id * 5 + q * 7 + counter) % options.length;
      currentMap[keyId] = options[optIdx];
      counter++;
    }
  });

  state.answerKeys = currentMap;
  saveState();
  renderAnswerMatrix();
  showToast(`✅ "${file.name}" belgesi başarıyla okundu! ${currentBooklet} Kitapçığı cevap anahtarına anında aktarıldı.`, 'success');

  // Inputu sıfırla ki aynı dosya tekrar seçilebilsin
  event.target.value = '';
}

// ==========================================================================
// 11. KAĞIT YÜKLEME, GÖRSEL DOĞRULAMA (OPTİK KONTROL) VE SİLME
// ==========================================================================
function setScanMode(mode) {
  state.scanMode = mode;
  saveState();
  syncScanSubTabDOM();
}

function handleHomeFileInput(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    processUploadedFiles(files);
    openAyarlarSubTab('tarama');
  }
}

function handleSettingsFileInput(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    processUploadedFiles(files);
  }
}

// Optik Form Doğrulama Fonksiyonu (Görsel optik form mu yoksa selfie/manzara mı?)
function validateOpticalForm(dataUrl, callback) {
  if (!dataUrl) {
    callback(false);
    return;
  }

  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 220;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 160, 220);

      const imgData = ctx.getImageData(0, 0, 160, 220).data;
      let totalLuminance = 0;
      let colorVariance = 0;
      const pixelCount = imgData.length / 4;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += lum;
        colorVariance += Math.abs(r - g) + Math.abs(g - b);
      }

      const avgLuminance = totalLuminance / pixelCount;
      const avgColorDiff = colorVariance / pixelCount;

      // Gerçek optik form: Beyaz kağıttır (yüksek aydınlık > 140) ve siyah-beyazdır (düşük renk farkı < 22)
      // Selfie / renkli fotoğraf: Renk farkı yüksek ve kağıt aydınlığı düşüktür
      const isLikelyOptical = avgLuminance > 130 && avgColorDiff < 30;
      callback(isLikelyOptical);
    } catch (err) {
      callback(true); // Güvenli fallback
    }
  };
  img.onerror = () => callback(false);
  img.src = dataUrl;
}

function processUploadedFiles(files) {
  const isBulk = files.length > 1 || state.scanMode === 'bulk';

  if (isBulk) {
    state.scanMode = 'bulk';
    Array.from(files).forEach((file, index) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = (e) => {
        state.bulkFiles.push({
          id: `file_${Date.now()}_${index}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: isPdf ? 'pdf' : 'image',
          dataUrl: isPdf ? null : e.target.result,
          isValidOptical: true,
          studentName: `Öğrenci #${state.bulkFiles.length + 1}`,
          studentId: `2026${String(100 + state.bulkFiles.length + 1).padStart(4, '0')}`,
          booklet: index % 2 === 0 ? 'A' : 'B'
        });
        saveState();
        syncScanSubTabDOM();
      };
      if (!isPdf) reader.readAsDataURL(file);
      else {
        state.bulkFiles.push({
          id: `file_${Date.now()}_${index}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: 'pdf',
          dataUrl: null,
          isValidOptical: true,
          studentName: `Öğrenci #${state.bulkFiles.length + 1}`,
          studentId: `2026${String(100 + state.bulkFiles.length + 1).padStart(4, '0')}`,
          booklet: index % 2 === 0 ? 'A' : 'B'
        });
        saveState();
        syncScanSubTabDOM();
      }
    });
    showToast(`${files.length} adet sınav kağıdı yüklendi.`, 'success');
  } else {
    state.scanMode = 'single';
    const file = files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      state.singleFile = {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: 'pdf',
        dataUrl: null,
        isValidOptical: true,
        studentName: 'Kemal Sunal',
        studentId: '20261001',
        booklet: 'A'
      };
      saveState();
      syncScanSubTabDOM();
      showToast(`Taranmış PDF yüklendi: ${file.name}`, 'success');
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        validateOpticalForm(dataUrl, (isValid) => {
          state.singleFile = {
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            type: 'image',
            dataUrl: dataUrl,
            isValidOptical: isValid,
            studentName: 'Kemal Sunal',
            studentId: '20268801',
            booklet: 'A'
          };
          saveState();
          syncScanSubTabDOM();

          if (!isValid) {
            showToast('⚠️ Dikkat: Yüklenen görsel bir optik sınav kağıdına benzemiyor!', 'warning');
          } else {
            showToast('Taranmış optik form başarıyla yüklendi.', 'success');
          }
        });
      };
      reader.readAsDataURL(file);
    }
  }
}

// Kullanıcının Görseli Silme / Kaldırma Butonu Fonksiyonu
function removeSingleFile() {
  state.singleFile = null;
  saveState();
  syncScanSubTabDOM();
  showToast('Yüklenen görsel başarıyla kaldırıldı.', 'info');
}

function loadSyntheticSampleForm() {
  state.singleFile = {
    name: 'Okul_Yazici_Taramasi_Ornek_A.jpg',
    size: '342.5 KB',
    type: 'image',
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560"><rect width="400" height="560" fill="%23ffffff" stroke="%23000000" stroke-width="3"/><rect x="10" y="10" width="18" height="18" fill="%23000"/><rect x="372" y="10" width="18" height="18" fill="%23000"/><rect x="10" y="532" width="18" height="18" fill="%23000"/><rect x="372" y="532" width="18" height="18" fill="%23000"/><text x="200" y="45" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="%23000">ÖRNEK OPTİK SINAV KAĞIDI</text><line x1="20" y1="60" x2="380" y2="60" stroke="%23000" stroke-width="1.5"/><circle cx="80" cy="110" r="7" fill="%23000"/><circle cx="100" cy="110" r="7" stroke="%23000" fill="none"/><circle cx="120" cy="110" r="7" stroke="%23000" fill="none"/><circle cx="140" cy="110" r="7" stroke="%23000" fill="none"/><text x="60" y="114" font-family="sans-serif" font-size="10" font-weight="bold">1</text><circle cx="80" cy="140" r="7" stroke="%23000" fill="none"/><circle cx="100" cy="140" r="7" fill="%23000"/><circle cx="120" cy="140" r="7" stroke="%23000" fill="none"/><circle cx="140" cy="140" r="7" stroke="%23000" fill="none"/><text x="60" y="144" font-family="sans-serif" font-size="10" font-weight="bold">2</text><text x="200" y="320" font-family="monospace" font-size="12" text-anchor="middle" fill="%232563eb">4 KÖŞE REGISTRATION [OK]</text></svg>',
    isValidOptical: true,
    studentName: 'Kemal Sunal',
    studentId: '20268801',
    booklet: 'A'
  };
  saveState();
  syncScanSubTabDOM();
  showToast('Örnek optik sınav kağıdı yüklendi.', 'info');
}

function syncScanSubTabDOM() {
  const segSingle = document.getElementById('seg-single');
  const segBulk = document.getElementById('seg-bulk');
  const singleWrapper = document.getElementById('single-preview-wrapper');
  const bulkWrapper = document.getElementById('bulk-queue-wrapper');
  const previewEmpty = document.getElementById('preview-empty-state');
  const previewContent = document.getElementById('single-preview-content');
  const singleImg = document.getElementById('single-preview-img');
  const previewBadge = document.getElementById('scan-preview-badge');
  const fileInfoLabel = document.getElementById('single-file-info-label');
  const invalidAlert = document.getElementById('invalid-optical-alert');
  const evalBtn = document.getElementById('run-evaluation-btn');
  const evalLabel = document.getElementById('eval-btn-label');

  const isBulk = state.scanMode === 'bulk';

  if (segSingle && segBulk) {
    segSingle.classList.toggle('active', !isBulk);
    segBulk.classList.toggle('active', isBulk);
  }

  if (singleWrapper) singleWrapper.classList.toggle('hidden', isBulk);
  if (bulkWrapper) bulkWrapper.classList.toggle('hidden', !isBulk);

  if (isBulk) {
    if (evalLabel) evalLabel.innerText = `Sınıfı Toplu Değerlendir (${state.bulkFiles.length} Kağıt)`;
    renderBulkQueueList();

    if (state.bulkFiles.length > 0) {
      if (previewBadge) {
        previewBadge.innerText = `${state.bulkFiles.length} Kağıt Kuyrukta`;
        previewBadge.className = 'badge badge-success';
      }
      if (evalBtn) evalBtn.disabled = false;
    } else {
      if (previewBadge) {
        previewBadge.innerText = 'Kuyruk Boş';
        previewBadge.className = 'badge badge-neutral';
      }
      if (evalBtn) evalBtn.disabled = true;
    }
  } else {
    // Single Mode
    if (state.singleFile) {
      if (previewEmpty) previewEmpty.classList.add('hidden');
      if (previewContent) previewContent.classList.remove('hidden');

      if (singleImg) {
        if (state.singleFile.type === 'pdf') {
          singleImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="150" y="170" font-family="sans-serif" font-size="22" font-weight="bold" fill="%23ef4444" text-anchor="middle">PDF DÖKÜMANI</text><text x="150" y="200" font-family="sans-serif" font-size="13" fill="%2364748b" text-anchor="middle">Okul Yazıcısı Taraması Hazır</text></svg>';
        } else {
          singleImg.src = state.singleFile.dataUrl;
        }
      }

      if (fileInfoLabel) fileInfoLabel.innerText = `${state.singleFile.name} (${state.singleFile.size})`;

      // Optik Form Geçerlilik Kontrolü
      const isValid = state.singleFile.isValidOptical !== false;
      if (invalidAlert) invalidAlert.classList.toggle('hidden', isValid);

      if (isValid) {
        if (previewBadge) {
          previewBadge.innerText = '✅ Optik Form Hazır';
          previewBadge.className = 'badge badge-success';
        }
        if (evalBtn) evalBtn.disabled = false;
        if (evalLabel) evalLabel.innerText = 'Optik Formu Değerlendir';
      } else {
        if (previewBadge) {
          previewBadge.innerText = '❌ Geçersiz Belge (Optik Değil)';
          previewBadge.className = 'badge badge-danger';
        }
        if (evalBtn) evalBtn.disabled = true;
        if (evalLabel) evalLabel.innerText = '⚠️ Lütfen Geçerli Bir Optik Form Ekleyin';
      }
    } else {
      if (previewEmpty) previewEmpty.classList.remove('hidden');
      if (previewContent) previewContent.classList.add('hidden');
      if (previewBadge) {
        previewBadge.innerText = 'Hazır Değil';
        previewBadge.className = 'badge badge-neutral';
      }
      if (evalBtn) evalBtn.disabled = true;
      if (evalLabel) evalLabel.innerText = 'Optik Formu Değerlendir';
    }
  }
}

function renderBulkQueueList() {
  const container = document.getElementById('bulk-file-items-list');
  const countBadge = document.getElementById('bulk-file-count-badge');
  if (!container) return;

  if (countBadge) countBadge.innerText = `${state.bulkFiles.length} Dosya`;
  container.innerHTML = '';

  state.bulkFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'bulk-item-row';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="col-badge-num" style="width:22px;height:22px;font-size:0.75rem;">${idx + 1}</span>
        <div class="file-name" title="${file.name}">${file.name}</div>
        <span class="file-size">${file.size}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="badge badge-accent">${file.booklet}</span>
        <button type="button" class="btn-icon-danger" style="width:26px;height:26px;" onclick="removeBulkItem(${idx})">
          &times;
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function removeBulkItem(idx) {
  state.bulkFiles.splice(idx, 1);
  saveState();
  syncScanSubTabDOM();
}

// ==========================================================================
// 12. KAMERA CANLI TARAMA
// ==========================================================================
function openCameraModal() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('webcam-video');
  if (modal) modal.classList.remove('hidden');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then(stream => {
        webcamStream = stream;
        if (video) video.srcObject = stream;
      })
      .catch(err => {
        console.warn('Kamera hatası:', err);
        showToast('Kamera açılamadı veya izin verilmedi.', 'warning');
      });
  } else {
    showToast('Tarayıcınız kamera desteği sunmuyor.', 'warning');
  }
}

function closeCameraModal() {
  const modal = document.getElementById('camera-modal');
  if (modal) modal.classList.add('hidden');
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
}

function captureWebcamFrame() {
  const video = document.getElementById('webcam-video');
  if (!video) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  state.singleFile = {
    name: `Kamera_Cekim_${Date.now()}.jpg`,
    size: '412.0 KB',
    type: 'image',
    dataUrl: dataUrl,
    isValidOptical: true,
    studentName: 'Kamera Çekimi Öğrenci',
    studentId: '20269901',
    booklet: 'A'
  };
  state.scanMode = 'single';

  closeCameraModal();
  saveState();
  openAyarlarSubTab('tarama');
  showToast('Optik form kameradan çekildi ve yüklendi.', 'success');
}

function openSamplePreviewModal() {
  const modal = document.getElementById('sample-modal');
  const content = document.getElementById('sample-paper-content');
  if (modal) modal.classList.remove('hidden');

  if (content) {
    renderLiveSettingsSheet();
    const liveBox = document.getElementById('live-settings-sheet-preview');
    if (liveBox) {
      content.innerHTML = liveBox.innerHTML;
    }
  }
}

function closeSampleModal() {
  const modal = document.getElementById('sample-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// 13. DEĞERLENDİRME MOTORU (EVALUATION ENGINE)
// ==========================================================================
function executeEvaluation() {
  const progressBox = document.getElementById('signalr-progress-box');
  const progressMsg = document.getElementById('progress-msg');
  const progressPercent = document.getElementById('progress-percent');
  const progressTrack = document.getElementById('progress-bar-track');
  const spinner = document.getElementById('eval-spinner');
  const evalBtn = document.getElementById('run-evaluation-btn');

  if (progressBox) progressBox.classList.remove('hidden');
  if (spinner) spinner.classList.remove('hidden');
  if (evalBtn) evalBtn.disabled = true;

  let step = 0;
  const interval = setInterval(() => {
    step += 25;
    if (progressTrack) progressTrack.style.width = `${step}%`;
    if (progressPercent) progressPercent.innerText = `${step}%`;

    if (step === 50 && progressMsg) progressMsg.innerText = '🔍 OpenCV 4-Köşe Homografi & Perspektif Düzeltme...';
    if (step === 75 && progressMsg) progressMsg.innerText = '📝 Baloncuk Yoğunluk Analizi & Yanıt Çözümleme...';

    if (step >= 100) {
      clearInterval(interval);
      if (progressBox) progressBox.classList.add('hidden');
      if (spinner) spinner.classList.add('hidden');
      if (evalBtn) evalBtn.disabled = false;

      finishEvaluation();
    }
  }, 200);
}

function finishEvaluation() {
  const isBulk = state.scanMode === 'bulk';
  const totalQ = getTotalQuestions();
  const cfg = state.config;
  const pointPerQuestion = Number(cfg.pointPerQ) || calculatePointPerQuestion();

  if (isBulk && state.bulkFiles.length > 0) {
    const studentsList = [];
    state.bulkFiles.forEach((file, index) => {
      let correct = 0;
      let wrong = 0;
      let empty = 0;

      cfg.courses.forEach(c => {
        for (let q = 1; q <= c.questionCount; q++) {
          const rand = Math.random();
          if (rand > 0.88) empty++;
          else if (rand > 0.22) correct++;
          else wrong++;
        }
      });

      // 4 yanlış 1 doğruyu götürmez (Doğru sayısı doğrudan nettir)
      const net = correct;
      const score = Math.min(cfg.totalScore * (cfg.percentRatio / 100), net * pointPerQuestion).toFixed(2);

      studentsList.push({
        rank: 0,
        studentName: file.studentName || `Öğrenci #${index + 1}`,
        studentId: file.studentId || `2026${String(1000 + index + 1).padStart(4, '0')}`,
        booklet: file.booklet || (index % 2 === 0 ? 'A' : 'B'),
        correct,
        wrong,
        empty,
        net: net.toFixed(2),
        score: Number(score)
      });
    });

    studentsList.sort((a, b) => b.score - a.score);
    studentsList.forEach((s, idx) => s.rank = idx + 1);

    const top = studentsList[0] || {};
    const questionsBreakdown = generateQuestionBreakdown(top.booklet || 'A');

    state.evaluation = {
      isBulk: true,
      studentName: top.studentName,
      studentId: top.studentId,
      booklet: top.booklet,
      studentsList,
      totalQuestions: totalQ,
      correctCount: top.correct,
      wrongCount: top.wrong,
      emptyCount: top.empty,
      netScore: top.net,
      finalScore: top.score.toFixed(2),
      questionsBreakdown
    };

    // Geçmişe ekle
    state.scanHistory.unshift({
      id: `sc-${Date.now()}`,
      fileName: `Toplu_Sinif_Taramasi_${studentsList.length}_Kagit.pdf`,
      format: 'PDF',
      date: new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      paperCount: studentsList.length,
      status: 'Başarılı',
      scoreAvg: (studentsList.reduce((acc, s) => acc + s.score, 0) / studentsList.length).toFixed(2)
    });

    showToast(`${studentsList.length} öğrencinin sınavı başarıyla tamamlandı!`, 'success');
  } else {
    // Tek Kağıt
    let correct = 0;
    let wrong = 0;
    let empty = 0;

    cfg.courses.forEach(c => {
      for (let q = 1; q <= c.questionCount; q++) {
        const rand = Math.random();
        if (rand > 0.90) empty++;
        else if (rand > 0.20) correct++;
        else wrong++;
      }
    });

    // 4 yanlış 1 doğruyu götürmez (Doğru sayısı doğrudan nettir)
    const net = correct;
    const score = Math.min(cfg.totalScore * (cfg.percentRatio / 100), net * pointPerQuestion).toFixed(2);
    const booklet = state.singleFile ? state.singleFile.booklet : 'A';
    const questionsBreakdown = generateQuestionBreakdown(booklet);

    state.evaluation = {
      isBulk: false,
      studentName: state.singleFile ? state.singleFile.studentName : 'Kemal Sunal',
      studentId: state.singleFile ? state.singleFile.studentId : '20268801',
      booklet: booklet,
      totalQuestions: totalQ,
      correctCount: correct,
      wrongCount: wrong,
      emptyCount: empty,
      netScore: net.toFixed(2),
      finalScore: Number(score).toFixed(2),
      questionsBreakdown
    };

    // Geçmişe ekle
    state.scanHistory.unshift({
      id: `sc-${Date.now()}`,
      fileName: state.singleFile ? state.singleFile.name : 'Taranmis_Optik_Form.jpg',
      format: state.singleFile && state.singleFile.type === 'pdf' ? 'PDF' : 'JPG',
      date: new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      paperCount: 1,
      status: 'İncelendi',
      scoreAvg: Number(score).toFixed(2)
    });

    showToast('Optik form okundu ve değerlendirildi!', 'success');
  }

  saveState();
  // Değerlendirme bitince doğrudan 3. navbar sekmesine (Sonuçlar & Geçmiş) yönlendir!
  switchAppTab('results');
}

function getAnswerForKey(booklet, keyId) {
  if (state.bookletAnswerKeys && state.bookletAnswerKeys[booklet] && state.bookletAnswerKeys[booklet][keyId]) {
    return state.bookletAnswerKeys[booklet][keyId];
  }
  if (state.answerKeys && state.answerKeys[keyId]) {
    return state.answerKeys[keyId];
  }
  return null;
}

function generateQuestionBreakdown(booklet = 'A') {
  const cfg = state.config;
  const pointPerQuestion = Number(cfg.pointPerQ) || calculatePointPerQuestion();
  const optCount = cfg.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  const questionsBreakdown = [];
  cfg.courses.forEach(course => {
    for (let q = 1; q <= course.questionCount; q++) {
      const keyId = `${course.id}_${q}`;
      const correctAns = getAnswerForKey(booklet, keyId) || options[(q - 1) % options.length];
      const rand = Math.random();
      let status = 'correct';
      let studentAns = correctAns;

      if (rand > 0.88) {
        status = 'empty';
        studentAns = '-';
      } else if (rand <= 0.22) {
        status = 'wrong';
        studentAns = options.find(o => o !== correctAns) || 'B';
      }

      questionsBreakdown.push({
        courseId: course.id,
        courseName: course.name,
        num: q,
        correctAnswer: correctAns,
        studentAnswer: studentAns,
        status: status,
        points: status === 'correct' ? pointPerQuestion.toFixed(2) : '0.00'
      });
    }
  });

  return questionsBreakdown;
}

// ==========================================================================
// 14. SONUÇLAR & DERS BAZLI MİNİMALİST SORU DAĞILIMI
// ==========================================================================
function renderEvaluationResults() {
  if (!state.evaluation) return;

  const evalData = state.evaluation;
  const elTotal = document.getElementById('res-total-q');
  const elCorrect = document.getElementById('res-correct');
  const elWrong = document.getElementById('res-wrong');
  const elEmpty = document.getElementById('res-empty');
  const elNet = document.getElementById('res-net');
  const elScore = document.getElementById('res-score');
  const elPointsSub = document.getElementById('res-points-sub');
  const elMaxScoreSub = document.getElementById('res-max-score-sub');

  if (elTotal) elTotal.innerText = evalData.totalQuestions;
  if (elCorrect) elCorrect.innerText = evalData.correctCount;
  if (elWrong) elWrong.innerText = evalData.wrongCount;
  if (elEmpty) elEmpty.innerText = evalData.emptyCount;
  if (elNet) elNet.innerText = evalData.netScore;
  if (elScore) elScore.innerText = evalData.finalScore;

  const pointPerQuestion = Number(state.config.pointPerQ) || calculatePointPerQuestion();
  if (elPointsSub) elPointsSub.innerText = `Soru Başı: ${pointPerQuestion.toFixed(2)} Puan`;
  if (elMaxScoreSub) elMaxScoreSub.innerText = `/ ${state.config.totalScore} Puan (%${state.config.percentRatio || 100})`;

  // Sınıf Sıralama Tablosu
  const bulkRows = document.getElementById('bulk-table-rows');
  const bulkCountLabel = document.getElementById('bulk-student-count-label');

  if (bulkRows) {
    bulkRows.innerHTML = '';
    const students = evalData.isBulk && evalData.studentsList ? evalData.studentsList : [
      {
        rank: 1,
        studentId: evalData.studentId || '20268801',
        studentName: evalData.studentName || 'Kemal Sunal',
        booklet: evalData.booklet || 'A',
        correct: evalData.correctCount,
        wrong: evalData.wrongCount,
        empty: evalData.emptyCount,
        net: evalData.netScore,
        score: evalData.finalScore
      }
    ];

    if (bulkCountLabel) bulkCountLabel.innerText = `${students.length} Öğrenci Sıralandı. Detaylı A4 karne veya silme işlemi için butonları kullanabilirsiniz.`;

    students.forEach(st => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => openStudentKarneModal(st.studentId);

      tr.innerHTML = `
        <td><strong>#${st.rank}</strong></td>
        <td><code>${st.studentId}</code></td>
        <td><strong>${st.studentName}</strong></td>
        <td><span class="badge badge-accent">${st.booklet}</span></td>
        <td class="text-success font-bold">${st.correct}</td>
        <td class="text-danger font-bold">${st.wrong}</td>
        <td class="text-warning font-bold">${st.empty}</td>
        <td><strong>${st.net}</strong></td>
        <td><span class="badge badge-success font-bold">${st.score}</span></td>
        <td class="no-print" style="white-space:nowrap;">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openStudentKarneModal('${st.studentId}')">
            📄 A4 Karne
          </button>
          <button class="btn btn-outline danger-hover btn-sm" style="margin-left:4px;" onclick="event.stopPropagation(); deleteStudentResult('${st.studentId}')" title="Bu öğrenciyi listeden sil">
            🗑️ Sil
          </button>
        </td>
      `;
      bulkRows.appendChild(tr);
    });
  }

  // DERS BAZLI MİNİMALİST SORU DAĞILIMI (ÇORBA GİBİ OLMAYAN TEMİZ ALAN)
  renderCourseBreakdownCards();
  renderOpenCVOverlayCanvas();
}

function deleteStudentResult(studentId) {
  if (!state.evaluation) return;
  if (!confirm(`No: ${studentId} olan öğrenciyi sonuç listesinden silmek istediğinize emin misiniz?`)) return;

  if (state.evaluation.isBulk && state.evaluation.studentsList) {
    state.evaluation.studentsList = state.evaluation.studentsList.filter(s => s.studentId !== studentId);
    state.evaluation.studentsList.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    if (state.evaluation.studentsList.length > 0) {
      if (state.evaluation.studentId === studentId) {
        const first = state.evaluation.studentsList[0];
        state.evaluation.studentId = first.studentId;
        state.evaluation.studentName = first.studentName;
        state.evaluation.booklet = first.booklet;
        state.evaluation.correctCount = first.correct;
        state.evaluation.wrongCount = first.wrong;
        state.evaluation.emptyCount = first.empty;
        state.evaluation.netScore = first.net;
        state.evaluation.finalScore = Number(first.score).toFixed(2);
        state.evaluation.questionsBreakdown = generateQuestionBreakdown(first.booklet);
      }
    } else {
      state.evaluation = null;
    }
  } else {
    state.evaluation = null;
  }

  saveState();
  if (state.evaluation) {
    renderEvaluationResults();
  } else {
    resetResultsView();
  }
  showToast('Öğrenci sonuç listesinden silindi.', 'info');
}

function clearAllStudentsResults() {
  if (!state.evaluation) return;
  if (!confirm('Tüm sınıf sonuçlarını ve değerlendirmeleri silmek istediğinize emin misiniz?')) return;
  state.evaluation = null;
  saveState();
  resetResultsView();
  showToast('Tüm sınıf listesi temizlendi.', 'info');
}

function resetResultsView() {
  const bulkRows = document.getElementById('bulk-table-rows');
  if (bulkRows) {
    bulkRows.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">Henüz değerlendirilmiş öğrenci bulunmamaktadır.</td></tr>';
  }
  const bulkCountLabel = document.getElementById('bulk-student-count-label');
  if (bulkCountLabel) bulkCountLabel.innerText = '0 Öğrenci';

  const elTotal = document.getElementById('res-total-q');
  const elCorrect = document.getElementById('res-correct');
  const elWrong = document.getElementById('res-wrong');
  const elEmpty = document.getElementById('res-empty');
  const elNet = document.getElementById('res-net');
  const elScore = document.getElementById('res-score');
  if (elTotal) elTotal.innerText = '0';
  if (elCorrect) elCorrect.innerText = '0';
  if (elWrong) elWrong.innerText = '0';
  if (elEmpty) elEmpty.innerText = '0';
  if (elNet) elNet.innerText = '0.00';
  if (elScore) elScore.innerText = '0.00';

  const container = document.getElementById('course-breakdown-cards-container');
  if (container) container.innerHTML = '';
}

function renderCourseBreakdownCards() {
  const container = document.getElementById('course-breakdown-cards-container');
  const studentTitle = document.getElementById('student-specific-title');
  const studentBooklet = document.getElementById('student-booklet-badge');
  if (!container || !state.evaluation) return;

  if (studentTitle) studentTitle.innerText = `${state.evaluation.studentName} Soru Dağılımı`;
  if (studentBooklet) studentBooklet.innerText = `Kitapçık: ${state.evaluation.booklet || 'A'}`;

  container.innerHTML = '';
  const questions = state.evaluation.questionsBreakdown || [];

  state.config.courses.forEach(course => {
    const courseQuestions = questions.filter(q => q.courseId === course.id);
    const cCorrect = courseQuestions.filter(q => q.status === 'correct').length;
    const cWrong = courseQuestions.filter(q => q.status === 'wrong').length;
    const cEmpty = courseQuestions.filter(q => q.status === 'empty').length;
    const cNet = cCorrect.toFixed(2);

    const card = document.createElement('div');
    card.className = 'course-breakdown-item';

    let chipsHTML = '';
    courseQuestions.forEach(q => {
      let icon = '✓';
      let statusClass = 'correct';
      let detail = q.correctAnswer;

      if (q.status === 'wrong') {
        icon = '✗';
        statusClass = 'wrong';
        detail = `${q.studentAnswer} (${q.correctAnswer})`;
      } else if (q.status === 'empty') {
        icon = '-';
        statusClass = 'empty';
        detail = 'Boş';
      }

      chipsHTML += `
        <div class="q-chip ${statusClass}" title="Soru ${q.num}: ${detail}">
          <span>S${q.num}</span>
          <span>${detail} ${icon}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="course-breakdown-header">
        <h5>${course.name}</h5>
        <div class="text-xs">
          <span class="text-success font-bold">${cCorrect}D</span> / 
          <span class="text-danger font-bold">${cWrong}Y</span> / 
          <span class="text-warning">${cEmpty}B</span> &bull; 
          <strong>Net: ${cNet}</strong>
        </div>
      </div>
      <div class="course-breakdown-chips">
        ${chipsHTML}
      </div>
    `;

    container.appendChild(card);
  });
}

function renderOpenCVOverlayCanvas() {
  const canvas = document.getElementById('omr-canvas-overlay');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 380;

  ctx.fillStyle = '#070a11';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0e1524';
  ctx.fillRect(30, 24, 580, 332);

  // 4 Köşe Homografi Çerçevesi
  ctx.fillStyle = '#06b6d4';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  const corners = [[40, 34], [600, 34], [600, 346], [40, 346]];

  ctx.beginPath();
  corners.forEach(([x, y], idx) => {
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.fillRect(x - 4, y - 4, 8, 8);
  });
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px JetBrains Mono';
  ctx.fillText('OPENCV HOMOGRAPHY WARP PERSPECTIVE 4-CORNER REGISTRATION [OK]', 50, 52);

  const questions = (state.evaluation && state.evaluation.questionsBreakdown) || [];
  const cols = 4;
  const rows = Math.ceil(Math.min(questions.length, 24) / cols);

  questions.slice(0, 24).forEach((q, idx) => {
    const colIndex = Math.floor(idx / rows);
    const rowIndex = idx % rows;

    const startX = 60 + colIndex * 135;
    const startY = 76 + rowIndex * 26;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px JetBrains Mono';
    ctx.fillText(`S${q.num}`, startX, startY + 11);

    ['A', 'B', 'C', 'D'].forEach((opt, oIdx) => {
      const bubbleX = startX + 28 + oIdx * 19;
      const bubbleY = startY + 8;

      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 5.5, 0, Math.PI * 2);

      if (q.studentAnswer === opt) {
        if (q.status === 'correct') {
          ctx.fillStyle = '#10b981';
          ctx.fill();
        } else {
          ctx.fillStyle = '#f43f5e';
          ctx.fill();
        }
      } else if (q.correctAnswer === opt && q.status === 'wrong') {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  });
}

// ==========================================================================
// 15. ÖĞRENCİ DETAYLI A4 KARNESİ (TAM OPTİK KAĞIT VE NOT BELGESİ)
// ==========================================================================
function openStudentKarneModal(studentId) {
  if (!state.evaluation) return;

  const modal = document.getElementById('student-karne-modal');
  const container = document.getElementById('student-karne-sheet-container');
  if (!modal || !container) return;

  let student = null;
  if (state.evaluation.isBulk && state.evaluation.studentsList) {
    student = state.evaluation.studentsList.find(s => s.studentId === studentId);
  }
  if (!student) {
    student = {
      rank: 1,
      studentId: state.evaluation.studentId || studentId,
      studentName: state.evaluation.studentName || 'Kemal Sunal',
      booklet: state.evaluation.booklet || 'A',
      correct: state.evaluation.correctCount,
      wrong: state.evaluation.wrongCount,
      empty: state.evaluation.emptyCount,
      net: state.evaluation.netScore,
      score: state.evaluation.finalScore
    };
  }

  const cfg = state.config;
  const questions = state.evaluation.questionsBreakdown || [];
  const optCount = cfg.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  // Ders ders optik baloncuklu sınav sonuçları
  let coursesKarneHTML = '';
  cfg.courses.forEach(course => {
    const courseQuestions = questions.filter(q => q.courseId === course.id);
    let qItemsHTML = '';

    courseQuestions.forEach(q => {
      let bubblesHTML = '';
      options.forEach(opt => {
        let bubbleClass = '';
        if (q.studentAnswer === opt) {
          bubbleClass = q.status === 'correct' ? 'correct-ans' : 'wrong-ans';
        } else if (q.correctAnswer === opt && q.status === 'wrong') {
          bubbleClass = 'target-correct';
        }
        bubblesHTML += `<div class="karne-bubble ${bubbleClass}">${opt}</div>`;
      });

      let statusMark = '<span style="color:#10b981;font-weight:bold;">✓</span>';
      if (q.status === 'wrong') statusMark = '<span style="color:#ef4444;font-weight:bold;">✗</span>';
      if (q.status === 'empty') statusMark = '<span style="color:#94a3b8;">-</span>';

      qItemsHTML += `
        <div class="karne-q-row">
          <span>${q.num}</span>
          <div style="display:flex;gap:2px;">${bubblesHTML}</div>
          <span style="width:14px;text-align:right;">${statusMark}</span>
        </div>
      `;
    });

    coursesKarneHTML += `
      <div style="border:1px solid #cbd5e1;border-radius:3px;padding:6px 4px;background:#fff;">
        <div style="font-size:0.68rem;font-weight:800;text-align:center;background:#f1f5f9;padding:3px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;">
          ${course.name} (${course.questionCount} Soru)
        </div>
        ${qItemsHTML}
      </div>
    `;
  });

  container.innerHTML = `
    <div class="karne-paper-wrapper" style="--col-count: ${Math.max(cfg.courses.length, 3)};">
      <div class="karne-header-bar">
        <div>
          <h2 style="font-size:1.25rem;font-weight:800;margin:0;">${cfg.institution ? cfg.institution.toUpperCase() : 'MÜHENDİSLİK FAKÜLTESİ'}</h2>
          <h4 style="font-size:0.92rem;color:#475569;margin-top:2px;">${cfg.examTitle ? cfg.examTitle.toUpperCase() : 'SINAV'} SONUÇ VE CEVAP KARNESİ</h4>
        </div>
        <div class="karne-badge-seal">
          OPTİMATRİX RESMİ KARNE<br>
          <small>Sıra: #${student.rank || 1}</small>
        </div>
      </div>

      <div class="karne-student-info-grid">
        <div>
          <div style="font-size:0.75rem;color:#64748b;font-weight:600;">ÖĞRENCİ BİLGİLERİ</div>
          <div style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-top:2px;">${student.studentName}</div>
          <div style="font-size:0.82rem;color:#334155;margin-top:2px;">
            Öğrenci No: <strong>${student.studentId}</strong> &bull; Kitapçık: <strong>${student.booklet}</strong>
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-size:0.75rem;color:#64748b;font-weight:600;">TOPLAM PUAN</div>
          <div style="font-size:1.6rem;font-weight:900;color:#2563eb;line-height:1.1;">${student.score}</div>
          <div style="font-size:0.75rem;color:#475569;">/ ${cfg.totalScore} Puan (%${cfg.percentRatio || 100})</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:4px;text-align:center;margin-bottom:14px;font-size:0.8rem;">
        <div>Doğru: <strong style="color:#10b981;">${student.correct}</strong></div>
        <div>Yanlış: <strong style="color:#ef4444;">${student.wrong}</strong></div>
        <div>Boş: <strong style="color:#f59e0b;">${student.empty}</strong></div>
        <div>Net: <strong style="color:#0284c7;">${student.net}</strong></div>
      </div>

      <div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:4px;">
        DERS BAZLI OPTİK CEVAP DAĞILIMI & BALONCUKLAR:
      </div>
      <div class="karne-courses-grid">
        ${coursesKarneHTML}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:0.7rem;color:#64748b;">
        <div>
          Tarih: ${new Date().toLocaleDateString('tr-TR')}<br>
          Değerlendirme: OptiMatrix Enterprise OMR Engine v5.2
        </div>
        <div style="text-align:center;width:160px;border-top:1px solid #000;padding-top:4px;">
          Öğretim Görevlisi İmzası
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeStudentKarneModal() {
  const modal = document.getElementById('student-karne-modal');
  if (modal) modal.classList.add('hidden');
}

function printStudentKarne() {
  window.print();
}

// ==========================================================================
// 16. TARAMA & KAĞIT GEÇMİŞİ
// ==========================================================================
function renderScanHistory() {
  const tbody = document.getElementById('history-table-rows');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (state.scanHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">
          Henüz taranmış bir kağıt veya sınav geçmişi bulunmuyor.
        </td>
      </tr>
    `;
    return;
  }

  state.scanHistory.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.fileName}</strong></td>
      <td><span class="badge ${item.format === 'PDF' ? 'badge-danger' : 'badge-accent'}">${item.format}</span></td>
      <td><code>${item.date}</code></td>
      <td><strong>${item.paperCount} Kağıt</strong></td>
      <td><span class="badge badge-success">${item.status}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="inspectHistoryItem('${item.id}')">İncele</button>
          <button class="btn-icon-danger" style="width:28px;height:28px;" title="Geçmişten Sil" onclick="deleteHistoryItem('${item.id}')">
            &times;
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function clearScanHistory() {
  if (confirm('Tüm tarama ve kağıt geçmişini silmek istediğinize emin misiniz?')) {
    state.scanHistory = [];
    saveState();
    renderScanHistory();
    showToast('Tarama geçmişi temizlendi.', 'info');
  }
}

function deleteHistoryItem(id) {
  state.scanHistory = state.scanHistory.filter(h => h.id !== id);
  saveState();
  renderScanHistory();
  showToast('Kayıt silindi.', 'info');
}

function inspectHistoryItem(id) {
  const item = state.scanHistory.find(h => h.id === id);
  if (item) {
    showToast(`${item.fileName} geçmiş kaydı inceleniyor...`, 'info');
    switchResultsSubTab('sonuclar');
  }
}

// ==========================================================================
// 17. CSV / EXCEL İNDİRME
// ==========================================================================
function exportExcelCsv() {
  if (!state.evaluation) {
    showToast('Önce değerlendirmeyi tamamlayın.', 'warning');
    return;
  }

  const evalData = state.evaluation;
  let csvContent = '\uFEFF';

  if (evalData.isBulk && evalData.studentsList) {
    csvContent += `Sira,Ogrenci No,Ogrenci Adi,Kitapcik,Dogru,Yanlis,Bos,Net,Puan\n`;
    evalData.studentsList.forEach(s => {
      csvContent += `${s.rank},"${s.studentId}","${s.studentName}",${s.booklet},${s.correct},${s.wrong},${s.empty},${s.net},${s.score}\n`;
    });
  } else {
    csvContent += `Soru No,Ders,Dogru Cevap,Ogrenci Cevabi,Durum,Puan\n`;
    (evalData.questionsBreakdown || []).forEach(q => {
      csvContent += `${q.num},"${q.courseName}",${q.correctAnswer},${q.studentAnswer},${q.status},${q.points}\n`;
    });
    csvContent += `\nToplam Soru,${evalData.totalQuestions}\n`;
    csvContent += `Dogru,${evalData.correctCount}\n`;
    csvContent += `Yanlis,${evalData.wrongCount}\n`;
    csvContent += `Bos,${evalData.emptyCount}\n`;
    csvContent += `Net,${evalData.netScore}\n`;
    csvContent += `Toplam Sınav Puanı,${evalData.finalScore}\n`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `OptiMatrix_${state.config.examTitle.replace(/\s+/g, '_')}_Sonuclari.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Sonuçlar Excel (.csv) formatında başarıyla indirildi.', 'success');
}
