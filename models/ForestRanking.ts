/**
 * Forest Ranking Model
 * Stores forest app rankings uploaded by admin
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IForestRankingEntry {
  rank: number;
  name: string;
  totalDuration: number; // in minutes
  totalDurationFormatted: string; // e.g. "15h 30m"
}

export interface IForestRanking extends Document {
  date: Date;
  rankings: IForestRankingEntry[];
  totalParticipants: number;
  uploadedAt: Date;
  fileName: string;
}

const ForestRankingEntrySchema = new Schema<IForestRankingEntry>(
  {
    rank: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    totalDuration: { type: Number, required: true, min: 0 },
    totalDurationFormatted: { type: String, required: true },
  },
  { _id: false }
);

const ForestRankingSchema = new Schema<IForestRanking>(
  {
    date: { type: Date, required: true, unique: true, index: true },
    rankings: { type: [ForestRankingEntrySchema], required: true },
    totalParticipants: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
    fileName: { type: String, required: true },
  },
  { timestamps: true }
);

ForestRankingSchema.index({ date: -1 });

const ForestRanking: Model<IForestRanking> =
  mongoose.models.ForestRanking ||
  mongoose.model<IForestRanking>('ForestRanking', ForestRankingSchema);

export default ForestRanking;
