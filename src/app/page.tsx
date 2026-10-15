"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Home as HomeIcon, 
  Trophy, 
  Timer, 
  Sparkles, 
  User, 
  ArrowRight,
  Flame,
  Award,
  Sun,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// 8가지 과일 정의
interface FruitDef {
  id: string;
  name: string;
  emoji: string;
  glowColor: string;
}

const FRUITS: FruitDef[] = [
  { id: "apple", name: "사과", emoji: "🍎", glowColor: "from-red-400/20 to-rose-500/20" },
  { id: "banana", name: "바나나", emoji: "🍌", glowColor: "from-amber-400/20 to-yellow-500/20" },
  { id: "grape", name: "포도", emoji: "🍇", glowColor: "from-purple-400/20 to-indigo-500/20" },
  { id: "orange", name: "오렌지", emoji: "🍊", glowColor: "from-orange-400/20 to-amber-500/20" },
  { id: "strawberry", name: "딸기", emoji: "🍓", glowColor: "from-rose-400/20 to-pink-500/20" },
  { id: "watermelon", name: "수박", emoji: "🍉", glowColor: "from-emerald-400/20 to-green-500/20" },
  { id: "cherry", name: "체리", emoji: "🍒", glowColor: "from-pink-400/20 to-red-500/20" },
  { id: "kiwi", name: "키위", emoji: "🥝", glowColor: "from-lime-400/20 to-emerald-500/20" },
];

interface CardItem {
  instanceId: number;
  fruit: FruitDef;
  isFlipped: boolean;
  isMatched: boolean;
}

type GameStage = "LOGIN" | "READY" | "PLAYING" | "PAUSED" | "FINISHED";

