import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RANKING } from '@/config/constants';

/**
 * Format name to Title Case (capitalize first letter of each word)
 */
function formatNameToTitleCase(name: string): string {
  if (!name) return name;
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

interface RankingData {
  rank: number;
  fullName: string;
  email?: string;
  totalDuration?: number;
  totalDurationFormatted: string;
  sessionCount: number;
}

interface Statistics {
  totalParticipants: number;
  topDuration: number;
  averageDuration: number;
  medianDuration: number;
}

interface PDFOptions {
  date: string;
  rankings: RankingData[];
  statistics: Statistics;
  includeAllDurations?: boolean; // If true, include all durations (admin view). Default false - filters out > 17 hours
}

export const generateRankingsPDF = ({ 
  date, 
  rankings, 
  statistics,
  includeAllDurations = false 
}: PDFOptions) => {
  let filteredRankings: RankingData[];
  if (!includeAllDurations) {
    filteredRankings = rankings
      .filter(r => !r.totalDuration || r.totalDuration <= RANKING.MAX_DISPLAYABLE_DURATION)
      .map((r, index) => {
        const plainRanking = (r as any).toObject ? (r as any).toObject() : r;
        return {
          rank: index + 1,
          fullName: formatNameToTitleCase(plainRanking.fullName),
          email: plainRanking.email,
          totalDuration: plainRanking.totalDuration,
          totalDurationFormatted: plainRanking.totalDurationFormatted,
          sessionCount: plainRanking.sessionCount,
        };
      });
  } else {
    filteredRankings = rankings.map(r => {
      const plainRanking = (r as any).toObject ? (r as any).toObject() : r;
      return {
        ...plainRanking,
        fullName: formatNameToTitleCase(plainRanking.fullName),
      };
    });
  }
  // Create PDF in A4 format
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Brand colors - Professional purple and indigo theme
  const primaryPurple = [109, 40, 217]; // #6d28d9 - purple-700
  const lightPurple = [237, 233, 254]; // #ede9fe - purple-50
  const darkGray = [17, 24, 39]; // #111827
  const mediumGray = [75, 85, 99]; // #4b5563
  const lightGray = [243, 244, 246]; // #f3f4f6

  // ===== PAGE HEADER =====
  // Clean header with gradient effect (using two shades)
  doc.setFillColor(109, 40, 217); // purple-700
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Subtle bottom accent
  doc.setFillColor(139, 92, 246); // lighter purple
  doc.rect(0, 53, pageWidth, 2, 'F');

  // Title - Virtual Library
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('Virtual Library', pageWidth / 2, 22, { align: 'center' });

  // Subtitle - Daily Rankings Report
  doc.setFontSize(15);
  doc.setFont('helvetica', 'normal');
  doc.text('Daily Rankings Report', pageWidth / 2, 34, { align: 'center' });

  // Date
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(date, pageWidth / 2, 45, { align: 'center' });

  // Start content below header
  let currentY = 72;

  // ===== RANKINGS TABLE =====
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Rankings', 20, currentY);

  currentY += 12;

  // Prepare table data - Rank, Name, and Hours
  const tableData = filteredRankings.map((ranking) => {
    return [
      ranking.rank.toString(),
      ranking.fullName,
      ranking.totalDurationFormatted,
    ];
  });

  // Generate table
  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Name', 'Hours']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252], // Very light gray/slate background
      textColor: [51, 65, 85], // Dark slate text
      fontStyle: 'bold',
      fontSize: 11,
      cellPadding: 7,
      lineWidth: 0,
      lineColor: [226, 232, 240],
    },
    bodyStyles: {
      fontSize: 11,
      cellPadding: 7,
      textColor: [31, 41, 55], // gray-800
      fontStyle: 'normal',
      lineWidth: 0.1,
      lineColor: [241, 245, 249],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center', fontStyle: 'bold', fontSize: 11 },
      1: { cellWidth: 100, fontStyle: 'normal', fontSize: 11 },
      2: { cellWidth: 42, halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: [109, 40, 217] },
    },
    margin: { left: 20, right: 20 },
    tableLineWidth: 0.1,
    tableLineColor: [226, 232, 240],
    didParseCell: function (data) {
      // Highlight top 3 ranks with distinct colors
      if (data.section === 'body' && data.row.index < 3) {
        if (data.row.index === 0) {
          // Gold/Yellow for 1st place
          data.cell.styles.fillColor = [254, 243, 199]; // yellow-200
          if (data.column.index === 0) {
            data.cell.styles.textColor = [161, 98, 7]; // yellow-800
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 13;
          }
          if (data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 12;
          }
        } else if (data.row.index === 1) {
          // Silver/Gray for 2nd place
          data.cell.styles.fillColor = [229, 231, 235]; // gray-200
          if (data.column.index === 0) {
            data.cell.styles.textColor = [75, 85, 99]; // gray-600
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 13;
          }
          if (data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 12;
          }
        } else if (data.row.index === 2) {
          // Bronze/Orange for 3rd place
          data.cell.styles.fillColor = [254, 215, 170]; // orange-200
          if (data.column.index === 0) {
            data.cell.styles.textColor = [154, 52, 18]; // orange-800
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 13;
          }
          if (data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 12;
          }
        }
      }
      
      // Make rank column bold for all rows
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Make hours column (index 2) stand out with purple color
      if (data.section === 'body' && data.column.index === 2) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: function (data) {
      // Footer on every page
      const footerY = pageHeight - 15;
      
      // Footer line
      doc.setDrawColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      doc.setLineWidth(0.3);
      doc.line(20, footerY - 6, pageWidth - 20, footerY - 6);
      
      doc.setFontSize(9);
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      doc.setFont('helvetica', 'normal');
      
      // Page number on the left
      const pageNum = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.text(
        `Page ${currentPage} of ${pageNum}`,
        20,
        footerY,
        { align: 'left' }
      );

      // Footer text centered
      doc.setFont('helvetica', 'bold');
      doc.text('Virtual Library', pageWidth / 2, footerY, {
        align: 'center',
      });
      
      // Date on the right
      doc.setFont('helvetica', 'normal');
      doc.text(date, pageWidth - 20, footerY, {
        align: 'right',
      });
    },
  });

  // ===== SAVE PDF =====
  const fileName = `VirtualLibrary_Rankings_${date}.pdf`;
  doc.save(fileName);
};

