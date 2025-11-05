import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptLine, VoiceConfig, ScriptTiming } from '../types';
import { decode, encode, concatenatePcm, getPcmChunkDuration } from '../utils/audioUtils';

// --- API Key Rotation System ---
// Prioritizes the main environment key, then falls back to rotational keys.
// A Set is used to prevent duplicate keys if they are defined in multiple places.
const apiKeys = [
  ...new Set([
    process.env.API_KEY, // Primary key from AI Studio or VITE_API_KEY
    process.env.API_KEY_1,
    process.env.API_KEY_2,
    process.env.API_KEY_3,
  ]),
].filter(Boolean) as string[];


/**
 * A wrapper function that handles API key rotation for Gemini API calls.
 * It iterates through the available API keys, retrying the call if a quota-related
 * error is encountered.
 *
 * @param apiCall A function that takes a `GoogleGenAI` instance and performs an API call.
 * @returns The result of the successful API call.
 * @throws An error if all API keys fail or if a non-quota error occurs.
 */
async function withApiKeyRotation<T>(apiCall: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  if (apiKeys.length === 0) {
    throw new Error("No API keys configured. Please set VITE_API_KEY in your environment.");
  }

  let lastError: any = null;

  for (const apiKey of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await apiCall(ai);
      return result; // Success, return immediately
    } catch (e: any) {
      lastError = e;
      const errorMessage = (e?.message || e.toString()).toLowerCase();
      
      // Check for specific quota-related error messages
      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('resource has been exhausted')) {
        console.warn(`API key failed due to quota issue. Switching to the next key.`);
        continue; // Try the next key
      } else {
        // Not a quota error, fail fast
        throw e;
      }
    }
  }

  // If the loop completes, all keys have failed due to quota issues
  throw new Error(`All API keys have reached their usage limits. Please try again later. Last error: ${lastError?.message}`);
}


// --- Interfaces & Types ---
interface Branding {
    name?: string;
    contact?: string;
    website?: string;
    slogan?: string;
}

interface ThirdHost {
    name: string;
    role: string;
    gender: 'male' | 'female';
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
    thirdHost?: ThirdHost,
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
    **PERFORMANCE GOAL: A TOTALLY UNSCRIPTED, HYPER-REALISTIC, AND INTELLECTUALLY ENGAGING CONVERSATION.** Your ultimate mission is to generate a script that feels like eavesdropping on a genuine, spontaneous, and lively conversation between intelligent, charismatic experts. It must NEVER sound like a pre-written script.

    - **NO ADVERTISING TONE:** This is the most important rule. Avoid any language that sounds promotional, corporate, or like a sales pitch. The conversation must feel authentic and organic. If branding information is provided, it must be woven in so subtly that it's almost unnoticeable. If it can't be done naturally, DO NOT INCLUDE IT.
    
    - **DEEP CHARACTER & CHEMISTRY:** Give each host a distinct, consistent personality. For example, one could be the curious, enthusiastic optimist, while the other is the witty, grounded skeptic. Their dialogue, reactions, and even their sense of humor MUST reflect these underlying personalities throughout the entire script. They should have a clear chemistry—they can build on each other's ideas, challenge each other respectfully, and share moments of genuine humor. DO NOT state the personalities in the script; let them emerge through their words.

    - **NARRATIVE & STRUCTURE:** The conversation must have a clear narrative arc:
        1. **Hook:** An engaging opening that grabs the listener's attention.
        2. **Exploration:** A deep dive into 2-3 key points of the topic. The hosts should explore these points from different angles, ask thought-provoking questions, and connect them to real-world examples or personal anecdotes.
        3. **Climax/Insight:** A moment of genuine insight or a key takeaway.
        4. **Resolution:** A satisfying conclusion that wraps up the discussion and delivers the call-to-action naturally.
    
    - **EXPERT-LEVEL, RELATABLE DIALOGUE:** The hosts should sound like intelligent experts on the topic, but they must explain complex ideas in a simple, relatable way for the audience. They should avoid clichés and generic statements, instead offering fresh perspectives and making surprising connections.
    
