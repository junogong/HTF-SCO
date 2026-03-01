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
  const [analysisResult, setAnalysisResult] = useState(null);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'graph': return <SupplyGraph analysisResult={analysisResult} />;
      case 'disruption': return <Disruption onResult={setAnalysisResult} />;
      case 'stress-test': return <StressTest />;
      case 'actions': return <ActionCenter analysisResult={analysisResult} />;
      case 'onboarding': return <Onboarding />;
      case 'safety': return <SafetyDashboard />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main style={{ marginLeft: '220px', padding: '32px', flex: 1 }}>
        {renderPage()}
      </main>
    </div>
  );
}
