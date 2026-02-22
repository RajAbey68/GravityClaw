import path from "node:path";
import { getEnv } from "@/src/server/env";
import { SQLiteMemoryDB } from "@/src/core/memory/db";
import { SessionRepository } from "@/src/core/memory/repositories/sessions";
import { EventRepository } from "@/src/core/memory/repositories/events";
import { MemoryRepository } from "@/src/core/memory/repositories/memories";
import { ForgeRepository } from "@/src/core/memory/repositories/forge";
import { AuditRepository } from "@/src/core/memory/repositories/audit";
import { CollaborationRepository } from "@/src/core/memory/repositories/collaboration";
import { CallRepository } from "@/src/core/memory/repositories/calls";
import { SkillRepository } from "@/src/core/memory/repositories/skills";
import { ProactiveRepository } from "@/src/core/memory/repositories/proactive";
import { WorkspaceRepository } from "@/src/core/memory/repositories/workspaces";
import { ConversationRepository } from "@/src/core/memory/repositories/conversations";
import { MissionRepository } from "@/src/core/memory/repositories/mission";
import { HiveRepository } from "@/src/core/memory/repositories/hive";
import { ProviderRegistry } from "@/src/core/providers/provider-registry";
import { ToolRegistry } from "@/src/core/tools/registry";
import { healthCheckTool } from "@/src/core/tools/builtins/health-check";
import { createMemorySearchTool } from "@/src/core/tools/builtins/memory-search";
import { createMemoryWriteTool } from "@/src/core/tools/builtins/memory-write";
import { createFileWriteTool } from "@/src/core/tools/builtins/file-write";
import { createFileOpsTools } from "@/src/core/tools/builtins/file-ops";
import { mediaGenerateTool } from "@/src/core/tools/builtins/media-generate";
import { createShellExecTool } from "@/src/core/tools/builtins/shell-exec";
import { createBrowserTools } from "@/src/core/tools/builtins/browser";
import { BrowserManager } from "@/src/core/browser/browser-manager";
import { createWebSearchTool } from "@/src/core/tools/builtins/web-search";
import { createSchedulerTools } from "@/src/core/tools/builtins/scheduler";
import { createHiveTools } from "@/src/core/tools/builtins/hive-tools";
import { createVoiceTools } from "@/src/core/tools/builtins/voice-tools";
import { VoiceManager } from "@/src/core/voice/voice-manager";
import { MCPBridge } from "@/src/core/tools/mcp-bridge";
import { SystemEventBus } from "@/src/core/interface/websocket/event-bus";
import { AgentRuntime } from "@/src/core/runtime/agent-runtime";
import { AgentLifecycle } from "@/src/core/orchestrator/lifecycle";
import { TerminalManager } from "@/src/core/infrastructure/terminal-manager";
import { AgentFilesystem } from "@/src/core/infrastructure/agent-fs";
import { ForgeController } from "@/src/core/forge/forge-controller";
import { Orchestrator } from "@/src/core/orchestrator/orchestrator";
import { HiveOrchestrator } from "@/src/core/orchestrator/hive-orchestrator";
import { SwarmEngine } from "@/src/core/orchestrator/swarm-engine";
import { LiveFeedManager } from "@/src/core/live-feed/live-feed-manager";
import { AuditService } from "@/src/core/audit/audit-service";
import { DocSyncService } from "@/src/core/docs/doc-sync-service";
import { SkillService } from "@/src/core/skills/skill-service";
import { TelegramPollingClient } from "@/src/core/interface/telegram/polling-client";
import { ElevenLabsAdapter } from "@/src/core/interface/voice/elevenlabs";
import { TwilioAdapter } from "@/src/core/interface/voice/twilio";
import { SpeechToTextAdapter } from "@/src/core/interface/voice/stt";
import { CallCoordinator } from "@/src/core/interface/voice/call-coordinator";
import { ProactiveEngine } from "@/src/core/proactive/proactive-engine";
import { MemoryEvolutionEngine } from "@/src/core/memory/evolution";
import { MultimodalMemoryProcessor } from "@/src/core/memory/multimodal";
import { PineconeSyncService } from "@/src/core/memory/pinecone";
import { HeartbeatManager } from "@/src/core/proactive/heartbeat-manager";
import { RecommendationEngine } from "@/src/core/proactive/recommendation-engine";
import { MeshOrchestrator } from "@/src/core/swarm/mesh-orchestrator";
import { createMeshTools } from "@/src/core/tools/builtins/mesh-tools";
import { publishEvent } from "@/src/core/interface/websocket/publisher";

