import { CustomAudioSample } from '../types';

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function concatenatePcm(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // FIX: Use robust Int16Array constructor with byteOffset and length to prevent RangeError.
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function getPcmChunkDuration(chunk: Uint8Array, sampleRate: number, bitsPerSample: number): number {
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = chunk.length / bytesPerSample;
    return numSamples / sampleRate;
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // The result is a data URL like "data:audio/mpeg;base64,..."
            // We need to extract just the base64 part after the comma.
            const base64String = result.split(',')[1];
            if (base64String) {
                resolve(base64String);
            } else {
                reject(new Error("Could not extract base64 string from blob."));
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
}

export function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // little-endian
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // Audio format 1 for PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}


/**
 * Converts an AudioBuffer object to a WAV file blob.
 * This is an internal helper function.
 * @param buffer The AudioBuffer to convert.
 * @returns A Blob representing the WAV file.
 */
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = 1; // Always mono for this use case
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const channelData = buffer.getChannelData(0);
    const numSamples = channelData.length;

    const dataSize = numSamples * (bitsPerSample / 8);
    const bufferSize = 44 + dataSize;
    const wavBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(wavBuffer);
    
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };
    
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    
    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write PCM data, converting from Float32 to Int16
    let offset = 44;
    for (let i = 0; i < numSamples; i++, offset += 2) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
};

/**
 * Processes an audio blob by decoding, resampling to 24kHz mono,
 * and re-encoding as a WAV file for use with the voice cloning API.
 * @param audioBlob The raw audio blob from a file upload or recording.
 * @returns A promise that resolves to an object containing the base64-encoded WAV data and its mime type.
 */
export async function processAudioForCloning(audioBlob: Blob): Promise<{ base64: string, mimeType: string }> {
    const TARGET_SAMPLE_RATE = 24000;
    const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
        
        const offlineContext = new OfflineAudioContext(
            1, // mono
            Math.ceil(decodedBuffer.duration * TARGET_SAMPLE_RATE),
            TARGET_SAMPLE_RATE
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(offlineContext.destination);
        source.start(0);
        
        const resampledBuffer = await offlineContext.startRendering();
        const wavBlob = audioBufferToWav(resampledBuffer);
        const base64 = await blobToBase64(wavBlob);
        
        return { base64, mimeType: 'audio/wav' };
    } catch (error) {
        console.error("Audio processing failed:", error);
        throw new Error("Failed to process audio file. It might be an unsupported format or corrupt.");
    } finally {
        // Ensure the temporary context is closed to free up resources
        if (tempAudioContext.state !== 'closed') {
            await tempAudioContext.close();
        }
    }
}

/**
 * Correctly combines multiple custom audio samples into a single valid WAV file for voice cloning.
 * It strips individual WAV headers, concatenates the raw PCM data, and creates a new WAV file.
 * @param samples An array of CustomAudioSample objects, where `base64` is a full WAV file.
 * @returns A promise that resolves to an object with the base64 data and mimeType of the combined audio.
 */
export async function combineCustomAudioSamples(samples: CustomAudioSample[]): Promise<{ data: string, mimeType: string }> {
    if (samples.length === 0) {
        throw new Error("No audio samples provided to combine.");
    }
    // If there's only one sample, no need to process, just return it as is.
    if (samples.length === 1) {
        return { data: samples[0].base64, mimeType: samples[0].mimeType };
    }

    // Decode each WAV file and extract the raw PCM data by skipping the 44-byte header.
    const pcmChunks = samples.map(sample => {
        const wavBytes = decode(sample.base64);
        // This is crucial: a standard WAV header is 44 bytes long. We slice it off.
        return wavBytes.slice(44);
    });
    
    // Concatenate all the raw PCM data chunks into one.
    const concatenatedPcm = concatenatePcm(pcmChunks);
    
    // Create a new valid WAV file Blob from the combined PCM data.
    // Assumes 24kHz, 1-channel, 16-bit audio, which matches our processing standard.
    const wavBlob = pcmToWav(concatenatedPcm, 24000, 1, 16);
    
    // Convert the new WAV Blob back to a base64 string for the API.
    const finalBase64 = await blobToBase64(wavBlob);

    return { data: finalBase64, mimeType: 'audio/wav' };
}

/**
 * Processes an audio blob from any format, decodes it, resamples to 24kHz mono,
 * and returns it as a base64 encoded string of raw PCM data for the editor.
 * @param audioBlob The raw audio blob from a file upload.
 * @returns A promise that resolves to a base64-encoded raw PCM string.
 */
export async function audioBlobToPcmBase64(audioBlob: Blob): Promise<string> {
    const TARGET_SAMPLE_RATE = 24000;
    const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
        
        const offlineContext = new OfflineAudioContext(
            1, // mono
            Math.ceil(decodedBuffer.duration * TARGET_SAMPLE_RATE),
            TARGET_SAMPLE_RATE
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(offlineContext.destination);
        source.start(0);
        
        const resampledBuffer = await offlineContext.startRendering();
        
        // Convert Float32Array to Int16Array (PCM)
        const pcmData = resampledBuffer.getChannelData(0);
        const int16Pcm = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            const sample = Math.max(-1, Math.min(1, pcmData[i]));
            int16Pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Encode the raw Int16Array bytes to base64
        return encode(new Uint8Array(int16Pcm.buffer));

    } catch (error) {
        console.error("Audio processing failed:", error);
        throw new Error("Failed to process audio file. It might be an unsupported format or corrupt.");
    } finally {
        if (tempAudioContext.state !== 'closed') {
            await tempAudioContext.close();
        }
    }
}

