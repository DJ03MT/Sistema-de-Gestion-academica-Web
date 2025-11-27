
dotenv.config();
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import allRoutes from './routes/index.js';
import configurePassport from './config/passport.js';



// Configuración de paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuración EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MIDDLEWARES ESENCIALES (PARSEO)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CONFIGURACIÓN DE SESIONES Y PASSPORT
// 1. Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'ceo_sistema_secreto_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// 2. Configurar e Inicializar Passport
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// ARCHIVOS ESTÁTICOS
const staticPath = path.join(__dirname, 'Public');
app.use(express.static(staticPath));
console.log(`[Ruta Estática] Sirviendo archivos desde: ${staticPath}`);
app.use('/', allRoutes);


export default app;