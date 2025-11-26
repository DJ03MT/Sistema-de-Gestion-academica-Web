import { Router } from 'express';
import passport from 'passport';
import { googleCallback, logout } from '../controllers/auth.controller.js';

const router = Router();

// Iniciar autenticación
router.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' 
    })
);

// Callback
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    googleCallback
);

// Logout
router.get('/logout', logout);

export default router;