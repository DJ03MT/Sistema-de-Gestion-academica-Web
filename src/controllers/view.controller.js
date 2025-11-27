import { getPool, sql } from '../config/database.js';

//  FUNCIÓN HELPER 
async function getGlobalValues(pool) {
    const currentMonth = new Date().getMonth() + 1;
    const [valorResult, calendarioResult] = await Promise.all([
        pool.request()
            .input('NumeroMes', sql.Int, currentMonth)
            .query('SELECT NombreValor FROM ValoresDelMes WHERE NumeroMes = @NumeroMes'),
        pool.request()
            .query("SELECT Valor FROM Configuracion WHERE Clave = 'CALENDARIO_LINK'")
    ]);

    const valorDelMes = (valorResult.recordset.length > 0)
        ? valorResult.recordset[0].NombreValor
        : 'Paz y Bien';
    const calendarioLink = (calendarioResult.recordset.length > 0)
        ? calendarioResult.recordset[0].Valor
        : '#';
    return { valorDelMes, calendarioLink };
}


// Renderiza la página de Login
export const renderLogin = (req, res) => {
    // Solo redirigir si está autenticado Y NO hay un error en la URL
    if (req.isAuthenticated() && !req.query.error) {
        const rol = req.user.rol;
        switch (rol) {
            case 'SECRETARIA': return res.redirect('/secretaria');
            case 'DIRECTOR': return res.redirect('/admin');
            case 'PROFESORES': return res.redirect('/profesores');
            case 'ESTUDIANTES': return res.redirect('/estudiantes');
            case 'ACOMPANATES': return res.redirect('/acompanantes');
            default: return res.redirect('/logout');
        }
    }

    // Si hay error, o no está autenticado, renderizamos el login normal
    const error = req.query.error;
    let errorMessage = null;
    if (error === 'auth_failed') errorMessage = 'Error en la autenticación con Google.';
    if (error === 'not_logged_in') errorMessage = 'Necesitas iniciar sesión para continuar.';
    if (error === 'unauthorized') errorMessage = 'No tienes permisos para acceder a esa página.';
    if (error === 'rol_invalido') errorMessage = 'Tu usuario tiene un rol no reconocido.';

    res.render('login', { error: errorMessage, user: req.user || null });
};

// RENDER SECRETARIA
export const renderMenuSecretaria = async (req, res) => {
    try {
        const successMessage = req.query.success || null;
        const errorMessage = req.query.error || null;

        const pool = await getPool();

        // Consultamos Estudiantes y unimos con su Ficha Activa
        const studentsQuery = `
            SELECT
                E.id_estudiante, E.CODIGO_ESTUDIANTE, E.PRIMER_NOMBRE, E.SEGUNDO_NOMBRE,
                E.PRIMER_APELLIDO, E.SEGUNDO_APELLIDO,
                ISNULL(ES.NombreEstado, 'Sin Estado') AS NombreEstado,
                F.CELULAR, G.NombreGrado AS GRADO,
                (SELECT TOP 1 S.NombreSeccion 
                 FROM Inscripciones I 
                 JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                 JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                 JOIN Anios_Lectivos AL ON C.ID_Anio_Lectivo = AL.ID_Anio_Lectivo
                 WHERE I.ID_Estudiante = E.id_estudiante AND AL.EstaActivo = 1
                ) AS SECCION
            FROM Estudiantes E
            LEFT JOIN Estados_Estudiante ES ON E.ID_Estado_Estudiante = ES.ID_Estado_Estudiante
            LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
            LEFT JOIN Grados G ON F.ID_Grado_Matriculado = G.ID_Grado
            ORDER BY E.PRIMER_APELLIDO, E.PRIMER_NOMBRE
        `;

        const profesQuery = `
            SELECT P.ID_PROFESOR, P.PRIMER_NOMBRE, P.SEGUNDO_NOMBRE, P.PRIMER_APELLIDO,
                   P.SEGUNDO_APELLIDO, P.ESPECIALIDAD_DOCENTE
            FROM Profesores P
            LEFT JOIN Usuarios U ON P.ID_Usuario = U.ID_Usuario
            WHERE (U.EstaActivo = 1 OR P.ID_Usuario IS NULL) 
            ORDER BY P.PRIMER_APELLIDO, P.PRIMER_NOMBRE
        `;

        const currentMonth = new Date().getMonth() + 1;

        const [studentsResult, profesResult, gradosResult, globalValues] = await Promise.all([
            pool.request().query(studentsQuery),
            pool.request().query(profesQuery),
            pool.request().query('SELECT ID_Grado, NombreGrado FROM Grados ORDER BY ID_Grado'),
            getGlobalValues(pool)
        ]);

        const estudiantes = studentsResult.recordset;
        const profesores = profesResult.recordset;
        const grados = gradosResult.recordset;

        const { valorDelMes, calendarioLink } = globalValues;
        const stats = {
            totalEstudiantes: estudiantes.filter(e => e.NombreEstado === 'Activo').length,
            totalProfesores: profesores.length,
            cursosActivos: 42,
        };

        res.render('secretaria/menu-secretaria', {
            user: req.user,
            estudiantes: estudiantes,
            profesores: profesores,
            grados: grados, // <-- PASAR GRADOS A LA VISTA
            valorDelMes: valorDelMes,
            calendarioLink: calendarioLink,
            stats: stats,
            successMessage: successMessage,
            errorMessage: errorMessage
        });
    } catch (err) {
        console.error("Error al cargar el dashboard de secretaría:", err);
        res.status(500).send("Error al cargar los datos del dashboard");
    }
};

