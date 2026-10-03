/**
 * ==========================================================================
 * OPTIMATRIX OMR - JAVASCRIPT MOTORU (app.js)
 * C# (.NET 10) ASP.NET Core Web API & SignalR Entegrasyonlu Ön Yüz Motoru
 * ==========================================================================
 */

// Uygulama Durum Yönetimi (State)
const state = {
  currentUser: null,
  activeSection: 'login',
  theme: 'dark',
  uploadMode: 'single', // 'single' (Tek Kağıt) | 'bulk' (Toplu Kağıt)
  keyMode: 'manual',    // 'manual' (Elle) | 'scanned' (Taranan Formdan)
  selectedFiles: [],    // Yüklenen kağıtlar listesi
  videoStream: null,
  selectedImageBase64: null,
  selectedTemplate: 'tpl_standard_20',
  currentQuestionCount: 20,
  currentOptionCount: 5,
  answerKeys: {},
  activeKeyId: 'default',
  currentAnswerKey: {},
  singleEvaluation: null,
  bulkEvaluations: [],
  historyExams: [],
  signalrConnection: null,
  apiConfig: {
    useRealBackend: false,
    endpointUrl: 'https://localhost:7001/api/exams/evaluate',
    signalrHubUrl: 'https://localhost:7001/examHub',
    jwtToken: 'demo_bearer_jwt_token_2026'
  }
};

const OPTIONS = ['A', 'B', 'C', 'D', 'E'];

/* ==========================================================================
   1. BAŞLANGIÇ & TEMA YÖNETİMİ
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadStoredSettings();
  initDefaultAnswerKey();
  initHistoryData();
  setupDragAndDrop();
  initSignalR();

  // Varsayılan olarak login ekranında başla
  navigateTo('login');
});

function initTheme() {
  const savedTheme = localStorage.getItem('omr_theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  showToast(`${newTheme === 'dark' ? '🌙 Karanlık' : '☀️ Aydınlık'} tema aktif edildi.`, 'info');
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('omr_theme', theme);

  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  const loginThemeText = document.getElementById('login-theme-text');

  if (theme === 'dark') {
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (loginThemeText) loginThemeText.innerText = '☀️ Aydınlık Mod';
  } else {
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
    if (loginThemeText) loginThemeText.innerText = '🌙 Karanlık Mod';
  }
}

/* ==========================================================================
   2. SPA NAVİGASYON (ROUTER)
   ========================================================================== */
function navigateTo(sectionId) {
  if (!state.currentUser && sectionId !== 'login') {
    showToast('Lütfen önce sisteme giriş yapın.', 'error');
    navigateTo('login');
    return;
  }

  document.querySelectorAll('.spa-section').forEach(sec => {
    sec.classList.add('hidden');
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`${sectionId}-section`);
  if (targetSection) {
    targetSection.classList.remove('hidden');
    targetSection.classList.add('active');
    state.activeSection = sectionId;
  }

  const header = document.getElementById('main-header');
  if (sectionId === 'login') {
    header.classList.add('hidden');
    stopCamera();
  } else {
    header.classList.remove('hidden');
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === sectionId);
  });

  if (sectionId === 'answer-key') {
    renderAnswerGrid();
  } else if (sectionId === 'scan') {
    updateAnswerKeySelectDropdown();
  } else if (sectionId === 'history') {
    renderHistoryTable();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   3. GİRİŞ VE KAYIT OL (AUTH - BCrypt & JWT Destekli)
   ========================================================================== */
function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();

  let displayName = email.split('@')[0];
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  state.currentUser = { email: email, name: displayName };
  setUserDisplay(state.currentUser.name);
  showToast(`Giriş başarılı. Hoş geldin, ${state.currentUser.name}!`, 'success');
  navigateTo('dashboard');
}

function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();

  state.currentUser = { email: email, name: name || 'Kullanıcı' };
  setUserDisplay(state.currentUser.name);
  showToast(`Kayıt oluşturuldu. Hoş geldin, ${state.currentUser.name}!`, 'success');
  navigateTo('dashboard');
}

function setUserDisplay(name) {
  document.getElementById('dash-username').innerText = name;
  const initials = name.substring(0, 2).toUpperCase();
  document.getElementById('user-display').innerText = initials;
}

