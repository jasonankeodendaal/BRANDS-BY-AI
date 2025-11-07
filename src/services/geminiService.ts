import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ScriptLine, VoiceConfig, ScriptTiming, GuestHost } from '../types';
import { decode, encode, concatenatePcm, getPcmChunkDuration } from '../utils/audioUtils';
import { getKeys as getApiKeys } from './apiKeyService';


/**
 * Translates cryptic API errors into user-friendly, actionable messages.
 * @param error The error object caught from an API call.
 * @returns A string containing a clear, understandable error message.
 */
function getFriendlyErrorMessage(error: any): string {
  const defaultMessage = "An unexpected error occurred. Please check the console for details.";
  
  if (!error) return defaultMessage;

  let message = error.message || String(error);

  const errorString = error.toString();
  if (errorString.includes('[GoogleGenerativeAI Error]')) {
    message = errorString.replace('[GoogleGenerativeAI Error]:', '').trim();
  }
  
  if (message.toLowerCase().includes("api key not valid")) {
    return "Authentication failed: An API key is not valid. Please ensure your keys in Settings are correct and have the necessary permissions.";
  }
  if (message.toLowerCase().includes("permission denied")) {
      return "Permission Denied: An API key is missing necessary permissions for the requested operation. Please check your Google Cloud project settings.";
  }
  if (message.toLowerCase().includes("model `gemini-2.5-pro` not found")) {
      return "Model Not Found: The 'gemini-2.5-pro' model is unavailable. This may be a temporary issue or a problem with your API key's permissions.";
  }
  if (message.toLowerCase().includes("resource has been exhausted") || message.toLowerCase().includes("quota exceeded")) {
      return `Quota Exceeded: You have exceeded your usage limit for the API. This is often a per-minute limit on the free tier. The app will automatically wait between requests, but if this persists, please check your billing account. Original error: ${message}`;
  }
  if (message.toLowerCase().includes("invalid argument")) {
      return "Invalid Request: The request sent to the AI was invalid. This could be due to an unsupported voice, a problem with the script content, or malformed custom samples. Please try adjusting your inputs.";
  }
   if (message.toLowerCase().includes("deadline exceeded")) {
      return "The request timed out. This can happen with very long scripts or during periods of high demand. Please try again or consider shortening the script.";
  }

  return message;
}


/**
 * A wrapper function that handles API key rotation for Gemini API calls.
 * It first fetches keys saved by the user in IndexedDB, then combines them
 * with any keys defined in environment variables. It iterates through the
 * available keys, retrying the call if a quota-related error is encountered.
 *
 * @param apiCall A function that takes a `GoogleGenAI` instance and performs an API call.
 * @returns The result of the successful API call.
 * @throws An error if all API keys fail or if a non-quota error occurs.
 */
async function withApiKeyRotation<T>(apiCall: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const storedKeys = await getApiKeys();
  const storedKeyValues = storedKeys.map(k => k.key);
  
  const envKeys = [
    process.env.API_KEY,
    process.env.API_KEY_1,
    process.env.API_KEY_2,
    process.env.API_KEY_3,
  ].filter(Boolean) as string[];

  // Combine and de-duplicate keys, prioritizing user-stored keys
  const uniqueApiKeys = [...new Set([...storedKeyValues, ...envKeys])];

  if (uniqueApiKeys.length === 0) {
    throw new Error("No API keys configured. Please add a key in the Settings tab or set VITE_API_KEY in your environment.");
  }

  let lastError: any = null;

  for (const apiKey of uniqueApiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await apiCall(ai);
      return result; // Success, return immediately
    } catch (e: any) {
      lastError = e;
      const errorMessage = (e?.message || e.toString()).toLowerCase();
      
      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('resource has been exhausted')) {
        console.warn(`API key failed due to quota issue. Switching to the next key.`);
        continue;
      } else {
        throw new Error(getFriendlyErrorMessage(e));
      }
    }
  }

  throw new Error(`All available API keys have reached their usage limits. Please try again later. Last error: ${getFriendlyErrorMessage(lastError)}`);
}


// --- Interfaces & Types ---
interface Branding {
    name?: string;
    contact?: string;
    website?: string;
    slogan?: string;
}

type Accent = 'Default' | 'South African';


// --- Core Service Functions ---

