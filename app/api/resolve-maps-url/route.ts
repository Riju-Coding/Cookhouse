import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Perform a fetch to the Google Maps URL. We want to follow redirects
    // to get the final expanded URL that contains the coordinates.
    const response = await fetch(urlParam, {
      method: 'GET',
      redirect: 'follow', 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const finalUrl = response.url;
    
    // Look for coordinates in the URL.
    // Maps URLs usually have /@latitude,longitude,zoom/ or ?q=latitude,longitude
    let lat: number | null = null;
    let lng: number | null = null;

    // Pattern 1: /@28.6139,77.2090,
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    } else {
      // Pattern 2: ?q=28.6139,77.2090 or &ll=28.6139,77.2090
      const qMatch = finalUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        lat = parseFloat(qMatch[1]);
        lng = parseFloat(qMatch[2]);
      }
    }

    if (lat !== null && lng !== null) {
      return NextResponse.json({
        success: true,
        lat,
        lng,
        finalUrl
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Could not extract coordinates from the redirected URL',
        finalUrl
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error resolving maps URL:", error);
    return NextResponse.json({
      success: false,
      error: 'Failed to resolve URL'
    }, { status: 500 });
  }
}
