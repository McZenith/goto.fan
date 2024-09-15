import { IResolvers } from '@graphql-tools/utils';
import { UserInputError, AuthenticationError } from 'apollo-server-express';
import { userService } from '../services/userService';
import { linkService } from '../services/linkService';
import { analyticsService } from '../services/analyticsService';
import { validateRegisterInput, validateLoginInput, validateLinkInput } from '../utils/validators';
import { Context } from '../types';

export const resolvers: IResolvers = {
    Query: {
        me: async (_, __, context: Context) => {
            if (!context.user) throw new AuthenticationError('Not authenticated');
            return context.user;
        },
        getUserLinks: async (_, __, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            return linkService.getLinksByUserId(user.id);
        },
        getLinkAnalytics: async (_, { linkId }, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            return analyticsService.getLinkAnalytics(linkId);
        },
    },
    Mutation: {
        register: async (_, args) => {
            const { errors, valid } = validateRegisterInput(args);
            if (!valid) throw new UserInputError('Invalid input', { errors });
            return userService.register(args);
        },
        login: async (_, args) => {
            const { errors, valid } = validateLoginInput(args);
            if (!valid) throw new UserInputError('Invalid input', { errors });
            return userService.login(args);
        },
        logout: async (_, __, { user, token }: Context) => {
            if (!user || !token) throw new AuthenticationError('Not authenticated');
            return userService.logout(user.id, token);
        },
        createLink: async (_, { originalUrl }, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            const { errors, valid } = validateLinkInput({ originalUrl });
            if (!valid) throw new UserInputError('Invalid input', { errors });
            return linkService.createLink(originalUrl, user.id);
        },
        updateLink: async (_, { id, originalUrl }, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            if (originalUrl) {
                const { errors, valid } = validateLinkInput({ originalUrl });
                if (!valid) throw new UserInputError('Invalid input', { errors });
            }
            return linkService.updateLink(id, originalUrl, user.id);
        },
        deleteLink: async (_, { id }, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            return linkService.deleteLink(id, user.id);
        },
        updateProfile: async (_, args, { user }: Context) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            return userService.updateProfile(user.id, args);
        },
    },
};