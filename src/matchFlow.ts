import type { TeamId } from "./config";

export type MatchPhase = "countdown" | "playing" | "ended";
export type MatchWinner = TeamId | "draw" | null;

export class MatchFlow {
  phase: MatchPhase = "countdown";
  countdownRemaining: number;
  timeRemaining: number;
  winner: MatchWinner = null;

  constructor(
    private readonly scoreLimit: number,
    matchDurationMs: number,
    countdownMs: number,
  ) {
    this.timeRemaining = matchDurationMs;
    this.countdownRemaining = countdownMs;
  }

  update(ms: number, redScore: number, blueScore: number) {
    if (this.phase === "ended") return;
    if (this.finishFromScore(redScore, blueScore)) return;

    if (this.phase === "countdown") {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - ms);
      if (this.countdownRemaining === 0) this.phase = "playing";
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - ms);
    if (this.timeRemaining > 0) return;
    this.finish(redScore === blueScore ? "draw" : redScore > blueScore ? "red" : "blue");
  }

  get countdownValue() {
    return Math.max(1, Math.ceil(this.countdownRemaining / 1000));
  }

  private finishFromScore(redScore: number, blueScore: number) {
    if (redScore < this.scoreLimit && blueScore < this.scoreLimit) return false;
    this.finish(redScore > blueScore ? "red" : "blue");
    return true;
  }

  private finish(winner: Exclude<MatchWinner, null>) {
    this.phase = "ended";
    this.winner = winner;
  }
}
