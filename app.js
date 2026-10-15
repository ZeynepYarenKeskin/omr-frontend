/**
 * ==========================================================================
 * OPTIMATRIX ENTERPRISE OMR - CORE JAVASCRIPT ENGINE (app.js)
 * Architecture: State Persistence (localStorage), Step-by-Step Locked Wizard,
 * Dynamic Course & Bubble Sheet Builder, OpenCV Perspective Visualizer,
 * Bulk Hangfire/SignalR Simulation, Excel/CSV Export
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. GLOBAL STATE & PERSISTENCE ENGINE
// --------------------------------------------------------------------------
const STORAGE_KEY = 'optimatrix_saas_v3';

const defaultState = {
  view: 'landing', // 'landing' | 'wizard'
  step: 1,        // 1: Config, 2: Key, 3: Scan, 4: Results
  maxUnlockedStep: 1,
  theme: 'dark',
  config: {
    examTitle: 'Matematik 1. Ara Sınav',
    institution: 'Mühendislik Fakültesi',
    totalScore: 100,
    hasBooklet: true,
    hasStudentId: true,
    studentIdDigits: 8,
    hasNameBubbles: true,
    optionCount: 5, // 4 or 5
    penaltyRatio: 4, // 0, 3, or 4
    courses: [
      { id: 1, name: 'Temel Matematik', questionCount: 20 }
    ]
  },
  answerKeys: {}, // { 1: 'A', 2: 'C', ... }
  scanMode: 'single', // 'single' | 'bulk'
  inputMethod: 'file', // 'file' | 'camera'
  singleFile: null, // Data URL
  bulkFiles: [], // Array of { name, size, dataUrl }
  useRealBackend: false,
  evaluation: null // Last evaluated result
};

let state = JSON.parse(JSON.stringify(defaultState));
let webcamStream = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  initTheme();
  setupEventListeners();
  syncUIWithState();
});

function loadPersistedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to prevent missing properties
      state = Object.assign({}, defaultState, parsed);
      state.config = Object.assign({}, defaultState.config, parsed.config || {});
    }
  } catch (err) {
    console.error('State load error:', err);
    state = JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

// --------------------------------------------------------------------------
// 2. THEME ENGINE
// --------------------------------------------------------------------------
function initTheme() {
  const current = state.theme || 'dark';
  applyTheme(current);
}

function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  state.theme = next;
  saveState();
  showToast(`${next === 'dark' ? '🌙 Karanlık' : '☀️ Aydınlık'} tema aktif edildi.`, 'info');
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

// --------------------------------------------------------------------------
// 3. TOAST NOTIFICATIONS
// --------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// --------------------------------------------------------------------------
// 4. VIEW & STEP-BY-STEP WIZARD ROUTING
// --------------------------------------------------------------------------
function startWizard() {
  state.view = 'wizard';
  saveState();
  syncUIWithState();
}

function goHome() {
  state.view = 'landing';
  saveState();
  syncUIWithState();
}

function proceedToStep(step) {
  // Validations before moving to next step
  if (step === 2) {
    syncConfigFromDOM();
    const totalQ = getTotalQuestions();
    if (totalQ <= 0) {
      showToast('Lütfen en az bir ders ve 1 soru ekleyin.', 'error');
      return;
    }
  }

  if (step > state.maxUnlockedStep) {
    state.maxUnlockedStep = step;
  }

  state.step = step;
  saveState();
  syncUIWithState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function jumpToStep(step) {
  if (step > state.maxUnlockedStep) {
    showToast(`Adım ${step}'e geçmeden önce önceki adımları tamamlamalısınız.`, 'error');
    return;
  }
  proceedToStep(step);
}

function confirmResetSession() {
  if (confirm('Tüm sınav ayarları, cevap anahtarı ve değerlendirme sonuçları sıfırlanacak. Devam etmek istiyor musunuz?')) {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(defaultState));
    saveState();
    syncUIWithState();
    showToast('Yeni sınav oturumu başlatıldı.', 'info');
  }
}

// --------------------------------------------------------------------------
// 5. DOM SYNC & STATE BINDING
// --------------------------------------------------------------------------
function syncUIWithState() {
  const landingView = document.getElementById('view-landing');
  const wizardView = document.getElementById('view-wizard');
  const stepperHeader = document.getElementById('wizard-stepper-header');
  const resetBtn = document.getElementById('reset-session-btn');

  if (state.view === 'landing') {
    if (landingView) landingView.classList.remove('hidden');
    if (wizardView) wizardView.classList.add('hidden');
    if (stepperHeader) stepperHeader.style.display = 'none';
    if (resetBtn) resetBtn.classList.add('hidden');
    return;
  }

  // Wizard is active
  if (landingView) landingView.classList.add('hidden');
  if (wizardView) wizardView.classList.remove('hidden');
  if (stepperHeader) stepperHeader.style.display = 'block';
  if (resetBtn) resetBtn.classList.remove('hidden');

  // Update stepper badges in header
  for (let i = 1; i <= 4; i++) {
    const badge = document.getElementById(`step-badge-${i}`);
    if (badge) {
      badge.classList.remove('active', 'completed', 'disabled');
      if (i === state.step) {
        badge.classList.add('active');
      } else if (i < state.step || i <= state.maxUnlockedStep) {
        badge.classList.add('completed');
      } else {
        badge.classList.add('disabled');
      }
    }

    // Toggle step cards
    const stepEl = document.getElementById(`wizard-step-${i}`);
    if (stepEl) {
      if (i === state.step) {
        stepEl.classList.add('active');
        stepEl.classList.remove('hidden');
      } else {
        stepEl.classList.remove('active');
        stepEl.classList.add('hidden');
      }
    }
  }

  // Synchronize step-specific components
  if (state.step === 1) {
    populateStep1DOM();
  } else if (state.step === 2) {
    renderAnswerMatrix();
  } else if (state.step === 3) {
    syncStep3UI();
  } else if (state.step === 4) {
    renderEvaluationResults();
  }
}

function setupEventListeners() {
  // Input changes on Step 1
  const examTitleInput = document.getElementById('cfg-exam-title');
  const institutionInput = document.getElementById('cfg-institution');
  const totalScoreInput = document.getElementById('cfg-total-score');
  const studentDigitsInput = document.getElementById('cfg-studentid-digits');

  if (examTitleInput) examTitleInput.addEventListener('input', () => { state.config.examTitle = examTitleInput.value; saveState(); });
  if (institutionInput) institutionInput.addEventListener('input', () => { state.config.institution = institutionInput.value; saveState(); });
  if (totalScoreInput) totalScoreInput.addEventListener('input', () => { 
    state.config.totalScore = Number(totalScoreInput.value) || 100; 
    updateCourseTotals(); 
    saveState(); 
  });
  if (studentDigitsInput) studentDigitsInput.addEventListener('input', () => {
    state.config.studentIdDigits = Math.max(4, Math.min(12, Number(studentDigitsInput.value) || 8));
    saveState();
  });

  // Drag and drop for upload zone
  const dropZone = document.getElementById('file-drop-zone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processIncomingFiles(files);
      }
    });
  }
}

// --------------------------------------------------------------------------
// 6. STEP 1: DYNAMIC FORM CONFIGURATION & COURSE BUILDER
// --------------------------------------------------------------------------
function populateStep1DOM() {
  const cfg = state.config;
  const examTitleInput = document.getElementById('cfg-exam-title');
  const instInput = document.getElementById('cfg-institution');
  const totalScoreInput = document.getElementById('cfg-total-score');
  const bookletCheckbox = document.getElementById('cfg-has-booklet');
  const studentIdCheckbox = document.getElementById('cfg-has-studentid');
  const nameCheckbox = document.getElementById('cfg-has-namebubbles');
  const digitsInput = document.getElementById('cfg-studentid-digits');
  const optionSelect = document.getElementById('cfg-option-count');
  const penaltySelect = document.getElementById('cfg-penalty-ratio');

  if (examTitleInput) examTitleInput.value = cfg.examTitle || '';
  if (instInput) instInput.value = cfg.institution || '';
  if (totalScoreInput) totalScoreInput.value = cfg.totalScore || 100;
  if (bookletCheckbox) bookletCheckbox.checked = !!cfg.hasBooklet;
  if (studentIdCheckbox) studentIdCheckbox.checked = !!cfg.hasStudentId;
  if (nameCheckbox) nameCheckbox.checked = !!cfg.hasNameBubbles;
  if (digitsInput) digitsInput.value = cfg.studentIdDigits || 8;
  if (optionSelect) optionSelect.value = String(cfg.optionCount || 5);
  if (penaltySelect) penaltySelect.value = String(cfg.penaltyRatio || 4);

  toggleStudentIdConfig();
  renderCourseRows();
}

function syncConfigFromDOM() {
  const cfg = state.config;
  const examTitleInput = document.getElementById('cfg-exam-title');
  const instInput = document.getElementById('cfg-institution');
  const totalScoreInput = document.getElementById('cfg-total-score');
  const bookletCheckbox = document.getElementById('cfg-has-booklet');
  const studentIdCheckbox = document.getElementById('cfg-has-studentid');
  const nameCheckbox = document.getElementById('cfg-has-namebubbles');
  const digitsInput = document.getElementById('cfg-studentid-digits');
  const optionSelect = document.getElementById('cfg-option-count');
  const penaltySelect = document.getElementById('cfg-penalty-ratio');

  if (examTitleInput) cfg.examTitle = examTitleInput.value.trim();
  if (instInput) cfg.institution = instInput.value.trim();
  if (totalScoreInput) cfg.totalScore = Number(totalScoreInput.value) || 100;
  if (bookletCheckbox) cfg.hasBooklet = bookletCheckbox.checked;
  if (studentIdCheckbox) cfg.hasStudentId = studentIdCheckbox.checked;
  if (nameCheckbox) cfg.hasNameBubbles = nameCheckbox.checked;
  if (digitsInput) cfg.studentIdDigits = Number(digitsInput.value) || 8;
  if (optionSelect) cfg.optionCount = Number(optionSelect.value) || 5;
  if (penaltySelect) cfg.penaltyRatio = Number(penaltySelect.value) || 0;

  saveState();
}

function saveWizardState() {
  syncConfigFromDOM();
  updateCourseTotals();
}

function toggleStudentIdConfig() {
  const chk = document.getElementById('cfg-has-studentid');
  const box = document.getElementById('studentid-config-box');
  if (chk && box) {
    state.config.hasStudentId = chk.checked;
    box.style.display = chk.checked ? 'block' : 'none';
    saveState();
  }
}

function onOptionCountChange() {
  const sel = document.getElementById('cfg-option-count');
  if (sel) {
    state.config.optionCount = Number(sel.value);
    saveState();
    showToast(`Optik form ${state.config.optionCount} şıklı (A-${state.config.optionCount === 4 ? 'D' : 'E'}) olarak güncellendi.`, 'info');
  }
}

function renderCourseRows() {
  const container = document.getElementById('course-rows-container');
  if (!container) return;

  container.innerHTML = '';
  let cumulativeQuestions = 0;

  state.config.courses.forEach((course, index) => {
    const startQ = cumulativeQuestions + 1;
    const endQ = cumulativeQuestions + course.questionCount;
    cumulativeQuestions = endQ;

    const row = document.createElement('div');
    row.className = 'course-row-item';
    row.innerHTML = `
      <div class="col-name">
        <input type="text" class="form-input" value="${course.name}" 
               placeholder="Ders Adı" onchange="updateCourseName(${index}, this.value)">
      </div>
      <div class="col-count">
        <input type="number" class="form-input" min="1" max="100" value="${course.questionCount}" 
               onchange="updateCourseQuestions(${index}, this.value)">
      </div>
      <div class="col-range">
        <span>Soru ${startQ} - ${endQ}</span>
      </div>
      <div class="col-actions">
        <button class="btn-icon-danger" title="Dersi Sil" onclick="removeCourseRow(${index})">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  updateCourseTotals();
}

function addNewCourseRow() {
  const newId = (state.config.courses.length > 0 ? Math.max(...state.config.courses.map(c => c.id)) : 0) + 1;
  state.config.courses.push({
    id: newId,
    name: `Ders / Bölüm ${state.config.courses.length + 1}`,
    questionCount: 10
  });
  saveState();
  renderCourseRows();
}

function removeCourseRow(index) {
  if (state.config.courses.length <= 1) {
    showToast('En az bir ders bulunmalıdır.', 'warning');
    return;
  }
  state.config.courses.splice(index, 1);
  saveState();
  renderCourseRows();
}

function updateCourseName(index, val) {
  if (state.config.courses[index]) {
    state.config.courses[index].name = val.trim() || `Ders ${index + 1}`;
    saveState();
  }
}

function updateCourseQuestions(index, val) {
  if (state.config.courses[index]) {
    const count = Math.max(1, Math.min(100, Number(val) || 1));
    state.config.courses[index].questionCount = count;
    saveState();
    renderCourseRows();
  }
}

function getTotalQuestions() {
  return state.config.courses.reduce((sum, c) => sum + (Number(c.questionCount) || 0), 0);
}

function updateCourseTotals() {
  const totalQ = getTotalQuestions();
  const totalScore = Number(state.config.totalScore) || 100;
  const pointsPerQ = totalQ > 0 ? (totalScore / totalQ).toFixed(2) : 0;

  const totalEl = document.getElementById('cfg-total-questions-display');
  const pointsEl = document.getElementById('cfg-points-per-q-display');

  if (totalEl) totalEl.innerText = `${totalQ} Soru`;
  if (pointsEl) pointsEl.innerText = `(Soru başı: ${pointsPerQ} Puan)`;
}

// --------------------------------------------------------------------------
// 7. STEP 2: DYNAMIC ANSWER KEY ENGINE
// --------------------------------------------------------------------------
function renderAnswerMatrix() {
  const container = document.getElementById('answer-matrix-container');
  if (!container) return;

  container.innerHTML = '';
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  let qIndex = 1;
  let totalAnswered = 0;
  const totalQuestions = getTotalQuestions();

  const summaryDesc = document.getElementById('step-2-summary-desc');
  if (summaryDesc) {
    summaryDesc.innerText = `${state.config.examTitle || 'Sınav'} için ${totalQuestions} soru ve ${optCount} seçenekli (A-${options[options.length - 1]}) cevap anahtarını belirleyin.`;
  }

  state.config.courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'course-matrix-card';

    const title = document.createElement('div');
    title.className = 'course-matrix-title';
    title.innerHTML = `
      <strong>${course.name}</strong>
      <span>${course.questionCount} Soru</span>
    `;
    card.appendChild(title);

    const questionsList = document.createElement('div');
    questionsList.className = 'course-questions-list';

    for (let i = 0; i < course.questionCount; i++) {
      const currQ = qIndex++;
      const currentSelected = state.answerKeys[currQ] || null;
      if (currentSelected) totalAnswered++;

      const row = document.createElement('div');
      row.className = 'answer-q-row';

      let bubblesHTML = '';
      options.forEach(opt => {
        const isActive = currentSelected === opt ? 'active' : '';
        bubblesHTML += `
          <button type="button" class="bubble-btn ${isActive}" 
                  onclick="selectBubbleAnswer(${currQ}, '${opt}')">${opt}</button>
        `;
      });

      row.innerHTML = `
        <span class="q-number">Q${currQ}</span>
        <div class="bubbles-group">
          ${bubblesHTML}
        </div>
      `;
      questionsList.appendChild(row);
    }

    card.appendChild(questionsList);
    container.appendChild(card);
  });

  const counterPill = document.getElementById('answered-counter-pill');
  if (counterPill) {
    counterPill.innerText = `${totalAnswered} / ${totalQuestions} Soru İşaretlendi`;
  }
}

function selectBubbleAnswer(qNum, option) {
  if (state.answerKeys[qNum] === option) {
    delete state.answerKeys[qNum];
  } else {
    state.answerKeys[qNum] = option;
  }
  saveState();
  renderAnswerMatrix();
}

function randomizeAnswerKey() {
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const totalQ = getTotalQuestions();

  for (let i = 1; i <= totalQ; i++) {
    const randomOpt = options[Math.floor(Math.random() * options.length)];
    state.answerKeys[i] = randomOpt;
  }
  saveState();
  renderAnswerMatrix();
  showToast('Cevap anahtarı rastgele dolduruldu.', 'info');
}

function clearAnswerKey() {
  state.answerKeys = {};
  saveState();
  renderAnswerMatrix();
  showToast('Cevap anahtarı temizlendi.', 'info');
}

function triggerScannedKeyUpload() {
  const input = document.getElementById('scanned-key-file-input');
  if (input) input.click();
}

function handleScannedKeyFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  showToast('Öğretmen optik formu taranıyor...', 'info');
  setTimeout(() => {
    randomizeAnswerKey();
    showToast('Öğretmen kağıdındaki cevaplar başarıyla okundu ve yüklendi.', 'success');
  }, 900);
}

// --------------------------------------------------------------------------
// 8. STEP 3: SCANNER, WEBCAM & BATCH UPLOAD ENGINE
// --------------------------------------------------------------------------
function setScanMode(mode) {
  state.scanMode = mode;
  saveState();
  syncStep3UI();
}

function switchScanInputMethod(method) {
  state.inputMethod = method;
  if (method === 'camera') {
    startWebcam();
  } else {
    stopWebcam();
  }
  syncStep3UI();
}

function syncStep3UI() {
  const segSingle = document.getElementById('seg-single');
  const segBulk = document.getElementById('seg-bulk');
  const subFile = document.getElementById('subtab-file');
  const subCam = document.getElementById('subtab-camera');
  const panelFile = document.getElementById('scan-file-panel');
  const panelCam = document.getElementById('scan-camera-panel');
  const singlePreview = document.getElementById('single-preview-wrapper');
  const bulkQueue = document.getElementById('bulk-queue-wrapper');
  const previewTitle = document.getElementById('preview-title');
  const previewBadge = document.getElementById('preview-badge');
  const evalBtn = document.getElementById('run-evaluation-btn');
  const evalLabel = document.getElementById('eval-btn-label');
  const dropTitle = document.getElementById('drop-zone-title');
  const dropSubtitle = document.getElementById('drop-zone-subtitle');

  if (segSingle && segBulk) {
    if (state.scanMode === 'single') {
      segSingle.classList.add('active');
      segBulk.classList.remove('active');
      if (singlePreview) singlePreview.classList.remove('hidden');
      if (bulkQueue) bulkQueue.classList.add('hidden');
      if (previewTitle) previewTitle.innerText = 'Tek Kağıt Önizlemesi';
      if (evalLabel) evalLabel.innerText = 'Optik Formu Değerlendir';
      if (dropTitle) dropTitle.innerText = 'Optik Form Görselini Seçin veya Sürükleyin';
      if (dropSubtitle) dropSubtitle.innerText = 'JPG, PNG veya WEBP formatında taranmış tek form';
    } else {
      segSingle.classList.remove('active');
      segBulk.classList.add('active');
      if (singlePreview) singlePreview.classList.add('hidden');
      if (bulkQueue) bulkQueue.classList.remove('hidden');
      if (previewTitle) previewTitle.innerText = 'Toplu Kağıt Kuyruğu';
      if (evalLabel) evalLabel.innerText = `Sınıfı Toplu Değerlendir (${state.bulkFiles.length} Kağıt)`;
      if (dropTitle) dropTitle.innerText = 'Tüm Sınıfın Kağıtlarını Toplu Seçin veya Sürükleyin';
      if (dropSubtitle) dropSubtitle.innerText = 'Çoklu resim seçebilir veya sürükleyebilirsiniz';
    }
  }

  // Subtabs
  if (subFile && subCam) {
    if (state.inputMethod === 'file') {
      subFile.classList.add('active');
      subCam.classList.remove('active');
      if (panelFile) panelFile.classList.remove('hidden');
      if (panelCam) panelCam.classList.add('hidden');
    } else {
      subFile.classList.remove('active');
      subCam.classList.add('active');
      if (panelFile) panelFile.classList.add('hidden');
      if (panelCam) panelCam.classList.remove('hidden');
    }
  }

  // Preview elements
  const singleImg = document.getElementById('single-preview-img');
  const emptyState = document.getElementById('preview-empty-state');

  if (state.scanMode === 'single') {
    if (state.singleFile) {
      if (singleImg) { singleImg.src = state.singleFile; singleImg.classList.remove('hidden'); }
      if (emptyState) emptyState.classList.add('hidden');
      if (previewBadge) { previewBadge.innerText = 'Kağıt Hazır'; previewBadge.className = 'badge badge-success'; }
      if (evalBtn) evalBtn.disabled = false;
    } else {
      if (singleImg) singleImg.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (previewBadge) { previewBadge.innerText = 'Bekleniyor'; previewBadge.className = 'badge badge-neutral'; }
      if (evalBtn) evalBtn.disabled = true;
    }
  } else {
    // Bulk mode
    renderBulkQueueList();
    if (state.bulkFiles.length > 0) {
      if (previewBadge) { previewBadge.innerText = `${state.bulkFiles.length} Kağıt Hazır`; previewBadge.className = 'badge badge-success'; }
      if (evalBtn) evalBtn.disabled = false;
    } else {
      if (previewBadge) { previewBadge.innerText = 'Kuyruk Boş'; previewBadge.className = 'badge badge-neutral'; }
      if (evalBtn) evalBtn.disabled = true;
    }
  }
}

function handleFileInputChange(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    processIncomingFiles(files);
  }
}

function processIncomingFiles(fileList) {
  if (state.scanMode === 'single') {
    const file = fileList[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      state.singleFile = e.target.result;
      saveState();
      syncStep3UI();
      showToast(`${file.name} başarıyla yüklendi.`, 'success');
    };
    reader.readAsDataURL(file);
  } else {
    // Bulk mode
    let loadedCount = 0;
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        state.bulkFiles.push({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          dataUrl: e.target.result
        });
        loadedCount++;
        if (loadedCount === fileList.length) {
          saveState();
          syncStep3UI();
          showToast(`${loadedCount} adet sınav kağıdı toplu kuyruğa eklendi.`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });
  }
}

function renderBulkQueueList() {
  const listEl = document.getElementById('bulk-file-items-list');
  const countBadge = document.getElementById('bulk-file-count-badge');
  if (!listEl) return;

  listEl.innerHTML = '';
  if (countBadge) countBadge.innerText = `${state.bulkFiles.length} Dosya`;

  if (state.bulkFiles.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <p>Toplu kuyrukta henüz kağıt yok.</p>
        <button class="btn btn-outline btn-sm" onclick="loadSyntheticBulkBatch()">Örnek Sınıf Paketi Yükle (12 Öğrenci)</button>
      </div>
    `;
    return;
  }

  state.bulkFiles.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'bulk-item-row';
    item.innerHTML = `
      <span class="file-name">📄 ${f.name}</span>
      <span class="file-size">${f.size}</span>
    `;
    listEl.appendChild(item);
  });
}

function loadSyntheticSampleForm() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 800);

  // 4 Corner markers (Homography target)
  ctx.fillStyle = '#000000';
  ctx.fillRect(20, 20, 24, 24);
  ctx.fillRect(556, 20, 24, 24);
  ctx.fillRect(20, 756, 24, 24);
  ctx.fillRect(556, 756, 24, 24);

  // Header Title
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(state.config.examTitle || 'Optik Sınav Kağıdı', 300, 60);
  ctx.font = '13px Arial';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(state.config.institution || 'Mühendislik Fakültesi', 300, 82);

  // Drawing bubbles
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px Arial';
  for (let q = 1; q <= Math.min(25, getTotalQuestions()); q++) {
    const y = 140 + q * 22;
    ctx.fillText(`${q}.`, 180, y);
    ['A', 'B', 'C', 'D', 'E'].forEach((letter, i) => {
      const x = 210 + i * 26;
      ctx.beginPath();
      ctx.arc(x, y - 4, 7, 0, Math.PI * 2);
      // Random fill
      if (Math.random() > 0.45 && Math.random() < 0.65) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
    });
  }

  state.singleFile = canvas.toDataURL('image/png');
  saveState();
  syncStep3UI();
  showToast('Örnek optik form kağıdı hazırlandı.', 'success');
}

function loadSyntheticBulkBatch() {
  state.bulkFiles = [];
  const names = [
    'Ali Yılmaz (2026001)', 'Zeynep Kaya (2026002)', 'Emre Demir (2026003)', 
    'Selin Arslan (2026004)', 'Burak Çelik (2026005)', 'Ece Aydın (2026006)',
    'Caner Şahin (2026007)', 'Merve Koç (2026008)', 'Oğuz Kurt (2026009)',
    'Ayşe Yıldız (2026010)', 'Kerem Öz (2026011)', 'Büşra Doğan (2026012)'
  ];

  names.forEach((studentName, i) => {
    state.bulkFiles.push({
      name: `ogrenci_form_${1001 + i}.png`,
      size: `${(42 + Math.random() * 8).toFixed(1)} KB`,
      studentName: studentName,
      studentId: `2026${String(1001 + i).padStart(4, '0')}`,
      booklet: ['A', 'B', 'A', 'A', 'B', 'C'][i % 6]
    });
  });

  saveState();
  syncStep3UI();
  showToast('12 öğrencilik örnek sınıf paketi yüklendi.', 'success');
}

// Webcam handling
async function startWebcam() {
  const video = document.getElementById('webcam-video');
  if (!video) return;

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = webcamStream;
    showToast('Kamera açıldı. 4 siyah köşe işaretini çerçeveye hizalayın.', 'info');
  } catch (err) {
    showToast('Kamera erişimi sağlanamadı. Lütfen izin verin.', 'error');
  }
}

function captureWebcamFrame() {
  const video = document.getElementById('webcam-video');
  if (!video || !webcamStream) {
    showToast('Lütfen önce kamerayı başlatın.', 'warning');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  state.singleFile = canvas.toDataURL('image/jpeg');
  saveState();
  stopWebcam();
  switchScanInputMethod('file');
  showToast('Optik form fotoğrafı çekildi ve hizalandı.', 'success');
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
}

function toggleBackendConfig() {
  const chk = document.getElementById('backend-toggle');
  if (chk) {
    state.useRealBackend = chk.checked;
    saveState();
    showToast(state.useRealBackend ? 'Canlı C# .NET API bağlantısı aktif.' : 'Yerel simülasyon motoru devrede.', 'info');
  }
}

// --------------------------------------------------------------------------
// 9. EVALUATION & SIGNALR / QUEUE ENGINE
// --------------------------------------------------------------------------
function executeEvaluation() {
  const btn = document.getElementById('run-evaluation-btn');
  const spinner = document.getElementById('eval-spinner');
  const progressBox = document.getElementById('signalr-progress-box');
  const progressTrack = document.getElementById('progress-bar-track');
  const progressMsg = document.getElementById('progress-msg');
  const progressPct = document.getElementById('progress-percent');

  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');

  if (state.scanMode === 'bulk') {
    // Toplu Okuma Hangfire & SignalR simülasyonu
    if (progressBox) progressBox.classList.remove('hidden');
    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += 15;
      if (progressTrack) progressTrack.style.width = `${Math.min(100, currentPct)}%`;
      if (progressPct) progressPct.innerText = `${Math.min(100, currentPct)}%`;
      if (progressMsg) progressMsg.innerText = `⏳ Kağıtlar işleniyor: ${Math.min(state.bulkFiles.length, Math.ceil(currentPct / 100 * state.bulkFiles.length))} / ${state.bulkFiles.length} tamamlandı...`;

      if (currentPct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          if (spinner) spinner.classList.add('hidden');
          if (progressBox) progressBox.classList.add('hidden');
          finalizeBulkEvaluation();
        }, 400);
      }
    }, 280);
  } else {
    // Tekli kağıt okuma
    setTimeout(() => {
      if (spinner) spinner.classList.add('hidden');
      finalizeSingleEvaluation();
    }, 700);
  }
}

function finalizeSingleEvaluation() {
  const totalQ = getTotalQuestions();
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const penaltyRatio = Number(state.config.penaltyRatio) || 0;
  const totalExamScore = Number(state.config.totalScore) || 100;

  let correctCount = 0;
  let wrongCount = 0;
  let emptyCount = 0;
  const questionsBreakdown = [];

  let qNumber = 1;
  state.config.courses.forEach(course => {
    for (let i = 0; i < course.questionCount; i++) {
      const qNum = qNumber++;
      const correctAns = state.answerKeys[qNum] || options[Math.floor(Math.random() * options.length)];
      
      // Simulated student bubble response
      const dice = Math.random();
      let studentAns = null;
      let status = 'empty';

      if (dice > 0.15) {
        // Answered
        if (dice > 0.45) {
          studentAns = correctAns;
          status = 'correct';
          correctCount++;
        } else {
          const wrongOptions = options.filter(o => o !== correctAns);
          studentAns = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          status = 'wrong';
          wrongCount++;
        }
      } else {
        emptyCount++;
      }

      questionsBreakdown.push({
        num: qNum,
        courseName: course.name,
        correctAnswer: correctAns,
        studentAnswer: studentAns || '-',
        status: status,
        points: status === 'correct' ? (totalExamScore / totalQ).toFixed(2) : '0.00'
      });
    }
  });

  const penaltyDrop = penaltyRatio > 0 ? (wrongCount / penaltyRatio) : 0;
  const netScore = Math.max(0, correctCount - penaltyDrop);
  const finalScore = ((netScore / totalQ) * totalExamScore).toFixed(2);

  state.evaluation = {
    isBulk: false,
    studentName: 'Bireysel Öğrenci Formu',
    studentId: '20269999',
    booklet: 'A',
    totalQuestions: totalQ,
    correctCount,
    wrongCount,
    emptyCount,
    netScore: netScore.toFixed(2),
    finalScore,
    questionsBreakdown
  };

  saveState();
  proceedToStep(4);
  showToast('Optik form başarıyla değerlendirildi!', 'success');
}

function finalizeBulkEvaluation() {
  const totalQ = getTotalQuestions();
  const optCount = state.config.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const penaltyRatio = Number(state.config.penaltyRatio) || 0;
  const totalExamScore = Number(state.config.totalScore) || 100;

  const studentsList = [];
  const files = state.bulkFiles.length > 0 ? state.bulkFiles : [
    { studentName: 'Ali Yılmaz', studentId: '20261001', booklet: 'A' },
    { studentName: 'Zeynep Kaya', studentId: '20261002', booklet: 'B' }
  ];

  files.forEach((file, index) => {
    let correct = 0;
    let wrong = 0;
    let empty = 0;

    for (let q = 1; q <= totalQ; q++) {
      const roll = Math.random();
      if (roll > 0.85) empty++;
      else if (roll > 0.35) correct++;
      else wrong++;
    }

    const penaltyDrop = penaltyRatio > 0 ? (wrong / penaltyRatio) : 0;
    const net = Math.max(0, correct - penaltyDrop);
    const score = ((net / totalQ) * totalExamScore).toFixed(2);

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

  // Sort by score desc for ranking
  studentsList.sort((a, b) => b.score - a.score);
  studentsList.forEach((s, idx) => s.rank = idx + 1);

  // Generate breakdown for the top student
  const top = studentsList[0] || {};
  const questionsBreakdown = [];
  let qNum = 1;
  state.config.courses.forEach(course => {
    for (let i = 0; i < course.questionCount; i++) {
      const q = qNum++;
      const correctAns = state.answerKeys[q] || options[0];
      const status = Math.random() > 0.25 ? 'correct' : 'wrong';
      questionsBreakdown.push({
        num: q,
        courseName: course.name,
        correctAnswer: correctAns,
        studentAnswer: status === 'correct' ? correctAns : 'B',
        status: status,
        points: status === 'correct' ? (totalExamScore / totalQ).toFixed(2) : '0.00'
      });
    }
  });

  state.evaluation = {
    isBulk: true,
    studentsList,
    selectedStudent: top,
    totalQuestions: totalQ,
    correctCount: top.correct,
    wrongCount: top.wrong,
    emptyCount: top.empty,
    netScore: top.net,
    finalScore: top.score.toFixed(2),
    questionsBreakdown
  };

  saveState();
  proceedToStep(4);
  showToast(`${studentsList.length} öğrencinin sınavı başarıyla tamamlandı!`, 'success');
}

// --------------------------------------------------------------------------
// 10. STEP 4: RESULTS, METRICS & VISUALIZER ENGINE
// --------------------------------------------------------------------------
function renderEvaluationResults() {
  if (!state.evaluation) return;

  const evalData = state.evaluation;
  const examTitleEl = document.getElementById('results-exam-title-display');
  if (examTitleEl) {
    examTitleEl.innerText = `${state.config.examTitle || 'Sınav'} - ${evalData.isBulk ? 'Toplu Sınıf Analizi' : evalData.studentName}`;
  }

  // Metric cards
  const elTotal = document.getElementById('res-total-q');
  const elCorrect = document.getElementById('res-correct');
  const elWrong = document.getElementById('res-wrong');
  const elEmpty = document.getElementById('res-empty');
  const elNet = document.getElementById('res-net');
  const elScore = document.getElementById('res-score');
  const elPointsSub = document.getElementById('res-points-sub');
  const elPenaltySub = document.getElementById('res-penalty-sub');
  const elMaxScoreSub = document.getElementById('res-max-score-sub');

  if (elTotal) elTotal.innerText = evalData.totalQuestions;
  if (elCorrect) elCorrect.innerText = evalData.correctCount;
  if (elWrong) elWrong.innerText = evalData.wrongCount;
  if (elEmpty) elEmpty.innerText = evalData.emptyCount;
  if (elNet) elNet.innerText = evalData.netScore;
  if (elScore) elScore.innerText = evalData.finalScore;

  const totalScore = Number(state.config.totalScore) || 100;
  const ptsPerQ = (totalScore / evalData.totalQuestions).toFixed(2);
  if (elPointsSub) elPointsSub.innerText = `Soru başı: ${ptsPerQ} Puan`;
  if (elPenaltySub) elPenaltySub.innerText = state.config.penaltyRatio > 0 ? `${state.config.penaltyRatio} Yanlış 1 Doğruyu Götürür` : 'Net kesintisi yok';
  if (elMaxScoreSub) elMaxScoreSub.innerText = `/ ${totalScore} Tam Puan`;

  // Bulk ranking section
  const bulkSection = document.getElementById('bulk-ranking-section');
  const bulkRows = document.getElementById('bulk-table-rows');
  const bulkCountLabel = document.getElementById('bulk-student-count-label');

  if (evalData.isBulk && evalData.studentsList && bulkSection && bulkRows) {
    bulkSection.classList.remove('hidden');
    bulkRows.innerHTML = '';
    if (bulkCountLabel) bulkCountLabel.innerText = `${evalData.studentsList.length} Öğrenci Değerlendirildi`;

    evalData.studentsList.forEach(st => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${st.rank}</strong></td>
        <td><code>${st.studentId}</code></td>
        <td>${st.studentName}</td>
        <td><span class="badge badge-accent">${st.booklet}</span></td>
        <td class="text-success font-bold">${st.correct}</td>
        <td class="text-danger">${st.wrong}</td>
        <td class="text-warning">${st.empty}</td>
        <td><strong>${st.net}</strong></td>
        <td><span class="badge badge-success font-bold">${st.score}</span></td>
        <td class="no-print">
          <button class="btn btn-outline btn-sm" onclick="inspectStudentReport('${st.studentId}')">Karne</button>
        </td>
      `;
      bulkRows.appendChild(tr);
    });
  } else if (bulkSection) {
    bulkSection.classList.add('hidden');
  }

  // Question breakdown table
  const qRows = document.getElementById('question-breakdown-rows');
  const studentTitle = document.getElementById('student-specific-title');
  const studentBooklet = document.getElementById('student-booklet-badge');

  if (studentTitle) studentTitle.innerText = evalData.studentName || 'Öğrenci Soru Dağılımı';
  if (studentBooklet) studentBooklet.innerText = `Kitapçık: ${evalData.booklet || 'A'}`;

  if (qRows && evalData.questionsBreakdown) {
    qRows.innerHTML = '';
    evalData.questionsBreakdown.forEach(item => {
      const tr = document.createElement('tr');
      let statusBadge = '<span class="badge badge-neutral">Boş</span>';
      if (item.status === 'correct') statusBadge = '<span class="badge badge-success">Doğru</span>';
      if (item.status === 'wrong') statusBadge = '<span class="badge badge-danger">Yanlış</span>';

      tr.innerHTML = `
        <td><strong>${item.num}</strong></td>
        <td>${item.courseName}</td>
        <td><code>${item.correctAnswer}</code></td>
        <td><code>${item.studentAnswer}</code></td>
        <td>${statusBadge}</td>
        <td>+${item.points}</td>
      `;
      qRows.appendChild(tr);
    });
  }

  // Draw OpenCV canvas overlay
  renderOpenCVOverlayCanvas();
}

function inspectStudentReport(studentId) {
  if (!state.evaluation || !state.evaluation.studentsList) return;
  const found = state.evaluation.studentsList.find(s => s.studentId === studentId);
  if (found) {
    state.evaluation.studentName = found.studentName;
    state.evaluation.studentId = found.studentId;
    state.evaluation.booklet = found.booklet;
    state.evaluation.correctCount = found.correct;
    state.evaluation.wrongCount = found.wrong;
    state.evaluation.emptyCount = found.empty;
    state.evaluation.netScore = found.net;
    state.evaluation.finalScore = found.score.toFixed(2);
    renderEvaluationResults();
    showToast(`${found.studentName} karnesi yüklendi.`, 'info');
  }
}

function renderOpenCVOverlayCanvas() {
  const canvas = document.getElementById('omr-canvas-overlay');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 420;

  // Background simulating transformed optical sheet
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Optical grid simulation
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 30, 560, 360);

  // 4 Corner Homography points
  ctx.fillStyle = '#06b6d4';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  const corners = [
    [50, 40], [590, 40], [590, 380], [50, 380]
  ];
  
  ctx.beginPath();
  corners.forEach(([x, y], idx) => {
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.fillRect(x - 4, y - 4, 8, 8);
  });
  ctx.closePath();
  ctx.stroke();

  // Grid title
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px JetBrains Mono';
  ctx.fillText('HOMOGRAPHY PERSPECTIVE WARP 4-CORNER REGISTRATION [OK]', 60, 55);

  // Render bubbles
  const questions = (state.evaluation && state.evaluation.questionsBreakdown) || [];
  const cols = 4;
  const rows = Math.ceil(Math.min(questions.length, 24) / cols);

  questions.slice(0, 24).forEach((q, idx) => {
    const colIndex = Math.floor(idx / rows);
    const rowIndex = idx % rows;

    const startX = 70 + colIndex * 135;
    const startY = 85 + rowIndex * 28;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.fillText(`Q${q.num}`, startX, startY + 12);

    ['A', 'B', 'C', 'D'].forEach((opt, oIdx) => {
      const bubbleX = startX + 32 + oIdx * 20;
      const bubbleY = startY + 8;

      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 6.5, 0, Math.PI * 2);

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
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  });
}

// --------------------------------------------------------------------------
// 11. DYNAMIC A4 OPTICAL SHEET GENERATOR & PRINT MODAL
// --------------------------------------------------------------------------
function openLiveFormPreviewModal() {
  syncConfigFromDOM();
  generateA4PaperContent();
  const modal = document.getElementById('sheet-preview-modal');
  if (modal) modal.classList.remove('hidden');
}

function openSamplePreviewModal() {
  generateA4PaperContent();
  const modal = document.getElementById('sheet-preview-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeSheetPreviewModal() {
  const modal = document.getElementById('sheet-preview-modal');
  if (modal) modal.classList.add('hidden');
}

function generateA4PaperContent() {
  const container = document.getElementById('dynamic-paper-content');
  if (!container) return;

  const cfg = state.config;
  const optCount = cfg.optionCount || 5;
  const options = optCount === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const digits = cfg.studentIdDigits || 8;

  let bubblesOptionsHTML = options.map(o => `<div class="paper-circle">${o}</div>`).join('');

  let coursesColumnsHTML = '';
  let qCounter = 1;

  cfg.courses.forEach(course => {
    let qItemsHTML = '';
    for (let i = 0; i < course.questionCount; i++) {
      const qNum = qCounter++;
      qItemsHTML += `
        <div class="paper-q-item">
          <span>${qNum}</span>
          <div class="paper-q-bubbles">
            ${bubblesOptionsHTML}
          </div>
        </div>
      `;
    }

    coursesColumnsHTML += `
      <div class="paper-section-col">
        <div class="paper-col-header">${course.name} (${course.questionCount} Soru)</div>
        ${qItemsHTML}
      </div>
    `;
  });

  // Student ID columns 0-9
  let studentIdGridHTML = '';
  if (cfg.hasStudentId) {
    let digitColsHTML = '';
    for (let d = 1; d <= digits; d++) {
      let numBubbles = '';
      for (let n = 0; n <= 9; n++) {
        numBubbles += `<div class="paper-circle" style="width:13px;height:13px;font-size:0.55rem;margin:2px 0;">${n}</div>`;
      }
      digitColsHTML += `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:14px;height:16px;border:1px solid #000;margin-bottom:4px;"></div>
          ${numBubbles}
        </div>
      `;
    }

    studentIdGridHTML = `
      <div class="paper-meta-box">
        <div class="paper-meta-box-title">ÖĞRENCİ NUMARASI (${digits} Hane)</div>
        <div style="display:flex;gap:4px;justify-content:center;">
          ${digitColsHTML}
        </div>
      </div>
    `;
  }

  // Student Name Matrix or lines
  let studentInfoHTML = `
    <div class="paper-meta-box">
      <div class="paper-meta-box-title">ÖĞRENCİ BİLGİLERİ</div>
      <div class="paper-bubble-row">
        <label>AD SOYAD:</label>
        <div style="flex:1;border-bottom:1px solid #000;height:18px;"></div>
      </div>
      <div class="paper-bubble-row">
        <label>SINIF / ŞB:</label>
        <div style="flex:1;border-bottom:1px solid #000;height:18px;"></div>
      </div>
      ${cfg.hasBooklet ? `
        <div class="paper-bubble-row" style="margin-top:10px;">
          <label>KİTAPÇIK:</label>
          <div style="display:flex;gap:8px;">
            <div class="paper-circle">A</div>
            <div class="paper-circle">B</div>
            <div class="paper-circle">C</div>
            <div class="paper-circle">D</div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = `
    <!-- 4 Homography Corner Registration Squares -->
    <div class="omr-corner-marker tl"></div>
    <div class="omr-corner-marker tr"></div>
    <div class="omr-corner-marker bl"></div>
    <div class="omr-corner-marker br"></div>

    <div class="paper-sheet-header">
      <h2>${cfg.institution || 'KURUM ADI'}</h2>
      <h4>${cfg.examTitle || 'SINAV BAŞLIĞI'} OPTİK CEVAP FORMU</h4>
      <div style="font-size:0.75rem;color:#6b7280;margin-top:4px;">
        Format: ${optCount} Şıklı (A-${options[options.length - 1]}) | Toplam ${getTotalQuestions()} Soru | ${cfg.totalScore} Puan
      </div>
    </div>

    <div class="paper-meta-grid">
      ${studentInfoHTML}
      ${studentIdGridHTML}
    </div>

    <div class="paper-questions-grid">
      ${coursesColumnsHTML}
    </div>

    <div style="margin-top:20px;padding-top:10px;border-top:1px dashed #9ca3af;font-size:0.68rem;text-align:center;color:#6b7280;">
      Kodlamaları siyah kurşun kalemle, taşırmadan doldurunuz. OptiMatrix SaaS Engine v2.4
    </div>
  `;
}

function printGeneratedSheet() {
  const modal = document.getElementById('sheet-preview-modal');
  if (modal) modal.classList.add('printing');
  window.print();
  if (modal) modal.classList.remove('printing');
}

// --------------------------------------------------------------------------
// 12. EXPORT (CSV / EXCEL)
// --------------------------------------------------------------------------
function exportExcelCsv() {
  if (!state.evaluation) {
    showToast('Önce sınav değerlendirmesini tamamlayın.', 'warning');
    return;
  }

  const evalData = state.evaluation;
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Turkish chars

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
    csvContent += `Toplam Puan,${evalData.finalScore}\n`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `OptiMatrix_${state.config.examTitle.replace(/\s+/g, '_')}_Sonuclari.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Sonuçlar Excel (.csv) formatında indirildi.', 'success');
}
