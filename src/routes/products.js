
const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { pid: 'asc' },
    });

    return res.status(200).json({ products });
  } catch (error) {
    console.error('Get products error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/products/:pid
router.get('/:pid', async (req, res) => {
  try {
    const pid = Number(req.params.pid);

    if (!Number.isInteger(pid) || pid <= 0) {
      return res.status(400).json({ message: 'Invalid pid' });
    }

    const product = await prisma.product.findUnique({
      where: { pid },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(200).json({ product });
  } catch (error) {
    console.error('Get product error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/products
router.post('/', auth, async (req, res) => {
  try {
    const { pname, price, quantity } = req.body;

    if (
      typeof pname !== 'string' ||
      !pname.trim() ||
      pname.trim().length > 100 ||
      price === undefined ||
      price === null ||
      price === '' ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 0
    ) {
      return res.status(400).json({
        message: 'pname, valid price and non-negative integer quantity are required',
      });
    }

    const product = await prisma.product.create({
      data: {
        pname: pname.trim(),
        price: String(price),
        quantity: Number(quantity),
      },
    });

    return res.status(201).json({
      message: 'Product created',
      product,
    });
  } catch (error) {
    console.error('Create product error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/products/:pid
router.put('/:pid', auth, async (req, res) => {
  try {
    const pid = Number(req.params.pid);

    if (!Number.isInteger(pid) || pid <= 0) {
      return res.status(400).json({ message: 'Invalid pid' });
    }

    const { pname, price, quantity } = req.body;
    const data = {};

    if (pname !== undefined) {
      if (
        typeof pname !== 'string' ||
        !pname.trim() ||
        pname.trim().length > 100
      ) {
        return res.status(400).json({ message: 'Invalid pname' });
      }
      data.pname = pname.trim();
    }

    if (price !== undefined) {
      if (
        price === null ||
        price === '' ||
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
      ) {
        return res.status(400).json({ message: 'Invalid price' });
      }
      data.price = String(price);
    }

    if (quantity !== undefined) {
      if (
        !Number.isInteger(Number(quantity)) ||
        Number(quantity) < 0
      ) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
      data.quantity = Number(quantity);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: 'Provide at least one field to update',
      });
    }

    const existing = await prisma.product.findUnique({
      where: { pid },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = await prisma.product.update({
      where: { pid },
      data,
    });

    return res.status(200).json({
      message: 'Product updated',
      product,
    });
  } catch (error) {
    console.error('Update product error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/products/:pid
router.delete('/:pid', auth, async (req, res) => {
  try {
    const pid = Number(req.params.pid);

    if (!Number.isInteger(pid) || pid <= 0) {
      return res.status(400).json({ message: 'Invalid pid' });
    }

    const existing = await prisma.product.findUnique({
      where: { pid },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await prisma.product.delete({
      where: { pid },
    });

    return res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    // Product may be referenced by OrderDetail.
    if (error.code === 'P2003') {
      return res.status(409).json({
        message: 'Cannot delete product referenced by an order',
      });
    }

    console.error('Delete product error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;