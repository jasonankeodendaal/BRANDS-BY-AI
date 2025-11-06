import React, { useState, useRef, useCallback, PropsWithChildren, useEffect } from 'react';
import { ScriptLine, VoiceConfig, Episode, CustomAudioSample, ScriptTiming, EffectType } from './types';
import { generateScript, generatePodcastAudio, previewVoice, previewClonedVoice, generateQualityPreviewAudio, generateAdText, generateAdScript } from './services/geminiService';
import { extractTextFromPdf } from './services/pdfService';
import { decode, pcmToWav, decodeAudioData as customDecodeAudioData, combineCustomAudioSamples, concatenatePcm, encode, audioBlobToPcmBase64, applyFade, generateSilence } from './utils/audioUtils';
import { UploadIcon, ScriptIcon, AudioIcon, PlayIcon, PauseIcon, LoaderIcon, ErrorIcon, MicIcon, PlayCircleIcon, DownloadIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, RestartIcon, CheckIcon, EditIcon, VolumeHighIcon, VolumeMuteIcon, RewindIcon, ForwardIcon, CloseIcon, WhatsAppIcon, EmailIcon, VideoIcon, CutIcon, CopyIcon, DotsIcon, WandIcon, InfoIcon, TrimIcon, FadeInIcon, SilenceIcon, ZoomInIcon, ZoomOutIcon } from './components/Icons';

type Speaker = 'samantha' | 'steward' | 'thirdHost';
type ActiveTab = 'creator' | 'editor' | 'about';

const Logo = () => (
    <div className="relative flex items-center justify-center" aria-label="Brands by Ai">
        {/* Spotlight Effect */}
        <div 
            
        />
        <img 
            src="https://i.ibb.co/zHWF2Hc2/90378e8b-4c88-4160-860d-4d510bdded49.png" 
            alt="Brands by Ai company logo" 
            className="h-32 w-auto relative z-10" 
        />
    </div>
);

const Card: React.FC<PropsWithChildren<{ title: string; icon?: React.ReactNode, className?: string, titleClassName?: string }>> = ({ title, icon, children, className, titleClassName }) => (
  <div className={`bg-surface rounded-xl shadow-lg border border-zinc-800 overflow-hidden ${className}`}>
    <div className={`p-8 border-b border-zinc-800 ${titleClassName}`}>
      <h2 className="text-2xl font-serif font-bold text-text-primary flex items-center gap-3">
        {icon}
        {title}
      </h2>
    </div>
    <div className="p-8 space-y-8">
      {children}
    </div>
  </div>
);

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = ['Hosts', 'Content', 'Script', 'Studio'];
  const numerals = ['I', 'II', 'III', 'IV'];
  
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-8 left-0 w-full h-1 bg-zinc-800 -translate-y-1/2" aria-hidden="true" />
        <div 
          className="absolute top-8 left-0 h-1 bg-gradient-to-r from-gold to-primary rounded-full -translate-y-1/2 transition-all duration-700 ease-out" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isCompleted = currentStep > stepNumber;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center group cursor-default text-center">
               <div className={`w-16 h-16 rounded-full flex items-center justify-center p-1 border-4 transition-all duration-500 ease-out ${isActive ? 'bg-gold/20 border-gold scale-110 animate-pulse-gold' : isCompleted ? 'bg-primary/20 border-primary' : 'bg-surface border-border-color group-hover:border-gold'}`}>
                <div className={`w-full h-full rounded-full flex items-center justify-center transition-colors duration-500 ${isActive ? 'bg-gold' : isCompleted ? 'bg-primary' : 'bg-surface'}`}>
                    {isCompleted ? <CheckIcon className="w-7 h-7 text-on-primary" /> : <span className={`font-black font-serif text-xl transition-colors duration-300 ${isActive ? 'text-background' : 'text-text-secondary'}`}>{step === 'Studio' ? <AudioIcon/> : numerals[index]}</span>}
                </div>
              </div>
              <span className={`mt-4 text-sm font-bold uppercase tracking-widest transition-colors duration-500 w-24 ${isActive || isCompleted ? 'text-text-primary' : 'text-text-secondary group-hover:text-gold'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HostEditorCard: React.FC<PropsWithChildren<{
  name: string;
  setName: (name: string) => void;
  voice: string;
  setVoice: (voice: string) => void;
  voiceOptions: { name: string; label: string; }[];
  speakerKey: Speaker;
  handlePreviewVoice: (speaker: Speaker) => void;
  isPreviewing: boolean;
  customSamples: CustomAudioSample[];
  handleToggleRecording: (speaker: Speaker) => void;
  isRecording: boolean;
  audioFileInputRef: React.RefObject<HTMLInputElement>;
  handleAudioFileChange: (event: React.ChangeEvent<HTMLInputElement>, speaker: Speaker) => void;
  handleRemoveCustomAudio: (speaker: Speaker, index: number) => void;
  handlePreviewCustomVoice: (speaker: Speaker) => void;
  isPreviewingCustom: boolean;
}>> = ({ name, setName, voice, setVoice, voiceOptions, speakerKey, handlePreviewVoice, isPreviewing, customSamples, handleToggleRecording, isRecording, audioFileInputRef, handleAudioFileChange, handleRemoveCustomAudio, handlePreviewCustomVoice, isPreviewingCustom, children }) => {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <input type="text" placeholder="Host Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-xl bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-3 focus:outline-none focus:border-gold transition font-serif font-bold" />
      
      <div className="space-y-3">
        <label className="block text-sm font-bold text-text-primary tracking-wider">PRE-BUILT VOICE</label>
        <div className="flex items-center gap-3">
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full text-lg bg-zinc-800 border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition disabled:opacity-50 appearance-none" disabled={customSamples.length > 0}>
                {voiceOptions.map((v, index) => <option key={`${v.name}-${index}`} value={v.name}>{v.label}</option>)}
            </select>
            <button onClick={() => handlePreviewVoice(speakerKey)} disabled={isPreviewing || customSamples.length > 0} className="p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-on-primary disabled:opacity-50 transition flex-shrink-0">
              {isPreviewing ? <LoaderIcon /> : <PlayCircleIcon />}
            </button>
        </div>
      </div>

      <div className="relative text-center my-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-zinc-700"></div></div>
        <div className="relative flex justify-center"><span className="bg-zinc-900/50 px-3 text-sm font-medium text-text-secondary uppercase tracking-wider">Or</span></div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-bold text-text-primary tracking-wider">CUSTOM VOICE</label>
        <p className="text-xs text-zinc-400 -mt-2">Add up to 5 audio samples (at least 10s total) for best results.</p>
        
        {customSamples.length > 0 && (
            <div className="space-y-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                {customSamples.map((sample, index) => (
                    <div key={index} className="flex justify-between items-center bg-zinc-900 p-2 rounded animate-fade-in-scale">
                        <span className="truncate text-sm font-semibold flex-1 min-w-0 px-2">{sample.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => new Audio(sample.url).play()} className="p-2 bg-zinc-700 rounded-full hover:bg-zinc-600 disabled:opacity-50 transition"><PlayCircleIcon /></button>
                            <button onClick={() => handleRemoveCustomAudio(speakerKey, index)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition"><TrashIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <div className="flex gap-4">
            <button onClick={() => handleToggleRecording(speakerKey)} disabled={customSamples.length >= 5} className={`w-full flex items-center justify-center gap-3 border-2 border-zinc-700 rounded-lg p-4 transition disabled:opacity-50 disabled:cursor-not-allowed ${isRecording ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-transparent hover:border-gold'}`}>
                <MicIcon /> {isRecording ? 'Stop' : 'Record'}
            </button>
            <input type="file" accept="audio/*" ref={audioFileInputRef} onChange={(e) => handleAudioFileChange(e, speakerKey)} className="hidden" />
            <button onClick={() => audioFileInputRef.current?.click()} disabled={customSamples.length >= 5} className="w-full flex items-center justify-center gap-3 bg-transparent border-2 border-zinc-700 rounded-lg p-4 hover:border-gold transition disabled:opacity-50 disabled:cursor-not-allowed">
                <UploadIcon /> Upload
            </button>
        </div>
        
        {customSamples.length > 0 && (
             <button onClick={() => handlePreviewCustomVoice(speakerKey)} disabled={isPreviewingCustom} className="w-full flex items-center justify-center gap-3 bg-gold/10 border-2 border-gold rounded-lg p-4 hover:bg-gold/20 text-gold transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isPreviewingCustom ? <LoaderIcon/> : <VolumeHighIcon/>} Preview Cloned Voice
            </button>
        )}
      </div>
       {children}
    </div>
  );
}

interface StepHostsProps {
  error: string;
  setError: (error: string) => void;
  samanthaName: string;
  setSamanthaName: (name: string) => void;
  stewardName: string;
  setStewardName: (name: string) => void;
  samanthaVoice: string;
  setSamanthaVoice: (voice: string) => void;
  stewardVoice: string;
  setStewardVoice: (voice: string) => void;
  isThirdHostEnabled: boolean;
  setIsThirdHostEnabled: (enabled: boolean) => void;
  thirdHostName: string;
  setThirdHostName: (name: string) => void;
  thirdHostRole: string;
  setThirdHostRole: (role: string) => void;
  thirdHostGender: 'male' | 'female';
  setThirdHostGender: (gender: 'male' | 'female') => void;
  thirdHostVoice: string;
  setThirdHostVoice: (voice: string) => void;
  isPreviewingSamantha: boolean;
  isPreviewingSteward: boolean;
  isPreviewingThirdHost: boolean;
  handlePreviewVoice: (speaker: Speaker) => void;
  femaleVoices: { name: string; label: string; }[];
  maleVoices: { name: string; label: string; }[];
  areHostsValid: () => boolean;
  setCurrentStep: (step: number) => void;
  samanthaCustomSamples: CustomAudioSample[];
  isPreviewingSamanthaCustom: boolean;
  isRecordingSamantha: boolean;
  samanthaAudioFileInputRef: React.RefObject<HTMLInputElement>;
  stewardCustomSamples: CustomAudioSample[];
  isPreviewingStewardCustom: boolean;
  isRecordingSteward: boolean;
  stewardAudioFileInputRef: React.RefObject<HTMLInputElement>;
  thirdHostCustomSamples: CustomAudioSample[];
  isPreviewingThirdHostCustom: boolean;
  isRecordingThirdHost: boolean;
  thirdHostAudioFileInputRef: React.RefObject<HTMLInputElement>;
  handlePreviewCustomVoice: (speaker: Speaker) => void;
  handleRemoveCustomAudio: (speaker: Speaker, index: number) => void;
  handleToggleRecording: (speaker: Speaker) => void;
  handleAudioFileChange: (event: React.ChangeEvent<HTMLInputElement>, speaker: Speaker) => void;
  isPreviewingQuality: boolean;
  handlePreviewQuality: () => void;
}