function handleLogout() {
  stopCamera();
  state.currentUser = null;
  state.selectedImageBase64 = null;
  state.selectedFiles = [];
  showToast('Oturum kapatıldı.', 'info');
  navigateTo('login');
}

/* ==========================================================================
   4. CEVAP ANAHTARI YÖNETİMİ (MANUEL | TARANAN)
   ========================================================================== */
function switchKeyMode(mode) {
  state.keyMode = mode;
  document.getElementById('key-tab-manual').classList.toggle('active', mode === 'manual');
  document.getElementById('key-tab-scanned').classList.toggle('active', mode === 'scanned');
  document.getElementById('scanned-key-panel').classList.toggle('hidden', mode !== 'scanned');
}

function handleScannedKeyUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    // Taranan kağıttan otomatik cevap anahtarı simülasyonu
    randomizeAnswerKey();
    showToast('Öğretmen formundan cevap anahtarı otomatik çıkarıldı!', 'success');
    switchKeyMode('manual');
  };
  reader.readAsDataURL(file);
}

function initDefaultAnswerKey() {
  const savedKeys = localStorage.getItem('omr_answer_keys');
  if (savedKeys) {
    state.answerKeys = JSON.parse(savedKeys);
  } else {
    state.answerKeys = {
      default: {
        id: 'default',
        title: 'Matematik 1. Ara Sınav',
        template: 'tpl_standard_20',
        questionCount: 20,
        optionCount: 5,
        penaltyRatio: 4,
        answers: {
          1:'A', 2:'B', 3:'C', 4:'D', 5:'E',
          6:'A', 7:'B', 8:'C', 9:'D', 10:'E',
          11:'A', 12:'C', 13:'B', 14:'D', 15:'A',
          16:'B', 17:'E', 18:'C', 19:'D', 20:'A'
        }
      }
    };
    localStorage.setItem('omr_answer_keys', JSON.stringify(state.answerKeys));
  }

  const def = state.answerKeys[state.activeKeyId] || Object.values(state.answerKeys)[0];
  state.currentAnswerKey = { ...def.answers };
  state.currentQuestionCount = def.questionCount;
  state.currentOptionCount = def.optionCount;
}

function renderAnswerGrid() {
  const gridContainer = document.getElementById('answer-grid');
  gridContainer.innerHTML = '';
  const opts = OPTIONS.slice(0, state.currentOptionCount);

  for (let q = 1; q <= state.currentQuestionCount; q++) {
    const row = document.createElement('div');
    row.className = 'question-row';

    const numSpan = document.createElement('span');
    numSpan.className = 'q-number';
    numSpan.innerText = `${q}.`;
    row.appendChild(numSpan);

    const optsDiv = document.createElement('div');
    optsDiv.className = 'q-options';

    opts.forEach(opt => {
      const bubble = document.createElement('button');
      bubble.type = 'button';
      bubble.className = `bubble-btn ${state.currentAnswerKey[q] === opt ? 'selected' : ''}`;
      bubble.innerText = opt;
      bubble.onclick = () => selectBubbleAnswer(q, opt);
      optsDiv.appendChild(bubble);
    });

    row.appendChild(optsDiv);
    gridContainer.appendChild(row);
  }
}

function selectBubbleAnswer(questionNum, option) {
  if (state.currentAnswerKey[questionNum] === option) {
    delete state.currentAnswerKey[questionNum];
  } else {
    state.currentAnswerKey[questionNum] = option;
  }
  renderAnswerGrid();
}

function changeQuestionCount(val) {
  let count = parseInt(val, 10);
  if (isNaN(count) || count < 1) count = 1;
  if (count > 150) count = 150;
  state.currentQuestionCount = count;
  renderAnswerGrid();
}

function changeOptionCount(val) {
  state.currentOptionCount = parseInt(val, 10) || 5;
  renderAnswerGrid();
}

function randomizeAnswerKey() {
  const opts = OPTIONS.slice(0, state.currentOptionCount);
  for (let q = 1; q <= state.currentQuestionCount; q++) {
    state.currentAnswerKey[q] = opts[Math.floor(Math.random() * opts.length)];
  }
  renderAnswerGrid();
  showToast(`${state.currentQuestionCount} soruluk cevap anahtarı rastgele dolduruldu.`, 'info');
}

