import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SupplyGraph from './pages/SupplyGraph';
import Disruption from './pages/Disruption';
import ActionCenter from './pages/ActionCenter';

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

      case 'safety': return <SafetyDashboard disruptionHistory={disruptionHistory} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
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
