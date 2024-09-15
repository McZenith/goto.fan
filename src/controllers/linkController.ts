import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';

export class LinkController {
    static async redirectShortUrl(req: Request, res: Response): Promise<void> {
        const { shortUrl } = req.params;

        try {
            const url = await analyticsService.findAndUpdateLink(shortUrl);

            if (url) {
                // Save analytics asynchronously
                analyticsService.saveAnalytics(url._id, req).catch(err => {
                    console.error('Error saving analytics:', err);
                });

                res.redirect(url.originalUrl);
            } else {
                res.status(404).send('Short URL not found');
            }
        } catch (error) {
            console.error('Error processing short URL:', error);
            res.status(500).send('An error occurred');
        }
    }
}