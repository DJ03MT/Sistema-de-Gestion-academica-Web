import { getPool, sql } from '../config/database.js';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Campos de la ficha 
const camposFicha = [
    "LugarNacimiento", "ConQuienVive", "ParentescoTutor", "EstadoCivilPadres", "EmergenciaNombre1",
    "EmergenciaTelefono1", "EmergenciaNombre2", "EmergenciaTelefono2", "NombrePadre", "CedulaPadre",
    "NivelAcademicoPadre", "ProfesionPadre", "LugarTrabajoPadre", "TelefonoPersonalPadre",
    "TelefonoTrabajoPadre", "EmailPadre", "NombreMadre", "CedulaMadre", "NivelAcademicoMadre",
    "ProfesionMadre", "LugarTrabajoMadre", "TelefonoPersonalMadre", "TelefonoTrabajoMadre",
    "EmailMadre", "DOMICILIO", "CELULAR", "PRIMER_NOMBRE_RESPONSABLE", "SEGUNDO_NOMBRE_RESPONSABLE",
    "PRIMER_APELLIDO_RESPONSABLE", "SEGUNDO_APELLIDO_RESPONSABLE", "FECHA_NACIMIENTO_RESPONSABLE",
    "NACIONALIDAD_RESPONSABLE", "TIPO_DOCUMENTO", "NUMERO_DOCUMENTO", "HERMANOS_COLEGIO",
    "RELIGION", "OBSERVACION", "DIAGNOSTICO_SALUD"
];


