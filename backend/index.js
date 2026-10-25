require('dotenv').config();
const express = require('express');
const apiRouter = require('./routes/api');
const { initializeDatabase } = require('./db');
const { runBackup } = require('./backup/backup');


const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

const path = require('path');

app.use(cors());
app.use(express.json());

// Serve the static files from the React app build
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRouter);

// Return 404 for unmatched API requests so they don't fall through to index.html
app.all(/^\/api(\/.*)?$/, (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// All other GET requests not handled before will return the React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
}); 

app.listen(port, async () => {
	console.log(`Backend server running on http://localhost:${port}`);
	try {
		await initializeDatabase();
		console.log('Database initialized');
		
		// Run backup immediately on startup
		console.log('Server started: Triggering immediate startup database backup...');
		try {
			await runBackup();
		} catch (err) {
			console.error('Startup database backup error:', err.message);
		}
		

	} catch (err) {
		console.error('Database initialization error:', err.message);
	}
});

module.exports = app;
