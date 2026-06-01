'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';
import Modal from './Modal';

interface QRScannerProps {
  onScan?: (data: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const { addMessage } = useAppStore();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();

        // Start scanning for QR codes
        scanIntervalRef.current = setInterval(() => {
          scanFrame();
        }, 500);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(err.message || 'Camera access denied');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // For now, we'll simulate QR detection
    // In a real implementation, you'd use a QR code detection library here
    // like jsQR or qr-scanner to analyze the canvas image data
    
    // Placeholder for QR detection logic
    // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
    
    // if (qrCode) {
    //   handleQRDetected(qrCode.data);
    // }
  };

  const handleQRDetected = (data: string) => {
    stopScanning();
    
    // Parse QR code data
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nimhub.vercel.app';
    
    if (data.startsWith(`${baseUrl}/pay/`)) {
      // NimHub payment link detected
      try {
        const url = new URL(data);
        const address = url.pathname.split('/pay/')[1];
        const amount = url.searchParams.get('amount');
        const message = url.searchParams.get('message');
        
        let responseMessage = `QR code scanned! 📷\n\nNimHub payment link detected:\nTo: ${address}`;
        if (amount) {
          responseMessage += `\nAmount: ${amount} NIM`;
        }
        if (message) {
          responseMessage += `\nMessage: ${message}`;
        }
        
        addMessage({
          role: 'ai',
          content: responseMessage,
          action: {
            type: 'send',
            recipient: address,
            amountLuna: amount ? Math.round(parseFloat(amount) * 100000) : 0,
          }
        });
      } catch (err) {
        addMessage({
          role: 'ai',
          content: `QR code scanned but couldn't parse NimHub payment link: ${data}`,
        });
      }
    } else if (data.startsWith('NQ') && data.length >= 36) {
      // Nimiq address detected
      addMessage({
        role: 'ai',
        content: `QR code scanned! 📷\n\nDetected Nimiq address:\n${data}\n\nHow much NIM would you like to send to this address?`,
        action: {
          type: 'send',
          recipient: data,
          amountLuna: 0,
        }
      });
    } else if (data.startsWith('nimiq:')) {
      // Nimiq payment request URI
      try {
        const url = new URL(data);
        const address = url.pathname;
        const amount = url.searchParams.get('amount');
        
        let message = `QR code scanned! 📷\n\nPayment request detected:\nTo: ${address}`;
        if (amount) {
          message += `\nAmount: ${amount} NIM`;
        }
        
        addMessage({
          role: 'ai',
          content: message,
          action: {
            type: 'send',
            recipient: address,
            amountLuna: amount ? Math.round(parseFloat(amount) * 100000) : 0,
          }
        });
      } catch (err) {
        addMessage({
          role: 'ai',
          content: `QR code scanned but couldn't parse payment request: ${data}`,
        });
      }
    } else {
      // Unknown QR code format
      addMessage({
        role: 'ai',
        content: `QR code scanned: ${data}\n\nThis doesn't appear to be a Nimiq address, NimHub payment link, or payment request. Please scan a valid Nimiq QR code.`,
      });
    }

    if (onScan) {
      onScan(data);
    }
  };

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) return;
    setManualOpen(false);
    setManualValue('');
    handleQRDetected(value);
  };

  return (
    <>
      <div className="card-premium rounded-2xl p-4 space-y-4 max-w-sm">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 text-gold mb-2">
            <Icon name="qr-scan" size={22} />
          </div>
          <h3 className="text-white font-semibold">QR Code Scanner</h3>
          <p className="text-white/50 text-sm mt-0.5">
            {isScanning ? 'Point your camera at a QR code' : 'Scan Nimiq addresses or payment requests'}
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
            <span className="text-error mt-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
            </span>
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {isScanning && (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-xl bg-black"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border border-white/20 rounded-xl relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-gold rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-gold rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-gold rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-gold rounded-br-xl" />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isScanning ? (
            <button
              onClick={startScanning}
              className="btn-gold flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Icon name="qr-scan" size={17} strokeWidth={2} />
              Start Scanning
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="flex-1 py-3 rounded-xl bg-error/15 text-error font-semibold border border-error/20 hover:bg-error/25 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              Stop Scanning
            </button>
          )}

          <button
            onClick={() => setManualOpen(true)}
            className="px-4 py-3 rounded-xl bg-white/[0.04] text-white/60 border border-white/[0.07] font-semibold hover:bg-white/[0.08] hover:text-white/90 transition-colors"
            title="Enter code manually"
          >
            <Icon name="plus" size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-start gap-2 text-white/40 text-xs">
          <span className="text-gold mt-0.5">
            <Icon name="qr-code" size={13} strokeWidth={2} />
          </span>
          <p>You can also generate a QR code for your address by asking &ldquo;show my address&rdquo;.</p>
        </div>
      </div>

      {/* Manual entry modal */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Enter QR Code Data"
        subtitle="Paste a Nimiq address, payment link, or nimiq: URI"
        footer={
          <>
            <button
              onClick={() => setManualOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleManualSubmit}
              disabled={!manualValue.trim()}
              className="btn-gold px-4 py-2 rounded-lg text-sm"
            >
              Continue
            </button>
          </>
        }
      >
        <textarea
          autoFocus
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleManualSubmit();
          }}
          rows={3}
          placeholder="NQ.. address, https://nimhub.vercel.app/pay/..., or nimiq:..."
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono placeholder-white/25 outline-none focus:border-gold/50 resize-none break-all"
        />
        <p className="text-white/30 text-[11px] mt-2">Press ⌘/Ctrl + Enter to submit</p>
      </Modal>
    </>
  );
}