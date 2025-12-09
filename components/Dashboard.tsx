import React from 'react';
import { NoteStore, MeetingSession } from '../types';
import { StickyNote, Mic, X } from 'lucide-react';

interface DashboardProps {
  notes: NoteStore;
  meeting: MeetingSession;
  isOpen: boolean;
  onClose: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ notes, meeting, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-orion-900/95 backdrop-blur-md border-l border-orion-700 shadow-2xl p-6 overflow-y-auto transform transition-transform duration-300 z-50">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-white tracking-tight">Memory Store</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Meeting Status */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Mic size={16} /> Active Meeting
        </h3>
        <div className={`p-4 rounded-lg border ${meeting.active ? 'bg-purple-900/20 border-purple-500/50' : 'bg-orion-800 border-orion-700'}`}>
           <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300">Status</span>
              <span className={`text-xs px-2 py-1 rounded-full ${meeting.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                  {meeting.active ? 'LIVE' : 'IDLE'}
              </span>
           </div>
           {meeting.active && (
               <>
                 <div className="text-sm font-semibold text-purple-300 mb-2">{meeting.topic}</div>
                 <div className="space-y-1">
                    {meeting.log.slice(-3).map((line, i) => (
                        <p key={i} className="text-xs text-gray-400 truncate border-l-2 border-purple-500/30 pl-2">{line}</p>
                    ))}
                    {meeting.log.length > 3 && <p className="text-xs text-gray-600 italic">+{meeting.log.length - 3} more lines...</p>}
                 </div>
               </>
           )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <StickyNote size={16} /> Saved Notes
        </h3>
        {Object.keys(notes).length === 0 ? (
            <p className="text-sm text-gray-600 italic">No notes saved yet.</p>
        ) : (
            <div className="space-y-4">
                {/* Fix: Explicitly type entries to avoid implicit unknown error */}
                {Object.entries(notes).map(([topic, entries]: [string, string[]]) => (
                    <div key={topic} className="bg-orion-800 rounded-lg p-3 border border-orion-700">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2 capitalize">{topic}</h4>
                        <ul className="space-y-2">
                            {entries.map((note, idx) => (
                                <li key={idx} className="text-xs text-gray-300 border-l border-gray-600 pl-2 leading-relaxed">
                                    {note}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;