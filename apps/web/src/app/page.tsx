'use client';

import { useState, useEffect } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { GraphViewer } from '@/components/graph/GraphViewer';
import { EvolutionTimeline } from '@/components/timeline/EvolutionTimeline';
import { Sidebar } from '@/components/Sidebar';
import { MessageSquare, Network, Clock } from 'lucide-react';
import clsx from 'clsx';

type ViewMode = 'chat' | 'graph' | 'timeline';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [graphVersion, setGraphVersion] = useState(0);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Create a new session on first load
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Conversation' }),
        });
        const data = await res.json();
        if (data.success && data.data.session) {
          setSessionId(data.data.session.id);
        }
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };

    initSession();
  }, []);

  const handleGraphUpdate = (newVersion: number) => {
    setGraphVersion(newVersion);
    // Refresh sidebar to get updated session title
    setSidebarRefresh((prev) => prev + 1);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        currentSessionId={sessionId}
        onSessionSelect={setSessionId}
        refreshTrigger={sidebarRefresh}
        onNewSession={() => {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Conversation' }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.data.session) {
                setSessionId(data.data.session.id);
                setGraphVersion(0);
              }
            });
        }}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* View mode tabs */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setViewMode('chat')}
              className={clsx(
                'flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors',
                viewMode === 'chat'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={clsx(
                'flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors',
                viewMode === 'graph'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Network className="w-4 h-4" />
              Knowledge Graph
              {graphVersion > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                  v{graphVersion}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={clsx(
                'flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors',
                viewMode === 'timeline'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Clock className="w-4 h-4" />
              Evolution Timeline
            </button>
          </nav>
        </div>

        {/* Content - Keep all components mounted, use CSS to show/hide */}
        <div className="flex-1 overflow-hidden relative">
          {sessionId ? (
            <>
              <div className={clsx('absolute inset-0', viewMode !== 'chat' && 'invisible')}>
                <ChatContainer sessionId={sessionId} onGraphUpdate={handleGraphUpdate} />
              </div>
              <div className={clsx('absolute inset-0', viewMode !== 'graph' && 'hidden')}>
                <GraphViewer sessionId={sessionId} version={graphVersion} />
              </div>
              <div className={clsx('absolute inset-0', viewMode !== 'timeline' && 'hidden')}>
                <EvolutionTimeline sessionId={sessionId} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Loading session...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
