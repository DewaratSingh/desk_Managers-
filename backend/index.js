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
app.use(express.static(path.join(__dirname, '../deskManager/dist')));

app.use('/api', apiRouter);

// All other GET requests not handled before will return the React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../deskManager/dist/index.html'));
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
