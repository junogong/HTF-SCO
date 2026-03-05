import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SupplyGraph from './pages/SupplyGraph';
import Disruption from './pages/Disruption';
import ActionCenter from './pages/ActionCenter';
import Onboarding from './pages/Onboarding';
import SafetyDashboard from './pages/SafetyDashboard';
import StressTest from './pages/StressTest';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [disruptionHistory, setDisruptionHistory] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeResult = activeIndex >= 0 ? disruptionHistory[activeIndex] : null;
  const [dismissedActionIds, setDismissedActionIds] = useState(new Set());

  // Wind Tunnel persisted state
  const [stressTestResult, setStressTestResult] = useState(null);
  const [acceptedScenarios, setAcceptedScenarios] = useState(new Set());

  const handleAddDisruption = (result) => {
    setDisruptionHistory(prev => [result, ...prev]);
    setActiveIndex(0);
  };

  const handleDismissAction = (actionId) => {
    setDismissedActionIds(prev => new Set([...prev, actionId]));
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard
        activeResult={activeResult}
        disruptionHistory={disruptionHistory}
      />;
      case 'graph': return <SupplyGraph analysisResult={activeResult} />;
      case 'disruption': return <Disruption
        disruptionHistory={disruptionHistory}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        onAddDisruption={handleAddDisruption}
      />;
      case 'stress-test': return <StressTest
        onAcceptScenario={handleAddDisruption}
        stressTestResult={stressTestResult}
        setStressTestResult={setStressTestResult}
        acceptedScenarios={acceptedScenarios}
        setAcceptedScenarios={setAcceptedScenarios}
      />;
      case 'actions': return <ActionCenter
        analysisResult={activeResult}
        dismissedActionIds={dismissedActionIds}
        onDismissAction={handleDismissAction}
      />;
      case 'onboarding': return <Onboarding />;
      case 'safety': return <SafetyDashboard disruptionHistory={disruptionHistory} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main style={{ marginLeft: '240px', padding: '32px', flex: 1, position: 'relative', zIndex: 1 }}>
        {renderPage()}
      </main>
    </div>
  );
}
