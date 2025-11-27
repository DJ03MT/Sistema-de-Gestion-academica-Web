// Redirección después del login exitoso
export const googleCallback = (req, res) => {
    const rol = req.user.rol ? req.user.rol.trim().toUpperCase() : '';
    console.log(`Redirigiendo usuario con rol: ${rol}`);

    switch (rol) {
        case 'SECRETARIA':
            res.redirect('/secretaria');
            break;
        case 'DIRECTOR':
            res.redirect('/admin');
            break;
        case 'PROFESORES':
            res.redirect('/profesores');
            break;
        case 'ESTUDIANTES':
            res.redirect('/estudiantes');
            break;
        case 'ACOMPANATES':
            res.redirect('/acompanantes');
            break;
        default:
            req.logout((err) => {
                res.redirect('/?error=rol_invalido');
            });
    }
};
// Logout
export const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    });
};