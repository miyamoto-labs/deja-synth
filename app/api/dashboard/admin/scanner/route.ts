import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function checkAdminAuth(request: Request): NextResponse | null {
  if (!ADMIN_KEY) {
    return NextResponse.json({ error: "Admin access not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Status file for tracking scan state (in /tmp for ephemerality)
const STATUS_FILE = "/tmp/easypoly-scan-status.json";
const LOG_FILE = "/tmp/easypoly-scan-output.log";

// Scanner script location (relative to workspace root)
const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const SCANNER_SCRIPT = path.join(WORKSPACE_ROOT, "easypoly_pick_generator.py");

interface ScanStatus {
  status: "idle" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  pid?: number;
  config?: Record<string, any>;
  exitCode?: number | null;
  error?: string;
  picksFound?: number;
  summary?: string;
}

function getStatus(): ScanStatus {
  try {
    if (existsSync(STATUS_FILE)) {
      const raw = readFileSync(STATUS_FILE, "utf-8");
      const status = JSON.parse(raw) as ScanStatus;

      // If status is "running", check if the process is still alive
      if (status.status === "running" && status.pid) {
        try {
          process.kill(status.pid, 0); // Test if process exists
        } catch {
          // Process no longer running — it crashed without cleanup
          status.status = "failed";
          status.completedAt = new Date().toISOString();
          status.error = "Process terminated unexpectedly";
          writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
        }
      }

      return status;
    }
  } catch {}
  return { status: "idle" };
}

function setStatus(status: ScanStatus) {
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

/**
 * GET /api/dashboard/admin/scanner
 * Returns current scan status + recent log output
 */
export async function GET(request: Request) {
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  const status = getStatus();

  // Read last N lines of log output
  let logOutput = "";
  try {
    if (existsSync(LOG_FILE)) {
      const raw = readFileSync(LOG_FILE, "utf-8");
      const lines = raw.split("\n");
      logOutput = lines.slice(-200).join("\n"); // Last 200 lines
    }
  } catch {}

  return NextResponse.json({
    ...status,
    log: logOutput,
  });
}

/**
 * POST /api/dashboard/admin/scanner
 * Start a new scan or stop a running scan
 *
 * Body: { action: "start" | "stop", config?: { enhanced, picks, dbLimit, minScore, category, dryRun, noTelegram, resolve } }
 */
export async function POST(request: Request) {
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, config } = body;

    if (action === "stop") {
      return handleStop();
    }

    if (action === "start") {
      return handleStart(config || {});
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'start' or 'stop'" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

function handleStop(): NextResponse {
  const status = getStatus();
  if (status.status !== "running" || !status.pid) {
    return NextResponse.json({ error: "No scan is currently running" }, { status: 400 });
  }

  try {
    process.kill(status.pid, "SIGTERM");
    setStatus({
      ...status,
      status: "failed",
      completedAt: new Date().toISOString(),
      error: "Stopped by user",
    });
    return NextResponse.json({ success: true, message: "Scan stopped" });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to stop scan: ${err.message}` },
      { status: 500 }
    );
  }
}

function handleStart(config: Record<string, any>): NextResponse {
  // Check if already running
  const current = getStatus();
  if (current.status === "running") {
    return NextResponse.json(
      { error: "A scan is already running", pid: current.pid },
      { status: 409 }
    );
  }

  // Check scanner script exists
  if (!existsSync(SCANNER_SCRIPT)) {
    return NextResponse.json(
      { error: `Scanner script not found at ${SCANNER_SCRIPT}` },
      { status: 500 }
    );
  }

  // Build command arguments
  const args: string[] = [SCANNER_SCRIPT];

  if (config.enhanced) args.push("--enhanced");
  if (config.picks) args.push("--picks", String(config.picks));
  if (config.dbLimit) args.push("--db-limit", String(config.dbLimit));
  if (config.minScore) args.push("--min-score", String(config.minScore));
  if (config.category) args.push("--category", config.category);
  if (config.dryRun) args.push("--dry-run");
  if (config.noTelegram) args.push("--no-telegram");
  if (config.noOrderbook) args.push("--no-orderbook");
  if (config.resolve) args.push("--resolve");
  if (config.resolveOnly) args.push("--resolve-only");
  args.push("--verbose"); // Always verbose for the log

  // Clear previous log
  writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Starting scanner...\n` +
    `Command: python3 ${args.join(" ")}\n` +
    `${"─".repeat(60)}\n`);

  // Spawn the Python process
  const child = spawn("python3", args, {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1", // Force unbuffered output
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Write status
  const scanStatus: ScanStatus = {
    status: "running",
    startedAt: new Date().toISOString(),
    pid: child.pid,
    config,
  };
  setStatus(scanStatus);

  // Pipe stdout/stderr to log file
  child.stdout?.on("data", (data: Buffer) => {
    try {
      appendFileSync(LOG_FILE, data.toString());
    } catch {}
  });

  child.stderr?.on("data", (data: Buffer) => {
    try {
      appendFileSync(LOG_FILE, data.toString());
    } catch {}
  });

  child.on("close", (code: number | null) => {
    try {
      const endMsg = `\n${"─".repeat(60)}\n[${new Date().toISOString()}] Scanner exited with code ${code}\n`;
      appendFileSync(LOG_FILE, endMsg);

      // Parse results for summary
      let picksFound = 0;
      let summary = "";
      try {
        const resultsPath = path.join(WORKSPACE_ROOT, "easypoly", "generator_results.json");
        if (existsSync(resultsPath)) {
          const results = JSON.parse(readFileSync(resultsPath, "utf-8"));
          picksFound = results.supabase_result?.inserted || results.db_picks?.length || 0;
          if (results.scan_metadata?.summary?.top_pick) {
            const top = results.scan_metadata.summary.top_pick;
            summary = `Top: ${top.question?.slice(0, 60)} (${top.direction} @ ${top.entry_price?.toFixed(3)})`;
          }
        }
      } catch {}

      setStatus({
        status: code === 0 ? "completed" : "failed",
        startedAt: scanStatus.startedAt,
        completedAt: new Date().toISOString(),
        pid: child.pid,
        config,
        exitCode: code,
        picksFound,
        summary,
        error: code !== 0 ? `Exit code ${code}` : undefined,
      });
    } catch {}
  });

  child.on("error", (err: Error) => {
    try {
      appendFileSync(LOG_FILE, `\n[ERROR] ${err.message}\n`);
      setStatus({
        ...scanStatus,
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err.message,
      });
    } catch {}
  });

  // Unref so the API route can return immediately
  child.unref();

  return NextResponse.json({
    success: true,
    message: "Scan started",
    pid: child.pid,
    config,
  });
}
