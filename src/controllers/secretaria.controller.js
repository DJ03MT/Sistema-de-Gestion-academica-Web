import { getPool, sql } from '../config/database.js';

// RENDER ADD
export const renderAgregarProfesorForm = (req, res) => {
    try {
        res.render('secretaria/AdminProfesores/agregar-profesor', {
            user: req.user
        });
    } catch (err) {
        console.error("Error al renderizar 'agregar-profesor':", err);
        res.redirect('/secretaria');
    }
};

// CREATE
export const crearProfesor = async (req, res) => {
    const {
        PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO,
        CEDULA_IDENTIDAD, CARGO_REAL, ESPECIALIDAD_DOCENTE,
        CARGA_HORARIA, TITULOS, TURNO, OBSERVACIONES
    } = req.body;

    try {
        const pool = await getPool();
        await pool.request()
            .input('PRIMER_NOMBRE', sql.VarChar, PRIMER_NOMBRE)
            .input('SEGUNDO_NOMBRE', sql.VarChar, SEGUNDO_NOMBRE)
            .input('PRIMER_APELLIDO', sql.VarChar, PRIMER_APELLIDO)
            .input('SEGUNDO_APELLIDO', sql.VarChar, SEGUNDO_APELLIDO)
            .input('CEDULA_IDENTIDAD', sql.VarChar, CEDULA_IDENTIDAD)
            .input('CARGO_REAL', sql.VarChar, CARGO_REAL)
            .input('ESPECIALIDAD_DOCENTE', sql.VarChar, ESPECIALIDAD_DOCENTE)
            .input('CARGA_HORARIA', sql.VarChar, CARGA_HORARIA)
            .input('TITULOS', sql.VarChar, TITULOS)
            .input('TURNO', sql.VarChar, TURNO)
            .input('OBSERVACIONES', sql.VarChar, OBSERVACIONES)
            .query(`
                INSERT INTO Profesores (
                    PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO,
                    CEDULA_IDENTIDAD, CARGO_REAL, ESPECIALIDAD_DOCENTE, CARGA_HORARIA,
                    TITULOS, TURNO, OBSERVACIONES, ID_Usuario
                    /* --- 3. ELIMINA FechaCreacion DE LA LISTA DE COLUMNAS --- */
                ) VALUES (
                    @PRIMER_NOMBRE, @SEGUNDO_NOMBRE, @PRIMER_APELLIDO, @SEGUNDO_APELLIDO,
                    @CEDULA_IDENTIDAD, @CARGO_REAL, @ESPECIALIDAD_DOCENTE, @CARGA_HORARIA,
                    @TITULOS, @TURNO, @OBSERVACIONES, NULL
                    /* --- 4. ELIMINA EL VALOR DE FECHA DE AQUÍ --- */
                )
            `);

        res.redirect('/secretaria');

    } catch (err) {
        console.error('Error al crear profesor:', err);
        res.status(500).send('Error al guardar el profesor. Verifique los datos.');
    }
};

// RENDER EDIT
export const renderEditarProfesorForm = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const [profesorResult, usuariosResult] = await Promise.all([
            pool.request()
                .input('ID_PROFESOR', sql.Int, id)
                .query('SELECT * FROM Profesores WHERE ID_PROFESOR = @ID_PROFESOR'),

            // Esta nueva consulta filtra por rol e incluye al usuario ya asignado
            pool.request()
                .input('ID_PROFESOR_current', sql.Int, id)
                .query(`
                    SELECT U.ID_Usuario, U.Email, R.NombreRol
                    FROM Usuarios U
                    JOIN Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE (R.NombreRol = 'PROFESORES' OR R.NombreRol = 'PENDIENTE') AND U.EstaActivo = 1

                    UNION

                    SELECT U.ID_Usuario, U.Email, R.NombreRol
                    FROM Usuarios U
                    JOIN Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE U.ID_Usuario = (SELECT ID_Usuario FROM Profesores WHERE ID_PROFESOR = @ID_PROFESOR_current)
                    
                    ORDER BY U.Email
                `)
        ]);
        if (profesorResult.recordset.length === 0) {
            return res.status(404).send('Profesor no encontrado');
        }

        res.render('secretaria/AdminProfesores/editar-profesor', {
            user: req.user,
            profesor: profesorResult.recordset[0],
            usuarios: usuariosResult.recordset
        });

    } catch (err) {
        console.error('Error al cargar formulario de edición de profesor:', err);
        res.redirect('/secretaria');
    }
};

