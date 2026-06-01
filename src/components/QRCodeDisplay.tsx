'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Icon from './Icon';

interface QRCodeDisplayProps {
  address: string;
}

export default function QRCodeDisplay({ address }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [qrType, setQrType] = useState<'nimhub' | 'address'>('nimhub');

  // Create NimHub URL for the address
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nimhub.vercel.app';
  const nimhubUrl = `${baseUrl}/pay/${address}`;
  const qrData = qrType === 'nimhub' ? nimhubUrl : address;

  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrData,
      {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 240,
        color: {
          dark: '#0d0d1a',
          light: '#ffffff',
        },
      }
    ).catch((err) => {
      console.error('QR generation error:', err);
      setError(true);
    });
  }, [qrData]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/png');
    const filename = qrType === 'nimhub' 
      ? `nimhub-pay-${address.substring(0, 9)}.png`
      : `nimiq-${address.substring(0, 9)}.png`;
    link.download = filename;
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400">Failed to generate QR code</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-4 text-center max-w-sm">
      <div className="flex justify-center mb-3">
        <div className="flex bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setQrType('nimhub')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              qrType === 'nimhub'
                ? 'bg-gold text-background-primary'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            🌐 NimHub Link
          </button>
          <button
            onClick={() => setQrType('address')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              qrType === 'address'
                ? 'bg-gold text-background-primary'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            📍 Raw Address
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="mx-auto rounded-lg" />
      
      <div className="space-y-2">
        <div className="text-xs text-white/40 uppercase tracking-wide">
          {qrType === 'nimhub' ? 'NimHub Payment Link' : 'Nimiq Address'}
        </div>
        <div className="text-xs text-white/70 font-mono break-all px-2 bg-black/20 rounded-lg py-2">
          {qrType === 'nimhub' ? nimhubUrl : address}
        </div>
      </div>

      {qrType === 'nimhub' && (
        <div className="text-xs text-white/50 bg-gold/10 border border-gold/20 rounded-lg p-3">
          <p className="font-semibold text-gold mb-1 flex items-center gap-1.5">
            <Icon name="sparkles" size={13} strokeWidth={2} /> Smart QR Code
          </p>
          <p>This QR code opens NimHub for easy payments. Users can send NIM directly from their browser or wallet app!</p>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/20 transition-colors"
        >
          <Icon name="download" size={15} strokeWidth={2} /> Download
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/20 transition-colors"
        >
          {copied ? (
            <><Icon name="check" size={15} strokeWidth={2.5} /> Copied!</>
          ) : (
            <><Icon name="copy" size={15} strokeWidth={2} /> Copy {qrType === 'nimhub' ? 'Link' : 'Address'}</>
          )}
        </button>
      </div>
    </div>
  );
}
