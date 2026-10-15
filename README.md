<div align="center">

# 🎯 OptiMatrix Enterprise OMR
### Yeni Nesil Kurumsal Optik Form Oluşturma, Tarama ve Değerlendirme Platformu

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Canlı%20SaaS%20Demo-2563eb?style=for-the-badge&logo=vercel&logoColor=white)](https://omr-frontend-pink.vercel.app/)
[![Technology](https://img.shields.io/badge/.NET%2010-ASP.NET%20Core%20Web%20API-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Computer Vision](https://img.shields.io/badge/OpenCV-OpenCvSharp4-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![Realtime](https://img.shields.io/badge/SignalR-Hangfire%20İlerleme-10b981?style=for-the-badge)](https://dotnet.microsoft.com/apps/aspnet/signalr)
[![Platform](https://img.shields.io/badge/Responsive-Mobile%20%26%20Desktop-06b6d4?style=for-the-badge)](#)

<br/>

> **🌐 Projeyi hemen tarayıcınızda canlı olarak test edin:**  
> 👉 **[omr-frontend-pink.vercel.app](https://omr-frontend-pink.vercel.app/)** 👈  
*(Hiçbir kurulum yapmadan doğrudan linke tıklayarak dinamik form oluşturma, A4 önizleme, cevap anahtarı, toplu tarama ve analiz karnesini anında deneyimleyebilirsiniz.)*

</div>

---

## 📌 Proje Genel Bakışı & Yenilikler

**OptiMatrix**, klasik ve karmaşık optik okuma sistemlerinin aksine modern **Enterprise SaaS** mimarisiyle yeniden tasarlandı. El yazısı OCR risklerini sıfıra indirerek **öğrenci numaraları, kitapçık türleri ve cevapları tamamen optik baloncuk matrisi** üzerinden çözer.

### 🌟 Son Mimari & Tasarım Revizyonu:
1. **Kurumsal & Modern SaaS Tasarım Dili (UI/UX):**
   - Stripe / Vercel esintili net çizgiler, keskin modern kartlar (`border-radius: 6-8px`), profesyonel gölgeler.
   - Gece laciverti / antrasit ve kurumsal mavi / aqua renk paleti.
   - Tek tıkla kusursuz Dark / Light mod desteği.
2. **Açılış (Landing) Ekranı & Akıcı Geçiş:**
   - Uygulama doğrudan karışık panelle açılmaz; şık bir Landing ekranı karşılar.
   - "Hemen Başla & Sınav Oluştur" veya "Örnek Optik Formu İncele" butonlarıyla sihirbaza geçiş yapılır.
3. **Kilitli Adım Adım (Step-by-Step Wizard) Süreç Mimarisi:**
   - Ekran kalabalığı sonlandırıldı. Kullanıcı hangi aşamadaysa yalnızca o aşamanın kontrollerini görür.
   - Üst kısımdaki kompakt durum rozetleri ile güvenli akış (Step-Locking).
4. **Gelişmiş Dinamik Optik Form Üreticisi:**
   - **Öğrenci Numarası Hane Seçimi:** İsteğe bağlı açılıp kapatılabilir; 4 ile 12 basamak arasında serbestçe belirlenir (0-9 baloncuklu sütunlar dinamik üretilir).
   - **Kitapçık ve İsim Alanı:** A, B, C, D kitapçık seçimi ve baloncuklu harf/isim alanı isteğe bağlı açılır.
   - **Çoklu Ders & Bölüm Yönetimi:** Birden fazla ders (örn: Türkçe, Matematik, Fen) ve her dersin soru sayısı serbestçe eklenir. Soru aralıkları (Örn: Soru 1-20, 21-35) otomatik hesaplanır.
   - **4 veya 5 Şık (Options) Desteği:** Bazı testler için 4 şık (A-D), lise/üniversite sınavları için 5 şık (A-E) serbestçe seçilebilir.
   - **A4 Live Sheet Önizleme & Baskı:** Oluşturulan form şablonu, 4 siyah köşe homography işaretleriyle birlikte canlı A4 baskı formatında görüntülenebilir ve PDF olarak yazdırılabilir.
5. **Kesintisiz State Yönetimi (F5 / Refresh Koruması):**
   - Sayfa yenilendiğinde (Refresh/F5) kullanıcının bulunduğu adım, girdiği dersler, cevap anahtarı ve değerlendirme sonuçları uçup gitmez; `localStorage` motoruyla kaldığı yerden devam eder.
   - İstenildiğinde "Yeni Sınav Başlat" butonu ile oturum tek tıkla güvenle sıfırlanabilir.
6. **%100 Responsive Uyumluluk:**
   - Akıllı telefonlardan tablet ve geniş masaüstü monitörlere kadar hiçbir taşma veya kayma olmadan tam uyumlu CSS Grid/Flexbox mimarisi.

---

## 🧭 4 Adımlı Süreç Mimarisi (Step-by-Step)

```
[ Tanıtım (Landing) ]
         │
         ▼
[ Adım 1: Dinamik Form Yapılandırma ] ──► (Dersler, 4/5 Şık, Öğrenci No Haneleri, Puan)
         │
         ▼
[ Adım 2: Cevap Anahtarı Belirleme ]   ──► (Derslere Göre Matris, Rastgele Doldur, Öğretmen Kağıdı)
         │
         ▼
[ Adım 3: Kağıt Tarama & Yükleme ]    ──► (Tekli / Toplu Sınıf, Webcam Homography Kılavuzu, SignalR)
         │
         ▼
[ Adım 4: Değerlendirme & Karne ]     ──► (6 Metrik, Sınıf Sıralaması, OpenCV Canvas, Excel/PDF)
```

---

## 💻 Teknoloji Yığını

- **Ön Yüz:** Saf HTML5, CSS3 Modern Flexbox/Grid, Vanilla JS (Bağımsız, ultra hızlı SPA).
- **Gerçek Zamanlı İletişim:** Microsoft SignalR Client (`@microsoft/signalr`) ile canlı websocket kuyruk takibi.
- **Kamera & Görsel İşleme:** HTML5 MediaDevices API, Canvas API, OpenCV homography & köşe hizalama mantığı.
- **Arka Yüz (Backend Standardı):** C# (.NET 10) ASP.NET Core Web API, OpenCvSharp4, Hangfire, PostgreSQL, EF Core.
- **Raporlama & Export:** Excel CSV Export (ClosedXML entegrasyonlu) ve QuestPDF formatlı yazıcı çıktısı.

---

## 🛠️ Yerel Kurulum (Local Run)

Projeyi bilgisayarınızda çalıştırmak için herhangi bir sunucu derlemesine gerek yoktur:

1. Klasörü tarayıcınızda açın:
   - `index.html` dosyasına çift tıklayarak doğrudan Chrome, Edge, Safari veya Firefox üzerinde başlatabilirsiniz.
2. Veya VS Code / Web Server ile çalıştırmak için:
   ```bash
   npx serve .
   ```
   Tarayıcınızda `http://localhost:3000` adresine gidin.

---

## 📄 Lisans
Bu proje üniversite ders projesi ve açık kaynaklı kurumsal OMR araştırma referansı olarak geliştirilmiştir.
MIT Lisansı altında serbestçe kullanılabilir ve genişletilebilir.