// UPDATE
export const actualizarProfesor = async (req, res) => {
    const { id } = req.params;
    const {
        PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO,
        CEDULA_IDENTIDAD, CARGO_REAL, ESPECIALIDAD_DOCENTE,
        CARGA_HORARIA, TITULOS, TURNO, OBSERVACIONES,
        ID_Usuario
    } = req.body;

    // Asegura que un string vacío se guarde como NULL
    const idUsuarioParaBD = (ID_Usuario === "" || ID_Usuario === "null") ? null : ID_Usuario;

    try {
        const pool = await getPool();
        await pool.request()
            .input('ID_PROFESOR', sql.Int, id)
            .input('PRIMER_NOMBRE', sql.VarChar, PRIMER_NOMBRE)
            .input('SEGUNDO_NOMBRE', sql.VarChar, SEGUNDO_NOMBRE)
            .input('PRIMER_APELLIDO', sql.VarChar, PRIMER_APELLIDO)
            .input('SEGUNDO_APELLIDO', sql.VarChar, SEGUNDO_APELLIDO)
            .input('CEDULA_IDENTIDAD', sql.VarChar, CEDULA_IDENTIDAD)
            .input('CARGO_REAL', sql.VarChar, CARGO_REAL)
            .input('ESPECIALIDAD_DOCENTE', sql.VarChar, ESPECIALIDAD_DOCENTE)
            .input('CARGA_HORARIA', sql.VarChar, CARGA_HORARIA)
            .input('TITULOS', sql.VarChar, TITULOS)
            .input('TURNO', sql.VarChar, TURNO)
            .input('OBSERVACIONES', sql.VarChar, OBSERVACIONES)
            .input('ID_Usuario', sql.Int, idUsuarioParaBD)
            .query(`
                UPDATE Profesores 
                SET 
                    PRIMER_NOMBRE = @PRIMER_NOMBRE, SEGUNDO_NOMBRE = @SEGUNDO_NOMBRE,
                    PRIMER_APELLIDO = @PRIMER_APELLIDO, SEGUNDO_APELLIDO = @SEGUNDO_APELLIDO,
                    CEDULA_IDENTIDAD = @CEDULA_IDENTIDAD, CARGO_REAL = @CARGO_REAL,
                    ESPECIALIDAD_DOCENTE = @ESPECIALIDAD_DOCENTE, CARGA_HORARIA = @CARGA_HORARIA,
                    TITULOS = @TITULOS, TURNO = @TURNO, OBSERVACIONES = @OBSERVACIONES,
                    ID_Usuario = @ID_Usuario,
                    FechaActualizacion = GETDATE() -- <-- CAMBIO: Auditoría
                WHERE ID_PROFESOR = @ID_PROFESOR
            `);

        res.redirect('/secretaria?success=Profesor actualizado con éxito');

    } catch (err) {
        console.error('Error al actualizar profesor:', err);
        res.status(500).send('Error al actualizar. Verifique los datos.');
    }
};

