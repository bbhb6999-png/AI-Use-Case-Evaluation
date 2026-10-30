/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import Workbench from './components/Workbench';
import ModulePage from './components/ModulePage';
import EvaluationManagement from './components/EvaluationManagement';
import DataAnnotation from './components/DataAnnotation';
import InterfaceEvaluation from './components/InterfaceEvaluation';
import ResourceEvaluation from './components/ResourceEvaluation';
import DataProcessing from './components/DataProcessing';
import ResultVerification from './components/ResultVerification';
import SystemManagement from './components/SystemManagement';
import { NAV_ITEMS } from './constants';
import { StoreProvider, Toasts } from './store';

export default function App() {
  const [activeTab, setActiveTab] = useState('workbench');
  const [activeSubTab, setActiveSubTab] = useState('');

  const navigate = (tabId: string, subTabId: string = '') => {
    setActiveTab(tabId);
    if (subTabId) {
      setActiveSubTab(subTabId);
    } else {
      const nav = NAV_ITEMS.find(n => n.id === tabId);
      setActiveSubTab(nav?.subItems?.[0]?.id || '');
    }
  };

  const renderContent = () => {
    if (activeTab === 'workbench') {
      return <Workbench navigate={navigate} />;
    }

    if (activeTab === 'evaluation') {
      return <EvaluationManagement activeSubTab={activeSubTab} navigate={navigate} />;
    }

    if (activeTab === 'annotation') {
      return <DataAnnotation activeSubTab={activeSubTab} />;
    }

    if (activeTab === 'interface') {
      return <InterfaceEvaluation activeSubTab={activeSubTab} navigate={navigate} />;
    }

    if (activeTab === 'resource') {
      return <ResourceEvaluation activeSubTab={activeSubTab} navigate={navigate} />;
    }

    if (activeTab === 'data-proc') {
      return <DataProcessing activeSubTab={activeSubTab} />;
    }

    if (activeTab === 'verification') {
      return <ResultVerification activeSubTab={activeSubTab} navigate={navigate} />;
    }

    if (activeTab === 'system') {
      return <SystemManagement activeSubTab={activeSubTab} />;
    }

    const currentNav = NAV_ITEMS.find(item => item.id === activeTab);
    const currentSub = currentNav?.subItems?.find(sub => sub.id === activeSubTab);

    return (
      <ModulePage 
        title={currentSub?.label || currentNav?.label || '模块'} 
        subtitle={`公安人工智能场景评测一体化平台 - ${currentNav?.label}`}
      />
    );
  };

  return (
    <StoreProvider>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={(id) => {
          setActiveTab(id);
          if (id !== activeTab) {
            const nav = NAV_ITEMS.find(n => n.id === id);
            setActiveSubTab(nav?.subItems?.[0]?.id || '');
          }
        }}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
      >
        {renderContent()}
      </Layout>
      <Toasts />
    </StoreProvider>
  );
}
