import { createHavenServer } from '../server/WebSocketServer.js';

// Vercel serves exported HTTP servers as Fluid Compute functions, including
// upgrade requests. Do not call listen(): Vercel owns the listening socket.
const haven = createHavenServer({ serveStatic: false, trustProxy: true });
export default haven.server;