const StepHosts: React.FC<StepHostsProps> = ({
  error, setError, samanthaName, setSamanthaName, stewardName, setStewardName,
  samanthaVoice, setSamanthaVoice, stewardVoice, setStewardVoice,
  isThirdHostEnabled, setIsThirdHostEnabled, thirdHostName, setThirdHostName,
  thirdHostRole, setThirdHostRole, thirdHostGender, setThirdHostGender,
  thirdHostVoice, setThirdHostVoice, isPreviewingSamantha, isPreviewingSteward,
  isPreviewingThirdHost, handlePreviewVoice, femaleVoices, maleVoices,
  areHostsValid, setCurrentStep, 
  samanthaCustomSamples, isPreviewingSamanthaCustom, isRecordingSamantha, samanthaAudioFileInputRef,
  stewardCustomSamples, isPreviewingStewardCustom, isRecordingSteward, stewardAudioFileInputRef,
  thirdHostCustomSamples, isPreviewingThirdHostCustom, isRecordingThirdHost, thirdHostAudioFileInputRef, 
  handlePreviewCustomVoice, handleRemoveCustomAudio, handleToggleRecording, handleAudioFileChange,
  isPreviewingQuality, handlePreviewQuality
}) => (
  <Card title="I: Define Your Hosts" className="max-w-6xl mx-auto">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-text-secondary text-center sm:text-left">Preview the hyper-realistic voice quality and natural conversation flow.</p>
        <button 
            onClick={handlePreviewQuality} 
            disabled={isPreviewingQuality} 
            className="bg-gold text-background font-bold py-3 px-6 rounded-lg hover:opacity-90 transition flex items-center gap-2 text-sm disabled:bg-zinc-600 disabled:text-text-secondary w-full sm:w-auto justify-center shadow-lg shadow-gold/20"
        >
            {isPreviewingQuality ? <><LoaderIcon /> Playing...</> : <><PlayCircleIcon /> Play Preview</>}
        </button>
      </div>
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4"><ErrorIcon /><p className="font-semibold text-red-300">{error}</p></div>}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <HostEditorCard
              name={samanthaName} setName={setSamanthaName}
              voice={samanthaVoice} setVoice={setSamanthaVoice}
              voiceOptions={femaleVoices}
              speakerKey="samantha"
              handlePreviewVoice={handlePreviewVoice} isPreviewing={isPreviewingSamantha}
              customSamples={samanthaCustomSamples}
              handleToggleRecording={handleToggleRecording} isRecording={isRecordingSamantha}
              audioFileInputRef={samanthaAudioFileInputRef}
              handleAudioFileChange={handleAudioFileChange}
              handleRemoveCustomAudio={handleRemoveCustomAudio}
              handlePreviewCustomVoice={handlePreviewCustomVoice}
              isPreviewingCustom={isPreviewingSamanthaCustom}
          />
          <HostEditorCard
              name={stewardName} setName={setStewardName}
              voice={stewardVoice} setVoice={setStewardVoice}
              voiceOptions={maleVoices}
              speakerKey="steward"
              handlePreviewVoice={handlePreviewVoice} isPreviewing={isPreviewingSteward}
              customSamples={stewardCustomSamples}
              handleToggleRecording={handleToggleRecording} isRecording={isRecordingSteward}
              audioFileInputRef={stewardAudioFileInputRef}
              handleAudioFileChange={handleAudioFileChange}
              handleRemoveCustomAudio={handleRemoveCustomAudio}
              handlePreviewCustomVoice={handlePreviewCustomVoice}
              isPreviewingCustom={isPreviewingStewardCustom}
          />
      </div>

      <div className="space-y-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 transition-all duration-300">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-serif font-bold text-text-primary">Add Guest Speaker</h3>
          <label htmlFor="third-host-toggle" className="flex items-center cursor-pointer">
            <div className="relative"><input id="third-host-toggle" type="checkbox" className="sr-only" checked={isThirdHostEnabled} onChange={() => setIsThirdHostEnabled(!isThirdHostEnabled)} /><div className="block bg-zinc-700 w-12 h-7 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isThirdHostEnabled ? 'translate-x-full bg-gold' : ''}`}></div></div>
          </label>
        </div>
        {isThirdHostEnabled && (
          <div className="space-y-8 pt-6 border-t border-zinc-800 animate-fade-in-scale">
             <HostEditorCard
                name={thirdHostName} setName={setThirdHostName}
                voice={thirdHostVoice} setVoice={setThirdHostVoice}
                voiceOptions={thirdHostGender === 'female' ? femaleVoices : maleVoices}
                speakerKey="thirdHost"
                handlePreviewVoice={handlePreviewVoice} isPreviewing={isPreviewingThirdHost}
                customSamples={thirdHostCustomSamples}
                handleToggleRecording={handleToggleRecording} isRecording={isRecordingThirdHost}
                audioFileInputRef={thirdHostAudioFileInputRef}
                handleAudioFileChange={handleAudioFileChange}
                handleRemoveCustomAudio={handleRemoveCustomAudio}
                handlePreviewCustomVoice={handlePreviewCustomVoice}
                isPreviewingCustom={isPreviewingThirdHostCustom}
             >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-text-primary tracking-wider mb-2">GUEST ROLE</label>
                        <input type="text" placeholder="e.g., Expert" value={thirdHostRole} onChange={(e) => setThirdHostRole(e.target.value)} className="w-full text-lg bg-zinc-800 border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-text-primary tracking-wider mb-2">GUEST GENDER</label>
                        <select value={thirdHostGender} onChange={(e) => setThirdHostGender(e.target.value as any)} className="w-full text-lg bg-zinc-800 border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition appearance-none">
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>
            </HostEditorCard>
          </div>
        )}
      </div>

      <div className="pt-8 border-t border-zinc-800 flex justify-end">
          <button onClick={() => { setError(''); setCurrentStep(2) }} disabled={!areHostsValid()} className="bg-primary text-on-primary font-bold py-4 px-10 rounded-lg hover:bg-primary-hover transition flex items-center gap-2 text-lg disabled:bg-zinc-600 shadow-primary-glow">
              Next: Content <ChevronRightIcon />
          </button>
      </div>
  </Card>
);

interface StepContentProps {
  error: string;
  episodeTitle: string;
  setEpisodeTitle: (title: string) => void;
  episodeNumber: number;
  setEpisodeNumber: (num: number) => void;
  episodeLength: number;
  setEpisodeLength: (len: number) => void;
  language: 'English' | 'Afrikaans';
  setLanguage: (lang: 'English' | 'Afrikaans') => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  fileName: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  samanthaName: string;
  stewardName: string;
  manualScriptText: string;
  setManualScriptText: (text: string) => void;
  customRules: string;
  setCustomRules: (rules: string) => void;
  setCurrentStep: (step: number) => void;
  handleGenerateScript: () => void;
  isLoadingScript: boolean;
  areContentInputsValid: () => boolean;
}

