import { Link } from '../models/link';
import { UserInputError } from 'apollo-server-express';
import { Analytics } from '../models/analytics';
import geoip from 'geoip-lite';
import mongoose from 'mongoose';
import { AggregationResult, AnalyticItem, LinkAnalytics } from '../types';
import { getClientIp } from '../utils/ipClient';


export const analyticsService = {
    async getLinkAnalytics(linkId: string): Promise<LinkAnalytics> {
        const link = await Link.findById(linkId);
        if (!link) {
            throw new UserInputError('Link not found');
        }

        const analyticsData = await Analytics.aggregate([
            { $match: { linkId: new mongoose.Types.ObjectId(linkId) } },
            {
                $group: {
                    _id: null,
                    totalClicks: { $sum: 1 },
                    referrers: { $addToSet: '$referer' },
                    countries: { $addToSet: '$country' },
                    browsers: { $addToSet: { name: '$browser', version: '$browserVersion' } },
                    operatingSystems: { $addToSet: { name: '$os', version: '$osVersion' } },
                    deviceTypes: { $addToSet: '$deviceType' }
                }
            }
        ]) as AggregationResult[];

        const result = analyticsData[0] || {
            totalClicks: 0,
            referrers: [],
            countries: [],
            browsers: [],
            operatingSystems: [],
            deviceTypes: []
        };

        const aggregateAndSort = (arr: string[]): AnalyticItem[] => {
            const counts = arr.reduce((acc, curr) => {
                const key = curr || 'Unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            return Object.entries(counts)
                .map(([name, count]): AnalyticItem => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        };

        const aggregateBrowsersAndOS = (arr: { name: string; version: string }[]): AnalyticItem[] => {
            const counts = arr.reduce((acc, curr) => {
                const key = `${curr.name || 'Unknown'} ${curr.version || ''}`.trim();
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            return Object.entries(counts)
                .map(([name, count]): AnalyticItem => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        };

        return {
            clicks: result.totalClicks,
            referrers: aggregateAndSort(result.referrers),
            countries: aggregateAndSort(result.countries),
            browsers: aggregateBrowsersAndOS(result.browsers),
            operatingSystems: aggregateBrowsersAndOS(result.operatingSystems),
            deviceTypes: aggregateAndSort(result.deviceTypes)
        };
    },

    async findAndUpdateLink(shortUrl: string): Promise<any> {
        return Link.findOneAndUpdate(
            {
                $or: [
                    { shortUrl },
                    { customShortUrl: shortUrl },
                    { expiresAt: { $gt: new Date() } },
                    { expiresAt: null }
                ],
            },
            { $inc: { clicks: 1 } },
            { new: true }
        );
    }
    ,
    async saveAnalytics(linkId: string, req: any): Promise<void> {
        try {
            // Get the real IP address
            const ip = getClientIp(req);

            const userAgent = req.headers['user-agent'] || 'Unknown';
            const referer = req.headers.referer || req.headers.referrer || 'Direct';

            // Get geolocation data
            const geoData = geoip.lookup(ip);

            // Determine device type more accurately
            let device = req.device.device.type || "Unknown";

            const analyticsData = {
                linkId,
                clickDate: new Date(),
                ip: ip,
                userAgent: userAgent,
                deviceType: device,
                browser: req.device.client.name || 'Other',
                browserVersion: req.device.client.version || 'Unknown',
                os: req.device.os.name || 'Other',
                osVersion: req.device.os.version || 'Unknown',
                deviceVendor: req.device.device.brand || 'Unknown',
                deviceModel: req.device.device.model || 'Unknown',
                referer: referer,
                country: geoData?.country || 'Unknown',
                countryCode: geoData?.country || 'Unknown',
                region: geoData?.region || 'Unknown',
                city: geoData?.city || 'Unknown',
                latitude: geoData?.ll[0] || null,
                longitude: geoData?.ll[1] || null,
                timezone: geoData?.timezone || 'Unknown',
                eu: geoData?.eu === '1' ? 'Yes' : 'No',
                metro: geoData?.metro || null,
                area: geoData?.area || null,
            };

            await Analytics.create(analyticsData);
        } catch (err) {
            console.error('Error saving analytics data:', err);
            // You might want to throw this error or handle it according to your error handling strategy
        }
    }
};

