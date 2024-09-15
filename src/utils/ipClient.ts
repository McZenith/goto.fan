import { Request } from 'express';
import { appConfig } from '../config';

export function getClientIp(req: Request): string {
    // For testing: allow overriding IP with a custom header
    const testIp = req.headers['x-test-ip'] as string;
    if (testIp) {
        return testIp;
    }

    const forwardedFor = (req.headers['x-forwarded-for'] || '') as string;
    const realIp = req.headers['x-real-ip'] as string;

    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }

    if (realIp) {
        return realIp;
    }

    const ip = req.ip || req.connection.remoteAddress;

    // Check if it's a loopback address
    if (ip === '::1' || ip === '127.0.0.1') {
        return appConfig.testIP || 'Unknown';
    }

    return ip || 'Unknown';
}