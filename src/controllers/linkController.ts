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

    private static parseUrl(url: string): { hostname: string; pathname: string; searchParams: URLSearchParams } {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            // Fallback for environments where URL is not available
            const match = url.match(/^(https?:\/\/)?([^\/]+)(\/[^?]*)?(.*)?$/i);
            if (!match) {
                throw new Error('Invalid URL');
            }
            const [, , hostname, pathname = '', search = ''] = match;
            return {
                hostname,
                pathname,
                searchParams: new URLSearchParams(search.slice(1))
            };
        }
        return parsedUrl;
    }

    private static getAppAndFallbackUrls(originalUrl: string): { appUrl: string, fallbackUrl: string } {
        let parsedUrl: { hostname: string; pathname: string; searchParams: URLSearchParams };
        try {
            parsedUrl = this.parseUrl(originalUrl);
        } catch (error) {
            console.error('Invalid URL:', originalUrl);
            return { appUrl: originalUrl, fallbackUrl: originalUrl };
        }

        const { hostname, pathname } = parsedUrl;

        let appUrl = originalUrl;
        const fallbackUrl = originalUrl;

        switch (hostname) {
            // Social Media
            case 'www.youtube.com':
            case 'youtube.com':
            case 'youtu.be':
                const videoId = parsedUrl.searchParams.get('v') || pathname.slice(1);
                appUrl = `vnd.youtube://${videoId}`;
                break;
            case 'www.twitter.com':
            case 'twitter.com':
                if (pathname.includes('/status/')) {
                    appUrl = `twitter://status${pathname}`;
                } else {
                    appUrl = `twitter://user?screen_name=${pathname.slice(1)}`;
                }
                break;
            case 'www.instagram.com':
            case 'instagram.com':
                const igPath = pathname.split('/');
                if (['p', 'tv', 'reel'].includes(igPath[1])) {
                    appUrl = `instagram://media?id=${igPath[2]}`;
                } else {
                    appUrl = `instagram://user?username=${igPath[1]}`;
                }
                break;
            case 'www.tiktok.com':
            case 'tiktok.com':
            case 'vm.tiktok.com': {
                const tkPath = pathname.split('/');
                if (tkPath[1] === 'video' || tkPath[1] === 'v') {
                    // Handle both long and short video URLs
                    const videoId = tkPath[2] || parsedUrl.searchParams.get('video_id');
                    if (videoId) {
                        appUrl = originalUrl;
                    }
                } else if (tkPath[1] === 't') {
                    // Handle trending hashtag
                    const hashtag = tkPath[2];
                    appUrl = `tiktok://challenge?name=${hashtag}`;
                } else if (tkPath[1] === 'music') {
                    const musicId = tkPath[2];
                    appUrl = `tiktok://music/detail/${musicId}`;
                } else if (tkPath[1] === 'tag') {
                    const tag = tkPath[2];
                    appUrl = `tiktok://tag/detail/${tag}`;
                } else if (tkPath[1] === 'effects') {
                    const effectId = tkPath[2];
                    appUrl = `tiktok://effect/detail/${effectId}`;
                } else if (tkPath[1].startsWith('@')) {
                    const username = tkPath[1].slice(1);
                    appUrl = `tiktok://user/@${username}`;
                } else if (hostname === 'vm.tiktok.com') {
                    appUrl = `tiktok://video/${tkPath[1]}`;
                } else {
                    // Default to opening TikTok app
                    appUrl = 'tiktok://';
                }
                break;
            }
            // Facebook URLs
            case 'www.facebook.com':
            case 'facebook.com':
            case 'm.facebook.com': {
                const fbPath = pathname.split('/');
                if (fbPath[1] === 'profile.php') {
                    const userId = parsedUrl.searchParams.get('id');
                    if (userId) {
                        appUrl = `fb://profile/${userId}`;
                    }
                } else if (fbPath[1] === 'groups') {
                    const groupId = fbPath[2];
                    appUrl = `fb://group/${groupId}`;
                } else if (fbPath[1] === 'events') {
                    const eventId = fbPath[2];
                    appUrl = `fb://event/${eventId}`;
                } else if (fbPath[1] === 'marketplace') {
                    appUrl = 'fb://marketplace';
                } else if (fbPath[1] === 'watch') {
                    appUrl = originalUrl;
                } else if (fbPath[1] === 'photo.php') {
                    const photoId = parsedUrl.searchParams.get('fbid');
                    if (photoId) {
                        appUrl = `fb://photo/${photoId}`;
                    }
                } else if (fbPath[1] === 'video.php') {
                    const videoId = parsedUrl.searchParams.get('v');
                    if (videoId) {
                        appUrl = originalUrl;
                    }
                } else if (fbPath[2] === 'posts') {
                    const postId = fbPath[3];
                    appUrl = `fb://post/${postId}`;
                } else if (fbPath[1] && fbPath[1] !== '') {
                    appUrl = `fb://profile/${fbPath[1]}`;
                } else {
                    // Default to opening Facebook app
                    appUrl = 'fb://feed';
                }
                break;
            }
            case 'www.linkedin.com':
            case 'linkedin.com':
                appUrl = `linkedin://${pathname}`;
                break;
            case 'www.pinterest.com':
            case 'pinterest.com':
                appUrl = `pinterest://${pathname}`;
                break;
            case 'www.snapchat.com':
            case 'snapchat.com':
                if (pathname.startsWith('/add/')) {
                    appUrl = `snapchat://add/${pathname.split('/')[2]}`;
                } else {
                    appUrl = 'snapchat://';
                }
                break;

            // Content Creation and Streaming
            case 'www.twitch.tv':
            case 'twitch.tv':
                appUrl = `twitch://stream/${pathname.slice(1)}`;
                break;
            case 'medium.com':
                appUrl = `medium://${pathname}`;
                break;
            case 'www.spotify.com':
            case 'open.spotify.com':
                appUrl = originalUrl.replace('https://', 'spotify:');
                break;
            case 'www.soundcloud.com':
            case 'soundcloud.com':
                appUrl = `soundcloud://${pathname}`;
                break;

            // E-commerce
            case 'www.amazon.com':
            case 'amazon.com':
                const asin = pathname.split('/dp/')[1]?.split('/')[0];
                if (asin) {
                    appUrl = `com.amazon.mobile.shopping://www.amazon.com/dp/${asin}`;
                } else {
                    appUrl = 'com.amazon.mobile.shopping://www.amazon.com/';
                }
                break;
            case 'www.etsy.com':
            case 'etsy.com':
                appUrl = `etsy://${pathname}`;
                break;
            case 'www.ebay.com':
            case 'ebay.com':
                appUrl = `ebay://${pathname}`;
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
                appUrl = `dbx${pathname}`;
                break;
            case 'www.evernote.com':
            case 'evernote.com':
                appUrl = `evernote://${pathname}`;
                break;
            case 'trello.com':
                appUrl = `trello://${pathname}`;
                break;
            case 'slack.com':
                appUrl = `slack://${pathname}`;
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
                appUrl = `airbnb://${pathname}`;
                break;
            case 'www.yelp.com':
            case 'yelp.com':
                appUrl = `yelp://${pathname}`;
                break;
            case 'www.tripadvisor.com':
            case 'tripadvisor.com':
                appUrl = `tripadvisor://${pathname}`;
                break;

            // Finance
            case 'www.paypal.com':
            case 'paypal.com':
                appUrl = `paypal://${pathname}`;
                break;
            case 'venmo.com':
                appUrl = `venmo://`;
                break;

            // Other
            case 'www.wikipedia.org':
            case 'wikipedia.org':
                const lang = pathname.split('/')[1];
                const title = pathname.split('/')[2];
                appUrl = `wikipedia://${lang}/article/${title}`;
                break;

            default:
                // If no specific app URL is found, use the original URL for both
                appUrl = originalUrl;
        }

        return { appUrl, fallbackUrl };
    }
}