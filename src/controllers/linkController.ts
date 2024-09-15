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
                    // Render an HTML page with JavaScript to attempt deep linking
                    res.send(`
                <html>
                <head>
                    <title>Redirecting...</title>
                    <script>
                        function redirect() {
                            var appUrl = '${appUrl}';
                            var fallbackUrl = '${fallbackUrl}';
                            var start = new Date().getTime();
                            
                            setTimeout(function() {
                                if (new Date().getTime() - start < 2000) {
                                    window.location = fallbackUrl;
                                }
                            }, 1500);

                            window.location = appUrl;
                        }
                    </script>
                </head>
                <body onload="redirect()">
                    <h2>Redirecting you to the app...</h2>
                    <p>If you are not redirected, <a href="${fallbackUrl}">click here</a>.</p>
                </body>
                </html>
            `);
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
        const path = parsedUrl.pathname;

        let appUrl = originalUrl;
        const fallbackUrl = originalUrl;

        switch (hostname) {
            // Social Media
            case 'www.youtube.com':
            case 'youtube.com':
            case 'youtu.be':
                const videoId = parsedUrl.searchParams.get('v') || path.slice(1);
                appUrl = `vnd.youtube://${videoId}`;
                break;
            case 'www.twitter.com':
            case 'twitter.com':
                if (path.includes('/status/')) {
                    appUrl = `twitter://status${path}`;
                } else {
                    appUrl = `twitter://user?screen_name=${path.slice(1)}`;
                }
                break;
            case 'www.instagram.com':
            case 'instagram.com':
                const igPath = path.split('/');
                if (['p', 'tv', 'reel'].includes(igPath[1])) {
                    appUrl = `instagram://media?id=${igPath[2]}`;
                } else {
                    appUrl = `instagram://user?username=${igPath[1]}`;
                }
                break;
            case 'www.facebook.com':
            case 'facebook.com':
                appUrl = `fb://facewebmodal/f?href=${encodeURIComponent(originalUrl)}`;
                break;
            case 'www.tiktok.com':
            case 'tiktok.com':
                const tkPath = path.split('/');
                if (tkPath[1] === 'video') {
                    appUrl = `tiktok://video/${tkPath[2]}`;
                } else if (tkPath[1].startsWith('@')) {
                    appUrl = `tiktok://user/@${tkPath[1].slice(1)}`;
                } else {
                    appUrl = 'tiktok://';
                }
                break;
            case 'www.linkedin.com':
            case 'linkedin.com':
                appUrl = `linkedin://${path}`;
                break;
            case 'www.pinterest.com':
            case 'pinterest.com':
                appUrl = `pinterest://${path}`;
                break;
            case 'www.snapchat.com':
            case 'snapchat.com':
                if (path.startsWith('/add/')) {
                    appUrl = `snapchat://add/${path.split('/')[2]}`;
                } else {
                    appUrl = 'snapchat://';
                }
                break;

            // Content Creation and Streaming
            case 'www.twitch.tv':
            case 'twitch.tv':
                appUrl = `twitch://stream/${path.slice(1)}`;
                break;
            case 'medium.com':
                appUrl = `medium://${path}`;
                break;
            case 'www.spotify.com':
            case 'open.spotify.com':
                appUrl = originalUrl.replace('https://', 'spotify:');
                break;
            case 'www.soundcloud.com':
            case 'soundcloud.com':
                appUrl = `soundcloud://${path}`;
                break;

            // E-commerce
            case 'www.amazon.com':
            case 'amazon.com':
                const asin = path.split('/dp/')[1]?.split('/')[0];
                if (asin) {
                    appUrl = `com.amazon.mobile.shopping://www.amazon.com/dp/${asin}`;
                } else {
                    appUrl = 'com.amazon.mobile.shopping://www.amazon.com/';
                }
                break;
            case 'www.etsy.com':
            case 'etsy.com':
                appUrl = `etsy://${path}`;
                break;
            case 'www.ebay.com':
            case 'ebay.com':
                appUrl = `ebay://${path}`;
                break;

            // Ride-sharing and Food Delivery
            case 'www.uber.com':
            case 'uber.com':
                appUrl = 'uber://';
                break;
            case 'www.ubereats.com':
            case 'ubereats.com':
                appUrl = 'ubereats://';
                break;
            case 'bolt.eu':
                appUrl = 'bolt://';
                break;
            case 'www.lyft.com':
            case 'lyft.com':
                appUrl = 'lyft://';
                break;
            case 'www.doordash.com':
            case 'doordash.com':
                appUrl = 'doordash://';
                break;

            // Productivity and Communication
            case 'www.dropbox.com':
            case 'dropbox.com':
                appUrl = `dbx${path}`;
                break;
            case 'www.evernote.com':
            case 'evernote.com':
                appUrl = `evernote://${path}`;
                break;
            case 'trello.com':
                appUrl = `trello://${path}`;
                break;
            case 'slack.com':
                appUrl = `slack://${path}`;
                break;
            case 'zoom.us':
                const meetingId = parsedUrl.searchParams.get('meetingId');
                if (meetingId) {
                    appUrl = `zoomus://zoom.us/join?confno=${meetingId}`;
                } else {
                    appUrl = 'zoomus://zoom.us/join';
                }
                break;

            // Travel and Local
            case 'www.airbnb.com':
            case 'airbnb.com':
                appUrl = `airbnb://${path}`;
                break;
            case 'www.yelp.com':
            case 'yelp.com':
                appUrl = `yelp://${path}`;
                break;
            case 'www.tripadvisor.com':
            case 'tripadvisor.com':
                appUrl = `tripadvisor://${path}`;
                break;

            // Finance
            case 'www.paypal.com':
            case 'paypal.com':
                appUrl = `paypal://${path}`;
                break;
            case 'venmo.com':
                appUrl = `venmo://`;
                break;

            // Other
            case 'www.wikipedia.org':
            case 'wikipedia.org':
                const lang = path.split('/')[1];
                const title = path.split('/')[2];
                appUrl = `wikipedia://${lang}/article/${title}`;
                break;

            default:
                // If no specific app URL is found, use the original URL for both
                appUrl = originalUrl;
        }

        return { appUrl, fallbackUrl };
    }
}