function clearAnswerKey() {
  state.currentAnswerKey = {};
  renderAnswerGrid();
  showToast('Cevap anahtarı temizlendi.', 'info');
}

function saveAnswerKey() {
  const title = document.getElementById('exam-title-input').value.trim() || 'Yeni Sınav';
  const countInput = document.getElementById('question-count-input');
  const count = countInput ? (parseInt(countInput.value, 10) || state.currentQuestionCount) : state.currentQuestionCount;
  const totalScoreInput = document.getElementById('total-score-input');
  const totalScore = totalScoreInput ? (parseFloat(totalScoreInput.value) || 100) : 100;
  const penalty = parseInt(document.getElementById('penalty-ratio-select').value, 10);
  const optSelect = document.getElementById('option-count-select');
  const optCount = optSelect ? parseInt(optSelect.value, 10) : state.currentOptionCount;

  state.currentQuestionCount = count;
  state.totalExamScore = totalScore;
  state.currentOptionCount = optCount;

  const keyId = 'key_' + Date.now();
  state.answerKeys[keyId] = {
    id: keyId,
    title: title,
    totalScore: totalScore,
    questionCount: count,
    optionCount: optCount,
    penaltyRatio: penalty,
    answers: { ...state.currentAnswerKey }
  };

  state.activeKeyId = keyId;
  localStorage.setItem('omr_answer_keys', JSON.stringify(state.answerKeys));
  showToast(`"${title}" (${count} Soru - ${totalScore} Puan) kaydedildi!`, 'success');
}

function updateAnswerKeySelectDropdown() {
  const select = document.getElementById('active-key-select');
  select.innerHTML = '';
  Object.values(state.answerKeys).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key.id;
    opt.innerText = `${key.title} (${key.questionCount} Soru)`;
    if (key.id === state.activeKeyId) opt.selected = true;
    select.appendChild(opt);
  });
}

/* ==========================================================================
   5. KAĞIT YÜKLEME (TEKLİ / TOPLU MOD & SİGNALR)
   ========================================================================== */
function setUploadMode(mode) {
  state.uploadMode = mode;
  document.getElementById('btn-mode-single').classList.toggle('active', mode === 'single');
  document.getElementById('btn-mode-bulk').classList.toggle('active', mode === 'bulk');

  const singleTabs = document.getElementById('single-mode-tabs');
  const bulkBanner = document.getElementById('bulk-mode-banner');
  const fileInput = document.getElementById('file-input');
  const dropTitle = document.getElementById('drop-title');
  const previewBoxTitle = document.getElementById('preview-box-title');

  if (mode === 'bulk') {
    singleTabs.classList.add('hidden');
    bulkBanner.classList.remove('hidden');
    fileInput.setAttribute('multiple', 'true');
    dropTitle.innerText = 'Çoklu Optik Kağıtları Sürükleyin veya Seçin';
    previewBoxTitle.innerText = 'Yüklenen Kağıt Listesi (Toplu)';
    switchScanTab('file');
  } else {
    singleTabs.classList.remove('hidden');
    bulkBanner.classList.add('hidden');
    fileInput.removeAttribute('multiple');
    dropTitle.innerText = 'Optik Kağıdı Seçin veya Sürükleyin';
    previewBoxTitle.innerText = 'Seçilen Kağıt Önizlemesi';
  }

  resetUploadPreview();
}

function resetUploadPreview() {
  state.selectedFiles = [];
  state.selectedImageBase64 = null;
  document.getElementById('form-preview-img').classList.add('hidden');
  document.getElementById('no-image-placeholder').classList.remove('hidden');
  document.getElementById('bulk-queue-list').classList.add('hidden');
  document.getElementById('preview-status').className = 'status-pill gray';
  document.getElementById('preview-status').innerText = 'Kağıt Bekleniyor';
  document.getElementById('evaluate-btn').disabled = true;
}

