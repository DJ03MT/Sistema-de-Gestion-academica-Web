import { Router } from 'express';
import {
    renderLogin,
    renderMenuSecretaria,
    renderMenuEstudiante,
    renderAyuda
} from '../controllers/view.controller.js';

import { isSecretaria, isEstudiante, isProfesor } from '../middlewares/auth.middleware.js';

const router = Router();

// Ruta principal - Login
router.get('/', renderLogin);

// Ruta de Ayuda (Pública)
router.get('/ayuda', renderAyuda);

// Secretaría
router.get('/secretaria', isSecretaria, renderMenuSecretaria);

// Estudiantes
router.get('/estudiantes', isEstudiante, renderMenuEstudiante);

// Profesores
//router.get('/profesores', isProfesor, renderDashboardProfesor);

export default router;