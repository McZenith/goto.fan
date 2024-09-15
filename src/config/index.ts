import dotenv from 'dotenv';

dotenv.config();

export const appConfig = {
    port: process.env.PORT || 4000,
    dbName: process.env.DB_NAME,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    redisUrl: process.env.REDIS_URL,
    jwtExpirationInSeconds: process.env.JWT_EXPIRATION_IN_SECONDS || 86400,
    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT || 11512,
    redisPassword: process.env.REDIS_PASSWORD,
    testIP: process.env.DEFAULT_TEST_IP
};
