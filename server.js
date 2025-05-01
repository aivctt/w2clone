const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./models/User');
const Site = require('./models/Site');

const app = express();

// Middleware básicos
app.use(cors());
app.use(express.json());

// Configuração da sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'anticlone-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware para verificar autenticação em rotas protegidas
const requireAuth = (req, res, next) => {
    // Lista de rotas públicas
    const publicPaths = [
        '/login.html',
        '/register.html',
        '/api/login',
        '/api/register',
        '/assets',
        '/css',
        '/js'
    ];

    // Verifica se é uma rota pública
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Verifica se está autenticado
    if (!req.session.isAuthenticated) {
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        return res.redirect('/login.html');
    }

    next();
};

// Aplica middleware de autenticação
app.use(requireAuth);

// Middleware para verificar token JWT em rotas da API
const verifyApiToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu-segredo-jwt');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Serve arquivos estáticos
app.use(express.static('public'));

// Middleware para verificar se o usuário é administrador
const requireAdmin = async (req, res, next) => {
    try {
        // Verifica se o usuário está autenticado
        if (!req.session.isAuthenticated) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        // Busca o usuário no banco de dados
        const user = await User.findById(req.session.userId);
        
        // Verifica se o usuário é administrador
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
        }

        next();
    } catch (error) {
        console.error('Erro ao verificar permissões de administrador:', error);
        res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
};

// Rota de registro
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já está em uso' });
        }

        const user = new User({ name, email, password });
        await user.save();

        // Gera token JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'seu-segredo-jwt',
            { expiresIn: '24h' }
        );

        // Inicia sessão
        req.session.isAuthenticated = true;
        req.session.userId = user._id;
        req.session.userName = user.name;

        res.status(201).json({ 
            message: 'Usuário criado com sucesso',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Rota de login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Gera token JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'seu-segredo-jwt',
            { expiresIn: '24h' }
        );

        // Inicia sessão
        req.session.isAuthenticated = true;
        req.session.userId = user._id;
        req.session.userName = user.name;

        res.json({ 
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Rota para obter perfil do usuário
app.get('/api/user/profile', verifyApiToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// Rota para atualizar perfil do usuário
app.put('/api/user/profile', verifyApiToken, async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findById(req.user.id).select('+password');
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (name) user.name = name;
        if (password) user.password = password;

        await user.save();
        
        // Retorna o usuário atualizado sem a senha
        const updatedUser = await User.findById(user._id).select('-password');
        res.json(updatedUser);
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Rota de logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// Rotas protegidas da API
app.post('/api/sites', verifyApiToken, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL é obrigatória' });
        }

        const site = new Site({
            url,
            user: req.user.id
        });
        await site.save();

        res.json({ 
            message: 'Site adicionado com sucesso',
            site,
            script: `<script src="${process.env.API_URL || 'http://localhost:3000'}/protect.js?site=${site._id}"></script>`
        });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Este site já está registrado para este usuário' });
        } else {
            res.status(500).json({ error: 'Erro ao adicionar site' });
        }
    }
});

app.get('/api/sites', verifyApiToken, async (req, res) => {
    try {
        const sites = await Site.find({ user: req.user.id });
        res.json(sites.map(site => ({
            ...site.toObject(),
            script: `<script src="${process.env.API_URL || 'http://localhost:3000'}/protect.js?site=${site._id}"></script>`
        })));
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar sites' });
    }
});

app.put('/api/sites/:siteId/config', verifyApiToken, async (req, res) => {
    try {
        const site = await Site.findOne({ _id: req.params.siteId, user: req.user.id });
        if (!site) {
            return res.status(404).json({ error: 'Site não encontrado' });
        }

        const { redirect, redirectUrl, redirectLinks, redirectLinksUrl, replaceImages, imageUrl } = req.body;
        
        site.clones.forEach(clone => {
            clone.actions = {
                redirect,
                redirectUrl,
                redirectLinks,
                redirectLinksUrl,
                replaceImages,
                imageUrl
            };
        });

        await site.save();
        res.json({ message: 'Configurações atualizadas com sucesso', site });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

app.delete('/api/sites/:siteId', verifyApiToken, async (req, res) => {
    try {
        const site = await Site.findOneAndDelete({ _id: req.params.siteId, user: req.user.id });
        if (!site) {
            return res.status(404).json({ error: 'Site não encontrado' });
        }
        res.json({ message: 'Site excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir site' });
    }
});

// Rotas de verificação de clones
app.post('/api/verify', async (req, res) => {
    try {
        const { url } = req.body;
        const site = await Site.findOne({ url });
        
        if (!site) {
            return res.json({ isClone: false });
        }

        const clone = site.clones.find(c => c.url === url);
        if (clone) {
            return res.json({ 
                isClone: true,
                actions: clone.actions
            });
        }

        site.clones.push({ url });
        await site.save();

        res.json({ 
            isClone: true,
            actions: site.clones[site.clones.length - 1].actions
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar clone' });
    }
});

app.post('/api/clone-actions', async (req, res) => {
    try {
        const { url } = req.body;
        const site = await Site.findOne({ url });
        
        if (!site || !site.clones.length) {
            return res.json({ actions: null });
        }

        const clone = site.clones.find(c => c.url === url);
        res.json({ actions: clone ? clone.actions : null });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar ações' });
    }
});

// Rotas para servir páginas HTML
app.get('/login.html', (req, res) => {
    if (req.session.isAuthenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
    if (req.session.isAuthenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/protection.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'protection.html'));
});

app.get('/plans.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'plans.html'));
});

// Rotas administrativas
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

app.get('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

app.put('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    try {
        const { name, email, isAdmin } = req.body;
        
        // Não permite alterar a senha por esta rota
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Atualiza os campos
        if (name) user.name = name;
        if (email) user.email = email;
        if (typeof isAdmin === 'boolean') user.isAdmin = isAdmin;
        
        await user.save();
        
        // Retorna o usuário atualizado sem a senha
        const updatedUser = await User.findById(user._id).select('-password');
        res.json(updatedUser);
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        if (error.code === 11000) {
            res.status(400).json({ error: 'Email já está em uso' });
        } else {
            res.status(500).json({ error: 'Erro ao atualizar usuário' });
        }
    }
});

app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
});

// Rota para enviar notificações
app.post('/api/admin/notifications', requireAdmin, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'A mensagem é obrigatória' });
        }

        // Busca todos os usuários para enviar a notificação
        const users = await User.find();
        
        // Aqui você pode implementar a lógica de envio de notificações
        // Por exemplo, usando um serviço de push notifications ou email
        // Por enquanto, vamos apenas simular o envio
        
        // TODO: Implementar o envio real de notificações
        console.log('Enviando notificação para todos os usuários:', message);

        res.json({ message: 'Notificação enviada com sucesso' });
    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
        res.status(500).json({ error: 'Erro ao enviar notificação' });
    }
});

// Rota para a página administrativa
app.get('/admin.html', async (req, res) => {
    try {
        // Verifica se o usuário está autenticado
        if (!req.session.isAuthenticated) {
            return res.redirect('/login.html');
        }

        // Busca o usuário no banco de dados
        const user = await User.findById(req.session.userId);
        
        // Verifica se o usuário é administrador
        if (!user || !user.isAdmin) {
            return res.redirect('/login.html');
        }

        // Se for administrador, serve a página
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } catch (error) {
        console.error('Erro ao verificar permissões de administrador:', error);
        res.redirect('/login.html');
    }
});

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Conectado ao MongoDB');
        app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    })
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err)); 