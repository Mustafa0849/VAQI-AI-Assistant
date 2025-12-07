import { NextResponse } from 'next/server';

const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER || 'https://publisher.walrus-testnet.walrus.space';
const UPLOAD_TIMEOUT = 10000; // 10 seconds

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const epochs = searchParams.get('epochs') || '5';

    // Read the request body
    const body = await req.text();
    
    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    console.log('📤 [Walrus Proxy] Uploading to Walrus...', {
      url: `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`,
      bodySize: body.length,
      epochs,
    });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

    try {
      const startTime = Date.now();
      
      // Forward request to Walrus Publisher
      const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        body: body,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      console.log('📤 [Walrus Proxy] Response received after', elapsed, 'ms, status:', response.status);

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        
        console.error('❌ [Walrus Proxy] Upload failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return NextResponse.json(
          { 
            error: 'Walrus upload failed',
            status: response.status,
            details: errorText,
          },
          { status: response.status }
        );
      }

      const result = await response.json();
      console.log('✅ [Walrus Proxy] Upload successful!', {
        blobId: result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId,
        elapsed,
      });

      return NextResponse.json(result);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      const errorMessage = error?.message || 'Unknown error';
      const isTimeout = error.name === 'AbortError' || errorMessage.includes('timeout');
      
      console.error('❌ [Walrus Proxy] Upload error:', {
        error: errorMessage,
        isTimeout,
      });

      return NextResponse.json(
        { 
          error: isTimeout ? 'Request timeout' : 'Upload failed',
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

