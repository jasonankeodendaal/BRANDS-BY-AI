import { ScriptLine, GuestHost, ScriptTiming } from '../types';
import { getApiKeys } from './apiKeyService';
import { audioBlobToPcmBase64, concatenatePcm, decode, encode, getPcmChunkDuration } from '../utils/audioUtils';

// --- Constants for Hugging Face Models ---
const SCRIPT_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";
const TTS_MODEL = "suno/bark"; // A good quality TTS model

// --- Authentication and Error Handling ---
const getHuggingFaceToken = (): string | null => {
    const hfKey = getApiKeys().find(k => k.type === 'huggingface');
    return hfKey ? hfKey.key : null;
};

const withHuggingFaceAuth = async <T>(apiCall: (token: string) => Promise<T>): Promise<T> => {
    const token = getHuggingFaceToken();
    if (!token) {
        throw new Error("No Hugging Face API token found. Please add one in the Settings tab.");
    }
    try {
        return await apiCall(token);
    } catch (error: any) {
        // More detailed error handling for HF
        if (error.message.includes('401')) {
            throw new Error("Hugging Face authentication failed. Your token is likely invalid.");
        }
        if (error.message.includes('currently loading')) {
             throw new Error("The Hugging Face model is currently loading. Please wait a minute and try again.");
        }
        throw error; // Re-throw other errors
    }
};

const hfInference = async (token: string, model: string, inputs: any) => {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Hugging Face API Error:", errorText);
        throw new Error(`Hugging Face API request failed with status ${response.status}: ${errorText}`);
    }
    return response;
};

// --- Service Functions ---

/**
 * Parses a raw text string from a language model into a structured ScriptLine array.
 * This is more robust than asking the model for JSON directly.
 */
function parseScriptFromString(rawScript: string, allSpeakers: string[]): ScriptLine[] {
    const lines = rawScript.split('\n').filter(line => line.trim() !== '');
    const script: ScriptLine[] = [];

    lines.forEach(line => {
        const match = line.match(/^(.+?):\s*(.*)/);
        if (match) {
            const speakerName = match[1].trim();
            let dialogue = match[2].trim();
            
            // Check if this speaker is one of the defined hosts/guests
            if (allSpeakers.includes(speakerName)) {
                // Simple cue extraction (optional)
                const cueMatch = dialogue.match(/\((.*?)\)\s*(.*)/);
                let cue;
                if (cueMatch) {
                    cue = cueMatch[1];
                    dialogue = cueMatch[2];
                }

                script.push({
                    speaker: speakerName,
                    dialogue,
                    cue,
                    isInterruption: false // Interruptions are a Gemini-specific feature
                });
            }
        }
    });
    return script;
}


export async function generateScript(
    topic: string | undefined, 
    context?: string, 
    branding?: any, 
    customScript?: string,
    customRules?: string,
    language: 'English' | 'Afrikaans' = 'English',
    samanthaName: string = 'Samantha',
    stewardName: string = 'Steward',
    guestHosts?: GuestHost[],
    accent: string = 'South African',
    episodeTitle?: string,
    episodeNumber?: number,
    episodeLength: number = 10
): Promise<ScriptLine[]> {
    const allSpeakers = [samanthaName, stewardName, ...(guestHosts?.map(g => g.name) || [])];

    const prompt = `
        You are a podcast script writer. Write a natural, conversational script based on the following details.
        Format each line as "SPEAKER: Dialogue".

        Hosts: ${samanthaName}, ${stewardName}
        ${guestHosts && guestHosts.length > 0 ? `Guests: ${guestHosts.map(g => `${g.name} (${g.role})`).join(', ')}` : ''}
        Topic: ${topic || 'General conversation'}
        ${context ? `Context from document: ${context.substring(0, 1000)}...` : ''}
        Episode Length: ~${episodeLength} minutes.
        Language: ${language} (${accent})
        ${customRules ? `Custom Rules: ${customRules}` : ''}
        ${customScript ? `Incorporate this draft: ${customScript}` : ''}

        Start the script now.
    `;
    
    return withHuggingFaceAuth(async (token) => {
        const response = await hfInference(token, SCRIPT_MODEL, prompt);
        const result = await response.json();
        const rawText = result[0]?.generated_text || '';
        // The model often returns the prompt itself, so we need to find where the actual script starts.
        const scriptStart = rawText.indexOf('Start the script now.');
        const scriptText = scriptStart !== -1 ? rawText.substring(scriptStart + 'Start the script now.'.length).trim() : rawText;
        return parseScriptFromString(scriptText, allSpeakers);
    });
}

async function generateSingleSpeakerAudio(text: string): Promise<string> {
    const pcmBase64 = await withHuggingFaceAuth(async (token) => {
        const response = await hfInference(token, TTS_MODEL, text);
        const audioBlob = await response.blob();
        // Convert the returned audio (e.g., wav, flac) into our standard 24kHz mono PCM format
        return await audioBlobToPcmBase64(audioBlob);
    });
    return pcmBase64;
}

export async function generatePodcastAudio(
    script: ScriptLine[]
): Promise<{ audioData: string; timings: ScriptTiming[] }> {
    const audioChunks: Uint8Array[] = [];
    const timings: ScriptTiming[] = [];
    let cumulativeTime = 0;

    // Process each line sequentially. Hugging Face doesn't support the complex multi-speaker generation.
    for (let i = 0; i < script.length; i++) {
        const line = script[i];
        try {
            const pcmBase64 = await generateSingleSpeakerAudio(line.dialogue);
            const pcmChunk = decode(pcmBase64);
            
            const duration = getPcmChunkDuration(pcmChunk, 24000, 16);
            audioChunks.push(pcmChunk);
            timings.push({
                lineIndex: i,
                startTime: cumulativeTime,
                duration: duration
            });
            cumulativeTime += duration;
        } catch (error) {
            console.error(`Failed to generate audio for line: "${line.dialogue}"`, error);
            // Push an empty chunk to keep indices aligned, but don't add to timings
        }
    }

    if (audioChunks.length === 0) {
        throw new Error("Hugging Face audio generation failed for all script lines.");
    }
    
    const concatenatedPcm = concatenatePcm(audioChunks);
    const finalAudioData = encode(concatenatedPcm);

    return { audioData: finalAudioData, timings };
}
