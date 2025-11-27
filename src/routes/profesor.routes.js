import { Router } from 'express';
// import { isProfesor } from '../middlewares/auth.middleware.js'; // <-- SEGURIDAD (Descomentar en producción)
import {
    renderDashboardProfesor,
    renderSubirNotas,
    guardarNotas,
    renderAsistencia,
    guardarAsistencia
} from '../controllers/profesor.controller.js';

const router = Router();

// MODO DEPRUEBAS: SEGURIDAD DESACTIVADA (Temporal)
router.use((req, res, next) => {
    console.log(" [MODO PRUEBAS] Accediendo a menú Profesor");
    if (req.isAuthenticated()) {
        return next();
    }
    console.log(" No hay sesión activa. Redirigiendo al Login.");
    res.redirect('/?error=not_logged_in');
});

// Dashboard principal  
router.get('/profesores', renderDashboardProfesor);

// Notas
router.get('/profesores/curso/:idCurso', renderSubirNotas);
router.post('/profesores/guardar-notas', guardarNotas);

// NUEVAS RUTAS DE ASISTENCIA (Esto es lo que te faltaba)
router.get('/profesores/curso/:idCurso/asistencia', renderAsistencia);
router.post('/profesores/guardar-asistencia', guardarAsistencia);

export default router;