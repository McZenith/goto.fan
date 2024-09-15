import jwt from 'jsonwebtoken';
import { BlacklistedToken } from '../models/blackListedToken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const tokenService = {
    generateToken(userId: string): string {
        return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' });
    },

    async verifyToken(token: string): Promise<{ userId: string } | null> {
        try {
            const isBlacklisted = await BlacklistedToken.exists({ token });
            if (isBlacklisted) {
                return null;
            }

            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            return decoded;
        } catch (error) {
            return null;
        }
    },

    async blacklistToken(token: string): Promise<void> {
        await BlacklistedToken.create({ token });
    },
};