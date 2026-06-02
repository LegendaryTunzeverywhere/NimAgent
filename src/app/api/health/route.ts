import { NextResponse } from 'next/server';

/**
 * Health check endpoint to verify environment variables
 */
export async function GET() {
  const hasBackendUrl = !!process.env.BACKEND_URL;
  const hasApiSecret = !!process.env.API_SECRET;
  
  return NextResponse.json({
    status: 'ok ✅✅',
    timestamp: new Date().toISOString(),
    env: {
      BACKEND_URL: hasBackendUrl ? 'configured' : 'MISSING',
      API_SECRET: hasApiSecret ? 'configured' : 'MISSING',
      // Show first 8 chars of API secret to verify it's correct
      API_SECRET_preview: hasApiSecret ? process.env.API_SECRET?.substring(0, 5) + '...' : 'MISSING',
      BACKEND_URL_value: process.env.BACKEND_URL || 'MISSING',
    }
  });
}
