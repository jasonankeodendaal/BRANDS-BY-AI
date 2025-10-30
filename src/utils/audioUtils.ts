


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
  const dataInt16 = new Int16Array(data.buffer);
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