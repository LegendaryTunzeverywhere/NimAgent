'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Icon from './Icon';

interface QRCodeDisplayProps {
  address: string;
  /** Optional amount in NIM for a payment request QR */
  amount?: number;
  /** Optional message / label for the payment request */
  message?: string;
}

type QRMode = 'request' | 'nimagent' | 'address';

export default function QRCodeDisplay({ address, amount, message }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError]       = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);
  // Default to 'request' when an amount is provided, otherwise 'nimagent'
  const [mode, setMode]       = useState<QRMode>(amount ? 'request' : 'nimagent');

  const normalizedAddress = address.replace(/\s/g, '');
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nimagent.online';

  // ── URL builders ──────────────────────────────────────────────────────────
  const buildRequestUrl = () => {
    const params = new URLSearchParams({ to: normalizedAddress });
    if (amount)  params.set('amount',  amount.toFixed(5).replace(/\.?0+$/, ''));
    if (message) params.set('message', message);
    return `${baseUrl}/?${params.toString()}`;
  };

  const nimagentUrl  = `${baseUrl}/pay/${normalizedAddress}`;
  const requestUrl = buildRequestUrl();

  const qrData = mode === 'request' ? requestUrl
               : mode === 'nimagent'  ? nimagentUrl
               : address;

  const displayLabel = mode === 'request' ? 'Payment Request Link'
                     : mode === 'nimagent'  ? 'NimAgent Payment Link'
                     : 'Nimiq Address';

  // ── Generate QR ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    setError(false);
    QRCode.toCanvas(canvasRef.current, qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 240,
      color: { dark: '#0d0d1a', light: '#ffffff' },
    }).catch(() => setError(true));
  }, [qrData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!canvasRef.current) return;

    const filename = mode === 'request'
      ? `nimagent-request-${normalizedAddress.slice(0, 8)}.png`
      : mode === 'nimagent'
      ? `nimagent-pay-${normalizedAddress.slice(0, 8)}.png`
      : `nimiq-${normalizedAddress.slice(0, 8)}.png`;

    // Get the PNG data directly from the canvas — no fetch() needed.
    const dataUrl = canvasRef.current.toDataURL('image/png');

    // Try Web Share API with files (works on Android/iOS when supported).
    // Convert data URL → Blob → File without fetch() which is unreliable
    // for data: URLs inside WebViews.
    if (navigator.share && navigator.canShare) {
      try {
        const res = dataUrl.split(',');
        const byteString = atob(res[1]);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'NimAgent QR Code' });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled — don't fall through
        // Any other error: fall through to anchor download
      }
    }

    // Fallback: try blob URL first (more reliable than data: URLs in WebViews),
    // then fall back to a plain data: URL anchor as last resort.
    try {
      await new Promise<void>((resolve, reject) => {
        canvasRef.current!.toBlob((blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Revoke after a short delay to let the download start
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          resolve();
        }, 'image/png');
      });
    } catch {
      // Last resort: data URL anchor
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyQr = async () => {
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mode === 'request' ? requestUrl : nimagentUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* silent */ }
  };

  if (error) {
    return (
      <div className="bg-white/80 dark:bg-white/[0.04] border border-[#1F2348]/15 dark:border-white/[0.07] rounded-2xl p-6 text-center space-y-3 max-w-sm">
        <p className="text-red-600 dark:text-red-400 text-sm">Failed to generate QR code</p>
        <button onClick={() => setError(false)}
          className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-white/5 text-[#1F2348] dark:text-white text-sm hover:bg-gray-300 dark:hover:bg-white/10 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass dark:bg-white/[0.035] border border-[#1F2348]/15 dark:border-white/[0.07] rounded-2xl p-5 space-y-4 text-center max-w-sm">

      {/* ── Mode tabs ─────────────────────────────────────────────────────── */}
      <div className="flex bg-white/80 dark:bg-white/[0.05] rounded-xl p-1 gap-0.5">
        {amount && (
          <button onClick={() => setMode('request')}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              mode === 'request'
                ? 'bg-amber-500 dark:bg-gold text-white dark:text-background-primary shadow-sm'
                : 'text-[#1F2348]/80 dark:text-white/70 hover:text-[#1F2348] dark:hover:text-white'
            }`}>
            Request {amount} NIM
          </button>
        )}
        <button onClick={() => setMode('nimagent')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            mode === 'nimagent'
              ? 'bg-white dark:bg-white/10 text-[#1F2348] dark:text-white shadow-sm'
              : 'text-[#1F2348]/80 dark:text-white/70 hover:text-[#1F2348] dark:hover:text-white'
          }`}>
          Pay Link
        </button>
        <button onClick={() => setMode('address')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            mode === 'address'
              ? 'bg-white dark:bg-white/10 text-[#1F2348] dark:text-white shadow-sm'
              : 'text-[#1F2348]/80 dark:text-white/70 hover:text-[#1F2348] dark:hover:text-white'
          }`}>
          Address
        </button>
      </div>

      {/* ── Payment request summary ───────────────────────────────────────── */}
      {mode === 'request' && amount && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#E9B213]/20 dark:bg-gold/10 border border-[#E9B213]/30 dark:border-gold/25 rounded-xl">
          <div className="text-left">
            <p className="text-[10px] font-medium text-[#E9B213] dark:text-gold/70 uppercase tracking-wider">Requesting</p>
            <p className="text-lg font-bold text-[#E9B213] dark:text-gold font-mono leading-tight">{amount} NIM</p>
            {message && <p className="text-[11px] text-[#E9B213] dark:text-gold/65 mt-0.5 truncate max-w-[160px]">{message}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500 dark:bg-gold flex items-center justify-center flex-shrink-0">
            <Icon name="qr-code" size={20} strokeWidth={2} className="text-white dark:text-background-primary" />
          </div>
        </div>
      )}

      {/* ── QR canvas ─────────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-xl border border-[#1F2348]/15 dark:border-white/[0.08] shadow-sm">
          <canvas ref={canvasRef} className="block" />
        </div>
      </div>

      {/* ── URL display ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 uppercase tracking-wider font-medium">{displayLabel}</p>
        <div
          onClick={handleCopyQr}
          className="text-[11px] text-[#1F2348] dark:text-white/70 font-mono break-all px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg border border-[#1F2348]/15 dark:border-white/[0.06] cursor-pointer hover:bg-white/80 dark:hover:bg-black/30 transition-colors select-all"
          title="Click to copy"
        >
          {qrData.length > 80 ? `${qrData.slice(0, 42)}…${qrData.slice(-20)}` : qrData}
        </div>
      </div>

      {/* ── Info note ─────────────────────────────────────────────────────── */}
      {mode === 'request' && (
        <div className="text-[11px] text-[#E9B213] dark:text-gold/75 bg-[#E9B213]/20 dark:bg-gold/8 border border-[#E9B213]/30 dark:border-gold/20 rounded-xl px-3 py-2.5 text-left leading-relaxed">
          <strong className="font-semibold">Share this QR or link.</strong> When someone scans it or taps the link, NimAgent opens with a pre-filled payment of <strong>{amount} NIM</strong> to your wallet — they just confirm.
        </div>
      )}
      {mode === 'nimagent' && (
        <div className="text-[11px] text-[#1F2348]/80 dark:text-white/70 bg-white/80 dark:bg-white/[0.04] border border-[#1F2348]/15 dark:border-white/[0.06] rounded-xl px-3 py-2.5 text-left leading-relaxed">
          Opens NimAgent with your address pre-filled. The sender chooses the amount.
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold bg-white/80 dark:bg-white/[0.06] text-[#1F2348] dark:text-white/75 border border-[#1F2348]/15 dark:border-white/[0.08] hover:bg-white/90 dark:hover:bg-white/[0.10] transition-colors">
          <Icon name="download" size={14} strokeWidth={2} /> {canShare ? 'Share' : 'Save'}
        </button>
        {(mode === 'request' || mode === 'nimagent') && (
          <button onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold bg-[#E9B213]/20 dark:bg-gold/10 text-[#E9B213] dark:text-gold border border-[#E9B213]/30 dark:border-gold/25 hover:bg-[#E9B213]/20 dark:hover:bg-gold/20 transition-colors">
            {linkCopied
              ? <><Icon name="check" size={14} strokeWidth={2.5} /> Copied!</>
              : <><Icon name="copy"  size={14} strokeWidth={2}   /> Copy Link</>
            }
          </button>
        )}
        {mode === 'address' && (
          <button onClick={handleCopyQr}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold bg-[#E9B213]/20 dark:bg-gold/10 text-[#E9B213] dark:text-gold border border-[#E9B213]/30 dark:border-gold/25 hover:bg-[#E9B213]/20 dark:hover:bg-gold/20 transition-colors">
            {copied
              ? <><Icon name="check" size={14} strokeWidth={2.5} /> Copied!</>
              : <><Icon name="copy"  size={14} strokeWidth={2}   /> Copy Address</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

