

import { GoogleGenAI, Type } from "@google/genai";
import { YouTubeMetadata } from "../types";

// Get API Key from Runtime Config (injected by server.js) or fallback to build env (local dev)
const apiKey = (window as any).APP_CONFIG?.API_KEY !== "__API_KEY_PLACEHOLDER__" 
  ? (window as any).APP_CONFIG?.API_KEY 
  : process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

// --- UTILITIES ---

// Helper to convert URL to Base64 (for small/medium videos that fit in memory)
async function urlToGenerativePart(url: string, mimeType: string) {
  try {
    let response;
    
    // 1. Try Direct Fetch
    try {
        response = await fetch(url);
    } catch (e) {
        console.warn("Direct fetch failed (likely CORS).");
        throw new Error("CORS_ERROR: O navegador bloqueou o acesso direto ao vídeo. Configure o CORS no seu Firebase Storage.");
    }

    if (!response || !response.ok) {
        throw new Error(`Falha ao baixar vídeo: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result) {
            reject(new Error("Failed to read blob data"));
            return;
        }
        const base64data = result.split(',')[1];
        resolve({
          inlineData: {
            data: base64data,
            mimeType
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  } catch (error: any) {
    console.error("Video Download Error:", error);
    throw error;
  }
}

// Helper to convert File object directly to GenerativePart
async function fileToGenerativePart(file: File | Blob, mimeType?: string): Promise<{ inlineData: { data: string, mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
          reject(new Error("Failed to read file data"));
          return;
      }
      const base64data = result.split(',')[1];
      resolve({
        inlineData: {
          data: base64data,
          mimeType: mimeType || (file as File).type || "video/mp4"
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts audio from a video file/blob, downsamples it to 16kHz mono, and returns a WAV Blob.
 * This drastically reduces file size for transcription (e.g. 50MB Video -> 2MB Audio).
 */
async function extractAudioFromVideo(file: File | Blob): Promise<Blob> {
  console.log("🔊 Extracting audio track for optimized transcription...");
  
  // 1. Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // 2. Decode Audio Data
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 3. Prepare for resampling (16kHz is sufficient for Speech-to-Text)
      const targetSampleRate = 16000;
      const numChannels = 1; // Mono
      
      const offlineCtx = new OfflineAudioContext(numChannels, audioBuffer.duration * targetSampleRate, targetSampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start();
      
      const resampledBuffer = await offlineCtx.startRendering();
      
      // 4. Convert to WAV
      return bufferToWav(resampledBuffer);
  } catch (e) {
      console.error("Audio decoding failed. The file might not have an audio track or format is unsupported.", e);
      throw new Error("Falha ao extrair áudio. Verifique se o vídeo possui som.");
  }
}

// Simple WAV Encoder
function bufferToWav(abuffer: AudioBuffer) {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this loop)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < abuffer.length) {
    for(i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);          // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data: any) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: any) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// --- API FUNCTIONS ---

/**
 * Automatically transcribes a video using Gemini.
 */
export const transcribeVideo = async (videoInput: string | File): Promise<string> => {
    console.log("🎙️ Auto-transcribing video...");
    try {
        let mediaPart;
        let videoBlob: Blob;

        if (typeof videoInput === 'string') {
             console.log("Downloading video from URL for processing...");
             try {
                const response = await fetch(videoInput);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                videoBlob = await response.blob();
             } catch (fetchError: any) {
                console.error("Fetch failed:", fetchError);
                if (fetchError.message.includes("CORS") || fetchError.name === "TypeError") {
                    throw new Error("Bloqueio de CORS detectado. O Gemini não pode acessar este vídeo diretamente. Verifique se o 'cors.json' foi configurado no Firebase Storage.");
                }
                throw fetchError;
             }
        } else {
             videoBlob = videoInput;
        }

        try {
            const audioBlob = await extractAudioFromVideo(videoBlob);
            console.log(`✅ Audio extracted: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
            mediaPart = await fileToGenerativePart(audioBlob, "audio/wav");
        } catch (audioError) {
            console.warn("Audio extraction failed, falling back to full video upload:", audioError);
            mediaPart = await fileToGenerativePart(videoBlob);
        }
        
        const prompt = `
            Ouça atentamente o áudio e forneça uma transcrição completa e precisa em Português.
            
            Regras:
            1. Não inclua timestamps.
            2. Não inclua descrições de cenário (ex: [Música toca]).
            3. Retorne APENAS o texto falado, corrido e pontuado corretamente.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [mediaPart, { text: prompt }]
            }
        });

        return response.text?.trim() || "";
    } catch (error: any) {
        console.error("Transcription Error:", error);
        throw new Error("Falha ao transcrever o vídeo: " + error.message);
    }
};

/**
 * Generates metadata specifically for YouTube (Title, Desc, Tags)
 */
export const generateYouTubeMetadata = async (
    transcription: string,
    clientName: string,
    postType: 'video' | 'shorts' = 'video'
): Promise<Omit<YouTubeMetadata, 'categoryId' | 'privacyStatus'>> => {
    console.log(`🔴 Generating YouTube Metadata (${postType})...`);
    
    let instructions = "";
    if (postType === 'shorts') {
        instructions = "Otimize para YouTube Shorts: Título curto (max 60 caracteres), impactante e com alto potencial viral. Descrição breve com hashtags principais (#Shorts).";
    } else {
        instructions = "Otimize para Vídeo Longo (VOD): Título otimizado para busca (SEO) até 100 caracteres. Descrição detalhada com resumo e estrutura de tópicos se possível.";
    }

    const prompt = `
      Você é um especialista em YouTube SEO.
      
      Tarefa: Crie metadados otimizados para um vídeo do YouTube do cliente "${clientName}" baseado na transcrição abaixo.
      Tipo de Conteúdo: ${postType === 'shorts' ? 'YouTube Shorts' : 'Vídeo Padrão do YouTube'}.
      
      Diretrizes Específicas:
      ${instructions}
      
      TRANSCRIÇÃO:
      """
      ${transcription}
      """
      
      Requisitos JSON:
      1. title: Um título altamente clicável.
      2. description: Uma descrição completa e otimizada.
      3. tags: Uma lista de 10-15 tags relevantes separadas por vírgula (string única).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        tags: { type: Type.STRING } // Returning tags as a comma-separated string for easier UI editing
                    },
                    required: ["title", "description", "tags"]
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        
        // Convert comma string to array if needed, but UI usually expects string for editing
        const tagsArray = json.tags ? json.tags.split(',').map((t: string) => t.trim()) : [];

        return {
            title: json.title || "",
            description: json.description || "",
            tags: tagsArray
        };
    } catch (error: any) {
        console.error("Gemini YouTube Error:", error);
        throw new Error("Erro ao gerar metadados para YouTube.");
    }
};

