import { Router } from 'express';
import { isDirector } from '../middlewares/auth.middleware.js';
import {
    renderAdminDashboard,
    renderManageUsuarios,
    updateUsuario,
    renderManageCursos,
    crearCurso,
    eliminarCurso,
    renderManageAnios,
    crearAnioLectivo,
    activarAnioLectivo,
    renderManageCriterios, // <-- AÑADIR
    bulkCrearCriterios,    // <-- AÑADIR
    // Nuevas funciones para Valores Globales
    renderManageGlobales,
    updateValorDelMes,
    updateCalendarioLink
} from '../controllers/admin.controller.js';

const router = Router();

// Todas las rutas en este archivo están protegidas por el middleware isDirector
router.use(isDirector);

// --- RUTAS DEL PANEL DE ADMIN ---

// Dashboard principal
router.get('/admin', renderAdminDashboard);

// Gestión de Usuarios y Roles
router.get('/admin/usuarios', renderManageUsuarios);
router.post('/admin/usuarios/:id', updateUsuario);

// Gestión de Cursos (Profesor + Clase)
router.get('/admin/cursos', renderManageCursos);
router.post('/admin/cursos', crearCurso);
router.post('/admin/cursos/:id/delete', eliminarCurso); // Usamos POST para un form simple

// Gestión de Años Lectivos
router.get('/admin/anios', renderManageAnios);
router.post('/admin/anios', crearAnioLectivo);
router.post('/admin/anios/:id/activar', activarAnioLectivo);

// --- AÑADIR ESTAS RUTAS NUEVAS ---
// Gestión de Criterios de Evaluación
router.get('/admin/criterios', renderManageCriterios);
router.post('/admin/criterios/bulk-create', bulkCrearCriterios);

// Gestión de Valores Globales (Calendario y Valor del Mes)
router.get('/admin/globales', renderManageGlobales);
router.post('/admin/globales/valor/:id', updateValorDelMes);
router.post('/admin/globales/calendario', updateCalendarioLink);

// --- AÑADIR ESTAS RUTAS NUEVAS ---
// Gestión de Criterios de Evaluación
router.get('/admin/criterios', renderManageCriterios);
router.post('/admin/criterios/bulk-create', bulkCrearCriterios);

// Gestión de Valores Globales
router.get('/admin/globales', renderManageGlobales);
router.post('/admin/globales/valor/:id', updateValorDelMes);
router.post('/admin/globales/calendario', updateCalendarioLink);

export default router;