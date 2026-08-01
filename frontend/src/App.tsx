import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationTab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { UsersView } from './components/UsersView';
import { GraphExplorerView } from './components/GraphExplorerView';
import { AIChatView } from './components/AIChatView';
import { UploadCenterView } from './components/UploadCenterView';
import { DocumentsView } from './components/DocumentsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ReportsView } from './components/ReportsView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';
import { AccessDeniedView } from './components/AccessDeniedView';
import { LoginView } from './components/LoginView';

// ─── React Query client (shared across the app) ───────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Main Application (rendered after auth) ───────────────────────────────────
const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const { canAccessTab } = useAuth();

  const handleNavigate = (tab: NavigationTab) => {
    setActiveTab(tab);
  };

  const renderActiveView = () => {
    // Strict Route Protection Check
    if (!canAccessTab(activeTab)) {
      return (
        <AccessDeniedView
          attemptedTab={activeTab.toUpperCase()}
          onReturnDashboard={() => handleNavigate('dashboard')}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'projects':
        return <ProjectsView />;
      case 'users':
        return <UsersView />;
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
      case 'reports':
        return <ReportsView />;
      case 'logs':
        return <AuditLogsView />;
      case 'settings':
        return <SettingsView />;
      case '403':
        return (
          <AccessDeniedView
            attemptedTab="Restricted Route"
            onReturnDashboard={() => handleNavigate('dashboard')}
          />
        );
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Dynamic Role Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={handleNavigate} />

      {/* Main App Canvas */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen bg-slate-50">
        {/* Header Bar with Role Switcher */}
        <Header activeTab={activeTab} />

        {/* Protected View Canvas */}
        <main className="flex-1 pt-20 p-8 overflow-x-hidden bg-slate-50">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────
const AuthGate: React.FC = () => {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 animate-pulse">
            <span className="material-symbols-outlined text-white text-2xl fill">hub</span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading Enterprise Platform…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginView />;
  return <MainApp />;
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}
