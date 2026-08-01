import React, { useState } from 'react';
import { NavigationTab } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { GraphExplorerView } from './components/GraphExplorerView';
import { AIChatView } from './components/AIChatView';
import { UploadCenterView } from './components/UploadCenterView';
import { DocumentsView } from './components/DocumentsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  const handleNavigate = (tab: NavigationTab) => {
    setActiveTab(tab);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'knowledge-graph':
      case 'explorer':
        return <GraphExplorerView />;
      case 'chat':
        return <AIChatView onNavigate={handleNavigate} />;
      case 'upload':
        return <UploadCenterView onNavigate={handleNavigate} />;
      case 'documents':
        return <DocumentsView onNavigate={handleNavigate} />;
      case 'analytics':
        return <AnalyticsView onNavigate={handleNavigate} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {/* Fixed Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={handleNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <Header activeTab={activeTab} />

        {/* Dynamic Route View */}
        <main className="flex-1 pt-20 p-8 overflow-x-hidden">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
