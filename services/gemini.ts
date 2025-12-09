import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { PlannerOutput, NewsResult } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found in environment");
  return new GoogleGenAI({ apiKey });
};

// 1. Planner Agent
export const planRequest = async (userQuery: string): Promise<PlannerOutput> => {
  const ai = getAiClient();
  
  const systemInstruction = `
    You are Orion, a master planning agent. Your job is to classify the user's natural language request into a specific agent and extract relevant parameters.
    
    Agents:
    - code: User wants to generate code (Python, etc.).
    - papers: User wants to search for academic papers (ArXiv).
    - notes_add: User wants to save a note. Extract 'topic' (default to 'general') and 'content'.
    - notes_read: User wants to read notes. Extract 'topic'.
    - notes_clear: User wants to delete notes. Extract 'topic'.
    - meeting: User wants to manage a meeting log. 
      - action: 'start' (requires 'topic'), 'add' (requires 'content'), 'stop' (summarizes).
    - news: User wants news, headlines, or updates on a specific topic. Extract 'topic'.
    - translate: User wants to translate text. Extract 'content' (the text to translate) and 'language' (target language).
    
    Return JSON only conforming to the schema.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      agent: {
        type: Type.STRING,
        enum: ['code', 'papers', 'notes_add', 'notes_read', 'notes_clear', 'meeting', 'news', 'translate', 'unknown'],
      },
      info: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          content: { type: Type.STRING },
          meetingAction: { type: Type.STRING, enum: ['start', 'add', 'stop'] },
          language: { type: Type.STRING },
        },
      },
      reasoning: { type: Type.STRING },
    },
    required: ['agent', 'info'],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: userQuery,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1, // Low temp for deterministic planning
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from planner");
    return JSON.parse(text) as PlannerOutput;
  } catch (error) {
    console.error("Planning failed:", error);
    return { agent: 'unknown', info: {}, reasoning: 'Planning failed due to API error.' };
  }
};

// 2. Code Generation Agent
export const generateCode = async (topic: string, specificDetails?: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = `Generate concise Python code for: ${topic}. ${specificDetails || ''}. Return only the code block.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
  });

  let code = response.text || "# No code generated.";
  code = code.replace(/^```python\n/, '').replace(/^```\n/, '').replace(/```$/, '');
  return code;
};

// 3. Meeting Summarizer
export const summarizeMeetingLog = async (topic: string, log: string[]): Promise<string> => {
  const ai = getAiClient();
  const logText = log.join('\n');
  const prompt = `
    You are an intelligent personal assistant.
    Analyze the following meeting transcript/log for topic "${topic}".
    
    1. Summarize the key points in 3-5 bullets.
    2. Crucially, identify specific action items or relevant information for "Me" (the user). Tell me exactly what I need to do or know.
    
    Log:
    ${logText}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text || "Could not generate summary.";
};

// 4. News Agent
export const generateNews = async (topic: string): Promise<NewsResult> => {
  const ai = getAiClient();
  
  const searchPrompt = `
    You are an English news writer. Craft a short news package about: "${topic}".
    Use the search tool to find the latest info.
    
    Rules:
    1) Provide a concise English headline (max ~18 words).
    2) Write a 3-4 sentence English script in plain language suitable for reading aloud.
    3) Return the output strictly in this format (do not use markdown for the tags):
    <HEADLINE>...headline...</HEADLINE>
    <SCRIPT>...script...</SCRIPT>
  `;

  const searchResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: searchPrompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const sources: { title: string; uri: string }[] = [];
  const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach(chunk => {
      if (chunk.web) {
        sources.push({ title: chunk.web.title || 'Source', uri: chunk.web.uri || '#' });
      }
    });
  }

  const text = searchResponse.text || '';
  const headlineMatch = text.match(/<HEADLINE>(.*?)<\/HEADLINE>/s);
  const scriptMatch = text.match(/<SCRIPT>(.*?)<\/SCRIPT>/s);

  const headline = headlineMatch ? headlineMatch[1].trim() : `Latest News: ${topic}`;
  const script = scriptMatch ? scriptMatch[1].trim() : (text.replace(/<[^>]*>/g, '').trim() || "No news script generated.");

  const audioData = await generateSpeech(script);

  return {
    headline,
    script,
    audioData,
    sources
  };
};

// 5. Translation Agent
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Translate the following text to ${targetLanguage}. Return only the translation.\n\nText: "${text}"`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    
    return response.text || "Translation failed.";
}

// Helper: Generic TTS
export const generateSpeech = async (text: string): Promise<string | undefined> => {
    const ai = getAiClient();
    try {
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
        
        const parts = ttsResponse.candidates?.[0]?.content?.parts;
        if (parts && parts[0]?.inlineData?.data) {
            return parts[0].inlineData.data;
        }
    } catch (e) {
        console.error("TTS Failed:", e);
    }
    return undefined;
}