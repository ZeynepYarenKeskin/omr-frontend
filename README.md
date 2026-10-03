## 📌 Proje Hakkında

-** Tıklayıp inceleyiniz  = 🔗(https://omr-frontend-bm3il654p-martha9.vercel.app/)**
**OptiMatrix**, kağıt üzerindeki optik işaretli (bubble) sınav formlarını kamera akışından veya taranmış görsellerden yüksek hassasiyetle okuyan, öğrenci numaralarını ve şıkları otomatik puanlayan modern bir web uygulamasıdır. 
Sistemde hata payı yüksek olan el yazısı tanıma (OCR) kullanılmaz; **öğrenci numaraları ve cevaplar tamamen optik baloncuk matrisi üzerinden çözümlenir.**
---
## ✨ Öne Çıkan Özellikler
- **🚀 Tekli ve Toplu (Sınıf) Okuma Akışı:** İster tek bir öğrenci kağıdını anlık okutun, ister tüm sınıfın kağıtlarını tek seferde yükleyip toplu değerlendirin.
- **⚡ SignalR ile Gerçek Zamanlı İlerleme:** Toplu okumalarda arka plan kuyruğu (Hangfire) çalışırken ekranda anlık `%` ve `X/Y kağıt tamamlandı` canlı ilerleme çubuğu görüntülenir.
- **📐 3-4 Köşe Referans Noktası & Homography:** Kağıt kameraya eğik veya dönük tutulsa bile 4 siyah referans karesi tespit edilerek açı düzeltilir (perspektif düzeltme).
- **📝 Serbest Soru ve Puanlama Tanımlama:** Kısıtlı seçenekler olmadan **1 ile 150 arasında dilediğiniz soru sayısını** ve sınav toplam puanını doğrudan girme imkanı.
- **🔑 Çift Modlu Cevap Anahtarı:**
  - *Manuel İşaretleme:* A-E şıklarını baloncuklara tıklayarak belirleme.
  - *Taranan Formdan Çıkar:* Öğretmen cevap anahtarı kağıdını doğrudan yükleyerek otomatik anahtar üretme.
- **📊 Ayrıntılı Analiz ve Sınıf Sıralaması:**
  - Doğru, Yanlış, Boş, Net ve Puan hesaplaması.
  - Soru soru başarı karnesi ve tespit edilen baloncukların canvas üzerinde görsel incelemesi.
  - Toplu okumada tüm sınıfı listeleyen ve tek tıkla her öğrencinin karnesini açan sıralama tablosu.
- **📥 Çıktı ve Dışa Aktarma (Export):**
  - **Excel (.csv / .xlsx):** Sınıf başarı listesini tek tıkla Excel uyumlu indirme (ClosedXML entegrasyonu).
  - **Yazdır / QuestPDF:** Resmi sınav sonuç belgesi formatında baskı ve PDF çıktısı.
- **🌓 Ultra Modern Tasarım & Dark/Light Mod:**
  - Derin gece laciverti ve neon pembe/fuşya degrade renk paleti.
  - Tek tıkla karanlık ve aydınlık tema geçişi.
  - **%100 Responsive:** Telefon, tablet ve masaüstü ekranlarda kusursuz uyumluluk.
