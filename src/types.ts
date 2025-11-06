import { ScriptLine } from './App';

export interface ScriptLine {
  speaker: string;
  dialogue: string;
  cue?: string;
  isInterruption?: boolean;
}

export type PrebuiltVoice = { type: 'prebuilt'; name: string };
export type CustomVoice = { type: 'custom'; data: string; mimeType: string };
export type VoiceConfig = PrebuiltVoice | CustomVoice;

// Interface for managing custom audio state from either recording or upload
export interface CustomAudioSample {
  url: string;
  base64: string;
  mimeType: string;
  name: string; // 'Your Recording' or the uploaded file name
}

export interface ScriptTiming {
  lineIndex: number;
  startTime: number;
  duration: number;
}

export interface GuestHost {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  voice: string;
  customSamples: CustomAudioSample[];
}

export interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  // Step 1 state
  samanthaName: string;
  stewardName: string;
  samanthaVoice: string;
  samanthaCustomSamples: CustomAudioSample[];
  stewardVoice: string;
  stewardCustomSamples: CustomAudioSample[];
  guestHosts: GuestHost[];
  // Step 2 state
  prompt: string;
  pdfText: string;
  fileName: string;
  manualScriptText: string;
  customRules: string;
  language: 'English' | 'Afrikaans';
  episodeLength: number;
  // Step 3 state
  script: ScriptLine[] | null;
  scriptTimings: ScriptTiming[] | null;
  brandedName: string;
  contactDetails: string;
  website: string;
  slogan: string;
  backgroundSound: string;
  backgroundVolume: number;
  // Step 4 state
  audioData: string | null;
  adText?: string | null;
  adScript?: string | null;
}

export type EffectType = 'volume' | 'noise' | 'speed';

export interface ApiKey {
  key: string;
  isActive: boolean;
}