export interface AppContainer {
  env: ReturnType<typeof getEnv>;
  db: SQLiteMemoryDB;
  sessions: SessionRepository;
  events: EventRepository;
  memories: MemoryRepository;
  forgeRepo: ForgeRepository;
  auditRepo: AuditRepository;
  collaboration: CollaborationRepository;
  calls: CallRepository;
  skillRepo: SkillRepository;
  proactiveRepo: ProactiveRepository;
  workspaces: WorkspaceRepository;
  conversations: ConversationRepository;
  mission: MissionRepository;
  hiveRepo: HiveRepository;
  providers: ProviderRegistry;
  tools: ToolRegistry;
  mcp: MCPBridge;
  eventBus: SystemEventBus;
  audit: AuditService;
  docs: DocSyncService;
  skills: SkillService;
  runtime: AgentRuntime;
  lifecycle: AgentLifecycle;
  forge: ForgeController;
  orchestrator: Orchestrator;
  hive: HiveOrchestrator;
  swarm: SwarmEngine;
  telegram: TelegramPollingClient;
  elevenLabs: ElevenLabsAdapter;
  stt: SpeechToTextAdapter;
  twilio: TwilioAdapter;
  callCoordinator: CallCoordinator;
  proactive: ProactiveEngine;
  evolution: MemoryEvolutionEngine;
  multimodal: MultimodalMemoryProcessor;
  pinecone: PineconeSyncService;
  browser: BrowserManager;
  terminal: TerminalManager;
  fs: AgentFilesystem;
  liveFeed: LiveFeedManager;
  voice: VoiceManager;
  heartbeat: HeartbeatManager;
  recommendations: RecommendationEngine;
  mesh: MeshOrchestrator;
}

declare global {
  var __gravityClawContainer: Promise<AppContainer> | undefined;
}