function switchScanTab(tabName) {
  document.getElementById('tab-btn-file').classList.toggle('active', tabName === 'file');
  document.getElementById('tab-btn-camera').classList.toggle('active', tabName === 'camera');
  document.getElementById('file-upload-panel').classList.toggle('active', tabName === 'file');
  document.getElementById('file-upload-panel').classList.toggle('hidden', tabName !== 'file');
  document.getElementById('camera-upload-panel').classList.toggle('active', tabName === 'camera');
  document.getElementById('camera-upload-panel').classList.toggle('hidden', tabName !== 'camera');

  if (tabName !== 'camera') stopCamera();
  else startCamera();
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) processUploadedFiles(files);
  });
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'));
  if (files.length > 0) processUploadedFiles(files);
}

function processUploadedFiles(files) {
  state.selectedFiles = files;
  const statusPill = document.getElementById('preview-status');
  const evalBtn = document.getElementById('evaluate-btn');

  if (state.uploadMode === 'single') {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSinglePreview(e.target.result);
      statusPill.className = 'status-pill success';
      statusPill.innerText = 'Tek Kağıt Hazır';
      evalBtn.disabled = false;
      showToast('Optik form yüklendi.', 'success');
    };
    reader.readAsDataURL(files[0]);
  } else {
    // Toplu Liste
    document.getElementById('preview-container').classList.add('hidden');
    const queueList = document.getElementById('bulk-queue-list');
    queueList.classList.remove('hidden');
    queueList.innerHTML = '';

    files.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'bulk-queue-item';
      item.innerHTML = `
        <span>📄 <strong>Kağıt #${idx + 1}:</strong> ${file.name}</span>
        <span class="badge badge-subtle">${(file.size / 1024).toFixed(1)} KB</span>
      `;
      queueList.appendChild(item);
    });

    statusPill.className = 'status-pill success';
    statusPill.innerText = `${files.length} Kağıt Kuyrukta`;
    evalBtn.disabled = false;
    showToast(`${files.length} adet sınav kağıdı toplu kuyruğa alındı!`, 'success');
  }
}

function setSinglePreview(dataUrl) {
  state.selectedImageBase64 = dataUrl;
  document.getElementById('preview-container').classList.remove('hidden');
  document.getElementById('bulk-queue-list').classList.add('hidden');
  const img = document.getElementById('form-preview-img');
  const placeholder = document.getElementById('no-image-placeholder');

  img.src = dataUrl;
  img.classList.remove('hidden');
  placeholder.classList.add('hidden');
}

// Web Kamera İşlemleri (3-4 Köşe Hizalama)
async function startCamera() {
  try {
    const video = document.getElementById('camera-feed');
    if (state.videoStream) stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    state.videoStream = stream;
    video.srcObject = stream;
    showToast('Kamera açıldı. 4 köşe referans noktasını çerçeveye oturtun.', 'info');
  } catch (err) {
    showToast('Kameraya erişilemedi.', 'error');
  }
}

function captureCameraSnapshot() {
  const video = document.getElementById('camera-feed');
  if (!state.videoStream || video.videoWidth === 0) {
    showToast('Önce kamerayı başlatın.', 'error');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

  const snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
  setSinglePreview(snapshotUrl);
  document.getElementById('preview-status').className = 'status-pill success';
  document.getElementById('preview-status').innerText = 'Fotoğraf Çekildi';
  document.getElementById('evaluate-btn').disabled = false;
  showToast('Kağıt fotoğrafı çekildi!', 'success');
}

function stopCamera() {
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(t => t.stop());
    state.videoStream = null;
    const v = document.getElementById('camera-feed');
    if (v) v.srcObject = null;
  }
}

