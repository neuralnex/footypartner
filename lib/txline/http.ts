import axios from 'axios';
import http from 'http';
import https from 'https';

export const txlineHttp = axios.create({
  timeout: 30_000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 64 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 64 }),
});
