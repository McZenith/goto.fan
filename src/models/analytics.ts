import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalytics extends Document {
    linkId: mongoose.Types.ObjectId;
    clickDate: Date;
    ip: string;
    userAgent: string;
    deviceType: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    deviceVendor: string;
    deviceModel: string;
    referer: string;
    country: string;
    countryCode: string;
    region: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    timezone: string;
    eu: string;
    metro: number | null;
    area: number | null;
}

const AnalyticsSchema: Schema = new Schema({
    linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
    clickDate: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
    deviceType: String,
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    deviceVendor: String,
    deviceModel: String,
    referer: String,
    country: String,
    countryCode: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String,
    eu: String,
    metro: Number,
    area: Number,
});

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);