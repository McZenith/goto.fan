import { IUser } from "../models/user";

export interface Context {
    user?: IUser;
    token?: string;
}

export interface AuthenticatedRequest extends Express.Request {
    user?: IUser;
    token?: string;
}

export interface AnalyticItem {
    name: string;
    count: number;
}

export interface LinkAnalytics {
    clicks: number;
    referrers: AnalyticItem[];
    countries: AnalyticItem[];
    browsers: AnalyticItem[];
    operatingSystems: AnalyticItem[];
    deviceTypes: AnalyticItem[];
}

export interface AggregationResult {
    _id: null;
    totalClicks: number;
    referrers: string[];
    countries: string[];
    browsers: { name: string; version: string }[];
    operatingSystems: { name: string; version: string }[];
    deviceTypes: string[];
}
