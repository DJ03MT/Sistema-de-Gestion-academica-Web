import sql from 'mssql';

//Connexion a BD
const dbConfig = {
    server: process.env.AZURE_SQL_SERVER,
    port: 1433,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    database: process.env.AZURE_SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};


let pool = null;

export async function getPool() {
    if (pool) {
        return pool;
    }

    try {

        pool = await sql.connect(dbConfig);

        // Verifica la conexión
        await pool.request().query('SELECT 1 as connected');

        console.log('✅ Connected to Azure SQL successfully!');
        return pool;

    } catch (err) {
        console.error('❌ Error creating connection pool:', err.message);
        pool = null;
        throw err;
    }
}


export { sql };