export const renderAgregarEstudianteForm = async (req, res) => {
    try {
        const pool = await getPool();
        const [gradosResult, seccionesResult] = await Promise.all([
            pool.request().query('SELECT * FROM Grados'),
            pool.request().query('SELECT * FROM Secciones')
        ]);

        res.render('secretaria/AdminEstudiantes/agregar-estudiante', {
            user: req.user,
            grados: gradosResult.recordset,
            secciones: seccionesResult.recordset,
            ficha: {},
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error al cargar formulario de agregar estudiante:', err);
        res.redirect('/secretaria?error=Error al cargar formulario');
    }
};

// Procesar NUEVO estudiante 
export const crearEstudiante = async (req, res) => {
    const {
        grado, seccion, codigo_estudiante,
        primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
        fecha_nacimiento, sexo,
        ...fichaData
    } = req.body;

    let transaction;
    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        // Obtener ID
        const idsResult = await transaction.request()
            .input('NombreGrado', sql.VarChar, grado)
            .input('NombreSeccion', sql.VarChar, seccion)
            .query(`
                SELECT 
                    (SELECT ID_Grado FROM Grados WHERE NombreGrado = @NombreGrado) AS ID_Grado,
                    (SELECT ID_Seccion FROM Secciones WHERE NombreSeccion = @NombreSeccion) AS ID_Seccion,
                    (SELECT TOP 1 ID_Anio_Lectivo FROM Anios_Lectivos WHERE EstaActivo = 1) AS ID_Anio_Lectivo,
                    (SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Activo') AS ID_Estado_Activo
            `);

        const { ID_Grado, ID_Seccion, ID_Anio_Lectivo, ID_Estado_Activo } = idsResult.recordset[0];

        if (!ID_Grado || !ID_Seccion || !ID_Anio_Lectivo) {
            throw new Error('Grado, Sección o Año Activo no son válidos.');
        }

        // Crear el Estudiante
        // (Quitamos FechaCreacion de la consulta, la BD la pone por defecto)
        const estResult = await transaction.request()
            .input('CODIGO_ESTUDIANTE', sql.VarChar, codigo_estudiante)
            .input('PRIMER_NOMBRE', sql.VarChar, primer_nombre)
            .input('SEGUNDO_NOMBRE', sql.VarChar, segundo_nombre)
            .input('PRIMER_APELLIDO', sql.VarChar, primer_apellido)
            .input('SEGUNDO_APELLIDO', sql.VarChar, segundo_apellido)
            .input('FECHA_NACIMIENTO', sql.Date, fecha_nacimiento)
            .input('SEXO', sql.Char, sexo)
            .input('ID_Estado_Estudiante', sql.Int, ID_Estado_Activo)
            .input('ID_Seccion_Actual', sql.Int, ID_Seccion)
            .query(
                `INSERT INTO Estudiantes (
                    CODIGO_ESTUDIANTE, PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, 
                    FECHA_NACIMIENTO, SEXO, ID_Estado_Estudiante, ID_Seccion_Actual
                 ) OUTPUT INSERTED.id_estudiante 
                 VALUES (
                    @CODIGO_ESTUDIANTE, @PRIMER_NOMBRE, @SEGUNDO_NOMBRE, @PRIMER_APELLIDO, @SEGUNDO_APELLIDO, 
                    @FECHA_NACIMIENTO, @SEXO, @ID_Estado_Estudiante, @ID_Seccion_Actual
                 )`
            );
        const nuevoEstudianteID = estResult.recordset[0].id_estudiante;

        // Crear la Ficha Estudiantil
        const fichaRequest = transaction.request();
        fichaRequest.input('ID_Estudiante', sql.Int, nuevoEstudianteID);
        fichaRequest.input('ID_Anio_Lectivo', sql.Int, ID_Anio_Lectivo);
        fichaRequest.input('ID_Grado_Matriculado', sql.Int, ID_Grado);
        fichaRequest.input('EstadoFicha', sql.VarChar, 'Activa');

        let cols = [];
        let vals = [];
        for (const campo of camposFicha) {
            if (fichaData[campo]) {
                cols.push(campo);
                vals.push(`@${campo}`);
                fichaRequest.input(campo, sql.VarChar, fichaData[campo]);
            }
        }

        // Construir la consulta de Ficha
        let colsSql = (cols.length > 0) ? `, ${cols.join(', ')}` : '';
        let valsSql = (vals.length > 0) ? `, ${vals.join(', ')}` : '';

        const fichaResult = await fichaRequest.query(
            `INSERT INTO FichasEstudiantiles (
                ID_Estudiante, ID_Anio_Lectivo, ID_Grado_Matriculado, EstadoFicha ${colsSql}
             ) OUTPUT INSERTED.ID_Ficha
             VALUES (
                @ID_Estudiante, @ID_Anio_Lectivo, @ID_Grado_Matriculado, @EstadoFicha ${valsSql}
             )`
        );
        const nuevaFichaID = fichaResult.recordset[0].ID_Ficha;

        // Vincular la Ficha al Estudiante
        await transaction.request()
            .input('ID_Estudiante', sql.Int, nuevoEstudianteID)
            .input('ID_Ficha_Activa', sql.Int, nuevaFichaID)
            .query('UPDATE Estudiantes SET ID_Ficha_Activa = @ID_Ficha_Activa WHERE id_estudiante = @ID_Estudiante');

        // Inscribir en Cursos
        const cursosResult = await transaction.request()
            .input('ID_Grado', sql.Int, ID_Grado)
            .input('ID_Seccion', sql.Int, ID_Seccion)
            .input('ID_Anio_Lectivo', sql.Int, ID_Anio_Lectivo)
            .query(
                `SELECT ID_Curso FROM Cursos 
                 WHERE ID_Grado = @ID_Grado AND ID_Seccion = @ID_Seccion AND ID_Anio_Lectivo = @ID_Anio_Lectivo`
            );

        if (cursosResult.recordset.length === 0) {
            throw new Error(`No hay cursos creados para ${grado} ${seccion}. Hable con el Director.`);
        }

        for (const curso of cursosResult.recordset) {
            await transaction.request()
                .input('ID_Estudiante', sql.Int, nuevoEstudianteID)
                .input('ID_Curso', sql.Int, curso.ID_Curso)
                .query('INSERT INTO Inscripciones (ID_Estudiante, ID_Curso) VALUES (@ID_Estudiante, @ID_Curso)');
        }

        await transaction.commit();
        res.redirect('/secretaria?success=Estudiante creado y matriculado con éxito.');

    } catch (err) {
        if (transaction && transaction.active) {
            await transaction.rollback();
        }
        console.error('Error al crear/inscribir estudiante:', err);
        res.redirect('/secretaria/agregar-estudiante?error=' + encodeURIComponent(err.message));
    }
};

// Formulario para EDITAR estudiante
export const renderEditarEstudianteForm = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const studentResult = await pool.request()
            .input('id_estudiante', sql.Int, id)
            .query(`
                SELECT 
                    E.id_estudiante, E.CODIGO_ESTUDIANTE, E.PRIMER_NOMBRE, E.SEGUNDO_NOMBRE,
                    E.PRIMER_APELLIDO, E.SEGUNDO_APELLIDO, E.FECHA_NACIMIENTO, E.SEXO,
                    E.ID_Estado_Estudiante, E.ID_Ficha_Activa, E.MotivoRetiro, E.FechaRetiro,
                    E.ID_Usuario, -- --- AÑADIDO: Traer el ID_Usuario vinculado
                    F.*,
                    G.NombreGrado, S.NombreSeccion
                FROM Estudiantes E
                LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
                LEFT JOIN Grados G ON F.ID_Grado_Matriculado = G.ID_Grado
                LEFT JOIN Secciones S ON E.ID_Seccion_Actual = S.ID_Seccion
                WHERE E.id_estudiante = @id_estudiante
            `);

        if (studentResult.recordset.length === 0) {
            return res.status(404).send('Estudiante no encontrado');
        }

        // Cargar la lista de usuarios (solo roles Estudiante o Pendiente)
        const [statesResult, gradosResult, seccionesResult, usuariosResult] = await Promise.all([
            pool.request().query('SELECT * FROM Estados_Estudiante'),
            pool.request().query('SELECT * FROM Grados'),
            pool.request().query('SELECT * FROM Secciones'),
            // AÑADIDA ESTA CONSULTA
            pool.request()
                .input('ID_Estudiante_current', sql.Int, id)
                .query(`
                    SELECT U.ID_Usuario, U.Email, R.NombreRol
                    FROM Usuarios U
                    JOIN Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE (R.NombreRol = 'ESTUDIANTES' OR R.NombreRol = 'PENDIENTE') AND U.EstaActivo = 1

                    UNION

                    SELECT U.ID_Usuario, U.Email, R.NombreRol
                    FROM Usuarios U
                    JOIN Roles R ON U.ID_Rol = R.ID_Rol
                    WHERE U.ID_Usuario = (SELECT ID_Usuario FROM Estudiantes WHERE id_estudiante = @ID_Estudiante_current)
                    
                    ORDER BY U.Email
                `)
        ]);

        res.render('secretaria/AdminEstudiantes/editar-estudiante', {
            user: req.user,
            estudiante: studentResult.recordset[0],
            ficha: studentResult.recordset[0],
            estados: statesResult.recordset,
            grados: gradosResult.recordset,
            secciones: seccionesResult.recordset,
            usuarios: usuariosResult.recordset, //Pasar usuarios a la vista
            error: req.query.error || null,
            success: req.query.success || null
        });

    } catch (err) {
        console.error('Error al cargar formulario de edición:', err);
        res.redirect('/secretaria?error=Error al cargar formulario');
    }
};

