require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const { authenticateToken } = require('./middleware/auth');

// Import modular route handlers
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const buyersRouter = require('./routes/buyers');
const itemsRouter = require('./routes/items');
const rfqsRouter = require('./routes/rfqs');
const quotationsRouter = require('./routes/quotations');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL connection and tables
initializeDatabase();

app.get('/', (req, res) => {
  res.send('DeskManager API is online and connected to PostgreSQL!');
});

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

app.listen(port, () => {
  console.log(`Server is successfully running on port ${port}`);
});