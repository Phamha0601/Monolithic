
const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Tat ca API Shipment deu can dang nhap
router.use(auth);

// GET: Xem thong tin giao hang cua don hang
// Nguoi dung chi xem duoc don hang cua minh
router.get('/order/:oid', async (req, res) => {
  try {
    const oid = Number(req.params.oid);

    if (!Number.isSafeInteger(oid) || oid <= 0) {
      return res.status(400).json({
        message: 'Ma don hang khong hop le'
      });
    }

    const order = await prisma.order.findUnique({
      where: { oid },
      select: {
        oid: true,
        uid: true,
        shipments: true
      }
    });

    if (!order) {
      return res.status(404).json({
        message: 'Khong tim thay don hang'
      });
    }

    // Kiem tra quyen admin tu database
    const user = await prisma.user.findUnique({
      where: { uid: req.user.uid },
      select: {
        role: {
          select: { rolename: true }
        }
      }
    });

    const isAdmin =
      user?.role?.rolename?.toLowerCase() === 'admin';

    if (!isAdmin && order.uid !== req.user.uid) {
      return res.status(403).json({
        message: 'Ban khong co quyen xem don hang nay'
      });
    }

    return res.status(200).json({
      oid: order.oid,
      shipments: order.shipments
    });
  } catch (error) {
    console.error('Get shipment error:', error);

    return res.status(500).json({
      message: 'Loi khi lay thong tin giao hang'
    });
  }
});

// POST: Tao thong tin giao hang - chi admin
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const oid = Number(req.body.oid);
    const status = req.body.status;

    if (!Number.isSafeInteger(oid) || oid <= 0) {
      return res.status(400).json({
        message: 'Ma don hang khong hop le'
      });
    }

    if (
      typeof status !== 'string' ||
      status.trim().length === 0 ||
      status.trim().length > 50
    ) {
      return res.status(400).json({
        message: 'Trang thai phai co 1-50 ky tu'
      });
    }

    const order = await prisma.order.findUnique({
      where: { oid },
      select: { oid: true }
    });

    if (!order) {
      return res.status(404).json({
        message: 'Khong tim thay don hang'
      });
    }

    const shipment = await prisma.shipment.create({
      data: {
        oid,
        status: status.trim()
      }
    });

    return res.status(201).json({
      message: 'Tao thong tin giao hang thanh cong',
      shipment
    });
  } catch (error) {
    console.error('Create shipment error:', error);

    return res.status(500).json({
      message: 'Loi khi tao thong tin giao hang'
    });
  }
});

// PUT: Cap nhat trang thai giao hang - chi admin
router.put(
  '/:shipid/status',
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const shipid = Number(req.params.shipid);
      const status = req.body.status;

      if (!Number.isSafeInteger(shipid) || shipid <= 0) {
        return res.status(400).json({
          message: 'Ma giao hang khong hop le'
        });
      }

      if (
        typeof status !== 'string' ||
        status.trim().length === 0 ||
        status.trim().length > 50
      ) {
        return res.status(400).json({
          message: 'Trang thai phai co 1-50 ky tu'
        });
      }

      const existing = await prisma.shipment.findUnique({
        where: { shipid }
      });

      if (!existing) {
        return res.status(404).json({
          message: 'Khong tim thay thong tin giao hang'
        });
      }

      const shipment = await prisma.shipment.update({
        where: { shipid },
        data: { status: status.trim() }
      });

      return res.status(200).json({
        message: 'Cap nhat trang thai thanh cong',
        shipment
      });
    } catch (error) {
      console.error('Update shipment error:', error);

      return res.status(500).json({
        message: 'Loi khi cap nhat trang thai giao hang'
      });
    }
  }
);

module.exports = router;