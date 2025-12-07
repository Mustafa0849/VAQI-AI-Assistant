import { NextResponse } from 'next/server';

const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';
const DOWNLOAD_TIMEOUT = 10000; // 10 seconds

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const blobId = searchParams.get('blobId');

    if (!blobId) {
      return NextResponse.json(
        { error: 'blobId parameter is required' },
        { status: 400 }
      );
    }

    console.log('📥 [Walrus Proxy] Downloading from Walrus...', { blobId });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    try {
      const startTime = Date.now();
      
      // Forward request to Walrus Aggregator
      const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      console.log('📥 [Walrus Proxy] Response received after', elapsed, 'ms, status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('ℹ️ [Walrus Proxy] Blob not found (may have expired):', blobId);
          return NextResponse.json(
            { error: 'Blob not found', blobId },
            { status: 404 }
          );
        }

        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        
        console.error('❌ [Walrus Proxy] Download failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return NextResponse.json(
          { 
            error: 'Walrus download failed',
            status: response.status,
            details: errorText,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('✅ [Walrus Proxy] Download successful!', {
        blobId,
        elapsed,
      });

      return NextResponse.json(data);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      const errorMessage = error?.message || 'Unknown error';
      const isTimeout = error.name === 'AbortError' || errorMessage.includes('timeout');
      
      console.error('❌ [Walrus Proxy] Download error:', {
        error: errorMessage,
        isTimeout,
        blobId,
      });

      return NextResponse.json(
        { 
          error: isTimeout ? 'Request timeout' : 'Download failed',
          details: errorMessage,
        },
        { status: isTimeout ? 408 : 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ [Walrus Proxy] Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}

