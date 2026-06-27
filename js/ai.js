/**
 * AI API Module
 * Handles OpenAI-compatible API calls with streaming, error handling, and key rotation
 */

// API Providers configuration
const API_PROVIDERS = {
  zhipu: {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    default: true
  },
  siliconflow: {
    name: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    models: {
      chat: [
        { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B（推荐，永久免费）', free: true },
        { id: 'Qwen/Qwen2.5-32B-Instruct', name: 'Qwen2.5-32B（免费）', free: true },
        { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B（免费）', free: true },
        { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3（免费）', free: true },
        { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1 推理（免费）', free: true },
        { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B（免费）', free: true },
        { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama-3.1-8B（免费）', free: true },
        { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama-3.1-70B（免费）', free: true }
      ],
      image: [
        { id: 'Kwai-Kolors/Kolors', name: 'Kolors 可图（免费生图）', free: true },
        { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1-schnell（免费生图）', free: true },
        { id: 'stabilityai/stable-diffusion-3.5-large-turbo', name: 'SD3.5-turbo（免费生图）', free: true }
      ],
      speech: [
        { id: 'FunAudioLLM/CosyVoice2-0.5B', name: 'CosyVoice2 语音合成', free: false }
      ],
      transcription: [
        { id: 'iic/SenseVoiceSmall', name: 'SenseVoiceSmall 语音识别（免费）', free: true },
        { id: 'TeleAI/TeleSpeechASR', name: 'TeleSpeechASR 语音识别（免费）', free: true },
        { id: 'openai/whisper-large-v3', name: 'Whisper-Large-v3（免费）', free: true }
      ]
    }
  },
  moark: {
    name: 'Moark',
    baseURL: 'https://api.moark.com/v1',
    model: 'GLM-4.6'
  },
  agens: {
    name: 'Agens 阿贡',
    baseURL: 'https://api.agens.cn/v1',
    model: 'agen-snake-7b'
  },
  gemini: {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash-lite'
  }
};

// Current active provider
let currentProvider = null;
let activeAbortController = null;

// ==================== Provider Management ====================

function getAvailableProviders() {
  const providers = [];
  
  for (const [key, config] of Object.entries(API_PROVIDERS)) {
    const apiKey = localStorage.getItem(`apiKey_${key}`);
    if (apiKey) {
      providers.push({
        key,
        ...config,
        apiKey
      });
    }
  }
  
  return providers;
}

function getPrimaryProvider() {
  // Check stored preference first
  const storedPref = localStorage.getItem('preferredProvider');
  if (storedPref) {
    const providers = getAvailableProviders();
    const preferred = providers.find(p => p.key === storedPref);
    if (preferred) return preferred;
  }
  
  // Fall back to first available or default
  const providers = getAvailableProviders();
  if (providers.length > 0) {
    return providers[0];
  }
  
  // Return default provider config (without API key)
  return {
    key: 'zhipu',
    ...API_PROVIDERS.zhipu
  };
}

function rotateToNextProvider(currentKey) {
  const providers = getAvailableProviders();
  const currentIndex = providers.findIndex(p => p.key === currentKey);
  
  if (currentIndex === -1 || currentIndex === providers.length - 1) {
    return providers[0] || null;
  }
  
  return providers[currentIndex + 1];
}

// ==================== API Call Functions ====================

/**
 * Send a chat completion request
 * @param {Array} messages - Array of {role, content} objects
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Response object
 */
async function sendChatRequest(messages, options = {}) {
  const provider = options.provider || getPrimaryProvider();
  
  if (!provider.apiKey) {
    throw new AIAPIError('请先在设置中配置API Key', 'NO_API_KEY');
  }
  
  const requestBody = {
    model: provider.model,
    messages: messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 2000
  };
  
  // Add streaming if supported
  if (options.stream !== false) {
    requestBody.stream = true;
  }
  
  const url = `${provider.baseURL}/chat/completions`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: options.signal
    });
    
    if (response.status === 401) {
      throw new AIAPIError('API Key无效，请检查配置', 'INVALID_KEY');
    }
    
    if (response.status === 429) {
      // Rate limited - try rotating to next provider
      const nextProvider = rotateToNextProvider(provider.key);
      if (nextProvider && nextProvider.key !== provider.key) {
        throw new AIAPIError('请求过于频繁，正在切换通道...', 'RATE_LIMIT', nextProvider);
      }
      throw new AIAPIError('请求被限流，请稍后再试', 'RATE_LIMIT');
    }
    
    if (!response.ok) {
      throw new AIAPIError(`API请求失败: ${response.status}`, 'HTTP_ERROR', null, response.status);
    }
    
    return response;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AIAPIError('请求已取消', 'ABORTED');
    }
    throw error;
  }
}

/**
 * Send a non-streaming chat request
 */
async function sendChatRequestSync(messages, options = {}) {
  const response = await sendChatRequest(messages, { ...options, stream: false });
  return response.json();
}

/**
 * Send a streaming chat request with callbacks
 * @param {Array} messages - Array of {role, content} objects
 * @param {Object} callbacks - { onChunk, onComplete, onError }
 * @param {Object} options - Additional options
 */
async function sendChatRequestStream(messages, callbacks, options = {}) {
  const { onChunk, onComplete, onError } = callbacks;
  
  // Cancel any existing request
  if (activeAbortController) {
    activeAbortController.abort();
  }
  
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;
  
  try {
    const response = await sendChatRequest(messages, { ...options, signal });
    
    if (!response.body) {
      throw new AIAPIError('响应体为空', 'EMPTY_RESPONSE');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.choices && parsed.choices[0].delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              if (onChunk) {
                onChunk(content, fullContent);
              }
            }
            
            // Handle error responses
            if (parsed.error) {
              throw new AIAPIError(parsed.error.message || 'API错误', 'API_ERROR');
            }
            
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }
    
    if (onComplete) {
      onComplete(fullContent);
    }
    
    return fullContent;
    
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Cancel current streaming request
 */
function cancelCurrentRequest() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

/**
 * Test API connection
 */
async function testConnection(providerKey) {
  const apiKey = localStorage.getItem(`apiKey_${providerKey}`);
  if (!apiKey) {
    return { success: false, error: '未配置API Key' };
  }
  
  const config = API_PROVIDERS[providerKey];
  if (!config) {
    return { success: false, error: '未知的提供商' };
  }
  
  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      })
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    if (response.status === 401) {
      return { success: false, error: 'API Key无效' };
    }
    
    return { success: false, error: `错误: ${response.status}` };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Error Class ====================

class AIAPIError extends Error {
  constructor(message, code, nextProvider = null, httpStatus = null) {
    super(message);
    this.name = 'AIAPIError';
    this.code = code;
    this.nextProvider = nextProvider;
    this.httpStatus = httpStatus;
  }
}

// ==================== TTS (Text-to-Speech) ====================

const TTS_VOICES = {
  siliconflow: [
    { id: 'FunAudioLLM/CosyVoice2-0.5B:anna', name: 'Anna（温柔女声）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:alex', name: 'Alex（磁性男声）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:emma', name: 'Emma（知性女声）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:jack', name: 'Jack（沉稳男声）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:zh-hongchen', name: '红尘（温柔古风）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:zh-leszhu', name: 'Leszhu（活力少年）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:zh-shaonian', name: '少年（清澈少年）', model: 'FunAudioLLM/CosyVoice2-0.5B' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:zh-tianmei', name: '甜美（甜美女声）', model: 'FunAudioLLM/CosyVoice2-0.5B' }
  ],
  zhipu: [
    { id: 'tongtong', name: '彤彤（智谱女声）', model: 'cogtts' },
    { id: 'nan_speaker_01', name: '男声1号', model: 'cogtts' },
    { id: 'nv_speaker_01', name: '女声1号', model: 'cogtts' }
  ],
  browser: [
    { id: 'default', name: '系统默认语音', model: 'speechSynthesis' }
  ]
};

function getTTSProvider() {
  const stored = localStorage.getItem('tts_provider');
  if (stored) {
    const apiKey = localStorage.getItem(`apiKey_${stored}`);
    if (apiKey || stored === 'browser') {
      return stored;
    }
  }
  
  const providers = ['siliconflow', 'zhipu', 'moark'];
  for (const p of providers) {
    if (localStorage.getItem(`apiKey_${p}`)) {
      return p;
    }
  }
  
  return 'browser';
}

function getTTSVoice() {
  return localStorage.getItem('tts_voice') || '';
}

function getTTSSpeed() {
  return parseFloat(localStorage.getItem('tts_speed')) || 1.0;
}

function getAvailableTTSVoices() {
  const provider = getTTSProvider();
  return TTS_VOICES[provider] || TTS_VOICES.browser;
}

async function synthesizeSpeech(text, options = {}) {
  const provider = options.provider || getTTSProvider();
  const voice = options.voice || getTTSVoice();
  const speed = options.speed || getTTSSpeed();
  
  if (provider === 'browser') {
    throw new Error('browser');
  }
  
  const apiKey = localStorage.getItem(`apiKey_${provider}`);
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }
  
  const config = API_PROVIDERS[provider];
  if (!config) {
    throw new Error('UNKNOWN_PROVIDER');
  }
  
  let url, body;
  
  if (provider === 'siliconflow') {
    const voiceInfo = TTS_VOICES.siliconflow.find(v => v.id === voice) || TTS_VOICES.siliconflow[0];
    url = `${config.baseURL}/audio/speech`;
    body = {
      model: voiceInfo.model,
      input: text,
      voice: voiceInfo.id,
      speed: speed,
      response_format: 'mp3',
      stream: false
    };
  } else if (provider === 'zhipu') {
    url = `${config.baseURL}/audio/speech`;
    body = {
      model: 'cogtts',
      input: text,
      voice: voice || 'tongtong'
    };
  } else if (provider === 'moark') {
    url = `${config.baseURL}/audio/speech`;
    body = {
      model: 'GLM-TTS',
      input: text,
      voice: voice || 'tongtong'
    };
  } else {
    throw new Error('UNSUPPORTED_PROVIDER');
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (response.status === 401) {
    throw new Error('API Key无效');
  }
  
  if (response.status === 429) {
    throw new Error('请求过于频繁');
  }
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TTS错误: ${response.status} ${errText.substring(0, 100)}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// ==================== Image Generation ====================

async function generateImage(prompt, options = {}) {
  const provider = options.provider || 'siliconflow';
  const apiKey = localStorage.getItem(`apiKey_${provider}`);
  
  if (!apiKey) {
    throw new AIAPIError('请先在设置中配置API Key', 'NO_API_KEY');
  }
  
  const config = API_PROVIDERS[provider];
  if (!config) {
    throw new AIAPIError('未知的提供商', 'UNKNOWN_PROVIDER');
  }
  
  const model = options.model || 'Kwai-Kolors/Kolors';
  const size = options.size || '1024x1024';
  
  const response = await fetch(`${config.baseURL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      size: size,
      n: options.n || 1
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new AIAPIError(`生图失败: ${response.status} ${errText.substring(0, 100)}`, 'IMAGE_ERROR');
  }
  
  const data = await response.json();
  return data.data || [];
}

// ==================== Speech Recognition ====================

async function transcribeAudio(audioFile, options = {}) {
  const provider = options.provider || 'siliconflow';
  const apiKey = localStorage.getItem(`apiKey_${provider}`);
  
  if (!apiKey) {
    throw new AIAPIError('请先在设置中配置API Key', 'NO_API_KEY');
  }
  
  const config = API_PROVIDERS[provider];
  if (!config) {
    throw new AIAPIError('未知的提供商', 'UNKNOWN_PROVIDER');
  }
  
  const model = options.model || 'iic/SenseVoiceSmall';
  
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', model);
  
  const response = await fetch(`${config.baseURL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new AIAPIError(`语音识别失败: ${response.status} ${errText.substring(0, 100)}`, 'TRANSCRIBE_ERROR');
  }
  
  const data = await response.json();
  return data.text || '';
}

// ==================== Export ====================

window.AI = {
  providers: API_PROVIDERS,
  getAvailableProviders,
  getPrimaryProvider,
  sendChatRequest,
  sendChatRequestSync,
  sendChatRequestStream,
  cancelCurrentRequest,
  testConnection,
  AIAPIError,
  tts: {
    voices: TTS_VOICES,
    getProvider: getTTSProvider,
    getVoice: getTTSVoice,
    getSpeed: getTTSSpeed,
    getAvailableVoices: getAvailableTTSVoices,
    synthesize: synthesizeSpeech
  },
  image: {
    generate: generateImage
  },
  speech: {
    transcribe: transcribeAudio
  }
};
