/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - SMART AUTO-MAPPER DATABASE, FOTO SELFIE & JAM LEMBUR
 * SmartAbsen PT ANUGERAH BERKAH INDUSTRI
 * ============================================================================
 * 
 * FITUR TERBARU:
 * 1. KALKULASI JAM LEMBUR OTOMATIS & PEMBULATAN MENIT:
 *    - Senin - Jumat: Jam 17:00 ke atas dihitung lembur.
 *    - Sabtu: Jam 13:00 ke atas dihitung lembur.
 *    - Minggu: Seluruh jam kerja dihitung lembur.
 *    - ATURAN PEMBULATAN 45 MENIT:
 *      * Kurang dari 45 menit tidak dihitung (< 45 menit = 0 Jam).
 *      * 45 menit ke atas dibulatkan ke 1 Jam penuh (>= 45 menit = +1 Jam).
 * 2. SMART COLUMN AUTO-MAPPER: Data masuk 100% tepat pada kolom masing-masing
 *    berdasarkan judul kolom di Baris 1 spreadsheet.
 * 3. FOTO SELFIE GOOGLE DRIVE: Tersimpan otomatis ke folder "Foto_Absensi_ABI"
 *    dan gambarnya tampil proporsional di Google Sheets.
 * 4. LAPORAN 30 HARI & ANTI-ERROR: Bebas dari error formula dan siap sinkronisasi.
 * 
 * PETUNJUK PEMBARUAN CEPAT (1 MENIT):
 * ----------------------------------------------------------------------------
 * 1. Buka Google Spreadsheet Anda (DB_SmartAbsen).
 * 2. Klik menu: Ekstensi (Extensions) -> Apps Script.
 * 3. Hapus SEMUA isi kode di Code.gs, lalu COPY & PASTE seluruh kode di file ini.
 * 4. Klik ikon SIMPAN (Ctrl + S).
 * 5. Klik tombol biru: Terapkan (Deploy) -> Kelola Penerapan (Manage Deployments).
 * 6. Klik ikon PENSIL (Edit):
 *    - Versi (Version): Pilih "Versi Baru" (New Version) -> WAJIB!
 *    - Siapa yang memiliki akses: "Siapa saja" (Anyone) -> WAJIB!
 *    - Klik "Terapkan" (Deploy).
 * 7. Selesai! Kolom "Jam Lembur" dan data foto akan otomatis tersinkronisasi rapi.
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000); // Tunggu antrian maksimal 30 detik

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};

    // 1. Parsing data JSON dari aplikasi web
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = data.action || '';
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    // ========================================================================
    // AKSI 1: ABSEN MASUK (CLOCK IN)
    // ========================================================================
    if (action === "CLOCK_IN") {
      var sheetAbsensi = ss.getSheetByName("Absensi");
      if (!sheetAbsensi) {
        sheetAbsensi = ss.insertSheet("Absensi");
      }

      // Pastikan ada header standar jika sheet masih kosong
      ensureAbsensiHeaders(sheetAbsensi);

      // Baca susunan header Baris 1 secara dinamis
      var headerInfo = getHeaderInfo(sheetAbsensi);
      var totalCols = Math.max(headerInfo.lastCol, 12);
      var newRow = new Array(totalCols).fill("");

      // Simpan foto selfie ke Google Drive jika tersedia
      var photoInfo = { hasPhoto: false, viewUrl: "", imageFormula: "-" };
      if (data.photo && typeof data.photo === 'string' && data.photo.indexOf('data:image') === 0) {
        var empNameSafe = (data.employeeName || "Karyawan").replace(/[^a-zA-Z0-9]/g, "_");
        var dateSafe = (data.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd")).replace(/[^a-zA-Z0-9]/g, "_");
        var fileName = "Absen_" + dateSafe + "_" + empNameSafe + "_" + (data.id || Date.now()) + ".jpg";
        photoInfo = saveBase64ImageToDrive(data.photo, "Foto_Absensi_ABI", fileName);
      }

      // PETAKAN DATA 100% SESUAI NAMA KOLOM DI BARIS 1 SPREADSHEET:
      putVal(newRow, headerInfo, ["id absen", "id"], data.id || ("ATT-" + Date.now()));
      putVal(newRow, headerInfo, ["tanggal", "date"], data.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"));
      putVal(newRow, headerInfo, ["id karyawan"], data.employeeId || "");
      putVal(newRow, headerInfo, ["nama karyawan", "nama"], data.employeeName || "");
      putVal(newRow, headerInfo, ["jam masuk"], data.clockIn || "");
      putVal(newRow, headerInfo, ["status masuk"], data.clockInStatus || "Tepat Waktu");
      putVal(newRow, headerInfo, ["jam pulang"], "-");
      putVal(newRow, headerInfo, ["durasi kerja", "durasi", "jam kerja"], "-");
      putVal(newRow, headerInfo, ["jam lembur", "lembur"], "-");
      putVal(newRow, headerInfo, ["status kehadiran", "kehadiran"], "Hadir");
      putVal(newRow, headerInfo, ["lokasi gps", "lokasi masuk", "lokasi"], data.clockInLocation || "");

      // Kolom Foto Selfie:
      if (photoInfo.hasPhoto) {
        putVal(newRow, headerInfo, ["foto selfie", "foto"], photoInfo.imageFormula);
      } else {
        putVal(newRow, headerInfo, ["foto selfie", "foto"], "-");
      }

      // Kolom Link Foto HD:
      var colLink = findColumnIndex(headerInfo.colMap, ["link foto", "link foto hd", "link"]);
      if (colLink) {
        newRow[colLink - 1] = photoInfo.viewUrl || "-";
      } else if (photoInfo.hasPhoto) {
        var nextCol = totalCols + 1;
        sheetAbsensi.getRange(1, nextCol).setValue("Link Foto HD")
          .setFontWeight("bold").setBackground("#1d4ed8").setFontColor("#ffffff");
        newRow.push(photoInfo.viewUrl);
      }

      // Kolom Waktu Sync (jika ada):
      putVal(newRow, headerInfo, ["sync", "waktu sync", "timestamp"], nowStr);

      sheetAbsensi.appendRow(newRow);

      // Atur tinggi baris agar foto selfie terlihat jelas dan proporsional
      var lastRow = sheetAbsensi.getLastRow();
      if (photoInfo.hasPhoto) {
        sheetAbsensi.setRowHeight(lastRow, 60);
      }

      return createJsonResponse({ 
        status: "success", 
        message: "Absen Masuk dan Foto Selfie berhasil dicatat dengan rapi", 
        id: data.id,
        photoUrl: photoInfo.viewUrl
      });
    }

    // ========================================================================
    // AKSI 2: ABSEN PULANG (CLOCK OUT & HITUNG LEMBUR)
    // ========================================================================
    else if (action === "CLOCK_OUT") {
      var sheetAbsensi = ss.getSheetByName("Absensi");
      if (!sheetAbsensi) return createJsonResponse({ status: "error", message: "Sheet Absensi tidak ditemukan" });

      var headerInfo = getHeaderInfo(sheetAbsensi);
      var colId = findColumnIndex(headerInfo.colMap, ["id absen", "id"]) || 1;
      var colEmpId = findColumnIndex(headerInfo.colMap, ["id karyawan"]) || 3;
      var colDate = findColumnIndex(headerInfo.colMap, ["tanggal", "date"]) || 2;
      var colMasuk = findColumnIndex(headerInfo.colMap, ["jam masuk"]) || 5;
      var colPulang = findColumnIndex(headerInfo.colMap, ["jam pulang"]) || 7;
      var colDurasi = findColumnIndex(headerInfo.colMap, ["durasi kerja", "durasi", "jam kerja"]) || 8;
      var colLembur = findColumnIndex(headerInfo.colMap, ["jam lembur", "lembur"]);
      var colSync = findColumnIndex(headerInfo.colMap, ["sync", "waktu sync"]);

      var id = data.id;
      var clockOut = data.clockOut || "";
      var workHours = data.workHours || "";
      var rows = sheetAbsensi.getDataRange().getValues();
      var updated = false;

      // Cari baris absensi yang sesuai
      for (var i = rows.length - 1; i >= 1; i--) {
        if (rows[i][colId - 1] == id || (rows[i][colEmpId - 1] == data.employeeId && rows[i][colDate - 1] == data.date)) {
          var rowClockIn = rows[i][colMasuk - 1] || "";
          var overtimeVal = data.overtime || calculateOvertimeGAS(data.date, rowClockIn, clockOut);

          sheetAbsensi.getRange(i + 1, colPulang).setValue(clockOut);
          sheetAbsensi.getRange(i + 1, colDurasi).setValue(workHours);

          // Update Jam Lembur
          if (colLembur) {
            sheetAbsensi.getRange(i + 1, colLembur).setValue(overtimeVal);
          } else {
            // Otomatis buat kolom Jam Lembur jika belum ada
            var nextCol = Math.max(headerInfo.lastCol, sheetAbsensi.getLastColumn()) + 1;
            sheetAbsensi.getRange(1, nextCol).setValue("Jam Lembur")
              .setFontWeight("bold").setBackground("#b45309").setFontColor("#ffffff");
            sheetAbsensi.getRange(i + 1, nextCol).setValue(overtimeVal);
          }

          if (colSync) {
            sheetAbsensi.getRange(i + 1, colSync).setValue(nowStr);
          }
          updated = true;
          break;
        }
      }

      return createJsonResponse({ status: "success", message: "Absen Pulang dan Jam Lembur berhasil diupdate", updated: updated });
    }

    // ========================================================================
    // AKSI 3: PENGAJUAN IZIN / SAKIT / CUTI
    // ========================================================================
    else if (action === "SUBMIT_REQUEST") {
      var sheetPengajuan = ss.getSheetByName("Pengajuan");
      if (!sheetPengajuan) sheetPengajuan = ss.insertSheet("Pengajuan");
      ensurePengajuanHeaders(sheetPengajuan);

      var headerInfo = getHeaderInfo(sheetPengajuan);
      var totalCols = Math.max(headerInfo.lastCol, 14);
      var newRow = new Array(totalCols).fill("");

      var docInfo = { hasPhoto: false, viewUrl: "", imageFormula: "-" };
      if (data.attachment && typeof data.attachment === 'string' && data.attachment.indexOf('data:image') === 0) {
        var empSafe = (data.employeeName || "Karyawan").replace(/[^a-zA-Z0-9]/g, "_");
        var reqFileName = "Dokumen_" + (data.type || "REQ") + "_" + empSafe + "_" + (data.id || Date.now()) + ".jpg";
        docInfo = saveBase64ImageToDrive(data.attachment, "Foto_Dokumen_ABI", reqFileName);
      }

      putVal(newRow, headerInfo, ["id pengajuan", "id"], data.id || ("REQ-" + Date.now()));
      putVal(newRow, headerInfo, ["id karyawan"], data.employeeId || "");
      putVal(newRow, headerInfo, ["nama karyawan", "nama"], data.employeeName || "");
      putVal(newRow, headerInfo, ["jenis"], data.type || "IZIN");
      putVal(newRow, headerInfo, ["kategori"], data.category || "-");
      putVal(newRow, headerInfo, ["tgl mulai", "mulai"], data.startDate || "");
      putVal(newRow, headerInfo, ["tgl selesai", "selesai"], data.endDate || "");
      putVal(newRow, headerInfo, ["total hari", "hari"], data.totalDays || 1);
      putVal(newRow, headerInfo, ["alasan"], data.reason || "");
      putVal(newRow, headerInfo, ["bukti", "dokumen", "lampiran"], docInfo.hasPhoto ? docInfo.imageFormula : "-");
      putVal(newRow, headerInfo, ["link bukti", "link dokumen"], docInfo.hasPhoto ? docInfo.viewUrl : "-");
      putVal(newRow, headerInfo, ["kontak", "darurat"], data.emergencyContact || "-");
      putVal(newRow, headerInfo, ["status"], "PENDING");
      putVal(newRow, headerInfo, ["sync", "waktu sync"], nowStr);

      sheetPengajuan.appendRow(newRow);
      if (docInfo.hasPhoto) {
        sheetPengajuan.setRowHeight(sheetPengajuan.getLastRow(), 60);
      }

      return createJsonResponse({ status: "success", message: "Pengajuan berhasil dicatat" });
    }

    // ========================================================================
    // AKSI 4: PERSETUJUAN HRD (APPROVE / REJECT)
    // ========================================================================
    else if (action === "UPDATE_REQUEST_STATUS") {
      var sheetPengajuan = ss.getSheetByName("Pengajuan");
      if (!sheetPengajuan) return createJsonResponse({ status: "error", message: "Sheet Pengajuan tidak ditemukan" });

      var headerInfo = getHeaderInfo(sheetPengajuan);
      var colId = findColumnIndex(headerInfo.colMap, ["id pengajuan", "id"]) || 1;
      var colStatus = findColumnIndex(headerInfo.colMap, ["status"]) || 13;
      var colNotes = findColumnIndex(headerInfo.colMap, ["catatan hrd", "catatan", "alasan hr"]) || 14;
      var colReviewTime = findColumnIndex(headerInfo.colMap, ["waktu review", "review"]) || 15;

      var reqId = data.id;
      var rowsReq = sheetPengajuan.getDataRange().getValues();
      for (var j = rowsReq.length - 1; j >= 1; j--) {
        if (rowsReq[j][colId - 1] == reqId) {
          sheetPengajuan.getRange(j + 1, colStatus).setValue(data.status || "APPROVED");
          sheetPengajuan.getRange(j + 1, colNotes).setValue(data.notes || "-");
          sheetPengajuan.getRange(j + 1, colReviewTime).setValue(data.reviewedAt || nowStr);
          break;
        }
      }
      return createJsonResponse({ status: "success", message: "Status pengajuan berhasil diupdate" });
    }

    return createJsonResponse({ status: "success", message: "Koneksi Google Apps Script Aktif!" });

  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

// ============================================================================
// HELPER: PERHITUNGAN LEMBUR GOOGLE APPS SCRIPT
// ============================================================================
function calculateOvertimeGAS(dateStr, clockInStr, clockOutStr) {
  if (!clockOutStr || !dateStr) return "-";
  try {
    var d = new Date(dateStr + "T12:00:00");
    var day = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu

    var outParts = clockOutStr.split(":");
    var outTotalMin = parseInt(outParts[0]) * 60 + parseInt(outParts[1] || 0);
    var overtimeMin = 0;

    if (day === 0) {
      // HARI MINGGU: Seluruh jam kerja dihitung lembur
      if (clockInStr) {
        var inParts = clockInStr.split(":");
        var inTotalMin = parseInt(inParts[0]) * 60 + parseInt(inParts[1] || 0);
        overtimeMin = Math.max(0, outTotalMin - inTotalMin);
      }
    } else if (day === 6) {
      // HARI SABTU: Jam 13:00 ke atas dihitung lembur
      if (outTotalMin > (13 * 60)) {
        overtimeMin = outTotalMin - (13 * 60);
      }
    } else {
      // HARI SENIN - JUMAT: Jam 17:00 ke atas dihitung lembur
      if (outTotalMin > (17 * 60)) {
        overtimeMin = outTotalMin - (17 * 60);
      }
    }

    if (overtimeMin <= 0) return "0 Jam";

    // ATURAN PEMBULATAN MENIT LEMBUR PT ABI:
    // - Kurang dari 45 menit tidak dihitung (< 45 menit = 0 Jam).
    // - 45 menit ke atas dibulatkan ke 1 Jam penuh (>= 45 menit = +1 Jam).
    var fullHours = Math.floor(overtimeMin / 60);
    var remainderMin = overtimeMin % 60;

    var roundedHours = fullHours;
    if (remainderMin >= 45) {
      roundedHours += 1;
    }

    if (roundedHours <= 0) return "0 Jam";
    return roundedHours + " Jam";
  } catch (err) {
    return "-";
  }
}

// ============================================================================
// HELPER: PEMETAAN KOLOM DINAMIS (SMART HEADER MAPPER)
// ============================================================================
function getHeaderInfo(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colMap = {};
  for (var i = 0; i < headerValues.length; i++) {
    var title = (headerValues[i] || "").toString().trim().toLowerCase();
    if (title) {
      colMap[title] = i + 1;
    }
  }
  return { colMap: colMap, lastCol: lastCol, headerValues: headerValues };
}

function findColumnIndex(colMap, keywords) {
  for (var k = 0; k < keywords.length; k++) {
    var kw = keywords[k].toLowerCase();
    for (var colName in colMap) {
      if (colName.indexOf(kw) !== -1) {
        return colMap[colName];
      }
    }
  }
  return null;
}

function putVal(rowArray, headerInfo, keywords, value) {
  var colIdx = findColumnIndex(headerInfo.colMap, keywords);
  if (colIdx && colIdx <= rowArray.length) {
    rowArray[colIdx - 1] = value;
  }
}

function ensureAbsensiHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var defaultHeaders = [
      "ID", "Tanggal", "ID Karyawan", "Nama Karyawan", 
      "Jam Masuk", "Status Masuk", "Jam Pulang", "Durasi Kerja", 
      "Jam Lembur", "Status Kehadiran", "Lokasi GPS", "Foto Selfie", "Link Foto HD"
    ];
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setFontWeight("bold")
      .setBackground("#1d4ed8")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

function ensurePengajuanHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var defaultHeaders = [
      "ID Pengajuan", "ID Karyawan", "Nama Karyawan", "Jenis", 
      "Kategori", "Tgl Mulai", "Tgl Selesai", "Total Hari", 
      "Alasan", "Bukti/Dokumen", "Link Bukti HD", 
      "Kontak Darurat", "Status", "Catatan HRD", "Waktu Review", "Waktu Sync"
    ];
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length)
      .setFontWeight("bold")
      .setBackground("#1d4ed8")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

function saveBase64ImageToDrive(base64Data, folderName, filename) {
  if (!base64Data || typeof base64Data !== 'string' || base64Data.indexOf('data:image') !== 0) {
    return { hasPhoto: false, viewUrl: "", imageFormula: "-" };
  }

  try {
    var parts = base64Data.split(',');
    if (parts.length < 2) return { hasPhoto: false, viewUrl: "", imageFormula: "-" };

    var mimeMatch = parts[0].match(/:(.*?);/);
    var mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    var decoded = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var viewUrl = "https://drive.google.com/file/d/" + fileId + "/view";
    var thumbUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w300";

    return {
      hasPhoto: true,
      fileId: fileId,
      viewUrl: viewUrl,
      thumbUrl: thumbUrl,
      imageFormula: '=IMAGE("' + thumbUrl + '")'
    };
  } catch (err) {
    Logger.log("Gagal simpan foto: " + err.toString());
    return { hasPhoto: false, viewUrl: "", imageFormula: "Gagal Simpan Foto" };
  }
}

function otorisasiIzinDrive() {
  try {
    var folders = DriveApp.getFoldersByName("Foto_Absensi_ABI");
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Foto_Absensi_ABI");
    Logger.log("SUKSES: Izin Google Drive aktif! Folder: " + folder.getName());
    return "Izin Google Drive BERHASIL diaktifkan!";
  } catch (err) {
    Logger.log("Error: " + err.toString());
    throw err;
  }
}

function doGet(e) {
  return createJsonResponse({
    status: "online",
    message: "Google Apps Script Backend SmartAbsen PT ANUGERAH BERKAH INDUSTRI aktif!",
    timestamp: new Date().toISOString()
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
