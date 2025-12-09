import React, { useState, useRef, useEffect } from 'react';
import { HistoryItem, Paper, NewsResult } from '../types';
import { FileText, Code, List, CheckCircle, AlertTriangle, Terminal, Radio, Play, Pause, ExternalLink, Globe, Languages } from 'lucide-react';
import BotAvatar from './BotAvatar';

interface ResponseCardProps {
  item: HistoryItem;
}

const NewsPlayer: React.FC<{ result: NewsResult }> = ({ result }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playAudio = async () => {
    if (!result.audioData) return;

    try {
      if (isPlaying) {
        if (sourceRef.current) {
          sourceRef.current.stop();
          sourceRef.current = null;
        }
        setIsPlaying(false);
        setAnalyser(null);
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const binaryString = atob(result.audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcmData = new Int16Array(bytes.buffer);
      const numChannels = 1;
      const sampleRate = 24000;
      const frameCount = pcmData.length / numChannels;
      const buffer = audioContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
      
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
         channelData[i] = pcmData[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      
      // Setup Analyser
      const analyserNode = audioContextRef.current.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      analyserNode.connect(audioContextRef.current.destination);
      setAnalyser(analyserNode);

      source.onended = () => {
          setIsPlaying(false);
          setAnalyser(null);
      };
      
      source.start();
      sourceRef.current = source;
      setIsPlaying(true);

    } catch (e: any) {
      console.error("Audio playback error:", e);
      setError("Failed to play audio.");
      setIsPlaying(false);
      setAnalyser(null);
    }
  };

  return (
    <div className="bg-orion-900 border border-orion-700 rounded-xl overflow-hidden shadow-2xl mt-2">
      {/* Video Header / Visual */}
      <div className="bg-black/50 p-6 flex flex-col items-center justify-center border-b border-orion-700 relative">
        <div className="absolute top-2 right-2 flex gap-2">
             <span className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded">Live News</span>
        </div>
        <BotAvatar phase={isPlaying ? 'speaking' : 'idle'} small={false} audioAnalyser={analyser} />
        
        {/* Headline Overlay */}
        <div className="mt-4 text-center">
             <h3 className="text-xl font-bold text-white tracking-tight leading-tight max-w-md mx-auto">{result.headline}</h3>
        </div>

        {/* Controls */}
        <div className="mt-4 flex gap-3">
             {result.audioData ? (
                <button 
                  onClick={playAudio}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold transition-all ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  {isPlaying ? 'Pause Broadcast' : 'Play Broadcast'}
                </button>
             ) : (
                <span className="text-sm text-gray-500 italic">Audio unavailable</span>
             )}
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Script & Sources */}
      <div className="p-5 bg-orion-800/50">
         <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transcript</h4>
         <p className="text-gray-300 text-sm leading-relaxed mb-4 whitespace-pre-line border-l-2 border-orion-500 pl-3">
            {result.script}
         </p>

         {result.sources && result.sources.length > 0 && (
             <div className="mt-4 pt-4 border-t border-orion-700/50">
                 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sources</h4>
                 <div className="flex flex-wrap gap-2">
                     {result.sources.map((src, i) => (
                         <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-1 rounded border border-blue-900/50 hover:border-blue-500 transition-colors">
                             {src.title} <ExternalLink size={10} />
                         </a>
                     ))}
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

const ResponseCard: React.FC<ResponseCardProps> = ({ item }) => {
  const { agent } = item.plannerOutput;
  
  const renderContent = () => {
    if (item.status === 'error') {
      return (
        <div className="text-red-400 flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>{item.errorMessage || "An error occurred."}</span>
        </div>
      );
    }

    switch (agent) {
      case 'code':
        return (
          <div className="relative group">
            <div className="absolute -top-3 right-2 text-xs text-gray-500 bg-orion-800 px-2 rounded">Python</div>
            <pre className="bg-orion-900 p-4 rounded-md overflow-x-auto text-sm text-green-400 font-mono border border-orion-700">
              <code>{item.result}</code>
            </pre>
          </div>
        );

      case 'papers':
        const papers = item.result as Paper[];
        if (!papers || papers.length === 0) return <p className="text-gray-400">No papers found.</p>;
        return (
          <div className="space-y-4">
            {papers.map((paper, idx) => (
              <div key={idx} className="bg-orion-800/50 p-4 rounded-lg border border-orion-700 hover:border-orion-500 transition-colors">
                <a href={paper.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-semibold text-lg block mb-1">
                  {paper.title}
                </a>
                <p className="text-sm text-gray-400 mb-2 italic">{paper.authors.join(', ')} • {paper.published}</p>
                <p className="text-sm text-gray-300 line-clamp-3">{paper.summary}</p>
              </div>
            ))}
          </div>
        );

      case 'meeting':
        if (item.plannerOutput.info.meetingAction === 'stop') {
             // Summary result
             return (
                 <div className="bg-orion-800 p-5 rounded-lg border border-orion-700">
                     <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                         <CheckCircle size={20} /> Meeting Summary
                     </h3>
                     <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line">
                         {item.result}
                     </div>
                 </div>
             )
        }
        return <p className="text-green-400 flex items-center gap-2"><CheckCircle size={16}/> {item.result}</p>;

      case 'notes_read':
        const notes = item.result as string[];
        if (!notes || notes.length === 0) return <p className="text-gray-500">No notes found for this topic.</p>;
        return (
          <ul className="list-disc pl-5 space-y-2 text-gray-200">
             {notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        );

      case 'news':
        return <NewsPlayer result={item.result as NewsResult} />;
      
      case 'translate':
          return (
             <div className="bg-orion-800 p-4 rounded-lg border border-orion-700 flex items-start gap-3">
                 <Languages size={24} className="text-pink-400 mt-1" />
                 <div>
                     <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Translation ({item.plannerOutput.info.language})</p>
                     <p className="text-xl text-white font-serif">{item.result}</p>
                 </div>
             </div>
          );

      case 'unknown':
        return <p className="text-yellow-500 italic">I'm not sure how to handle that request. Try asking for code, papers, notes, news, translation, or meeting help.</p>;

      default: // notes_add, notes_clear, simple status messages
        return <p className="text-gray-300">{item.result}</p>;
    }
  };

  const getIcon = () => {
      switch(agent) {
          case 'code': return <Code className="text-blue-400" size={20}/>;
          case 'papers': return <FileText className="text-orange-400" size={20}/>;
          case 'meeting': return <List className="text-purple-400" size={20}/>;
          case 'news': return <Radio className="text-red-400" size={20}/>;
          case 'translate': return <Globe className="text-pink-400" size={20}/>;
          case 'unknown': return <AlertTriangle className="text-yellow-400" size={20}/>;
          default: return <Terminal className="text-green-400" size={20}/>;
      }
  }

  return (
    <div className="mb-6 animate-fade-in-up">
      <div className="flex items-start gap-4 mb-2">
        <div className="min-w-[40px] h-[40px] rounded-full bg-orion-800 border border-orion-700 flex items-center justify-center">
            {getIcon()}
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-200">Orion</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider">{agent}</span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
                Request: "{item.userQuery}"
            </div>
            <div className="text-gray-100">
                {renderContent()}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ResponseCard;