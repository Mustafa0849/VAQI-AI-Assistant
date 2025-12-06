# Sui-GPT Commander - Kurulum Rehberi

## 📋 Ön Gereksinimler

- Node.js 18.x veya üzeri
- npm veya yarn paket yöneticisi
- Google API anahtarı (Gemini)

## 🚀 Kurulum Adımları

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

Bu komut şu paketleri yükleyecek:
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Shadcn/UI bileşenleri
- Google Generative AI SDK
- Sui blockchain SDK'ları
- Zod (şema doğrulama)

### 2. Ortam Değişkenlerini Ayarlayın

Proje kök dizininde `.env.local` dosyası oluşturun:

```bash
GOOGLE_API_KEY=your_google_api_key_here
```

**Not:** Google API anahtarınızı [Google AI Studio](https://makersuite.google.com/app/apikey) üzerinden alabilirsiniz.

### 3. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacaktır.

## 📁 Proje Yapısı

```
Sui-Agent-Proje/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # AI analiz API endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Ana sayfa (chat + preview)
│   └── globals.css               # Global stiller
├── components/
│   ├── chat/
│   │   └── ChatInterface.tsx     # Chat arayüzü komponenti
│   ├── transaction/
│   │   └── TransactionPreview.tsx # İşlem önizleme komponenti
│   └── ui/                       # Shadcn/UI bileşenleri
├── lib/
│   ├── ai/
│   │   └── service.ts            # AI servis katmanı
│   ├── schemas/
│   │   └── transaction.ts        # Zod şemaları
│   └── utils.ts                  # Yardımcı fonksiyonlar
├── types/
│   └── index.ts                  # TypeScript tipleri
└── package.json
```

## 🔧 Yapılandırma

### Tailwind CSS

Tailwind CSS yapılandırması `tailwind.config.ts` dosyasında bulunur. Shadcn/UI ile uyumlu tema değişkenleri tanımlanmıştır.

### TypeScript

TypeScript yapılandırması `tsconfig.json` dosyasında bulunur. Next.js App Router için optimize edilmiştir.

## 🎯 Kullanım

1. Chat arayüzünde doğal dilde bir istek yazın
2. Örnek istekler:
   - "10 SUI'yi USDC'ye çevir"
   - "5 SUI'yi 0x123... adresine gönder"
   - "100 SUI stake et"
   - "10 SUI'yi USDC'ye çevir ve yarısını stake et"
3. AI isteğinizi analiz edip işlem önizlemesini oluşturacak
4. Sağ tarafta işlem önizlemesini kontrol edin
5. İşlemi onaylayıp blockchain'e gönderebilirsiniz (şu an için implement edilmemiş)

## 📝 Notlar

- İlk çalıştırmada paketlerin yüklenmesi birkaç dakika sürebilir
- Google Gemini API ücretsiz kullanım limitleri vardır, kullanım maliyetlerini kontrol edin
- `.env.local` dosyasını git'e eklemeyin (zaten .gitignore'da)

## 🐛 Sorun Giderme

### Port 3000 kullanımda hatası
```bash
# Farklı bir port kullanın
npm run dev -- -p 3001
```

### Google API hatası
- API anahtarınızın doğru olduğundan emin olun
- API anahtarınızın aktif ve yeterli kredisi olduğunu kontrol edin
- `.env.local` dosyasında `GOOGLE_API_KEY` değişkeninin ayarlandığından emin olun

### Paket yükleme hataları
```bash
# node_modules ve lock dosyasını temizleyip tekrar deneyin
rm -rf node_modules package-lock.json
npm install
```

