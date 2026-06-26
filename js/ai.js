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
    model: 'Qwen/Qwen2.5-7B-Instruct'
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
  AIAPIError
};
