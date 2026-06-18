require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db');
const { authenticateToken } = require('./middleware/auth');

// Import modular route handlers
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const buyersRouter = require('./routes/buyers');
const itemsRouter = require('./routes/items');
const rfqsRouter = require('./routes/rfqs');
const quotationsRouter = require('./routes/quotations');
const receivedQuotationsRouter = require('./routes/received_quotations');
const purchaseOrdersRouter = require('./routes/purchase_orders');
const arcRouter = require('./routes/arc');
const releaseOrdersRouter = require('./routes/release_orders');
const deliveryNotesRouter = require('./routes/delivery_notes');
const invoicesRouter = require('./routes/invoices');
const unitsRouter = require('./routes/units');
const gstRatesRouter = require('./routes/gst_rates');
const grnsRouter = require('./routes/grns');
const paymentsRouter = require('./routes/payments');
const tradesRouter = require('./routes/trades');
const statusRouter = require('./routes/status');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL connection and tables
initializeDatabase();

// app.get('/', (req, res) => {
//   res.send('DeskManager API is online and connected to PostgreSQL!');
// });

// ============================================================================
// MOUNT API ROUTERS
// ============================================================================

// Public authentication endpoints (Login, Verify Session)
app.use('/api/auth', authRouter);

// Protected endpoints (All CRUD paths require active session validation)
app.use('/api/customers', authenticateToken, customersRouter);
app.use('/api/buyers', authenticateToken, buyersRouter);
app.use('/api/items', authenticateToken, itemsRouter);
app.use('/api/rfqs', authenticateToken, rfqsRouter);
app.use('/api/quotations', authenticateToken, quotationsRouter);
app.use('/api/received-quotations', authenticateToken, receivedQuotationsRouter);
app.use('/api/purchase-orders', authenticateToken, purchaseOrdersRouter);
app.use('/api/arc', authenticateToken, arcRouter);
app.use('/api/release-orders', authenticateToken, releaseOrdersRouter);
app.use('/api/delivery-notes', authenticateToken, deliveryNotesRouter);
app.use('/api/invoices', authenticateToken, invoicesRouter);
app.use('/api/units', authenticateToken, unitsRouter);
app.use('/api/gst-rates', authenticateToken, gstRatesRouter);
app.use('/api/grns', authenticateToken, grnsRouter);
app.use('/api/payments', authenticateToken, paymentsRouter);
app.use('/api/trades', authenticateToken, tradesRouter);
app.use('/api/status', authenticateToken, statusRouter);

// Serve static frontend
const frontendDistPath = path.join(__dirname, '../frontend/desk-manager/dist');
app.use(express.static(frontendDistPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle React routing, return all requests to React app
app.get(/^.*$/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is successfully running on port ${port}`);
});