// Configurações da aplicação
const config = {
    // Obtém a URL base do servidor atual
    apiUrl: window.location.origin,
    
    // Rotas da API
    api: {
        login: '/api/login',
        register: '/api/register',
        logout: '/api/logout',
        users: '/api/users',
        notifications: '/api/notifications'
    },
    
    // Rotas de páginas
    routes: {
        home: '/',
        login: '/login.html',
        register: '/register.html',
        dashboard: '/index.html',
        admin: '/admin.html'
    }
};

// Função para verificar se o usuário está autenticado
function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

// Função para obter o token JWT
function getToken() {
    return localStorage.getItem('token');
}

// Função para obter dados do usuário
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Função para fazer logout
async function logout() {
    try {
        await fetch(config.api.logout, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = config.routes.login;
    }
}

// Função para verificar e redirecionar se não estiver autenticado
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = config.routes.login;
        return false;
    }
    return true;
} 