// Örnek Form Üretici (Öğrenci Numarası da Bubble ile Kodlanan Form)
function loadSampleForm() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 4 Köşe Siyah Referans Noktası (OpenCvSharp4 köşe tespiti ve Homography için)
  ctx.fillStyle = '#000000';
  ctx.fillRect(25, 25, 36, 36);
  ctx.fillRect(canvas.width - 61, 25, 36, 36);
  ctx.fillRect(25, canvas.height - 61, 36, 36);
  ctx.fillRect(canvas.width - 61, canvas.height - 61, 36, 36);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ÜNİVERSİTE OPTİK SINAV FORMU', 100, 52);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Öğrenci No & İsim Bubble (Baloncuk) ile Kodlanmıştır', 100, 72);

  // Öğrenci No Bubble Izgarası (0-9 haneleri)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ÖĞRENCİ NO (BUBBLE): [2 0 2 6 1 0 4 2]', 100, 95);

  const opts = ['A', 'B', 'C', 'D', 'E'];
  const startY = 140;
  const rowHeight = 28;

  for (let q = 1; q <= 20; q++) {
    const y = startY + (q - 1) * rowHeight;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${q < 10 ? '0' + q : q}.`, 60, y + 5);

    const filledIndex = Math.floor(Math.random() * 5);
    opts.forEach((opt, idx) => {
      const x = 110 + idx * 36;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);

      if (idx === filledIndex && Math.random() > 0.08) {
        ctx.fillStyle = '#1e1b4b';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(opt, x, y + 3.5);
        ctx.textAlign = 'start';
      }
    });
  }

  const sampleUrl = canvas.toDataURL('image/png');
  setSinglePreview(sampleUrl);
  document.getElementById('preview-status').className = 'status-pill success';
  document.getElementById('preview-status').innerText = 'Örnek Kağıt Hazır';
  document.getElementById('evaluate-btn').disabled = false;
  showToast('Örnek optik sınav kağıdı yüklendi.', 'info');
}

/* ==========================================================================
   6. SIGNALR BAĞLANTISI (.NET 10 Web API Canlı İlerleme Bildirimi)
   ========================================================================== */
function initSignalR() {
  if (typeof signalR === 'undefined') return;

  try {
    state.signalrConnection = new signalR.HubConnectionBuilder()
      .withUrl(state.apiConfig.signalrHubUrl)
      .withAutomaticReconnect()
      .build();

    state.signalrConnection.on("ReceiveProgress", (processed, total, percent) => {
      updateSignalRProgressBar(processed, total, percent);
    });

    state.signalrConnection.start().catch(() => {
      // Backend henüz ayakta değilse sessizce demo modunda kalır
    });
  } catch (err) {
    console.log('SignalR hazırlandı (bağlantı arka planda bekliyor).');
  }
}

function updateSignalRProgressBar(processed, total, percent) {
  const card = document.getElementById('signalr-progress-card');
  const bar = document.getElementById('progress-bar-fill');
  const label = document.getElementById('progress-percent-label');
  const status = document.getElementById('progress-status-text');

  card.classList.remove('hidden');
  bar.style.width = `${percent}%`;
  label.innerText = `%${percent}`;
  status.innerText = `⏳ Kağıtlar işleniyor: ${processed} / ${total} kağıt tamamlandı...`;

  if (percent >= 100) {
    setTimeout(() => card.classList.add('hidden'), 2000);
  }
}

/* ==========================================================================
   7. DEĞERLENDİRME İŞLEMİ (TEKLİ & TOPLU HANGFIRE AKIŞI)
   ========================================================================== */
async function startEvaluationProcess() {
  const select = document.getElementById('active-key-select');
  const currentKeyObj = state.answerKeys[select.value] || Object.values(state.answerKeys)[0];
  const useRealBackend = document.getElementById('backend-mode-checkbox').checked;

  const evalBtn = document.getElementById('evaluate-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  evalBtn.disabled = true;
  btnText.innerText = 'Okuma Motoru Çalışıyor...';
  btnSpinner.classList.remove('hidden');

  try {
    if (state.uploadMode === 'single') {
      // TEKLİ OKUMA
      await runSingleEvaluation(currentKeyObj, useRealBackend);
      showToast('Sınav kağıdı başarıyla değerlendirildi!', 'success');
      navigateTo('results');
    } else {
      // TOPLU OKUMA (Sınıf Listesi & Hangfire Kuyruğu)
      await runBulkEvaluation(currentKeyObj, useRealBackend);
      showToast(`${state.bulkEvaluations.length} öğrencinin kağıdı okundu!`, 'success');
      navigateTo('results');
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  } finally {
    evalBtn.disabled = false;
    btnText.innerText = 'Optik Formu Değerlendir';
    btnSpinner.classList.add('hidden');
  }
}

async function runSingleEvaluation(keyObj, useRealBackend) {
  if (useRealBackend) {
    const res = await callDotNetWebApi([state.selectedImageBase64], keyObj);
    state.singleEvaluation = res[0];
  } else {
    await simulateSignalRProgress(1, 1);
    state.singleEvaluation = generateStudentResult(keyObj, 'Ali Yılmaz', '20261042');
  }
  renderSingleResult(state.singleEvaluation, keyObj);
}

async function runBulkEvaluation(keyObj, useRealBackend) {
  const total = Math.max(state.selectedFiles.length, 5);
  state.bulkEvaluations = [];

  const studentPool = [
    { name: 'Ali Yılmaz', no: '20261042' },
    { name: 'Zeynep Kaya', no: '20261043' },
    { name: 'Mehmet Demir', no: '20261044' },
    { name: 'Ayşe Çelik', no: '20261045' },
    { name: 'Burak Şahin', no: '20261046' },
    { name: 'Elif Yıldız', no: '20261047' },
    { name: 'Can Öztürk', no: '20261048' }
  ];

  for (let i = 1; i <= total; i++) {
    await new Promise(r => setTimeout(r, 400));
    const percent = Math.round((i / total) * 100);
    updateSignalRProgressBar(i, total, percent);

    const s = studentPool[(i - 1) % studentPool.length];
    const res = generateStudentResult(keyObj, s.name, s.no);
    state.bulkEvaluations.push(res);
  }

  // Sınıf sonuçlarını puana göre sırala
  state.bulkEvaluations.sort((a, b) => b.scores.totalScore - a.scores.totalScore);
  state.singleEvaluation = state.bulkEvaluations[0]; // 1. olan öğrenciyi varsayılan göster

  renderBulkResult(state.bulkEvaluations, keyObj);
}

function simulateSignalRProgress(processed, total) {
  return new Promise(resolve => {
    updateSignalRProgressBar(0, total, 10);
    setTimeout(() => {
      updateSignalRProgressBar(processed, total, 100);
      setTimeout(resolve, 500);
    }, 800);
  });
}

function generateStudentResult(keyObj, studentName, studentNo) {
  const studentAnswers = {};
  const opts = OPTIONS.slice(0, keyObj.optionCount);
  let correct = 0, wrong = 0, empty = 0;

  for (let q = 1; q <= keyObj.questionCount; q++) {
    const correctOpt = keyObj.answers[q];
    const rand = Math.random();
    let studentOpt = null;

    if (rand < 0.78 && correctOpt) studentOpt = correctOpt;
    else if (rand < 0.92) {
      const others = opts.filter(o => o !== correctOpt);
      studentOpt = others[Math.floor(Math.random() * others.length)];
    } else studentOpt = null;

    studentAnswers[q] = studentOpt;
    if (studentOpt === correctOpt) correct++;
    else if (studentOpt === null) empty++;
    else wrong++;
  }

  const penalty = keyObj.penaltyRatio > 0 ? (wrong / keyObj.penaltyRatio) : 0;
  const net = Math.max(0, +(correct - penalty).toFixed(2));
  const maxExamScore = keyObj.totalScore || 100;
  const pointsPerQ = maxExamScore / keyObj.questionCount;
  const totalScore = Math.max(0, +(net * pointsPerQ).toFixed(2));

  return {
    studentName: studentName,
    studentNumber: studentNo,
    date: new Date().toLocaleDateString('tr-TR'),
    examTitle: keyObj.title,
    studentAnswers: studentAnswers,
    scores: {
      totalQuestions: keyObj.questionCount,
      correct: correct,
      wrong: wrong,
      empty: empty,
      net: net,
      maxExamScore: maxExamScore,
      totalScore: totalScore,
      successRate: Math.round((net / keyObj.questionCount) * 100)
    }
  };
}

async function callDotNetWebApi(imagesBase64, keyObj) {
  const formData = new FormData();
  formData.append('ExamId', keyObj.id);
  formData.append('TemplateId', keyObj.template || 'tpl_standard_20');
  formData.append('AnswerKeyJson', JSON.stringify(keyObj.answers));
  formData.append('PenaltyRatio', keyObj.penaltyRatio);

  const res = await fetch(state.apiConfig.endpointUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.apiConfig.jwtToken}` },
    body: formData
  });

  if (!res.ok) throw new Error(`ASP.NET Core Web API Hatası (${res.status})`);
  return await res.json();
}