    - **HYPER-REALISTIC DELIVERY:**
        - **Imperfect Grammar for Authenticity:** People don't speak in perfect, complete sentences. Fully embrace this. Use contractions (e.g., "don't", "it's") everywhere. Incorporate filler words like "umm," "uh," "like," "you know," when natural. Allow speakers to self-correct (e.g., "It was... no, wait, it was actually the other day...").
        - **Active Listening & Real Reactions:** Hosts must actively listen and react. This means:
            - Frequent, natural interruptions and talking over each other slightly.
            - Using interjections like "Oh, that's a great point," "I never thought of it that way," or "Hang on, what about...".
    
    - **ESSENTIAL VOCAL PERFORMANCE CUES:** The 'cue' field is your primary tool for directing the vocal performance and conveying emotional intelligence. It is MANDATORY and must be used creatively and frequently.
        - **Dynamic & Nuanced Cues:** Go beyond simple cues like 'laughing'. Use a wide variety of descriptive cues: 'chuckles', 'uproarious laughter', 'wry smile', 'speaking quickly', 'trailing off', 'emphatic', 'whispering conspiratorially', 'mock outrage', 'thoughtful pause', 'slight hesitation', 'incredulous', 'reflective pause', 'suddenly animated', 'a moment of realization', 'building excitement', 'gently correcting'.
  `;

  const languageInstructions = language === 'Afrikaans' ? `
    EXPERT-LEVEL AFRIKAANS SCRIPTING: The script MUST be written in fluent, modern, and highly conversational Afrikaans.
    - **Authenticity is key:** Do not simply translate from English. Think and write directly in Afrikaans as a native speaker would.
    - **Avoid Anglicisms:** Actively avoid direct loanwords or sentence structures from English ("anglisismes"). Use authentic Afrikaans equivalents.
    - **Use Idiomatic Expressions:** Incorporate common, natural-sounding Afrikaans idioms and sayings ("idiome en gesegdes").
    - **Conversational Flow:** Use common conversational particles and filler words (e.g., "wel," "nou ja," "jy weet," "darem") to make the speech less robotic.
    - **Cues in English:** While dialogue must be in perfect Afrikaans, the emotional cues ('cue' field) must remain in English.
  ` : '';
    
  const accentInstruction = language === 'English' ? `
    ACCENT & STYLE: The dialogue must be written in natural, modern South African English. Subtly incorporate common South African phrasing and vocabulary, but avoid turning it into a caricature. The goal is authenticity.
  ` : '';
    
  const customRulesInstruction = customRules ? `
    MANDATORY USER-DEFINED RULES: The following rules are non-negotiable. You MUST follow them strictly.
    ---
    ${customRules}
    ---
  ` : '';

  const hosts = [`"${samanthaName}" (a woman)`, `"${stewardName}" (a man)`];
  const speakerEnum = [samanthaName, stewardName];
  if (thirdHost) {
      hosts.push(`and "${thirdHost.name}" (a ${thirdHost.gender})`);
      speakerEnum.push(thirdHost.name);
  }

  const thirdHostInstruction = thirdHost ? `
    There is a third person, "${thirdHost.name}", joining the conversation.
    - **Role:** ${thirdHost.name}'s role is: "${thirdHost.role}". Their contributions must be focused on this role.
    - **Integrate Naturally:** Weave ${thirdHost.name} into the conversation organically. They shouldn't just speak in one block.
  ` : '';

  const episodeContext = (episodeTitle && episodeNumber) 
    ? `This is Episode ${episodeNumber}, titled "${episodeTitle}". The hosts should reference this information in their introduction.`
    : '';
  
  const lengthInstruction = `The target length for this podcast is **${episodeLength} minutes**. A typical speaking rate is about 150 words per minute. Therefore, the total script length should be approximately ${episodeLength * 150} words. Adjust the depth and breadth of the conversation to meet this target length naturally.`;


  const fullPrompt = `
    You are an elite podcast script writer and performance director. Your task is to generate an intellectually stimulating and natural-sounding podcast script in ${language}.
    The podcast has two hosts: ${hosts.join(', ')}. Their names must be used exactly as provided.
    
    ${episodeContext}
    ${thirdHostInstruction}
    ${topic ? `The topic for this episode is: "${topic}".` : ''}
    ${context ? `Use the following document as the primary source of information:\n\n---DOCUMENT START---\n${context}\n---DOCUMENT END---` : ''}
    
