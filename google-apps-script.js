/**
 * 카드 맞추기 게임 결과 저장 및 TOP 3 랭킹 조회 Google Apps Script
 * 스프레드시트 URL: https://docs.google.com/spreadsheets/d/1T-TSFaDf93kyguVS5FNVVBxV74dnTP7zrZPE51U50lU/edit?usp=sharing
 * 
 * 저장 대상 헤더 컬럼:
 * 1. timestamp  : 기록 일시 (YYYY-MM-DD HH:mm:ss)
 * 2. name       : 플레이어 이름
 * 3. score      : 총 시도 횟수
 * 4. finishtime : 완료 소요 시간 (mm:ss)
 */

const SPREADSHEET_ID = "1T-TSFaDf93kyguVS5FNVVBxV74dnTP7zrZPE51U50lU";

// "mm:ss" 또는 초 단위를 숫자로 변환하는 헬퍼 함수
function parseTimeToSeconds(timeStr) {
  if (typeof timeStr === "number") return timeStr;
  if (!timeStr) return 999999;
  const str = String(timeStr).trim();
  if (str.includes(":")) {
    const parts = str.split(":");
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 999999 : parsed;
}

// 상위 3위(종료시간 오름차순, 동점 시 시도횟수 적은 순) 랭킹 데이터 추출 함수
function getTopRankings(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let nameIdx = -1;
  let scoreIdx = -1;
  let finishTimeIdx = -1;
  let timestampIdx = -1;

  headers.forEach((h, idx) => {
    const col = String(h).trim().toLowerCase();
    if (col === "name") nameIdx = idx;
    if (col === "score") scoreIdx = idx;
    if (col === "finishtime") finishTimeIdx = idx;
    if (col === "timestamp") timestampIdx = idx;
  });

  const dataRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const records = [];

  dataRows.forEach((row) => {
    const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
    const scoreVal = scoreIdx !== -1 ? row[scoreIdx] : 0;
    const finishTimeVal = finishTimeIdx !== -1 ? row[finishTimeIdx] : "";
    const timeVal = timestampIdx !== -1 ? String(row[timestampIdx] || "") : "";

    if (name && finishTimeVal) {
      records.push({
        name,
        score: parseInt(scoreVal, 10) || 0,
        finishtime: String(finishTimeVal),
        seconds: parseTimeToSeconds(finishTimeVal),
        timestamp: timeVal
      });
    }
  });

  // 종료시간(초) 오름차순 정렬, 동점일 경우 시도 횟수(score) 오름차순 정렬
  records.sort((a, b) => {
    if (a.seconds !== b.seconds) return a.seconds - b.seconds;
    return a.score - b.score;
  });

  // 상위 3명 반환 (1, 2, 3위)
  return records.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    name: item.name,
    score: item.score,
    finishtime: item.finishtime
  }));
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    let requestData;
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      requestData = e.parameter;
    } else {
      throw new Error("전송된 데이터가 없습니다.");
    }

    const name = String(requestData.name || "익명").trim();
    const score = requestData.score !== undefined ? String(requestData.score) : "";
    const finishtime = String(requestData.finishtime || "").trim();
    
    // 한국 시간대(KST) 타임스탬프
    const timestamp = Utilities.formatDate(
      new Date(),
      "Asia/Seoul",
      "yyyy-MM-dd HH:mm:ss"
    );

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 4);
    let headers = lastRow > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    const expectedHeaders = ["timestamp", "name", "score", "finishtime"];

    const isHeaderEmpty = headers.length === 0 || headers.every(cell => !cell);
    if (isHeaderEmpty || lastRow === 0) {
      sheet.appendRow(expectedHeaders);
      headers = expectedHeaders;
    }

    // 중복 저장 방지: 직전 행과 내용이 동일할 경우 중복 기록 생략
    let isDuplicate = false;
    if (lastRow > 1) {
      const lastRowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
      let lastName = "";
      let lastScore = "";
      let lastFinishTime = "";
      
      headers.forEach((h, idx) => {
        const col = String(h).trim().toLowerCase();
        if (col === "name") lastName = String(lastRowValues[idx] || "").trim();
        if (col === "score") lastScore = String(lastRowValues[idx] || "").trim();
        if (col === "finishtime") lastFinishTime = String(lastRowValues[idx] || "").trim();
      });

      if (lastName === name && lastScore === score && lastFinishTime === finishtime) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      const rowData = [];
      headers.forEach((header) => {
        const colName = String(header).trim().toLowerCase();
        if (colName === "timestamp") rowData.push(timestamp);
        else if (colName === "name") rowData.push(name);
        else if (colName === "score") rowData.push(score);
        else if (colName === "finishtime") rowData.push(finishtime);
        else rowData.push("");
      });

      if (rowData.filter(v => v !== "").length === 0) {
        sheet.appendRow([timestamp, name, score, finishtime]);
      } else {
        sheet.appendRow(rowData);
      }
    }

    // 데이터 저장 후 즉시 최신 TOP 3 랭킹 계산
    const top3 = getTopRankings(sheet);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: isDuplicate ? "ignored_duplicate" : "success",
        message: isDuplicate ? "중복 기록 생략됨" : "성공적으로 저장되었습니다.",
        top3: top3
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: err.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// GET 요청 시 현재 구글 시트의 TOP 3 랭킹 반환
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const top3 = getTopRankings(sheet);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        top3: top3
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: err.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
