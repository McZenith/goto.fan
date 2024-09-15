import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/tokenService';
import { IUser, User } from '../models/user';


interface AuthenticatedRequest extends Request {
    user?: IUser;
    token?: string;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split('Bearer ')[1];
        if (token) {
            const decoded = await tokenService.verifyToken(token);
            if (decoded) {
                const user = await User.findById(decoded.userId);
                if (user) {
                    req.user = user;
                    req.token = token; // Store the token for later use (e.g., in logout)
                }
            }
        }
    }
    next();
};