const StepContent: React.FC<StepContentProps> = ({
  error, episodeTitle, setEpisodeTitle, episodeNumber, setEpisodeNumber,
  episodeLength, setEpisodeLength, language, setLanguage, prompt, setPrompt, 
  fileName, fileInputRef, handleFileChange, 
  samanthaName, stewardName, manualScriptText, setManualScriptText, customRules, 
  setCustomRules, setCurrentStep, handleGenerateScript, isLoadingScript, 
  areContentInputsValid
}) => (
  <Card title="II: Content & AI Rules" className="max-w-4xl mx-auto">
    {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4"><ErrorIcon /><p className="font-semibold text-red-300">{error}</p></div>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="sm:col-span-2">
            <label htmlFor="episode-title" className="block text-md font-bold text-text-primary mb-2">Episode Title</label>
            <input type="text" id="episode-title" placeholder="e.g., The Future of AI" value={episodeTitle} onChange={e => setEpisodeTitle(e.target.value)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
        </div>
        <div>
            <label htmlFor="episode-number" className="block text-md font-bold text-text-primary mb-2">Episode #</label>
            <input type="number" id="episode-number" min="1" value={episodeNumber} onChange={e => setEpisodeNumber(parseInt(e.target.value, 10) || 1)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
        </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div>
            <label htmlFor="language-select" className="block text-md font-bold text-text-primary">Language</label>
            <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value as any)} className="w-full text-lg bg-zinc-800 border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition appearance-none mt-2">
                <option value="English">English</option>
                <option value="Afrikaans">Afrikaans</option>
            </select>
        </div>
        <div>
            <label htmlFor="episode-length" className="block text-md font-bold text-text-primary">Episode Length: <span className="font-serif text-gold">{episodeLength} min</span></label>
            <input 
                type="range" 
                id="episode-length" 
                min="1" 
                max="20" 
                value={episodeLength} 
                onChange={e => setEpisodeLength(parseInt(e.target.value, 10))} 
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold mt-4" 
            />
        </div>
    </div>
     <div className="space-y-6">
        <h3 className="text-lg font-semibold text-text-primary">Option A: Generate with AI</h3>
        <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-text-secondary mb-2">PODCAST TOPIC</label>
            <textarea id="prompt" rows={3} className="w-full text-lg bg-zinc-800/50 placeholder:text-text-secondary border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition" placeholder="e.g., The future of renewable energy" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div className="text-center text-text-secondary font-semibold tracking-widest">OR</div>
        <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">UPLOAD A DOCUMENT</label>
            <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-transparent border-2 border-zinc-700 rounded-lg p-8 hover:border-gold transition">
                <UploadIcon /><span className="truncate">{fileName || 'Upload PDF'}</span>
            </button>
        </div>
        {prompt && fileName && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center text-sm text-blue-300"><p><b>Content Combined:</b> AI will use your topic to guide the discussion about the uploaded PDF.</p></div>}
      </div>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
        <div className="relative flex justify-center">
            <span className="bg-surface px-4 text-sm text-text-secondary font-semibold">AI generation and a custom script can be used together.</span>
        </div>
      </div>
      <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Option B: Use Custom Script</h3>
          <textarea id="manual-script" rows={5} className="w-full text-lg bg-zinc-800/50 placeholder:text-text-secondary border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition" placeholder={`${samanthaName}: Hello everyone!\n${stewardName}: Welcome to the show.`} value={manualScriptText} onChange={(e) => setManualScriptText(e.target.value)} />
      </div>
       <div>
          <label htmlFor="custom-rules" className="block text-md font-bold text-text-primary mb-2">Advanced AI Rules (Optional)</label>
          <textarea id="custom-rules" rows={4} className="w-full text-lg bg-zinc-800/50 placeholder:text-text-secondary border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition" placeholder="- Never mention the year 2020.&#10;- Ensure Samantha asks at least two questions." value={customRules} onChange={(e) => setCustomRules(e.target.value)}/>
      </div>
      <div className="pt-8 border-t border-zinc-800 flex justify-between items-center">
          <button onClick={() => setCurrentStep(1)} className="font-bold py-4 px-10 rounded-lg hover:bg-zinc-800 transition flex items-center gap-2 text-lg">
              <ChevronLeftIcon /> Back
          </button>
          <button onClick={() => handleGenerateScript()} disabled={isLoadingScript || !areContentInputsValid()} className="bg-primary text-on-primary font-bold py-4 px-10 rounded-lg hover:bg-primary-hover transition flex items-center gap-2 text-lg disabled:bg-zinc-600 shadow-primary-glow">
              {isLoadingScript ? <><LoaderIcon />Generating...</> : <><ScriptIcon /> Generate Script</>}
          </button>
      </div>
  </Card>
);

interface ScriptDisplayProps {
    script: ScriptLine[];
    setScript?: (script: ScriptLine[]) => void;
    isEditable?: boolean;
    activeLineIndex?: number | null;
    onLineClick?: (lineIndex: number) => void;
    areTimingsStale?: boolean;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ script, setScript, isEditable, activeLineIndex, onLineClick, areTimingsStale }) => {
    const handleDialogueChange = (index: number, newDialogue: string) => {
        if (setScript) {
            const updatedScript = [...script];
            updatedScript[index] = { ...updatedScript[index], dialogue: newDialogue };
            setScript(updatedScript);
        }
    };

    return (
        <div className="space-y-6">
            {areTimingsStale && (
                 <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                    <p className="font-semibold text-yellow-300 text-sm">Audio has been edited. Script playback sync is disabled.</p>
                </div>
            )}
            {script.map((line, index) => {
                const isActive = activeLineIndex === index && !areTimingsStale;
                return (
                    <div 
                        key={index} 
                        className={`grid grid-cols-4 gap-4 p-4 rounded-lg transition-all duration-300 ${onLineClick && !areTimingsStale ? 'cursor-pointer hover:bg-zinc-800/60' : ''} ${isActive ? 'bg-gold/10' : ''}`}
                        onClick={onLineClick && !areTimingsStale ? () => onLineClick(index) : undefined}
                    >
                        <div className="col-span-1">
                            <p className={`font-serif font-bold ${isActive ? 'text-gold' : 'text-text-primary'}`}>{line.speaker}</p>
                        </div>
                        <div className="col-span-3 space-y-2">
                            {isEditable && setScript ? (
                                <textarea
                                    value={line.dialogue}
                                    onChange={(e) => handleDialogueChange(index, e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 focus:ring-2 focus:ring-gold focus:border-gold transition"
                                    rows={3}
                                />
                            ) : (
                                <p className="whitespace-pre-wrap">{line.dialogue}</p>
                            )}
                            {line.cue && <p className="text-sm text-text-secondary italic">({line.cue})</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface StepScriptAndAudioProps {
  error: string;
  isLoadingAudio: boolean;
  brandedName: string;
  setBrandedName: (name: string) => void;
  contactDetails: string;
  setContactDetails: (details: string) => void;
  website: string;
  setWebsite: (site: string) => void;
  slogan: string;
  setSlogan: (slogan: string) => void;
  script: ScriptLine[] | null;
  setScript: (script: ScriptLine[]) => void;
  setCurrentStep: (step: number) => void;
  handleGenerateAudio: () => void;
}

const StepScriptAndAudio: React.FC<StepScriptAndAudioProps> = ({
  error, isLoadingAudio, brandedName, setBrandedName, contactDetails, setContactDetails, website,
  setWebsite, slogan, setSlogan, script, setScript, setCurrentStep, handleGenerateAudio
}) => {
    const [isEditing, setIsEditing] = useState(false);
    if (!script) return null;

    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 flex flex-col gap-8">
                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4"><ErrorIcon /><p className="font-semibold text-red-300">{error}</p></div>}
                {isLoadingAudio ? (
                    <div className="bg-surface rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center">
                        <LoaderIcon />
                        <p className="text-lg text-text-secondary">Synthesizing audio...</p>
                        <p className="text-sm text-text-secondary">This can take a few minutes for longer scripts.</p>
                    </div>
                ) : (
                    <Card title="III: Finalize & Generate">
                        <div className="space-y-8">
                            <input type="text" placeholder="Branded Name (e.g., Brands by AI)" value={brandedName} onChange={(e) => setBrandedName(e.target.value)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
                            <input type="text" placeholder="Contact Details (e.g., email)" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
                            <input type="text" placeholder="Website (e.g., yoursite.com)" value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
                            <input type="text" placeholder="Slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} className="w-full text-lg bg-transparent placeholder:text-text-secondary border-b-2 border-zinc-700 p-4 focus:outline-none focus:border-gold transition" />
                        </div>
                         <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-center text-sm text-text-secondary">
                            <p>To enable advanced features like interactive script playback, background audio is not available at this step.</p>
                        </div>
                        <div className="pt-8 border-t border-zinc-800 flex justify-between items-center">
                            <button onClick={() => { setScript([]); setCurrentStep(2); }} className="font-bold py-4 px-10 rounded-lg hover:bg-zinc-800 transition flex items-center gap-2 text-lg">
                                <ChevronLeftIcon /> Back
                            </button>
                            <button onClick={handleGenerateAudio} className="bg-primary text-on-primary font-bold py-4 px-10 rounded-lg hover:bg-primary-hover transition flex justify-center items-center gap-2 text-lg shadow-primary-glow">
                                <AudioIcon /><span>Generate Podcast</span>
                            </button>
                        </div>
                    </Card>
                )}
            </div>
            <div className="lg:col-span-3 bg-surface rounded-xl shadow-lg border border-zinc-800 overflow-hidden lg:max-h-[80vh] flex flex-col">
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-2xl font-serif font-bold text-text-primary flex items-center gap-3"><ScriptIcon />Generated Script</h2>
                    <button onClick={() => setIsEditing(!isEditing)} className={`font-bold py-2 px-4 rounded-lg border-2 flex items-center gap-2 transition ${isEditing ? 'bg-gold/10 border-gold text-gold' : 'border-zinc-700 hover:border-gold'}`}>
                        <EditIcon />{isEditing ? 'Save Changes' : 'Edit Script'}
                    </button>
                </div>
                <div className="p-8 overflow-y-auto flex-grow">
                    <ScriptDisplay script={script} setScript={setScript} isEditable={isEditing} />
                </div>
            </div>
        </div>
    );
};

interface StepStudioProps {
  audioData: string;
  setAudioData: (data: string) => void;
  script: ScriptLine[];
  scriptTimings: ScriptTiming[];
  handleDownloadAudio: () => void;
  handleStartOver: () => void;
  handleSaveOrUpdateEpisode: () => void;
  loadedEpisodeId: string | null;
  areTimingsStale: boolean;
  setAreTimingsStale: (stale: boolean) => void;
  adText: string | null;
  setAdText: (text: string | null) => void;
  adScript: string | null;
  setAdScript: (script: string | null) => void;
  episodeTitle: string;
  brandedName: string;
}

const StepStudio: React.FC<StepStudioProps> = ({
  audioData, setAudioData, script, scriptTimings,
  handleDownloadAudio, handleStartOver, handleSaveOrUpdateEpisode, loadedEpisodeId,
  areTimingsStale, setAreTimingsStale, adText, setAdText, adScript, setAdScript,
  episodeTitle, brandedName
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const audioRef = useRef<HTMLAudioElement>(null);
    const waveformRef = useRef<HTMLCanvasElement>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
    const [isEditorActive, setIsEditorActive] = useState(false);
    const [selection, setSelection] = useState<{ start: number, end: number} | null>(null);
    const isDraggingRef = useRef(false);
    const [audioHistory, setAudioHistory] = useState<string[]>([]);
    const [isLoadingAd, setIsLoadingAd] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Create Blob URL from audio data
    useEffect(() => {
        if (audioData && audioRef.current) {
            const rawData = decode(audioData);
            const wavBlob = pcmToWav(rawData, 24000, 1, 16);
            const url = URL.createObjectURL(wavBlob);
            audioRef.current.src = url;

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [audioData]);

    const drawWaveform = useCallback((normalizedData: number[]) => {
        const canvas = waveformRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        const centerY = height / 2;
        
        ctx.clearRect(0, 0, width, height);

        // Draw full waveform in gray
        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for(let i = 0; i < normalizedData.length; i++) {
            const x = (i / normalizedData.length) * width;
            const y = normalizedData[i] * centerY + centerY;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Draw progress in gold
        const progressX = duration > 0 ? (currentTime / duration) * width : 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, progressX, height);
        ctx.clip();
        
        ctx.strokeStyle = '#ECB365';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for(let i = 0; i < normalizedData.length; i++) {
            const x = (i / normalizedData.length) * width;
            const y = normalizedData[i] * centerY + centerY;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Draw selection if active
        if (isEditorActive && selection) {
            ctx.fillStyle = 'rgba(225, 29, 72, 0.3)';
            const startX = (selection.start / duration) * width;
            const endX = (selection.end / duration) * width;
            ctx.fillRect(startX, 0, endX - startX, height);
        }

    }, [currentTime, duration, isEditorActive, selection]);

    // Effect for visualizing audio
    useEffect(() => {
        if (!audioData) return;
        
        const rawData = decode(audioData);
        const pcm = new Int16Array(rawData.buffer);
        const channelData = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) {
            channelData[i] = pcm[i] / 32768.0;
        }

        const samples = Math.floor(400 * (isEditorActive ? zoom : 1)); // Increase samples when zooming
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(channelData[blockSize * i + j]);
            }
            filteredData.push(sum / blockSize);
        }

        const multiplier = Math.pow(Math.max(...filteredData), -1) || 1;
        const normalizedData = filteredData.map(n => n * multiplier * 2 - 1);
        
        drawWaveform(normalizedData);
        
    }, [audioData, drawWaveform, currentTime, selection, isEditorActive, zoom]);


    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const setAudioData = () => { if (isFinite(audio.duration)) setDuration(audio.duration); setCurrentTime(audio.currentTime); };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('durationchange', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handlePause);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('durationchange', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handlePause);
        };
    }, []);
    
    // Find active script line
    useEffect(() => {
        if (areTimingsStale) return;
        const activeLine = scriptTimings.find(
            timing => currentTime >= timing.startTime && currentTime < timing.startTime + timing.duration
        );
        setActiveLineIndex(activeLine ? activeLine.lineIndex : null);
    }, [currentTime, scriptTimings, areTimingsStale]);


    const togglePlayPause = async () => {
        if (!audioRef.current) return;
        try {
            if (audioRef.current.paused) {
                await audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        } catch (error: any) {
             if (error.name !== 'AbortError') {
                console.error("Error playing/pausing audio:", error);
            }
        }
    };
    
    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleWaveformInteraction = useCallback((event: React.MouseEvent<HTMLCanvasElement>, type: 'down' | 'move' | 'up') => {
        const container = waveformContainerRef.current;
        if (!container || duration === 0) return;

        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const totalWidth = container.scrollWidth;
        const relativeX = event.clientX - rect.left;
        const absoluteX = relativeX + scrollLeft;
        const time = Math.max(0, Math.min((absoluteX / totalWidth) * duration, duration));

        if (!isEditorActive) {
            if (type === 'down') {
                handleSeek(time);
            }
            return;
        }

        if (type === 'down') {
            isDraggingRef.current = true;
            setSelection({ start: time, end: time });
        } else if (type === 'move' && isDraggingRef.current && selection) {
            setSelection({ ...selection, end: time });
        } else if (type === 'up') {
            isDraggingRef.current = false;
            if (selection && selection.start > selection.end) {
                setSelection({ start: selection.end, end: selection.start });
            }
        }
    }, [duration, isEditorActive, selection]);
    
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };
    
    const handlePlaybackRateChange = (rate: number) => {
        setPlaybackRate(rate);
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
        }
    };

    const handleAudioEdit = (type: 'cut' | 'trim') => {
        if (!selection || audioData === null) return;
        setAudioHistory(prev => [...prev, audioData]);
        const pcmData = decode(audioData);
        const bytesPerSample = 2; // 16-bit
        const sampleRate = 24000;
        
        let startByte = Math.floor(selection.start * sampleRate * bytesPerSample);
        let endByte = Math.floor(selection.end * sampleRate * bytesPerSample);
        startByte -= startByte % 2;
        endByte -= endByte % 2;

        let newData;
        if (type === 'cut') {
            const part1 = pcmData.slice(0, startByte);
            const part2 = pcmData.slice(endByte);
            newData = concatenatePcm([part1, part2]);
        } else { // trim
            newData = pcmData.slice(startByte, endByte);
        }
        setAudioData(encode(newData));
        setAreTimingsStale(true);
        setSelection(null);
    };

    const handleUndo = () => {
        if (audioHistory.length > 0) {
            const lastState = audioHistory[audioHistory.length - 1];
            setAudioData(lastState);
            setAudioHistory(prev => prev.slice(0, -1));
        }
    };

    const handleGenerateAd = async (type: 'text' | 'script') => {
        if (!script) return;
        setIsLoadingAd(type);
        try {
            if (type === 'text') {
                const text = await generateAdText(script, episodeTitle, brandedName);
                setAdText(text);
            } else {
                const ad = await generateAdScript(script, episodeTitle, brandedName);
                setAdScript(ad);
            }
        } catch (e) {
            // Handle error
        } finally {
            setIsLoadingAd(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };
    
    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="flex flex-col gap-8">
                <Card title="IV: Production Studio">
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
                         {isEditorActive && (
                            <div className="flex items-center gap-4 p-2 bg-zinc-800/50 rounded-lg">
                                <ZoomOutIcon />
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="20" 
                                    step="1"
                                    value={zoom} 
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold"
                                    aria-label="Zoom waveform"
                                />
                                <ZoomInIcon />
                            </div>
                        )}
                        <div ref={waveformContainerRef} className="w-full overflow-x-auto">
                            <canvas 
                                ref={waveformRef} 
                                className={`h-20 ${isEditorActive ? 'cursor-text' : 'cursor-pointer'}`}
                                style={{ width: `${isEditorActive ? zoom * 100 : 100}%`, transition: 'width 0.2s ease-out' }}
                                onMouseDown={(e) => handleWaveformInteraction(e, 'down')} 
                                onMouseMove={(e) => handleWaveformInteraction(e, 'move')} 
                                onMouseUp={(e) => handleWaveformInteraction(e, 'up')} 
                                onMouseLeave={() => isDraggingRef.current = false}
                            ></canvas>
                        </div>
                        <div className="flex justify-between text-sm text-text-secondary">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={() => handleSeek(Math.max(0, currentTime - 10))} className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"><RewindIcon /></button>
                            <button onClick={togglePlayPause} className="p-5 bg-primary text-on-primary rounded-full hover:bg-primary-hover transition transform hover:scale-110 shadow-primary-glow">
                                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                            </button>
                            <button onClick={() => handleSeek(Math.min(duration, currentTime + 10))} className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"><ForwardIcon /></button>
                        </div>
                        <div className="flex items-center gap-4 pt-4">
                             <button onClick={() => handleVolumeChange({ target: { value: volume > 0 ? '0' : '1' } } as any)}>{volume > 0 ? <VolumeHighIcon /> : <VolumeMuteIcon />}</button>
                             <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold" />
                             <div className="relative">
                                <select onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))} value={playbackRate} className="bg-zinc-800 border-none rounded-md py-1 pl-2 pr-6 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-gold">
                                    <option value="0.75">0.75x</option>
                                    <option value="1">1x</option>
                                    <option value="1.25">1.25x</option>
                                    <option value="1.5">1.5x</option>
                                    <option value="2">2x</option>
                                </select>
                             </div>
                        </div>
                         {isEditorActive && (
                            <div className="flex flex-col items-center gap-4 pt-4 border-t border-zinc-700">
                                {selection && <p className="text-sm text-center text-text-secondary font-mono">Selection: {formatTime(selection.start)} - {formatTime(selection.end)}</p>}
                                <div className="flex justify-center gap-4">
                                     <button onClick={() => handleAudioEdit('cut')} disabled={!selection} className="flex items-center gap-2 font-semibold bg-red-900/50 border-2 border-red-500/30 text-red-300 py-2 px-4 rounded-lg hover:bg-red-900 transition disabled:opacity-50 disabled:cursor-not-allowed"><CutIcon/>Cut</button>
                                    <button onClick={() => handleAudioEdit('trim')} disabled={!selection} className="flex items-center gap-2 font-semibold bg-zinc-800 border-2 border-zinc-700 py-2 px-4 rounded-lg hover:border-gold transition disabled:opacity-50 disabled:cursor-not-allowed"><TrimIcon />Trim</button>
                                    <button onClick={handleUndo} disabled={audioHistory.length === 0} className="flex items-center gap-2 font-semibold bg-zinc-800 border-2 border-zinc-700 py-2 px-4 rounded-lg hover:border-gold transition disabled:opacity-50"><RestartIcon />Undo</button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
                <Card title="Actions & Tools">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <button onClick={handleDownloadAudio} className="w-full bg-transparent border-2 border-zinc-700 font-bold py-4 px-4 rounded-lg hover:border-gold transition flex justify-center items-center gap-2 text-lg">
                           <DownloadIcon /> Download
                        </button>
                        <button onClick={handleSaveOrUpdateEpisode} className="w-full bg-gold text-background font-bold py-4 px-4 rounded-lg hover:opacity-90 transition flex justify-center items-center gap-2 text-lg shadow-lg shadow-gold/20">
                            {loadedEpisodeId ? 'Update Episode' : 'Save Episode'}
                        </button>
                    </div>
                     <div className="space-y-4 pt-6 border-t border-zinc-800">
                        <h3 className="text-lg font-semibold text-text-primary">Advanced Tools</h3>
                        <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-lg">
                            <label htmlFor="editor-toggle" className="font-semibold text-text-primary">Audio Editor</label>
                            <label htmlFor="editor-toggle" className="flex items-center cursor-pointer">
                                <div className="relative"><input id="editor-toggle" type="checkbox" className="sr-only" checked={isEditorActive} onChange={() => setIsEditorActive(!isEditorActive)} /><div className="block bg-zinc-700 w-12 h-7 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isEditorActive ? 'translate-x-full bg-gold' : ''}`}></div></div>
                            </label>
                        </div>
                         <div className="space-y-4 pt-4 border-t border-zinc-700/50">
                             <h4 className="text-md font-semibold text-text-primary">Promotional Content</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={() => handleGenerateAd('text')} disabled={!!isLoadingAd} className="bg-zinc-800 hover:bg-zinc-700/80 p-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50">
                                    {isLoadingAd === 'text' ? <LoaderIcon/> : <WandIcon/>} Generate Social Post
                                </button>
                                <button onClick={() => handleGenerateAd('script')} disabled={!!isLoadingAd} className="bg-zinc-800 hover:bg-zinc-700/80 p-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50">
                                    {isLoadingAd === 'script' ? <LoaderIcon/> : <AudioIcon/>} Generate Ad Script
                                </button>
                             </div>
                             {adText && <div className="p-4 bg-zinc-900/50 rounded-lg relative"><button onClick={() => copyToClipboard(adText)} className="absolute top-2 right-2 p-2 bg-zinc-700 rounded-full hover:bg-zinc-600"><CopyIcon/></button><p className="whitespace-pre-wrap text-sm text-text-secondary">{adText}</p></div>}
                             {adScript && <div className="p-4 bg-zinc-900/50 rounded-lg relative"><button onClick={() => copyToClipboard(adScript)} className="absolute top-2 right-2 p-2 bg-zinc-700 rounded-full hover:bg-zinc-600"><CopyIcon/></button><p className="whitespace-pre-wrap text-sm text-text-secondary">{adScript}</p></div>}
                         </div>
                     </div>
                    <div className="pt-6 border-t border-zinc-800">
                         <button onClick={handleStartOver} className="w-full bg-primary text-on-primary font-bold py-4 px-4 rounded-lg hover:bg-primary-hover transition flex justify-center items-center gap-2 text-lg shadow-primary-glow">
                            <RestartIcon /> Start Over
                        </button>
                    </div>
                </Card>
            </div>
             <div className="lg:col-span-1 bg-surface rounded-xl shadow-lg border border-zinc-800 overflow-hidden lg:max-h-[80vh] flex flex-col">
                <div className="p-8 border-b border-zinc-800">
                    <h2 className="text-2xl font-serif font-bold text-text-primary flex items-center gap-3"><ScriptIcon />Final Script</h2>
                </div>
                <div className="p-8 overflow-y-auto flex-grow">
                    <ScriptDisplay script={script} activeLineIndex={activeLineIndex} onLineClick={(idx) => handleSeek(scriptTimings[idx].startTime)} areTimingsStale={areTimingsStale}/>
                </div>
            </div>
            <audio ref={audioRef} className="hidden" />
        </div>
    );
};

const CreatorPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
        <div 
            className="bg-zinc-900/80 backdrop-blur-xl border border-gold/30 rounded-2xl shadow-2xl shadow-gold/10 p-8 relative max-w-sm w-full mx-4 text-center fade-in-scale"
            onClick={(e) => e.stopPropagation()}
        >
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-text-secondary hover:text-gold transition p-2 rounded-full"
                aria-label="Close creator details"
            >
                <CloseIcon />
            </button>
            <img 
                src="https://i.ibb.co/TDC9Xn1N/JSTYP-me-Logo.png" 
                alt="JSTYP.me Logo" 
                className="w-32 mx-auto mb-4"
            />
            <p className="text-text-secondary italic text-sm mb-6">Jason's solution to your problems</p>
            <p className="text-text-secondary text-base mb-8">
                Need a website, app, or a custom tool? <br/> Get in touch.
            </p>
            <div className="flex justify-center items-center gap-6">
                <a 
                    href="https://wa.me/27695989427" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="group flex items-center justify-center bg-zinc-800/50 border-2 border-zinc-700 rounded-full p-4 w-16 h-16 hover:border-gold hover:bg-gold/10 transition-all duration-300"
                    aria-label="Contact on WhatsApp"
                >
                    <WhatsAppIcon className="h-8 w-8 text-zinc-400 group-hover:text-gold transition-colors" />
                </a>
                <a 
                    href="mailto:jstypme@gmail.com" 
                    className="group flex items-center justify-center bg-zinc-800/50 border-2 border-zinc-700 rounded-full p-4 w-16 h-16 hover:border-gold hover:bg-gold/10 transition-all duration-300"
                    aria-label="Send an Email"
                >
                    <EmailIcon className="h-8 w-8 text-zinc-400 group-hover:text-gold transition-colors" />
                </a>
            </div>
        </div>
    </div>
);


const Footer: React.FC<{ onCreatorClick: () => void }> = ({ onCreatorClick }) => {
    const currentYear = new Date().getFullYear();
    return (
        <footer className="w-full text-center py-8 mt-12 border-t border-zinc-800 text-text-secondary flex flex-col items-center gap-4">
            <p className="text-sm">&copy; {currentYear} Brands by Ai. All Rights Reserved.</p>
            <button 
                onClick={onCreatorClick} 
                className="font-semibold text-sm border-2 border-zinc-700 rounded-full py-2 px-6 text-zinc-400 hover:border-gold hover:text-gold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-gold/20"
            >
                Meet the Creator
            </button>
        </footer>
    );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('creator');
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1
  const [samanthaName, setSamanthaName] = useState('Samantha');
  const [stewardName, setStewardName] = useState('Steward');
  const [samanthaVoice, setSamanthaVoice] = useState<string>('Kore');
  const [samanthaCustomSamples, setSamanthaCustomSamples] = useState<CustomAudioSample[]>([]);
  const [isRecordingSamantha, setIsRecordingSamantha] = useState<boolean>(false);
  const [isPreviewingSamantha, setIsPreviewingSamantha] = useState(false);
  const [isPreviewingSamanthaCustom, setIsPreviewingSamanthaCustom] = useState(false);
  const samanthaAudioFileInputRef = useRef<HTMLInputElement>(null);
  const [stewardVoice, setStewardVoice] = useState<string>('Fenrir');
  const [stewardCustomSamples, setStewardCustomSamples] = useState<CustomAudioSample[]>([]);
  const [isRecordingSteward, setIsRecordingSteward] = useState<boolean>(false);
  const [isPreviewingSteward, setIsPreviewingSteward] = useState(false);
  const [isPreviewingStewardCustom, setIsPreviewingStewardCustom] = useState(false);
  const stewardAudioFileInputRef = useRef<HTMLInputElement>(null);
  const [isThirdHostEnabled, setIsThirdHostEnabled] = useState(false);
  const [thirdHostName, setThirdHostName] = useState('');
  const [thirdHostRole, setThirdHostRole] = useState('');
  const [thirdHostGender, setThirdHostGender] = useState<'male' | 'female'>('male');
  const [thirdHostVoice, setThirdHostVoice] = useState<string>('Zephyr');
  const [thirdHostCustomSamples, setThirdHostCustomSamples] = useState<CustomAudioSample[]>([]);
  const [isRecordingThirdHost, setIsRecordingThirdHost] = useState<boolean>(false);
  const [isPreviewingThirdHost, setIsPreviewingThirdHost] = useState(false);
  const [isPreviewingThirdHostCustom, setIsPreviewingThirdHostCustom] = useState(false);
  const [isPreviewingQuality, setIsPreviewingQuality] = useState(false);
  const thirdHostAudioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Step 2
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeLength, setEpisodeLength] = useState(10);
  const [prompt, setPrompt] = useState<string>('');
  const [pdfText, setPdfText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [manualScriptText, setManualScriptText] = useState<string>('');
  const [customRules, setCustomRules] = useState<string>('');
  const [language, setLanguage] = useState<'English' | 'Afrikaans'>('English');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Step 3
  const [script, setScript] = useState<ScriptLine[] | null>(null);
  const [brandedName, setBrandedName] = useState('Brands by Ai');
  const [contactDetails, setContactDetails] = useState('');
  const [website, setWebsite] = useState('');
  const [slogan, setSlogan] = useState('');
  
  // Step 4
  const [audioData, setAudioData] = useState<string | null>(null);
  const [scriptTimings, setScriptTimings] = useState<ScriptTiming[] | null>(null);
  const [areTimingsStale, setAreTimingsStale] = useState<boolean>(false);
  const [adText, setAdText] = useState<string | null>(null);
  const [adScript, setAdScript] = useState<string | null>(null);

  // Episode Management
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadedEpisodeId, setLoadedEpisodeId] = useState<string | null>(null);

  // Global
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCreatorPopupVisible, setIsCreatorPopupVisible] = useState(false);

  const femaleVoices = [
      { name: 'Kore', label: 'Twitch Streamer (Female, Energetic)' },
      { name: 'Kore', label: 'Kore (Female, Clear & Professional)' },
      { name: 'Charon', label: 'Charon (Female, Warm & Raspy)' },
  ];
  const maleVoices = [
      { name: 'Puck', label: 'Twitch Streamer (Male, Expressive)' },
      { name: 'Fenrir', label: 'Fenrir (Male, Deep & Resonant)' },
      { name: 'Puck', label: 'Puck (Male, Warm & Engaging)' },
      { name: 'Zephyr', label: 'Zephyr (Male, Crisp & Professional)' },
  ];
  
  const resetState = (isNewEpisode: boolean = false) => {
      setPrompt(''); setPdfText(''); setFileName(''); setManualScriptText('');
      setCustomRules(''); setLanguage('English');
      setSamanthaName('Samantha'); setStewardName('Steward');
      setSamanthaVoice('Kore'); setSamanthaCustomSamples([]);
      setStewardVoice('Fenrir'); setStewardCustomSamples([]);
      setIsThirdHostEnabled(false); setThirdHostName(''); setThirdHostRole('');
      setThirdHostGender('male'); setThirdHostVoice('Zephyr'); setThirdHostCustomSamples([]);
      setScript(null); setAudioData(null); setScriptTimings(null);
      setBrandedName('Brands by Ai'); setContactDetails(''); setWebsite(''); setSlogan('');
      setError(''); setIsLoadingScript(false); setIsLoadingAudio(false);
      setAreTimingsStale(false); setAdText(null); setAdScript(null);
      
      if (isNewEpisode) {
        setLoadedEpisodeId(null);
        setEpisodeTitle('');
        setEpisodeLength(10);
        if (episodes.length > 0) {
            const maxEpNum = Math.max(...episodes.map(e => e.episodeNumber));
            setEpisodeNumber(maxEpNum + 1);
        } else {
            setEpisodeNumber(1);
        }
      }
  };

  const handleStartOver = () => {
    resetState(true);
    setCurrentStep(1);
  };
  
  useEffect(() => {
    try {
        const savedEpisodes = localStorage.getItem('podcastEpisodes');
        if (savedEpisodes) {
            const parsed = JSON.parse(savedEpisodes);
            setEpisodes(parsed);
            if (parsed.length > 0) {
                const maxEpNum = Math.max(...parsed.map((e: Episode) => e.episodeNumber));
                setEpisodeNumber(maxEpNum + 1);
            }
        }
    } catch (error) {
        console.error("Failed to load episodes from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
        const storableEpisodes = episodes.map(ep => {
            // Exclude large data strings to avoid exceeding localStorage quota.
            const { audioData, samanthaCustomSamples, stewardCustomSamples, thirdHostCustomSamples, ...storableEpisode } = ep;
            return { 
                ...storableEpisode, 
                audioData: null,
                samanthaCustomSamples: [],
                stewardCustomSamples: [],
                thirdHostCustomSamples: []
            };
        });
        localStorage.setItem('podcastEpisodes', JSON.stringify(storableEpisodes));
    } catch (error) {
        console.error("Failed to save episodes to localStorage", error);
    }
  }, [episodes]);

  useEffect(() => {
    if (thirdHostGender === 'female') {
      if (!femaleVoices.find(v => v.name === thirdHostVoice)) setThirdHostVoice('Charon');
    } else {
      if (!maleVoices.find(v => v.name === thirdHostVoice)) setThirdHostVoice('Zephyr');
    }
  }, [thirdHostGender, femaleVoices, maleVoices, thirdHostVoice]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(''); setFileName(file.name);
      try {
        setPdfText(await extractTextFromPdf(file));
      } catch (e) {
        setError("Failed to process PDF."); setFileName(''); setPdfText('');
      }
    }
  };

  const handleGenerateScript = useCallback(async () => {
    if (!episodeTitle.trim() || episodeNumber <= 0) {
        setError('Please provide an Episode Title and Number.'); setCurrentStep(2); return;
    }
    if (!prompt && !pdfText && !manualScriptText) {
      setError('Please provide a topic, upload a PDF, or write a custom script.'); return;
    }

    setIsLoadingScript(true); setError(''); setScript(null); setAudioData(null); setScriptTimings(null);
    
    try {
      const branding = { name: brandedName, contact: contactDetails, website, slogan };
      const thirdHost = isThirdHostEnabled && thirdHostName ? { name: thirdHostName, role: thirdHostRole, gender: thirdHostGender } : undefined;
      const generatedScript = await generateScript( prompt, pdfText, branding, manualScriptText, customRules, language, samanthaName || 'Samantha', stewardName || 'Steward', thirdHost, 'South African', episodeTitle, episodeNumber, episodeLength );
      setScript(generatedScript); setCurrentStep(3);
    } catch (e: any) {
      setError(`Failed to generate script: ${e.message}`);
    } finally {
      setIsLoadingScript(false);
    }
  }, [prompt, pdfText, brandedName, contactDetails, website, slogan, manualScriptText, customRules, language, samanthaName, stewardName, isThirdHostEnabled, thirdHostName, thirdHostRole, thirdHostGender, episodeTitle, episodeNumber, episodeLength]);
  
  const handleGenerateAudio = useCallback(async () => {
    if (!script) { setError('No script available to generate audio.'); return; }
    setIsLoadingAudio(true); setError(''); setAudioData(null); setScriptTimings(null); setAreTimingsStale(false);

    try {
        const getVoiceConfig = async (samples: CustomAudioSample[], prebuiltName: string): Promise<VoiceConfig> => {
            if (samples.length > 0) {
                const { data, mimeType } = await combineCustomAudioSamples(samples);
                return { type: 'custom', data, mimeType };
            }
            return { type: 'prebuilt', name: prebuiltName };
        };

      const samanthaVoiceConfig = await getVoiceConfig(samanthaCustomSamples, samanthaVoice);
      const stewardVoiceConfig = await getVoiceConfig(stewardCustomSamples, stewardVoice);
      const thirdHostVoiceConfig = isThirdHostEnabled && thirdHostName ? await getVoiceConfig(thirdHostCustomSamples, thirdHostVoice) : undefined;
      
      const thirdHostPayload = isThirdHostEnabled && thirdHostName && thirdHostVoiceConfig ? { name: thirdHostName, voiceConfig: thirdHostVoiceConfig, gender: thirdHostGender } : undefined;
      const { audioData, timings } = await generatePodcastAudio( script, samanthaName || 'Samantha', stewardName || 'Steward', samanthaVoiceConfig, stewardVoiceConfig, thirdHostPayload, 'South African');
      setAudioData(audioData); setScriptTimings(timings); setCurrentStep(4);
    } catch (e: any) {
      setError(`Failed to generate audio: ${e.message}`);
      setCurrentStep(3);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [script, samanthaVoice, stewardVoice, samanthaCustomSamples, stewardCustomSamples, thirdHostCustomSamples, samanthaName, stewardName, isThirdHostEnabled, thirdHostName, thirdHostVoice, thirdHostGender]);

  const handleDownloadAudio = () => {
    if (!audioData) return;
    const rawData = decode(audioData);
    const wavBlob = pcmToWav(rawData, 24000, 1, 16);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `podcast_ep${episodeNumber}_${episodeTitle.replace(/\s+/g, '_')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handlePreviewVoice = useCallback(async (speaker: Speaker) => {
    let voiceName: string, setIsPreviewing: (val: boolean) => void;
    if (speaker === 'samantha') { voiceName = samanthaVoice; setIsPreviewing = setIsPreviewingSamantha; } 
    else if (speaker === 'steward') { voiceName = stewardVoice; setIsPreviewing = setIsPreviewingSteward; } 
    else { voiceName = thirdHostVoice; setIsPreviewing = setIsPreviewingThirdHost; }
    setIsPreviewing(true); setError('');
    try {
      const audioBase64 = await previewVoice(voiceName, language, 'South African');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedData = decode(audioBase64);
      const buffer = await customDecodeAudioData(decodedData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      source.onended = () => setIsPreviewing(false);
    } catch (e: any) {
      setError(`Failed to preview voice: ${e.message}`); setIsPreviewing(false);
    }
  }, [samanthaVoice, stewardVoice, thirdHostVoice, language]);

  const handlePreviewQuality = async () => {
    setIsPreviewingQuality(true); setError('');
    try {
        const audioBase64 = await generateQualityPreviewAudio(samanthaName || 'Samantha', stewardName || 'Steward', samanthaVoice, stewardVoice, 'South African');
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decodedData = decode(audioBase64);
        const buffer = await customDecodeAudioData(decodedData, audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = buffer; source.connect(audioContext.destination); source.start();
        source.onended = () => setIsPreviewingQuality(false);
    } catch (e: any) {
        setError(`Failed to generate quality preview: ${e.message}`); setIsPreviewingQuality(false);
    }
  };
  
  const handlePreviewCustomVoice = useCallback(async (speaker: Speaker) => {
    let customSamples: CustomAudioSample[], setIsPreviewing: (val: boolean) => void;
    if (speaker === 'samantha') { customSamples = samanthaCustomSamples; setIsPreviewing = setIsPreviewingSamanthaCustom; } 
    else if (speaker === 'steward') { customSamples = stewardCustomSamples; setIsPreviewing = setIsPreviewingStewardCustom; } 
    else { customSamples = thirdHostCustomSamples; setIsPreviewing = setIsPreviewingThirdHostCustom; }
    
    if (customSamples.length === 0) return;

    setIsPreviewing(true); setError('');
    try {
      const combinedSample = await combineCustomAudioSamples(customSamples);
      const audioBase64 = await previewClonedVoice(combinedSample, language, 'South African');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedData = decode(audioBase64);
      const buffer = await customDecodeAudioData(decodedData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = buffer; source.connect(audioContext.destination); source.start();
      source.onended = () => setIsPreviewing(false);
    } catch (e: any) {
      setError(`Failed to preview custom voice: ${e.message}`); setIsPreviewing(false);
    }
  }, [samanthaCustomSamples, stewardCustomSamples, thirdHostCustomSamples, language]);
  
  const handleToggleRecording = async (speaker: Speaker) => {
    let isRecording: boolean, setIsRecording: (val: boolean) => void, samples: CustomAudioSample[];
    if (speaker === 'samantha') { isRecording = isRecordingSamantha; setIsRecording = setIsRecordingSamantha; samples = samanthaCustomSamples } 
    else if (speaker === 'steward') { isRecording = isRecordingSteward; setIsRecording = setIsRecordingSteward; samples = stewardCustomSamples } 
    else { isRecording = isRecordingThirdHost; setIsRecording = setIsRecordingThirdHost; samples = thirdHostCustomSamples }
    
    if (samples.length >= 5) {
      setError("You can add a maximum of 5 audio samples.");
      return;
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop(); setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          try {
            const { base64, mimeType } = await import('./utils/audioUtils').then(m => m.processAudioForCloning(audioBlob));
            const url = `data:${mimeType};base64,${base64}`;
            const customAudio: CustomAudioSample = { url, base64, mimeType, name: `Recording ${new Date().toLocaleTimeString()}` };
            if (speaker === 'samantha') setSamanthaCustomSamples(prev => [...prev, customAudio]);
            else if (speaker === 'steward') setStewardCustomSamples(prev => [...prev, customAudio]);
            else setThirdHostCustomSamples(prev => [...prev, customAudio]);
          } catch(e: any) {
             setError(e.message || "Failed to process recording.");
          } finally {
            stream.getTracks().forEach(track => track.stop());
          }
        };
        mediaRecorder.start(); setIsRecording(true);
      } catch (e) { setError("Could not access microphone."); }
    }
  };
  
  const handleAudioFileChange = async (event: React.ChangeEvent<HTMLInputElement>, speaker: Speaker) => {
    const file = event.target.files?.[0];
    if (file) {
      let samples: CustomAudioSample[];
      if (speaker === 'samantha') samples = samanthaCustomSamples;
      else if (speaker === 'steward') samples = stewardCustomSamples;
      else samples = thirdHostCustomSamples;
      
      if (samples.length >= 5) {
        setError("You can add a maximum of 5 audio samples.");
        return;
      }

      setError('');
      try {
        const { base64, mimeType } = await import('./utils/audioUtils').then(m => m.processAudioForCloning(file));
        const url = `data:${mimeType};base64,${base64}`;
        const customAudio: CustomAudioSample = { url, base64, mimeType, name: file.name };
        if (speaker === 'samantha') setSamanthaCustomSamples(prev => [...prev, customAudio]);
        else if (speaker === 'steward') setStewardCustomSamples(prev => [...prev, customAudio]);
        else setThirdHostCustomSamples(prev => [...prev, customAudio]);
      } catch (e: any) { setError(e.message || "Failed to read and process audio file."); }
    }
    if (event.target) { event.target.value = ''; }
  };
  
  const handleRemoveCustomAudio = (speaker: Speaker, index: number) => {
    if (speaker === 'samantha') setSamanthaCustomSamples(prev => prev.filter((_, i) => i !== index));
    else if (speaker === 'steward') setStewardCustomSamples(prev => prev.filter((_, i) => i !== index));
    else setThirdHostCustomSamples(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveOrUpdateEpisode = () => {
    if (!episodeTitle.trim() || episodeNumber <= 0) { setError("Episode Title and Number are required to save."); return; }
    const episodeData: Omit<Episode, 'id' | 'title' | 'episodeNumber'> = {
        samanthaName, stewardName, samanthaVoice, samanthaCustomSamples, stewardVoice, stewardCustomSamples,
        isThirdHostEnabled, thirdHostName, thirdHostRole, thirdHostGender, thirdHostVoice, thirdHostCustomSamples,
        prompt, pdfText, fileName, manualScriptText, customRules, language, episodeLength,
        script, scriptTimings, brandedName, contactDetails, website, slogan, backgroundSound: 'none', audioData,
        adText, adScript
    };
    if (loadedEpisodeId) {
        setEpisodes(prev => prev.map(ep => ep.id === loadedEpisodeId ? { ...ep, ...episodeData, title: episodeTitle, episodeNumber } : ep));
    } else {
        const newId = `ep_${Date.now()}`;
        setEpisodes(prev => [...prev, { ...episodeData, id: newId, title: episodeTitle, episodeNumber }]);
        setLoadedEpisodeId(newId);
    }
    setError('');
  };
  
  const handleLoadEpisode = (id: string) => {
    if (!id) return;
    const ep = episodes.find(e => e.id === id);
    if (!ep) { setError("Could not find the selected episode to load."); return; }
    setSamanthaName(ep.samanthaName); setStewardName(ep.stewardName);
    setSamanthaVoice(ep.samanthaVoice); setSamanthaCustomSamples(ep.samanthaCustomSamples || []);
    setStewardVoice(ep.stewardVoice); setStewardCustomSamples(ep.stewardCustomSamples || []);
    setIsThirdHostEnabled(ep.isThirdHostEnabled); setThirdHostName(ep.thirdHostName);
    setThirdHostRole(ep.thirdHostRole); setThirdHostGender(ep.thirdHostGender);
    setThirdHostVoice(ep.thirdHostVoice); setThirdHostCustomSamples(ep.thirdHostCustomSamples || []);
    setPrompt(ep.prompt); setPdfText(ep.pdfText); setFileName(ep.fileName);
    setManualScriptText(ep.manualScriptText); setCustomRules(ep.customRules); setLanguage(ep.language); setEpisodeLength(ep.episodeLength || 10);
    setScript(ep.script); setScriptTimings(ep.scriptTimings); setBrandedName(ep.brandedName);
    setContactDetails(ep.contactDetails); setWebsite(ep.website); setSlogan(ep.slogan);
    setAudioData(ep.audioData); setEpisodeTitle(ep.title); setEpisodeNumber(ep.episodeNumber);
    setLoadedEpisodeId(ep.id);
    setAdText(ep.adText || null); setAdScript(ep.adScript || null);
    if (ep.audioData) setCurrentStep(4);
    else if (ep.script) setCurrentStep(3);
    else setCurrentStep(2);
    setError('');
  };

  const areContentInputsValid = () => !!(prompt || pdfText || manualScriptText);
  const areHostsValid = () => samanthaName.trim() !== '' && stewardName.trim() !== '' && (!isThirdHostEnabled || (thirdHostName.trim() !== '' && thirdHostRole.trim() !== ''));

  const renderCreatorContent = () => {
    switch(currentStep) {
      case 1: return <StepHosts error={error} setError={setError} samanthaName={samanthaName} setSamanthaName={setSamanthaName} stewardName={stewardName} setStewardName={setStewardName} samanthaVoice={samanthaVoice} setSamanthaVoice={setSamanthaVoice} stewardVoice={stewardVoice} setStewardVoice={setStewardVoice} isThirdHostEnabled={isThirdHostEnabled} setIsThirdHostEnabled={setIsThirdHostEnabled} thirdHostName={thirdHostName} setThirdHostName={setThirdHostName} thirdHostRole={thirdHostRole} setThirdHostRole={setThirdHostRole} thirdHostGender={thirdHostGender} setThirdHostGender={setThirdHostGender} thirdHostVoice={thirdHostVoice} setThirdHostVoice={setThirdHostVoice} isPreviewingSamantha={isPreviewingSamantha} isPreviewingSteward={isPreviewingSteward} isPreviewingThirdHost={isPreviewingThirdHost} handlePreviewVoice={handlePreviewVoice} femaleVoices={femaleVoices} maleVoices={maleVoices} areHostsValid={areHostsValid} setCurrentStep={setCurrentStep} samanthaCustomSamples={samanthaCustomSamples} isPreviewingSamanthaCustom={isPreviewingSamanthaCustom} isRecordingSamantha={isRecordingSamantha} samanthaAudioFileInputRef={samanthaAudioFileInputRef} stewardCustomSamples={stewardCustomSamples} isPreviewingStewardCustom={isPreviewingStewardCustom} isRecordingSteward={isRecordingSteward} stewardAudioFileInputRef={stewardAudioFileInputRef} thirdHostCustomSamples={thirdHostCustomSamples} isPreviewingThirdHostCustom={isPreviewingThirdHostCustom} isRecordingThirdHost={isRecordingThirdHost} thirdHostAudioFileInputRef={thirdHostAudioFileInputRef} handlePreviewCustomVoice={handlePreviewCustomVoice} handleRemoveCustomAudio={handleRemoveCustomAudio} handleToggleRecording={handleToggleRecording} handleAudioFileChange={handleAudioFileChange} isPreviewingQuality={isPreviewingQuality} handlePreviewQuality={handlePreviewQuality} />;
      case 2: return <StepContent error={error} episodeTitle={episodeTitle} setEpisodeTitle={setEpisodeTitle} episodeNumber={episodeNumber} setEpisodeNumber={setEpisodeNumber} episodeLength={episodeLength} setEpisodeLength={setEpisodeLength} language={language} setLanguage={setLanguage} prompt={prompt} setPrompt={setPrompt} fileName={fileName} fileInputRef={fileInputRef} handleFileChange={handleFileChange} samanthaName={samanthaName} stewardName={stewardName} manualScriptText={manualScriptText} setManualScriptText={setManualScriptText} customRules={customRules} setCustomRules={setCustomRules} setCurrentStep={setCurrentStep} handleGenerateScript={handleGenerateScript} isLoadingScript={isLoadingScript} areContentInputsValid={areContentInputsValid} />;
      case 3: return <StepScriptAndAudio error={error} isLoadingAudio={isLoadingAudio} brandedName={brandedName} setBrandedName={setBrandedName} contactDetails={contactDetails} setContactDetails={setContactDetails} website={website} setWebsite={setWebsite} slogan={slogan} setSlogan={setSlogan} script={script} setScript={setScript as (s: ScriptLine[]) => void} setCurrentStep={setCurrentStep} handleGenerateAudio={handleGenerateAudio} />;
      case 4: return script && audioData && scriptTimings ? <StepStudio audioData={audioData} setAudioData={setAudioData} script={script} scriptTimings={scriptTimings} handleDownloadAudio={handleDownloadAudio} handleStartOver={handleStartOver} handleSaveOrUpdateEpisode={handleSaveOrUpdateEpisode} loadedEpisodeId={loadedEpisodeId} areTimingsStale={areTimingsStale} setAreTimingsStale={setAreTimingsStale} adText={adText} setAdText={setAdText} adScript={adScript} setAdScript={setAdScript} episodeTitle={episodeTitle} brandedName={brandedName}/> : <div>Loading...</div>;
      default: return <div />;
    }
  }

  return (
    <div className="min-h-screen font-sans bg-background text-text-primary flex flex-col">
      <div className="w-full sm:max-w-7xl mx-auto sm:px-6 lg:px-8 flex-grow">
        <header className="relative overflow-hidden pt-16 pb-12 text-center space-y-4">
            <Logo />
            <h1 className="text-5xl font-serif font-black text-text-primary tracking-tight">AI Podcast Studio</h1>
            <p className="text-lg text-text-secondary">Craft, edit, and produce professional podcasts with AI.</p>
        </header>
        
        {/* Main Tab Navigation */}
        <div className="w-full mb-12">
            <h2 className="text-center text-2xl font-serif font-bold text-gold mb-4 tracking-wider">Select Your Workspace</h2>
            <div className="w-full border-b border-zinc-800 flex justify-center">
                <nav className="flex items-center gap-4">
                    <TabButton name="Creator" icon={<VideoIcon />} isActive={activeTab === 'creator'} onClick={() => setActiveTab('creator')} />
                    <TabButton name="Editor" icon={<CutIcon />} isActive={activeTab === 'editor'} onClick={() => setActiveTab('editor')} />
                    <TabButton name="About" icon={<InfoIcon />} isActive={activeTab === 'about'} onClick={() => setActiveTab('about')} />
                </nav>
            </div>
        </div>

        {activeTab === 'creator' && (
          <div className="fade-in">
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg py-8 px-4 sm:px-0">
              <StepIndicator currentStep={currentStep} />
            </div>
          
            <main className="py-12 px-4 sm:px-0">
              <div className="bg-surface border border-zinc-800 rounded-xl p-6 mb-12 flex flex-col sm:flex-row gap-6 items-center shadow-lg max-w-4xl mx-auto">
                    <select onChange={(e) => handleLoadEpisode(e.target.value)} className="w-full text-lg bg-zinc-800 border border-zinc-700 rounded-lg p-4 focus:ring-2 focus:ring-gold focus:border-gold transition appearance-none" value={loadedEpisodeId || ""} aria-label="Load saved episode">
                        <option value="" disabled>Load a saved episode...</option>
                        {episodes.map(ep => (<option key={ep.id} value={ep.id}>Ep {ep.episodeNumber}: {ep.title}</option>))}
                    </select>
                    <button onClick={handleStartOver} className="w-full sm:w-auto bg-primary text-on-primary font-bold py-4 px-8 rounded-lg hover:bg-primary-hover transition flex-shrink-0 shadow-primary-glow">
                        New Episode
                    </button>
              </div>
              <div key={currentStep} className="fade-in">
                  {renderCreatorContent()}
              </div>
            </main>
          </div>
        )}
        
        {activeTab === 'editor' && <AudioEditorTab />}
        {activeTab === 'about' && <AboutTab />}

      </div>
       <Footer onCreatorClick={() => setIsCreatorPopupVisible(true)} />
      {isCreatorPopupVisible && <CreatorPopup onClose={() => setIsCreatorPopupVisible(false)} />}
    </div>
  );
}

const TabButton: React.FC<{ name: string; icon: React.ReactNode; isActive: boolean; onClick: () => void; }> = ({ name, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 py-4 px-6 font-bold text-lg border-b-4 transition-all duration-300 ${
            isActive
                ? 'border-gold text-gold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
        }`}
    >
        {icon}
        <span>{name}</span>
    </button>
);

const AudioEditor = ({ initialAudioData, onStartOver }: { initialAudioData: string, onStartOver: () => void }) => {
    const [audioData, setAudioData] = useState<string>(initialAudioData);
    const [audioHistory, setAudioHistory] = useState<string[]>([]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef<HTMLAudioElement>(null);

    const waveformRef = useRef<HTMLCanvasElement>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ start: number, end: number} | null>(null);
    const isDraggingRef = useRef(false);
    const [isTouch, setIsTouch] = useState(false);
    const [zoom, setZoom] = useState(1);


    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (audioData && audioRef.current) {
            const rawData = decode(audioData);
            const wavBlob = pcmToWav(rawData, 24000, 1, 16);
            const url = URL.createObjectURL(wavBlob);
            audioRef.current.src = url;
            return () => URL.revokeObjectURL(url);
        }
    }, [audioData]);

    const drawWaveform = useCallback((normalizedData: number[]) => {
        const canvas = waveformRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;
        const centerY = height / 2;
        
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for(let i = 0; i < normalizedData.length; i++) {
            const x = (i / normalizedData.length) * width;
            const y = normalizedData[i] * centerY + centerY;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        const progressX = duration > 0 ? (currentTime / duration) * width : 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, progressX, height);
        ctx.clip();
        
        ctx.strokeStyle = '#ECB365';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for(let i = 0; i < normalizedData.length; i++) {
            const x = (i / normalizedData.length) * width;
            const y = normalizedData[i] * centerY + centerY;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        if (selection) {
            ctx.fillStyle = 'rgba(225, 29, 72, 0.3)';
            const startX = (selection.start / duration) * width;
            const endX = (selection.end / duration) * width;
            ctx.fillRect(startX, 0, endX - startX, height);
        }
    }, [currentTime, duration, selection]);
    
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      
      const handleLoadedMetadata = () => { if (isFinite(audio.duration)) setDuration(audio.duration); setCurrentTime(audio.currentTime); };
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handlePause);

      return () => {
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('play', handlePlay);
          audio.removeEventListener('pause', handlePause);
          audio.removeEventListener('ended', handlePause);
      };
    }, [audioRef]);


    useEffect(() => {
        if (!audioData) return;
        
        const rawData = decode(audioData);
        const pcm = new Int16Array(rawData.buffer);
        const channelData = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) {
            channelData[i] = pcm[i] / 32768.0;
        }

        const samples = Math.floor(400 * zoom);
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(channelData[blockSize * i + j]);
            }
            filteredData.push(sum / blockSize);
        }

        const multiplier = Math.pow(Math.max(...filteredData), -1) || 1;
        const normalizedData = filteredData.map(n => n * multiplier * 2 - 1);
        
        drawWaveform(normalizedData);
        
    }, [audioData, drawWaveform, currentTime, selection, zoom]);

    const handleWaveformInteraction = useCallback((clientX: number, type: 'down' | 'move' | 'up') => {
        const container = waveformContainerRef.current;
        if (!container || duration === 0) return;

        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const totalWidth = container.scrollWidth;

        const relativeX = clientX - rect.left;
        const absoluteX = relativeX + scrollLeft;
        
        const time = Math.max(0, Math.min((absoluteX / totalWidth) * duration, duration));

        if (type === 'down') {
            isDraggingRef.current = true;
            setSelection({ start: time, end: time });
        } else if (type === 'move' && isDraggingRef.current && selection) {
            setSelection({ ...selection, end: time });
        } else if (type === 'up') {
            isDraggingRef.current = false;
            if (selection && selection.start > selection.end) {
                setSelection({ start: selection.end, end: selection.start });
            }
        }
    }, [duration, selection]);

    const togglePlayPause = async () => {
        if (!audioRef.current) return;
        try {
            if (audioRef.current.paused) {
                await audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error("Error playing/pausing audio:", error);
            }
        }
    };
    
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleAudioEdit = (type: 'cut' | 'trim' | 'silence' | 'fadeIn' | 'fadeOut') => {
        if (!selection || !audioData) return;
        setAudioHistory(prev => [...prev, audioData]);
        
        const pcmData = decode(audioData);
        const bytesPerSample = 2; // 16-bit
        const sampleRate = 24000;
        
        let startByte = Math.floor(selection.start * sampleRate * bytesPerSample);
        let endByte = Math.floor(selection.end * sampleRate * bytesPerSample);
        startByte -= startByte % 2;
        endByte -= endByte % 2;

        let newData;
        const part1 = pcmData.slice(0, startByte);
        const selectedPart = pcmData.slice(startByte, endByte);
        const part2 = pcmData.slice(endByte);

        switch(type) {
            case 'cut':
                newData = concatenatePcm([part1, part2]);
                break;
            case 'trim':
                newData = selectedPart;
                break;
            case 'silence':
                const silenceDuration = selection.end - selection.start;
                const silence = generateSilence(silenceDuration, sampleRate, 16);
                newData = concatenatePcm([part1, silence, part2]);
                break;
            case 'fadeIn':
                const fadedInPart = applyFade(selectedPart, 'in');
                newData = concatenatePcm([part1, fadedInPart, part2]);
                break;
            case 'fadeOut':
                const fadedOutPart = applyFade(selectedPart, 'out');
                newData = concatenatePcm([part1, fadedOutPart, part2]);
                break;
            default:
                newData = pcmData;
        }

        setAudioData(encode(newData));
        setSelection(null);
    };

    const handleUndo = () => {
        if (audioHistory.length > 0) {
            const lastState = audioHistory[audioHistory.length - 1];
            setAudioData(lastState);
            setAudioHistory(prev => prev.slice(0, -1));
        }
    };
    
    const handleDownload = () => {
        if (!audioData) return;
        const rawData = decode(audioData);
        const wavBlob = pcmToWav(rawData, 24000, 1, 16);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_audio_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
      <div className="max-w-4xl mx-auto text-center py-12 fade-in">
        <Card title="Audio Editor" icon={<EditIcon />}>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
                <button onClick={onStartOver} className="w-full sm:w-auto bg-transparent border-2 border-zinc-700 font-bold py-3 px-6 rounded-lg hover:border-gold transition flex justify-center items-center gap-2">
                    <UploadIcon /> Load New File
                </button>
                <button onClick={handleDownload} className="w-full sm:w-auto bg-gold text-background font-bold py-3 px-6 rounded-lg hover:opacity-90 transition flex justify-center items-center gap-2 shadow-lg shadow-gold/20">
                    <DownloadIcon /> Download Audio
                </button>
            </div>
            
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
                 <div className="flex items-center gap-4 p-2 bg-zinc-800/50 rounded-lg">
                    <ZoomOutIcon />
                    <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        step="1"
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold"
                        aria-label="Zoom waveform"
                    />
                    <ZoomInIcon />
                </div>
                <div ref={waveformContainerRef} className="w-full overflow-x-auto">
                    <canvas 
                        ref={waveformRef} 
                        className="h-24 md:h-32 cursor-text touch-none"
                        style={{ width: `${zoom * 100}%` }}
                        onMouseDown={(e) => { setIsTouch(false); handleWaveformInteraction(e.clientX, 'down'); }} 
                        onMouseMove={(e) => !isTouch && isDraggingRef.current && handleWaveformInteraction(e.clientX, 'move')} 
                        onMouseUp={(e) => !isTouch && handleWaveformInteraction(e.clientX, 'up')} 
                        onMouseLeave={() => { if(!isTouch) isDraggingRef.current = false; }}
                        onTouchStart={(e) => { setIsTouch(true); handleWaveformInteraction(e.touches[0].clientX, 'down'); }}
                        onTouchMove={(e) => handleWaveformInteraction(e.touches[0].clientX, 'move')}
                        onTouchEnd={(e) => handleWaveformInteraction(e.changedTouches[0].clientX, 'up')}
                    ></canvas>
                </div>
                <div className="flex justify-between text-sm text-text-secondary font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => handleSeek(Math.max(0, currentTime - 5))} className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"><RewindIcon /></button>
                    <button onClick={togglePlayPause} className="p-5 bg-primary text-on-primary rounded-full hover:bg-primary-hover transition transform hover:scale-110 shadow-primary-glow">
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button onClick={() => handleSeek(Math.min(duration, currentTime + 5))} className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"><ForwardIcon /></button>
                </div>
                 <div className="flex items-center gap-4 pt-4">
                    <button onClick={() => handleVolumeChange({ target: { value: volume > 0 ? '0' : '1' } } as any)}>{volume > 0 ? <VolumeHighIcon /> : <VolumeMuteIcon />}</button>
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold" />
                </div>
            </div>

            <div className="pt-8 mt-8 border-t border-zinc-800">
                <h3 className="text-xl font-serif font-bold text-text-primary mb-6">Editing Tools</h3>
                {selection && <p className="text-sm text-center text-text-secondary font-mono mb-4">Selection: {formatTime(selection.start)} to {formatTime(selection.end)} ({formatTime(selection.end - selection.start)})</p>}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                    <button onClick={handleUndo} disabled={audioHistory.length === 0} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <RestartIcon /> <span className="text-sm font-semibold">Undo</span>
                    </button>
                    <button onClick={() => handleAudioEdit('cut')} disabled={!selection} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <CutIcon /> <span className="text-sm font-semibold">Cut</span>
                    </button>
                     <button onClick={() => handleAudioEdit('trim')} disabled={!selection} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <TrimIcon /> <span className="text-sm font-semibold">Trim</span>
                    </button>
                    <button onClick={() => handleAudioEdit('silence')} disabled={!selection} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <SilenceIcon /> <span className="text-sm font-semibold">Silence</span>
                    </button>
                    <button onClick={() => handleAudioEdit('fadeIn')} disabled={!selection} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <FadeInIcon /> <span className="text-sm font-semibold">Fade In</span>
                    </button>
                     <button onClick={() => handleAudioEdit('fadeOut')} disabled={!selection} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <FadeInIcon className="transform -scale-x-100"/> <span className="text-sm font-semibold">Fade Out</span>
                    </button>
                </div>
            </div>
            <audio ref={audioRef} className="hidden" />
        </Card>
      </div>
    );
}

