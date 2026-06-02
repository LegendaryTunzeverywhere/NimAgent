import { NextResponse } from 'next/server';

/**
 * Health check endpoint to verify environment variables
 * SECURITY: Only returns boolean flags, never actual secrets or URLs
 */
export async function GET() {
  const hasBackendUrl = !!process.env.BACKEND_URL;
  const hasApiSecret = !!process.env.API_SECRET;
  
  return NextResponse.json({
    status: 'ok ✅✅',
    timestamp: new Date().toISOString(),
    env: {
      BACKEND_URL: hasBackendUrl ? 'configured ✓' : 'MISSING ✗',
      API_SECRET: hasApiSecret ? 'configured ✓' : 'MISSING ✗',
    }
  });
}
