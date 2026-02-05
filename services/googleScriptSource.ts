
export const GOOGLE_SCRIPT_CODE = `
/* 
   RDMS Data Sync v1.4 (Plant Planning Support)
   ----------------------------------
   - Mirrored architecture for all app modules
   - Automatic sheet creation and header formatting
*/

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Lock Timeout" }));
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var output = { success: true, message: "" };

    if (data.type === 'SETUP_DASHBOARD') {
      setupHeaders();
      output.message = "All Sheets Initialized";
    }
    else if (data.type === 'JOB' || data.type === 'DELETE_JOB') syncProduction(data);
    else if (data.type === 'BILL' || data.type === 'DELETE_BILL') syncBilling(data);
    else if (data.type === 'SLITTING_JOB' || data.type === 'DELETE_SLITTING_JOB') syncSlitting(data);
    else if (data.type === 'PLAN' || data.type === 'DELETE_PLAN') syncPlanning(data);
    else if (data.type === 'PLANT_PLAN' || data.type === 'DELETE_PLANT_PLAN') syncPlantPlanning(data);
    else if (data.type === 'CHEMICAL_LOG' || data.type === 'DELETE_CHEMICAL_LOG') syncChemicalLog(data);
    else if (data.type === 'CHEMICAL_PURCHASE' || data.type === 'DELETE_CHEMICAL_PURCHASE') syncChemicalPurchase(data);
    else if (data.type === 'CHEMICAL_STOCK') syncChemicalStock(data);

    return ContentService.createTextOutput(JSON.stringify(output));
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }));
  } finally {
    lock.releaseLock();
  }
}

function syncProduction(data) {
  var sheet = getSheet("Production Data", true);
  deleteRowsById(sheet, 0, data.dispatchNo); 
  if (data.type === 'JOB') {
    data.rows.forEach(function(row) {
      sheet.appendRow(["'" + data.dispatchNo, data.date, data.partyName, row.size, row.sizeType || '-', Number(row.micron || 0), Number(row.weight), Number(row.productionWeight || 0), Number(row.wastage || 0), Number(row.pcs), Number(row.bundle), row.status, new Date()]);
    });
  }
}

function syncBilling(data) {
  var sheet = getSheet("Billing Data", true);
  deleteRowsById(sheet, 0, data.challanNumber);
  if (data.type === 'BILL') {
    data.lines.forEach(function(line) {
      sheet.appendRow(["'" + data.challanNumber, data.date, data.partyName, line.size, line.sizeType || '-', Number(line.micron || 0), Number(line.weight), Number(line.rate), Number(line.amount), data.paymentMode, new Date()]);
    });
  }
}

function syncSlitting(data) {
  var sheet = getSheet("Slitting Data", true);
  deleteRowsById(sheet, 0, data.jobNo);
  if (data.type === 'SLITTING_JOB') {
    data.rows.forEach(function(row) {
      sheet.appendRow(["'" + data.jobNo, data.date, data.jobCode, Number(data.planQty), Number(data.planMicron), row.srNo, row.size, Number(row.grossWeight), Number(row.coreWeight), Number(row.netWeight), Number(row.meter), data.status, new Date()]);
    });
  }
}

function syncPlanning(data) {
  var sheet = getSheet("Planning Data", true);
  deleteRowsById(sheet, 0, data.id);
  if (data.type === 'PLAN') {
    sheet.appendRow([data.id, data.date, data.partyName, data.planType, data.size, data.printName || '', Number(data.micron), Number(data.weight), Number(data.meter), Number(data.cuttingSize || 0), Number(data.pcs), data.notes, data.status, new Date()]);
  }
}

function syncPlantPlanning(data) {
  var sheet = getSheet("Plant Production Plans", true);
  deleteRowsById(sheet, 0, data.id);
  if (data.type === 'PLANT_PLAN') {
    sheet.appendRow([data.id, data.date, data.partyCode, data.sizer, data.size, data.coils.join(", "), Number(data.micron), Number(data.qty), data.status, new Date()]);
  }
}

function syncChemicalLog(data) {
  var sheet = getSheet("Chemical Logs", true);
  deleteRowsById(sheet, 0, data.id);
  if (data.type === 'CHEMICAL_LOG') {
    sheet.appendRow([data.id, data.date, data.plant, Number(data.dop), Number(data.stabilizer), Number(data.epoxy), Number(data.g161 || 0), Number(data.nbs), new Date()]);
  }
}

function syncChemicalPurchase(data) {
  var sheet = getSheet("Chemical Purchases", true);
  deleteRowsById(sheet, 0, data.id);
  if (data.type === 'CHEMICAL_PURCHASE') {
    sheet.appendRow([data.id, data.date, data.chemical, Number(data.quantity), new Date()]);
  }
}

function syncChemicalStock(data) {
  var sheet = getSheet("Chemical Stock", true);
  sheet.clear();
  sheet.appendRow(["Chemical", "Current Stock (kg)", "Last Updated"]);
  Object.keys(data.stock).forEach(function(key) {
    sheet.appendRow([key.toUpperCase(), Number(data.stock[key]), new Date()]);
  });
  formatHeader(sheet);
}

function deleteRowsById(sheet, colIndex, id) {
  var idStr = String(id).trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    var cellVal = String(values[i][colIndex]).trim().toLowerCase();
    if (cellVal.indexOf("'") === 0) cellVal = cellVal.substring(1).trim();
    if (cellVal === idStr) sheet.deleteRow(i + 1);
  }
}

function getSheet(name, create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet && create) sheet = ss.insertSheet(name);
  return sheet;
}

function setupHeaders() {
  var sheets = [
    { name: "Production Data", headers: ["Job No", "Date", "Party Name", "Size", "Type", "Micron", "Dispatch Wt", "Prod Wt", "Wastage", "Pcs", "Bundle", "Status", "Timestamp"] },
    { name: "Billing Data", headers: ["Challan No", "Date", "Party Name", "Item", "Type", "Micron", "Weight", "Rate", "Amount", "Mode", "Timestamp"] },
    { name: "Slitting Data", headers: ["Job No", "Date", "Code", "Plan Qty", "Micron", "SR No", "Size", "Gross", "Core", "Net", "Meter", "Status", "Timestamp"] },
    { name: "Planning Data", headers: ["Plan ID", "Date", "Party Name", "Type", "Size", "Print Name", "Micron", "Weight", "Meter", "Cut Size", "Pcs", "Notes", "Status", "Timestamp"] },
    { name: "Plant Production Plans", headers: ["ID", "Date", "Party Code", "Sizer", "Size", "Coils", "Micron", "Qty", "Status", "Timestamp"] },
    { name: "Chemical Logs", headers: ["Log ID", "Date", "Plant", "DOP", "Stabilizer", "Epoxy", "G161", "NBS", "Timestamp"] },
    { name: "Chemical Purchases", headers: ["Purchase ID", "Date", "Material", "Qty (kg)", "Timestamp"] }
  ];
  sheets.forEach(function(s) {
    var sh = getSheet(s.name, true);
    if (sh.getLastRow() === 0) {
      sh.appendRow(s.headers);
      formatHeader(sh);
    }
  });
}

function formatHeader(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#f1f5f9");
  sheet.setFrozenRows(1);
}
`;
