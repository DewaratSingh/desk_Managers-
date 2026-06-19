const express = require('express');
const router = express.Router();

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

// Simple health check for API
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

module.exports = router;
