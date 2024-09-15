import { expressMiddleware } from '@apollo/server/express4';
import { createExpressApp } from './config/express';
import { createApolloServer, createApolloContext } from './config/apollo';
import { connectDB } from './config/database';
import { logger } from './utils/logger';
import { appConfig } from './config';
import { LinkController } from './controllers/linkController';

async function startServer() {
    try {
        await connectDB();

        const app = createExpressApp();
        const apolloServer = createApolloServer();

        await apolloServer.start();

        app.use(
            '/graphql',
            expressMiddleware(apolloServer, {
                context: createApolloContext
            })
        );

        app.get('/:shortUrl', LinkController.redirectShortUrl);

        app.listen(appConfig.port, () => {
            logger.info(`Server running on http://localhost:${appConfig.port}/graphql`);
            logger.info('Apollo Sandbox available at the above URL');
        });
    } catch (error) {
        logger.error('Error starting server:', error);
        process.exit(1);
    }
}

startServer();