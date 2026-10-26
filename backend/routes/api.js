const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authRouter = require('./auth');
const userRouter = require('./user');

const customerRouter = require('./customer');
const buyerRouter = require('./buyer');
const itemRouter = require('./item');
const contractRouter = require('./contract');
const contractProcessItemsRouter = require('./contract-process-items');
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
const pItemRouter = require('./p-item');
const manufactureRouter = require('./manufacture');
const processJobRouter = require('./process-job');
const linkOperationsRouter = require('./link-operations');

const rqProcessRouter = require('./rq-process');
const processPORouter = require('./process-po');
const processRoRouter = require('./process-ro');
const processRfqRouter = require('./process-rfq');
const processReceivedQuotationRouter = require('./process-received-quotation');
const historyRouter = require('./history');
const monitorRouter = require('./monitor');
const backupRouter = require('./backup');

// Simple health check for API
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authentication endpoints
router.use('/auth', authRouter);

// Public OAuth callback for Google Drive redirect
router.get('/backup/auth/callback', (req, res, next) => {
  backupRouter.handle(req, res, next);
});

// Apply JWT authentication middleware to all routes registered below
router.use(authMiddleware);

router.use('/users', userRouter);
router.use('/customers', customerRouter);
router.use('/buyers', buyerRouter);
router.use('/items', itemRouter);
router.use('/contracts', contractRouter);
router.use('/contracts/:contractId/process-items', contractProcessItemsRouter);
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
router.use('/p-items', pItemRouter);
router.use('/trace-items', pItemRouter);
router.use('/manufacture', manufactureRouter);
router.use('/process-jobs', processJobRouter);
router.use('/process-job', processJobRouter);
router.use('/link-operations', linkOperationsRouter);

router.use('/rq-process', rqProcessRouter);
router.use('/process-po', processPORouter);
router.use('/process-ro', processRoRouter);
router.use('/process-rfqs', processRfqRouter);
router.use('/process-rfq', processRfqRouter);
router.use('/process-received-quotations', processReceivedQuotationRouter);
router.use('/process-received-quotation', processReceivedQuotationRouter);
router.use('/history', historyRouter);
router.use('/monitor', monitorRouter);
router.use('/backup', backupRouter);

module.exports = router;
