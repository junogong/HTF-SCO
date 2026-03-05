import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SupplyGraph from './pages/SupplyGraph';
import Disruption from './pages/Disruption';
import ActionCenter from './pages/ActionCenter';
import api from './api/client';

import SafetyDashboard from './pages/SafetyDashboard';
import StressTest from './pages/StressTest';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [disruptionHistory, setDisruptionHistory] = useState([]);
  const [signals, setSignals] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeResult = activeIndex >= 0 ? disruptionHistory[activeIndex] : null;
  const [dismissedActionIds, setDismissedActionIds] = useState(new Set());

  // Wind Tunnel persisted state
  const [stressTestResult, setStressTestResult] = useState(null);
  const [acceptedScenarios, setAcceptedScenarios] = useState(new Set());

  // ── Background Poller for Proactive Agent Workflows ─────────
  useEffect(() => {
    const poll = async () => {
      try {
        // 1. Trigger the background scraper
        const scrapeRes = await api.post('/cron/scrape-finviz');

        // 2. Fetch the latest classified signals (instant feedback)
        const signalsRes = await api.get('/cron/scraped-signals');
        if (signalsRes.data.signals) {
          setSignals(signalsRes.data.signals.reverse());
        }

        // 3. Fetch auto-analyzed disruptions if some were processed
        if (scrapeRes.data.auto_analyzed_started > 0 || disruptionHistory.length === 0) {
          const disruptionsRes = await api.get('/cron/auto-disruptions');
          const newDisruptions = disruptionsRes.data.disruptions || [];

          setDisruptionHistory(prev => {
            const currentIds = new Set(prev.map(d => d.strategy_id || d.strategy?.name));
            const additions = newDisruptions.filter(d => !currentIds.has(d.strategy_id || d.strategy?.name));
            // Prepend newest on top
            return [...additions.reverse(), ...prev];
          });
        }
      } catch (err) {
        console.error("Background poller error:", err);
      }
    };

    poll();
    // Poll every 1 minute thereafter
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Compute Global Pending Actions ──────────────────────────
  const pendingActionsCount = disruptionHistory.reduce((count, disruption) => {
    const actions = disruption.actions || [];
    const pendingForDisruption = actions.filter(a => !dismissedActionIds.has(a.id)).length;
    return count + pendingForDisruption;
  }, 0);

  const handleAddDisruption = (result) => {
    setDisruptionHistory(prev => [result, ...prev]);
    setActiveIndex(0);
  };

  const handleRemoveDisruption = (indexToRemove) => {
    setDisruptionHistory(prev => {
      const updated = prev.filter((_, i) => i !== indexToRemove);
      // Adjust activeIndex after removal
      if (updated.length === 0) {
        setActiveIndex(-1);
      } else if (activeIndex === indexToRemove) {
        setActiveIndex(Math.min(indexToRemove, updated.length - 1));
      } else if (activeIndex > indexToRemove) {
        setActiveIndex(activeIndex - 1);
      }
      return updated;
    });
  };

  const handleDismissAction = (actionId) => {
    setDismissedActionIds(prev => new Set([...prev, actionId]));
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard
        activeResult={activeResult}
        disruptionHistory={disruptionHistory}
        signals={signals}
      />;
      case 'graph': return <SupplyGraph analysisResult={activeResult} />;
      case 'disruption': return <Disruption
        disruptionHistory={disruptionHistory}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        onAddDisruption={handleAddDisruption}
        onRemoveDisruption={handleRemoveDisruption}
      />;
      case 'stress-test': return <StressTest
        onAcceptScenario={handleAddDisruption}
        stressTestResult={stressTestResult}
        setStressTestResult={setStressTestResult}
        acceptedScenarios={acceptedScenarios}
        setAcceptedScenarios={setAcceptedScenarios}
        onNavigate={setActivePage}
      />;
      case 'actions': return <ActionCenter
        analysisResult={activeResult}
        disruptionHistory={disruptionHistory}
        dismissedActionIds={dismissedActionIds}
        onDismissAction={handleDismissAction}
      />;

      case 'safety': return <SafetyDashboard disruptionHistory={disruptionHistory} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar activePage={activePage} onNavigate={setActivePage} pendingActionsCount={pendingActionsCount} />
      <main style={{
        paddingLeft: '240px', // Offset for the fixed left sidebar
        paddingRight: '240px', // Symmetric offset on the right for perfect center
        paddingTop: '32px',
        paddingBottom: '32px',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="w-full max-w-[1200px]">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