// ─── Forest Rankings PDF ──────────────────────────────────────────────────────

interface ForestRankingData {
  rank: number;
  name: string;
  totalDurationFormatted: string;
}

interface ForestPDFOptions {
  date: string;
  rankings: ForestRankingData[];
  totalParticipants: number;
}

export const generateForestRankingsPDF = ({ date, rankings, totalParticipants }: ForestPDFOptions) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Green theme colors
  const primaryGreen = [21, 128, 61];   // green-700  #15803d
  const lightGreen   = [134, 239, 172]; // green-300

  // ===== HEADER =====
  doc.setFillColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.rect(0, 0, pageWidth, 55, 'F');

  doc.setFillColor(lightGreen[0], lightGreen[1], lightGreen[2]);
  doc.rect(0, 53, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('Virtual Library', pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'normal');
  doc.text('Forest Rankings Report', pageWidth / 2, 34, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(date, pageWidth / 2, 45, { align: 'center' });

  let currentY = 72;

  // ===== SECTION TITLE =====
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Forest Rankings', 20, currentY);

  currentY += 12;

  // ===== TABLE =====
  const tableData = rankings.map(r => [
    r.rank.toString(),
    formatNameToTitleCase(r.name),
    r.totalDurationFormatted,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Name', 'Hours']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [240, 253, 244], // green-50
      textColor: [22, 78, 37],   // green-900
      fontStyle: 'bold',
      fontSize: 11,
      cellPadding: 7,
      lineWidth: 0,
      lineColor: [187, 247, 208],
    },
    bodyStyles: {
      fontSize: 11,
      cellPadding: 7,
      textColor: [31, 41, 55],
      fontStyle: 'normal',
      lineWidth: 0.1,
      lineColor: [220, 252, 231],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center', fontStyle: 'bold', fontSize: 11 },
      1: { cellWidth: 100, fontStyle: 'normal', fontSize: 11 },
      2: { cellWidth: 42, halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: [21, 128, 61] },
    },
    margin: { left: 20, right: 20 },
    tableLineWidth: 0.1,
    tableLineColor: [187, 247, 208],
    didParseCell: function (data) {
      if (data.section === 'body' && data.row.index < 3) {
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [254, 243, 199]; // gold
          if (data.column.index === 0) { data.cell.styles.textColor = [161, 98, 7]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 13; }
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 12; }
        } else if (data.row.index === 1) {
          data.cell.styles.fillColor = [229, 231, 235]; // silver
          if (data.column.index === 0) { data.cell.styles.textColor = [75, 85, 99]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 13; }
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 12; }
        } else if (data.row.index === 2) {
          data.cell.styles.fillColor = [254, 215, 170]; // bronze
          if (data.column.index === 0) { data.cell.styles.textColor = [154, 52, 18]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 13; }
          if (data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 12; }
        }
      }
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: function () {
      const footerY = pageHeight - 15;
      doc.setDrawColor(75, 85, 99);
      doc.setLineWidth(0.3);
      doc.line(20, footerY - 6, pageWidth - 20, footerY - 6);

      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.setFont('helvetica', 'normal');

      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages  = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${currentPage} of ${totalPages}`, 20, footerY, { align: 'left' });

      doc.setFont('helvetica', 'bold');
      doc.text('Virtual Library — Forest Rankings', pageWidth / 2, footerY, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.text(date, pageWidth - 20, footerY, { align: 'right' });
    },
  });

  doc.save(`VirtualLibrary_ForestRankings_${date}.pdf`);
};

