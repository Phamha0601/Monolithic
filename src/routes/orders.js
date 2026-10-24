
const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// All order endpoints require JWT.
router.use(auth);

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'items must be a non-empty array',
      });
    }

    // Validate items and reject duplicate product IDs.
    const seen = new Set();

    for (const item of items) {
      if (
        !item ||
        !Number.isSafeInteger(item.pid) ||
        item.pid <= 0 ||
        !Number.isSafeInteger(item.qty) ||
        item.qty <= 0
      ) {
        return res.status(400).json({
          message: 'Each item requires a positive integer pid and qty',
        });
      }

      if (seen.has(item.pid)) {
        return res.status(400).json({
          message: 'Do not repeat a pid in items',
        });
      }

      seen.add(item.pid);
    }

    const result = await prisma.$transaction(async (tx) => {
      const pids = items.map((item) => item.pid);

      const products = await tx.product.findMany({
        where: { pid: { in: pids } },
      });

      if (products.length !== items.length) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const productMap = new Map(
        products.map((product) => [product.pid, product])
      );

      // Check stock before creating the order.
      for (const item of items) {
        const product = productMap.get(item.pid);

        if (product.quantity < item.qty) {
          throw new Error('INSUFFICIENT_STOCK');
        }
      }

      const order = await tx.order.create({
        data: {
          uid: req.user.uid,
        },
      });

      const details = [];
      let total = new Prisma.Decimal(0);

      for (const item of items) {
        const product = productMap.get(item.pid);

        // Atomic stock check and decrement.
        const updated = await tx.product.updateMany({
          where: {
            pid: item.pid,
            quantity: { gte: item.qty },
          },
          data: {
            quantity: { decrement: item.qty },
          },
        });

        if (updated.count !== 1) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        const unitPrice = new Prisma.Decimal(product.price);

        details.push({
          oid: order.oid,
          pid: product.pid,
          qty: item.qty,
          unit_price: unitPrice,
        });

        total = total.plus(unitPrice.mul(item.qty));
      }

      await tx.orderDetail.createMany({
        data: details,
      });

      return {
        order,
        details: details.map((item) => ({
          pid: item.pid,
          qty: item.qty,
          unit_price: item.unit_price.toString(),
        })),
        total: total.toFixed(2),
      };
    });

    return res.status(201).json({
      message: 'Order created',
      oid: result.order.oid,
      createat: result.order.createat,
      items: result.details,
      total: result.total,
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        message: 'One or more products were not found',
      });
    }

    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        message: 'Insufficient stock for one or more products',
      });
    }

    console.error('Create order error:', error.message);

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { uid: req.user.uid },
      orderBy: { createat: 'desc' },
      include: {
        orderDetails: {
          include: {
            product: {
              select: {
                pid: true,
                pname: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Get orders error:', error.message);

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

// GET /api/orders/:oid
router.get('/:oid', async (req, res) => {
  try {
    const oid = Number(req.params.oid);

    if (!Number.isSafeInteger(oid) || oid <= 0) {
      return res.status(400).json({ message: 'Invalid oid' });
    }

    const order = await prisma.order.findFirst({
      where: {
        oid,
        uid: req.user.uid,
      },
      include: {
        orderDetails: {
          include: {
            product: {
              select: {
                pid: true,
                pname: true,
              },
            },
          },
        },
        shipments: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Get order error:', error.message);

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});

module.exports = router;