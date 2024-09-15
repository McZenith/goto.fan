import { Link, ILink } from '../models/link';
import { nanoid } from 'nanoid';
import { UserInputError } from 'apollo-server-express';

export const linkService = {
    async createLink(originalUrl: string, userId: string): Promise<ILink> {
        // First, check if the user already has a link for this URL
        const existingLink = await Link.findOne({ originalUrl, userId });

        if (existingLink) {
            // If a link already exists, return it
            return existingLink;
        }

        // If no existing link, create a new one
        const shortUrl = nanoid(8);
        const link = new Link({ originalUrl, shortUrl, userId });
        await link.save();
        return link;
    },

    async getLinksByUserId(userId: string): Promise<ILink[]> {
        return Link.find({ userId });
    },

    async updateLink(id: string, originalUrl: string, userId: string): Promise<ILink> {
        const link = await Link.findOneAndUpdate(
            { _id: id, userId },
            { $set: { originalUrl } },
            { new: true, runValidators: true }
        );
        if (!link) {
            throw new UserInputError('Link not found or unauthorized');
        }
        return link;
    },

    async deleteLink(id: string, userId: string): Promise<boolean> {
        const result = await Link.deleteOne({ _id: id, userId });
        return result.deletedCount === 1;
    },
};
