import { Router } from 'express';
import {
    renderLogin,
    renderMenuSecretaria,
    renderMenuEstudiante,
    renderAyuda // <-- AÑADE ESTA LÍNEA
} from '../controllers/view.controller.js';

//import { renderSubirNotas,
//    renderDashboardProfesor
//} from '../controllers/profesor.controller.js';

import { isSecretaria, isEstudiante, isProfesor } from '../middlewares/auth.middleware.js';

const router = Router();

// 🏠 Ruta principal - Login
router.get('/', renderLogin);

// --- ✅ AÑADE ESTA RUTA NUEVA ---
// 📞 Ruta de Ayuda (Pública)
router.get('/ayuda', renderAyuda);
// --- FIN DE LA RUTA NUEVA ---

// 🧾 Secretaría
router.get('/secretaria', isSecretaria, renderMenuSecretaria);

// 👨‍ Estudiantes
router.get('/estudiantes', isEstudiante, renderMenuEstudiante);

// 👨 Profesores
//router.get('/profesores', isProfesor, renderDashboardProfesor);

export default router;