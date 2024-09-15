import mongoose, { Document, Schema } from 'mongoose';

export interface IBlacklistedToken extends Document {
    token: string;
    blacklistedAt: Date;
}

const BlacklistedTokenSchema: Schema = new Schema({
    token: { type: String, required: true, unique: true },
    blacklistedAt: { type: Date, default: Date.now },
});

// Index to automatically remove expired tokens
BlacklistedTokenSchema.index({ blacklistedAt: 1 }, { expireAfterSeconds: 86400 }); // 24 hours

export const BlacklistedToken = mongoose.model<IBlacklistedToken>('BlacklistedToken', BlacklistedTokenSchema);