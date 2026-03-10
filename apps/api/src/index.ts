import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { app } from './app.js';

export { app } from './app.js';
export { chatRouter } from './routes/chat.routes.js';
export { filesRouter } from './routes/files.routes.js';
export { graphRouter } from './routes/graph.routes.js';
export { errorHandler, AppError } from './middleware/error-handler.js';

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Context Engine API running on http://localhost:${PORT}`);
});
