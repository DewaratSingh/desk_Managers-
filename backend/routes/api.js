const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authRouter = require('./auth');
const userRouter = require('./user');

const customerRouter = require('./customer');
const buyerRouter = require('./buyer');
const itemRouter = require('./item');
const arcRouter = require('./arc');
const gstRouter = require('./gst');
const rfqRouter = require('./rfq');
const tradeRouter = require('./trade');
const quotationRouter = require('./quotation');
const receivedQuotationRouter = require('./received-quotation');
const purchaseOrderRouter = require('./purchase-order');
const releaseOrderRouter = require('./release-order');
const deliveryNoteRouter = require('./delivery-note');
const invoiceRouter = require('./invoice');
const statusRouter = require('./status');
const inventoryRouter = require('./inventory');
const grnRouter = require('./grn');
const paymentRouter = require('./payment');

// Simple health check for API
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authentication endpoints
router.use('/auth', authRouter);

// Apply JWT authentication middleware to all routes registered below
router.use(authMiddleware);

router.use('/users', userRouter);
router.use('/customers', customerRouter);
router.use('/buyers', buyerRouter);
router.use('/items', itemRouter);
router.use('/arc-items', arcRouter);
router.use('/gst-rates', gstRouter);
router.use('/rfqs', rfqRouter);
router.use('/trades', tradeRouter);
router.use('/quotations', quotationRouter);
router.use('/received-quotations', receivedQuotationRouter);
router.use('/purchase-orders', purchaseOrderRouter);
router.use('/release-orders', releaseOrderRouter);
router.use('/delivery-notes', deliveryNoteRouter);
router.use('/invoices', invoiceRouter);
router.use('/statuses', statusRouter);
router.use('/inventory', inventoryRouter);
router.use('/grns', grnRouter);
router.use('/payments', paymentRouter);

module.exports = router;
