import { getPool, sql } from '../config/database.js';

// --- 1. RENDER DASHBOARD ---
export const renderDashboardProfesor = async (req, res) => {
    try {
        const pool = await getPool();
        const idUsuario = req.user.id;

        const profeResult = await pool.request()
            .input('ID_Usuario', sql.Int, idUsuario)
            .query('SELECT ID_PROFESOR, PRIMER_NOMBRE, PRIMER_APELLIDO FROM Profesores WHERE ID_Usuario = @ID_Usuario');

        if (profeResult.recordset.length === 0) {
            return res.render('profesores/dashboard', { error: 'No tienes un perfil de profesor asignado.', cursos: [] });
        }

        const profesor = profeResult.recordset[0];
        const anioResult = await pool.request().query('SELECT TOP 1 ID_Anio_Lectivo, Anio FROM Anios_Lectivos WHERE EstaActivo = 1');
        const anioActivo = anioResult.recordset[0];

        if (!anioActivo) {
            return res.render('profesores/dashboard', { error: 'No hay año lectivo activo.', cursos: [], profesor });
        }

        const cursosResult = await pool.request()
            .input('ID_Profesor', sql.Int, profesor.ID_PROFESOR)
            .input('ID_Anio_Lectivo', sql.Int, anioActivo.ID_Anio_Lectivo)
            .query(`
                SELECT C.ID_Curso, A.NombreAsignatura, G.NombreGrado, S.NombreSeccion,
                    (SELECT COUNT(*) FROM Inscripciones I WHERE I.ID_Curso = C.ID_Curso) as TotalEstudiantes
                FROM Cursos C
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                WHERE C.ID_Profesor = @ID_Profesor AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
                ORDER BY G.ID_Grado, S.NombreSeccion
            `);

        res.render('profesores/dashboard', {
            profesor,
            anio: anioActivo.Anio,
            cursos: cursosResult.recordset,
            user: req.user
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar el panel del profesor.");
    }
};

// --- 2. RENDER SUBIR NOTAS ---
export const renderSubirNotas = async (req, res) => {
    const { idCurso } = req.params;
    const { corte } = req.query;
    const corteSeleccionado = corte || '1';

    try {
        const pool = await getPool();
        const cursoInfo = await pool.request()
            .input('ID_Curso', sql.Int, idCurso)
            .query(`
                SELECT C.ID_Curso, A.NombreAsignatura, G.NombreGrado, S.NombreSeccion 
                FROM Cursos C
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                WHERE C.ID_Curso = @ID_Curso
            `);

        const estudiantesResult = await pool.request()
            .input('ID_Curso', sql.Int, idCurso)
            .query(`
                SELECT I.ID_Inscripcion, E.PRIMER_APELLIDO, E.SEGUNDO_APELLIDO, E.PRIMER_NOMBRE, E.SEGUNDO_NOMBRE, E.CODIGO_ESTUDIANTE,
                    I.Nota_Corte1, I.Nota_Corte2, I.Nota_Corte3, I.Nota_Corte4,
                    I.Nota_Valores_C1, I.Nota_Valores_C2, I.Nota_Valores_C3, I.Nota_Valores_C4
                FROM Inscripciones I
                JOIN Estudiantes E ON I.ID_Estudiante = E.id_estudiante
                WHERE I.ID_Curso = @ID_Curso
                AND E.ID_Estado_Estudiante = (SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Activo')
                ORDER BY E.PRIMER_APELLIDO, E.PRIMER_NOMBRE
            `);

        res.render('profesores/subir-notas', {
            curso: cursoInfo.recordset[0],
            estudiantes: estudiantesResult.recordset,
            corte: corteSeleccionado,
            user: req.user
        });

    } catch (err) {
        console.error(err);
        res.redirect('/profesores');
    }
};

// --- 3. GUARDAR NOTAS ---
export const guardarNotas = async (req, res) => {
    const { corte, notas } = req.body;
    try {
        const pool = await getPool();
        const transaction = pool.transaction();
        await transaction.begin();

        let colNota = `Nota_Corte${corte}`;
        let colValores = `Nota_Valores_C${corte}`;
        const listaNotas = JSON.parse(notas);

        for (const item of listaNotas) {
            const notaAcademic = item.nota === '' ? null : parseFloat(item.nota);
            const notaValores = item.valores === '' ? null : parseFloat(item.valores);

            const request = transaction.request();
            request.input('ID_Inscripcion', sql.Int, item.id);
            request.input('Nota', sql.Decimal(5, 2), notaAcademic);
            request.input('Valores', sql.Decimal(5, 2), notaValores);

            await request.query(`
                UPDATE Inscripciones 
                SET ${colNota} = @Nota, ${colValores} = @Valores, FechaActualizacion = GETDATE()
                WHERE ID_Inscripcion = @ID_Inscripcion
            `);
        }

        await transaction.commit();
        res.json({ success: true, message: 'Notas guardadas correctamente' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al guardar en BD' });
    }
};

// --- 4. RENDER ASISTENCIA (NUEVO) ---
export const renderAsistencia = async (req, res) => {
    const { idCurso } = req.params;

    try {
        const pool = await getPool();

        // 1. Datos del Curso
        const cursoInfo = await pool.request()
            .input('ID_Curso', sql.Int, idCurso)
            .query(`
                SELECT C.ID_Curso, A.NombreAsignatura, G.NombreGrado, S.NombreSeccion 
                FROM Cursos C
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                WHERE C.ID_Curso = @ID_Curso
            `);

        // 2. Lista de Estudiantes (Solo Activos)
        const estudiantesResult = await pool.request()
            .input('ID_Curso', sql.Int, idCurso)
            .query(`
                SELECT 
                    I.ID_Inscripcion, 
                    E.PRIMER_APELLIDO, E.SEGUNDO_APELLIDO, E.PRIMER_NOMBRE, E.SEGUNDO_NOMBRE, 
                    E.CODIGO_ESTUDIANTE
                FROM Inscripciones I
                JOIN Estudiantes E ON I.ID_Estudiante = E.id_estudiante
                WHERE I.ID_Curso = @ID_Curso
                AND E.ID_Estado_Estudiante = (SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Activo')
                ORDER BY E.PRIMER_APELLIDO, E.PRIMER_NOMBRE
            `);

        res.render('profesores/asistencia', {
            curso: cursoInfo.recordset[0],
            estudiantes: estudiantesResult.recordset,
            user: req.user
        });

    } catch (err) {
        console.error(err);
        res.redirect('/profesores');
    }
};

// --- 5. GUARDAR ASISTENCIA (NUEVO) ---
export const guardarAsistencia = async (req, res) => {
    const { fecha, asistencias } = req.body;

    if (!fecha || !asistencias || asistencias.length === 0) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    try {
        const pool = await getPool();
        const transaction = pool.transaction();
        await transaction.begin();

        for (const item of asistencias) {
            const request = transaction.request();
            request.input('ID_Inscripcion', sql.Int, item.id);
            request.input('Fecha', sql.Date, fecha);
            request.input('Estado', sql.Char(1), item.status);

            await request.query(`
                MERGE Asistencia AS target
                USING (SELECT @ID_Inscripcion AS ID, @Fecha AS F) AS source
                ON (target.ID_Inscripcion = source.ID AND target.Fecha = source.F)
                WHEN MATCHED THEN
                    UPDATE SET Estado = @Estado
                WHEN NOT MATCHED THEN
                    INSERT (ID_Inscripcion, Fecha, Estado) VALUES (@ID_Inscripcion, @Fecha, @Estado);
            `);
        }

        await transaction.commit();
        res.json({ success: true, message: 'Asistencia guardada correctamente.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al guardar en BD' });
    }
};