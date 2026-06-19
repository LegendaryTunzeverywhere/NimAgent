'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';
import Modal from './Modal';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan?: (data: string) => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const { addMessage } = useAppStore();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scanFrameRef = useRef<() => void>(() => {});
  const handleQRDetectedRef = useRef<(data: string) => Promise<void>>(async () => {});

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop all tracks
    if (videoRef.current?.srcObject) {
      const currentStream = videoRef.current.srcObject as MediaStream;
      currentStream.getTracks().forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const startScanning = async () => {
    try {
      stopScanning(); // Ensure any previous scan is stopped first
      setError(null);
      setScanSuccess(false);
      setIsScanning(true);

      // Check secure context — camera API requires HTTPS or localhost
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera requires a secure connection (HTTPS). Please open the app via https://nimagent.online');
        setIsScanning(false);
        return;
      }

      // Check API availability
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not supported in this browser. Try Chrome on Android or Safari on iOS.');
        setIsScanning(false);
        return;
      }

      // Try back camera first, fall back to any camera.
      let mediaStream: MediaStream | null = null;
      const constraintSets = [
        { video: { facingMode: 'environment' } },
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: { facingMode: 'user' } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: true }
      ];

      for (let i = 0; i < constraintSets.length; i++) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
          break;
        } catch (e) {
          // try next set
        }
      }

      if (!mediaStream) {
        throw new Error('Could not access camera. Please allow camera permission and try again.');
      }

      streamRef.current = mediaStream;

      // Ensure all previous tracks are stopped if any exist
      if (videoRef.current?.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }

      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = mediaStream;
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const handleLoaded = () => {
            resolve();
          };
          const handleError = (e: Event) => {
            reject(e);
          };
          
          videoElement.addEventListener('loadedmetadata', handleLoaded, { once: true });
          videoElement.addEventListener('error', handleError, { once: true });
          
          // Timeout in case events don't fire
          setTimeout(() => {
            if (videoElement.readyState >= videoElement.HAVE_METADATA) {
              resolve();
            } else {
              reject(new Error('Video metadata loading timed out'));
            }
          }, 5000);
        });
        // play() returns a Promise — must be awaited on iOS Safari
        try {
          await videoElement.play();
        } catch (e) {
          // Try playing again on user interaction
          const playOnClick = () => {
            videoElement.play().catch(() => {});
            document.body.removeEventListener('click', playOnClick);
          };
          document.body.addEventListener('click', playOnClick, { once: true });
        }

        scanIntervalRef.current = setInterval(() => {
          scanFrameRef.current();
        }, 150); // More frequent scanning for better detection
      }
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
        : err?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : err?.name === 'NotReadableError'
        ? 'Camera is already in use by another app. Close it and try again.'
        : err?.message || 'Camera access failed. Try again or use the manual entry option.';
      setError(msg);
      setIsScanning(false);
      // Ensure any partial stream is cleaned up
      stopScanning();
    }
  };

  // Update refs whenever dependencies change
  useEffect(() => {
    scanFrameRef.current = () => {
      if (!videoRef.current || !canvasRef.current || !isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState < video.HAVE_ENOUGH_DATA) return;

      try {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data from canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Try detecting QR code with all inversion modes
        const inversionOptions = ['attemptBoth', 'dontInvert', 'invertFirst', 'onlyInvert'] as const;
        let code = null;
        
        for (const inversion of inversionOptions) {
          code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: inversion,
          });
          if (code && code.data) {
            break;
          }
        }
        
        if (code && code.data) {
          // QR code detected! Stop scanning first, then handle
          stopScanning();
          handleQRDetectedRef.current(code.data);
        }
      } catch (e) {
        // Silent failure
      }
    };
  }, [isScanning, stopScanning]);

  // Update handleQRDetectedRef whenever dependencies change
  useEffect(() => {
    handleQRDetectedRef.current = async (data: string) => {
      // Show success feedback
      setScanSuccess(true);
      
      // Helper function to normalize Nimiq address (remove spaces)
      const normalizeAddress = (addr: string): string => {
        return addr.replace(/\s/g, '').toUpperCase();
      };

      // Helper function to format Nimiq address with spaces
      const formatAddress = (addr: string): string => {
        const normalized = normalizeAddress(addr);
        return normalized.match(/.{1,4}/g)?.join(' ') || normalized;
      };

      // Helper function to ask about saving address
      const askToSaveAddress = async (address: string) => {
        setTimeout(async () => {
          const { wallet } = useAppStore.getState();
          if (!wallet.address) return;
          
          // Check if this address is already saved
          const { getSavedAddresses } = await import('@/lib/api-client');
          const contacts = await getSavedAddresses(wallet.address);
          const normalized = normalizeAddress(address);
          const alreadySaved = contacts.some(c => normalizeAddress(c.recipient_address) === normalized);
          
          if (!alreadySaved) {
            addMessage({
              role: 'ai',
              content: `Would you like to save this address for future use?\n\nAddress: ${address.substring(0, 10)}...${address.substring(address.length - 6)}\n\nJust say "Save this as [name]" (e.g., "Save this as Friend")`,
            });
          }
        }, 2000);
      };
      
      // Parse QR code data
      const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://nimagent.online';
      
      if (data.startsWith(`${baseUrl}/pay/`) || data.includes('/pay/')) {
        // NimAgent simple pay link: /pay/<address>
        try {
          const url = new URL(data);
          const addressFromUrl = decodeURIComponent(url.pathname.split('/pay/')[1] || '');
          const normalizedAddress = normalizeAddress(addressFromUrl);
          const formattedAddress = formatAddress(normalizedAddress);
          const amount = url.searchParams.get('amount');
          const message = url.searchParams.get('message');
          
          let responseMessage = `QR scanned — NimAgent pay link:\nTo: ${formattedAddress}`;
          if (amount) responseMessage += `\nAmount: ${amount} NIM`;
          if (message) responseMessage += `\nFor: ${message}`;
          
          addMessage({
            role: 'ai',
            content: responseMessage,
            action: {
              type: 'send',
              recipient: formattedAddress,
              amountLuna: amount ? Math.round(parseFloat(amount) * 100000) : 0,
              message: message || undefined,
              locked: !!amount && parseFloat(amount) > 0,
            }
          });
          await askToSaveAddress(formattedAddress);
        } catch {
          addMessage({ role: 'ai', content: `QR scanned but couldn't parse NimAgent pay link: ${data}` });
        }
      } else if (
        // NimAgent payment REQUEST link: /?to=<address>&amount=<nim>&message=<msg>
        (data.startsWith(baseUrl) || data.startsWith('https://nimagent.online')) &&
        data.includes('?') && data.includes('to=')
      ) {
        try {
          const url = new URL(data);
          const to      = url.searchParams.get('to') || '';
          const amount  = url.searchParams.get('amount');
          const message = url.searchParams.get('message');
          const normalizedAddress = normalizeAddress(to);
          const formattedAddress  = formatAddress(normalizedAddress);
          const hasAmount = !!amount && parseFloat(amount) > 0;

          let responseMessage = `Payment request scanned!\n\nTo: ${formattedAddress}`;
          if (amount) responseMessage += `\nAmount: ${amount} NIM`;
          if (message) responseMessage += `\nFor: ${message}`;
          if (hasAmount) responseMessage += `\n\n⚠️ Amount is fixed by the requester and cannot be changed.`;

          addMessage({
            role: 'ai',
            content: responseMessage,
            action: {
              type: 'send',
              recipient: formattedAddress,
              amountLuna: hasAmount ? Math.round(parseFloat(amount!) * 100000) : 0,
              message: message || undefined,
              locked: hasAmount,
            }
          });
          await askToSaveAddress(formattedAddress);
        } catch {
          addMessage({ role: 'ai', content: `QR scanned but couldn't parse payment request: ${data}` });
        }
      } else if (data.toUpperCase().startsWith('NQ') && normalizeAddress(data).length >= 36) {
        // Nimiq address detected (with or without spaces)
        const formattedAddress = formatAddress(data);
        addMessage({
          role: 'ai',
          content: `QR code scanned!\n\nDetected Nimiq address:\n${formattedAddress}\n\nHow much NIM would you like to send to this address?`,
          action: {
            type: 'send',
            recipient: formattedAddress,
            amountLuna: 0,
          }
        });
        
        // Ask if user wants to save this address
        await askToSaveAddress(formattedAddress);
      } else if (data.startsWith('nimiq:')) {
        // Nimiq payment request URI
        try {
          const url = new URL(data);
          const addressFromUri = url.pathname;
          const formattedAddress = formatAddress(addressFromUri);
          const amount = url.searchParams.get('amount');
          
          let message = `QR code scanned! 📷\n\nPayment request detected:\nTo: ${formattedAddress}`;
          if (amount) {
            message += `\nAmount: ${amount} NIM`;
          }
          
          addMessage({
            role: 'ai',
            content: message,
            action: {
              type: 'send',
              recipient: formattedAddress,
              amountLuna: amount ? Math.round(parseFloat(amount) * 100000) : 0,
            }
          });
          
          // Ask if user wants to save this address
          await askToSaveAddress(formattedAddress);
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
          content: `QR code scanned: ${data}\n\nThis doesn't appear to be a Nimiq address, NimAgent payment link, or payment request. Please scan a valid Nimiq QR code.`,
        });
      }

      if (onScan) {
        onScan(data);
      }
    };
  }, [addMessage, onScan]);

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) return;
    setManualOpen(false);
    setManualValue('');
    handleQRDetectedRef.current(value);
  };

  return (
    <>
      <div className="card-premium rounded-2xl p-4 space-y-4 max-w-sm">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 text-gold mb-2">
            <Icon name="qr-scan" size={22} />
          </div>
          <h3 className="text-gray-900 dark:text-white font-semibold">QR Code Scanner</h3>
          <p className="text-gray-600 dark:text-white/50 text-sm mt-0.5">
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
              className="w-full rounded-xl bg-black object-cover"
              playsInline
              muted
              autoPlay
              controls={false}
              style={{ minHeight: '300px' }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-48 h-48 border rounded-xl relative transition-all ${
                scanSuccess ? 'border-success border-2' : 'border-white/20'
              }`}>
                <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-xl transition-colors ${
                  scanSuccess ? 'border-success' : 'border-gold'
                }`} />
                <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-xl transition-colors ${
                  scanSuccess ? 'border-success' : 'border-gold'
                }`} />
                <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-xl transition-colors ${
                  scanSuccess ? 'border-success' : 'border-gold'
                }`} />
                <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-xl transition-colors ${
                  scanSuccess ? 'border-success' : 'border-gold'
                }`} />
                
                {/* Success checkmark */}
                {scanSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center bg-success/20 rounded-xl animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                      <Icon name="check" size={32} strokeWidth={3} className="text-white" />
                    </div>
                  </div>
                )}
                
                {/* Scanning line animation */}
                {!scanSuccess && (
                  <div className="absolute inset-0 overflow-hidden rounded-xl">
                    <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent animate-scan" />
                  </div>
                )}
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
            className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/[0.07] font-semibold hover:bg-gray-200 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white/90 transition-colors"
            title="Enter code manually"
          >
            <Icon name="plus" size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-start gap-2 text-gray-500 dark:text-white/40 text-xs">
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
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
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
          placeholder="NQ.. address, https://nimagent.online/pay/..., or nimiq:..."
          className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-mono placeholder-gray-500 dark:placeholder-white/25 outline-none focus:border-amber-500 dark:focus:border-gold/50 resize-none break-all"
        />
        <p className="text-gray-500 dark:text-white/30 text-[11px] mt-2">Press ⌘/Ctrl + Enter to submit</p>
      </Modal>
    </>
  );
}