// Procesar EDICIÓN estudiante
export const actualizarEstudiante = async (req, res) => {
    const { id } = req.params;
    const {
        grado, seccion,
        codigo_estudiante, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
        fecha_nacimiento, sexo, ID_Estado_Estudiante,
        ID_Usuario, //  ID_Usuario del formulario
        ...fichaData
    } = req.body;

    let transaction;
    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        //  Obtener ID de la NUEVA data 
        const idsResult = await transaction.request()
            .input('NombreGrado', sql.VarChar, grado)
            .input('NombreSeccion', sql.VarChar, seccion)
            .query(`
                SELECT 
                    (SELECT ID_Grado FROM Grados WHERE NombreGrado = @NombreGrado) AS ID_Grado_Nuevo,
                    (SELECT ID_Seccion FROM Secciones WHERE NombreSeccion = @NombreSeccion) AS ID_Seccion_Nueva,
                    (SELECT TOP 1 ID_Anio_Lectivo FROM Anios_Lectivos WHERE EstaActivo = 1) AS ID_Anio_Lectivo
            `);

        const { ID_Grado_Nuevo, ID_Seccion_Nueva, ID_Anio_Lectivo } = idsResult.recordset[0];

        if (!ID_Grado_Nuevo || !ID_Seccion_Nueva || !ID_Anio_Lectivo) {
            throw new Error('El nuevo Grado, Sección o Año Activo no son válidos.');
        }

        // Obtener IDs de la VIEJA data 
        const oldDataResult = await transaction.request()
            .input('ID_Estudiante', sql.Int, id)
            .query(`
                SELECT 
                    E.ID_Ficha_Activa, E.ID_Seccion_Actual AS ID_Seccion_Vieja,
                    F.ID_Grado_Matriculado AS ID_Grado_Viejo
                FROM Estudiantes E
                LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
                WHERE E.id_estudiante = @ID_Estudiante
            `);

        if (!oldDataResult.recordset.length || !oldDataResult.recordset[0].ID_Ficha_Activa) {
            throw new Error('Este estudiante no tiene una ficha activa para editar.');
        }
        const { ID_Ficha_Activa, ID_Grado_Viejo, ID_Seccion_Vieja } = oldDataResult.recordset[0];

        // Actualizar Estudiante (Datos Biográficos Y ID_Usuario)
        const idUsuarioParaBD = (ID_Usuario === "" || ID_Usuario === "null") ? null : ID_Usuario;

        await transaction.request()
            .input('ID_Estudiante', sql.Int, id)
            .input('CODIGO_ESTUDIANTE', sql.VarChar, codigo_estudiante)
            .input('PRIMER_NOMBRE', sql.VarChar, primer_nombre)
            .input('SEGUNDO_NOMBRE', sql.VarChar, segundo_nombre)
            .input('PRIMER_APELLIDO', sql.VarChar, primer_apellido)
            .input('SEGUNDO_APELLIDO', sql.VarChar, segundo_apellido)
            .input('FECHA_NACIMIENTO', sql.Date, fecha_nacimiento)
            .input('SEXO', sql.Char, sexo)
            .input('ID_Estado_Estudiante', sql.Int, ID_Estado_Estudiante)
            .input('ID_Seccion_Nueva', sql.Int, ID_Seccion_Nueva)
            .input('ID_Usuario', sql.Int, idUsuarioParaBD) // --- AÑADIDO ---
            .query(`
                UPDATE Estudiantes 
                SET 
                    CODIGO_ESTUDIANTE = @CODIGO_ESTUDIANTE, PRIMER_NOMBRE = @PRIMER_NOMBRE,
                    SEGUNDO_NOMBRE = @SEGUNDO_NOMBRE, PRIMER_APELLIDO = @PRIMER_APELLIDO,
                    SEGUNDO_APELLIDO = @SEGUNDO_APELLIDO, FECHA_NACIMIENTO = @FECHA_NACIMIENTO,
                    SEXO = @SEXO, ID_Estado_Estudiante = @ID_Estado_Estudiante,
                    ID_Seccion_Actual = @ID_Seccion_Nueva,
                    ID_Usuario = @ID_Usuario, -- --- AÑADIDO ---
                    FechaActualizacion = GETDATE()
                WHERE id_estudiante = @ID_Estudiante
            `);

        // --- PASO 4: Actualizar Ficha Estudiantil ---
        const fichaRequest = transaction.request();
        fichaRequest.input('ID_Ficha_Activa', sql.Int, ID_Ficha_Activa);
        fichaRequest.input('ID_Grado_Matriculado', sql.Int, ID_Grado_Nuevo);

        let setClauses = ["ID_Grado_Matriculado = @ID_Grado_Matriculado", "FechaActualizacion = GETDATE()"];
        for (const campo of camposFicha) {
            if (fichaData[campo] !== undefined) {
                setClauses.push(`${campo} = @${campo}`);
                fichaRequest.input(campo, sql.VarChar, fichaData[campo]);
            }
        }

        await fichaRequest.query(`
            UPDATE FichasEstudiantiles
            SET ${setClauses.join(', ')}
            WHERE ID_Ficha = @ID_Ficha_Activa
        `);

        // VERIFICAR SI CAMBIÓ DE GRADO O SECCIÓN
        if (ID_Grado_Viejo !== ID_Grado_Nuevo || ID_Seccion_Vieja !== ID_Seccion_Nueva) {
            console.log(`CAMBIO DETECTADO: Moviendo estudiante ${id} de ${ID_Grado_Viejo}/${ID_Seccion_Vieja} a ${ID_Grado_Nuevo}/${ID_Seccion_Nueva}`);

            // 5.1. Borrar inscripciones antiguas del año activo
            await transaction.request()
                .input('ID_Estudiante_Del', sql.Int, id)
                .input('ID_Anio_Lectivo_Del', sql.Int, ID_Anio_Lectivo)
                .query(`
                    DELETE I FROM Inscripciones I
                    JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                    WHERE I.ID_Estudiante = @ID_Estudiante_Del AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo_Del
                `);

            // Encontrar TODOS los cursos para el NUEVO Grado/Sección/Año
            const cursosNuevos = await transaction.request()
                .input('ID_Grado_Nuevo_Ins', sql.Int, ID_Grado_Nuevo)
                .input('ID_Seccion_Nueva_Ins', sql.Int, ID_Seccion_Nueva)
                .input('ID_Anio_Lectivo_Ins', sql.Int, ID_Anio_Lectivo)
                .query(
                    `SELECT ID_Curso FROM Cursos 
                     WHERE ID_Grado = @ID_Grado_Nuevo_Ins AND ID_Seccion = @ID_Seccion_Nueva_Ins AND ID_Anio_Lectivo = @ID_Anio_Lectivo_Ins`
                );

            if (cursosNuevos.recordset.length === 0) {
                throw new Error(`No hay cursos creados para ${grado} ${seccion}. Hable con el Director.`);
            }

            // Inscribir al estudiante en CADA NUEVO curso
            for (const curso of cursosNuevos.recordset) {
                await transaction.request()
                    .input('ID_Estudiante_Ins', sql.Int, id)
                    .input('ID_Curso_Ins', sql.Int, curso.ID_Curso)
                    .query('INSERT INTO Inscripciones (ID_Estudiante, ID_Curso) VALUES (@ID_Estudiante_Ins, @ID_Curso_Ins)');
            }
        }

        await transaction.commit();
        res.redirect(`/secretaria/editar-estudiante/${id}?success=Estudiante actualizado con éxito.`);

    } catch (err) {
        if (transaction && transaction.active) {
            await transaction.rollback();
        }
        console.error('Error al actualizar estudiante:', err);
        // --- AÑADIDO: Captura de error de email duplicado ---
        if (err.number === 2627 || err.number === 2601) { // Error de UNIQUE constraint
            return res.redirect(`/secretaria/editar-estudiante/${id}?error=` + encodeURIComponent('Error: Ese email ya está asignado a otro estudiante.'));
        }
        res.redirect(`/secretaria/editar-estudiante/${id}?error=` + encodeURIComponent(err.message));
    }
};

