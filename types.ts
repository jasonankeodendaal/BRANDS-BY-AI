export interface ScriptLine {
  speaker: string;
  dialogue: string;
  cue?: string;
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
  isThirdHostEnabled: boolean;
  thirdHostName: string;
  thirdHostRole: string;
  thirdHostGender: 'male' | 'female';
  thirdHostVoice: string;
  thirdHostCustomSamples: CustomAudioSample[];
  // Step 2 state
  prompt: string;
  pdfText: string;
  fileName: string;
  manualScriptText: string;
  combineScripts: boolean;
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
  // Step 4 state
  audioData: string | null;
}