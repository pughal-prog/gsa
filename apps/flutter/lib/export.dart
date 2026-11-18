import 'dart:io';
import 'package:excel/excel.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'pdfshare.dart';

/// Shows a PDF / Excel chooser, then opens the share sheet (save to Drive, WhatsApp, email, print).
Future<void> exportData(BuildContext context, {required String title, String? subtitle, required List<String> head, required List<List<String>> rows, required String filename}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (c) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(leading: const Icon(Icons.picture_as_pdf), title: const Text('Share as PDF'), onTap: () => Navigator.pop(c, 'pdf')),
      ListTile(leading: const Icon(Icons.table_chart), title: const Text('Share as Excel (.xlsx)'), onTap: () => Navigator.pop(c, 'xlsx')),
      const SizedBox(height: 8),
    ])),
  );
  if (choice == 'pdf') {
    await sharePdf(title: title, subtitle: subtitle, head: head, rows: rows, filename: '$filename.pdf');
  } else if (choice == 'xlsx') {
    final book = Excel.createExcel();
    final sheetName = title.replaceAll(RegExp(r'[\\/?*\[\]:]'), ' ');
    final name = sheetName.length > 28 ? sheetName.substring(0, 28) : sheetName;
    book.rename('Sheet1', name);
    final sheet = book[name];
    sheet.appendRow([for (final h in head) TextCellValue(h)]);
    for (final r in rows) { sheet.appendRow([for (final v in r) TextCellValue(v)]); }
    final bytes = book.save();
    if (bytes == null) return;
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/$filename.xlsx');
    await f.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(f.path, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')], subject: title);
  }
}