// Retirar estudiante 
export const retirarEstudiante = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || motivo.trim() === '') {
        return res.status(400).json({ success: false, message: 'Se requiere un motivo para el retiro.' });
    }

    let transaction;
    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        // Poner estado "Retirado" al estudiante y guardar el motivo/fecha
        const estadoRetiradoID = (await transaction.request().query("SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Retirado'")).recordset[0].ID_Estado_Estudiante;

        await transaction.request()
            .input('id_estudiante', sql.Int, id)
            .input('ID_Estado_Estudiante', sql.Int, estadoRetiradoID)
            .input('motivo', sql.NVarChar, motivo) // <-- CAMBIO
            .query(`
                UPDATE Estudiantes 
                SET 
                    ID_Estado_Estudiante = @ID_Estado_Estudiante,
                    FechaRetiro = GETDATE(),
                    MotivoRetiro = @motivo -- <-- CAMBIO: Se usa la nueva columna
                WHERE id_estudiante = @id_estudiante
            `);

        // BORRAR todas las inscripciones del año activo
        const anioActivoID = (await transaction.request().query("SELECT TOP 1 ID_Anio_Lectivo FROM Anios_Lectivos WHERE EstaActivo = 1")).recordset[0].ID_Anio_Lectivo;

        await transaction.request()
            .input('id_estudiante_insc', sql.Int, id)
            .input('ID_Anio_Lectivo', sql.Int, anioActivoID)
            .query(`
                DELETE I FROM Inscripciones I
                JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                WHERE I.ID_Estudiante = @id_estudiante_insc AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
            `);

        // Actualizar Ficha Activa con una nota de retiro
        const fichaActivaResult = await transaction.request()
            .input('id_estudiante_ficha', sql.Int, id)
            .query('SELECT ID_Ficha_Activa FROM Estudiantes WHERE id_estudiante = @id_estudiante_ficha');

        if (fichaActivaResult.recordset.length > 0 && fichaActivaResult.recordset[0].ID_Ficha_Activa) {
            const ID_Ficha_Activa = fichaActivaResult.recordset[0].ID_Ficha_Activa;
            await transaction.request()
                .input('ID_Ficha', sql.Int, ID_Ficha_Activa)
                .input('motivo', sql.VarChar, motivo)
                .query(`
                    UPDATE FichasEstudiantiles
                    SET OBSERVACION = ISNULL(OBSERVACION, '') + ' | RETIRO (' + CONVERT(VARCHAR, GETDATE(), 103) + '): ' + @motivo,
                        FechaActualizacion = GETDATE()
                    WHERE ID_Ficha = @ID_Ficha
                `);
        }

        await transaction.commit();
        res.json({ success: true, message: 'Estudiante movido a "Retirado" y desinscrito de todos los cursos.' });

    } catch (err) {
        if (transaction && transaction.active) {
            await transaction.rollback();
        }
        console.error('Error al retirar estudiante:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor al procesar el retiro.' });
    }
};

