'use client';
import { usePathname, useRouter } from 'next/navigation';

export default function HomeButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  return (
    <button
      onClick={() => router.push('/')}
      aria-label="Accueil"
      className="fixed bottom-6 left-4 z-50 bg-white border-2 border-green-700 text-green-700 rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:bg-green-50 text-2xl"
    >
      🏠
    </button>
  );
}
