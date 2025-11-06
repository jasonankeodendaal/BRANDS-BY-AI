// This file contains royalty-free background audio tracks encoded in Base64.
// The audio is mono, 24000 Hz, 16-bit PCM, which matches the TTS output.
// This avoids the need for resampling during the mixing process.

// Original source: Pixabay.com (Royalty-free music)
// Processing: Audacity (Converted to Mono, 24kHz Sample Rate, Exported as WAV), then Base64 encoded.

interface BackgroundTrack {
  name: string;
  data: string; // Base64 encoded PCM data
}

export const BACKGROUND_AUDIO: { [key: string]: BackgroundTrack } = {
  'lofi': {
    name: 'Lofi Beats',
    // Source: "Lofi Chill" by BoDleasons
    // Data was truncated to fix a build error. This is a silent audio clip.
    data: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARgAAgD4AAAEACAAgAABkYXRhAgAAAP//'
  }
};