/**
 * Applies a linear fade to PCM audio data.
 * @param pcmData Raw PCM data as a Uint8Array.
 * @param type 'in' for fade-in, 'out' for fade-out.
 * @returns A new Uint8Array with the fade applied.
 */
export function applyFade(pcmData: Uint8Array, type: 'in' | 'out'): Uint8Array {
    // Create a new Int16Array view on the same buffer, respecting byte offset and length.
    const pcmInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    const fadedPcm = new Int16Array(pcmInt16); // Create a copy to modify
    const numSamples = fadedPcm.length;

    for (let i = 0; i < numSamples; i++) {
        let gain;
        if (type === 'in') {
            gain = i / (numSamples > 1 ? numSamples - 1 : 1);
        } else { // 'out'
            gain = 1 - (i / (numSamples > 1 ? numSamples - 1 : 1));
        }
        fadedPcm[i] = Math.round(fadedPcm[i] * gain);
    }
    return new Uint8Array(fadedPcm.buffer);
}

/**
 * Generates a block of silence as raw PCM data.
 * @param duration Duration of silence in seconds.
 * @param sampleRate The sample rate (e.g., 24000).
 * @param bitsPerSample The bits per sample (e.g., 16).
 * @returns A Uint8Array containing silent audio data.
 */
export function generateSilence(duration: number, sampleRate: number, bitsPerSample: number): Uint8Array {
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = Math.floor(duration * sampleRate);
    const totalBytes = numSamples * bytesPerSample;
    return new Uint8Array(totalBytes); // Initializes with zeros
}

/**
 * Applies a gain (volume) to PCM audio data, with clipping protection.
 * @param pcmData Raw PCM data as a Uint8Array.
 * @param gainFactor A multiplier for the volume (e.g., 1.5 for +50%).
 * @returns A new Uint8Array with the gain applied.
 */
export function applyGain(pcmData: Uint8Array, gainFactor: number): Uint8Array {
    const pcmInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    const modifiedPcm = new Int16Array(pcmInt16.length);
    const MAX_VAL = 32767;
    const MIN_VAL = -32768;

    for (let i = 0; i < pcmInt16.length; i++) {
        const boostedSample = pcmInt16[i] * gainFactor;
        modifiedPcm[i] = Math.max(MIN_VAL, Math.min(MAX_VAL, boostedSample));
    }
    return new Uint8Array(modifiedPcm.buffer);
}

/**
 * Applies a simple noise gate to PCM data, silencing audio below a threshold.
 * @param pcmData Raw PCM data as a Uint8Array.
 * @param threshold The amplitude threshold (0 to 1.0).
 * @returns A new Uint8Array with the noise gate applied.
 */
export function applyNoiseGate(pcmData: Uint8Array, threshold: number): Uint8Array {
    const pcmInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    const modifiedPcm = new Int16Array(pcmInt16.length);
    const thresholdInt16 = threshold * 32767;

    for (let i = 0; i < pcmInt16.length; i++) {
        if (Math.abs(pcmInt16[i]) < thresholdInt16) {
            modifiedPcm[i] = 0;
        } else {
            modifiedPcm[i] = pcmInt16[i];
        }
    }
    return new Uint8Array(modifiedPcm.buffer);
}

/**
 * Changes the speed of audio via resampling (note: this also changes the pitch).
 * @param pcmData Raw PCM data as a Uint8Array.
 * @param speedFactor Speed multiplier (e.g., 1.2 for 20% faster, 0.8 for 20% slower).
 * @returns A new Uint8Array with the speed adjusted.
 */
export function changeSpeed(pcmData: Uint8Array, speedFactor: number): Uint8Array {
    const pcmInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
    const originalLength = pcmInt16.length;
    const newLength = Math.floor(originalLength / speedFactor);
    const modifiedPcm = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const originalIndex = i * speedFactor;
        const index1 = Math.floor(originalIndex);
        const index2 = Math.min(index1 + 1, originalLength - 1);
        const fraction = originalIndex - index1;

        const sample1 = pcmInt16[index1] || 0;
        const sample2 = pcmInt16[index2] || 0;

        // Linear interpolation
        modifiedPcm[i] = sample1 + (sample2 - sample1) * fraction;
    }

    return new Uint8Array(modifiedPcm.buffer);
}

/**
 * Mixes a voice track with a looping background track.
 * @param voicePcm The primary voice audio as raw PCM data.
 * @param backgroundPcm The background audio as raw PCM data. It will be looped.
 * @param backgroundVolume The volume multiplier for the background track (0.0 to 1.0).
 * @returns A new Uint8Array with the mixed audio data.
 */
export function mixAudio(voicePcm: Uint8Array, backgroundPcm: Uint8Array, backgroundVolume: number): Uint8Array {
    const voiceInt16 = new Int16Array(voicePcm.buffer, voicePcm.byteOffset, voicePcm.length / 2);
    const backgroundInt16 = new Int16Array(backgroundPcm.buffer, backgroundPcm.byteOffset, backgroundPcm.length / 2);
    
    if (backgroundInt16.length === 0) return voicePcm;

    const mixedPcm = new Int16Array(voiceInt16.length);
    const backgroundLength = backgroundInt16.length;
    
    const MAX_VAL = 32767;
    const MIN_VAL = -32768;

    for (let i = 0; i < voiceInt16.length; i++) {
        const voiceSample = voiceInt16[i];
        // Loop the background track using the modulo operator
        const backgroundSample = backgroundInt16[i % backgroundLength] * backgroundVolume;
        
        const mixedSample = voiceSample + backgroundSample;
        
        // Clip the result to prevent distortion (hard clipping)
        mixedPcm[i] = Math.max(MIN_VAL, Math.min(MAX_VAL, mixedSample));
    }
    
    return new Uint8Array(mixedPcm.buffer);
}