import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { appConfig } from './index';

export const connectDB = async (): Promise<void> => {
    try {
        mongoose.connect(appConfig.mongoUri as string);
        logger.info(`Connected to MongoDB Name: ${appConfig.dbName}`);
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};