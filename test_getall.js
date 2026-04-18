function doGet(e) {
  if (e.parameter.action === 'getAll') {
    var sheet = SpreadsheetApp.openById('1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU').getSheetByName('Examiner Information');
    var data = sheet.getDataRange().getDisplayValues();
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
}
