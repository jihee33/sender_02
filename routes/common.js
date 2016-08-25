

function isAuthenticated(req, res, next) {
    if (!req.user) {
        return res.status(401).send({
            message: 'Login Required'
        });
    }
    next();
}

function isSecure (req, res, next) {// HTTPS 사용 위해 추가
    if(!req.secure) {
        return res.status(426).send({
            message: 'Upgrade Needed'
        });
    }
    next();
}

module.exports.isAuthenticated = isAuthenticated;
module.exports.isSecure = isSecure;// HTTPS 사용 위해 추가