    ${lengthInstruction}
    ${dynamicPerformanceInstructions}
    ${languageInstructions}
    ${accentInstruction}
    ${customRulesInstruction}
    ${customScriptInstruction}

    VERY IMPORTANT RULES & STRUCTURE:
    1.  **MANDATORY INTRODUCTION FORMAT:** This rule is non-negotiable and MUST be followed precisely. The script MUST begin with an introduction where the hosts:
        a. Welcome listeners to the podcast, explicitly naming it "${branding?.name || 'Brands by Ai'}".
        b. Announce the current episode's number and title if provided (e.g., "Welcome to Episode ${episodeNumber || 'X'}: ${episodeTitle || 'Y'}").
        c. Each host and guest MUST introduce themselves by their name.
        This entire introduction sequence should be woven together naturally and lead into the main topic.
    2.  **DYNAMIC & BRANDED CONCLUSION:** The podcast MUST end with a natural-sounding call-to-action that directs listeners to links in the bio.
        - **Core Message:** The essential instruction is to guide listeners to the bio/show notes for links.
        - **Varied Phrasing:** The exact wording should feel like a natural conclusion to the conversation. Avoid robotic repetition. Examples of acceptable final lines include:
            - "It was a great discussion. To learn more about everything we mentioned, check in the bio for links on these brands."
            - "I learned a lot today! And for our listeners, all the resources and brand links are in the bio."
            - "That's our show for today! Don't forget to check out the links in the bio."
        - **Finality:** This call-to-action MUST be the final part of the script. No dialogue should follow it.
    3.  The script MUST be written entirely in ${language}.
    4.  All hosts should contribute meaningfully to the conversation.
    5.  The conversation must be entirely in the first person.
    6.  Ensure the output is a valid JSON array, with each object containing a "speaker" (from the list of provided host names) and their "dialogue" (in ${language}).
    7.  To make the podcast feel real, you MUST include a 'cue' field for most lines. This should be a short, descriptive phrase of the emotion or tone (e.g., 'laughing', 'crying', 'surprised', 'thoughtful'). Cues MUST be in English.
  `;
    
  const response = await withApiKeyRotation(async (ai) => 
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
                description: "The speaker's line of dialogue.",
                },
                cue: {
                    type: Type.STRING,
                    description: "An optional one-word emotional or behavioral cue (e.g., 'laughing', 'surprised')."
                }
            },
            required: ['speaker', 'dialogue'],
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
  cue?: string,
  accent: Accent = 'South African'
): Promise<string> {
  const accentInstruction = accent === 'South African' 
    ? 'The performance must be in a standard, modern South African accent.' 
    : '';

  const prompt = `
    You are a master voice actor specializing in hyper-realistic, conversational performances. Your one and only goal is to make this line sound completely unscripted and natural, as if spoken in a real conversation. **Under no circumstances should it sound like you are reading from a script.**

    - **Embrace Imperfection:** Use natural pauses where appropriate, add slight hesitations if it fits the emotion, and dynamically vary your pace and pitch. Avoid a monotone or robotic delivery at all costs.
    - **Emotional Context:** The specific emotional context for this line is: **"${cue || 'a neutral, conversational tone'}"**. This is your primary guide. Infuse every word with this feeling.
    - **Accent:** ${accentInstruction}

