import React, { useState, useRef, useEffect } from 'react';
import { AgentType, HistoryItem, NoteStore, MeetingSession, PlannerOutput, NewsResult } from './types';
import { planRequest, generateCode, summarizeMeetingLog, generateNews, translateText, generateSpeech } from './services/gemini';
import { searchArxiv } from './services/arxiv';
import ResponseCard from './components/ResponseCard';
import DebugPanel from './components/DebugPanel';
import Dashboard from './components/Dashboard';
import BotAvatar from './components/BotAvatar';
import { Send, Menu, Sparkles, Activity, Mic, MicOff, Volume2 } from 'lucide-react';

export default function App() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notes, setNotes] = useState<NoteStore>({});
  const [meeting, setMeeting] = useState<MeetingSession>({ active: false, topic: '', log: [], listening: false });
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'planning' | 'executing' | 'speaking'>('idle');
  const [currentPlannerData, setCurrentPlannerData] = useState<PlannerOutput | null>(null);
  const [isDashboardOpen, setDashboardOpen] = useState(false);
  const [isListeningInput, setIsListeningInput] = useState(false);
  const [currentAnalyser, setCurrentAnalyser] = useState<AnalyserNode | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meetingRecognitionRef = useRef<any>(null); // SpeechRecognition instance for meetings
  const inputRecognitionRef = useRef<any>(null); // SpeechRecognition instance for input

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loadingPhase]);

  // Meeting Listener Logic
  useEffect(() => {
    // Cleanup function to stop recognition if dependencies change or unmount
    const stopRecognition = () => {
        if (meetingRecognitionRef.current) {
            try {
                meetingRecognitionRef.current.stop();
            } catch (e) {
                // Ignore errors if already stopped
            }
            meetingRecognitionRef.current = null;
        }
    };

    if (meeting.active && meeting.listening) {
        // Feature detection
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
            setMeeting(prev => ({...prev, listening: false}));
            return;
        }

        // Initialize
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false; // We only want final text for the log
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log("Meeting listener started");
        };

        recognition.onresult = (event: any) => {
            // Retrieve the most recent result
            const lastResultIndex = event.results.length - 1;
            const lastResult = event.results[lastResultIndex];
            
            if (lastResult.isFinal) {
                const transcript = lastResult[0].transcript.trim();
                if (transcript) {
                    setMeeting(prev => ({
                        ...prev,
                        log: [...prev.log, `[Speech]: ${transcript}`]
                    }));
                }
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                return; // Ignore silence
            }
            
            console.error("Meeting listener error:", event.error);
            
            if (event.error === 'not-allowed') {
                alert("Microphone permission denied. Please allow microphone access to use the meeting listener.");
                setMeeting(prev => ({...prev, listening: false}));
            } else if (event.error === 'service-not-allowed') {
                alert("Speech recognition service not allowed.");
                setMeeting(prev => ({...prev, listening: false}));
            }
        };

        recognition.onend = () => {
            console.log("Meeting listener ended");
        };

        try {
            recognition.start();
            meetingRecognitionRef.current = recognition;
        } catch (e) {
            console.error("Failed to start recognition:", e);
            setMeeting(prev => ({...prev, listening: false}));
        }
    } else {
        stopRecognition();
    }

    return stopRecognition;
  }, [meeting.active, meeting.listening]);


  const playGlobalAudio = async (base64Audio: string) => {
      try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }

          const binaryString = atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
          const pcmData = new Int16Array(bytes.buffer);
          
          const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < pcmData.length; i++) { channelData[i] = pcmData[i] / 32768.0; }

          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;

          // Connect Analyser for Lip Sync
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyser.connect(audioContextRef.current.destination);
          
          setCurrentAnalyser(analyser);
          setLoadingPhase('speaking');
          
          source.onended = () => {
              setLoadingPhase('idle');
              setCurrentAnalyser(null);
          };
          source.start();
      } catch (e) {
          console.error("Audio play error", e);
          setLoadingPhase('idle');
          setCurrentAnalyser(null);
      }
  };

  const handleVoiceInput = () => {
      if (isListeningInput) {
          inputRecognitionRef.current?.stop();
          setIsListeningInput(false);
          return;
      }

      if (!('webkitSpeechRecognition' in window)) {
          alert("Voice input not supported in this browser.");
          return;
      }

      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListeningInput(true);
      recognition.onend = () => setIsListeningInput(false);
      recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setInput(text);
          // Optional: Auto-submit could go here
      };
      
      recognition.onerror = (event: any) => {
          console.error("Voice input error:", event.error);
          setIsListeningInput(false);
      };

      recognition.start();
      inputRecognitionRef.current = recognition;
  };

  const handleRun = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault();
    const query = overrideInput || input;
    if (!query.trim() || loading) return;

    setInput('');
    setLoading(true);
    setLoadingPhase('planning');
    setCurrentPlannerData(null);

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      userQuery: query,
      plannerOutput: { agent: 'unknown', info: {} },
      result: null,
      status: 'planning',
    };

    try {
      // 1. Plan
      const plan = await planRequest(query);
      setCurrentPlannerData(plan);
      setLoadingPhase('executing');
      
      newItem.plannerOutput = plan;
      
      let result: any = "Done.";
      let status: 'success' | 'error' = 'success';
      let errorMsg = '';
      let textToSpeak = "";

      // 2. Execute Tool
      try {
        switch (plan.agent) {
          case 'code':
            const codeTopic = plan.info.topic || query;
            result = await generateCode(codeTopic, plan.info.content);
            textToSpeak = `I've generated the Python code for ${codeTopic}.`;
            break;

          case 'papers':
            const paperTopic = plan.info.topic || 'General AI';
            result = await searchArxiv(paperTopic);
            textToSpeak = `I found some ArXiv papers related to ${paperTopic}.`;
            break;
            
          case 'news':
            const newsTopic = plan.info.topic || 'Latest Tech';
            const newsResult = await generateNews(newsTopic);
            result = newsResult;
            textToSpeak = "Here is the latest news update.";
            break;
            
          case 'translate':
             const contentToTranslate = plan.info.content || query;
             const targetLang = plan.info.language || "English";
             result = await translateText(contentToTranslate, targetLang);
             textToSpeak = result; 
             break;

          case 'notes_add':
            const addTopic = (plan.info.topic || 'general').toLowerCase();
            const noteContent = plan.info.content;
            if (noteContent) {
              setNotes(prev => ({
                ...prev,
                [addTopic]: [...(prev[addTopic] || []), noteContent]
              }));
              result = `Added note to "${addTopic}".`;
              textToSpeak = `Note added to ${addTopic}.`;
            } else {
                result = "No content provided for the note.";
                status = 'error';
                textToSpeak = "I didn't catch what you wanted to write.";
            }
            break;

          case 'notes_read':
            const readTopic = (plan.info.topic || '').toLowerCase();
            if (readTopic === 'all' || !readTopic) {
                result = Object.values(notes).flat();
                if (result.length === 0) result = ["No notes found."];
                textToSpeak = "Here are all your notes.";
            } else {
                result = notes[readTopic] || [];
                textToSpeak = `Here are your notes on ${readTopic}.`;
            }
            break;

          case 'notes_clear':
            const clearTopic = (plan.info.topic || '').toLowerCase();
            if (clearTopic) {
                setNotes(prev => {
                    const next = { ...prev };
                    delete next[clearTopic];
                    return next;
                });
                result = `Cleared notes for "${clearTopic}".`;
                textToSpeak = `Cleared notes for ${clearTopic}.`;
            } else {
                setNotes({});
                result = "Cleared all notes.";
                textToSpeak = "All notes cleared.";
            }
            break;

          case 'meeting':
            const action = plan.info.meetingAction;
            
            if (action === 'start') {
                const mTopic = plan.info.topic || 'General Meeting';
                setMeeting({ active: true, topic: mTopic, log: [], listening: true }); // Auto-start listening
                result = `Started meeting: ${mTopic}. I am listening.`;
                textToSpeak = `Meeting started on ${mTopic}. I am listening.`;
            } else if (action === 'add') {
                if (!meeting.active) {
                    const mTopic = 'Ad-hoc Discussion';
                    const content = plan.info.content || query;
                    setMeeting({ active: true, topic: mTopic, log: [content], listening: false });
                    result = `No active meeting found. Started "${mTopic}" and added log entry.`;
                    textToSpeak = "Meeting started and entry added.";
                } else {
                    const content = plan.info.content;
                    if (content) {
                        setMeeting(prev => ({ ...prev, log: [...prev.log, content] }));
                        result = "Added to meeting log.";
                        textToSpeak = "Added.";
                    } else {
                        result = "Nothing to add.";
                        textToSpeak = "I didn't catch that.";
                    }
                }
            } else if (action === 'stop') {
                if (!meeting.active) {
                    result = "No active meeting to stop.";
                    status = 'error';
                    textToSpeak = "There is no active meeting.";
                } else {
                    setMeeting(prev => ({ ...prev, listening: false }));
                    // Use the text summarizer
                    const summary = await summarizeMeetingLog(meeting.topic, meeting.log);
                    setMeeting({ active: false, topic: '', log: [], listening: false });
                    result = summary;
                    textToSpeak = "Meeting stopped. Here is your summary and action items.";
                }
            } else {
                result = "Unknown meeting action.";
                status = 'error';
            }
            break;
            
          case 'unknown':
            result = "I couldn't quite understand that. I can help with Python code, searching ArXiv papers, taking notes, reading news, translation, or tracking meetings.";
            status = 'error';
            textToSpeak = "I'm not sure how to help with that.";
            break;
        }
      } catch (execError: any) {
        console.error(execError);
        status = 'error';
        errorMsg = execError.message || "Execution failed";
        textToSpeak = "Something went wrong during execution.";
      }

      newItem.result = result;
      newItem.status = status;
      newItem.errorMessage = errorMsg;

      setHistory(prev => [...prev, newItem]);

      // Generate and play audio if we have text to speak
      if (textToSpeak) {
          generateSpeech(textToSpeak).then(audio => {
              if (audio) playGlobalAudio(audio);
              else setLoadingPhase('idle');
          });
      } else {
          setLoadingPhase('idle');
      }

    } catch (err: any) {
      console.error(err);
      newItem.status = 'error';
      newItem.errorMessage = "Planning failed unexpectedly.";
      setHistory(prev => [...prev, newItem]);
      setLoading(false);
      setLoadingPhase('idle');
    } finally {
      setLoading(false);
      if (loadingPhase !== 'speaking') {
         // Intentionally left blank to allow audio callback to handle state
      }
    }
  };

  const toggleMeetingListener = () => {
      setMeeting(prev => ({...prev, listening: !prev.listening}));
  };

  return (
    <div className="min-h-screen bg-orion-900 text-gray-100 font-sans flex flex-col relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-orion-800 bg-orion-900/80 backdrop-blur z-10 sticky top-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Orion Assistant</h1>
        </div>
        <button 
          onClick={() => setDashboardOpen(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-orion-800 rounded-lg transition-all"
        >
            <Menu size={24} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 relative z-10 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
            
            {/* The Bot "Video Frontend" Avatar */}
            <div className="mt-4">
                <BotAvatar phase={loadingPhase} audioAnalyser={currentAnalyser} />
            </div>

            {/* Welcome State */}
            {history.length === 0 && (
                <div className="text-center py-10 opacity-80">
                    <h2 className="text-3xl font-bold mb-4 text-white">How can I help you today?</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Ask me to generate Python code, find ArXiv papers, read the news, take notes, translate text, or listen to your meeting.
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
                        <button onClick={() => { setInput("Start a meeting and listen"); }} className="p-3 bg-orion-800 hover:bg-orion-700 border border-orion-700 rounded-lg text-sm text-gray-300 transition-all">"Start a meeting and listen"</button>
                        <button onClick={() => { setInput("Translate 'Hello World' to French"); }} className="p-3 bg-orion-800 hover:bg-orion-700 border border-orion-700 rounded-lg text-sm text-gray-300 transition-all">"Translate 'Hello World' to French"</button>
                        <button onClick={() => { setInput("Get me the latest news on SpaceX"); }} className="p-3 bg-orion-800 hover:bg-orion-700 border border-orion-700 rounded-lg text-sm text-gray-300 transition-all">"Get me the latest news on SpaceX"</button>
                        <button onClick={() => { setInput("Add note: Buy milk"); }} className="p-3 bg-orion-800 hover:bg-orion-700 border border-orion-700 rounded-lg text-sm text-gray-300 transition-all">"Add note: Buy milk"</button>
                    </div>
                </div>
            )}

            {/* History Feed */}
            {history.map((item) => (
                <ResponseCard key={item.id} item={item} />
            ))}

            {/* Loading Indicator */}
            {loading && (
                <div className="flex items-center gap-3 text-orion-400 animate-pulse pl-2">
                    <Activity size={20} className={loadingPhase === 'planning' ? 'animate-spin' : ''} />
                    <span className="text-sm font-mono tracking-wide">
                        {loadingPhase === 'planning' ? 'PLANNING REASONING...' : loadingPhase === 'speaking' ? 'SPEAKING...' : 'EXECUTING AGENT...'}
                    </span>
                </div>
            )}
            
            <div ref={bottomRef} className="h-4"></div>
        </div>
      </main>

      {/* Input Area */}
      <div className="p-4 bg-orion-900 border-t border-orion-800 z-20">
        <div className="max-w-3xl mx-auto">
            {/* Debug Panel Toggle/View */}
            {currentPlannerData && loading && (
                <div className="mb-2">
                     <div className="text-xs font-mono text-purple-400">
                        Target Agent: <span className="text-white">{currentPlannerData.agent}</span>
                     </div>
                </div>
            )}
            
            {/* Input Form */}
            <form onSubmit={handleRun} className="relative group flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListeningInput ? "Listening..." : "Type a command or use voice..."}
                        disabled={loading}
                        className={`w-full bg-orion-800 text-white placeholder-gray-500 rounded-xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 border transition-all shadow-lg ${isListeningInput ? 'ring-2 ring-red-500 border-red-500' : 'focus:ring-blue-500/50 border-orion-700'}`}
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${isListeningInput ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white'}`}
                    >
                        {isListeningInput ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                </div>
                
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                    <Send size={20} />
                </button>
            </form>

            {/* Meeting Listener Indicator */}
            {meeting.active && (
                <div className="mt-3 flex items-center justify-between bg-orion-800/50 px-4 py-2 rounded-lg border border-orion-700">
                    <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${meeting.listening ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                         <span className="text-xs text-gray-300">Meeting in progress: <span className="text-white font-medium">{meeting.topic}</span></span>
                    </div>
                    <button onClick={toggleMeetingListener} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white">
                        {meeting.listening ? <MicOff size={14}/> : <Mic size={14}/>}
                        {meeting.listening ? 'Mute Listener' : 'Resume Listener'}
                    </button>
                </div>
            )}

            <div className="mt-2 flex justify-between">
                <p className="text-xs text-gray-600">Powered by Gemini 3 Pro</p>
                {history.length > 0 && <DebugPanel data={history[history.length-1].plannerOutput} />}
            </div>
        </div>
      </div>

      {/* Persistent Sidebar */}
      <Dashboard 
        isOpen={isDashboardOpen} 
        onClose={() => setDashboardOpen(false)} 
        notes={notes}
        meeting={meeting}
      />

    </div>
  );
}