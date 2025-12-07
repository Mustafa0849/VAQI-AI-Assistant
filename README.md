# Sui-GPT Commander

Doğal dilde yazdığınız istekleri Sui blockchain işlemlerine dönüştüren modern bir Next.js uygulaması.

## Özellikler

- 🤖 **AI Destekli Analiz**: Google Gemini ile doğal dil işleme
- 💬 **Modern Chat Arayüzü**: Kullanıcı dostu sohbet deneyimi
- 📋 **İşlem Önizleme**: Oluşturulan işlemleri görselleştirme
- 🔒 **Tip Güvenliği**: Zod şemaları ile kesin JSON doğrulama
- 🎨 **Modern UI**: Tailwind CSS ve Shadcn/UI ile şık tasarım

## Teknoloji Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Shadcn/UI
- **AI**: Google Generative AI SDK, Gemini 1.5 Flash
- **Blockchain**: @mysten/sui.js, @mysten/dapp-kit

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Ortam değişkenlerini ayarlayın:
`.env.local` dosyası oluşturun:
```
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Walrus endpoints (defaults to testnet if not set)
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
```

**Not:** 
- Google API anahtarınızı [Google AI Studio](https://makersuite.google.com/app/apikey) üzerinden alabilirsiniz.
- Walrus URL'leri opsiyoneldir. Belirtilmezse testnet URL'leri kullanılır.

3. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

4. Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın

## Kullanım

1. Sol taraftaki chat arayüzünde doğal dilde bir istek yazın
2. Örnek: "10 SUI'yi USDC'ye çevir ve yarısını stake et"
3. AI isteğinizi analiz edip işlem önizlemesini sağ tarafda gösterecek
4. İşlemi onaylayıp Sui blockchain'ine gönderebilirsiniz

## Proje Yapısı

```
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts       # AI analiz API endpoint'i
│   ├── layout.tsx
│   ├── page.tsx               # Ana sayfa
│   └── globals.css
├── components/
│   ├── chat/
│   │   └── ChatInterface.tsx  # Chat arayüzü komponenti
│   ├── transaction/
│   │   └── TransactionPreview.tsx  # İşlem önizleme komponenti
│   └── ui/                    # Shadcn/UI komponentleri
├── lib/
│   ├── ai/
│   │   └── service.ts         # AI servis katmanı
│   ├── schemas/
│   │   └── transaction.ts     # Zod şemaları
│   └── utils.ts
└── types/
    └── index.ts               # TypeScript tipleri
```

## İşlem Tipleri

- **SWAP**: Token değişimi
- **TRANSFER**: Token transferi
- **STAKE**: Staking işlemi

## Lisans

MIT


