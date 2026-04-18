function testTextFinder() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var t0 = Date.now();
  var finder = sheet.createTextFinder("01797969797").matchEntireCell(true).findAll();
  var t1 = Date.now();
  Logger.log("Found " + finder.length + " matches in " + (t1 - t0) + " ms");
}
