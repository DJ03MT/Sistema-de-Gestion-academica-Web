import dotenv from 'dotenv';
import { getPool } from './src/config/database.js';

import app from './src/server.js';
dotenv.config();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`🔐 Google OAuth configurado`);
    console.log(`📧 Ruta de login: http://localhost:${PORT}`);
    console.log(`📚 Conexión a BD establecida: ${process.env.AZURE_SQL_DATABASE}`);
});