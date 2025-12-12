const express = require('express');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const storage = new Storage();

// Configurações
app.use(express.json());
app.use(cors());

// Servir arquivos estáticos do React (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// --- HEALTH CHECK (Cloud Run) ---
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- ROTA DE UPLOAD YOUTUBE (SERVER-SIDE) ---
app.post('/api/upload-youtube', async (req, res) => {
  const { storagePath, metadata, accessToken } = req.body;

  if (!storagePath || !accessToken) {
    return res.status(400).json({ error: 'Missing storagePath or accessToken' });
  }

  console.log(`[Upload] Iniciando: ${storagePath}`);

  try {
    // 1. Configurar Cliente YouTube
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // 2. Obter referência do arquivo no Storage
    const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT || 'mandrill-marketing-90970'}.firebasestorage.app`;
    const file = storage.bucket(bucketName).file(storagePath);

    const [fileMetadata] = await file.getMetadata();
    const fileSize = parseInt(fileMetadata.size);

    console.log(`[Upload] Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // 3. Criar Stream de Leitura do Firebase Storage
    const downloadStream = file.createReadStream();

    // 4. Preparar status para agendamento
    const status = {
      privacyStatus: metadata.publishAt ? 'private' : (metadata.privacyStatus || 'public'),
      selfDeclaredMadeForKids: false
    };
    
    if (metadata.publishAt) {
      status.publishAt = metadata.publishAt;
    }

    // 5. Upload para YouTube via Stream
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId || '22'
        },
        status: status
      },
      media: {
        body: downloadStream
      }
    });

    console.log(`[Upload] Sucesso! ID: ${response.data.id}`);
    
    res.json({ 
      id: response.data.id,
      status: 'success'
    });

  } catch (error) {
    console.error('[Upload] Erro:', error);
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: msg });
  }
});

// --- FALLBACK SPA ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