// LOGICA DE DESACTIVAR
export const desactivarProfesor = async (req, res) => {
    const { id } = req.params;
    let transaction;

    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        const idUsuarioResult = await transaction.request()
            .input('ID_PROFESOR', sql.Int, id)
            .query('SELECT ID_Usuario FROM Profesores WHERE ID_PROFESOR = @ID_PROFESOR');

        const idUsuario = idUsuarioResult.recordset.length > 0 ? idUsuarioResult.recordset[0].ID_Usuario : null;

        if (idUsuario) {
            await transaction.request()
                .input('ID_Usuario', sql.Int, idUsuario)
                .query('UPDATE Usuarios SET EstaActivo = 0, FechaActualizacion = GETDATE() WHERE ID_Usuario = @ID_Usuario');
        }

        await transaction.request()
            .input('ID_PROFESOR', sql.Int, id)
            .query(`
                UPDATE Profesores 
                SET 
                    EstaActivo = 0, 
                    FechaRetiro = GETDATE(),
                    FechaActualizacion = GETDATE()
                WHERE ID_PROFESOR = @ID_PROFESOR
            `);

        await transaction.commit();
        res.json({ success: true, message: 'Profesor desactivado. Ya no aparecerá en las listas ni podrá iniciar sesión.' });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Error al desactivar profesor:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// RENDER INACTIVOS
export const renderInactivos = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT * FROM Profesores 
                WHERE EstaActivo = 0
                ORDER BY PRIMER_APELLIDO
            `);

        res.render('secretaria/AdminProfesores/inactivos', {
            user: req.user,
            profesores: result.recordset
        });
    } catch (err) {
        console.error("Error al cargar profesores inactivos:", err);
        res.redirect('/secretaria');
    }
};

// LOGICA DE REACTIVAR
export const reactivarProfesor = async (req, res) => {
    const { id } = req.params;
    let transaction;

    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        const idUsuarioResult = await transaction.request()
            .input('ID_PROFESOR', sql.Int, id)
            .query('SELECT ID_Usuario FROM Profesores WHERE ID_PROFESOR = @ID_PROFESOR');

        const idUsuario = idUsuarioResult.recordset.length > 0 ? idUsuarioResult.recordset[0].ID_Usuario : null;

        if (idUsuario) {
            await transaction.request()
                .input('ID_Usuario', sql.Int, idUsuario)
                .query('UPDATE Usuarios SET EstaActivo = 1, FechaActualizacion = GETDATE() WHERE ID_Usuario = @ID_Usuario');
        }

        await transaction.request()
            .input('ID_PROFESOR', sql.Int, id)
            .query(`
                UPDATE Profesores 
                SET 
                    EstaActivo = 1, 
                    FechaRetiro = NULL,
                    FechaActualizacion = GETDATE()
                WHERE ID_PROFESOR = @ID_PROFESOR
            `);

        await transaction.commit();
        res.redirect('/secretaria');

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Error al reactivar profesor:', err);
        res.redirect('/secretaria/profesores/inactivos');
    }
};

// Historial Académico del Estudiante
export const renderHistorialEstudiante = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();

        const estudianteResult = await pool.request()
            .input('id_estudiante', sql.Int, id)
            .query(`
                SELECT id_estudiante, CODIGO_ESTUDIANTE, PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO
                FROM Estudiantes 
                WHERE id_estudiante = @id_estudiante
            `);

        if (estudianteResult.recordset.length === 0) {
            return res.status(404).send('Estudiante no encontrado');
        }
        const estudiante = estudianteResult.recordset[0];

        const inscripcionesResult = await pool.request()
            .input('id_estudiante', sql.Int, id)
            .query(`
                SELECT 
                    AL.Anio,
                    G.NombreGrado,
                    A.NombreAsignatura,
                    I.Nota_Corte1, I.Nota_Corte2, I.Nota_Corte3, I.Nota_Corte4,
                    I.Nota_Valores_C1, I.Nota_Valores_C2, I.Nota_Valores_C3, I.Nota_Valores_C4,
                    I.Promedio_Final_Cuantitativo,
                    I.Promedio_Final_Cualitativo,
                    I.Nota_Conducta
                FROM Inscripciones I
                JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Anios_Lectivos AL ON C.ID_Anio_Lectivo = AL.ID_Anio_Lectivo
                WHERE I.ID_Estudiante = @id_estudiante
                ORDER BY AL.Anio DESC, A.NombreAsignatura ASC
            `);

        const historial = {};
        inscripcionesResult.recordset.forEach(insc => {
            const anio = insc.Anio;
            if (!historial[anio]) {
                historial[anio] = {
                    Anio: anio,
                    NombreGrado: insc.NombreGrado,
                    boletin: []
                };
            }
            historial[anio].boletin.push(insc);
        });

        const historialPorAnio = Object.values(historial).sort((a, b) => b.Anio - a.Anio);

        res.render('secretaria/AdminEstudiantes/historial-estudiante', {
            user: req.user,
            estudiante: estudiante,
            historialPorAnio: historialPorAnio
        });

    } catch (err) {
        console.error("Error al cargar el historial del estudiante:", err);
        res.redirect('/secretaria?error=Error al cargar historial');
    }
};