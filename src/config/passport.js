import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getPool, sql } from './database.js';

export default function (passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback"
    },
        async (accessToken, refreshToken, profile, done) => {

            const email = profile.emails[0].value;
            const name = profile.displayName;
            const photo = profile.photos[0].value;
            console.log(`Intentando autenticar con email: ${email}`);

            try {
                const pool = await getPool();
                // Buscar al usuario
                const result = await pool.request()
                    .input('email', sql.VarChar, email)
                    .query(`
                    SELECT 
                        U.ID_Usuario, U.Email, R.NombreRol 
                    FROM 
                        Usuarios U
                    JOIN 
                        Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE 
                        U.Email = @email AND U.EstaActivo = 1
                `);

                if (result.recordset.length > 0) {
                    //  Si el usuario existe, se crea el objeto
                    const dbUser = result.recordset[0];
                    const user = {
                        id: dbUser.ID_Usuario,
                        email: dbUser.Email,
                        rol: dbUser.NombreRol.trim().toUpperCase(),
                        name: name,
                        photo: photo
                    };
                    console.log(`Éxito: ${user.email} tiene el rol ${user.rol}`);
                    return done(null, user);
                } else {
                    console.log(`Fallo: Email ${email} no está autorizado.`);
                    return done(null, false, { message: 'Email no autorizado.' });
                }
            } catch (err) {
                console.error("Error en BD durante auth", err);
                return done(err, null);
            }
        }));


    // SERIALIZAR SOLO EL OBJETO DE SESIÓN BÁSICO

    passport.serializeUser((user, done) => {
        // Guardamos los datos que no están en la BD pero que necesitamos
        const sessionUser = {
            id: user.id,
            name: user.name,
            photo: user.photo,
            email: user.email
        };
        done(null, sessionUser);
    });


    //  DESERIALIZAR USANDO EL ID Y RECONSTRUIR 'req.user'
    // Esto se ejecuta en CADA solicitud (GET, POST, etc.)
    passport.deserializeUser(async (sessionUser, done) => {
        try {
            const pool = await getPool();

            // Consultamos la BD con el ID para obtener los datos (Rol y Estado)
            const result = await pool.request()
                .input('ID_Usuario', sql.Int, sessionUser.id)
                .query(`
                    SELECT 
                        U.EstaActivo, R.NombreRol 
                    FROM Usuarios U
                    JOIN Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE U.ID_Usuario = @ID_Usuario
                `);

            if (result.recordset.length > 0) {
                const dbInfo = result.recordset[0];

                if (!dbInfo.EstaActivo) {
                    return done(null, false, { message: 'Usuario desactivado.' });
                }

                // Construimos el objeto req.user 
                const user = {
                    id: sessionUser.id,
                    name: sessionUser.name,
                    photo: sessionUser.photo,
                    email: sessionUser.email,
                    rol: dbInfo.NombreRol.trim().toUpperCase()
                };

                done(null, user);

            } else {
                console.log(`Fallo en deserializeUser: Usuario ID ${sessionUser.id} no encontrado.`);
                return done(null, false, { message: 'Usuario no encontrado.' });
            }
        } catch (err) {
            console.error("Error en deserializeUser:", err);
            done(err, null);
        }
    });
}