    Deliver the following line based on these instructions: "${text}"
  `;
  
  const hasCustomVoice = voiceConfig.type === 'custom';
  const fullPrompt = hasCustomVoice 
    ? `Your primary task is to create a high-fidelity clone of the provided voice sample, replicating its unique pitch, tone, and cadence as precisely as possible. Then, use that cloned voice to perform the following instructions:\n\n${prompt}`
    : prompt;

  const speechConfigPayload: {
    voiceConfig?: { prebuiltVoiceConfig: { voiceName: string } };
    customVoice?: { audio: { data: string; mimeType: string } };
  } = {};

  if (voiceConfig.type === 'custom') {
    speechConfigPayload.customVoice = { audio: { data: voiceConfig.data, mimeType: voiceConfig.mimeType } };
  } else {
    speechConfigPayload.voiceConfig = { prebuiltVoiceConfig: { voiceName: voiceConfig.name } };
  }

  const response = await withApiKeyRotation(async (ai) =>
    ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: speechConfigPayload,
        },
    })
  );

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio data received from API for single line.");
  }
  return base64Audio;
}

export async function generatePodcastAudio(
    script: ScriptLine[], 
    samanthaName: string,
    stewardName: string,
    samanthaVoiceConfig: VoiceConfig, 
    stewardVoiceConfig: VoiceConfig,
    thirdHost?: { name: string; voiceConfig: VoiceConfig; gender: 'male' | 'female' },
    accent: Accent = 'South African'
): Promise<{ audioData: string; timings: ScriptTiming[] }> {
    const audioChunks: Uint8Array[] = [];
    const timings: ScriptTiming[] = [];
    let cumulativeTime = 0;

    for (let i = 0; i < script.length; i++) {
        const line = script[i];
        let voiceConfig: VoiceConfig | undefined;

        if (line.speaker === samanthaName) {
            voiceConfig = samanthaVoiceConfig;
        } else if (line.speaker === stewardName) {
            voiceConfig = stewardVoiceConfig;
        } else if (thirdHost && line.speaker === thirdHost.name) {
            voiceConfig = thirdHost.voiceConfig;
        } else {
            console.warn(`Unknown speaker in script: ${line.speaker}`);
            continue; // Skip lines with unknown speakers
        }

        if (voiceConfig) {
            const base64Chunk = await generateSingleSpeakerAudio(line.dialogue, voiceConfig, line.cue, accent);
            const pcmChunk = decode(base64Chunk);
            const duration = getPcmChunkDuration(pcmChunk, 24000, 16);
            
            audioChunks.push(pcmChunk);
            timings.push({
                lineIndex: i,
                startTime: cumulativeTime,
                duration: duration
            });

            cumulativeTime += duration;
        }
    }

    if (audioChunks.length === 0) {
        throw new Error("Audio generation resulted in no audio data.");
    }

    const concatenatedPcm = concatenatePcm(audioChunks);
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
        { speaker: samanthaName, dialogue: 'Wait, so you\'re telling me...', cue: 'slight hesitation' },
        { speaker: stewardName, dialogue: 'Yes! Exactly! They replaced the entire orchestra with... rubber chickens.', cue: 'excitedly' },
        { speaker: samanthaName, dialogue: 'No! Get out of here.', cue: 'incredulous, laughing' },
        { speaker: stewardName, dialogue: 'I\'m serious! The conductor was just... well, you can imagine. It was beautifully chaotic.', cue: 'chuckling' },
    ];
    
    const samanthaVoiceConfig: VoiceConfig = { type: 'prebuilt', name: samanthaVoice };
    const stewardVoiceConfig: VoiceConfig = { type: 'prebuilt', name: stewardVoice };

    // This will now return an object, but for a simple preview, we only need the audio data.
    const { audioData } = await generatePodcastAudio(
        previewScript,
        samanthaName,
        stewardName,
        samanthaVoiceConfig,
        stewardVoiceConfig,
        undefined,
        accent
    );
    return audioData;
}

export async function previewVoice(voiceName: string, language: 'English' | 'Afrikaans' = 'English', accent: Accent = 'South African'): Promise<string> {
    const accentInstruction = language === 'English'
            ? 'Perform this with a standard, modern South African accent.'
            : '';

    const previewText = language === 'Afrikaans'
        ? 'Hallo, jy luister na n voorskou van hierdie stem.'
        : 'Hello, you are listening to a preview of this voice.';
    
    const prompt = `You are a voice actor demonstrating your voice. ${accentInstruction} Read the following line with a warm, natural, and conversational tone: "${previewText}"`;
    
    const response = await withApiKeyRotation(async (ai) => 
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
  const accentInstruction = language === 'English'
          ? 'You must perform this with a standard, modern South African accent.'
          : '';

  const previewText = language === 'Afrikaans'
    ? 'Hierdie is n voorskou van die gekloonde stem.'
    : 'This is a preview of the cloned voice.';
    
  const prompt = `Your primary task is to create a high-fidelity clone of the provided voice sample. Then, using that cloned voice, please say the following sentence with a warm, natural, and conversational tone. ${accentInstruction} Sentence: "${previewText}"`;

  const response = await withApiKeyRotation(async (ai) => 
    ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            customVoice: { audio: { data: customVoice.data, mimeType: customVoice.mimeType } }
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