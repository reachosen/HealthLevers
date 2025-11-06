import React, { useState } from 'react';
import { X, Play, Copy, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePromptPlay } from './PromptPlayProvider';
import { PromptPlayEvent } from './types';
import { redactObject, highlightVariables, resolveTemplate, formatMetrics } from './utils';

export function PromptPlayDrawer() {
  const { state, closeDrawer, toggleRedaction, replay } = usePromptPlay();
  const [selectedTab, setSelectedTab] = useState('source');

  if (!state.drawerOpen) return null;

  const currentEvents = state.selectedContextRef 
    ? state.events.filter(e => e.contextRef === state.selectedContextRef)
    : state.events;

  const activeEvent = state.activeRunId 
    ? state.events.find(e => e.runId === state.activeRunId)
    : currentEvents[currentEvents.length - 1];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderEvent = (event: PromptPlayEvent) => {
    const safeVariables = redactObject(event.variables, state.redactPHI);
    const safeOutput = redactObject(event.output, state.redactPHI);
    const template = event.template?.system || event.template?.user || '';

    return (
      <div className="space-y-4">
        {/* Source Tab */}
        <TabsContent value="source" className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Prompt ID:</strong>
              <div className="font-mono text-xs">{event.promptId}</div>
            </div>
            <div>
              <strong>Type:</strong>
              <Badge variant="outline">{event.type}</Badge>
            </div>
            <div>
              <strong>Version:</strong>
              <span className="font-mono">{event.version || 'v1'}</span>
            </div>
            <div>
              <strong>Model:</strong>
              <span className="font-mono">{event.model || 'gpt-4o'}</span>
            </div>
          </div>
          
          {event.params && (
            <div>
              <strong>Parameters:</strong>
              <pre className="text-xs bg-slate-50 p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(event.params, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>

        {/* Variables Tab */}
        <TabsContent value="vars" className="space-y-3">
          <div className="flex items-center justify-between">
            <strong>Variables ({Object.keys(safeVariables || {}).length})</strong>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleRedaction}
              className="text-xs"
            >
              {state.redactPHI ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {state.redactPHI ? 'Show' : 'Hide'}
            </Button>
          </div>
          
          {safeVariables ? (
            <div className="space-y-2">
              {Object.entries(safeVariables).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {key}
                  </Badge>
                  <div className="flex-1 text-xs font-mono bg-slate-50 p-1 rounded">
                    {typeof value === 'object' 
                      ? JSON.stringify(value, null, 2)
                      : String(value)
                    }
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No variables</div>
          )}
        </TabsContent>

        {/* Template Tab */}
        <TabsContent value="template" className="space-y-3">
          <div className="flex items-center justify-between">
            <strong>Raw Template</strong>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(template)}
              className="text-xs"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="text-xs font-mono bg-slate-50 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
            <div dangerouslySetInnerHTML={{ 
              __html: highlightVariables(template, event.variables) 
            }} />
          </div>
        </TabsContent>

        {/* Resolved Tab */}
        <TabsContent value="resolved" className="space-y-3">
          <div className="flex items-center justify-between">
            <strong>Resolved Prompt</strong>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(event.resolvedPrompt || '')}
              className="text-xs"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="text-xs font-mono bg-slate-50 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
            {state.redactPHI 
              ? redactObject(event.resolvedPrompt, true)
              : event.resolvedPrompt || resolveTemplate(template, event.variables)
            }
          </div>
        </TabsContent>

        {/* Output Tab */}
        <TabsContent value="output" className="space-y-3">
          <div className="flex items-center justify-between">
            <strong>Model Response</strong>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatMetrics(event.metrics)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(JSON.stringify(safeOutput, null, 2))}
                className="text-xs"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="text-xs font-mono bg-slate-50 p-3 rounded overflow-auto max-h-64">
            {typeof safeOutput === 'object' 
              ? <pre>{JSON.stringify(safeOutput, null, 2)}</pre>
              : <div className="whitespace-pre-wrap">{String(safeOutput || 'No output yet...')}</div>
            }
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3">
          <strong>Recent Runs ({currentEvents.length})</strong>
          
          <div className="space-y-2 max-h-64 overflow-auto">
            {currentEvents.slice(-10).reverse().map((historyEvent) => (
              <div 
                key={historyEvent.runId}
                className={`p-2 border rounded text-xs ${
                  historyEvent.runId === event.runId ? 'bg-blue-50 border-blue-200' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs">{historyEvent.promptId}</div>
                    <div className="text-slate-500">
                      {new Date(historyEvent.ts || 0).toLocaleTimeString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => replay(historyEvent.runId!)}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </div>
    );
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="font-semibold">prompt@play</h3>
          {activeEvent && (
            <Badge variant="outline" className="text-xs">
              {activeEvent.type}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={closeDrawer}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {activeEvent ? (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
              <TabsTrigger value="vars" className="text-xs">Vars</TabsTrigger>
              <TabsTrigger value="template" className="text-xs">Template</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
              <TabsTrigger value="output" className="text-xs">Output</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            </TabsList>
            
            {renderEvent(activeEvent)}
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500">
            No prompt activity yet
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        {activeEvent && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => replay(activeEvent.runId!)}
              disabled={!activeEvent.output}
            >
              <Play className="h-3 w-3 mr-1" />
              Replay
            </Button>
            
            <Badge variant="outline" className="text-xs">
              {state.selectedContextRef || 'Global'}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}