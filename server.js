const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/w2clone', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Modelo para sites protegidos
const SiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  scriptActive: { type: Boolean, default: true },
  lastCheck: { type: Date },
  actions: {
    redirect: { type: Boolean, default: false },
    redirectUrl: { type: String },
    replaceImages: { type: Boolean, default: false },
    imageUrl: { type: String }
  },
  clones: [{
    url: String,
    detectedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'blocked'], default: 'pending' }
  }]
});

const Site = mongoose.model('Site', SiteSchema);

// Rotas
app.post('/api/sites', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validar URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'URL inválida' });
    }
    
    const site = new Site({ url });
    await site.save();
    
    res.json({ 
      success: true,
      _id: site._id,
      url: site.url,
      createdAt: site.createdAt,
      scriptActive: site.scriptActive,
      actions: site.actions,
      clones: site.clones
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Este site já está cadastrado' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// Rota para servir o arquivo w2clone.js
app.get('/w2clone.js', (req, res) => {
  const script = `
    const W2Clone = {
      protect: function(originalUrl) {
        const checkClone = async () => {
          try {
            const currentUrl = window.location.href;
            const currentDomain = new URL(currentUrl).hostname;
            const originalDomain = new URL(originalUrl).hostname;
            
            if (currentDomain !== originalDomain) {
              const response = await fetch('https://w2clone.onrender.com/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  originalUrl,
                  cloneUrl: currentUrl 
                })
              });
              
              const data = await response.json();
              
              if (data.isClone) {
                const { actions } = data;
                
                if (actions.redirect && actions.redirectUrl) {
                  window.location.href = actions.redirectUrl;
                  return;
                }
                
                if (actions.replaceImages && actions.imageUrl) {
                  document.querySelectorAll('img').forEach(img => {
                    img.src = actions.imageUrl;
                  });
                }
              }
            }
          } catch (error) {
            console.error('Erro ao verificar clone:', error);
          }
        };
        
        // Verificar a cada 30 segundos
        setInterval(checkClone, 30000);
        // Verificar imediatamente
        checkClone();
      }
    };
  `;
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

app.get('/api/sites', async (req, res) => {
  try {
    const sites = await Site.find().sort('-createdAt');
    res.json(sites);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/sites/:siteId/config', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { actions } = req.body;
    
    // Validar URLs quando necessário
    if (actions.redirect && !actions.redirectUrl) {
      return res.status(400).json({ error: 'URL de redirecionamento é obrigatória' });
    }
    if (actions.replaceImages && !actions.imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória' });
    }
    
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site não encontrado' });
    }
    
    site.actions = actions;
    await site.save();
    
    res.json(site);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/verify', async (req, res) => {
  try {
    const { originalUrl, cloneUrl } = req.body;
    const site = await Site.findOne({ url: originalUrl });
    
    if (!site) {
      return res.status(404).json({ error: 'Site original não encontrado' });
    }
    
    // Atualizar lastCheck
    site.lastCheck = new Date();
    
    // Verificar se já existe um clone registrado
    let clone = site.clones.find(c => c.url === cloneUrl);
    
    if (!clone) {
      // Adicionar novo clone
      site.clones.push({
        url: cloneUrl,
        detectedAt: new Date(),
        status: 'pending'
      });
    }
    
    await site.save();

    // Retornar ações com as URLs configuradas
    const actions = {
      redirect: site.actions.redirect,
      redirectUrl: site.actions.redirectUrl,
      replaceImages: site.actions.replaceImages,
      imageUrl: site.actions.imageUrl
    };

    // Enviar notificação (você pode implementar isso depois)
    // notifyOwner(site.url, cloneUrl);

    res.json({ isClone: true, actions });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 