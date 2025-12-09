import React, { useEffect, useRef } from 'react';

interface BotAvatarProps {
  phase: 'idle' | 'planning' | 'executing' | 'speaking';
  small?: boolean;
  audioAnalyser?: AnalyserNode | null;
}

const BotAvatar: React.FC<BotAvatarProps> = ({ phase, small = false, audioAnalyser }) => {
  const isActive = phase !== 'idle';
  const mouthRef = useRef<HTMLDivElement>(null);
  
  // Audio Visualization Logic (Lip Sync)
  useEffect(() => {
    if (phase === 'speaking' && audioAnalyser && mouthRef.current) {
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animationId: number;

        const animate = () => {
            audioAnalyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume from the frequency data
            let sum = 0;
            // Use the whole spectrum or just lower half. 
            // For speech (16k-24k sample rate), the whole bin count (fftSize/2) is usually fine.
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Map volume (0-255) to height (min 2px, max ~24px)
            // We boost the effect (multiply by 1.5) to make it more visible
            const maxHeight = small ? 14 : 24;
            const height = Math.max(2, Math.min(maxHeight, (average / 255) * maxHeight * 3.5));
            
            if (mouthRef.current) {
                mouthRef.current.style.height = `${height}px`;
            }
            
            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
            if (mouthRef.current) {
                 mouthRef.current.style.height = ''; // Reset inline style
            }
        };
    }
  }, [phase, audioAnalyser, small]);

  // Dynamic colors based on state
  const getGlowColor = () => {
    switch (phase) {
      case 'planning': return 'shadow-purple-500/50 border-purple-500';
      case 'executing': return 'shadow-green-500/50 border-green-500';
      case 'speaking': return 'shadow-red-500/50 border-red-500';
      default: return 'shadow-blue-500/50 border-blue-500';
    }
  };

  const getEyeColor = () => {
    switch (phase) {
      case 'planning': return 'bg-purple-400';
      case 'executing': return 'bg-green-400';
      case 'speaking': return 'bg-red-400';
      default: return 'bg-blue-400';
    }
  };

  const getMouthColor = () => {
     switch (phase) {
      case 'planning': return 'bg-purple-400';
      case 'executing': return 'bg-green-400';
      case 'speaking': return 'bg-red-400';
      default: return 'bg-blue-400';
    }
  };

  const containerClass = small 
    ? "relative w-32 h-20 bg-orion-900 rounded-lg border transition-all duration-500 overflow-hidden group" 
    : "relative w-48 h-32 bg-orion-900 rounded-xl border-2 transition-all duration-500 overflow-hidden group";

  return (
    <div className={`flex justify-center ${small ? '' : 'mb-8'}`}>
      <div className={`${containerClass} ${getGlowColor()} shadow-lg`}>
        
        {/* Internal Style for Default Mouth Animation (Fallback) */}
        <style>{`
          @keyframes bot-talk {
            0%, 100% { height: 2px; }
            10% { height: 8px; }
            20% { height: 4px; }
            30% { height: 14px; }
            40% { height: 6px; }
            50% { height: 10px; }
            60% { height: 4px; }
            70% { height: 12px; }
            80% { height: 6px; }
            90% { height: 4px; }
          }
        `}</style>

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,3px_100%] pointer-events-none"></div>
        
        {/* REC Indicator */}
        <div className="absolute top-2 right-3 flex items-center gap-1 z-30">
             <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></div>
             {!small && <span className="text-[10px] font-mono text-gray-400">REC</span>}
        </div>
        
        {/* Robot Face Container */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            
            {/* Eyes */}
            <div className={`flex ${small ? 'gap-4' : 'gap-8'}`}>
                <div className={`${small ? 'w-4 h-1' : 'w-8 h-2'} ${getEyeColor()} rounded-full ${phase === 'planning' ? 'animate-pulse' : ''} shadow-[0_0_10px_currentColor]`}></div>
                <div className={`${small ? 'w-4 h-1' : 'w-8 h-2'} ${getEyeColor()} rounded-full ${phase === 'planning' ? 'animate-pulse' : ''} shadow-[0_0_10px_currentColor]`}></div>
            </div>

            {/* Mouth / Lip Movement */}
            <div className={`flex items-center justify-center ${small ? 'h-3' : 'h-6'}`}>
                {phase === 'executing' || phase === 'speaking' ? (
                     <div 
                        ref={mouthRef}
                        className={`${small ? 'w-8' : 'w-12'} rounded-sm ${getMouthColor()} shadow-[0_0_10px_currentColor]`}
                        style={{
                            // If we have an analyser, disable CSS animation to let JS drive it
                            animation: (phase === 'speaking' && audioAnalyser) ? 'none' : 'bot-talk 0.4s infinite linear',
                            // Disable transition for snappy lip sync
                            transition: (phase === 'speaking' && audioAnalyser) ? 'none' : 'height 0.1s'
                        }}
                     ></div>
                ) : phase === 'planning' ? (
                     <div className={`${small ? 'w-8' : 'w-12'} h-0.5 bg-purple-500/50 rounded-full animate-pulse`}></div>
                ) : (
                     <div className={`${small ? 'w-8' : 'w-12'} h-0.5 bg-blue-500/50 rounded-full`}></div>
                )}
            </div>
        </div>

        {/* Status Text */}
        {!small && (
            <div className="absolute bottom-2 left-3 z-30">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    {phase === 'idle' ? 'STANDBY' : phase}
                </span>
            </div>
        )}

      </div>
    </div>
  );
};

export default BotAvatar;