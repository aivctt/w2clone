const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createAdmin() {
    try {
        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anticlone');
        console.log('Conectado ao MongoDB');

        // Verificar se já existe algum usuário
        const existingUsers = await User.find();
        if (existingUsers.length > 0) {
            console.log('Já existem usuários no sistema. Use a interface administrativa para gerenciar usuários.');
            process.exit(0);
        }

        // Criar o usuário administrador
        const adminUser = new User({
            name: 'Administrador',
            email: 'admin@w2clone.com',
            password: 'senhaAdmin123',
            isAdmin: true
        });

        await adminUser.save();
        console.log('Usuário administrador criado com sucesso!');
        console.log('Email: admin@w2clone.com');
        console.log('Senha: senhaAdmin123');
        console.log('\nPor favor, altere a senha após o primeiro login.');

    } catch (error) {
        console.error('Erro ao criar usuário administrador:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createAdmin(); 