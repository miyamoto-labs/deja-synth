/**
 * Production Monitoring & Alerts
 * 
 * Error tracking, performance monitoring, and alert system
 * for EasyPoly agent trading system
 */

/* ── Alert Types ─────────────────────────────────── */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface Alert {
  level: AlertLevel;
  title: string;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

/* ── Discord Webhook ─────────────────────────────── */
const DISCORD_WEBHOOK_URL = process.env.DISCORD_ALERTS_WEBHOOK;

export async function sendDiscordAlert(alert: Alert): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('Discord webhook not configured, skipping alert');
    return;
  }
  
  const emoji = {
    [AlertLevel.INFO]: 'ℹ️',
    [AlertLevel.WARNING]: '⚠️',
    [AlertLevel.ERROR]: '🔴',
    [AlertLevel.CRITICAL]: '🚨',
  }[alert.level];
  
  const color = {
    [AlertLevel.INFO]: 0x3498db,
    [AlertLevel.WARNING]: 0xf39c12,
    [AlertLevel.ERROR]: 0xe74c3c,
    [AlertLevel.CRITICAL]: 0x9b59b6,
  }[alert.level];
  
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${emoji} ${alert.title}`,
          description: alert.message,
          color,
          fields: alert.context ? Object.entries(alert.context).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true,
          })) : [],
          timestamp: alert.timestamp.toISOString(),
          footer: {
            text: 'EasyPoly Agent System',
          },
        }],
      }),
    });
  } catch (error) {
    console.error('Failed to send Discord alert:', error);
  }
}

/* ── Email Alerts ────────────────────────────────── */
export async function sendEmailAlert(
  to: string,
  alert: Alert
): Promise<void> {
  // TODO: Implement email alerts (SendGrid, Resend, etc.)
  console.warn('Email alerts not yet implemented');
  console.log('Would send email to:', to, alert);
}

/* ── Agent Alerts ────────────────────────────────── */

export async function alertAgentCrashed(
  agentId: string,
  agentName: string,
  error: string
): Promise<void> {
  await sendDiscordAlert({
    level: AlertLevel.CRITICAL,
    title: 'Agent Crashed',
    message: `Agent "${agentName}" has crashed and stopped trading.`,
    context: {
      agentId,
      agentName,
      error,
    },
    timestamp: new Date(),
  });
}

export async function alertTradeFailed(
  agentId: string,
  agentName: string,
  marketTitle: string,
  error: string
): Promise<void> {
  await sendDiscordAlert({
    level: AlertLevel.ERROR,
    title: 'Trade Execution Failed',
    message: `Failed to execute trade for "${agentName}" on market "${marketTitle}".`,
    context: {
      agentId,
      agentName,
      marketTitle,
      error,
    },
    timestamp: new Date(),
  });
}

export async function alertProfitTarget(
  agentId: string,
  agentName: string,
  totalPnL: number,
  roi: number
): Promise<void> {
  await sendDiscordAlert({
    level: AlertLevel.INFO,
    title: '🎉 Profit Target Hit',
    message: `Agent "${agentName}" has reached a profit milestone!`,
    context: {
      agentId,
      agentName,
      'Total P&L': `$${totalPnL.toFixed(2)}`,
      ROI: `${roi.toFixed(2)}%`,
    },
    timestamp: new Date(),
  });
}

export async function alertLossLimit(
  agentId: string,
  agentName: string,
  totalLoss: number
): Promise<void> {
  await sendDiscordAlert({
    level: AlertLevel.WARNING,
    title: 'Loss Limit Reached',
    message: `Agent "${agentName}" has hit its daily loss limit and been paused.`,
    context: {
      agentId,
      agentName,
      'Total Loss': `$${Math.abs(totalLoss).toFixed(2)}`,
    },
    timestamp: new Date(),
  });
}

/* ── Performance Monitoring ──────────────────────── */

interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}

const performanceMetrics: PerformanceMetric[] = [];

export function trackPerformance(
  operation: string,
  duration: number,
  success: boolean,
  error?: string
): void {
  performanceMetrics.push({
    operation,
    duration,
    success,
    error,
  });
  
  // Keep only last 1000 metrics
  if (performanceMetrics.length > 1000) {
    performanceMetrics.shift();
  }
  
  // Alert if operation is too slow
  if (duration > 5000) { // 5 seconds
    sendDiscordAlert({
      level: AlertLevel.WARNING,
      title: 'Slow Operation Detected',
      message: `Operation "${operation}" took ${(duration / 1000).toFixed(2)}s to complete.`,
      context: {
        operation,
        duration: `${duration}ms`,
        success: String(success),
      },
      timestamp: new Date(),
    });
  }
}

export function getPerformanceMetrics(operation?: string): PerformanceMetric[] {
  if (operation) {
    return performanceMetrics.filter(m => m.operation === operation);
  }
  return performanceMetrics;
}

/* ── Error Tracking ──────────────────────────────── */

export async function trackError(
  error: Error,
  context?: Record<string, any>
): Promise<void> {
  console.error('Tracked error:', error, context);
  
  // TODO: Integrate with Sentry or similar
  // For now, just send Discord alert for critical errors
  
  await sendDiscordAlert({
    level: AlertLevel.ERROR,
    title: 'Application Error',
    message: error.message,
    context: {
      name: error.name,
      stack: error.stack?.split('\n')[0] || 'No stack trace',
      ...context,
    },
    timestamp: new Date(),
  });
}

/* ── Health Check ─────────────────────────────────── */

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Date;
  checks: {
    database: boolean;
    polymarket: boolean;
    moonpay: boolean;
  };
  stats: {
    activeAgents: number;
    totalTrades24h: number;
    errorRate: number;
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  // TODO: Implement actual health checks
  // For now, return mock healthy status
  
  return {
    status: 'healthy',
    timestamp: new Date(),
    checks: {
      database: true,
      polymarket: true,
      moonpay: true,
    },
    stats: {
      activeAgents: 0,
      totalTrades24h: 0,
      errorRate: 0,
    },
  };
}
