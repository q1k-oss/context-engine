import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Context Engine API running on http://localhost:${PORT}`);
});