export async function generateScript(
    topic: string | undefined, 
    context?: string, 
    branding?: Branding, 
    customScript?: string,
    customRules?: string,
    language: 'English' | 'Afrikaans' = 'English',
    samanthaName: string = 'Samantha',
    stewardName: string = 'Steward',
    guestHosts?: GuestHost[],
    accent: Accent = 'South African',
    episodeTitle?: string,
    episodeNumber?: number,
    episodeLength: number = 10,
): Promise<ScriptLine[]> {
    
  const customScriptInstruction = customScript ? `
    You have been provided with a draft script. Your main task is to revise, enhance, and complete this draft.
    Your goal is to make the conversation more engaging and natural, ensuring the dialogue fits all characters well.
    You can rephrase lines, add new lines for any speaker, or extend existing points.
    ${topic || context ? 'Use the provided topic and/or document to add more detail and ensure accuracy.' : 'Base your improvements on the provided script content.'}

    ---DRAFT SCRIPT START---
    ${customScript}
    ---DRAFT SCRIPT END---
    ` : '';

  const dynamicPerformanceInstructions = `
    **HYPER-REALISM DIRECTIVE:** Your ultimate mission is to generate a script that feels completely unscripted. It must sound like eavesdropping on a genuine, spontaneous, and lively conversation between intelligent, charismatic people. THE ULTIMATE FAILURE IS A SCRIPT THAT SOUNDS LIKE IT'S BEING READ.

    **1. DIALOGUE MECHANICS (THE SECRET SAUCE):**
    - **EMBRACE IMPERFECTION:** Real people don't speak in perfect, polished prose. This is the most important rule. Use sentence fragments, self-corrections (e.g., "And the thing is... actually, no, let me rephrase that..."), and natural fillers ("umm," "like," "you know").
    - **INTERRUPTIONS ARE ESSENTIAL:** This is key to preventing the "double read" issue.
        - **The Interruption Mechanic:** When one speaker cuts another off, you MUST do two things:
            1.  The speaker who is being cut off should have their line end abruptly with an ellipsis (...).
            2.  The speaker who is interrupting MUST have the 'isInterruption' flag set to 'true'.
        - **This must happen frequently** for the conversation to feel real.
    - **ANTI-REPETITION DIRECTIVE:** This is a NON-NEGOTIABLE rule. A speaker who is interrupted MUST NOT repeat the thought they were cut off from in their next line. They must react to the interruption or move the conversation forward in a new direction. Repeating the start of an interrupted sentence is strictly forbidden and will ruin the audio output.
    - **AVOID "ANNOUNCER VOICE":** The hosts are having a conversation, not giving a speech. They should never sound like they are reading a teleprompter.

    **2. VOCAL PERFORMANCE CUES (THE EMOTION):**
    - The 'cue' field is MANDATORY for conveying emotional intelligence.
    - **Be Specific & Dynamic:** Go beyond 'laughing'. Use descriptive cues that guide the performance: 'chuckles softly', 'a moment of realization', 'trailing off thoughtfully', 'speaking quickly with excitement', 'a skeptical tone', 'gentle sarcasm', 'genuine surprise'.
  `;

  const languageInstructions = language === 'Afrikaans' ? `
    EXPERT-LEVEL AFRIKAANS SCRIPTING: The script MUST be written in fluent, modern, and highly conversational Afrikaans.
    - **Authenticity is key:** Do not simply translate from English. Think and write directly in Afrikaans as a native speaker would.
    - **Cues in English:** While dialogue must be in perfect Afrikaans, the emotional cues ('cue' field) must remain in English.
  ` : '';
    
  const accentInstruction = language === 'English' ? `
    ACCENT & STYLE: The dialogue must be written in natural, modern South African English. Subtly incorporate common South African phrasing and vocabulary, but avoid turning it into a caricature.
  ` : '';
    
  const customRulesInstruction = customRules ? `
    MANDATORY USER-DEFINED RULES: The following rules are non-negotiable. You MUST follow them strictly.
    ---
    ${customRules}
    ---
  ` : '';

  const hosts = [`"${samanthaName}" (a woman)`, `"${stewardName}" (a man)`];
  const speakerEnum = [samanthaName, stewardName];
  if (guestHosts && guestHosts.length > 0) {
    guestHosts.forEach(guest => {
        hosts.push(`"${guest.name}" (a ${guest.gender}, role: ${guest.role})`);
        speakerEnum.push(guest.name);
    });
  }

  const guestHostInstruction = guestHosts && guestHosts.length > 0 ? `
    There are ${guestHosts.length} guest(s) joining the conversation:
    ${guestHosts.map(g => `- **${g.name}**: Their role is "${g.role}". Their contributions must be focused on this role.`).join('\n')}
    Integrate them naturally into the conversation.
  ` : '';

  const episodeContext = (episodeTitle && episodeNumber) 
    ? `This is Episode ${episodeNumber}, titled "${episodeTitle}". The hosts should reference this information in their introduction.`
    : '';
  
  const lengthInstruction = `The target length for this podcast is **${episodeLength} minutes**. The total script length should be approximately ${episodeLength * 150} words.`;


  const fullPrompt = `
    You are an elite podcast script writer and performance director. Your task is to generate an intellectually stimulating and natural-sounding podcast script in ${language}.
    The podcast has the following speakers: ${hosts.join(', ')}. Their names must be used exactly as provided.
    
    ${episodeContext}
    ${guestHostInstruction}
    ${topic ? `The topic for this episode is: "${topic}".` : ''}
    ${context ? `Use the following document as the primary source of information:\n\n---DOCUMENT START---\n${context}\n---DOCUMENT END---` : ''}
    
    ${lengthInstruction}
    ${dynamicPerformanceInstructions}
    ${languageInstructions}
    ${accentInstruction}
    ${customRulesInstruction}
    ${customScriptInstruction}

    VERY IMPORTANT FINAL RULES:
    1.  **MANDATORY INTRODUCTION:** The script MUST begin with an introduction where the hosts welcome listeners to "${branding?.name || 'Brands by Ai'}", announce the episode number and title (if provided), and introduce themselves by name.
    2.  **MANDATORY CONCLUSION:** The podcast MUST end with a natural-sounding call-to-action directing listeners to links in the bio/show notes. This MUST be the final part of the script.
    3.  The output MUST be a valid JSON array of script line objects.
  `;
    
  const response: GenerateContentResponse = await withApiKeyRotation(async (ai) => 
    ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: fullPrompt,
        config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
            type: Type.OBJECT,
            properties: {
                speaker: {
                  type: Type.STRING,
                  enum: speakerEnum,
                  description: 'The name of the speaker.',
                },
                dialogue: {
                  type: Type.STRING,
                  description: "The speaker's line of dialogue. If interrupted, it MUST end with '...'",
                },
                cue: {
                    type: Type.STRING,
                    description: "A mandatory, short, descriptive emotional or behavioral cue (e.g., 'laughing', 'surprised', 'thoughtful pause'). MUST be in English."
                },
                isInterruption: {
                    type: Type.BOOLEAN,
                    description: "Set to 'true' ONLY if this line is actively cutting off the previous speaker."
                }
            },
            required: ['speaker', 'dialogue', 'cue'],
            },
        },
        },
    })
  );

  try {
    const jsonText = response.text.trim();
    const parsedScript = JSON.parse(jsonText) as ScriptLine[];
    if (!Array.isArray(parsedScript) || parsedScript.some(line => !line.speaker || !line.dialogue)) {
        throw new Error("Invalid script format received from API.");
    }
    return parsedScript;
  } catch (e) {
    console.error("Failed to parse script JSON:", response.text);
    throw new Error("The API returned an invalid script format. Please try again.");
  }
}