// Formulario de MATRÍCULA (Estudiante)
export const renderFormularioMatricula = async (req, res) => {
    try {
        const pool = await getPool();
        const ID_Usuario = req.user.id;

        const estResult = await pool.request()
            .input('ID_Usuario', sql.Int, ID_Usuario)
            .query(`
                SELECT E.id_estudiante, E.PRIMER_NOMBRE, E.PRIMER_APELLIDO, E.ID_Estado_Estudiante,
                       ES.NombreEstado, F.* FROM Estudiantes E
                LEFT JOIN Estados_Estudiante ES ON E.ID_Estado_Estudiante = ES.ID_Estado_Estudiante
                LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
                WHERE E.ID_Usuario = @ID_Usuario
            `);

        if (estResult.recordset.length === 0) {
            return res.status(404).send('Estudiante no encontrado.');
        }

        const ficha = estResult.recordset[0];
        const estudiante = {
            PRIMER_NOMBRE: ficha.PRIMER_NOMBRE,
            PRIMER_APELLIDO: ficha.PRIMER_APELLIDO,
            NombreEstado: ficha.NombreEstado
        };

        const aniosResult = await pool.request().query('SELECT * FROM Anios_Lectivos ORDER BY Anio DESC');
        const anioActivo = aniosResult.recordset.find(a => a.EstaActivo);
        const anioSiguiente = aniosResult.recordset.find(a => !a.EstaActivo && a.Anio > (anioActivo ? anioActivo.Anio : 0));

        const gradoActualResult = await pool.request()
            .input('ID_Estudiante', sql.Int, ficha.ID_Estudiante)
            .input('ID_Anio_Lectivo', sql.Int, anioActivo.ID_Anio_Lectivo)
            .query(`
                SELECT TOP 1 G.ID_Grado, G.NombreGrado, G.Siguiente_Grado_ID, G_Siguiente.NombreGrado AS Siguiente_NombreGrado
                FROM Inscripciones I
                JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                LEFT JOIN Grados G_Siguiente ON G.Siguiente_Grado_ID = G_Siguiente.ID_Grado
                WHERE I.ID_Estudiante = @ID_Estudiante AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
            `);

        if (gradoActualResult.recordset.length === 0) {
            return res.redirect('/estudiantes');
        }

        const gradoInfo = gradoActualResult.recordset[0];

        let gradoDestino, idGradoDestino;
        if (estudiante.NombreEstado === 'Repite Año') {
            gradoDestino = gradoInfo.NombreGrado;
            idGradoDestino = gradoInfo.ID_Grado;
        } else {
            gradoDestino = gradoInfo.Siguiente_NombreGrado;
            idGradoDestino = gradoInfo.Siguiente_Grado_ID;
        }

        const info = {
            anioSiguiente: anioSiguiente.Anio,
            idAnioSiguiente: anioSiguiente.ID_Anio_Lectivo,
            gradoDestino: gradoDestino,
            idGradoDestino: idGradoDestino
        };

        res.render('estudiantes/formulario-matricula', {
            user: req.user,
            estudiante: estudiante,
            ficha: ficha,
            info: info,
            error: req.query.error || null
        });

    } catch (err) {
        console.error('Error al renderizar formulario de matrícula:', err);
        res.redirect('/estudiantes');
    }
};

// Procesar MATRÍCULA (Estudiante)
export const procesarFormularioMatricula = async (req, res) => {
    let transaction;
    try {
        const pool = await getPool();
        const ID_Usuario = req.user.id;

        // --- PASO 1: Obtener datos del estudiante y su SECCIÓN ACTUAL ---
        const estudianteResult = await pool.request()
            .input('ID_Usuario', sql.Int, ID_Usuario)
            .query('SELECT id_estudiante, ID_Seccion_Actual FROM Estudiantes WHERE ID_Usuario = @ID_Usuario');

        if (estudianteResult.recordset.length === 0) {
            throw new Error('Usuario no vinculado a un estudiante.');
        }
        const { id_estudiante, ID_Seccion_Actual } = estudianteResult.recordset[0];

        const {
            ID_Anio_Lectivo_Destino, ID_Grado_Destino,
            ...fichaData
        } = req.body;

        if (!ID_Seccion_Actual) {
            throw new Error('El estudiante no tiene una sección asignada. Contacte a Secretaría.');
        }

        // Iniciar Transacción
        transaction = pool.transaction();
        await transaction.begin();

        // Crear la nueva Ficha Estudiantil (y marcarla como ACTIVA)
        const fichaRequest = transaction.request();
        fichaRequest.input('ID_Estudiante', sql.Int, id_estudiante);
        fichaRequest.input('ID_Anio_Lectivo', sql.Int, ID_Anio_Lectivo_Destino);
        fichaRequest.input('ID_Grado_Matriculado', sql.Int, ID_Grado_Destino);
        fichaRequest.input('EstadoFicha', sql.VarChar, 'Activa'); // Se activa de inmediato

        let cols = [];
        let vals = [];
        for (const campo of camposFicha) {
            const formCampo = `${campo}_Actualizado`;
            if (fichaData[formCampo]) {
                cols.push(campo);
                vals.push(`@${campo}`);
                fichaRequest.input(campo, sql.VarChar, fichaData[formCampo]);
            }
        }

        let colsSql = (cols.length > 0) ? `, ${cols.join(', ')}` : '';
        let valsSql = (vals.length > 0) ? `, ${vals.join(', ')}` : '';

        const fichaResult = await fichaRequest.query(`
            INSERT INTO FichasEstudiantiles (
                ID_Estudiante, ID_Anio_Lectivo, ID_Grado_Matriculado, EstadoFicha
                ${colsSql}
            ) OUTPUT INSERTED.ID_Ficha
            VALUES (
                @ID_Estudiante, @ID_Anio_Lectivo, @ID_Grado_Matriculado, @EstadoFicha
                ${valsSql}
            )
        `);
        const nuevaFichaID = fichaResult.recordset[0].ID_Ficha;

        // Vincular la nueva Ficha al Estudiante
        await transaction.request()
            .input('ID_Estudiante', sql.Int, id_estudiante)
            .input('ID_Ficha_Activa', sql.Int, nuevaFichaID)
            .input('ID_Estado_Activo', sql.Int, (await transaction.request().query("SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Activo'")).recordset[0].ID_Estado_Estudiante)
            .query(`
                UPDATE Estudiantes 
                SET 
                    ID_Ficha_Activa = @ID_Ficha_Activa,
                    ID_Estado_Estudiante = @ID_Estado_Activo, -- Se reactiva el estudiante
                    FechaActualizacion = GETDATE()
                WHERE id_estudiante = @ID_Estudiante
            `);

        // Inscribir automáticamente en los cursos
        const cursosNuevos = await transaction.request()
            .input('ID_Grado', sql.Int, ID_Grado_Destino)
            .input('ID_Seccion', sql.Int, ID_Seccion_Actual) // <-- CAMBIO: Usa la sección recordada
            .input('ID_Anio_Lectivo', sql.Int, ID_Anio_Lectivo_Destino)
            .query(
                `SELECT ID_Curso FROM Cursos 
                 WHERE ID_Grado = @ID_Grado AND ID_Seccion = @ID_Seccion AND ID_Anio_Lectivo = @ID_Anio_Lectivo`
            );

        if (cursosNuevos.recordset.length === 0) {
            throw new Error(`No hay cursos creados para su grado/sección. Contacte al Director.`);
        }

        for (const curso of cursosNuevos.recordset) {
            await transaction.request()
                .input('ID_Estudiante', sql.Int, id_estudiante)
                .input('ID_Curso', sql.Int, curso.ID_Curso)
                .query('INSERT INTO Inscripciones (ID_Estudiante, ID_Curso) VALUES (@ID_Estudiante, @ID_Curso)');
        }

        await transaction.commit();
        res.redirect('/estudiantes');

    } catch (err) {
        if (transaction && transaction.active) {
            await transaction.rollback();
        }
        console.error('Error al procesar matrícula:', err);
        if (err.number === 2627 || err.number === 2601) {
            return res.redirect('/estudiantes/matricular?error=' + encodeURIComponent('Ya has enviado tu matrícula para este año.'));
        }
        res.redirect('/estudiantes/matricular?error=' + encodeURIComponent(err.message));
    }
};

