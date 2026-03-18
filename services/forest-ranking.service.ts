/**
 * Forest Ranking Service
 * Parses forest app XLSX ranking sheets and manages storage/retrieval
 *
 * Expected sheet format:
 *   - Either 3 separate columns: Rank | Name | Time
 *   - Or single column with comma-separated values: "1,Chitra S,15h 30m"
 * Time format examples: "15h 30m", "08h 18m", "5h 06m"
 */

import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import ForestRanking, { IForestRankingEntry } from '@/models/ForestRanking';

export interface ParsedForestEntry {
  rank: number;
  name: string;
  totalDuration: number;
  totalDurationFormatted: string;
}

export class ForestRankingService {
  /**
   * Parse a forest ranking XLSX buffer.
   * Handles both multi-column (Rank | Name | Time) and
   * single-column comma-separated formats.
   */
  static parseXLSX(buffer: Buffer): ParsedForestEntry[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Try multi-column format first
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      raw: false,
      defval: '',
    });

    if (rows.length > 0) {
      const firstRow = rows[0];
      const keys = Object.keys(firstRow).filter(k => k.trim() !== '');

      // Single-column comma-separated format must be checked first —
      // otherwise the header "Rank,Name,Time" would match all three regex
      // patterns and all keys would point to the same column.
      if (keys.length === 1) {
        return this.parseSingleColumn(rows, keys[0]);
      }

      // Separate-column format: use exact (anchored) patterns so a header
      // like "Rank,Name,Time" is not mistakenly matched.
      const rankKey = keys.find(k => /^rank$/i.test(k.trim()));
      const nameKey = keys.find(k => /^name$/i.test(k.trim()));
      const timeKey = keys.find(k => /^(time|hours?|duration)$/i.test(k.trim()));

      if (rankKey && nameKey && timeKey) {
        return this.parseMultiColumn(rows, rankKey, nameKey, timeKey);
      }

      // Fallback: treat first three distinct columns as rank/name/time
      if (keys.length >= 3) {
        return this.parseMultiColumn(rows, keys[0], keys[1], keys[2]);
      }
    }

    // Last resort: read raw cell values and split by comma
    return this.parseRawSheet(sheet);
  }

  private static parseMultiColumn(
    rows: Record<string, any>[],
    rankKey: string,
    nameKey: string,
    timeKey: string
  ): ParsedForestEntry[] {
    const entries: ParsedForestEntry[] = [];

    for (const row of rows) {
      const rankRaw = String(row[rankKey] || '').trim();
      const name = String(row[nameKey] || '').trim();
      const timeRaw = String(row[timeKey] || '').trim();

      if (!name || !timeRaw) continue;

      const rank = parseInt(rankRaw);
      if (isNaN(rank) || rank < 1) continue;

      const totalDuration = this.parseDuration(timeRaw);
      if (totalDuration < 0) continue;

      entries.push({
        rank,
        name,
        totalDuration,
        totalDurationFormatted: this.formatDuration(totalDuration),
      });
    }

    return entries.sort((a, b) => a.rank - b.rank);
  }

  private static parseSingleColumn(
    rows: Record<string, any>[],
    key: string
  ): ParsedForestEntry[] {
    const entries: ParsedForestEntry[] = [];

    for (const row of rows) {
      const cell = String(row[key] || '').trim();
      if (!cell) continue;

      // Split by comma but be careful: names may not contain commas
      // Format: "1,Chitra S 100,15h 30m"
      const parts = cell.split(',').map(p => p.trim());
      if (parts.length < 3) continue;

      const rank = parseInt(parts[0]);
      if (isNaN(rank) || rank < 1) continue;

      // Name is everything between first and last comma part
      const timeRaw = parts[parts.length - 1];
      const name = parts.slice(1, parts.length - 1).join(',').trim();

      if (!name || !timeRaw) continue;

      const totalDuration = this.parseDuration(timeRaw);
      if (totalDuration < 0) continue;

      entries.push({
        rank,
        name,
        totalDuration,
        totalDurationFormatted: this.formatDuration(totalDuration),
      });
    }

    return entries.sort((a, b) => a.rank - b.rank);
  }

  private static parseRawSheet(sheet: XLSX.WorkSheet): ParsedForestEntry[] {
    const entries: ParsedForestEntry[] = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    let startRow = range.s.r;

    // Skip header row if first cell contains non-numeric text
    const firstCell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c })];
    if (firstCell && isNaN(parseInt(String(firstCell.v)))) {
      startRow++;
    }

    for (let row = startRow; row <= range.e.r; row++) {
      const colA = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
      const colB = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
      const colC = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];

      if (colA && colB && colC) {
        const rank = parseInt(String(colA.v));
        const name = String(colB.v).trim();
        const timeRaw = String(colC.v).trim();

        if (!isNaN(rank) && rank >= 1 && name) {
          const totalDuration = this.parseDuration(timeRaw);
          if (totalDuration >= 0) {
            entries.push({
              rank,
              name,
              totalDuration,
              totalDurationFormatted: this.formatDuration(totalDuration),
            });
          }
        }
      } else if (colA) {
        // Single-cell row with comma-separated data
        const cell = String(colA.v || '').trim();
        const parts = cell.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const rank = parseInt(parts[0]);
          const timeRaw = parts[parts.length - 1];
          const name = parts.slice(1, parts.length - 1).join(',').trim();
          if (!isNaN(rank) && rank >= 1 && name) {
            const totalDuration = this.parseDuration(timeRaw);
            if (totalDuration >= 0) {
              entries.push({
                rank,
                name,
                totalDuration,
                totalDurationFormatted: this.formatDuration(totalDuration),
              });
            }
          }
        }
      }
    }

    return entries.sort((a, b) => a.rank - b.rank);
  }

  /**
   * Parse time strings like "15h 30m", "08h 18m", "5h 6m", "30m", "1h"
   */
  static parseDuration(timeStr: string): number {
    if (!timeStr) return -1;

    let totalMinutes = 0;
    let matched = false;

    const hourMatch = timeStr.match(/(\d+)\s*h/i);
    if (hourMatch) {
      totalMinutes += parseInt(hourMatch[1]) * 60;
      matched = true;
    }

    const minMatch = timeStr.match(/(\d+)\s*m(?!s)/i);
    if (minMatch) {
      totalMinutes += parseInt(minMatch[1]);
      matched = true;
    }

    return matched ? totalMinutes : -1;
  }

  static formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /**
   * Upload and store forest rankings for a given date
   */
  static async uploadRankings(
    buffer: Buffer,
    date: Date,
    fileName: string
  ): Promise<{ entries: ParsedForestEntry[]; saved: IForestRankingEntry[] }> {
    await connectDB();

    const entries = this.parseXLSX(buffer);

    if (entries.length === 0) {
      throw new Error(
        'No valid entries found. Ensure the sheet has Rank, Name, and Time columns.'
      );
    }

    const rankingEntries: IForestRankingEntry[] = entries.map(e => ({
      rank: e.rank,
      name: e.name,
      totalDuration: e.totalDuration,
      totalDurationFormatted: e.totalDurationFormatted,
    }));

    // Upsert by date (normalize to midnight UTC)
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    await ForestRanking.findOneAndUpdate(
      { date: normalizedDate },
      {
        date: normalizedDate,
        rankings: rankingEntries,
        totalParticipants: rankingEntries.length,
        uploadedAt: new Date(),
        fileName,
      },
      { upsert: true, new: true }
    );

    return { entries, saved: rankingEntries };
  }

  /**
   * Get forest rankings for a specific date
   */
  static async getRankingsByDate(date: Date) {
    await connectDB();

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return ForestRanking.findOne({ date: normalizedDate });
  }

  /**
   * List available forest ranking dates (most recent first)
   */
  static async listDates(limit = 30) {
    await connectDB();

    const records = await ForestRanking.find({}, { date: 1, totalParticipants: 1, rankings: { $slice: 1 } })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return records.map(r => ({
      date: (r.date as Date).toISOString().split('T')[0],
      totalParticipants: r.totalParticipants,
      topRanking: r.rankings?.[0]
        ? { name: r.rankings[0].name, totalDurationFormatted: r.rankings[0].totalDurationFormatted }
        : null,
    }));
  }

  /**
   * Delete forest rankings for a specific date
   */
  static async deleteByDate(date: Date) {
    await connectDB();

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    return ForestRanking.findOneAndDelete({ date: normalizedDate });
  }
}
