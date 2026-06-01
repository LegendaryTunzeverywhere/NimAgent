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

export default function PayPage({ params, searchParams }: PayPageProps) {
  const { address } = params;
  const { amount, message } = searchParams;

  // Validate Nimiq address format
  const isValidNimiqAddress = (addr: string): boolean => {
    // Basic validation: starts with NQ and has correct length
    return /^NQ[0-9A-Z\s]{34,}$/.test(addr.replace(/\s/g, ''));
  };

  if (!isValidNimiqAddress(address)) {
    redirect('/?error=invalid-address');
  }

  // For now, redirect to the main app with the address pre-filled
  // In the future, this could be a dedicated payment page
  const queryParams = new URLSearchParams();
  queryParams.set('to', address);
  if (amount) queryParams.set('amount', amount);
  if (message) queryParams.set('message', message);
  
  redirect(`/?${queryParams.toString()}`);
}