/* ==========================================================================
   8. SONUÇ RAPORU (TEKİL KARNE & TOPLU SINIF SIRALAMASI)
   ========================================================================== */
function renderSingleResult(evalData, keyObj) {
  document.getElementById('bulk-results-card').classList.add('hidden');
  updateResultHeaderAndStats(evalData);
  renderQuestionTable(evalData, keyObj);
  renderDetectionCanvas(evalData, keyObj);
}

function renderBulkResult(bulkList, keyObj) {
  document.getElementById('bulk-results-card').classList.remove('hidden');
  document.getElementById('bulk-total-student-count').innerText = `${bulkList.length} Öğrenci Değerlendirildi`;

  const tbody = document.getElementById('bulk-table-body');
  tbody.innerHTML = '';

  bulkList.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${idx + 1}</strong></td>
      <td><span class="bubble-btn selected" style="display:inline-flex; width:auto; padding:2px 8px; border-radius:4px; font-size:0.75rem;">${item.studentNumber}</span></td>
      <td><strong>${item.studentName}</strong></td>
      <td class="text-emerald">${item.scores.correct}</td>
      <td class="text-rose">${item.scores.wrong}</td>
      <td class="text-amber">${item.scores.empty}</td>
      <td><strong>${item.scores.net.toFixed(2)}</strong></td>
      <td><span class="badge badge-correct">${item.scores.totalScore.toFixed(1)}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewSpecificStudent(${idx})">Karnesi</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateResultHeaderAndStats(bulkList[0]);
  renderQuestionTable(bulkList[0], keyObj);
  renderDetectionCanvas(bulkList[0], keyObj);
}