async function generateSingleSpeakerAudio(
  text: string,
  voiceConfig: VoiceConfig,
  cue?: string
): Promise<string> {
  const performableText = cue ? `(${cue}) ${text}` : text;

  const speechConfigPayload = {
    voiceConfig:
      voiceConfig.type === 'custom'
        ? {
            customVoice: {
              audio: { data: voiceConfig.data, mimeType: voiceConfig.mimeType },
            },
          }
        : {
            prebuiltVoiceConfig: { voiceName: voiceConfig.name },
          },
  };

  const response: GenerateContentResponse = await withApiKeyRotation(async (ai) =>
    ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: performableText }] }],
        config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: speechConfigPayload,
        },
    })
  );

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    console.error("Audio generation for line failed. Prompt:", performableText, "Response:", JSON.stringify(response, null, 2));
    throw new Error("No audio data received from API for a line. The model may have rejected the prompt or voice sample.");
  }
  return base64Audio;
}

export async function generatePodcastAudio(
    script: ScriptLine[], 
    samanthaName: string,
    stewardName: string,
    samanthaVoiceConfig: VoiceConfig, 
    stewardVoiceConfig: VoiceConfig,
    guestHosts?: { name: string; voiceConfig: VoiceConfig; }[],
    accent: Accent = 'South African'
): Promise<{ audioData: string; timings: ScriptTiming[] }> {
    const rawAudioChunks: Uint8Array[] = [];
    const timings: ScriptTiming[] = [];
    let cumulativeTime = 0;
    
    const hostVoiceConfigs = new Map<string, VoiceConfig>();
    hostVoiceConfigs.set(samanthaName, samanthaVoiceConfig);
    hostVoiceConfigs.set(stewardName, stewardVoiceConfig);
    if (guestHosts) {
        guestHosts.forEach(g => hostVoiceConfigs.set(g.name, g.voiceConfig));
    }
    
    // First pass: generate all audio chunks sequentially.
    // Errors from generateSingleSpeakerAudio will now propagate up and be caught by the UI,
    // providing a much more specific error message to the user.
    for (const [index, line] of script.entries()) {
        const voiceConfig = hostVoiceConfigs.get(line.speaker);
        
        if (voiceConfig) {
            const base64Chunk = await generateSingleSpeakerAudio(line.dialogue, voiceConfig, line.cue);
            rawAudioChunks.push(decode(base64Chunk));
        } else {
            console.warn(`Unknown speaker in script: ${line.speaker}`);
            rawAudioChunks.push(new Uint8Array(0)); // Push empty chunk to maintain index alignment
        }
        
        // IMPORTANT: Wait between requests to stay under the free tier rate limit.
        // We skip the wait on the very last item.
        if (index < script.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 21000));
        }
    }

    if (rawAudioChunks.length !== script.length) {
        throw new Error("Mismatch between script lines and generated audio chunks.");
    }
    
    const finalAudioChunks: Uint8Array[] = [];

    // Second pass: process interruptions and calculate timings
    for (let i = 0; i < script.length; i++) {
        let pcmChunk = rawAudioChunks[i];
        if (pcmChunk.length === 0) continue;
        
        // If the *next* line is an interruption, truncate *this* line's audio slightly
        // to create a more natural-sounding overlap effect.
        if (script[i + 1]?.isInterruption) {
            const originalDuration = getPcmChunkDuration(pcmChunk, 24000, 16);
            const cutoffDuration = 0.25; // Cut off the last 250ms

            if (originalDuration > cutoffDuration) {
                const bytesToKeep = Math.floor((originalDuration - cutoffDuration) * 24000 * 2); // sampleRate * bytesPerSample
                // Ensure bytesToKeep is an even number for 16-bit samples
                const finalBytes = bytesToKeep - (bytesToKeep % 2);
                pcmChunk = pcmChunk.slice(0, finalBytes);
            }
        }
        
        const duration = getPcmChunkDuration(pcmChunk, 24000, 16);
        finalAudioChunks.push(pcmChunk);
        timings.push({
            lineIndex: i,
            startTime: cumulativeTime,
            duration: duration
        });

        cumulativeTime += duration;
    }


    if (finalAudioChunks.length === 0) {
        // This error should now only trigger if the script was empty or all lines failed silently (unlikely).
        // The more specific API errors from generateSingleSpeakerAudio will be caught first.
        throw new Error("Audio generation resulted in no audio data. This could be because the script was empty or contained only unknown speakers.");
    }

    const concatenatedPcm = concatenatePcm(finalAudioChunks);
    const finalAudioData = encode(concatenatedPcm);

    return { audioData: finalAudioData, timings };
}

