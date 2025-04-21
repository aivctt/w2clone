const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema({
    url: { 
        type: String, 
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    scriptActive: { 
        type: Boolean, 
        default: true 
    },
    lastCheck: { 
        type: Date 
    },
    clones: [{
        url: String,
        detectedAt: { 
            type: Date, 
            default: Date.now 
        },
        status: { 
            type: String, 
            enum: ['pending', 'blocked'], 
            default: 'pending' 
        },
        actions: {
            redirect: { type: Boolean, default: false },
            redirectUrl: { type: String },
            redirectLinks: { type: Boolean, default: false },
            redirectLinksUrl: { type: String },
            replaceImages: { type: Boolean, default: false },
            imageUrl: { type: String }
        }
    }]
});

// Índice composto para garantir que um usuário não tenha sites duplicados
SiteSchema.index({ url: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Site', SiteSchema); 