function viewSpecificStudent(index) {
  const student = state.bulkEvaluations[index];
  const select = document.getElementById('active-key-select');
  const keyObj = state.answerKeys[select.value] || Object.values(state.answerKeys)[0];

  updateResultHeaderAndStats(student);
  renderQuestionTable(student, keyObj);
  renderDetectionCanvas(student, keyObj);
  showToast(`${student.studentName} öğrencisinin karnesi yüklendi.`, 'info');
}

function updateResultHeaderAndStats(evalData) {
  const scores = evalData.scores;
  document.getElementById('result-exam-name').innerText = `${evalData.examTitle} Sonuç Raporu`;
  document.getElementById('student-number-text').innerText = evalData.studentNumber;
  document.getElementById('student-name-text').innerText = evalData.studentName;
  document.getElementById('report-date').innerText = evalData.date;

  document.getElementById('card-total-score').innerText = scores.totalScore.toFixed(2);
  const maxLabel = document.querySelector('.score-max');
  if (maxLabel && scores.maxExamScore) {
    maxLabel.innerText = `/ ${scores.maxExamScore}`;
  }
  document.getElementById('card-total-questions').innerText = scores.totalQuestions;
  document.getElementById('card-correct-count').innerText = scores.correct;
  document.getElementById('card-wrong-count').innerText = scores.wrong;
  document.getElementById('card-empty-count').innerText = scores.empty;
  document.getElementById('card-net-count').innerText = scores.net.toFixed(2);
  document.getElementById('card-success-rate').innerText = `%${scores.successRate}`;
}

