"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

/* ── Form Schema ────────────────────────────────── */
const agentSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(50),
  emoji: z.string().min(1).default("🤖"),
  strategy: z.enum(["TOP_SIGNALS", "COPY_TRADER", "CUSTOM_RULES"]),
  riskProfile: z.enum(["conservative", "moderate", "aggressive"]),
  positionSize: z.number().min(1).max(20),
  maxOpenPositions: z.number().min(1).max(10),
  dailyLossLimit: z.number().min(10).max(500),
  stopLoss: z.number().min(5).max(50),
  takeProfit: z.number().min(10).max(200),
  minConfidence: z.number().min(50).max(95).optional(),
  traderId: z.string().optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

/* ── Emoji Picker Component ─────────────────────── */
const AGENT_EMOJIS = ["🤖", "🚀", "💎", "🎯", "⚡", "🔥", "💰", "🦾", "🧠", "👾"];

function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {AGENT_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`text-3xl p-3 rounded-lg border-2 transition hover:scale-110 ${
            value === emoji ? "border-accent bg-accent/10" : "border-ep-border"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ── Main Wizard Component ──────────────────────── */
export default function AgentCreationWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [createdAgent, setCreatedAgent] = useState<any>(null);
  const [privateKeyDownloaded, setPrivateKeyDownloaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema) as any,
    defaultValues: {
      emoji: "🤖",
      strategy: "TOP_SIGNALS",
      riskProfile: "moderate",
      positionSize: 5,
      maxOpenPositions: 3,
      dailyLossLimit: 50,
      stopLoss: 20,
      takeProfit: 50,
      minConfidence: 75,
    },
  });

  const formData = watch();

  const totalSteps = 7;
  const progress = (currentStep / totalSteps) * 100;

  /* ── Risk Profile Presets ───────────────────────── */
  const RISK_PRESETS = {
    conservative: {
      positionSize: 2,
      maxOpenPositions: 2,
      dailyLossLimit: 25,
      stopLoss: 15,
      takeProfit: 30,
    },
    moderate: {
      positionSize: 5,
      maxOpenPositions: 3,
      dailyLossLimit: 50,
      stopLoss: 20,
      takeProfit: 50,
    },
    aggressive: {
      positionSize: 10,
      maxOpenPositions: 5,
      dailyLossLimit: 100,
      stopLoss: 30,
      takeProfit: 100,
    },
  };

  const applyRiskPreset = (profile: keyof typeof RISK_PRESETS) => {
    const preset = RISK_PRESETS[profile];
    setValue("riskProfile", profile);
    setValue("positionSize", preset.positionSize);
    setValue("maxOpenPositions", preset.maxOpenPositions);
    setValue("dailyLossLimit", preset.dailyLossLimit);
    setValue("stopLoss", preset.stopLoss);
    setValue("takeProfit", preset.takeProfit);
  };

  /* ── Step Navigation ────────────────────────────── */
  const nextStep = () => {
    // Validation for specific steps
    if (currentStep === 1 && !formData.name) {
      toast({ title: "Please enter an agent name", variant: "destructive" });
      return;
    }
    if (currentStep === 5 && !privateKeyDownloaded) {
      toast({
        title: "Download Required",
        description: "You must download your private key before proceeding.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  /* ── Agent Creation ─────────────────────────────── */
  const createAgent = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          emoji: formData.emoji,
          strategyType: formData.strategy,
          strategyConfig: {
            minConfidence: formData.minConfidence,
            traderId: formData.traderId,
          },
          riskConfig: {
            profile: formData.riskProfile,
            positionSize: formData.positionSize,
            maxOpenPositions: formData.maxOpenPositions,
            dailyLossLimit: formData.dailyLossLimit,
            stopLoss: formData.stopLoss,
            takeProfit: formData.takeProfit,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to create agent");

      const agent = await response.json();
      setCreatedAgent(agent);
      toast({ title: "Agent created successfully! 🎉" });
      return agent;
    } catch (error) {
      toast({
        title: "Failed to create agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  /* ── Private Key Download ───────────────────────── */
  const downloadPrivateKey = () => {
    if (!createdAgent?.wallet) return;

    const keyData = {
      agentId: createdAgent.id,
      agentName: createdAgent.name,
      walletAddress: createdAgent.wallet.addresses,
      privateKey: createdAgent.wallet.privateKey,
      warning: "⚠️ KEEP THIS SAFE! Never share your private key with anyone.",
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deja-agent-${createdAgent.name}-key.json`;
    a.click();
    URL.revokeObjectURL(url);

    setPrivateKeyDownloaded(true);
    toast({ title: "Private key downloaded ✅" });
  };

  /* ── Deploy Agent ───────────────────────────────── */
  const deployAgent = async () => {
    if (!createdAgent) return;

    try {
      const response = await fetch(`/api/agents/${createdAgent.id}/start`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to start agent");

      toast({ title: "Agent deployed successfully! 🚀" });
      router.push(`/agents/${createdAgent.id}`);
    } catch (error) {
      toast({
        title: "Failed to deploy agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  /* ── Step 4: Create Wallet & Agent ──────────────── */
  const handleCreateWallet = async () => {
    const agent = await createAgent();
    if (agent) {
      nextStep();
    }
  };

  /* ── Render Step Content ────────────────────────── */
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="DegenAI"
                {...register("name")}
                className="mt-2"
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label>Choose an Emoji</Label>
              <div className="mt-2">
                <EmojiPicker
                  value={formData.emoji}
                  onChange={(emoji) => setValue("emoji", emoji)}
                />
              </div>
            </div>

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-sm text-text-muted">
                <strong>Preview:</strong> {formData.emoji} {formData.name || "Your Agent"}
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Label>Choose a Strategy</Label>

            {[
              {
                value: "TOP_SIGNALS",
                title: "🎯 Top Signals",
                description: "Trade high-confidence AI predictions from Déjà",
              },
              {
                value: "COPY_TRADER",
                title: "👥 Copy Trader",
                description: "Mirror trades from top-performing traders",
              },
              {
                value: "CUSTOM_RULES",
                title: "⚙️ Custom Rules",
                description: "Define your own trading rules and filters",
              },
            ].map((strategy) => (
              <Card
                key={strategy.value}
                className={`cursor-pointer transition hover:border-accent ${
                  formData.strategy === strategy.value ? "border-accent bg-accent/5" : ""
                }`}
                onClick={() => setValue("strategy", strategy.value as any)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{strategy.title}</CardTitle>
                  <CardDescription>{strategy.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}

            {formData.strategy === "TOP_SIGNALS" && (
              <div className="mt-4">
                <Label htmlFor="minConfidence">Minimum Confidence (%)</Label>
                <Slider
                  id="minConfidence"
                  min={50}
                  max={95}
                  step={5}
                  value={[formData.minConfidence || 75]}
                  onValueChange={([value]) => setValue("minConfidence", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">
                  Current: {formData.minConfidence}%
                </p>
              </div>
            )}

            {formData.strategy === "COPY_TRADER" && (
              <div className="mt-4">
                <Label htmlFor="traderId">Trader to Copy</Label>
                <Select
                  value={formData.traderId}
                  onValueChange={(value) => setValue("traderId", value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a trader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gopfan2">gopfan2 (Weather King)</SelectItem>
                    <SelectItem value="trader2">Top Trader #2</SelectItem>
                    <SelectItem value="trader3">Top Trader #3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Label>Risk Profile</Label>

            <div className="grid gap-4">
              {[
                {
                  profile: "conservative",
                  title: "🛡️ Conservative",
                  description: "Low risk, small positions, tight stop losses",
                },
                {
                  profile: "moderate",
                  title: "⚖️ Moderate",
                  description: "Balanced risk-reward, recommended for most users",
                },
                {
                  profile: "aggressive",
                  title: "🚀 Aggressive",
                  description: "Higher risk, larger positions, wider stops",
                },
              ].map((preset) => (
                <Card
                  key={preset.profile}
                  className={`cursor-pointer transition hover:border-accent ${
                    formData.riskProfile === preset.profile ? "border-accent bg-accent/5" : ""
                  }`}
                  onClick={() => applyRiskPreset(preset.profile as any)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{preset.title}</CardTitle>
                    <CardDescription>{preset.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="space-y-4 mt-6 pt-6 border-t border-ep-border">
              <h3 className="text-sm font-semibold text-text-muted uppercase">Custom Settings</h3>

              <div>
                <Label>Position Size (% of balance)</Label>
                <Slider
                  min={1}
                  max={20}
                  value={[formData.positionSize]}
                  onValueChange={([value]) => setValue("positionSize", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">{formData.positionSize}%</p>
              </div>

              <div>
                <Label>Max Open Positions</Label>
                <Slider
                  min={1}
                  max={10}
                  value={[formData.maxOpenPositions]}
                  onValueChange={([value]) => setValue("maxOpenPositions", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">{formData.maxOpenPositions}</p>
              </div>

              <div>
                <Label>Daily Loss Limit ($)</Label>
                <Slider
                  min={10}
                  max={500}
                  step={10}
                  value={[formData.dailyLossLimit]}
                  onValueChange={([value]) => setValue("dailyLossLimit", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">${formData.dailyLossLimit}</p>
              </div>

              <div>
                <Label>Stop Loss (%)</Label>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[formData.stopLoss]}
                  onValueChange={([value]) => setValue("stopLoss", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">{formData.stopLoss}%</p>
              </div>

              <div>
                <Label>Take Profit (%)</Label>
                <Slider
                  min={10}
                  max={200}
                  step={10}
                  value={[formData.takeProfit]}
                  onValueChange={([value]) => setValue("takeProfit", value)}
                  className="mt-2"
                />
                <p className="text-sm text-text-muted mt-1">{formData.takeProfit}%</p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 text-center">
            <div className="text-6xl">💼</div>
            <div>
              <h3 className="text-xl font-bold mb-2">Create Wallet</h3>
              <p className="text-text-muted">
                We'll generate a secure wallet for your agent using MoonPay.
              </p>
            </div>

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 text-left">
              <h4 className="font-semibold mb-2">Your Agent Configuration:</h4>
              <div className="space-y-1 text-sm text-text-muted">
                <p>• Name: {formData.emoji} {formData.name}</p>
                <p>• Strategy: {formData.strategy.replace(/_/g, " ")}</p>
                <p>• Risk: {formData.riskProfile}</p>
                <p>• Position Size: {formData.positionSize}%</p>
                <p>• Daily Loss Limit: ${formData.dailyLossLimit}</p>
              </div>
            </div>

            <Button
              onClick={handleCreateWallet}
              disabled={isCreating}
              className="w-full"
              size="lg"
            >
              {isCreating ? "Creating..." : "Create Agent & Wallet"}
            </Button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 text-center">
            <div className="text-6xl">🔑</div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-red-500">⚠️ CRITICAL: Backup Private Key</h3>
              <p className="text-text-muted">
                Download and securely store your private key. This is your ONLY way to recover
                your wallet. We cannot recover it for you.
              </p>
            </div>

            {createdAgent && (
              <Card className="p-6 bg-red-500/10 border-red-500/20">
                <div className="space-y-4">
                  <div>
                    <Label>Wallet Address (Polygon)</Label>
                    <p className="font-mono text-sm mt-1">
                      {createdAgent.wallet?.addresses?.ethereum || "Generating..."}
                    </p>
                  </div>

                  <Button
                    onClick={downloadPrivateKey}
                    variant={privateKeyDownloaded ? "outline" : "default"}
                    className="w-full"
                    size="lg"
                  >
                    {privateKeyDownloaded ? "✅ Downloaded" : "📥 Download Private Key"}
                  </Button>

                  {privateKeyDownloaded && (
                    <p className="text-xs text-green-500">
                      ✅ Key downloaded. Store it in a safe place (password manager, encrypted drive).
                    </p>
                  )}
                </div>
              </Card>
            )}

            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-left">
              <h4 className="font-semibold text-yellow-500 mb-2">Security Warning:</h4>
              <ul className="space-y-1 text-xs text-text-muted">
                <li>• Never share your private key with anyone</li>
                <li>• Store it in a password manager or encrypted drive</li>
                <li>• If you lose it, you lose access to your funds forever</li>
                <li>• Déjà cannot recover lost keys</li>
              </ul>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 text-center">
            <div className="text-6xl">💰</div>
            <div>
              <h3 className="text-xl font-bold mb-2">Fund Your Wallet</h3>
              <p className="text-text-muted">
                Deposit USDC.e (Polygon) to start trading. Minimum recommended: $50
              </p>
            </div>

            {createdAgent && (
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label>Deposit Address (Polygon)</Label>
                    <div className="mt-2 p-3 bg-ep-surface rounded border border-ep-border">
                      <p className="font-mono text-xs break-all">
                        {createdAgent.wallet?.addresses?.ethereum}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAgent.wallet?.addresses?.ethereum);
                        toast({ title: "Address copied!" });
                      }}
                    >
                      📋 Copy Address
                    </Button>

                    <Button
                      className="flex-1"
                      onClick={() => {
                        window.open("https://buy.moonpay.com", "_blank");
                      }}
                    >
                      💳 Buy with Card
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 text-left">
              <h4 className="font-semibold mb-2">How to Fund:</h4>
              <ol className="space-y-1 text-sm text-text-muted list-decimal list-inside">
                <li>Copy the wallet address above</li>
                <li>Send USDC.e on Polygon network to this address</li>
                <li>Or click "Buy with Card" to purchase USDC directly</li>
                <li>Wait 1-2 minutes for confirmation</li>
                <li>Then proceed to deploy your agent</li>
              </ol>
            </div>

            <p className="text-xs text-text-muted">
              Current Balance: ${createdAgent?.wallet?.balance?.toFixed(2) || "0.00"} USDC
            </p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 text-center">
            <div className="text-6xl">🚀</div>
            <div>
              <h3 className="text-xl font-bold mb-2">Ready to Trade!</h3>
              <p className="text-text-muted">
                Your agent is configured and funded. Deploy to start autonomous trading.
              </p>
            </div>

            {createdAgent && (
              <Card className="p-6">
                <div className="space-y-4 text-left">
                  <div>
                    <Label>Agent Summary</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <p>🤖 <strong>Name:</strong> {createdAgent.emoji} {createdAgent.name}</p>
                      <p>🎯 <strong>Strategy:</strong> {createdAgent.strategyType.replace(/_/g, " ")}</p>
                      <p>⚖️ <strong>Risk:</strong> {createdAgent.riskConfig.profile}</p>
                      <p>💰 <strong>Balance:</strong> ${createdAgent.wallet?.balance?.toFixed(2) || "0.00"} USDC</p>
                      <p>📊 <strong>Position Size:</strong> {createdAgent.riskConfig.positionSize}%</p>
                      <p>🛡️ <strong>Daily Limit:</strong> ${createdAgent.riskConfig.dailyLossLimit}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Button
              onClick={deployAgent}
              className="w-full"
              size="lg"
            >
              🚀 Deploy Agent
            </Button>

            <p className="text-xs text-text-muted">
              Your agent will start trading automatically based on your configuration.
              You can pause or stop it anytime from the dashboard.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-ep-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Create Trading Agent</h1>
            <Badge variant="outline">
              Step {currentStep} / {totalSteps}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-8">
              {renderStep()}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 1 || isCreating}
          >
            ← Back
          </Button>

          {currentStep < 4 && (
            <Button onClick={nextStep}>
              Next →
            </Button>
          )}

          {currentStep === 5 && (
            <Button onClick={nextStep} disabled={!privateKeyDownloaded}>
              Next →
            </Button>
          )}

          {currentStep === 6 && (
            <Button onClick={nextStep}>
              Continue to Deploy →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