export async function generateQualityPreviewAudio(
    samanthaName: string,
    stewardName: string,
    samanthaVoice: string,
    stewardVoice: string,
    accent: Accent = 'South African'
): Promise<string> {
    const previewScript: ScriptLine[] = [
        { speaker: samanthaName, dialogue: 'Wait, so you\'re telling me...', cue: 'slight hesitation', isInterruption: false },
        { speaker: stewardName, dialogue: 'Yes! They replaced the entire orchestra with...', cue: 'excitedly, interrupting', isInterruption: true },
        { speaker: samanthaName, dialogue: 'No! With what?', cue: 'incredulous', isInterruption: true },
        { speaker: stewardName, dialogue: 'Rubber chickens! It was beautifully chaotic.', cue: 'chuckling', isInterruption: false },
    ];
    
    const samanthaVoiceConfig: VoiceConfig = { type: 'prebuilt', name: samanthaVoice };
    const stewardVoiceConfig: VoiceConfig = { type: 'prebuilt', name: stewardVoice };

    // Create a temporary, minimal version of generatePodcastAudio to avoid the long delay for previews
    const audioChunks: Uint8Array[] = [];
     for (const line of previewScript) {
        let voiceConfig: VoiceConfig | undefined;
        if (line.speaker === samanthaName) voiceConfig = samanthaVoiceConfig;
        else if (line.speaker === stewardName) voiceConfig = stewardVoiceConfig;
        
        if (voiceConfig) {
            const base64Chunk = await generateSingleSpeakerAudio(line.dialogue, voiceConfig, line.cue);
            audioChunks.push(decode(base64Chunk));
        }
    }
     const finalAudioChunks: Uint8Array[] = [];
     for (let i = 0; i < previewScript.length; i++) {
        let pcmChunk = audioChunks[i];
        if (previewScript[i + 1]?.isInterruption) {
            const originalDuration = getPcmChunkDuration(pcmChunk, 24000, 16);
            const cutoffDuration = 0.25;
            if (originalDuration > cutoffDuration) {
                const bytesToKeep = Math.floor((originalDuration - cutoffDuration) * 24000 * 2);
                const finalBytes = bytesToKeep - (bytesToKeep % 2);
                pcmChunk = pcmChunk.slice(0, finalBytes);
            }
        }
        finalAudioChunks.push(pcmChunk);
    }
    const concatenatedPcm = concatenatePcm(finalAudioChunks);
    return encode(concatenatedPcm);
}

