// Sistema de notificações push simplificado
class NotificationService {
    constructor() {
        this.permission = null;
        this.statusElement = document.getElementById('notificationStatus');
        this.statusTextElement = document.getElementById('notificationStatusText');
        this.notificationBtn = document.getElementById('notificationBtn');
        this.init();
    }

    // Inicializar o serviço de notificações
    async init() {
        // Verificar se o navegador suporta notificações
        if (!('Notification' in window)) {
            console.log('Este navegador não suporta notificações');
            this.updateUIStatus('unsupported');
            return;
        }

        // Verificar permissão atual
        this.permission = Notification.permission;
        this.updateUIStatus(this.permission);
        
        // Se já tiver permissão, registrar para receber notificações
        if (this.permission === 'granted') {
            await this.registerForNotifications();
        }
    }

    // Atualizar interface com o status atual
    updateUIStatus(status) {
        this.statusElement.className = 'notification-status';
        this.notificationBtn.disabled = false;

        switch (status) {
            case 'granted':
                this.statusElement.classList.add('active');
                this.statusTextElement.innerHTML = '<i class="bi bi-check-circle"></i> Notificações ativadas';
                this.notificationBtn.innerHTML = '<i class="bi bi-bell-fill"></i> Notificações Ativadas';
                this.notificationBtn.disabled = true;
                break;
            case 'denied':
                this.statusElement.classList.add('denied');
                this.statusTextElement.innerHTML = '<i class="bi bi-x-circle"></i> Notificações bloqueadas';
                this.notificationBtn.innerHTML = '<i class="bi bi-bell-slash"></i> Notificações Bloqueadas';
                break;
            case 'unsupported':
                this.statusElement.classList.add('denied');
                this.statusTextElement.innerHTML = '<i class="bi bi-exclamation-circle"></i> Navegador não suporta notificações';
                this.notificationBtn.disabled = true;
                break;
            default:
                this.statusElement.classList.add('pending');
                this.statusTextElement.innerHTML = '<i class="bi bi-bell"></i> Notificações não ativadas';
                this.notificationBtn.innerHTML = '<i class="bi bi-bell"></i> Ativar Notificações';
        }
    }

    // Solicitar permissão para notificações
    async requestPermission() {
        if (this.permission === 'granted') {
            return true;
        }

        try {
            const result = await Notification.requestPermission();
            this.permission = result;
            this.updateUIStatus(result);
            
            if (result === 'granted') {
                await this.registerForNotifications();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Erro ao solicitar permissão:', error);
            return false;
        }
    }

    // Registrar para receber notificações
    async registerForNotifications() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Usuário não está autenticado');
            }

            // Registrar dispositivo para notificações
            const response = await fetch('/api/notifications/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    device: 'web',
                    browser: navigator.userAgent
                })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao registrar para notificações');
            }
            
            console.log('Registrado para receber notificações');
            return true;
        } catch (error) {
            console.error('Erro ao registrar para notificações:', error);
            return false;
        }
    }

    // Mostrar uma notificação
    showNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            return false;
        }

        const defaultOptions = {
            icon: '/assets/icon-192x192.png',
            badge: '/assets/badge-72x72.png',
            vibrate: [200, 100, 200],
            requireInteraction: true
        };

        const notification = new Notification(title, { ...defaultOptions, ...options });
        
        notification.onclick = function() {
            window.focus();
            if (options.url) {
                window.location.href = options.url;
            }
            this.close();
        };

        return true;
    }

    // Testar notificação
    testNotification() {
        if (this.permission === 'granted') {
            this.showNotification('Teste de Notificação', {
                body: 'Suas notificações estão funcionando corretamente!',
                icon: '/assets/logotipo.png'
            });
            return true;
        }
        return false;
    }
}

// Criar instância global
window.notificationService = new NotificationService();

// Função para ativar notificações
async function enableNotifications() {
    const result = await window.notificationService.requestPermission();
    
    if (result) {
        window.notificationService.testNotification();
        return true;
    } else {
        if (Notification.permission === 'denied') {
            alert('As notificações estão bloqueadas. Por favor, verifique as configurações do seu navegador e permita as notificações para este site.');
        } else {
            alert('Não foi possível ativar as notificações. Tente novamente.');
        }
        return false;
    }
} 