export default function MemoryGamePage() {
  const [userName, setUserName] = useState<string>("");
  const [stage, setStage] = useState<GameStage>("LOGIN");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [moves, setMoves] = useState<number>(0);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // 다크모드 상태 (기본 시스템 감지 또는 저장된 설정)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // 최고 기록
  const [bestRecord, setBestRecord] = useState<{ name: string; time: number; moves: number } | null>(null);

  // 타이머 Ref 및 중복 저장 방지 Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSavedRef = useRef<boolean>(false);

  // 테마 초기화 및 전환
  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("app-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("app-theme", "light");
      }
      return next;
    });
  };

  // 타이머 제어
  useEffect(() => {
    if (stage === "PLAYING") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // 카드 덱 생성 및 Fisher-Yates 무작위 셔플 (4x4 = 16장)
  const initializeDeck = () => {
    const pairedFruits = [...FRUITS, ...FRUITS];
    for (let i = pairedFruits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairedFruits[i], pairedFruits[j]] = [pairedFruits[j], pairedFruits[i]];
    }

    const newCards: CardItem[] = pairedFruits.map((fruit, index) => ({
      instanceId: index,
      fruit,
      isFlipped: false,
      isMatched: false,
    }));

    setCards(newCards);
    setSelectedCards([]);
    setIsProcessing(false);
    setMoves(0);
    setMatchedCount(0);
    setElapsedTime(0);
    hasSavedRef.current = false;
    setSaveStatus("idle");
  };

  // 사용자 이름 입력 후 준비 화면으로 이동
  const handleStartLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    initializeDeck();
    setStage("READY");
  };

  // 실제 플레이 시작
  const startGame = () => {
    initializeDeck();
    setStage("PLAYING");
  };

  // 일시정지 / 계속하기 토글
  const togglePause = () => {
    if (stage === "PLAYING") {
      setStage("PAUSED");
    } else if (stage === "PAUSED") {
      setStage("PLAYING");
    }
  };

  // 게임 다시 시작
  const restartGame = () => {
    initializeDeck();
    setStage("PLAYING");
  };

  // 처음으로 (이름 입력 화면)
  const resetToHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("LOGIN");
    setCards([]);
    setSelectedCards([]);
    setElapsedTime(0);
    setMoves(0);
    setMatchedCount(0);
  };

  // 카드 클릭 처리
  const handleCardClick = (index: number) => {
    if (stage !== "PLAYING" || isProcessing) return;
    const clickedCard = cards[index];

    // 이미 뒤집혀있거나 매칭 완료된 카드는 반응하지 않음
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    const newCards = [...cards];
    newCards[index] = { ...clickedCard, isFlipped: true };
    setCards(newCards);

    const newSelected = [...selectedCards, index];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      setMoves((prev) => prev + 1);
      setIsProcessing(true);

      const [firstIdx, secondIdx] = newSelected;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      // 두 카드 일치 시: 뒷면이 아닌 과일 앞면으로 영구 유지
      if (firstCard.fruit.id === secondCard.fruit.id) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, i) =>
              i === firstIdx || i === secondIdx
                ? { ...card, isFlipped: true, isMatched: true }
                : card
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);
          
          const newMatched = matchedCount + 1;
          setMatchedCount(newMatched);
          if (newMatched === FRUITS.length) {
            handleGameWin();
          }
        }, 260);
      } else {
        // 불일치 시 0.85초 후 다시 뒷면으로 복구
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, i) =>
              i === firstIdx || i === secondIdx
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);
        }, 850);
      }
    }
  };

  // .env.local의 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경변수 사용
  const googleScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // 랭킹 항목 인터페이스
  interface RankingItem {
    rank: number;
    name: string;
    score: number;
    finishtime: string;
  }

  const [topRankings, setTopRankings] = useState<RankingItem[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState<boolean>(false);

  // 구글 시트에서 TOP 3 랭킹 가져오기
  const fetchTopRankings = async () => {
    setIsLoadingRankings(true);
    try {
      const res = await fetch("/api/rankings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.top3 && Array.isArray(data.top3)) {
          setTopRankings(data.top3);
        }
      }
    } catch (err) {
      console.error("랭킹 조회 실패:", err);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  // 구글 시트에 게임 결과 전송 (게임 완료 시에만 호출됨, 중단 시에는 호출되지 않음)
  const saveResultToGoogleSheet = async (finalTime: number, finalMoves: number) => {
    if (!googleScriptUrl.trim()) {
      console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL이 설정되어 있지 않습니다.");
      return;
    }

    setSaveStatus("saving");
    try {
      const payload = {
        name: userName,
        score: finalMoves, // score 컬럼: 시도 횟수
        finishtime: formatTime(finalTime), // finishtime 컬럼: mm:ss
      };

      // 구글 앱스 스크립트 웹앱에 결과 POST 전송
      await fetch(googleScriptUrl.trim(), {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("success");

      // 저장 완료 후 구글 시트의 최신 TOP 3 랭킹 조회
      setTimeout(() => {
        fetchTopRankings();
      }, 700);
    } catch (err) {
      console.error("구글 시트 저장 실패:", err);
      setSaveStatus("error");
    }
  };

  // 승리 처리 (게임 완료 시에만 데이터 저장 트리거 - 정확히 1회만 실행되도록 보호)
  const handleGameWin = () => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    setStage("FINISHED");
    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 },
    });

    setBestRecord((prev) => {
      if (!prev || elapsedTime < prev.time) {
        return { name: userName, time: elapsedTime, moves };
      }
      return prev;
    });

    // 랭킹 즉시 1차 조회 (UI 지연 방지)
    fetchTopRankings();

    // 오직 게임을 끝까지 성공했을 때만 구글 시트에 단 1회 저장 및 2차 갱신
    saveResultToGoogleSheet(elapsedTime, moves);
  };

  // 시간 포맷 (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-300 relative overflow-x-hidden selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
      {/* 은은하고 차분한 파스텔 배경 오브 (배경을 밝고 차분한 톤으로 연출) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200/40 dark:bg-indigo-950/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-teal-200/35 dark:bg-emerald-950/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-slate-200/50 dark:bg-zinc-900/40 rounded-full blur-3xl" />
      </div>

      {/* 상단 내비게이션 바 (라이트/다크모드 토글 포함) */}
      <nav className="w-full max-w-lg mx-auto px-4 pt-4 sm:pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍓</span>
          <span className="font-semibold text-sm tracking-tight text-slate-700 dark:text-zinc-200">
            카드 맞추기 게임
          </span>
        </div>

        {/* 라이트/다크모드 스위치 */}
        <button
          onClick={toggleTheme}
          aria-label="테마 전환"
          className="p-2.5 rounded-full glass-panel hover:scale-105 active:scale-95 transition-all text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </nav>

      {/* 중앙 메인 콘텐츠 컨테이너 (모바일 반응형 최적화) */}
      <main className="w-full max-w-lg mx-auto px-4 py-4 sm:py-6 flex-1 flex flex-col items-center justify-center">
        {/* 메인 타이틀 영역 */}
        <header className="text-center mb-5 sm:mb-6 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-panel text-slate-600 dark:text-zinc-300 text-xs font-medium mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 4x4 과일 기억력 퍼즐
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            카드 맞추기 게임
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1.5">
            같은 과일 카드를 두 개 찾아 짝을 맞춰보세요.
          </p>
        </header>

        {/* 1. 사용자 이름 입력 화면 */}
        {stage === "LOGIN" && (
          <Card className="w-full glass-panel border border-white/60 dark:border-white/10 shadow-lg rounded-3xl overflow-hidden animate-in fade-in zoom-in-95">
            <CardHeader className="text-center pb-3 pt-6 sm:pt-8">
              <div className="w-16 h-16 rounded-2xl glass-card-front flex items-center justify-center mx-auto shadow-sm mb-3 text-3xl">
                🍊
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                플레이어 등록
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                게임을 시작할 사용자 이름을 입력해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6 sm:pb-8">
              <form onSubmit={handleStartLogin} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="이름이나 닉네임을 입력하세요"
                    className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-2xl bg-white/70 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-zinc-500/50 transition font-medium backdrop-blur-sm"
                    maxLength={12}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!userName.trim()}
                  className="w-full py-5 sm:py-6 text-sm sm:text-base font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white rounded-2xl shadow-md transition-all active:scale-[0.99] disabled:opacity-40"
                >
                  게임 대기실로 이동 <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* 2. 게임 보드 화면 */}
        {stage !== "LOGIN" && (
          <div className="w-full space-y-3 sm:space-y-4">
            {/* 상태 대시보드 (글래스모피즘) */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl glass-card-front flex items-center justify-center font-bold text-slate-700 dark:text-zinc-200 text-sm shadow-inner">
                  {userName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-zinc-500">플레이어</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-100 max-w-[100px] sm:max-w-[140px] truncate">
                    {userName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 justify-end">
                    <Timer className="w-3.5 h-3.5 text-blue-500" /> 경과 시간
                  </div>
                  <div className="font-mono text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-100">
                    {formatTime(elapsedTime)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 justify-end">
                    <Flame className="w-3.5 h-3.5 text-amber-500" /> 매칭
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-100">
                    {moves}회 <span className="text-[11px] text-slate-400">({matchedCount}/8)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 조작 컨트롤 바 */}
            <div className="glass-panel p-2 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-1.5">
                {stage === "READY" && (
                  <Button
                    size="sm"
                    onClick={startGame}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-medium text-xs sm:text-sm px-3.5 sm:px-4 h-8 sm:h-9 rounded-xl shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 mr-1 fill-current" /> 게임 시작
                  </Button>
                )}

                {(stage === "PLAYING" || stage === "PAUSED") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    className="text-xs sm:text-sm h-8 sm:h-9 rounded-xl glass-panel border-white/50 dark:border-white/10"
                  >
                    {stage === "PLAYING" ? (
                      <>
                        <Pause className="w-3.5 h-3.5 mr-1 text-amber-500" /> 일시 정지
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-1 text-emerald-500 fill-current" /> 계속 하기
                      </>
                    )}
                  </Button>
                )}

                {(stage === "PLAYING" || stage === "PAUSED" || stage === "FINISHED") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={restartGame}
                    className="text-xs sm:text-sm h-8 sm:h-9 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> 다시 시작
                  </Button>
                )}
              </div>

              {/* 처음으로 (이름 입력 화면) */}
              <Button
                variant="outline"
                size="sm"
                onClick={resetToHome}
                className="text-xs sm:text-sm h-8 sm:h-9 rounded-xl glass-panel border-white/50 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
              >
                <HomeIcon className="w-3.5 h-3.5 mr-1" /> 처음으로
              </Button>
            </div>

            {/* 4x4 카드 보드 영역 (유리 질감 + 모바일 반응형 정사각 핏) */}
            <div className="relative glass-panel p-3 sm:p-4 rounded-3xl shadow-xl">
              {/* 일시정지 오버레이 */}
              {stage === "PAUSED" && (
                <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-md z-20 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                  <div className="w-12 h-12 rounded-2xl glass-card-front flex items-center justify-center text-amber-500 mb-3 shadow-md">
                    <Pause className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">게임 일시 정지</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 mb-4">
                    타이머가 멈춰있습니다.
                  </p>
                  <Button
                    onClick={togglePause}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white px-5 py-2 rounded-xl font-semibold shadow-md"
                  >
                    <Play className="w-4 h-4 mr-1.5 fill-current" /> 계속 진행하기
                  </Button>
                </div>
              )}

              {/* 대기 상태 오버레이 */}
              {stage === "READY" && (
                <div className="absolute inset-0 bg-slate-900/10 dark:bg-black/30 backdrop-blur-sm z-20 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl glass-card-front flex items-center justify-center mb-3 shadow-md text-2xl">
                    🎮
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100">준비 완료</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 mb-5 max-w-xs">
                    [게임 시작] 버튼을 누르면 타이머가 작동하고 카드를 선택할 수 있습니다.
                  </p>
                  <Button
                    onClick={startGame}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white px-7 py-2.5 sm:py-3 rounded-2xl font-bold shadow-lg transition active:scale-95"
                  >
                    <Play className="w-4 h-4 mr-1.5 fill-current" /> 게임 시작하기
                  </Button>
                </div>
              )}

              {/* 4x4 그리드 카드 16장 */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 aspect-square max-w-md mx-auto">
                {cards.map((card, index) => {
                  const isVisible = card.isFlipped || card.isMatched;

                  return (
                    <div
                      key={card.instanceId}
                      onClick={() => handleCardClick(index)}
                      className={`relative w-full h-full select-none ${
                        card.isMatched ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      {/* 성공한 카드: 뒷면이 아닌 과일 앞면을 확실하게 영구 유지 */}
                      {card.isMatched ? (
                        <div className="w-full h-full rounded-2xl glass-card-front border-2 border-emerald-400/80 dark:border-emerald-500/60 shadow-md flex flex-col items-center justify-center relative ring-2 ring-emerald-300/30 transition-transform animate-in zoom-in-95">
                          <span className="text-2xl sm:text-3xl md:text-4xl filter drop-shadow-sm">
                            {card.fruit.emoji}
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 sm:mt-1">
                            {card.fruit.name}
                          </span>
                          <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-3.5 sm:w-4 h-3.5 sm:h-4 rounded-full bg-emerald-500 text-white text-[8px] sm:text-[9px] flex items-center justify-center font-bold shadow">
                            ✓
                          </span>
                        </div>
                      ) : (
                        /* 플립 카드 렌더링 (반투명 유리 질감) */
                        <div className="relative w-full h-full perspective-1000">
                          <div
                            className={`w-full h-full rounded-2xl transition-all duration-500 transform-style-3d flex items-center justify-center shadow-sm ${
                              isVisible ? "rotate-y-180" : ""
                            }`}
                          >
                            {/* 카드 뒷면 (유리처럼 반투명하고 흐린 질감) */}
                            <div
                              className={`absolute inset-0 backface-hidden w-full h-full rounded-2xl flex flex-col items-center justify-center glass-card-back transition-all ${
                                stage === "PLAYING"
                                  ? "hover:scale-[1.03] hover:shadow-md active:scale-95 cursor-pointer"
                                  : "opacity-60 cursor-default"
                              }`}
                            >
                              <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-xl bg-white/40 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-zinc-400 text-xs sm:text-sm font-bold shadow-inner border border-white/50 dark:border-white/10">
                                ?
                              </div>
                            </div>

                            {/* 카드 앞면 (선택 중일 때 과일 노출) */}
                            <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-2xl flex flex-col items-center justify-center glass-card-front">
                              <span className="text-2xl sm:text-3xl md:text-4xl filter drop-shadow-sm">
                                {card.fruit.emoji}
                              </span>
                              <span className="text-[10px] sm:text-[11px] font-medium text-slate-700 dark:text-zinc-200 mt-0.5 sm:mt-1">
                                {card.fruit.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 게임 완료 축하 카드 */}
            {stage === "FINISHED" && (
              <Card className="glass-panel border-emerald-400/50 dark:border-emerald-500/30 shadow-xl rounded-3xl animate-in zoom-in-95 overflow-hidden">
                <CardHeader className="text-center pb-2 pt-5">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md mb-2">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl text-slate-900 dark:text-zinc-100 font-extrabold">
                    축하합니다, {userName}님! 🎉
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    모든 과일 카드의 짝을 성공적으로 맞추셨습니다!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5 pb-6">
                  {/* 결과 통계 */}
                  <div className="grid grid-cols-2 gap-2.5 max-w-xs mx-auto text-center">
                    <div className="p-3 rounded-2xl glass-card-front">
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500">완료 시간</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        {formatTime(elapsedTime)}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl glass-card-front">
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500">총 시도 횟수</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        {moves}회
                      </div>
                    </div>
                  </div>

                  {bestRecord && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                      <Award className="w-4 h-4 text-amber-500" />
                      최고 기록: {formatTime(bestRecord.time)} ({bestRecord.moves}회)
                    </div>
                  )}

                  {/* 구글 시트 저장 상태 알림 */}
                  {googleScriptUrl && (
                    <div className="text-center text-xs pt-1">
                      {saveStatus === "saving" && (
                        <span className="text-slate-500 animate-pulse">📊 구글 스프레드시트에 기록 저장 중...</span>
                      )}
                      {saveStatus === "success" && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ 구글 시트에 기록이 저장되었습니다!</span>
                      )}
                      {saveStatus === "error" && (
                        <span className="text-rose-500">⚠ 구글 시트 저장에 실패했습니다.</span>
                      )}
                    </div>
                  )}

                  {/* TOP 3 랭킹 (종료시간 오름차순) */}
                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span>명예의 전당 (종료시간 TOP 3)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">오름차순</span>
                    </div>

                    {isLoadingRankings ? (
                      <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                        구글 시트 랭킹을 집계하고 있습니다...
                      </div>
                    ) : topRankings.length > 0 ? (
                      <div className="space-y-1.5">
                        {topRankings.map((item) => {
                          const medalColor =
                            item.rank === 1
                              ? "bg-amber-400/20 text-amber-600 dark:text-amber-300 border-amber-400/40"
                              : item.rank === 2
                              ? "bg-slate-300/30 text-slate-600 dark:text-slate-300 border-slate-300/40"
                              : "bg-amber-700/15 text-amber-700 dark:text-amber-400 border-amber-700/30";
                          const medalEmoji = item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉";

                          return (
                            <div
                              key={item.rank}
                              className="flex items-center justify-between p-2 rounded-xl glass-card-front text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border ${medalColor}`}>
                                  {medalEmoji}
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-zinc-100 max-w-[110px] truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-400">{item.score}회</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {item.finishtime}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-2.5 text-center text-[11px] text-slate-400">
                        아직 등록된 랭킹 기록이 없습니다.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1 max-w-sm mx-auto">
                    <Button
                      onClick={restartGame}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white py-4 sm:py-5 rounded-2xl font-bold shadow-md text-xs sm:text-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> 다시 플레이
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetToHome}
                      className="flex-1 glass-panel border-white/50 dark:border-white/10 py-4 sm:py-5 rounded-2xl font-medium text-xs sm:text-sm"
                    >
                      <HomeIcon className="w-3.5 h-3.5 mr-1" /> 처음으로
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* 하단 푸터 Copyright 영역 */}
      <footer className="w-full text-center py-4 px-4 text-xs text-slate-400 dark:text-zinc-500 border-t border-slate-200/50 dark:border-zinc-800/50">
        Copyright INU 카드 맞추기 게임 by Seogyun Yim
      </footer>
    </div>
  );
}