// RENDER ESTUDIANTE
export const renderMenuEstudiante = async (req, res) => {
    try {
        const pool = await getPool();
        const ID_Usuario = req.user.id;

        const estudianteResult = await pool.request()
            .input('ID_Usuario', sql.Int, ID_Usuario)
            .query(`
                SELECT 
                    E.id_estudiante, E.PRIMER_NOMBRE, E.PRIMER_APELLIDO,
                    ES.NombreEstado, E.ID_Estado_Estudiante, E.ID_Ficha_Activa
                FROM Estudiantes E
                LEFT JOIN Estados_Estudiante ES ON E.ID_Estado_Estudiante = ES.ID_Estado_Estudiante
                WHERE E.ID_Usuario = @ID_Usuario
            `);

        if (estudianteResult.recordset.length === 0) {
            return res.status(404).send('Este usuario no está vinculado a ningún estudiante.');
        }
        const estudiante = estudianteResult.recordset[0];

        const aniosResult = await pool.request().query(`
            SELECT ID_Anio_Lectivo, Anio, EstaActivo FROM Anios_Lectivos ORDER BY Anio DESC
        `);
        const anioActivo = aniosResult.recordset.find(a => a.EstaActivo);
        const anioSiguiente = aniosResult.recordset.find(a => !a.EstaActivo && a.Anio > (anioActivo ? anioActivo.Anio : 0));

        const infoMatricula = {
            anioActivo: anioActivo ? anioActivo.Anio : 'N/A',
            anioSiguiente: anioSiguiente ? anioSiguiente.Anio : 'N/A',
            idAnioSiguiente: anioSiguiente ? anioSiguiente.ID_Anio_Lectivo : null,
            estadoEstudiante: estudiante.NombreEstado,
            yaMatriculado: false,
            estadoMatricula: null,
            gradoActual: 'N/A',
            gradoDestino: null,
            idGradoDestino: null,
            error: null
        };

        if (!anioActivo || !anioSiguiente) {
            infoMatricula.error = 'El portal de matrícula no está disponible. Contacte al administrador.';
            return res.render('estudiantes/menu-estudiantes', { user: req.user, estudiante: estudiante, infoMatricula: infoMatricula });
        }

        const matriculaResult = await pool.request()
            .input('ID_Estudiante', sql.Int, estudiante.id_estudiante)
            .input('ID_Anio_Lectivo_Destino', sql.Int, anioSiguiente.ID_Anio_Lectivo)
            .query('SELECT EstadoFicha FROM FichasEstudiantiles WHERE ID_Estudiante = @ID_Estudiante AND ID_Anio_Lectivo = @ID_Anio_Lectivo_Destino');

        infoMatricula.yaMatriculado = matriculaResult.recordset.length > 0;
        if (infoMatricula.yaMatriculado) {
            infoMatricula.estadoMatricula = matriculaResult.recordset[0].EstadoFicha;
        }

        const gradoActualResult = await pool.request()
            .input('ID_Estudiante', sql.Int, estudiante.id_estudiante)
            .input('ID_Anio_Lectivo', sql.Int, anioActivo.ID_Anio_Lectivo)
            .query(`
                SELECT TOP 1 G.ID_Grado, G.NombreGrado, G.Siguiente_Grado_ID, G_Siguiente.NombreGrado AS Siguiente_NombreGrado
                FROM Inscripciones I
                JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                LEFT JOIN Grados G_Siguiente ON G.Siguiente_Grado_ID = G_Siguiente.ID_Grado
                WHERE I.ID_Estudiante = @ID_Estudiante AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
            `);

        const gradoInfo = gradoActualResult.recordset.length > 0 ? gradoActualResult.recordset[0] : null;

        if (gradoInfo) {
            infoMatricula.gradoActual = gradoInfo.NombreGrado;

            // Lógica de promoción
            if (estudiante.NombreEstado === 'Activo' || estudiante.NombreEstado === 'Aprobado') {
                infoMatricula.gradoDestino = gradoInfo.Siguiente_NombreGrado;
                infoMatricula.idGradoDestino = gradoInfo.Siguiente_Grado_ID;
                if (!infoMatricula.idGradoDestino) {
                    infoMatricula.estadoEstudiante = 'Graduado'; // Es de 11mo y pasó
                }
            } else if (estudiante.NombreEstado === 'Repite Año') {
                infoMatricula.gradoDestino = gradoInfo.NombreGrado; // Se queda en el mismo
                infoMatricula.idGradoDestino = gradoInfo.ID_Grado;
            } else if (estudiante.NombreEstado === 'A Reparación') {
                infoMatricula.error = 'Tu matrícula estará disponible cuando apruebes tus materias en reparación.';
            }
        } else if (estudiante.NombreEstado !== 'Retirado' && estudiante.NombreEstado !== 'Graduado') {
            infoMatricula.error = 'No estás inscrito en ningún curso este año. Contacta a secretaría.';
        }

        const { valorDelMes, calendarioLink } = await getGlobalValues(pool);

        res.render('estudiantes/menu-estudiantes', {
            user: req.user,
            estudiante: estudiante,
            infoMatricula: infoMatricula,
            valorDelMes: valorDelMes,
            calendarioLink: calendarioLink
        });

    } catch (err) {
        console.error("Error al cargar el panel del estudiante:", err);
        res.status(500).send("Error del servidor al cargar datos.");
    }
};
// Renderiza la página de Ayuda
export const renderAyuda = (req, res) => {
    res.render('public/ayuda');
};