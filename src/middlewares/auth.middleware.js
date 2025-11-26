function handleUnauthenticated(req, res) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(401).json({ success: false, message: 'Sesión expirada. Por favor, recargue la página.' });
    }
    return res.redirect('/?error=not_logged_in');
}

function handleUnauthorized(req, res) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para esta acción.' });
    }
    return res.redirect('/?error=unauthorized');
}

export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    return handleUnauthenticated(req, res);
};

export const isSecretaria = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return handleUnauthenticated(req, res);
    }
    const userRol = req.user.rol ? req.user.rol.trim().toUpperCase() : '';
    if (userRol === 'SECRETARIA' || userRol === 'DIRECTOR') {
        return next();
    }
    return handleUnauthorized(req, res);
};

export const isProfesor = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return handleUnauthenticated(req, res);
    }
    const userRol = req.user.rol ? req.user.rol.trim().toUpperCase() : '';
    if (userRol === 'PROFESORES') {
        return next();
    }
    return handleUnauthorized(req, res);
};

export const isEstudiante = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return handleUnauthenticated(req, res);
    }
    const userRol = req.user.rol ? req.user.rol.trim().toUpperCase() : '';
    if (userRol === 'ESTUDIANTES') {
        return next();
    }
    return handleUnauthorized(req, res);
};

export const isDirector = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return handleUnauthenticated(req, res);
    }
    const userRol = req.user.rol ? req.user.rol.trim().toUpperCase() : '';
    if (userRol === 'DIRECTOR') {
        return next();
    }
    return handleUnauthorized(req, res);
};