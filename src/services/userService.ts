import bcrypt from 'bcryptjs';
import { UserInputError } from 'apollo-server-express';
import { tokenService } from './tokenService';
import { User } from '../models/user';

export const userService = {
    async register({ username, email, password }: { username: string; email: string; password: string }) {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            throw new UserInputError('Username or email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        const token = tokenService.generateToken(user.id);
        return { token, user };
    },

    async login({ email, password }: { email: string; password: string }) {
        const user = await User.findOne({ email });
        if (!user) {
            throw new UserInputError('User not found');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new UserInputError('Invalid password');
        }

        const token = tokenService.generateToken(user.id);
        return { token, user };
    },

    async logout(userId: string, token: string): Promise<boolean> {
        const user = await User.findById(userId);
        if (!user) {
            throw new UserInputError('User not found');
        }

        // Update last logout timestamp
        user.lastLogout = new Date();
        await user.save();

        // Blacklist the token
        await tokenService.blacklistToken(token);

        return true;
    },

    async updateProfile(userId: string, { username, email }: { username?: string; email?: string }) {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { username, email } },
            { new: true, runValidators: true }
        );
        if (!user) {
            throw new UserInputError('User not found');
        }
        return user;
    },
};