// GENERATE PDF
const QUERY_MATRICULA_COMPLETA = `
    SELECT 
        E.id_estudiante, E.CODIGO_ESTUDIANTE, E.PRIMER_NOMBRE, E.SEGUNDO_NOMBRE,
        E.PRIMER_APELLIDO, E.SEGUNDO_APELLIDO, E.FECHA_NACIMIENTO, E.SEXO,
        F.*,
        G.NombreGrado,
        AL.Anio
    FROM Estudiantes E
    LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
    LEFT JOIN Grados G ON F.ID_Grado_Matriculado = G.ID_Grado
    LEFT JOIN Anios_Lectivos AL ON F.ID_Anio_Lectivo = AL.ID_Anio_Lectivo
`;

async function generarPDFDesdeHTML(html, nombreArchivo) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 180000
    });

    const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' }
    });

    await browser.close();
    return pdfBuffer;
}

export const generarMatriculaPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const queryData = await pool.request()
            .input('id_estudiante', sql.Int, id)
            .query(`${QUERY_MATRICULA_COMPLETA} WHERE E.id_estudiante = @id_estudiante`);

        if (queryData.recordset.length === 0) {
            return res.status(404).send('Estudiante no encontrado');
        }

        const datosEstudiante = queryData.recordset[0];
        const nombreArchivo = `Matricula-${datosEstudiante.CODIGO_ESTUDIANTE || datosEstudiante.id_estudiante}.pdf`;
        const templatePath = path.join(__dirname, '../views/secretaria/documents/plantilla_matricula.ejs');
        const html = await ejs.renderFile(templatePath, {
            estudiantes: [datosEstudiante]
        });
        const pdfBuffer = await generarPDFDesdeHTML(html, nombreArchivo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Error al generar el PDF individual:', err);
        res.status(500).send('Error al generar el PDF: ' + err.message);
    }
};

export const generarMatriculaPDFPorGrado = async (req, res) => {
    try {
        const { ID_Grado } = req.query;

        if (!ID_Grado) {
            return res.status(400).send('Debe seleccionar un grado.');
        }

        const pool = await getPool();

        const queryData = await pool.request()
            .input('ID_Grado', sql.Int, ID_Grado)
            .query(`
                ${QUERY_MATRICULA_COMPLETA} 
                WHERE 
                    E.ID_Estado_Estudiante = (SELECT ID_Estado_Estudiante FROM Estados_Estudiante WHERE NombreEstado = 'Activo')
                    AND F.ID_Grado_Matriculado = @ID_Grado
                ORDER BY G.ID_Grado, E.PRIMER_APELLIDO
            `);

        if (queryData.recordset.length === 0) {
            return res.status(404).send('No se encontraron estudiantes activos para el grado seleccionado.');
        }

        const todosLosEstudiantes = queryData.recordset;
        const nombreGrado = todosLosEstudiantes[0].NombreGrado.replace(' ', '-');
        const nombreArchivo = `Matriculas_${nombreGrado}_${new Date().getFullYear()}.pdf`;
        const templatePath = path.join(__dirname, '../views/secretaria/documents/plantilla_matricula.ejs');
        const html = await ejs.renderFile(templatePath, {
            estudiantes: todosLosEstudiantes
        });
        const pdfBuffer = await generarPDFDesdeHTML(html, nombreArchivo);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Error al generar el PDF masivo por grado:', err);
        res.status(500).send('Error al generar el PDF: ' + err.message);
    }
};

