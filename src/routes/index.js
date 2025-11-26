import { Router } from 'express';
import authRoutes from './auth.routes.js';
import viewRoutes from './view.routes.js';
import estudianteRoutes from './estudiante.routes.js';
import adminRoutes from './admin.routes.js';
import secretariaRoutes from './secretaria.routes.js';
import profesorRoutes from './profesor.routes.js';


const router = Router();

router.use(authRoutes);
router.use(viewRoutes);
router.use(estudianteRoutes); 
router.use(adminRoutes);
router.use(secretariaRoutes);
router.use(profesorRoutes);

export default router;