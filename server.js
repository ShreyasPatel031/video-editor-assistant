import express from 'express';
import geminiRouter from './server/routes/gemini.js';

const app = express();
app.use(express.json());
app.use('/api/gemini', geminiRouter);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 