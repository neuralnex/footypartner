'use client';

import { useEffect, useState } from 'react';
import DashboardSkeleton from '@/app/components/DashboardSkeleton';
import MobileBottomNav from '@/app/components/MobileBottomNav';
import OnAirButton from '@/app/components/OnAirButton';
import PulseFeed, { PulseFeedEvent } from '@/app/components/PulseFeed';
import ScoreBanner from '@/app/components/ScoreBanner';
import SideNavBar from '@/app/components/SideNavBar';
import TopNavBar from '@/app/components/TopNavBar';
import WinProbabilityChart from '@/app/components/WinProbabilityChart';

const MOCK_EVENTS: PulseFeedEvent[] = [
  {
    id: 1,
    minute: 71,
    title: 'High Intensity Press',
    body:
      "Manchester City increases verticality. De Bruyne finds space in the half-space, forcing the back four into a deeper defensive block.",
    category: 'tactical',
    impactLabel: 'Tactical Impact',
    impactBody:
      'Expected Threat (xT) jumped by 0.14 in the last 3 minutes. Goal probability rising significantly.',
  },
  {
    id: 2,
    minute: 68,
    title: 'Tactical Substitution',
    body:
      'Arteta brings on Trossard for Martinelli. Fresh energy in the wide channel to relieve pressure and exploit high positioning during defensive transitions.',
    category: 'substitution',
    impactLabel: "Coach's Intent",
    impactBody:
      'Fresh legs in the wide channel to exploit high positioning during defensive transitions.',
  },
  {
    id: 3,
    minute: 64,
    title: 'Yellow Card — Rodri',
    body:
      "Tactical foul to stop an Odegaard break-away. The anchor of City's midfield is now on a warning.",
    category: 'card',
    faded: true,
  },
];

interface FixtureDashboardProps {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
}

export default function FixtureDashboard({ fixtureId, homeTeam, awayTeam }: FixtureDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [voiceLoading, setVoiceLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const playVoice = () => {
    setVoiceLoading(true);
    setTimeout(() => setVoiceLoading(false), 2200);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <TopNavBar activeLabel="All Events" />
      <SideNavBar activeKey="match" />

      <main className="lg:pl-64 pt-16 min-h-screen">
        <div className="px-4 md:px-margin-desktop py-6 lg:py-8 pb-32 space-y-6 lg:space-y-8">
          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <ScoreBanner
                data={{
                  homeName: homeTeam,
                  homeCode: homeTeam.slice(0, 3),
                  homeScore: 2,
                  awayName: awayTeam,
                  awayCode: awayTeam.slice(0, 3),
                  awayScore: 1,
                  minute: 72,
                  status: 'live',
                }}
              />
              <WinProbabilityChart team={homeTeam.slice(0, 4).toUpperCase()} initialValue={68.4} />
              <PulseFeed events={MOCK_EVENTS} />
              <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest font-bold">
                Fixture {fixtureId} · Broadcast Pulse Feed
              </p>
            </>
          )}
        </div>
      </main>

      <OnAirButton awaiting={isLoading} loading={voiceLoading} onClick={playVoice} />
      <MobileBottomNav activeKey="pulse" />
    </div>
  );
}