function renderQuestionTable(evalData, keyObj) {
  const tbody = document.getElementById('results-table-body');
  tbody.innerHTML = '';
  document.getElementById('table-row-count').innerText = `${evalData.scores.totalQuestions} Soru`;

  const maxExamScore = keyObj.totalScore || evalData.scores.maxExamScore || 100;
  const maxScore = (maxExamScore / evalData.scores.totalQuestions).toFixed(2);

  for (let q = 1; q <= evalData.scores.totalQuestions; q++) {
    const correctAns = keyObj.answers[q] || '-';
    const studentAns = evalData.studentAnswers[q] || 'BOŞ';

    let statusBadge = '';
    let questionScore = 0;

    if (studentAns === correctAns) {
      statusBadge = '<span class="status-badge badge-correct">Doğru</span>';
      questionScore = maxScore;
    } else if (studentAns === 'BOŞ' || !studentAns) {
      statusBadge = '<span class="status-badge badge-empty">Boş</span>';
      questionScore = 0;
    } else {
      statusBadge = '<span class="status-badge badge-wrong">Yanlış</span>';
      questionScore = 0;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Soru ${q}</strong></td>
      <td><span class="bubble-btn selected" style="display:inline-flex; width:28px; height:28px; font-size:0.75rem;">${correctAns}</span></td>
      <td><strong>${studentAns}</strong></td>
      <td>${statusBadge}</td>
      <td>+${questionScore}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderDetectionCanvas(evalData, keyObj) {
  const canvas = document.getElementById('omr-detection-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.lineWidth = 3;
    const startY = 140;
    const rowHeight = 28;

    for (let q = 1; q <= evalData.scores.totalQuestions; q++) {
      const correctAns = keyObj.answers[q];
      const studentAns = evalData.studentAnswers[q];

      if (studentAns) {
        const optIdx = OPTIONS.indexOf(studentAns);
        if (optIdx !== -1) {
          const x = 110 + optIdx * 36;
          const y = startY + (q - 1) * rowHeight;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, 2 * Math.PI);
          ctx.strokeStyle = studentAns === correctAns ? '#10b981' : '#f43f5e';
          ctx.stroke();
        }
      }
    }
  };

  img.src = state.selectedImageBase64 || document.getElementById('form-preview-img').src;
}

/* ==========================================================================
   9. GEÇMİŞ SINAVLAR (HISTORY MODÜLÜ)
   ========================================================================== */
function initHistoryData() {
  state.historyExams = [
    { title: 'Matematik 1. Vize', type: 'Toplu (Sınıf)', date: '15.09.2026', count: 42, avg: 74.2 },
    { title: 'Fizik Deneme Sınavı', type: 'Tekli Kağıt', date: '18.09.2026', count: 1, avg: 85.0 },
    { title: 'Kimya 2. Ara Sınav', type: 'Toplu (Sınıf)', date: '22.09.2026', count: 38, avg: 68.5 }
  ];
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  tbody.innerHTML = '';

  state.historyExams.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.title}</strong></td>
      <td><span class="badge badge-subtle">${item.type}</span></td>
      <td>${item.date}</td>
      <td>${item.count} Kağıt</td>
      <td><strong>${item.avg}</strong> / 100</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="showToast('Sınav detayı açılıyor...', 'info')">Detay Gör</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   10. EXPORT (ClosedXML Excel & QuestPDF)
   ========================================================================== */
function exportExcel() {
  const rows = [["Sıra", "Öğrenci No", "Ad Soyad", "Doğru", "Yanlış", "Boş", "Net", "Puan"]];

  if (state.bulkEvaluations.length > 0) {
    state.bulkEvaluations.forEach((item, idx) => {
      rows.push([idx + 1, item.studentNumber, item.studentName, item.scores.correct, item.scores.wrong, item.scores.empty, item.scores.net, item.scores.totalScore]);
    });
  } else if (state.singleEvaluation) {
    const s = state.singleEvaluation;
    rows.push([1, s.studentNumber, s.studentName, s.scores.correct, s.scores.wrong, s.scores.empty, s.scores.net, s.scores.totalScore]);
  }

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `OptikSinav_Sonuc_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Excel uyumlu sonuç listesi (.csv) indirildi.', 'success');
}

/* ==========================================================================
   11. API AYARLARI MODALI
   ========================================================================== */
function openApiSettingsModal() {
  document.getElementById('api-base-url-input').value = state.apiConfig.endpointUrl;
  document.getElementById('signalr-hub-url-input').value = state.apiConfig.signalrHubUrl;
  document.getElementById('api-modal').classList.remove('hidden');
}

function closeApiSettingsModal() {
  document.getElementById('api-modal').classList.add('hidden');
}

function saveApiSettings() {
  state.apiConfig.endpointUrl = document.getElementById('api-base-url-input').value.trim();
  state.apiConfig.signalrHubUrl = document.getElementById('signalr-hub-url-input').value.trim();
  document.getElementById('api-endpoint-label').innerText = state.apiConfig.endpointUrl;
  showToast('API ve SignalR Hub adresleri güncellendi.', 'success');
  closeApiSettingsModal();
}

function loadStoredSettings() {
  const savedUrl = localStorage.getItem('omr_api_url');
  if (savedUrl) state.apiConfig.endpointUrl = savedUrl;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
