import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import allRoutes from './routes/index.js';
import configurePassport from './config/passport.js';

// Cargar variables de entorno
dotenv.config();

// Configuración de paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuración EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- PASO 1: MIDDLEWARES ESENCIALES (PARSEO) ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- PASO 2: CONFIGURACIÓN DE SESIONES Y PASSPORT (DEBE IR ANTES DE LAS RUTAS) ---
// --- PASO 2: CONFIGURACIÓN DE SESIONES Y PASSPORT ---
// 1. Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'ceo_sistema_secreto_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        // --- CORRECCIÓN IMPORTANTE ---
        // Forzamos 'false' para que funcione en localhost (http)
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// 2. Configurar e Inicializar Passport
configurePassport(passport); // Llama a la función que exportaste
app.use(passport.initialize());
app.use(passport.session()); // Esto añade req.isAuthenticated a la solicitud

// --- PASO 3: ARCHIVOS ESTÁTICOS ---
const staticPath = path.join(__dirname, 'Public');
app.use(express.static(staticPath));
console.log(`[Ruta Estática] Sirviendo archivos desde: ${staticPath}`);

// --- PASO 4: USAR TODAS LAS RUTAS (AHORA SÍ TENDRÁN ACCESO A req.isAuthenticated) ---
app.use('/', allRoutes);


export default app;