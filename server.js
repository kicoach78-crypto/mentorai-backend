// server.js - Backend complet et simple
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');

const app = express();

// Middleware
app.use(cors()); // ✅ Autorise toutes les origines
app.use(express.json());

// Configuration
const HF_MODELS = {
  chat: 'microsoft/DialoGPT-small',
  transcribe: 'openai/whisper-tiny',
  sentiment: 'distilbert-base-uncased-finetuned-sst-2-english'
};

const HF_API = 'https://api-inference.huggingface.co/models/';

// 1. ENDPOINT CHAT
app.post('/api/chat', async (req, res) => {
  try {
    const { message, apiKey } = req.body;
    
    if (!apiKey) {
      return res.json({
        success: false,
        response: '⚠️ Veuillez configurer votre clé Hugging Face',
        fallback: true
      });
    }

    console.log('🤖 Chat request:', message?.substring(0, 50));
    
    const response = await fetch(HF_API + HF_MODELS.chat, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: message,
        parameters: {
          max_length: 150,
          temperature: 0.7,
          do_sample: true
        }
      }),
      timeout: 30000
    });

    if (response.ok) {
      const data = await response.json();
      let aiResponse = data[0]?.generated_text || 'Bonjour !';
      
      // Nettoyer
      if (aiResponse.startsWith(message)) {
        aiResponse = aiResponse.substring(message.length).trim();
      }
      
      res.json({
        success: true,
        response: aiResponse,
        model: HF_MODELS.chat
      });
    } else {
      const errorText = await response.text();
      console.error('HF Error:', errorText);
      
      // Fallback intelligent
      const fallbackResponse = getFallbackResponse(message);
      res.json({
        success: false,
        response: fallbackResponse,
        fallback: true,
        error: `API Error: ${response.status}`
      });
    }
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({
      success: false,
      response: getFallbackResponse(req.body?.message || ''),
      fallback: true,
      error: error.message
    });
  }
});

// 2. ENDPOINT TRANSCRIPTION
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { apiKey } = req.body;
    const audioFile = req.file;
    
    if (!apiKey) {
      return res.json({
        success: false,
        text: 'Clé API requise pour la transcription',
        fallback: true
      });
    }
    
    if (!audioFile) {
      return res.json({
        success: false,
        text: 'Aucun fichier audio reçu'
      });
    }
    
    console.log('🎤 Transcription request:', audioFile.size, 'bytes');
    
    // Créer FormData pour Hugging Face
    const formData = new FormData();
    formData.append('file', audioFile.buffer, {
      filename: 'audio.wav',
      contentType: audioFile.mimetype
    });
    
    const response = await fetch(HF_API + HF_MODELS.transcribe, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData.getBuffer(),
      timeout: 60000
    });
    
    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        text: data.text || '',
        language: data.language || 'fr'
      });
    } else {
      throw new Error(`Transcription failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Transcription error:', error);
    res.json({
      success: false,
      text: 'Transcription échouée. Mode test activé.',
      fallback: true
    });
  }
});

// 3. ENDPOINT ANALYSE
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, apiKey } = req.body;
    
    if (!apiKey) {
      return res.json({
        success: false,
        sentiment: 'neutral',
        fallback: true
      });
    }
    
    const response = await fetch(HF_API + HF_MODELS.sentiment, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text }),
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      
      res.json({
        success: true,
        sentiment: result.label.toLowerCase(),
        confidence: result.score,
        raw: result
      });
    } else {
      throw new Error('Sentiment analysis failed');
    }
    
  } catch (error) {
    console.error('Analyze error:', error);
    res.json({
      success: true,
      sentiment: 'neutral',
      confidence: 0.5,
      fallback: true
    });
  }
});

// 4. HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'active', 
    service: 'mentorai-backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>MentorAI Backend</title></head>
      <body>
        <h1>✅ MentorAI Backend - ACTIF</h1>
        <p>Endpoints disponibles :</p>
        <ul>
          <li>POST /api/chat</li>
          <li>POST /api/transcribe</li>
          <li>POST /api/analyze</li>
          <li>GET /health</li>
        </ul>
      </body>
    </html>
  `);
});

// Fonction de fallback
function getFallbackResponse(message) {
  const responses = {
    'bonjour': 'Bonjour ! Je suis MentorAI, votre assistant en développement personnel.',
    'salut': 'Salut ! Comment puis-je vous aider aujourd\'hui ?',
    'stress': 'Pour le stress, essayez la respiration 4-7-8 ou une marche de 10 minutes.',
    'méditation': 'La méditation commence par 5 minutes quotidiennes. Concentrez-vous sur votre souffle.',
    'dépression': 'Il est important d\'en parler à un professionnel. Vous n\'êtes pas seul.',
    'anxiété': 'L\'anxiété peut être gérée avec des techniques de pleine conscience.',
    'sommeil': 'Pour mieux dormir : routine fixe, pas d\'écrans avant le coucher.',
    'confiance': 'La confiance se construit par petites victoires quotidiennes.'
  };
  
  const lowerMsg = (message || '').toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerMsg.includes(key)) {
      return response;
    }
  }
  
  return 'Merci pour votre message. Je suis ici pour vous accompagner.';
}

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});