export const generarMatriculaPorCarnet = async (req, res) => {
    try {
        const { carnet } = req.query;

        if (!carnet) {
            return res.status(400).send('Debe proporcionar el carnet del estudiante.');
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('carnet', sql.VarChar, carnet)
            .query('SELECT id_estudiante FROM Estudiantes WHERE CODIGO_ESTUDIANTE = @carnet');

        if (!result.recordset.length) {
            return res.status(404).send('No se encontró ningún estudiante con el carnet proporcionado.');
        }

        const id = result.recordset[0].id_estudiante;
        return res.redirect(`/secretaria/estudiante/${id}/matricula-pdf`);

    } catch (err) {
        console.error('Error al buscar estudiante por carnet:', err);
        res.status(500).send('Error en el servidor al buscar el carnet: ' + err.message);
    }
};

export const generarMatriculaPorNombre = async (req, res) => {
    try {
        let { nombre } = req.query;

        if (!nombre || !nombre.trim()) {
            return res.status(400).send('Debe proporcionar el nombre completo del estudiante.');
        }

        nombre = nombre.trim();
        const pool = await getPool();

        const nombreParam = `%${nombre.toLowerCase()}%`;
        const result = await pool.request()
            .input('nombre', sql.VarChar, nombreParam)
            .query(`
                SELECT id_estudiante, CODIGO_ESTUDIANTE, PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO
                FROM Estudiantes
                WHERE LOWER(PRIMER_NOMBRE + ' ' + ISNULL(SEGUNDO_NOMBRE,'') + ' ' + PRIMER_APELLIDO + ' ' + ISNULL(SEGUNDO_APELLIDO,'')) LIKE @nombre
            `);

        if (!result.recordset.length) {
            return res.status(404).send('No se encontró ningún estudiante con ese nombre.');
        }

        if (result.recordset.length === 1) {
            const id = result.recordset[0].id_estudiante;
            return res.redirect(`/secretaria/estudiante/${id}/matricula-pdf`);
        }

        let html = `<!doctype html><html><head><meta charset="utf-8"><title>Seleccionar Estudiante</title>
                    <style>body{font-family: Arial, Helvetica, sans-serif; padding:20px} ul{line-height:1.8}</style>
                    </head><body>`;
        html += `<h3>Se encontraron ${result.recordset.length} coincidencias. Seleccione el estudiante:</h3>`;
        html += '<ul>';
        for (const r of result.recordset) {
            const fullname = `${r.PRIMER_NOMBRE} ${r.SEGUNDO_NOMBRE || ''} ${r.PRIMER_APELLIDO} ${r.SEGUNDO_APELLIDO || ''}`.replace(/\s+/g, ' ').trim();
            html += `<li>${fullname} (Carnet: ${r.CODIGO_ESTUDIANTE || 'N/A'}) - <a href="/secretaria/estudiante/${r.id_estudiante}/matricula-pdf" target="_blank">Abrir Hoja</a></li>`;
        }
        html += '</ul>';
        html += '</body></html>';

        res.send(html);

    } catch (err) {
        console.error('Error al buscar estudiante por nombre:', err);
        res.status(500).send('Error en el servidor al buscar el nombre: ' + err.message);
    }
};


//GENERAR BOLETÍN PDF 
// Define las categorías de asignaturas (basado en Queryddd.txt y Formato.pdf)
const CATEGORIAS_ASIGNATURAS = {
    formacion: ['Ciencias Sociales', 'Derecho y Dignidad de la Mujer', 'Compromiso Social', 'Ciudadanía y Derechos Humanos', 'Emprendimiento y Compromiso Social'],
    personal: ['Fe y Vida', 'Creciendo en Valores'],
    comunicativa: ['Lengua y Literatura', 'Inglés', 'Lengua extranjera (Inglés)', 'Taller de Arte y Cultura', 'Expresión artística y cultural', 'Tertulia dialógica'],
    salud: ['Ciencias Naturales', 'Biología', 'Química', 'Fisica', 'Educación Física', 'Psicomotricidad', 'Conociendo mi Mundo', 'Tecnología', 'Educación física y vida saludable', 'Ciencias Naturales (Ciencias de la Vida y el Ambiente)/Biología', 'Ciencias Naturales (Ciencias de la Vida y el Ambiente)/Física'],
    matematicas: ['Matemáticas'],
    graduacion: ['Estudio Literario', 'Disertación del Estudio Literario']
};

// Función Principal del Controlador 
export const generarBoletinPDF = async (req, res) => {
    try {
        const pool = await getPool();
        const ID_Usuario = req.user.id;

        // Obtener ID del Estudiante y Año Activo
        const [estResult, anioResult] = await Promise.all([
            pool.request()
                .input('ID_Usuario', sql.Int, ID_Usuario)
                .query('SELECT id_estudiante FROM Estudiantes WHERE ID_Usuario = @ID_Usuario'),
            pool.request()
                .query('SELECT TOP 1 ID_Anio_Lectivo, Anio FROM Anios_Lectivos WHERE EstaActivo = 1')
        ]);

        if (estResult.recordset.length === 0) {
            return res.status(404).send('Usuario no vinculado a un estudiante.');
        }
        const id_estudiante = estResult.recordset[0].id_estudiante;
        const anioActivo = anioResult.recordset[0];

        // Obtener toda la información del estudiante y sus notas
        const infoQuery = await pool.request()
            .input('id_estudiante', sql.Int, id_estudiante)
            .input('ID_Anio_Lectivo', sql.Int, anioActivo.ID_Anio_Lectivo)
            .query(`
                -- Consulta 1: Datos del Estudiante y Ficha
                SELECT 
                    E.CODIGO_ESTUDIANTE,
                    E.PRIMER_NOMBRE + ' ' + ISNULL(E.SEGUNDO_NOMBRE, '') + ' ' + E.PRIMER_APELLIDO + ' ' + ISNULL(E.SEGUNDO_APELLIDO, '') AS NombreCompleto,
                    G.NombreGrado,
                    F.OBSERVACION
                FROM Estudiantes E
                LEFT JOIN FichasEstudiantiles F ON E.ID_Ficha_Activa = F.ID_Ficha
                LEFT JOIN Grados G ON F.ID_Grado_Matriculado = G.ID_Grado
                WHERE E.id_estudiante = @id_estudiante;

                -- Consulta 2: Notas del Boletín
                SELECT 
                    A.NombreAsignatura,
                    I.Nota_Corte1, I.Nota_Corte2, I.Nota_Corte3, I.Nota_Corte4,
                    I.Nota_Valores_C1, I.Nota_Valores_C2, I.Nota_Valores_C3, I.Nota_Valores_C4,
                    I.Promedio_Semestral_1, I.Promedio_Semestral_2,
                    I.Promedio_Final_Cuantitativo,
                    I.Promedio_Final_Cualitativo
                FROM Inscripciones I
                JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                WHERE I.ID_Estudiante = @id_estudiante AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
                ORDER BY A.NombreAsignatura;

                -- Consulta 3: Conteo de Asistencias 
                SELECT 
                    Estado, COUNT(*) as Total
                FROM Asistencia
                WHERE ID_Inscripcion IN (
                    SELECT ID_Inscripcion FROM Inscripciones I
                    JOIN Cursos C ON I.ID_Curso = C.ID_Curso
                    WHERE I.ID_Estudiante = @id_estudiante AND C.ID_Anio_Lectivo = @ID_Anio_Lectivo
                )
                GROUP BY Estado;
            `);

        const estudianteInfo = infoQuery.recordsets[0][0];
        const todasLasNotas = infoQuery.recordsets[1];
        const asistenciaData = infoQuery.recordsets[2];

        // 3. Procesar y Agrupar Datos

        // Agrupar Asistencias
        const asistencias = { Tarde: 0, Justificada: 0, Injustificada: 0 };
        asistenciaData.forEach(item => {
            if (item.Estado === 'T') asistencias.Tarde = item.Total;
            if (item.Estado === 'A') asistencias.Injustificada = item.Total; // Asumiendo 'A' = Injustificada
            // Nota: No tienes estado "Justificada" en tu tabla Asistencia
        });

        // Calcular Promedio de Notas de Valores por Corte
        const promediosValores = { v1: 0, v2: 0, v3: 0, v4: 0 };
        let countValores = { v1: 0, v2: 0, v3: 0, v4: 0 };

        todasLasNotas.forEach(n => {
            if (n.Nota_Valores_C1 !== null) { promediosValores.v1 += n.Nota_Valores_C1; countValores.v1++; }
            if (n.Nota_Valores_C2 !== null) { promediosValores.v2 += n.Nota_Valores_C2; countValores.v2++; }
            if (n.Nota_Valores_C3 !== null) { promediosValores.v3 += n.Nota_Valores_C3; countValores.v3++; }
            if (n.Nota_Valores_C4 !== null) { promediosValores.v4 += n.Nota_Valores_C4; countValores.v4++; }
        });

        if (countValores.v1 > 0) promediosValores.v1 /= countValores.v1;
        if (countValores.v2 > 0) promediosValores.v2 /= countValores.v2;
        if (countValores.v3 > 0) promediosValores.v3 /= countValores.v3;
        if (countValores.v4 > 0) promediosValores.v4 /= countValores.v4;


        // Agrupar Asignaturas
        const boletinAgrupado = [
            { nombre: 'Formación ciudadana para la transformación social', notas: [] },
            { nombre: 'Personal social y espiritual', notas: [] },
            { nombre: 'Comunicativa cultural y artística', notas: [] },
            { nombre: 'Salud, Ciencias, Tenología y Medio Ambiente', notas: [] },
            { nombre: 'Matemáticas creativas para la vida', notas: [] },
            { nombre: 'Trabajo de Graduación', notas: [] }
        ];

        todasLasNotas.forEach(nota => {
            const nombre = nota.NombreAsignatura;
            if (CATEGORIAS_ASIGNATURAS.formacion.includes(nombre)) {
                boletinAgrupado[0].notas.push(nota);
            } else if (CATEGORIAS_ASIGNATURAS.personal.includes(nombre)) {
                boletinAgrupado[1].notas.push(nota);
            } else if (CATEGORIAS_ASIGNATURAS.comunicativa.includes(nombre)) {
                boletinAgrupado[2].notas.push(nota);
            } else if (CATEGORIAS_ASIGNATURAS.salud.includes(nombre)) {
                boletinAgrupado[3].notas.push(nota);
            } else if (CATEGORIAS_ASIGNATURAS.matematicas.includes(nombre)) {
                boletinAgrupado[4].notas.push(nota);
            } else if (CATEGORIAS_ASIGNATURAS.graduacion.includes(nombre)) {
                boletinAgrupado[5].notas.push(nota);
            }
        });

        // 4. Preparar datos para EJS
        const datosParaEJS = {
            estudiante: estudianteInfo,
            anio: anioActivo.Anio,
            boletinAgrupado: boletinAgrupado,
            promediosValores: promediosValores,
            asistencias: asistencias,
            observaciones: estudianteInfo.OBSERVACION || ''
        };

        // 5. Generar y enviar PDF
        const nombreArchivo = `Boletin-${estudianteInfo.CODIGO_ESTUDIANTE || id_estudiante}.pdf`;
        const templatePath = path.join(__dirname, '../views/estudiantes/documents/plantilla_boletin.ejs');

        const html = await ejs.renderFile(templatePath, datosParaEJS);
        const pdfBuffer = await generarPDFDesdeHTML(html, nombreArchivo); // Reutilizamos tu función

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Error al generar el boletín PDF:', err);
        res.status(500).send('Error al generar el PDF: ' + err.message);
    }
};