export async function previewVoice(voiceName: string, language: 'English' | 'Afrikaans' = 'English', accent: Accent = 'South African'): Promise<string> {
    const previewText = language === 'Afrikaans'
        ? 'Hallo, jy luister na n voorskou van hierdie stem.'
        : 'Hello, you are listening to a preview of this voice.';
    
    const prompt = `(warm, natural) ${previewText}`;
    
    const response: GenerateContentResponse = await withApiKeyRotation(async (ai) => 
        ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API for voice preview.");
    }
    return base64Audio;
}

export async function previewClonedVoice(
  customVoice: { data: string; mimeType: string },
  language: 'English' | 'Afrikaans' = 'English',
  accent: Accent = 'South African'
): Promise<string> {

  const previewText = language === 'Afrikaans'
    ? 'Hierdie is n voorskou van die gekloonde stem.'
    : 'This is a preview of the cloned voice.';
    
  const prompt = `(warm, natural) ${previewText}`;

  const response: GenerateContentResponse = await withApiKeyRotation(async (ai) => 
    ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              customVoice: { audio: { data: customVoice.data, mimeType: customVoice.mimeType } }
            }
        },
        },
    })
  );

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio data received from API for cloned voice preview.");
  }
  return base64Audio;
}

export async function generateAdText(script: ScriptLine[], episodeTitle: string, brandedName: string): Promise<string> {
  const scriptSummary = script.map(line => line.dialogue).join(' ').substring(0, 2000);
  const prompt = `
      You are a social media marketing expert for podcasts.
      Your task is to create a short, exciting, and engaging promotional post for a new podcast episode.

      **Podcast Name:** "${brandedName}"
      **Episode Title:** "${episodeTitle}"
      **Content Summary:** ${scriptSummary}...

      **Instructions:**
      1.  Write in a conversational and enthusiastic tone.
      2.  Briefly hint at the most interesting topics discussed in the summary.
      3.  End with a strong call-to-action, telling people to listen now (e.g., "Listen now on all platforms!", "Link in bio!").
      4.  Include 3-5 relevant and popular hashtags.
      5.  Keep the entire post concise and perfect for platforms like Instagram, X (Twitter), or Facebook.
  `;
  const response: GenerateContentResponse = await withApiKeyRotation(ai => 
      ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
      })
  );
  return response.text;
}

export async function generateAdScript(script: ScriptLine[], episodeTitle: string, brandedName: string): Promise<string> {
    const scriptSummary = script.map(line => line.dialogue).join(' ').substring(0, 2000);
    const prompt = `
        You are an expert advertising copywriter specializing in audio ads.
        Your task is to write a punchy, compelling 30-second audio ad script for a new podcast episode.

        **Podcast Name:** "${brandedName}"
        **Episode Title:** "${episodeTitle}"
        **Content Summary:** ${scriptSummary}...

        **Instructions:**
        1.  Start with a strong hook to grab the listener's attention immediately.
        2.  Pose an interesting question or present a fascinating fact from the episode.
        3.  Clearly state the podcast name and episode title.
        4.  End with a clear and simple call-to-action (e.g., "Search for ${brandedName} wherever you get your podcasts.").
        5.  The script should feel energetic and exciting. Use short sentences.
        6.  Include sound effect cues in brackets, like [upbeat music fades in] or [sound of a cash register].
    `;
    const response: GenerateContentResponse = await withApiKeyRotation(ai =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        })
    );
    return response.text;
}