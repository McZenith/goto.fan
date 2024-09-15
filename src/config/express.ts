import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';
import { middlewareDetect } from '../middlewares/deviceMiddleware';
const requestIp = require('request-ip');


export const createExpressApp = (): express.Application => {
    const app = express();

    // Configure CORS to allow Apollo Sandbox
    app.use(cors({
        origin: ['https://studio.apollographql.com', 'http://localhost:4000', "https://gotograph-b2b73620312a.herokuapp.com"],
        credentials: true,
    }));

    // Configure Helmet, but allow Apollo Sandbox
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));

    app.use(express.json());
    app.use(authMiddleware);
    app.use(middlewareDetect);
    app.use(requestIp.mw())
    app.use(rateLimiter);

    return app;
};