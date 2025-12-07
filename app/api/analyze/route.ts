import { NextResponse } from 'next/server';
import { analyzeTransactionIntent } from '@/lib/ai/service';

export async function POST(req: Request) {
  console.log('------------------------------------------');
  console.log('🔵 API İsteği Alındı (/api/analyze)');

  try {
    // Performance timing
    console.time('API_Route_Total');
    
    // 1. Gelen veriyi okumayı dene
    const body = await req.json();
    const { message, history = [], model = 'gemini-2.5-flash', memoryContext = null } = body;

    console.log('📩 Kullanıcı Mesajı:', message);
    console.log('📚 Chat History:', history.length, 'messages');
    console.log('🤖 Selected Model (raw):', model);
    console.log('🧠 Memory Context:', memoryContext ? 'Present' : 'None');

    if (!message) {
      throw new Error('Mesaj içeriği boş geldi!');
    }

    // 2. Yapay Zeka Servisini Çağır
    console.log('🤖 AI Servisi Çağırılıyor...');
    const result = await analyzeTransactionIntent(message, history, model, memoryContext);
    
    console.timeEnd('API_Route_Total');

    console.log('✅ AI Başarıyla Cevap Verdi:', JSON.stringify(result).substring(0, 50) + '...');
    return NextResponse.json(result);
  } catch (error: any) {
    // End timing even on error
    console.timeEnd('API_Route_Total');
    
    // BURASI HATAYI GÖRECEĞİMİZ YER
    console.error('🔥🔥🔥 API ROTASINDA PATLAMA OLDU 🔥🔥🔥');
    console.error('HATA MESAJI:', error.message);
    console.error('HATA DETAYI:', error);
    console.error('------------------------------------------');

    // Frontend'e de hatayı söyle ki "Failed to analyze" yerine gerçek sebebi gör
    return NextResponse.json(
      {
        type: 'CHAT',
        data: {
          summary: `Sistem Hatası: ${error.message}`,
          action_type: 'NONE',
          params: {},
        },
      },
      { status: 500 }
    );
  }
}


