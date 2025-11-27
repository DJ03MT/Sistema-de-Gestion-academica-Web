import { Router } from 'express';
import { isSecretaria, isProfesor, isEstudiante } from '../middlewares/auth.middleware.js';
import { getPool, sql } from '../config/database.js';

import {
    renderAgregarEstudianteForm,
    crearEstudiante,
    renderEditarEstudianteForm,
    actualizarEstudiante,
    retirarEstudiante,
    generarMatriculaPDF,
    generarMatriculaPDFPorGrado,
    generarMatriculaPorCarnet,
    generarMatriculaPorNombre,
    generarBoletinPDF
} from '../controllers/estudiante.controller.js';
import { renderHistorialEstudiante } from '../controllers/secretaria.controller.js';
const router = Router();


// (Todas protegidas por el middleware 'isSecretaria')

// Mostrar formulario para AGREGAR
router.get('/secretaria/agregar-estudiante', isSecretaria, renderAgregarEstudianteForm);

// Procesar el formulario y CREAR
router.post('/secretaria/estudiantes', isSecretaria, crearEstudiante);

// Mostrar formulario para EDITAR
router.get('/secretaria/editar-estudiante/:id', isSecretaria, renderEditarEstudianteForm);

// Procesar el formulario y ACTUALIZAR
router.post('/secretaria/editar-estudiante/:id', isSecretaria, actualizarEstudiante);

// RETIRAR un estudiante (Esta ruta la llamará JavaScript desde el modal)
// CAMBIADO DE DELETE A POST para poder enviar el "motivo" en el body
router.post('/secretaria/estudiantes/:id/retirar', isSecretaria, retirarEstudiante);


// GENERAR PDF (Individual)
router.get('/secretaria/estudiante/:id/matricula-pdf', isSecretaria, generarMatriculaPDF);

// GENERAR PDF (Masivo)
router.get('/secretaria/estudiantes/matricula-por-grado', isSecretaria, generarMatriculaPDFPorGrado);
router.get('/secretaria/estudiante/:id/historial', isSecretaria, renderHistorialEstudiante);
// Ruta para buscar por carnet y generar la matrícula individual
router.get('/secretaria/documentos/matricula-por-carnet', isSecretaria, generarMatriculaPorCarnet);

// Ruta para buscar por nombre completo (abre listado o redirige al PDF)
router.get('/secretaria/documentos/matricula-por-nombre', isSecretaria, generarMatriculaPorNombre);


router.get('/secretaria/documentos/matricula-por-nombre', isSecretaria, generarMatriculaPorNombre);

// AÑADIR ESTA NUEVA RUTA PARA EL ESTUDIANTE
router.get('/estudiantes/boletin-pdf', isEstudiante, generarBoletinPDF);

export default router;