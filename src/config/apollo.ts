import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { typeDefs } from '../schemas/typeDefs';
import { resolvers } from '../schemas/resolvers';
import { Context } from '../types';
import { logger } from '../utils/logger';
import { IUser } from '../models/user';

interface AuthenticatedRequest extends Express.Request {
    user?: IUser;
}

export const createApolloServer = (): ApolloServer => {
    return new ApolloServer<Context>({
        typeDefs,
        resolvers,
        introspection: true, // Enable introspection for Sandbox
        plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        formatError: (error) => {
            logger.error('GraphQL Error:', error);
            return error;
        },
    });
};

export const createApolloContext = async ({ req }: ExpressContextFunctionArgument): Promise<Context> => {
    return {
        user: (req as AuthenticatedRequest).user,
    };
};