async function buildContainer(): Promise<AppContainer> {
  const env = getEnv();
  const db = new SQLiteMemoryDB(env.DATABASE_PATH);
  await db.init();

  const sessions = new SessionRepository(db);
  const events = new EventRepository(db);
  const memories = new MemoryRepository(db);
  const forgeRepo = new ForgeRepository(db);
  const auditRepo = new AuditRepository(db);
  const collaboration = new CollaborationRepository(db);
  const calls = new CallRepository(db);
  const skillRepo = new SkillRepository(db);
  const proactiveRepo = new ProactiveRepository(db);
  const workspaces = new WorkspaceRepository(db);
  const conversations = new ConversationRepository(db);
  const mission = new MissionRepository(db);
  const hiveRepo = new HiveRepository(db);

  const eventBus = new SystemEventBus();
  const docs = new DocSyncService();
  const audit = new AuditService(auditRepo, eventBus);
  const skills = new SkillService(skillRepo);

  const providers = new ProviderRegistry(memories, workspaces, {
    currentProvider: env.GC_DEFAULT_PROVIDER,
    currentModel: env.GC_DEFAULT_MODEL,
    openaiKey: env.OPENAI_API_KEY,
    anthropicKey: env.ANTHROPIC_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
    xaiKey: env.XAI_API_KEY,
    deepseekKey: env.DEEPSEEK_API_KEY,
    groqKey: env.GROQ_API_KEY,
    openrouterKey: env.OPENROUTER_API_KEY,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaEnabled: env.ollamaEnabled
  }, eventBus);

  await providers.init();

  const browser = new BrowserManager(path.dirname(env.DATABASE_PATH));
  const terminal = new TerminalManager();
  const fs = new AgentFilesystem(path.dirname(env.DATABASE_PATH));

  const tools = new ToolRegistry();
  tools.register(healthCheckTool);
  tools.register(createMemorySearchTool(memories));
  tools.register(createMemoryWriteTool(memories));
  tools.register(createFileWriteTool());
  createFileOpsTools({ audit }).forEach((tool) => tools.register(tool));
  tools.register(mediaGenerateTool);
  tools.register(createWebSearchTool());
  tools.register(createShellExecTool());
  if (env.browserAutomationEnabled) {
    createBrowserTools(browser).forEach((tool) => tools.register(tool));
  }

  const serializedToolConfigs = await memories.getSetting("tools.config");
  if (serializedToolConfigs) {
    try {
      tools.loadConfigs(JSON.parse(serializedToolConfigs) as Record<string, { enabled: boolean; requireConfirmation: boolean }>);
    } catch {
      // keep defaults if setting is invalid
    }
  }
  if (tools.has("shell_exec")) {
    tools.setConfig("shell_exec", {
      enabled: env.shellExecEnabled,
      requireConfirmation: true
    });
  }
  const mcp = new MCPBridge(env.mcpEnabled);
  await mcp.init(tools);

  await skills.syncFromFilesystem();

  const runtime = new AgentRuntime(
    sessions,
    memories,
    events,
    providers,
    tools,
    eventBus,
    env.GC_MAX_ITERATIONS,
    skills
  );

  const lifecycle = new AgentLifecycle(memories);
  await lifecycle.init();
  await workspaces.ensureDefault();
  await lifecycle.ensureWorkspace("default");
  const forge = new ForgeController(eventBus, env.forgeEnabled, forgeRepo, tools, audit, docs);
  await forge.init();
  const orchestrator = new Orchestrator(
    runtime,
    lifecycle,
    collaboration,
    eventBus,
    forge,
    env.GC_MAX_GROUP_ROUNDS
  );
  const hive = new HiveOrchestrator(orchestrator, hiveRepo, eventBus);
  const swarm = new SwarmEngine(orchestrator, hiveRepo, eventBus);
  const liveFeed = new LiveFeedManager(eventBus, hiveRepo);
  liveFeed.init();

  createHiveTools(hive, swarm).forEach((tool) => tools.register(tool));

  const voice = new VoiceManager(eventBus);
  createVoiceTools(voice, hiveRepo).forEach((tool) => tools.register(tool));

  const mesh = new MeshOrchestrator(eventBus, orchestrator, hiveRepo);
  createMeshTools(orchestrator).forEach((tool) => tools.register(tool));

  const elevenLabs = new ElevenLabsAdapter(env.ELEVENLABS_API_KEY, env.ELEVENLABS_VOICE_ID);
  const stt = new SpeechToTextAdapter(env.OPENAI_API_KEY);
  const twilio = new TwilioAdapter(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM_NUMBER);
  const callCoordinator = new CallCoordinator(
    twilio,
    calls,
    eventBus,
    env.GC_PUBLIC_BASE_URL,
    async (input) =>
      orchestrator.run({
        agentId: input.agentId,
        message: input.message,
        mode: input.mode,
        source: "ui",
        chatId: input.chatId,
        roomId: input.chatId,
        workspaceId: input.workspaceId
      })
  );

  const proactive = new ProactiveEngine(
    proactiveRepo,
    sessions,
    eventBus,
    async (input) =>
      orchestrator.run({
        agentId: input.agentId,
        message: input.message,
        mode: input.mode,
        source: "ui",
        chatId: "proactive",
        roomId: `proactive:${input.agentId}`,
        workspaceId: input.workspaceId
      }),
    env.proactiveEnabled
  );
  const persistedProactiveEnabled = await memories.getSetting("global.proactiveEnabled");
  if (persistedProactiveEnabled) {
    proactive.setEnabled(["1", "true", "yes", "on"].includes(persistedProactiveEnabled.toLowerCase()));
  }
  proactive.start();
  createSchedulerTools(proactive).forEach((tool) => tools.register(tool));

  const heartbeat = new HeartbeatManager(eventBus, hiveRepo);
  const recommendations = new RecommendationEngine(eventBus, hiveRepo);
  heartbeat.start();

  const telegram = new TelegramPollingClient({
    botToken: env.TELEGRAM_BOT_TOKEN,
    pollIntervalMs: env.TELEGRAM_POLL_INTERVAL_MS,
    allowedUsers: env.allowedTelegramUsers,
    orchestrator,
    eventBus,
    elevenLabs,
    stt
  });

  const evolution = new MemoryEvolutionEngine(
    memories,
    eventBus,
    async (req) => orchestrator.run({ ...req, source: "ui", chatId: "evolution" })
  );

  const multimodal = new MultimodalMemoryProcessor(memories);

  const pinecone = new PineconeSyncService(
    memories,
    providers.allProviders[env.GC_DEFAULT_PROVIDER], // Use default provider for embeddings
    eventBus,
    {
      apiKey: env.PINECONE_API_KEY,
      indexName: env.PINECONE_INDEX,
      enabled: env.pineconeEnabled
    }
  );

  publishEvent(eventBus, {
    type: "system.info",
    detail: "Gravity Claw container initialized"
  });

  return {
    env,
    db,
    sessions,
    events,
    memories,
    forgeRepo,
    auditRepo,
    collaboration,
    calls,
    skillRepo,
    proactiveRepo,
    workspaces,
    conversations,
    mission,
    hiveRepo,
    providers,
    tools,
    mcp,
    eventBus,
    audit,
    docs,
    skills,
    runtime,
    lifecycle,
    forge,
    orchestrator,
    hive,
    swarm,
    telegram,
    elevenLabs,
    stt,
    twilio,
    callCoordinator,
    proactive,
    evolution,
    multimodal,
    pinecone,
    browser,
    terminal,
    fs,
    liveFeed,
    voice,
    heartbeat,
    recommendations,
    mesh
  };
}

export function getAppContainer() {
  if (!global.__gravityClawContainer) {
    global.__gravityClawContainer = buildContainer();
  }

  return global.__gravityClawContainer;
}

export function __resetContainerForTests() {
  global.__gravityClawContainer = undefined;
}