const AudioEditorTab = () => {
    const [audioData, setAudioData] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError('');
        try {
            const pcmBase64 = await audioBlobToPcmBase64(file);
            setAudioData(pcmBase64);
        } catch (e: any) {
            setError(e.message || 'Failed to process audio file.');
        } finally {
            setIsLoading(false);
            if (event.target) event.target.value = ''; // Reset file input
        }
    };
    
    if (isLoading) {
        return <div className="text-center py-20"><LoaderIcon /> <p className="mt-4 text-text-secondary">Processing audio...</p></div>
    }

    if (error) {
         return (
            <div className="max-w-2xl mx-auto text-center py-20 fade-in">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex flex-col items-center gap-4">
                    <ErrorIcon />
                    <p className="font-semibold text-red-300">An Error Occurred</p>
                    <p className="text-red-400/80 text-sm">{error}</p>
                     <button 
                        onClick={() => setError('')}
                        className="w-full sm:w-auto bg-primary text-on-primary font-bold py-2 px-6 rounded-lg hover:bg-primary-hover transition mt-4"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    if (!audioData) {
        return (
            <div className="max-w-2xl mx-auto text-center py-20 fade-in">
                <Card title="Standalone Audio Editor">
                    <p className="text-text-secondary">Load an existing podcast or any audio file to make quick edits. The editor works with raw audio data and is perfect for trimming intros, cutting sections, or cleaning up your final track.</p>
                    <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-primary text-on-primary font-bold py-4 px-10 rounded-lg hover:bg-primary-hover transition flex justify-center items-center gap-2 text-lg shadow-primary-glow mt-8"
                    >
                        <UploadIcon /> Load Audio File
                    </button>
                </Card>
            </div>
        )
    }
    
    return <AudioEditor initialAudioData={audioData} onStartOver={() => setAudioData(null)} />;
};

const AboutTab = () => {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-0 fade-in">
            <Card title="About AI Podcast Studio" icon={<InfoIcon />}>
                <div className="prose prose-invert prose-lg text-text-secondary space-y-8">
                    <p className="text-xl">
                        Welcome to the <span className="text-gold font-bold">AI Podcast Studio</span>, a comprehensive suite of tools designed to take your podcast from a simple idea to a fully produced episode, all with the power of cutting-edge generative AI.
                    </p>

                    <div className="border-t border-zinc-700 pt-6">
                        <h3 className="text-2xl text-text-primary font-serif mb-4">How It Works: A Step-by-Step Guide</h3>
                        <p>The studio guides you through a simple, four-step process:</p>
                        <ol className="list-decimal list-inside space-y-2">
                            <li><strong>I: Define Your Hosts:</strong> Choose from hyper-realistic pre-built voices or clone your own by providing short audio samples. This step sets the personality of your show.</li>
                            <li><strong>II: Content & AI Rules:</strong> This is where your story begins. Provide a topic, upload a PDF for context, or even paste in a draft script. You can add custom rules to guide the AI's writing style.</li>
                            <li><strong>III: Finalize & Generate:</strong> Review the AI-generated script. You can edit the dialogue to perfection before moving on to the main event: audio generation.</li>
                            <li><strong>IV: Production Studio:</strong> Listen to your fully generated podcast! Use the built-in editor to make final touches, then download your episode or generate promotional content.</li>
                        </ol>
                    </div>

                    <div className="border-t border-zinc-700 pt-6">
                        <h3 className="text-2xl text-text-primary font-serif mb-4">Key Features in Detail</h3>
                        
                        <div className="p-4 bg-zinc-900/50 rounded-lg">
                            <h4 className="text-xl text-gold font-semibold">Hyper-Realistic Voices & Interruptions</h4>
                            <p>Our AI doesn't just read lines; it performs them. It generates natural, conversational dialogue that sounds truly human. The secret is in the details: realistic pacing, emotional cues, and—most importantly—natural interruptions. This prevents the "turn-by-turn" feel of older text-to-speech, creating a dynamic and engaging listening experience.</p>
                        </div>
                        
                        <div className="p-4 mt-4 bg-zinc-900/50 rounded-lg">
                             <h4 className="text-xl text-gold font-semibold">Voice Cloning</h4>
                            <p>Make your podcast uniquely yours. Instead of using pre-built voices, you can provide audio samples to create a custom voice clone for any host. The AI analyzes the unique characteristics of the voice—pitch, tone, and cadence—to create a digital model that can speak any line you give it.</p>
                        </div>

                         <div className="p-4 mt-4 bg-zinc-900/50 rounded-lg">
                             <h4 className="text-xl text-gold font-semibold">Intelligent Scripting from Any Source</h4>
                            <p>Whether you have a fully formed idea or just a spark, the AI can help. It can generate a complete script from a simple topic, a detailed research paper in PDF format, or even polish and expand upon a rough draft you provide.</p>
                             <p className="mt-2 text-sm italic"><strong>Example:</strong> Simply providing the topic "The history of coffee" and a 10-minute length can yield a full conversational script, complete with an intro, main discussion points, and an outro.</p>
                        </div>
                        
                        <div className="p-4 mt-4 bg-zinc-900/50 rounded-lg">
                             <h4 className="text-xl text-gold font-semibold">The Production Studio & Waveform Editor</h4>
                            <p>Once your audio is generated, you enter the Production Studio. Here you'll see a visual representation of your audio—the waveform. You can play, pause, and listen to the final product. With the integrated Audio Editor, you can select parts of the waveform to make precise edits.</p>
                             <p className="mt-2">Use the <span className="font-mono text-gold bg-zinc-800 px-1 rounded">Zoom Slider</span> to get a closer look at the audio, allowing you to trim silence, cut mistakes, or apply fades with pinpoint accuracy.</p>
                        </div>
                    </div>

                    <div className="border-t border-zinc-700 pt-6">
                         <h3 className="text-2xl text-text-primary font-serif mb-4">Tips for Best Results</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>For Voice Cloning:</strong> Record in a quiet environment with no background noise. Speak clearly and naturally for at least 10-15 seconds. The more clean audio you provide (up to 5 samples), the better the clone will be.</li>
                            <li><strong>For Scripting:</strong> Be specific in your prompts. Instead of "AI," try "The impact of generative AI on creative industries." Use the "Advanced AI Rules" to guide the tone, like "Keep the tone light and humorous" or "Avoid technical jargon."</li>
                            <li><strong>For Editing:</strong> Use headphones to catch small details in the audio. Zoom in on the waveform before making a cut to ensure you're not clipping the beginning or end of a word.</li>
                        </ul>
                    </div>

                    <p>This application is designed to streamline the entire podcast creation workflow, giving you professional-grade tools in a simple, intuitive interface. Happy podcasting!</p>
                </div>
            </Card>
        </div>
    )
};