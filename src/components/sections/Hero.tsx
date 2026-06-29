
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { safeJson } from '@/lib/utils';

export default function Hero() {
  const router = useRouter();
  const [data, setData] = useState({
    title: "Institutional Global Liquidity Network",
    description: "Connect to the world's most robust trading ecosystem. Precision execution across crypto and forex, powered by Orng's high-fidelity backbone.",
    imageUrl: "/Group 2.png"
  });

  useEffect(() => {
    const fetchHero = async () => {
      try {
        const response = await fetch('/api/content', { cache: 'no-store' });
        const data = await safeJson(response);
        if (response.ok && data?.success && data.content?.hero) {
          setData(data.content.hero);
        } else if (!response.ok) {
          console.warn('Hero content fetch failed', response.status, data);
        }
      } catch (error) {
        console.error('Error fetching hero content:', error);
      }
    };
    fetchHero();
  }, []);

  const handleAdminAccess = () => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('igrow_admin_token') : null;
    router.push(token === 'authenticated' ? '/admin/dashboard' : '/admin');
  };

  return (
    <section 
      className="relative w-full m-0 p-0 overflow-visible min-h-[90vh] flex flex-col"
      style={{ background: 'linear-gradient(to bottom, #080D1B 0%, #0A1122 100%)' }}
    >
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center pt-32 md:pt-40 pb-0">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-[95rem] mx-auto space-y-8 md:space-y-12">
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-headline font-bold leading-[1.2] tracking-normal text-white">
              {data.title.split('<br />').map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))}
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/60 font-medium max-w-4xl mx-auto leading-[1.4] px-4">
              {data.description}
            </p>
            <div className="flex justify-center pt-2 md:pt-4">
              <Button size="lg" className="h-16 md:h-20 px-10 md:px-16 text-lg md:text-2xl font-bold rounded-full bg-primary text-black hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 active:scale-95" onClick={handleAdminAccess}>
                Get Started
                <ArrowRight className="ml-4 w-6 h-6 md:w-8 md:h-8" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-0 mx-0 mt-8 pb-0">
        <div className="relative w-full overflow-hidden">
          <Image
            src={data.imageUrl}
            alt="OrngFinance Dashboard"
            width={2560}
            height={1080}
            className="w-full h-auto block opacity-95"
            priority
            quality={100}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080D1B] via-transparent to-transparent opacity-80 pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
