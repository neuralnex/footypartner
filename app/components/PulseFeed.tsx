'use client';

import { ArrowsClockwise, Lightning, Warning, IconProps } from '@phosphor-icons/react';
import { ComponentType } from 'react';

export interface PulseFeedEvent {
  id: string | number;
  minute: number;
  title: string;
  body: string;
  category: 'tactical' | 'substitution' | 'card' | 'goal';
  impactLabel?: string;
  impactBody?: string;
  faded?: boolean;
}

const ICON_MAP: Record<PulseFeedEvent['category'], { Icon: ComponentType<IconProps>; tone: 'primary' | 'neutral' | 'error' }> = {
  tactical: { Icon: Lightning, tone: 'primary' },
  substitution: { Icon: ArrowsClockwise, tone: 'neutral' },
  card: { Icon: Warning, tone: 'error' },
  goal: { Icon: Lightning, tone: 'primary' },
};

export default function PulseFeed({ events }: { events: PulseFeedEvent[] }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(45,179,14,0.5)]" />
          <h3 className="text-xl lg:text-2xl font-black text-on-surface tracking-tighter uppercase">
            Pulse Feed
          </h3>
        </div>
        <span className="text-[11px] text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full font-bold uppercase tracking-widest">
          {events.length} Events
        </span>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
        {events.map((e) => (
          <FeedCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}

function FeedCard({ event }: { event: PulseFeedEvent }) {
  const { Icon, tone } = ICON_MAP[event.category];
  const iconBg =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'error'
      ? 'bg-error/10 text-error'
      : 'bg-surface-variant text-on-surface-variant';

  return (
    <article
      className={`group relative bg-surface-container hover:bg-surface-container-high p-5 lg:p-6 rounded-2xl border border-outline-variant/40 transition-all flex gap-4 lg:gap-6 ${
        event.faded ? 'opacity-60 hover:opacity-100' : ''
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_10px_#2db30e] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />
      <div className="flex flex-col items-center shrink-0">
        <span className="text-sm font-bold text-primary tabular-nums">{event.minute}&apos;</span>
        <div className="w-[1px] flex-1 bg-outline-variant/30 my-2" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-1.5 rounded-lg ${iconBg}`}>
            <Icon size={18} weight="bold" />
          </div>
          <h4 className="text-on-surface text-base lg:text-lg uppercase font-bold tracking-tight">
            {event.title}
          </h4>
        </div>
        <p className="text-on-surface-variant mb-4 leading-relaxed text-sm lg:text-body-md">
          {event.body}
        </p>
        {event.impactLabel && event.impactBody && (
          <div className="bg-surface-dim border border-outline-variant/50 p-4 rounded-xl">
            <span className="text-[10px] text-primary uppercase tracking-[0.2em] font-black block mb-2">
              {event.impactLabel}
            </span>
            <p className="text-on-surface text-sm italic font-medium opacity-90">{event.impactBody}</p>
          </div>
        )}
      </div>
    </article>
  );
}
