const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_pharma';

module.exports = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return [
    (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, role }

        if (roles.length && !roles.includes(decoded.role)) {
          return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
        }

        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
  ];
};
