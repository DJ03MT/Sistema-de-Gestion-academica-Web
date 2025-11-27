import { Router } from 'express';
import { isSecretaria } from '../middlewares/auth.middleware.js';


import {
    renderAgregarProfesorForm,
    crearProfesor,
    renderEditarProfesorForm,
    actualizarProfesor,
    renderInactivos,
    desactivarProfesor,
    reactivarProfesor
} from '../controllers/secretaria.controller.js';

const router = Router();

// Todas estas rutas están protegidas y solo 'SECRETARIA' (o 'DIRECTOR') puede acceder
router.use(isSecretaria);


// Mostrar formulario para AGREGAR (GET)
router.get('/secretaria/agregar-profesor', renderAgregarProfesorForm);

// Procesar el formulario y CREAR (POST)
router.post('/secretaria/profesores', crearProfesor);

// Mostrar formulario para EDITAR (GET)
router.get('/secretaria/editar-profesor/:id', renderEditarProfesorForm);

// Procesar el formulario y ACTUALIZAR (POST)
router.post('/secretaria/editar-profesor/:id', actualizarProfesor);

// DESACTIVAR un profesor (DELETE)
router.delete('/secretaria/profesores/:id', desactivarProfesor);

// Ver profesores inactivos (GET)
router.get('/secretaria/profesores/inactivos', renderInactivos);

// Reactivar un profesor (POST)
router.post('/secretaria/profesores/:id/reactivar', reactivarProfesor);


export default router;