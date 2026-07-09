import ExplorerScreen from './components/ExplorerScreen';
import MobileBottomNav from './components/MobileBottomNav';
import SideNavBar from './components/SideNavBar';
import TopNavBar from './components/TopNavBar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNavBar activeLabel="All Events" />
      <SideNavBar activeKey="match" />

      <main className="lg:pl-64 pt-16 min-h-screen">
        <ExplorerScreen />
      </main>

      <MobileBottomNav activeKey="live" />
    </div>
  );
}
