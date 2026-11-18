import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Builds a branded PDF and opens the share sheet (WhatsApp, Drive, save to files, print).
Future<void> sharePdf({required String title, String? subtitle, required List<String> head, required List<List<String>> rows, required String filename}) async {
  final doc = pw.Document();
  doc.addPage(pw.MultiPage(
    pageFormat: head.length > 6 ? PdfPageFormat.a4.landscape : PdfPageFormat.a4,
    margin: const pw.EdgeInsets.all(32),
    header: (c) => pw.Container(
      color: PdfColor.fromInt(0xFF0B4AA2), padding: const pw.EdgeInsets.all(10), width: double.infinity,
      child: pw.Text('Global Sports Academy', style: pw.TextStyle(color: PdfColors.white, fontSize: 15, fontWeight: pw.FontWeight.bold))),
    build: (c) => [
      pw.SizedBox(height: 10),
      pw.Text(title, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
      if (subtitle != null) pw.Text(subtitle, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
      pw.SizedBox(height: 8),
      pw.TableHelper.fromTextArray(headers: head, data: rows, headerStyle: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 9),
          headerDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF0B4AA2)), cellStyle: const pw.TextStyle(fontSize: 9), cellPadding: const pw.EdgeInsets.all(4)),
    ],
  ));
  await Printing.sharePdf(bytes: await doc.save(), filename: filename);
}