/**
 * Generates a social media caption (Instagram/TikTok)
 */
export const generateSocialCaption = async (
    transcription: string,
    platform: 'instagram' | 'tiktok',
    clientName: string,
    postType?: 'reel' | 'story' | 'feed'
): Promise<string> => {
    console.log(`📱 Generating ${platform} Caption (${postType || 'default'})...`);
    
    let context = "";
    if (platform === 'instagram') {
        if (postType === 'story') context = "Este é um Instagram Story. A legenda deve ser muito curta, direta, talvez uma frase de impacto ou pergunta para enquete.";
        else if (postType === 'reel') context = "Este é um Instagram Reel. A legenda deve ser engajadora, encorajar comentários e salvamentos. Use formatação limpa e emojis.";
        else context = "Este é um Post de Feed. Legenda detalhada e valorosa.";
    } else if (platform === 'tiktok') {
        context = "Este é um vídeo de TikTok. Legenda curta, trend-aware, com hashtags virais.";
    }
    
    const prompt = `
      Você é um especialista em redes sociais (${platform}).
      
      Tarefa: Escreva uma legenda para um post de ${platform} do cliente "${clientName}".
      Tipo de Post: ${postType || 'Vídeo'}.
      
      Diretrizes:
      ${context}

      TRANSCRIÇÃO:
      """
      ${transcription}
      """
      
      REGRAS:
      1. Retorne APENAS o texto da legenda.
      2. Use um tom engajador e emojis.
      3. Inclua 3-5 hashtags relevantes.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text?.trim() || "";
};

// Legacy support (can be deprecated later)
export const generateVideoDescription = async (
    videoInput: string | File,
    videoTitle: string, 
    format: string, 
    clientName: string,
    existingTranscription?: string
): Promise<{ description: string, transcription?: string }> => {
    // Forward to new social caption generator if transcription exists
    if (existingTranscription) {
        const caption = await generateSocialCaption(existingTranscription, 'instagram', clientName, 'reel');
        return { description: caption };
    }
    return { description: "Erro: Transcrição necessária." };
};