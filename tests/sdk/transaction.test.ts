import { parseProgramLogs } from "../../src/utils/transaction";

describe("parseProgramLogs", () => {
  it("should return 'Invalid program logs' for invalid logs", () => {
    expect(parseProgramLogs([], false)).toBe("Invalid program logs");
  });

  it("should extract Anchor error message", () => {
    const logs = [
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP invoke [1]",
      "Program log: AnchorError caused by account: vault. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.",
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP consumed 5000 of 200000 compute units",
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP failed: custom program error: 0xbc4",
    ];
    expect(parseProgramLogs(logs, false)).toBe(
      "The program expected this account to be already initialized.",
    );
  });

  it("should extract error message with leading whitespace", () => {
    const logs = ["Program log: Error Message:   Some spaced error  "];
    expect(parseProgramLogs(logs, false)).toBe("Some spaced error");
  });

  it("should detect insufficient funds error", () => {
    const logs = [
      "Program 11111111111111111111111111111111 invoke [2]",
      "Transfer: insufficient lamports 500, need 1000",
      "Program 11111111111111111111111111111111 failed: custom program error: 0x1",
    ];
    expect(parseProgramLogs(logs, false)).toBe(
      "Transfer: insufficient lamports 500, need 1000",
    );
  });

  it("should detect insufficient funds (Error: insufficient funds)", () => {
    const logs = [
      "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [2]",
      "Error: insufficient funds",
      "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed",
    ];
    expect(parseProgramLogs(logs, false)).toBe("Error: insufficient funds");
  });

  it("should resolve custom program error code", () => {
    const logs = [
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [1]",
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 failed: custom program error: 0x1771",
    ];
    expect(parseProgramLogs(logs, false)).toBe(
      "Jupiter swap failed: Slippage tolerance exceeded",
    );
  });

  it("should fall back to hex code for unknown custom error", () => {
    const logs = [
      "Program 1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM invoke [1]",
      "Program log: custom program error: 0xFFFF",
      "Program 1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM failed: custom program error: 0xFFFF",
    ];
    expect(parseProgramLogs(logs, false)).toBe("Program error: 0xFFFF");
  });

  it("should return 'Unknown error' when no recognizable error pattern", () => {
    const logs = [
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP invoke [1]",
      "Program log: Instruction: Initialize",
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP consumed 3000 of 200000 compute units",
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP success",
    ];
    expect(parseProgramLogs(logs, false)).toBe("Unknown error");
  });

  it("should prioritize Anchor error message over custom error code", () => {
    const logs = [
      "Program log: AnchorError occurred. Error Code: InvalidInput. Error Number: 6000. Error Message: Invalid input provided.",
      "Program GLAMpLuXu78TA4ao3DPZvT1zQ7woxoQ8ahdYbhnqY9mP failed: custom program error: 0x1770",
    ];
    // "Error Message:" appears first, so it should be returned
    expect(parseProgramLogs(logs, false)).toBe("Invalid input provided.");
  });

  it("should handle custom error code with lowercase hex", () => {
    const logs = [
      "Program 1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM invoke [1]",
      "Program 1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM failed: custom program error: 0xabcd",
    ];
    expect(parseProgramLogs(logs, false)).toBe("Program error: 0xabcd");
  });
});
