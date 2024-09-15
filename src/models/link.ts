import mongoose, { Document, Schema } from 'mongoose';

export interface ILink extends Document {
    originalUrl: string;
    shortUrl: string;
    userId: mongoose.Types.ObjectId;
    clicks: number;
    createdAt: Date;
}

const LinkSchema: Schema = new Schema({
    originalUrl: { type: String, required: true },
    shortUrl: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clicks: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

export const Link = mongoose.model<ILink>('Link', LinkSchema);