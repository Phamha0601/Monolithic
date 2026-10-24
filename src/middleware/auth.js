
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const prisma = require('../lib/prisma');

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Vui long dang nhap'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token khong hop le hoac da het han'
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          message: 'Vui long dang nhap'
        });
      }

      const user = await prisma.user.findUnique({
        where: { uid: req.user.uid },
        select: {
          role: {
            select: {
              rolename: true
            }
          }
        }
      });

      if (!user || !user.role) {
        return res.status(403).json({
          message: 'Khong tim thay vai tro nguoi dung'
        });
      }

      const currentRole = user.role.rolename.toLowerCase();
      const permittedRoles = allowedRoles.map(role =>
        role.toLowerCase()
      );

      if (!permittedRoles.includes(currentRole)) {
        return res.status(403).json({
          message: 'Ban khong co quyen thuc hien thao tac nay'
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);

      return res.status(500).json({
        message: 'Loi kiem tra quyen truy cap'
      });
    }
  };
}

module.exports = auth;
module.exports.authorizeRoles = authorizeRoles;