import { Router } from 'express';
import { isSecretaria } from '../middlewares/auth.middleware.js';

// Importamos TODAS las funciones del nuevo controlador
import { 
    renderAgregarProfesorForm,
    crearProfesor,
    renderEditarProfesorForm,
    actualizarProfesor,
    renderInactivos,
    desactivarProfesor,
    reactivarProfesor
} from '../controllers/secretaria.controller.js'; // Asegúrate que la ruta sea correcta

const router = Router();

// Todas estas rutas están protegidas y solo 'SECRETARIA' (o 'DIRECTOR') puede acceder
router.use(isSecretaria); 

// --- RUTAS DEL CRUD DE PROFESORES ---

// 1. Mostrar formulario para AGREGAR (GET)
// (El link "Nuevo Profesor" en tu dashboard apunta aquí)
router.get('/secretaria/agregar-profesor', renderAgregarProfesorForm);

// 2. Procesar el formulario y CREAR (POST)
// (El formulario 'agregar-profesor.ejs' envía aquí)
router.post('/secretaria/profesores', crearProfesor);

// 3. Mostrar formulario para EDITAR (GET)
// (El botón "Editar" de la tabla apunta aquí)
router.get('/secretaria/editar-profesor/:id', renderEditarProfesorForm);

// 4. Procesar el formulario y ACTUALIZAR (POST)
// (El formulario 'editar-profesor.ejs' envía aquí)
router.post('/secretaria/editar-profesor/:id', actualizarProfesor);

// 5. DESACTIVAR un profesor (DELETE)
// (Lo llama el JavaScript del dashboard)
router.delete('/secretaria/profesores/:id', desactivarProfesor);

// 6. RENDER: Ver profesores inactivos (GET)
// (El botón "Ver Inactivos" apunta aquí)
router.get('/secretaria/profesores/inactivos', renderInactivos);

// 7. UPDATE: Reactivar un profesor (POST)
// (El formulario 'inactivos.ejs' envía aquí)
router.post('/secretaria/profesores/:id/reactivar', reactivarProfesor);


export default router;