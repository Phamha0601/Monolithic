
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { uname, pw, fname } = req.body;

    if (
      typeof uname !== 'string' ||
      typeof pw !== 'string' ||
      typeof fname !== 'string' ||
      !uname.trim() ||
      !pw ||
      !fname.trim()
    ) {
      return res.status(400).json({
        message: 'uname, pw and fname are required',
      });
    }

    if (uname.trim().length > 50 || fname.trim().length > 100) {
      return res.status(400).json({
        message: 'uname or fname is too long',
      });
    }

    if (pw.length < 8 || pw.length > 72) {
      return res.status(400).json({
        message: 'pw must contain 8 to 72 characters',
      });
    }

    const username = uname.trim();

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Username already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(pw, 12);

    // Create default role and membership if missing.
    const result = await prisma.$transaction(async (tx) => {
      let role = await tx.role.findFirst({
        where: { rolename: 'normal' },
      });

      if (!role) {
        role = await tx.role.create({
          data: { rolename: 'normal' },
        });
      }

      let membership = await tx.memberShip.findFirst({
        where: { mname: 'normal' },
      });

      if (!membership) {
        membership = await tx.memberShip.create({
          data: {
            mname: 'normal',
            score: 10,
          },
        });
      }

      return tx.user.create({
        data: {
          username,
          password: hashedPassword,
          fullname: fname.trim(),
          roleid: role.roleid,
          mid: membership.mid,
        },
        select: {
          uid: true,
          username: true,
          fullname: true,
          roleid: true,
          mid: true,
        },
      });
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        uid: result.uid,
        uname: result.username,
        fname: result.fullname,
        roleid: result.roleid,
        mid: result.mid,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        message: 'Username already exists',
      });
    }

    console.error('Register error:', error.message);
    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { uname, pw } = req.body;

    if (
      typeof uname !== 'string' ||
      typeof pw !== 'string' ||
      !uname.trim() ||
      !pw
    ) {
      return res.status(400).json({
        message: 'uname and pw are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { username: uname.trim() },
    });

    if (!user || !(await bcrypt.compare(pw, user.password))) {
      return res.status(401).json({
        message: 'Invalid username or password',
      });
    }

    const token = jwt.sign(
      {
        uid: user.uid,
        roleid: user.roleid,
      },
      jwtSecret,
      {
        expiresIn: jwtExpiresIn,
      }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        uid: user.uid,
        uname: user.username,
        fname: user.fullname,
        roleid: user.roleid,
        mid: user.mid,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

module.exports = router;