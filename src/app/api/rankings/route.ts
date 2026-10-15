import { NextResponse } from "next/server";

// "mm:ss" 또는 초 단위를 초 숫자로 변환하는 함수
function parseTimeToSeconds(timeStr: string | number): number {
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

// CSV 파싱 헬퍼 (따옴표 처리 포함)
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  });
}

export async function GET() {
  const SPREADSHEET_ID = "1T-TSFaDf93kyguVS5FNVVBxV74dnTP7zrZPE51U50lU";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;

  try {
    // 구글 시트 CSV 직접 조회 (CORS나 Apps Script 재배포 번거로움 없이 100% 실시간 동기화)
    const response = await fetch(csvUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Google Sheet CSV fetch failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    const csvText = decoder.decode(buffer);
    const rows = parseCSV(csvText);

    if (rows.length <= 1) {
      return NextResponse.json({ status: "success", top3: [] });
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const nameIdx = headers.indexOf("name");
    const scoreIdx = headers.indexOf("score");
    const finishTimeIdx = headers.indexOf("finishtime");

    const records = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : "";
      const scoreStr = scoreIdx !== -1 && row[scoreIdx] ? row[scoreIdx] : "0";
      const finishtime = finishTimeIdx !== -1 && row[finishTimeIdx] ? row[finishTimeIdx] : "";

      if (name && finishtime) {
        records.push({
          name,
          score: parseInt(scoreStr, 10) || 0,
          finishtime,
          seconds: parseTimeToSeconds(finishtime),
        });
      }
    }

    // 종료 시간(seconds) 오름차순(가장 빠른 순서) 정렬, 동점일 경우 시도 횟수(score) 오름차순 정렬
    records.sort((a, b) => {
      if (a.seconds !== b.seconds) return a.seconds - b.seconds;
      return a.score - b.score;
    });

    // 상위 3명 추출
    const top3 = records.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      name: item.name,
      score: item.score,
      finishtime: item.finishtime,
    }));

    return NextResponse.json({ status: "success", top3 });
  } catch (err: any) {
    console.error("Rankings API Error:", err);
    return NextResponse.json(
      { error: err.message || "랭킹 데이터를 가져오지 못했습니다.", top3: [] },
      { status: 500 }
    );
  }
}
