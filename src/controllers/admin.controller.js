import { getPool, sql } from '../config/database.js';

// --- VISTAS DEL DASHBOARD ---

// 1. RENDER: El menú principal del Admin
export const renderAdminDashboard = (req, res) => {
    res.render('admin/dashboard', { user: req.user });
};

// --- GESTIÓN DE USUARIOS Y ROLES ---

// 2. RENDER: Página para gestionar Usuarios y Roles
export const renderManageUsuarios = async (req, res) => {
    try {
        const pool = await getPool();
        // Cargamos la lista de TODOS los usuarios y sus roles
        const [usersResult, rolesResult] = await Promise.all([
            pool.request().query(`
                SELECT U.ID_Usuario, U.Email, U.EstaActivo, R.NombreRol
                FROM Usuarios U
                JOIN Roles R ON U.ID_Rol = R.ID_Rol
                ORDER BY U.Email
            `),
            pool.request().query('SELECT * FROM Roles')
        ]);

        res.render('admin/manage-users', {
            user: req.user,
            usuarios: usersResult.recordset,
            roles: rolesResult.recordset
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
};

// 3. UPDATE: Actualizar el rol o estado de un usuario
export const updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { ID_Rol, EstaActivo } = req.body;

    try {
        const pool = await getPool();
        await pool.request()
            .input('ID_Usuario', sql.Int, id)
            .input('ID_Rol', sql.Int, ID_Rol)
            .input('EstaActivo', sql.Bit, EstaActivo)
            .query('UPDATE Usuarios SET ID_Rol = @ID_Rol, EstaActivo = @EstaActivo WHERE ID_Usuario = @ID_Usuario');
        
        res.redirect('/admin/usuarios');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/usuarios');
    }
};


// --- GESTIÓN DE CURSOS (Asignar Profesor a Clase) ---
// 4. RENDER: Página para gestionar Cursos (MODIFICADO)
export const renderManageCursos = async (req, res) => {
    // Leemos los mensajes de éxito o error de la URL
    const { error, success } = req.query;
    let errorMessage = null;
    let successMessage = null;

    if (error === 'duplicate') {
        errorMessage = 'Error: ¡Esta asignación de curso ya existe!';
    }
    if (error === 'delete_constraint') {
        errorMessage = 'Error: No se puede eliminar. El curso ya tiene estudiantes inscritos.';
    }
    if (error === 'server') {
        errorMessage = 'Error: Ocurrió un problema en el servidor.';
    }
    if (success === 'true') {
        successMessage = '¡Curso asignado con éxito!';
    }
    if (success === 'deleted') {
        successMessage = 'Asignación de curso eliminada.';
    }

    try {
        const pool = await getPool();
        
        const anioActivoResult = await pool.request()
            .query('SELECT TOP 1 ID_Anio_Lectivo, Anio FROM Anios_Lectivos WHERE EstaActivo = 1');
        
        if (anioActivoResult.recordset.length === 0) {
            // Este es un error crítico, lo manejamos primero
            return res.status(500).send('Error Crítico: No hay ningún año lectivo activo. Configure uno primero en el panel de "Año Lectivo".');
        }
        const anioActivo = anioActivoResult.recordset[0];

        const [cursos, profes, asignaturas, grados, secciones] = await Promise.all([
            pool.request().input('ID_Anio_Lectivo', anioActivo.ID_Anio_Lectivo).query(`
                SELECT C.ID_Curso, P.PRIMER_NOMBRE, P.PRIMER_APELLIDO, A.NombreAsignatura, G.NombreGrado, S.NombreSeccion
                FROM Cursos C
                JOIN Profesores P ON C.ID_Profesor = P.ID_PROFESOR
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                WHERE C.ID_Anio_Lectivo = @ID_Anio_Lectivo
                ORDER BY G.ID_Grado, S.NombreSeccion, A.NombreAsignatura
            `),
            pool.request().query('SELECT ID_PROFESOR, PRIMER_NOMBRE, PRIMER_APELLIDO FROM Profesores ORDER BY PRIMER_APELLIDO'),
            pool.request().query('SELECT * FROM Asignaturas ORDER BY NombreAsignatura'),
            pool.request().query('SELECT * FROM Grados ORDER BY ID_Grado'),
            pool.request().query('SELECT * FROM Secciones ORDER BY NombreSeccion')
        ]);

        res.render('admin/manage-cursos', {
            user: req.user,
            cursos: cursos.recordset,
            profesores: profes.recordset,
            asignaturas: asignaturas.recordset,
            grados: grados.recordset,
            secciones: secciones.recordset,
            anioActivo: anioActivo,
            // Pasamos los mensajes a la vista
            errorMessage: errorMessage,
            successMessage: successMessage
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?error=load_cursos');
    }
};

// 5. CREATE: Crear un nuevo curso (MODIFICADO)
export const crearCurso = async (req, res) => {
    const { ID_Profesor, ID_Asignatura, ID_Grado, ID_Seccion, ID_Anio_Lectivo } = req.body;
    try {
        const pool = await getPool();
        await pool.request()
            .input('ID_Profesor', sql.Int, ID_Profesor)
            .input('ID_Asignatura', sql.Int, ID_Asignatura)
            .input('ID_Grado', sql.Int, ID_Grado)
            .input('ID_Seccion', sql.Int, ID_Seccion)
            .input('ID_Anio_Lectivo', sql.Int, ID_Anio_Lectivo)
            .query(`
                INSERT INTO Cursos 
                (ID_Profesor, ID_Asignatura, ID_Grado, ID_Seccion, ID_Anio_Lectivo)
                VALUES (@ID_Profesor, @ID_Asignatura, @ID_Grado, @ID_Seccion, @ID_Anio_Lectivo)
            `);
        // Redirige con mensaje de éxito
        res.redirect('/admin/cursos?success=true');
    } catch (err) {
        console.error(err);
        // Error 2627 y 2601 son violaciones de UNIQUE constraint
        if (err.number === 2627 || err.number === 2601) {
            res.redirect('/admin/cursos?error=duplicate');
        } else {
            res.redirect('/admin/cursos?error=server');
        }
    }
};

// 6. DELETE: Eliminar una asignación de curso (MODIFICADO)
export const eliminarCurso = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.request()
            .input('ID_Curso', sql.Int, id)
            .query('DELETE FROM Cursos WHERE ID_Curso = @ID_Curso');
        // Redirige con mensaje de éxito
        res.redirect('/admin/cursos?success=deleted');
    } catch (err) {
        console.error(err);
        // Error 547 es FAILED (Foreign Key constraint)
        // Esto pasa si intentas borrar un curso que ya tiene estudiantes
        if (err.number === 547) {
            res.redirect('/admin/cursos?error=delete_constraint');
        } else {
            res.redirect('/admin/cursos?error=server');
        }
    }
};


// --- GESTIÓN DE AÑOS LECTIVOS ---

// 7. RENDER: Página para gestionar Años Lectivos
export const renderManageAnios = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Anios_Lectivos ORDER BY Anio DESC');
        res.render('admin/manage-anios', {
            user: req.user,
            anios: result.recordset
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
};

// 8. CREATE: Crear un nuevo Año Lectivo
export const crearAnioLectivo = async (req, res) => {
    const { Anio, FechaInicio, FechaFin } = req.body;
    try {
        const pool = await getPool();
        await pool.request()
            .input('Anio', sql.Int, Anio)
            .input('FechaInicio', sql.Date, FechaInicio)
            .input('FechaFin', sql.Date, FechaFin)
            .query('INSERT INTO Anios_Lectivos (Anio, FechaInicio, FechaFin, EstaActivo) VALUES (@Anio, @FechaInicio, @FechaFin, 0)');
        res.redirect('/admin/anios');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/anios');
    }
};

// 9. UPDATE: Activar un Año (Cerrar el anterior)
export const activarAnioLectivo = async (req, res) => {
    const { id } = req.params;
    const pool = await getPool();
    const transaction = pool.transaction();
    try {
        await transaction.begin();
        // 1. Desactivar todos los años
        await transaction.request().query('UPDATE Anios_Lectivos SET EstaActivo = 0');
        // 2. Activar solo el seleccionado
        await transaction.request()
            .input('ID_Anio_Lectivo', sql.Int, id)
            .query('UPDATE Anios_Lectivos SET EstaActivo = 1 WHERE ID_Anio_Lectivo = @ID_Anio_Lectivo');
        
        await transaction.commit();
        res.redirect('/admin/anios');
    } catch (err) {
        await transaction.rollback();
        console.error(err);
        res.redirect('/admin/anios');
    }
};

// =================================================================
// RENDER: Página para gestionar Valores Globales
// =================================================================
export const renderManageGlobales = async (req, res) => {
    try {
        const pool = await getPool();
        const [valoresResult, calendarioResult] = await Promise.all([
            pool.request().query('SELECT * FROM ValoresDelMes ORDER BY NumeroMes'),
            pool.request().query("SELECT Valor FROM Configuracion WHERE Clave = 'CALENDARIO_LINK'")
        ]);

        const calendarioLink = (calendarioResult.recordset.length > 0)
            ? calendarioResult.recordset[0].Valor
            : 'https://docs.google.com/';

        res.render('admin/manage-globales', {
            user: req.user,
            valores: valoresResult.recordset,
            calendarioLink: calendarioLink,
            success: req.query.success || null
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
};

// =================================================================
// UPDATE: Actualizar un Valor del Mes
// =================================================================
export const updateValorDelMes = async (req, res) => {
    const { id } = req.params;
    const { NombreValor } = req.body;
    try {
        const pool = await getPool();
        await pool.request()
            .input('ID_ValorMes', sql.Int, id)
            .input('NombreValor', sql.VarChar, NombreValor)
            .query('UPDATE ValoresDelMes SET NombreValor = @NombreValor WHERE ID_ValorMes = @ID_ValorMes');

        res.redirect('/admin/globales?success=Valor actualizado');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/globales');
    }
};

// =================================================================
// UPDATE: Actualizar el Link del Calendario
// =================================================================
export const updateCalendarioLink = async (req, res) => {
    const { calendario_link } = req.body;
    try {
        const pool = await getPool();
        await pool.request()
            .input('Valor', sql.VarChar, calendario_link)
            .query("UPDATE Configuracion SET Valor = @Valor WHERE Clave = 'CALENDARIO_LINK'");

        res.redirect('/admin/globales?success=Enlace actualizado');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/globales');
    }
};

// =================================================================
// RENDER: Página para gestionar Criterios
// =================================================================
export const renderManageCriterios = async (req, res) => {
    try {
        const pool = await getPool();
        
        // Obtenemos el año activo actual
        const anioActivoID = (await pool.request().query('SELECT ID_Anio_Lectivo FROM Anios_Lectivos WHERE EstaActivo = 1')).recordset[0].ID_Anio_Lectivo;

        // Consulta de todos los cursos del año activo
        const cursosResult = await pool.request()
            .input('ID_Anio_Lectivo', sql.Int, anioActivoID)
            .query(`
                SELECT 
                    C.ID_Curso, G.NombreGrado, S.NombreSeccion, A.NombreAsignatura, P.PRIMER_APELLIDO,
                    (SELECT COUNT(*) FROM Criterios_Evaluacion CE WHERE CE.ID_Curso = C.ID_Curso) AS TotalCriterios
                FROM Cursos C
                JOIN Grados G ON C.ID_Grado = G.ID_Grado
                JOIN Secciones S ON C.ID_Seccion = S.ID_Seccion
                JOIN Asignaturas A ON C.ID_Asignatura = A.ID_Asignatura
                JOIN Profesores P ON C.ID_Profesor = P.ID_PROFESOR
                WHERE C.ID_Anio_Lectivo = @ID_Anio_Lectivo
                ORDER BY G.NombreGrado, S.NombreSeccion, A.NombreAsignatura
            `);

        // Separamos las listas
        const cursosConCriterios = cursosResult.recordset.filter(c => c.TotalCriterios > 0);
        const cursosSinCriterios = cursosResult.recordset.filter(c => c.TotalCriterios === 0);

        res.render('admin/manage-criterios', {
            user: req.user,
            cursosConCriterios,
            cursosSinCriterios
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
};

// =================================================================
// CREATE: Crear en lote los 20 criterios para 4 cortes
// =================================================================
export const bulkCrearCriterios = async (req, res) => {
    const { ID_Curso } = req.body;
    
    // Nombres de los criterios (4 cortes * 5 sub-criterios = 20)
    const criteriosBase = [];
    for (let i = 1; i <= 4; i++) {
        criteriosBase.push(`C${i}-A1`, `C${i}-A2`, `C${i}-A3`, `C${i}-Auto`, `C${i}-Coev`);
    }

    let transaction;
    try {
        const pool = await getPool();
        transaction = pool.transaction();
        await transaction.begin();

        for (const nombre of criteriosBase) {
            await transaction.request()
                .input('ID_Curso', sql.Int, ID_Curso)
                .input('NombreCriterio', sql.VarChar, nombre)
                .input('Valor_Maximo', sql.Int, 100) // Todos valen 100
                .query(`
                    INSERT INTO Criterios_Evaluacion (ID_Curso, NombreCriterio, Valor_Maximo)
                    VALUES (@ID_Curso, @NombreCriterio, @Valor_Maximo)
                `);
        }
        
        await transaction.commit();
        res.redirect('/admin/criterios');
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("Error en bulk-create de criterios:", err);
        res.redirect('/admin/criterios?error=' + encodeURIComponent(err.message));
    }
};
// --- GESTIÓN DE ACOMPAÑANTES (¡Falta!) ---
// (Esta la podemos añadir después, es igual a la de Cursos pero con la tabla Acompanante_Asignacion)