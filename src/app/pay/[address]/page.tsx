<<<<<<< HEAD
import { redirect } from 'next/navigation';

interface PayPageProps {
  params: {
    address: string;
  };
  searchParams: {
    amount?: string;
    message?: string;
  };
}

// Normalize Nimiq address by removing spaces and converting to uppercase
function normalizeNimiqAddress(addr: string): string {
  return addr.replace(/\s/g, '').toUpperCase();
}

// Format Nimiq address with spaces (human-readable format)
function formatNimiqAddress(addr: string): string {
  const normalized = normalizeNimiqAddress(addr);
  // Insert space every 4 characters: NQ75 UB04 2A5U PCUR 7VNR F73J TP2C Q9UD YB16
  return normalized.match(/.{1,4}/g)?.join(' ') || normalized;
}

export default function PayPage({ params, searchParams }: PayPageProps) {
  const { address } = params;
  const { amount, message } = searchParams;

  // Decode URL-encoded address and normalize it
  const decodedAddress = decodeURIComponent(address);
  const normalizedAddress = normalizeNimiqAddress(decodedAddress);

  // Validate Nimiq address format (36 characters without spaces, starts with NQ)
  const isValidNimiqAddress = (addr: string): boolean => {
    return /^NQ[0-9A-Z]{34}$/.test(addr);
  };

  if (!isValidNimiqAddress(normalizedAddress)) {
    redirect('/?error=invalid-address');
  }

  // Format address with spaces for display
  const formattedAddress = formatNimiqAddress(normalizedAddress);

  // For now, redirect to the main app with the address pre-filled
  // In the future, this could be a dedicated payment page
  const queryParams = new URLSearchParams();
  queryParams.set('to', formattedAddress);
  if (amount) queryParams.set('amount', amount);
  if (message) queryParams.set('message', message);
  
  redirect(`/?${queryParams.toString()}`);
}
=======
import { redirect } from 'next/navigation';

interface PayPageProps {
  params: {
    address: string;
  };
  searchParams: {
    amount?: string;
    message?: string;
  };
}

// Normalize Nimiq address by removing spaces and converting to uppercase
function normalizeNimiqAddress(addr: string): string {
  return addr.replace(/\s/g, '').toUpperCase();
}

// Format Nimiq address with spaces (human-readable format)
function formatNimiqAddress(addr: string): string {
  const normalized = normalizeNimiqAddress(addr);
  // Insert space every 4 characters: NQ75 UB04 2A5U PCUR 7VNR F73J TP2C Q9UD YB16
  return normalized.match(/.{1,4}/g)?.join(' ') || normalized;
}

export default function PayPage({ params, searchParams }: PayPageProps) {
  const { address } = params;
  const { amount, message } = searchParams;

  // Decode URL-encoded address and normalize it
  const decodedAddress = decodeURIComponent(address);
  const normalizedAddress = normalizeNimiqAddress(decodedAddress);

  // Validate Nimiq address format (36 characters without spaces, starts with NQ)
  const isValidNimiqAddress = (addr: string): boolean => {
    return /^NQ[0-9A-Z]{34}$/.test(addr);
  };

  if (!isValidNimiqAddress(normalizedAddress)) {
    redirect('/?error=invalid-address');
  }

  // Format address with spaces for display
  const formattedAddress = formatNimiqAddress(normalizedAddress);

  // For now, redirect to the main app with the address pre-filled
  // In the future, this could be a dedicated payment page
  const queryParams = new URLSearchParams();
  queryParams.set('to', formattedAddress);
  if (amount) queryParams.set('amount', amount);
  if (message) queryParams.set('message', message);
  
  redirect(`/?${queryParams.toString()}`);
}
>>>>>>> fe7c71977bd3a17b2432805024c7c963bcd1e6b5
