import { NextResponse } from 'next/server';

// Force dynamic rendering - this route processes external URLs dynamically
export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Extract text content from HTML
 */
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text.substring(0, 5000); // Limit to 5000 chars
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(html: string): { title?: string; description?: string; ogTitle?: string; ogDescription?: string } {
  const metadata: { title?: string; description?: string; ogTitle?: string; ogDescription?: string } = {};
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }
  
  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }
  
  // Extract OG title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    metadata.ogTitle = ogTitleMatch[1].trim();
  }
  
  // Extract OG description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) {
    metadata.ogDescription = ogDescMatch[1].trim();
  }
  
  return metadata;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    console.log('🔗 [Link Analysis] Fetching URL:', url);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const startTime = Date.now();
      
      // Fetch the URL
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      console.log('🔗 [Link Analysis] Response received after', elapsed, 'ms, status:', response.status);

      if (!response.ok) {
        return NextResponse.json(
          { 
            error: 'Failed to fetch URL',
            status: response.status,
            statusText: response.statusText,
          },
          { status: response.status }
        );
      }

      // Get content type
      const contentType = response.headers.get('content-type') || '';
      
      // Only process HTML/text content
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        return NextResponse.json(
          { 
            error: 'URL does not return HTML or text content',
            contentType,
          },
          { status: 415 }
        );
      }

      const html = await response.text();
      
      // Extract metadata and text
      const metadata = extractMetadata(html);
      const textContent = extractTextFromHTML(html);

      console.log('✅ [Link Analysis] Successfully analyzed URL:', {
        url,
        hasTitle: !!metadata.title,
        hasDescription: !!metadata.description,
        textLength: textContent.length,
      });

      return NextResponse.json({
        url,
        title: metadata.ogTitle || metadata.title,
        description: metadata.ogDescription || metadata.description,
        content: textContent,
        status: response.status,
        contentType,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      const errorMessage = error?.message || 'Unknown error';
      const isTimeout = error.name === 'AbortError' || errorMessage.includes('timeout');
      
      console.error('❌ [Link Analysis] Fetch error:', {
        error: errorMessage,
        isTimeout,
        url,
      });

      return NextResponse.json(
        { 
          error: isTimeout ? 'Request timeout' : 'Failed to fetch URL',
          details: errorMessage,
        },
        { status: isTimeout ? 408 : 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ [Link Analysis] Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}
