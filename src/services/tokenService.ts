import jwt from 'jsonwebtoken';
import { BlacklistedToken } from '../models/blackListedToken';
import { appConfig } from '../config';

export const tokenService = {
    generateToken(userId: string): string {
        return jwt.sign({ userId }, appConfig.jwtSecret, { expiresIn: '1d' });
    },

    async verifyToken(token: string): Promise<{ userId: string } | null> {
        try {
            const isBlacklisted = await BlacklistedToken.exists({ token });
            if (isBlacklisted) {
                return null;
            }

            const decoded = jwt.verify(token, appConfig.jwtSecret) as { userId: string };
            return decoded;
        } catch (error) {
            return null;
        }
    },

    async blacklistToken(token: string): Promise<void> {
        await BlacklistedToken.create({ token });
    },
};