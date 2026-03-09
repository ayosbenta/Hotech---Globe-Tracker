function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var subscribersSheet = ss.getSheetByName("Subscribers");
  var expensesSheet = ss.getSheetByName("Expenses");
  
  var result = {};
  
  if (subscribersSheet) {
    result.subscribers = getSheetData(subscribersSheet);
  } else {
    result.subscribers = [];
  }
  
  if (expensesSheet) {
    result.expenses = getSheetData(expensesSheet);
  } else {
    result.expenses = [];
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var rows = data.slice(1);
  
  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, i) {
      obj[header] = row[i];
    });
    return obj;
  });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheetName;
    var data = payload.data;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear();
    
    if (data && data.length > 0) {
      var headers = Object.keys(data[0]);
      sheet.appendRow(headers);
      
      var rows = data.map(function(obj) {
        return headers.map(function(header) {
          return obj[header] === undefined || obj[header] === null ? "" : obj[header];
        });
      });
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data synced successfully to '" + sheetName + "'."
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
