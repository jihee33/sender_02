

function isAuthenticated(req, res, next) { // 세션 확인을 위해 추가
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

function isActivated(req, res, next) { // 세션 확인을 위해 추가
    if (req.user.activation !== 1) {
        return res.status(401).send({
            message: 'activation needed'
        });
    }
    next();
}

module.exports.isAuthenticated = isAuthenticated;
module.exports.isSecure = isSecure;
module.exports.isActivated = isActivated;