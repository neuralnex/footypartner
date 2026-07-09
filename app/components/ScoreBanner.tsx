'use client';

export interface ScoreBannerData {
  homeName: string;
  homeCode: string;
  homeScore: number;
  awayName: string;
  awayCode: string;
  awayScore: number;
  minute: number;
  status: 'live' | 'ft' | 'ht';
}

export default function ScoreBanner({ data }: { data: ScoreBannerData }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-container border border-outline-variant/40 min-h-[220px] md:min-h-[280px] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

      <div className="relative z-10 flex flex-col items-center gap-6 md:gap-8 w-full max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between w-full gap-4">
          <TeamBlock name={data.homeName} code={data.homeCode} align="right" />

          <div className="flex flex-col items-center justify-center px-2 md:px-8 shrink-0">
            <div className="bg-primary/10 border border-primary/30 px-3 py-1 rounded-full mb-3 md:mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-primary font-bold tracking-widest uppercase">
                Live {data.minute}&apos;
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              <span className="text-5xl md:text-7xl lg:text-8xl text-on-surface font-black leading-none">
                {data.homeScore}
              </span>
              <span className="text-3xl md:text-5xl text-on-surface-variant/30 font-black">:</span>
              <span className="text-5xl md:text-7xl lg:text-8xl text-on-surface font-black leading-none">
                {data.awayScore}
              </span>
            </div>
          </div>

          <TeamBlock name={data.awayName} code={data.awayCode} align="left" />
        </div>
      </div>
    </section>
  );
}

function TeamBlock({ name, code, align }: { name: string; code: string; align: 'left' | 'right' }) {
  return (
    <div
      className={`flex flex-col items-center gap-3 flex-1 min-w-0 ${
        align === 'right' ? 'md:items-end' : 'md:items-start'
      }`}
    >
      <div className="w-14 h-14 md:w-20 md:h-20 bg-surface-container-high rounded-2xl flex items-center justify-center border border-outline-variant hover:border-primary transition-colors group">
        <span className="text-lg md:text-2xl font-black text-primary tracking-widest group-hover:scale-110 transition-transform">
          {code.slice(0, 3).toUpperCase()}
        </span>
      </div>
      <span className="text-sm md:text-2xl lg:text-3xl text-on-surface font-extrabold uppercase tracking-tight text-center md:text-left truncate max-w-full">
        {name}
      </span>
    </div>
  );
}
