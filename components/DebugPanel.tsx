import React from 'react';
import { PlannerOutput } from '../types';

interface DebugPanelProps {
  data: PlannerOutput | null;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="mt-4 p-3 bg-orion-800 rounded-md border border-orion-700 font-mono text-xs text-gray-400 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase font-bold tracking-wider text-orion-500">Planner Debug</span>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default DebugPanel;
