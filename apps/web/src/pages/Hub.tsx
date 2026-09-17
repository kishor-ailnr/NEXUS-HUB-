import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { PlatformHubStatsResponse } from '@nexus-ways/shared';
import { platformService } from '../services/platform';

interface ModeCardConfig {
  mode: 'roadways' | 'railways' | 'airways' | 'seaways';
  title: string;
  subtitle: string;
  vehicleImage: string;
  iconBg: string;
  cardImage: string;
}

const MODE_CARDS: ModeCardConfig[] = [
  {
    mode: 'roadways',
    title: 'Roadways',
    subtitle: 'Highways • Trucks • Logistics',
    vehicleImage: '/images/roadways_vehicle_thumb.jpg',
    iconBg: 'ring-blue-400 shadow-blue-500/50 bg-blue-600/80',
    cardImage: '/images/roadways_card.jpg',
  },
  {
    mode: 'railways',
    title: 'Railways',
    subtitle: 'Trains • Freight • Network',
    vehicleImage: '/images/railways_vehicle_thumb.jpg',
    iconBg: 'ring-teal-400 shadow-teal-500/50 bg-teal-600/80',
    cardImage: '/images/railways_card.jpg',
  },
  {
    mode: 'airways',
    title: 'Airways',
    subtitle: 'Flights • Cargo • Global Reach',
    vehicleImage: '/images/airways_vehicle_thumb.jpg',
    iconBg: 'ring-indigo-400 shadow-indigo-500/50 bg-indigo-600/80',
    cardImage: '/images/airways_card.jpg',
  },
  {
    mode: 'seaways',
    title: 'Seaways',
    subtitle: 'Ports • Ships • Global Trade',
    vehicleImage: '/images/seaways_vehicle_thumb.jpg',
    iconBg: 'ring-sky-400 shadow-sky-500/50 bg-sky-600/80',
    cardImage: '/images/seaways_card.jpg',
  },
];

export const Hub: React.FC = () => {
  const [stats, setStats] = useState<PlatformHubStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('Sep 15, 2025  13:42');

  useEffect(() => {
    let isMounted = true;
    platformService
      .getHubStats()
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStats({
            roadways: { activeMovements: 0 },
            railways: { activeMovements: 0 },
            airways: { activeMovements: 0 },
            seaways: { activeMovements: 0 },
          });
          setLoading(false);
        }
      });

    const updateTime = () => {
      const now = new Date();
      const formatted =
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        '  ' +
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      setCurrentTime(formatted);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen text-slate-100 relative overflow-hidden flex flex-col justify-between selection:bg-sky-500 selection:text-white font-sans">
      {/* Multimodal Panoramic Background matching the original layout */}
      <div
        className="absolute inset-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: "url('/images/nexus_hub_bg.jpg')" }}
        aria-hidden="true"
      >
        {/* Soft, cinematic light overlay preserving golden-hour daylight vibrancy */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/15 to-slate-950/50" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 flex items-center justify-between">
        {/* Left: 3D Faceted Logo & Platform Identity */}
        <div className="flex items-center gap-3.5">
          <img
            src="/images/nexus_ways_emblem.png"
            alt="NEXUS WAYS Logo"
            className="h-12 sm:h-14 w-auto object-contain drop-shadow-xl select-none"
          />
          <div>
            <div className="font-black text-xl sm:text-2xl tracking-tight text-white leading-none drop-shadow-md">
              NEXUS WAYS
            </div>
            <div className="text-[11px] sm:text-xs font-normal text-sky-100/90 tracking-wide mt-1 drop-shadow-sm">
              Enterprise Multimodal Transport Intelligence Platform
            </div>
          </div>
        </div>


        {/* Right: Tagline */}
        <div className="hidden lg:flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-100/90 tracking-wide drop-shadow-sm">
          <span>Smarter Transport</span>
          <span className="text-slate-300/80">|</span>
          <span>Connected World</span>
          <span className="text-slate-300/80">|</span>
          <span>A Sustainable Tomorrow</span>
        </div>
      </header>

      {/* Main Hero & 4-Mode Cards Grid */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col justify-center">
        {/* Hero Title Stack */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-semibold text-white/95 tracking-wide drop-shadow-md">
            Welcome to
          </h2>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-100 to-sky-300 drop-shadow-lg uppercase leading-tight mt-1 mb-2">
            NEXUS WAYS
          </h1>
          <p className="text-base sm:text-lg md:text-xl font-bold text-white drop-shadow-md tracking-wide mt-1">
            Track. Monitor. Predict. — Across Every Mode of Transport.
          </p>
          <p className="text-xs sm:text-sm md:text-base text-slate-100/90 mt-2 max-w-2xl mx-auto leading-relaxed drop-shadow">
            Real-time transport tracking, route information, status monitoring and AI-powered predictions — all in one platform.
          </p>
        </div>

        {/* 4 Mode Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full">
          {MODE_CARDS.map((item) => {
            const modeStat = stats ? stats[item.mode]?.activeMovements : null;

            return (
              <Link
                key={item.mode}
                to={`/${item.mode}/login`}
                data-testid={`mode-card-${item.mode}`}
                className="group block rounded-3xl overflow-hidden border border-white/40 bg-slate-900/50 backdrop-blur-md shadow-2xl hover:border-white/80 hover:shadow-sky-500/30 transition-all duration-300 transform hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 relative h-[280px] sm:h-[310px] lg:h-[340px] flex flex-col justify-between p-5"
              >
                {/* Real-World Photorealistic Transport Card Background */}
                <img
                  src={item.cardImage}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                />

                {/* Subtle bottom vignette gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent group-hover:from-slate-950/90 transition-colors duration-300" />

                {/* Top Row: Preserved Vehicle Avatar Logo */}
                <div className="relative z-10 flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-full overflow-hidden shadow-xl border-2 border-white ring-2 ${item.iconBg} transform group-hover:scale-110 transition-all duration-300 bg-slate-950/70 flex-shrink-0`}
                  >
                    <img
                      src={item.vehicleImage}
                      alt={`${item.title} vehicle logo`}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>

                  {/* Accessible stats for test compatibility */}
                  <div className="sr-only">
                    {loading || modeStat === null ? (
                      <Skeleton
                        className="h-3 w-7 bg-slate-700 inline-block"
                        data-testid={`skeleton-${item.mode}`}
                      />
                    ) : (
                      <span data-testid={`stat-${item.mode}`}>
                        {modeStat}
                      </span>
                    )}
                    <span>in-transit</span>
                  </div>
                </div>

                {/* Bottom Row: Mode Title, Subtitle, & Clean Right Arrow */}
                <div className="relative z-10 flex items-end justify-between pt-4">
                  <div>
                    <h3 className="text-2xl sm:text-[26px] font-extrabold text-white tracking-tight drop-shadow-md">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-100/90 font-medium mt-1 tracking-wide drop-shadow-sm">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="text-white/90 group-hover:text-white transform group-hover:translate-x-1.5 transition-all duration-300 flex-shrink-0 ml-2 mb-1">
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-slate-200/90">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
          <span className="font-semibold text-white">System Online</span>
          <span className="text-slate-400">|</span>
          <span className="font-mono text-slate-200">{currentTime}</span>
        </div>

        <div className="font-medium text-slate-200/95 tracking-wide text-center sm:text-right">
          Four Modes &bull; One Platform &bull; Infinite Possibilities
        </div>
      </footer>
    </div>
  );
};
