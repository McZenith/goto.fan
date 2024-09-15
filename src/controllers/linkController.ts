import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';

export class LinkController {
    static async redirectShortUrl(req: Request, res: Response): Promise<void> {
        const { shortUrl } = req.params;
        const userAgent = req.headers['user-agent'] || '';

        try {
            const url = await analyticsService.findAndUpdateLink(shortUrl);

            if (url) {
                // Save analytics asynchronously
                analyticsService.saveAnalytics(url._id, req).catch(err => {
                    console.error('Error saving analytics:', err);
                });

                // Check if it's a mobile device
                const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

                if (isMobile) {
                    const { appUrl, fallbackUrl } = LinkController.getAppAndFallbackUrls(url.originalUrl);

                    res.redirect(appUrl);
                } else {
                // For non-mobile devices, redirect as usual
                    res.redirect(url.originalUrl);
                }
            } else {
                res.status(404).send('Short URL not found');
            }
        } catch (error) {
            console.error('Error processing short URL:', error);
            res.status(500).send('An error occurred');
        }
    }

    private static getAppAndFallbackUrls(originalUrl: string): { appUrl: string, fallbackUrl: string } {
        const parsedUrl = new URL(originalUrl);
        const hostname = parsedUrl.hostname;

        let appUrl = originalUrl;
        let fallbackUrl = originalUrl;

        switch (hostname) {
            case 'www.youtube.com':
            case 'youtube.com':
            case 'youtu.be':
                const videoId = parsedUrl.searchParams.get('v') || parsedUrl.pathname.slice(1);
                appUrl = `vnd.youtube://${videoId}`;
                break;
            case 'www.twitter.com':
            case 'twitter.com':
                appUrl = `twitter://status${parsedUrl.pathname}`;
                break;
            case 'www.instagram.com':
            case 'instagram.com':
                appUrl = `instagram://media?id=${parsedUrl.pathname.split('/')[2]}`;
                break;
            case 'www.facebook.com':
            case 'facebook.com':
                appUrl = `fb://facewebmodal/f?href=${encodeURIComponent(originalUrl)}`;
                break;
            case 'www.tiktok.com':
            case 'tiktok.com':
                const tiktokId = parsedUrl.pathname.split('/')[3];
                appUrl = `tiktok://video/${tiktokId}`;
                break;
            // Add more cases for other apps as needed
            default:
                // If no specific app URL is found, use the original URL for both
                appUrl = originalUrl;
                fallbackUrl = originalUrl;
        }

        return { appUrl, fallbackUrl };
    }
}